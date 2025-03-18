package main

import (
	"encoding/json"
	"log"
	"time"
)

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
