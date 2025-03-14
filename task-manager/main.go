package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/streadway/amqp"
	"github.com/gorilla/mux"
)

// TaskStatus definiert die möglichen Status eines Tasks
type TaskStatus string

const (
	TaskCreated    TaskStatus = "CREATED"
	TaskAssigned   TaskStatus = "ASSIGNED"
	TaskRunning    TaskStatus = "RUNNING"
	TaskCompleted  TaskStatus = "COMPLETED"
	TaskFailed     TaskStatus = "FAILED"
	TaskMigrating  TaskStatus = "MIGRATING"
	TaskRecovering TaskStatus = "RECOVERING"
)

// Task repräsentiert eine Aufgabe im verteilten System
type Task struct {
	ID            string            `json:"id"`
	Type          string            `json:"type"`
	Status        TaskStatus        `json:"status"`
	Priority      int               `json:"priority"`
	Data          map[string]interface{} `json:"data"`
	Progress      int               `json:"progress"`
	WorkerID      string            `json:"worker_id,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	CheckpointData map[string]interface{} `json:"checkpoint_data,omitempty"`
}

// TaskManager verwaltet Tasks im verteilten System
type TaskManager struct {
	tasks        map[string]*Task
	mutex        sync.RWMutex
	amqpChannel  *amqp.Channel
	redisClient  *redis.Client
	workerStatus map[string]bool  // true = aktiv, false = inaktiv
	workerMutex  sync.RWMutex
}

// MessagePayload repräsentiert die Struktur der ausgetauschten Nachrichten
type MessagePayload struct {
	Type    string      `json:"type"`
	TaskID  string      `json:"task_id,omitempty"`
	WorkerID string     `json:"worker_id,omitempty"`
	Content interface{} `json:"content,omitempty"`
}

// NewTaskManager erstellt eine neue TaskManager-Instanz
func NewTaskManager(amqpConn *amqp.Connection, redisAddr string) (*TaskManager, error) {
	channel, err := amqpConn.Channel()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Erstellen des AMQP-Kanals: %w", err)
	}

	// Warteschlangen deklarieren
	queues := []string{"task_created", "task_assigned", "task_status", "worker_status", "task_checkpoint"}
	for _, queue := range queues {
		_, err = channel.QueueDeclare(
			queue, // Name
			true,  // Dauerhaft
			false, // Nicht löschen wenn unbenutzt
			false, // Nicht exklusiv
			false, // Kein Nolock
			nil,   // Keine Argumente
		)
		if err != nil {
			return nil, fmt.Errorf("Fehler beim Deklarieren der Warteschlange %s: %w", queue, err)
		}
	}

	// Redis-Client erstellen
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	return &TaskManager{
		tasks:        make(map[string]*Task),
		mutex:        sync.RWMutex{},
		amqpChannel:  channel,
		redisClient:  redisClient,
		workerStatus: make(map[string]bool),
		workerMutex:  sync.RWMutex{},
	}, nil
}

// Hauptfunktionalität hier...

// Beispiel-Methode zum Erstellen eines neuen Tasks
func (tm *TaskManager) CreateTask(taskType string, priority int, data map[string]interface{}) (*Task, error) {
	task := &Task{
		ID:        uuid.New().String(),
		Type:      taskType,
		Status:    TaskCreated,
		Priority:  priority,
		Data:      data,
		Progress:  0,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Task im lokalen Speicher und in Redis speichern
	tm.mutex.Lock()
	tm.tasks[task.ID] = task
	tm.mutex.Unlock()

	// Task in Redis speichern
	ctx := context.Background()
	taskJSON, err := json.Marshal(task)
	if err != nil {
		return nil, err
	}
	
	err = tm.redisClient.Set(ctx, "task:"+task.ID, taskJSON, 0).Err()
	if err != nil {
		return nil, err
	}

	// Task-Erstellung über Message Queue bekanntgeben
	msgPayload := MessagePayload{
		Type:   "task_created",
		TaskID: task.ID,
		Content: task,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		return nil, err
	}
	
	err = tm.amqpChannel.Publish(
		"",             // Exchange
		"task_created", // Routing-Schlüssel
		false,          // Mandatory
		false,          // Immediate
		amqp.Publishing{
			ContentType: "application/json",
			Body:        msgJSON,
		},
	)
	
	if err != nil {
		return nil, err
	}

	return task, nil
}

func main() {
	// Verbindung zu RabbitMQ herstellen
	amqpConn, err := amqp.Dial("amqp://guest:guest@rabbitmq:5672/")
	if err != nil {
		log.Fatalf("Fehler beim Verbinden mit RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// TaskManager erstellen
	taskManager, err := NewTaskManager(amqpConn, "redis:6379")
	if err != nil {
		log.Fatalf("Fehler beim Erstellen des TaskManagers: %v", err)
	}

	// HTTP-Router für die API
	r := mux.NewRouter()
	r.HandleFunc("/tasks", func(w http.ResponseWriter, r *http.Request) {
		// Handler-Implementierung
	}).Methods("GET")
	
	r.HandleFunc("/tasks", func(w http.ResponseWriter, r *http.Request) {
		// Handler-Implementierung
	}).Methods("POST")
	
	r.HandleFunc("/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		// Handler-Implementierung
	}).Methods("GET")

	// HTTP-Server starten
	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	// Graceful Shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fehler beim Starten des Servers: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server Shutdown fehlgeschlagen: %v", err)
	}
}
