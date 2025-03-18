package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"
)

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
