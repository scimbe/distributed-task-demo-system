package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/streadway/amqp"
)

// WorkerStatus definiert die möglichen Status eines Workers
type WorkerStatus string

const (
	WorkerIdle       WorkerStatus = "IDLE"
	WorkerBusy       WorkerStatus = "BUSY"
	WorkerOverloaded WorkerStatus = "OVERLOADED"
	WorkerFailing    WorkerStatus = "FAILING"
	WorkerShutdown   WorkerStatus = "SHUTDOWN"
)

// Task repräsentiert eine Aufgabe im verteilten System
type Task struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Status        string                 `json:"status"`
	Priority      int                    `json:"priority"`
	Data          map[string]interface{} `json:"data"`
	Progress      int                    `json:"progress"`
	WorkerID      string                 `json:"worker_id,omitempty"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
	CheckpointData map[string]interface{} `json:"checkpoint_data,omitempty"`
}

// Worker repräsentiert einen Arbeitsknoten im System
type Worker struct {
	ID             string
	Status         WorkerStatus
	CurrentTaskID  string
	amqpChannel    *amqp.Channel
	redisClient    *redis.Client
	taskQueue      chan *Task
	mutex          sync.RWMutex
	shutdownSignal chan struct{}
	checkpointFreq time.Duration
}

// MessagePayload repräsentiert die Struktur der ausgetauschten Nachrichten
type MessagePayload struct {
	Type    string      `json:"type"`
	TaskID  string      `json:"task_id,omitempty"`
	WorkerID string     `json:"worker_id,omitempty"`
	Content interface{} `json:"content,omitempty"`
}

// NewWorker erstellt eine neue Worker-Instanz
func NewWorker(amqpConn *amqp.Connection, redisAddr string) (*Worker, error) {
	channel, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Erstellen des AMQP-Kanals: %w", err)
	}

	// Redis-Client erstellen
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	worker := &Worker{
		ID:             uuid.New().String(),
		Status:         WorkerIdle,
		amqpChannel:    channel,
		redisClient:    redisClient,
		taskQueue:      make(chan *Task, 10),
		mutex:          sync.RWMutex{},
		shutdownSignal: make(chan struct{}),
		checkpointFreq: 5 * time.Second,
	}

	// Warteschlangen deklarieren
	_, err = channel.QueueDeclare(
		"task_created", // Name
		true,           // Dauerhaft
		false,          // Nicht löschen wenn unbenutzt
		false,          // Nicht exklusiv
		false,          // Kein Nolock
		nil,            // Keine Argumente
	)
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Deklarieren der Warteschlange: %w", err)
	}

	return worker, nil
}

// StartTaskProcessing startet die Verarbeitung von Tasks
func (w *Worker) StartTaskProcessing() error {
	// Task-Erstellungsnachrichten empfangen
	msgs, err := w.amqpChannel.Consume(
		"task_created", // Queue
		"",             // Consumer
		true,           // Auto-Ack
		false,          // Exclusive
		false,          // No-local
		false,          // No-wait
		nil,            // Args
	)
	if err != nil {
		return fmt.Errorf("Fehler beim Registrieren des Consumers: %w", err)
	}

	// Worker-Status senden
	go w.reportStatus()

	// Tasks verarbeiten
	go func() {
		for {
			select {
			case msg := <-msgs:
				// Task-Nachricht verarbeiten
				var payload MessagePayload
				if err := json.Unmarshal(msg.Body, &payload); err != nil {
					log.Printf("Fehler beim Deserialisieren der Nachricht: %v", err)
					continue
				}

				if payload.Type == "task_created" {
					var task Task
					taskData, ok := payload.Content.(map[string]interface{})
					if !ok {
						log.Printf("Ungültiges Task-Format")
						continue
					}

					// Task-Map in Task-Struktur konvertieren
					taskBytes, err := json.Marshal(taskData)
					if err != nil {
						log.Printf("Fehler beim Serialisieren des Tasks: %v", err)
						continue
					}

					if err := json.Unmarshal(taskBytes, &task); err != nil {
						log.Printf("Fehler beim Deserialisieren des Tasks: %v", err)
						continue
					}

					// Task zur Verarbeitung in die Warteschlange einfügen
					w.taskQueue <- &task
				}
			case task := <-w.taskQueue:
				// Task verarbeiten
				w.processTask(task)
			case <-w.shutdownSignal:
				return
			}
		}
	}()

	return nil
}

// processTask führt einen Task aus
func (w *Worker) processTask(task *Task) {
	w.mutex.Lock()
	w.Status = WorkerBusy
	w.CurrentTaskID = task.ID
	w.mutex.Unlock()

	// Task zuweisen
	task.Status = "RUNNING"
	task.WorkerID = w.ID
	task.UpdatedAt = time.Now()

	// Status aktualisieren
	w.updateTaskStatus(task)

	// Checkpoint-Timer starten
	checkpointTicker := time.NewTicker(w.checkpointFreq)
	defer checkpointTicker.Stop()

	// Task simulieren (je nach Typ unterschiedliche Verarbeitung)
	totalSteps := 10
	for step := 1; step <= totalSteps; step++ {
		// Simulation der Arbeit
		sleepTime := time.Duration(500+rand.Intn(1000)) * time.Millisecond
		time.Sleep(sleepTime)

		// Fortschritt aktualisieren
		task.Progress = (step * 100) / totalSteps
		w.updateTaskStatus(task)

		// Checkpoint speichern (bei jedem Timer-Tick)
		select {
		case <-checkpointTicker.C:
			w.saveCheckpoint(task)
		default:
			// Nicht blockieren
		}

		// Zufälligen Fehler simulieren (10% Wahrscheinlichkeit)
		if rand.Intn(100) < 10 {
			log.Printf("Task %s: Simulierter Fehler bei Schritt %d", task.ID, step)
			task.Status = "FAILED"
			w.updateTaskStatus(task)
			
			w.mutex.Lock()
			w.Status = WorkerIdle
			w.CurrentTaskID = ""
			w.mutex.Unlock()
			
			return
		}
	}

	// Task abschließen
	task.Status = "COMPLETED"
	task.Progress = 100
	task.UpdatedAt = time.Now()
	w.updateTaskStatus(task)

	w.mutex.Lock()
	w.Status = WorkerIdle
	w.CurrentTaskID = ""
	w.mutex.Unlock()

	log.Printf("Task %s abgeschlossen", task.ID)
}

// updateTaskStatus aktualisiert den Status eines Tasks
func (w *Worker) updateTaskStatus(task *Task) {
	// Status-Update an Redis senden
	ctx := context.Background()
	taskJSON, err := json.Marshal(task)
	if err != nil {
		log.Printf("Fehler beim Serialisieren des Tasks: %v", err)
		return
	}
	
	err = w.redisClient.Set(ctx, "task:"+task.ID, taskJSON, 0).Err()
	if err != nil {
		log.Printf("Fehler beim Speichern des Tasks in Redis: %v", err)
	}

	// Status-Update über Message Queue senden
	msgPayload := MessagePayload{
		Type:    "task_status",
		TaskID:  task.ID,
		WorkerID: w.ID,
		Content: task,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		log.Printf("Fehler beim Serialisieren der Nachricht: %v", err)
		return
	}
	
	err = w.amqpChannel.Publish(
		"",            // Exchange
		"task_status", // Routing-Schlüssel
		false,         // Mandatory
		false,         // Immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        msgJSON,
		},
	)
	
	if err != nil {
		log.Printf("Fehler beim Senden des Status-Updates: %v", err)
	}
}

// saveCheckpoint speichert einen Checkpoint des Task-Zustands
func (w *Worker) saveCheckpoint(task *Task) {
	// Simuliere Checkpoint-Daten
	task.CheckpointData = map[string]interface{}{
		"timestamp": time.Now(),
		"progress":  task.Progress,
		"step":      fmt.Sprintf("step_%d", task.Progress/10),
	}

	// Checkpoint-Daten in Redis speichern
	ctx := context.Background()
	checkpointJSON, err := json.Marshal(task.CheckpointData)
	if err != nil {
		log.Printf("Fehler beim Serialisieren des Checkpoints: %v", err)
		return
	}
	
	err = w.redisClient.Set(ctx, fmt.Sprintf("checkpoint:%s:%d", task.ID, task.Progress), checkpointJSON, 0).Err()
	if err != nil {
		log.Printf("Fehler beim Speichern des Checkpoints in Redis: %v", err)
	}

	// Checkpoint-Update über Message Queue senden
	msgPayload := MessagePayload{
		Type:    "task_checkpoint",
		TaskID:  task.ID,
		WorkerID: w.ID,
		Content: task.CheckpointData,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		log.Printf("Fehler beim Serialisieren der Checkpoint-Nachricht: %v", err)
		return
	}
	
	err = w.amqpChannel.Publish(
		"",               // Exchange
		"task_checkpoint", // Routing-Schlüssel
		false,            // Mandatory
		false,            // Immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        msgJSON,
		},
	)
	
	if err != nil {
		log.Printf("Fehler beim Senden des Checkpoint-Updates: %v", err)
	}
}

// reportStatus sendet regelmäßig Status-Updates
func (w *Worker) reportStatus() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Status-Update senden
			w.mutex.RLock()
			status := w.Status
			taskID := w.CurrentTaskID
			w.mutex.RUnlock()

			statusPayload := map[string]interface{}{
				"id":     w.ID,
				"status": status,
				"task":   taskID,
				"time":   time.Now(),
			}

			msgPayload := MessagePayload{
				Type:    "worker_status",
				WorkerID: w.ID,
				Content: statusPayload,
			}
			
			msgJSON, err := json.Marshal(msgPayload)
			if err != nil {
				log.Printf("Fehler beim Serialisieren des Status: %v", err)
				continue
			}
			
			err = w.amqpChannel.Publish(
				"",              // Exchange
				"worker_status", // Routing-Schlüssel
				false,           // Mandatory
				false,           // Immediate
				amqp.Publishing{
					ContentType: "application/json",
					Body:        msgJSON,
				},
			)
			
			if err != nil {
				log.Printf("Fehler beim Senden des Worker-Status: %v", err)
			}
		case <-w.shutdownSignal:
			return
		}
	}
}

func main() {
	// Zufallsgenerator initialisieren
	rand.Seed(time.Now().UnixNano())

	// Verbindung zu RabbitMQ herstellen
	amqpConn, err := amqp.Dial("amqp://guest:guest@rabbitmq:5672/")
	if err != nil {
		log.Fatalf("Fehler beim Verbinden mit RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// Worker erstellen
	worker, err := NewWorker(amqpConn, "redis:6379")
	if err != nil {
		log.Fatalf("Fehler beim Erstellen des Workers: %v", err)
	}

	// Task-Verarbeitung starten
	if err := worker.StartTaskProcessing(); err != nil {
		log.Fatalf("Fehler beim Starten der Task-Verarbeitung: %v", err)
	}

	log.Printf("Worker gestartet mit ID: %s", worker.ID)

	// Warten auf Beendigungssignal
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Worker wird heruntergefahren...")
	close(worker.shutdownSignal)
	time.Sleep(1 * time.Second) // Zeit zum Aufräumen geben
}
