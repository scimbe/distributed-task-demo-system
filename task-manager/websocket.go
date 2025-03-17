package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	
	"github.com/gorilla/websocket"
)

// WebSocketHandler verwaltet die WebSocket-Verbindungen und Nachrichten
type WebSocketHandler struct {
	clients      map[*websocket.Conn]bool
	broadcast    chan []byte
	register     chan *websocket.Conn
	unregister   chan *websocket.Conn
	mutex        sync.Mutex
	upgrader     websocket.Upgrader
}

// NewWebSocketHandler erstellt einen neuen WebSocketHandler
func NewWebSocketHandler() *WebSocketHandler {
	return &WebSocketHandler{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		mutex:      sync.Mutex{},
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// Erlaube alle Origins für einfachere Entwicklung
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

// Start startet den WebSocketHandler
func (wsh *WebSocketHandler) Start() {
	go func() {
		for {
			select {
			case client := <-wsh.register:
				wsh.mutex.Lock()
				wsh.clients[client] = true
				wsh.mutex.Unlock()
				log.Printf("Neue WebSocket-Verbindung registriert. Aktive Verbindungen: %d", len(wsh.clients))
			
			case client := <-wsh.unregister:
				wsh.mutex.Lock()
				if _, ok := wsh.clients[client]; ok {
					delete(wsh.clients, client)
					client.Close()
				}
				wsh.mutex.Unlock()
				log.Printf("WebSocket-Verbindung geschlossen. Aktive Verbindungen: %d", len(wsh.clients))
			
			case message := <-wsh.broadcast:
				wsh.mutex.Lock()
				for client := range wsh.clients {
					err := client.WriteMessage(websocket.TextMessage, message)
					if err != nil {
						log.Printf("Fehler beim Senden der WebSocket-Nachricht: %v", err)
						client.Close()
						delete(wsh.clients, client)
					}
				}
				wsh.mutex.Unlock()
			}
		}
	}()
}

// HandleWebSocket ist der HTTP-Handler für die WebSocket-Verbindungen
func (wsh *WebSocketHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := wsh.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Fehler beim Upgrade der WebSocket-Verbindung: %v", err)
		return
	}
	
	// Registriere neue Verbindung
	wsh.register <- conn
	
	// Sende eine Begrüßungsnachricht
	welcomeMsg := map[string]interface{}{
		"type": "welcome",
		"content": map[string]string{
			"message": "Willkommen beim Task-Manager WebSocket-Server",
		},
	}
	
	msgJSON, err := json.Marshal(welcomeMsg)
	if err == nil {
		conn.WriteMessage(websocket.TextMessage, msgJSON)
	}
	
	// Überwache Verbindung in einer Goroutine
	go func() {
		defer func() {
			wsh.unregister <- conn
		}()
		
		for {
			// Lese Nachrichten vom Client
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket-Lesefehler: %v", err)
				}
				break
			}
			// Wir nutzen derzeit keine Nachrichten vom Client
		}
	}()
}

// BroadcastTaskUpdate sendet ein Task-Update an alle verbundenen Clients
func (wsh *WebSocketHandler) BroadcastTaskUpdate(task *Task) {
	msgPayload := map[string]interface{}{
		"type": "task_update",
		"taskId": task.ID,
		"content": task,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		log.Printf("Fehler beim Serialisieren des Task-Updates: %v", err)
		return
	}
	
	wsh.broadcast <- msgJSON
}

// BroadcastWorkerUpdate sendet ein Worker-Update an alle verbundenen Clients
func (wsh *WebSocketHandler) BroadcastWorkerUpdate(worker *Worker) {
	msgPayload := map[string]interface{}{
		"type": "worker_update",
		"workerId": worker.ID,
		"content": worker,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		log.Printf("Fehler beim Serialisieren des Worker-Updates: %v", err)
		return
	}
	
	wsh.broadcast <- msgJSON
}

// BroadcastMessage sendet eine allgemeine Nachricht an alle verbundenen Clients
func (wsh *WebSocketHandler) BroadcastMessage(messageType string, content interface{}) {
	msgPayload := map[string]interface{}{
		"type": messageType,
		"content": content,
	}
	
	msgJSON, err := json.Marshal(msgPayload)
	if err != nil {
		log.Printf("Fehler beim Serialisieren der Nachricht: %v", err)
		return
	}
	
	wsh.broadcast <- msgJSON
}
