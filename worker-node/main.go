package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
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

// TimeFormat ist das Format für Zeit-Felder
type TimeFormat time.Time

// MarshalJSON für ISO-Format-Serialisierung
func (t TimeFormat) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t).Format(time.RFC3339))
}

// UnmarshalJSON für ISO-Format-Deserialisierung
func (t *TimeFormat) UnmarshalJSON(data []byte) error {
	var timeStr string
	err := json.Unmarshal(data, &timeStr)
	if err != nil {
		return err
	}
	
	parsedTime, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return err
	}
	
	*t = TimeFormat(parsedTime)
	return nil
}

// Task repräsentiert eine Aufgabe im verteilten System
type Task struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Status        string                 `json:"status"`
	Priority      int                    `json:"priority"`
	Data          map[string]interface{} `json:"data"`
	Progress      int                    `json:"progress"`
	WorkerID      string                 `json:"worker_id,omitempty"`
	CreatedAt     TimeFormat             `json:"created_at"`
	UpdatedAt     TimeFormat             `json:"updated_at"`
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
func NewWorker(amqpConn *amqp.Connection, redisAddr string, workerID string) (*Worker, error) {
	channel, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Erstellen des AMQP-Kanals: %w", err)
	}

	// Redis-Client erstellen
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	// Redis-Verbindung testen
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Verbinden mit Redis: %w", err)
	}

	worker := &Worker{
		ID:             workerID,
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

// Erweiterte Verarbeitung von Task-Nachrichten
func (w *Worker) processTaskMessage(msg []byte) {
	var payload MessagePayload
	if err := json.Unmarshal(msg, &payload); err != nil {
		log.Printf("Fehler beim Deserialisieren der Nachricht: %v", err)
		return
	}

	// Task-Daten extrahieren
	taskBytes, err := json.Marshal(payload.Content)
	if err != nil {
		log.Printf("Fehler beim Re-Serialisieren der Task-Daten: %v", err)
		return
	}

	var task Task
	if err := json.Unmarshal(taskBytes, &task); err != nil {
		log.Printf("Fehler beim Deserialisieren der Task-Daten: %v", err)
		return
	}

	// Verarbeitung je nach Nachrichtentyp
	switch payload.Type {
	case "task_created":
		// Normaler neuer Task
		log.Printf("Neuer Task empfangen: %s (Typ: %s, Priorität: %d, Status: %s)",
			task.ID, task.Type, task.Priority, task.Status)

		// Prüfe, ob es sich um einen wiederherzustellenden Task handelt
		if task.Status == "RECOVERING" {
			// Behandle Recovery-Task direkt
			w.handleRecoveryTask(&task)
		} else {
			// Normaler Task zur Verarbeitung
			w.taskQueue <- &task
		}

	case "task_recovery":
		// Recovery-Nachricht für einen ausgefallenen Task
		log.Printf("Recovery-Task empfangen: %s (Typ: %s, Priorität: %d)",
			task.ID, task.Type, task.Priority)

		// Recovery-Task direkt verarbeiten
		w.handleRecoveryTask(&task)

	case "task_migration":
		// Migration-Nachricht
		// Prüfen, ob dieser Worker das Ziel ist
		migrationData, ok := payload.Content.(map[string]interface{})
		if !ok {
			log.Printf("Ungültiges Format für Migrations-Daten")
			return
		}

		targetWorkerId, _ := migrationData["targetWorkerId"].(string)
		if targetWorkerId == w.ID {
			// Dieser Worker ist das Ziel der Migration
			log.Printf("Migration-Ziel für Task %s", payload.TaskID)

			// Task aus Redis laden
			task, err := w.loadTaskFromRedis(payload.TaskID)
			if err != nil {
				log.Printf("Fehler beim Laden des Task %s für Migration: %v", payload.TaskID, err)
				return
			}

			// Task zur Verarbeitung weitergeben
			w.handleRecoveryTask(task)
		}
	}
}

// Hilfsfunktion zum Laden eines Tasks aus Redis
func (w *Worker) loadTaskFromRedis(taskId string) (*Task, error) {
	ctx := context.Background()
	taskJSON, err := w.redisClient.Get(ctx, "task:"+taskId).Result()
	if err != nil {
		return nil, err
	}

	var task Task
	if err := json.Unmarshal([]byte(taskJSON), &task); err != nil {
		return nil, err
	}

	return &task, nil
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
				// Task-Nachricht mit erweiterter Funktionalität verarbeiten
				w.processTaskMessage(msg.Body)
				
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

// Behandlung von Task-Recovery-Nachrichten
func (w *Worker) handleRecoveryTask(task *Task) {
	log.Printf("Wiederherstellung von Task %s nach Worker-Ausfall", task.ID)

	// Prüfen, ob Checkpoint-Daten vorhanden sind
	if task.CheckpointData == nil {
		// Lade den letzten Checkpoint aus Redis
		ctx := context.Background()
		
		// Suche nach allen Checkpoints für diesen Task
		checkpointKeys, err := w.redisClient.Keys(ctx, fmt.Sprintf("checkpoint:%s:*", task.ID)).Result()
		
		if err != nil {
			log.Printf("Fehler beim Suchen nach Checkpoints für Task %s: %v", task.ID, err)
		} else if len(checkpointKeys) > 0 {
			// Sortiere Checkpoints nach Fortschritt (absteigend)
			sort.Slice(checkpointKeys, func(i, j int) bool {
				// Extrahiere Fortschritt aus Key "checkpoint:task_id:progress"
				progressI := extractProgressFromKey(checkpointKeys[i])
				progressJ := extractProgressFromKey(checkpointKeys[j])
				return progressI > progressJ
			})
			
			// Lade den neuesten Checkpoint
			latestCheckpoint, err := w.redisClient.Get(ctx, checkpointKeys[0]).Result()
			if err == nil {
				var checkpointData map[string]interface{}
				if err := json.Unmarshal([]byte(latestCheckpoint), &checkpointData); err == nil {
					task.CheckpointData = checkpointData
					
					// Aktualisiere Fortschritt basierend auf Checkpoint
					if progress, ok := checkpointData["progress"].(float64); ok {
						task.Progress = int(progress)
					}
					
					log.Printf("Task %s: Letzter Checkpoint mit Fortschritt %d%% geladen", 
						task.ID, task.Progress)
				}
			}
		}
	}

	// Worker-ID aktualisieren
	task.WorkerID = w.ID
	
	// Setze Status auf "RUNNING"
	task.Status = "RUNNING"
	task.UpdatedAt = TimeFormat(time.Now())
	
	// Status aktualisieren
	w.updateTaskStatus(task)
	
	// Task normal verarbeiten, aber starte ab dem letzten Checkpoint
	// Berechne die verbleibenden Schritte basierend auf dem Fortschritt
	remainingSteps := 10 - (task.Progress / 10)
	startProgress := task.Progress
	
	w.mutex.Lock()
	w.Status = WorkerBusy
	w.CurrentTaskID = task.ID
	w.mutex.Unlock()
	
	log.Printf("Task %s: Wiederherstellung ab Fortschritt %d%%, noch %d Schritte", 
		task.ID, startProgress, remainingSteps)
	
	// Checkpoint-Timer starten
	checkpointTicker := time.NewTicker(w.checkpointFreq)
	defer checkpointTicker.Stop()
	
	// Task simulieren (je nach Typ unterschiedliche Verarbeitung)
	for step := 1; step <= remainingSteps; step++ {
		// Simulation der Arbeit
		sleepTime := time.Duration(500+rand.Intn(1000)) * time.Millisecond
		time.Sleep(sleepTime)
		
		// Fortschritt aktualisieren
		task.Progress = startProgress + (step * 100 / 10)
		if task.Progress > 100 {
			task.Progress = 100
		}
		
		task.UpdatedAt = TimeFormat(time.Now())
		w.updateTaskStatus(task)
		
		log.Printf("Task %s: Fortschritt nach Wiederherstellung %d%%", task.ID, task.Progress)
		
		// Checkpoint speichern (bei jedem Timer-Tick)
		select {
		case <-checkpointTicker.C:
			w.saveCheckpoint(task)
		default:
			// Nicht blockieren
		}
		
		// Zufälligen Fehler simulieren (reduzierte Wahrscheinlichkeit nach Recovery)
		if rand.Intn(100) < 3 {
			log.Printf("Task %s: Simulierter Fehler bei Schritt %d nach Wiederherstellung", task.ID, step)
			task.Status = "FAILED"
			task.UpdatedAt = TimeFormat(time.Now())
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
	task.UpdatedAt = TimeFormat(time.Now())
	w.updateTaskStatus(task)
	
	w.mutex.Lock()
	w.Status = WorkerIdle
	w.CurrentTaskID = ""
	w.mutex.Unlock()
	
	log.Printf("Task %s nach Wiederherstellung abgeschlossen", task.ID)
}

// Hilfsfunktion zum Extrahieren des Fortschritts aus einem Checkpoint-Key
func extractProgressFromKey(key string) int {
	parts := strings.Split(key, ":")
	if len(parts) < 3 {
		return 0
	}
	
	progress, err := strconv.Atoi(parts[2])
	if err != nil {
		return 0
	}
	
	return progress
}

// processTask führt einen Task aus
func (w *Worker) processTask(task *Task) {
	w.mutex.Lock()
	w.Status = WorkerBusy
	w.CurrentTaskID = task.ID
	w.mutex.Unlock()

	log.Printf("Starte Verarbeitung von Task %s", task.ID)

	// Task zuweisen
	task.Status = "RUNNING"
	task.WorkerID = w.ID
	task.UpdatedAt = TimeFormat(time.Now())

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
		task.UpdatedAt = TimeFormat(time.Now())
		w.updateTaskStatus(task)

		log.Printf("Task %s: Fortschritt %d%%", task.ID, task.Progress)

		// Checkpoint speichern (bei jedem Timer-Tick)
		select {
		case <-checkpointTicker.C:
			w.saveCheckpoint(task)
		default:
			// Nicht blockieren
		}

		// Zufälligen Fehler simulieren (5% Wahrscheinlichkeit - reduziert von 10%)
		if rand.Intn(100) < 5 {
			log.Printf("Task %s: Simulierter Fehler bei Schritt %d", task.ID, step)
			task.Status = "FAILED"
			task.UpdatedAt = TimeFormat(time.Now())
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
	task.UpdatedAt = TimeFormat(time.Now())
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
	timestamp := time.Now()
	task.CheckpointData = map[string]interface{}{
		"timestamp": timestamp.Format(time.RFC3339),
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

	log.Printf("Checkpoint für Task %s bei %d%% gespeichert", task.ID, task.Progress)

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
				"time":   time.Now().Format(time.RFC3339),
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
			} else {
				log.Printf("Worker %s Status gesendet: %s", w.ID, status)
			}
		case <-w.shutdownSignal:
			return
		}
	}
}

func main() {
	// Zufallsgenerator initialisieren
	rand.Seed(time.Now().UnixNano())

	// Worker-ID aus Umgebungsvariable lesen
	workerID := os.Getenv("WORKER_ID")
	if workerID == "" {
		// Fallback auf zufällige ID, falls keine Umgebungsvariable gesetzt ist
		workerID = fmt.Sprintf("worker-%d", rand.Intn(1000))
	}

	// RabbitMQ-URL aus Umgebungsvariable lesen
	rabbitmqURL := os.Getenv("RABBITMQ_URL")
	if rabbitmqURL == "" {
		rabbitmqURL = "amqp://guest:guest@rabbitmq:5672/"
	}

	// Redis-URL aus Umgebungsvariable lesen
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis:6379"
	}

	log.Printf("Starte Worker mit ID: %s", workerID)
	log.Printf("Verbinde mit RabbitMQ: %s", rabbitmqURL)
	log.Printf("Verbinde mit Redis: %s", redisURL)

	// Verbindung zu RabbitMQ herstellen
	amqpConn, err := amqp.Dial(rabbitmqURL)
	if err != nil {
		log.Fatalf("Fehler beim Verbinden mit RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// Worker erstellen
	worker, err := NewWorker(amqpConn, redisURL, workerID)
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