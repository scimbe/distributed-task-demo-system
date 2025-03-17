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
	"github.com/gorilla/mux"
	"github.com/streadway/amqp"
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

// TimeJSON ist ein Zeittyp, der für JSON-Serialisierung optimiert ist
type TimeJSON time.Time

// MarshalJSON für ISO-Format-Serialisierung
func (t TimeJSON) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(t).Format(time.RFC3339))
}

// Task repräsentiert eine Aufgabe im verteilten System
type Task struct {
	ID            string                 `json:"id"`
	Type          string                 `json:"type"`
	Status        TaskStatus             `json:"status"`
	Priority      int                    `json:"priority"`
	Data          map[string]interface{} `json:"data"`
	Progress      int                    `json:"progress"`
	WorkerID      string                 `json:"worker_id,omitempty"`
	CreatedAt     TimeJSON               `json:"created_at"`
	UpdatedAt     TimeJSON               `json:"updated_at"`
	CheckpointData map[string]interface{} `json:"checkpoint_data,omitempty"`
}

// Worker repräsentiert einen Arbeitsknoten im System
type Worker struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"`
	Task      string    `json:"task,omitempty"`
	LastSeen  TimeJSON  `json:"lastSeen"`
}

// TaskManager verwaltet Tasks im verteilten System
type TaskManager struct {
	tasks        map[string]*Task
	mutex        sync.RWMutex
	amqpChannel  *amqp.Channel
	redisClient  *redis.Client
	workerStatus map[string]*Worker  // workerID -> Worker
	workerMutex  sync.RWMutex
	wsHandler    *WebSocketHandler   // WebSocket-Handler
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

	// WebSocket-Handler erstellen
	wsHandler := NewWebSocketHandler()
	wsHandler.Start()

	tm := &TaskManager{
		tasks:        make(map[string]*Task),
		mutex:        sync.RWMutex{},
		amqpChannel:  channel,
		redisClient:  redisClient,
		workerStatus: make(map[string]*Worker),
		workerMutex:  sync.RWMutex{},
		wsHandler:    wsHandler,
	}

	// Worker-Status-Updates konsumieren
	err = tm.consumeWorkerStatus()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Einrichten des Worker-Status-Consumers: %w", err)
	}

	// Task-Status-Updates konsumieren
	err = tm.consumeTaskStatus()
	if err != nil {
		return nil, fmt.Errorf("Fehler beim Einrichten des Task-Status-Consumers: %w", err)
	}

	// Tasks aus Redis laden
	err = tm.loadTasksFromRedis()
	if err != nil {
		log.Printf("Warnung: Fehler beim Laden der Tasks aus Redis: %v", err)
		// Kein fataler Fehler, wir können mit einem leeren Task-Set arbeiten
	}

	return tm, nil
}

// consumeWorkerStatus verarbeitet Worker-Status-Updates aus der Message Queue
func (tm *TaskManager) consumeWorkerStatus() error {
	msgs, err := tm.amqpChannel.Consume(
		"worker_status", // Queue
		"",             // Consumer
		true,           // Auto-Ack
		false,          // Exclusive
		false,          // No-local
		false,          // No-wait
		nil,            // Args
	)
	if err != nil {
		return err
	}

	go func() {
		for msg := range msgs {
			var payload MessagePayload
			if err := json.Unmarshal(msg.Body, &payload); err != nil {
				log.Printf("Fehler beim Deserialisieren der Worker-Status-Nachricht: %v", err)
				continue
			}

			statusData, ok := payload.Content.(map[string]interface{})
			if !ok {
				log.Printf("Ungültiges Format für Worker-Status")
				continue
			}

			workerId, _ := statusData["id"].(string)
			status, _ := statusData["status"].(string)
			task, _ := statusData["task"].(string)

			if workerId == "" {
				continue
			}

			worker := &Worker{
				ID:       workerId,
				Status:   status,
				Task:     task,
				LastSeen: TimeJSON(time.Now()),
			}

			tm.workerMutex.Lock()
			tm.workerStatus[workerId] = worker
			tm.workerMutex.Unlock()

			// Worker-Update über WebSockets senden
			tm.wsHandler.BroadcastWorkerUpdate(worker)
		}
	}()

	return nil
}

// consumeTaskStatus verarbeitet Task-Status-Updates aus der Message Queue
func (tm *TaskManager) consumeTaskStatus() error {
	msgs, err := tm.amqpChannel.Consume(
		"task_status", // Queue
		"",            // Consumer
		true,          // Auto-Ack
		false,         // Exclusive
		false,         // No-local
		false,         // No-wait
		nil,           // Args
	)
	if err != nil {
		return err
	}

	go func() {
		for msg := range msgs {
			var payload MessagePayload
			if err := json.Unmarshal(msg.Body, &payload); err != nil {
				log.Printf("Fehler beim Deserialisieren der Task-Status-Nachricht: %v", err)
				continue
			}

			// Extrahiere Task-Daten aus der Nachricht
			taskBytes, err := json.Marshal(payload.Content)
			if err != nil {
				log.Printf("Fehler beim Marshalling der Task-Daten: %v", err)
				continue
			}

			var task Task
			if err := json.Unmarshal(taskBytes, &task); err != nil {
				log.Printf("Fehler beim Unmarshalling der Task-Daten: %v", err)
				continue
			}

			// Aktualisiere Task in der Map
			tm.mutex.Lock()
			tm.tasks[task.ID] = &task
			tm.mutex.Unlock()

			// Speichere Task in Redis
			ctx := context.Background()
			tm.redisClient.Set(ctx, "task:"+task.ID, taskBytes, 0)

			// Task-Update über WebSockets senden
			tm.wsHandler.BroadcastTaskUpdate(&task)
		}
	}()

	return nil
}

// loadTasksFromRedis lädt alle gespeicherten Tasks aus Redis in den Speicher
func (tm *TaskManager) loadTasksFromRedis() error {
	ctx := context.Background()
	
	// Suche nach Task-Keys mit dem Pattern "task:*"
	keys, err := tm.redisClient.Keys(ctx, "task:*").Result()
	if err != nil {
		return err
	}
	
	for _, key := range keys {
		// Task-ID aus dem Schlüssel extrahieren
		taskId := key[5:] // Entferne "task:" Präfix
		
		// Task-Daten aus Redis laden
		taskJSON, err := tm.redisClient.Get(ctx, key).Result()
		if err != nil {
			log.Printf("Fehler beim Laden des Tasks %s aus Redis: %v", taskId, err)
			continue
		}
		
		// Task deserialisieren
		var task Task
		if err := json.Unmarshal([]byte(taskJSON), &task); err != nil {
			log.Printf("Fehler beim Deserialisieren des Tasks %s: %v", taskId, err)
			continue
		}
		
		// Task zur Map hinzufügen
		tm.mutex.Lock()
		tm.tasks[taskId] = &task
		tm.mutex.Unlock()
		
		log.Printf("Task %s aus Redis geladen: %s (Status: %s)", taskId, task.Type, task.Status)
	}
	
	log.Printf("%d Tasks aus Redis geladen", len(keys))
	return nil
}

// CreateTask erstellt einen neuen Task im System
func (tm *TaskManager) CreateTask(taskType string, priority int, data map[string]interface{}) (*Task, error) {
	task := &Task{
		ID:        uuid.New().String(),
		Type:      taskType,
		Status:    TaskCreated,
		Priority:  priority,
		Data:      data,
		Progress:  0,
		CreatedAt: TimeJSON(time.Now()),
		UpdatedAt: TimeJSON(time.Now()),
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

	// Task-Update über WebSockets senden
	tm.wsHandler.BroadcastTaskUpdate(task)

	return task, nil
}

// GetAllTasks gibt alle Tasks im System zurück
func (tm *TaskManager) GetAllTasks() []*Task {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	
	tasks := make([]*Task, 0, len(tm.tasks))
	for _, task := range tm.tasks {
		tasks = append(tasks, task)
	}
	
	return tasks
}

// GetTask gibt einen bestimmten Task anhand seiner ID zurück
func (tm *TaskManager) GetTask(id string) (*Task, bool) {
	tm.mutex.RLock()
	defer tm.mutex.RUnlock()
	
	task, exists := tm.tasks[id]
	return task, exists
}

// GetAllWorkers gibt alle bekannten Worker zurück
func (tm *TaskManager) GetAllWorkers() []*Worker {
	tm.workerMutex.RLock()
	defer tm.workerMutex.RUnlock()

	// Erstelle die Mock-Worker für die Demo, falls keine echten Worker vorhanden sind
	if len(tm.workerStatus) == 0 {
		// Zeit für die Mock-Worker-Erstellung
		now := time.Now()

		// Mock-Worker erstellen
		mockWorkers := []*Worker{
			{ID: "worker-1", Status: "IDLE", LastSeen: TimeJSON(now)},
			{ID: "worker-2", Status: "IDLE", LastSeen: TimeJSON(now)},
			{ID: "worker-3", Status: "IDLE", LastSeen: TimeJSON(now)},
		}

		// Füge die Mock-Worker in die Map ein
		for _, worker := range mockWorkers {
			tm.workerStatus[worker.ID] = worker
		}
	}

	// Sammle alle Worker
	workers := make([]*Worker, 0, len(tm.workerStatus))
	for _, worker := range tm.workerStatus {
		workers = append(workers, worker)
	}

	return workers
}

// MigrateTask migriert einen Task zu einem anderen Worker
func (tm *TaskManager) MigrateTask(taskId string, targetWorkerId string) (*Task, error) {
	// Finde den Task
	tm.mutex.Lock()
	defer tm.mutex.Unlock()

	task, exists := tm.tasks[taskId]
	if !exists {
		return nil, fmt.Errorf("Task nicht gefunden")
	}

	// Aktualisiere den Task-Status
	task.Status = TaskMigrating
	task.UpdatedAt = TimeJSON(time.Now())

	// Speichere den aktualisierten Task
	ctx := context.Background()
	taskJSON, err := json.Marshal(task)
	if err != nil {
		return nil, err
	}

	err = tm.redisClient.Set(ctx, "task:"+task.ID, taskJSON, 0).Err()
	if err != nil {
		return nil, err
	}

	// Sende eine Nachricht, um die Migration zu initiieren
	migrationData := map[string]interface{}{
		"targetWorkerId": targetWorkerId,
		"fromWorker": task.WorkerID,
		"toWorker": targetWorkerId,
	}

	msgPayload := MessagePayload{
		Type:    "task_migration",
		TaskID:  task.ID,
		Content: migrationData,
	}

	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		return nil, err
	}

	err = tm.amqpChannel.Publish(
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
		return nil, err
	}

	// Migration-Event über WebSockets senden
	tm.wsHandler.BroadcastMessage("task_migration", map[string]interface{}{
		"taskId": task.ID,
		"fromWorker": task.WorkerID,
		"toWorker": targetWorkerId,
	})

	// Task-Update über WebSockets senden
	tm.wsHandler.BroadcastTaskUpdate(task)

	return task, nil
}

func main() {
	// Verbindung zu RabbitMQ herstellen
	amqpURL := os.Getenv("RABBITMQ_URL")
	if amqpURL == "" {
		amqpURL = "amqp://guest:guest@rabbitmq:5672/"
	}
	
	log.Printf("Verbinde mit RabbitMQ: %s", amqpURL)
	amqpConn, err := amqp.Dial(amqpURL)
	if err != nil {
		log.Fatalf("Fehler beim Verbinden mit RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// Redis-URL aus Umgebungsvariable lesen
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis:6379"
	}
	log.Printf("Verbinde mit Redis: %s", redisURL)

	// TaskManager erstellen
	tm, err := NewTaskManager(amqpConn, redisURL)
	if err != nil {
		log.Fatalf("Fehler beim Erstellen des TaskManagers: %v", err)
	}

	// CORS-Middleware für alle Anfragen
	corsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}
	
	// HTTP-Router für die API
	r := mux.NewRouter()
	
	// WebSocket-Endpunkt
	r.HandleFunc("/ws", tm.wsHandler.HandleWebSocket)
	
	// GET /api/tasks - Alle Tasks abrufen
	r.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {
		tasks := tm.GetAllTasks()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tasks)
	}).Methods("GET")
	
	// POST /api/tasks - Neuen Task erstellen
	r.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {
		var taskRequest struct {
			Type     string                 `json:"type"`
			Priority int                    `json:"priority"`
			Data     map[string]interface{} `json:"data"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&taskRequest); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		task, err := tm.CreateTask(taskRequest.Type, taskRequest.Priority, taskRequest.Data)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(task)
	}).Methods("POST")
	
	// GET /api/tasks/{id} - Bestimmten Task abrufen
	r.HandleFunc("/api/tasks/{id}", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		
		task, exists := tm.GetTask(id)
		if !exists {
			http.Error(w, "Task nicht gefunden", http.StatusNotFound)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(task)
	}).Methods("GET")
	
	// GET /api/workers - Alle Worker abrufen
	r.HandleFunc("/api/workers", func(w http.ResponseWriter, r *http.Request) {
		workers := tm.GetAllWorkers()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(workers)
	}).Methods("GET")
	
	// POST /api/tasks/{id}/migrate - Task migrieren
	r.HandleFunc("/api/tasks/{id}/migrate", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		
		var migrateRequest struct {
			WorkerId string `json:"workerId"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&migrateRequest); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		
		task, err := tm.MigrateTask(id, migrateRequest.WorkerId)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(task)
	}).Methods("POST")

	// HTTP-Server starten
	handler := corsMiddleware(r)
	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	// Server im Hintergrund starten
	go func() {
		log.Println("Task-Manager-API gestartet auf :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fehler beim Starten des Servers: %v", err)
		}
	}()

	// Auf Beendigungssignal warten
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Server wird heruntergefahren...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server Shutdown fehlgeschlagen: %v", err)
	}
	log.Println("Server erfolgreich beendet")
}