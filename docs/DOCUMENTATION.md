# Distributed Task Demo System - Dokumentation

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Systemarchitektur](#systemarchitektur)
3. [Installation und Einrichtung](#installation-und-einrichtung)
4. [Nutzung des Systems](#nutzung-des-systems)
5. [Frontend und Visualisierung](#frontend-und-visualisierung)
6. [Task-Lebenszyklus](#task-lebenszyklus)
7. [Fehlertoleranz und Wiederherstellung](#fehlertoleranz-und-wiederherstellung)
8. [Task-Migration](#task-migration)
9. [Demo-Szenarien](#demo-szenarien)
10. [API-Referenz](#api-referenz)
11. [Erweiterung des Systems](#erweiterung-des-systems)
12. [Fehlerbehebung](#fehlerbehebung)
13. [Glossar](#glossar)

## Einführung

Das Distributed Task Demo System ist eine Lehr- und Demonstrationsplattform, die entwickelt wurde, um die Kernkonzepte von Tasks in verteilten Systemen zu veranschaulichen. Es zeigt, wie Tasks erstellt, verteilt, ausgeführt, migriert und wiederhergestellt werden können, und bietet eine interaktive Visualisierung dieser Prozesse.

### Lernziele

- Verstehen der Grundprinzipien von Task-Verteilung in verteilten Systemen
- Beobachten und Analysieren von Fehlertoleranz-Mechanismen
- Kennenlernen der Kommunikationsmuster zwischen verteilten Komponenten
- Erfahren, wie Task-Zustände gespeichert und wiederhergestellt werden
- Verständnis für die Migration von Tasks zwischen verschiedenen Knoten

### Für wen ist dieses System geeignet?

Dieses System richtet sich an:
- Studierende der Informatik und verwandter Disziplinen
- Lehrende, die verteilte Systeme unterrichten
- Entwickler, die die Grundlagen verteilter Task-Verarbeitung verstehen möchten
- Alle, die an praktischen Beispielen für verteilte Systemarchitekturen interessiert sind

## Systemarchitektur

Das System besteht aus mehreren Hauptkomponenten, die zusammenarbeiten, um die verteilte Task-Verarbeitung zu ermöglichen.

### Hauptkomponenten

#### Task-Manager

Der Task-Manager ist die zentrale Komponente des Systems und übernimmt folgende Aufgaben:
- Entgegennahme und Erstellung neuer Tasks
- Verteilung von Tasks an Worker-Knoten
- Überwachung des Task-Status und der Worker-Verfügbarkeit
- Koordination von Task-Migrationen und Wiederherstellungen
- Bereitstellung einer REST-API für externe Interaktionen

#### Worker-Knoten

Worker-Knoten sind die Ausführungseinheiten für Tasks:
- Führen die eigentlichen Berechnungen oder Operationen aus
- Melden Fortschritt und Status an den Task-Manager
- Erstellen regelmäßige Checkpoints des Task-Zustands
- Können ausfallen oder überlastet werden (simuliert)
- Unterstützen die Migration laufender Tasks

#### Message Broker (RabbitMQ)

RabbitMQ dient als Kommunikationsebene zwischen den Komponenten:
- Ermöglicht asynchrone Kommunikation zwischen Task-Manager und Workern
- Unterstützt verschiedene Nachrichtentypen (Task-Erstellung, Status-Updates, etc.)
- Sorgt für robuste Nachrichtenzustellung auch bei vorübergehenden Ausfällen
- Bietet Warteschlangen für die verschiedenen Nachrichtentypen

#### Status-Store (Redis)

Redis speichert den aktuellen Zustand des Systems:
- Persistente Speicherung aller Task-Informationen
- Speicherung von Checkpoints für Wiederherstellung
- Ermöglicht schnellen Zugriff auf den aktuellen Systemzustand
- Dient als gemeinsamer Datenspeicher für alle Komponenten

#### Frontend-Visualisierung

Das Frontend bietet eine interaktive Visualisierung des Systems:
- Echtzeit-Darstellung von Tasks, Workern und ihren Beziehungen
- Anzeige von Task-Details, Status und Fortschritt
- Ermöglicht manuelle Task-Erstellung und Migration
- Visualisierung von Ereignissen wie Ausfällen und Migrationen

### Kommunikationsfluss

Der Informationsfluss zwischen den Komponenten erfolgt in mehreren Schritten:

1. Task-Erstellung:
   - Ein Task wird über die API erstellt oder im Frontend angelegt
   - Der Task-Manager speichert den Task in Redis
   - Eine Task-Erstellungsnachricht wird über RabbitMQ gesendet

2. Task-Zuweisung:
   - Ein verfügbarer Worker empfängt die Task-Erstellungsnachricht
   - Der Worker fordert den Task-Zustand aus Redis an
   - Der Worker aktualisiert den Task-Status auf "RUNNING"

3. Task-Ausführung:
   - Der Worker führt den Task aus und meldet regelmäßig Fortschritte
   - Checkpoints werden in regelmäßigen Abständen in Redis gespeichert
   - Status-Updates werden über RabbitMQ an den Task-Manager gesendet

4. Task-Abschluss:
   - Nach Abschluss aktualisiert der Worker den Task-Status
   - Eine Abschlussnachricht wird über RabbitMQ gesendet
   - Der Task-Manager aktualisiert den Gesamtstatus des Systems

### Architekturdiagramm

```
+----------------+                +-------------------+
|                |<-- REST API -->|                   |
|    Frontend    |                |    Task-Manager   |
|                |<-- WebSocket --|                   |
+----------------+                +-------------------+
                                  | ^     | ^     | ^
                                  | |     | |     | |
              +-------------------+ |     | |     | +----------------+
              |                     |     | |     |                  |
              v                     v     v |     v                  v
        +------------+          +------------------+          +-------------+
        |            |          |                  |          |             |
        |   Redis    |<-------->|     RabbitMQ     |<-------->| Worker Node |
        |            |          |                  |          |             |
        +------------+          +------------------+          +-------------+
```

## Installation und Einrichtung

### Voraussetzungen

Um das Distributed Task Demo System zu verwenden, benötigen Sie:

- Docker und Docker Compose
- Git
- Einen Webbrowser (Chrome, Firefox, Safari, Edge)

### Herunterladen des Projekts

1. Klonen Sie das Repository:
   ```bash
   git clone https://github.com/scimbe/distributed-task-demo-system.git
   cd distributed-task-demo-system
   ```

2. Stellen Sie sicher, dass die Ausführungsrechte für das Demo-Skript gesetzt sind:
   ```bash
   chmod +x demo.sh
   ```

### Starten des Systems

Verwenden Sie das Demo-Skript, um das System zu starten:

```bash
./demo.sh start
```

Dieses Kommando startet alle benötigten Container:
- Task-Manager
- Drei Worker-Knoten
- RabbitMQ
- Redis
- Frontend

Nach dem erfolgreichen Start können Sie auf die folgenden Dienste zugreifen:
- Frontend: http://localhost:3000
- Task-Manager API: http://localhost:8080
- RabbitMQ Management: http://localhost:15672 (Zugangsdaten: guest/guest)

### Stoppen und Bereinigen

Um das System zu stoppen:

```bash
./demo.sh stop
```

Um das System vollständig zu bereinigen (alle Daten werden gelöscht):

```bash
./demo.sh clean
```

## Nutzung des Systems

### Demo-Skript

Das Demo-Skript `demo.sh` ist das Hauptwerkzeug zur Interaktion mit dem System. Es bietet verschiedene Befehle für unterschiedliche Aktionen:

- `./demo.sh start` - Startet das System
- `./demo.sh stop` - Stoppt das System
- `./demo.sh restart` - Neustart des Systems
- `./demo.sh logs [dienst]` - Zeigt Logs (optional für einen bestimmten Dienst)
- `./demo.sh create-task` - Erstellt einen Demo-Task
- `./demo.sh fail-worker N` - Simuliert Ausfall von Worker N (1-3)
- `./demo.sh recover-worker N` - Stellt Worker N (1-3) wieder her
- `./demo.sh status` - Zeigt Status aller Dienste
- `./demo.sh demo-scenario` - Führt ein vollständiges Demo-Szenario aus
- `./demo.sh clean` - Löscht alle Daten und Container

### Erstellen eines Tasks

Sie können einen Task auf zwei Arten erstellen:

1. Über das Demo-Skript:
   ```bash
   ./demo.sh create-task
   ```

2. Über die Web-Oberfläche:
   - Öffnen Sie http://localhost:3000
   - Nutzen Sie das Formular "Neuen Task erstellen" im rechten Bereich
   - Geben Sie die Task-Parameter ein und klicken Sie auf "Task erstellen"

3. Über direkte API-Anfrage:
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{
     "type": "computation",
     "priority": 5,
     "data": {
       "operation": "complex-calculation",
       "input": [1, 2, 3, 4, 5],
       "iterations": 100
     }
   }' http://localhost:8080/api/tasks
   ```

### Simulieren von Worker-Ausfällen

Um das Verhalten des Systems bei Ausfällen zu testen:

```bash
# Simuliere Ausfall von Worker 1
./demo.sh fail-worker 1

# Stelle Worker 1 wieder her
./demo.sh recover-worker 1
```

Diese Befehle stoppen bzw. starten den entsprechenden Worker-Container, was einen Knotenausfall in einem realen verteilten System simuliert.

### Ausführen eines vollständigen Demo-Szenarios

Das System bietet ein vordefiniertes Demo-Szenario:

```bash
./demo.sh demo-scenario
```

Dieses Szenario führt folgende Schritte aus:
1. Erstellt fünf Tasks mit unterschiedlichen Prioritäten
2. Wartet, während die Tasks verarbeitet werden
3. Simuliert den Ausfall eines Workers
4. Wartet, um die automatische Migration zu beobachten
5. Stellt den ausgefallenen Worker wieder her

Beobachten Sie die Visualisierung im Frontend, um zu sehen, wie die Tasks reagieren.

## Frontend und Visualisierung

### Hauptkomponenten des Frontends

Das Frontend besteht aus mehreren Teilen:

1. **System-Visualisierung**: Eine grafische Darstellung des Task-Managers, der Worker und der Tasks
2. **Task-Liste**: Tabelle aller Tasks mit wichtigen Informationen
3. **Worker-Grid**: Übersicht aller Worker-Knoten und ihrer aktuellen Zustände
4. **System-Ereignisse**: Chronologische Liste von Ereignissen im System
5. **Task-Details**: Detaillierte Ansicht eines ausgewählten Tasks
6. **Task-Erstellung**: Formular zum Erstellen neuer Tasks

### Interaktion mit der Visualisierung

- **Tasks auswählen**: Klicken Sie auf einen Task in der Visualisierung oder in der Task-Liste
- **Task-Details anzeigen**: Nach Auswahl eines Tasks werden die Details unten angezeigt
- **Task migrieren**: Klicken Sie auf "Task migrieren" bei einem aktiven Worker
- **Legende**: Die Farbcodierung der verschiedenen Status wird in der Visualisierung erklärt

### Echtzeit-Updates

Das Frontend erhält Echtzeit-Updates über WebSockets:
- Task-Status-Änderungen
- Worker-Status-Updates
- Migrations-Ereignisse
- Checkpoint-Erstellung

Alle Änderungen werden sofort in der Visualisierung und in den Listen dargestellt.

## Task-Lebenszyklus

Ein Task durchläuft im System verschiedene Zustände:

### Task-Status

1. **CREATED**: Der Task wurde erstellt, aber noch keinem Worker zugewiesen
2. **ASSIGNED**: Der Task wurde einem Worker zugewiesen, aber die Ausführung hat noch nicht begonnen
3. **RUNNING**: Der Task wird aktuell von einem Worker ausgeführt
4. **COMPLETED**: Der Task wurde erfolgreich abgeschlossen
5. **FAILED**: Bei der Ausführung des Tasks ist ein Fehler aufgetreten
6. **MIGRATING**: Der Task wird von einem Worker zu einem anderen migriert
7. **RECOVERING**: Der Task wird nach einem Worker-Ausfall wiederhergestellt

### Fortschritt und Checkpoints

Während der Ausführung eines Tasks werden regelmäßig Fortschritte und Checkpoints erstellt:

- **Fortschritt**: Ein Prozentwert (0-100), der den Ausführungsstand angibt
- **Checkpoints**: Zwischenspeicherungen des Task-Zustands, die für Wiederherstellungen verwendet werden

### Task-Daten

Jeder Task hat mehrere Datenkomponenten:

- **ID**: Eindeutige Kennung des Tasks
- **Typ**: Art des Tasks (z.B. "computation", "io", "network")
- **Priorität**: Numerischer Wert für die Wichtigkeit des Tasks
- **Daten**: Task-spezifische Parameter und Eingaben
- **Fortschritt**: Aktueller Ausführungsstand in Prozent
- **Worker-ID**: Kennung des zugewiesenen Workers
- **Checkpoint-Daten**: Gespeicherter Zustand für Wiederherstellungen

## Fehlertoleranz und Wiederherstellung

Das System implementiert mehrere Mechanismen für Fehlertoleranz:

### Erkennung von Ausfällen

Worker senden regelmäßig Status-Updates. Wenn ein Worker für einen bestimmten Zeitraum keine Updates sendet, wird er als ausgefallen betrachtet. Dies kann durch Folgendes ausgelöst werden:

- Manuelles Stoppen des Worker-Containers durch den Benutzer
- Simulierte Fehler innerhalb des Workers (zufällig oder konfiguriert)
- Netzwerkprobleme zwischen den Komponenten

### Wiederherstellung von Tasks

Wenn ein Worker ausfällt, werden seine Tasks wie folgt wiederhergestellt:

1. Der Task-Manager erkennt den Ausfall des Workers
2. Für jeden betroffenen Task wird der letzte Checkpoint aus Redis geladen
3. Die Tasks werden in den Status "RECOVERING" versetzt
4. Verfügbare Worker werden für die Wiederaufnahme der Tasks ausgewählt
5. Die Tasks werden mit den Checkpoint-Daten neu gestartet

### Checkpoint-Mechanismus

Checkpoints sind entscheidend für die Fehlertoleranz:

- Worker erstellen in regelmäßigen Abständen Checkpoints (standardmäßig alle 5 Sekunden)
- Ein Checkpoint enthält alle notwendigen Informationen zur Wiederaufnahme des Tasks
- Checkpoints werden in Redis gespeichert und sind für alle Komponenten zugänglich
- Bei der Wiederherstellung wird der letzte verfügbare Checkpoint verwendet

## Task-Migration

Migration ermöglicht die Verschiebung von Tasks zwischen Workern.

### Gründe für Migration

Tasks können aus verschiedenen Gründen migriert werden:

- **Lastausgleich**: Wenn ein Worker überlastet ist, können Tasks zu weniger ausgelasteten Workern verschoben werden
- **Präventive Migration**: Wenn ein Worker Anzeichen von Problemen zeigt, können Tasks vorsorglich migriert werden
- **Manuelle Migration**: Benutzer können Migrationen über das Frontend auslösen
- **Optimierung**: Tasks können zu besser geeigneten Workern migriert werden (z.B. basierend auf Ressourcen)

### Migrationsprozess

Der Migrationsprozess umfasst folgende Schritte:

1. Die Migration wird eingeleitet (manuell oder automatisch)
2. Der aktuelle Worker erstellt einen finalen Checkpoint des Task-Zustands
3. Der Task wird in den Status "MIGRATING" versetzt
4. Der Ziel-Worker wird ausgewählt (oder vom Benutzer angegeben)
5. Der Ziel-Worker lädt den Checkpoint aus Redis
6. Der Task wird auf dem Ziel-Worker fortgesetzt
7. Der Status wird auf "RUNNING" aktualisiert

### Migration im Frontend auslösen

Um eine manuelle Migration auszulösen:

1. Suchen Sie den Worker mit dem zu migrierenden Task im Worker-Grid
2. Klicken Sie auf den Button "Task migrieren"
3. Wählen Sie den zu migrierenden Task aus
4. Wählen Sie den Ziel-Worker aus
5. Bestätigen Sie die Migration

Die Migration wird dann durchgeführt und in der Visualisierung dargestellt.

## Demo-Szenarien

Das System bietet vordefinierte Demo-Szenarien, um verschiedene Aspekte verteilter Systeme zu veranschaulichen.

### Grundlegendes Demo-Szenario

```bash
./demo.sh demo-scenario
```

Dieses Szenario demonstriert:
- Task-Erstellung und -Verteilung
- Normale Task-Ausführung
- Worker-Ausfall und Wiederherstellung
- Automatische Task-Migration

### Erweitertes Demo: Lastbalancierung

Führen Sie folgende Befehle aus, um Lastbalancierung zu demonstrieren:

```bash
# Erstellen Sie mehrere Tasks mit unterschiedlicher Priorität
for i in {1..10}; do 
  PRIO=$((i % 5 + 1))
  ./demo.sh create-task $PRIO
  sleep 2
done

# Simulieren Sie Überlastung von Worker 2
curl -X POST http://localhost:8080/api/workers/worker-2/overload

# Beobachten Sie die automatische Migration von Tasks
```

### Erweitertes Demo: Kaskadierender Ausfall

```bash
# Starten Sie ein normales Szenario
./demo.sh demo-scenario

# Warten Sie, bis Tasks verteilt sind
sleep 20

# Simulieren Sie kaskadierenden Ausfall
./demo.sh fail-worker 1
sleep 10
./demo.sh fail-worker 2
sleep 15

# Beobachten Sie, wie alle Tasks auf Worker 3 landen
# Stellen Sie die Worker wieder her
./demo.sh recover-worker 1
./demo.sh recover-worker 2
```

## API-Referenz

Das System bietet eine REST-API für die Interaktion mit dem Task-Manager.

### Task-Verwaltung

#### Task erstellen

```
POST /api/tasks
```

Beispielanfrage:
```json
{
  "type": "computation",
  "priority": 5,
  "data": {
    "operation": "complex-calculation",
    "input": [1, 2, 3, 4, 5],
    "iterations": 100
  }
}
```

Beispielantwort:
```json
{
  "id": "f7e6d5c4-b3a2-1098-7654-321012345678",
  "type": "computation",
  "status": "CREATED",
  "priority": 5,
  "data": {
    "operation": "complex-calculation",
    "input": [1, 2, 3, 4, 5],
    "iterations": 100
  },
  "progress": 0,
  "created_at": "2025-03-14T08:15:00Z",
  "updated_at": "2025-03-14T08:15:00Z"
}
```

#### Alle Tasks abrufen

```
GET /api/tasks
```

#### Einzelnen Task abrufen

```
GET /api/tasks/{task_id}
```

#### Task-Migration auslösen

```
POST /api/tasks/{task_id}/migrate
```

Beispielanfrage:
```json
{
  "worker_id": "worker-2"
}
```

### Worker-Verwaltung

#### Alle Worker abrufen

```
GET /api/workers
```

#### Worker-Status abrufen

```
GET /api/workers/{worker_id}
```

#### Worker-Überlastung simulieren

```
POST /api/workers/{worker_id}/overload
```

#### Worker-Ausfall simulieren

```
POST /api/workers/{worker_id}/fail
```

### System-Informationen

#### System-Status abrufen

```
GET /api/system/status
```

#### Systemereignisse abrufen

```
GET /api/system/events
```

## Erweiterung des Systems

Das System kann erweitert und angepasst werden, um zusätzliche Funktionen zu demonstrieren.

### Hinzufügen neuer Task-Typen

Um einen neuen Task-Typ hinzuzufügen:

1. Erweitern Sie die `processTask`-Methode im Worker-Code:
   ```go
   // worker-node/main.go
   func (w *Worker) processTask(task *Task) {
       // ...
       
       // Je nach Task-Typ unterschiedliche Verarbeitung
       switch task.Type {
       case "computation":
           // Bestehende Implementierung
       case "io":
           // IO-intensive Verarbeitung implementieren
       case "new-task-type":
           // Neue Implementierung hier
       default:
           // Standardverarbeitung
       }
       
       // ...
   }
   ```

2. Aktualisieren Sie das Frontend, um den neuen Task-Typ zu unterstützen:
   ```jsx
   // frontend/src/components/TaskDetail.js
   const getTaskTypeDetails = (type) => {
     switch (type) {
       case 'computation':
         return 'Rechenintensiver Task';
       case 'io':
         return 'I/O-intensiver Task';
       case 'new-task-type':
         return 'Beschreibung des neuen Task-Typs';
       default:
         return 'Unbekannter Task-Typ';
     }
   };
   ```

### Implementierung zusätzlicher Fehlerszenarien

Neue Fehlerszenarien können hinzugefügt werden:

1. Implementieren Sie eine neue Methode im Worker:
   ```go
   // worker-node/main.go
   func (w *Worker) simulateNetworkPartition() {
       // Implementierung einer Netzwerkpartition
       w.mutex.Lock()
       w.Status = WorkerFailing
       w.mutex.Unlock()
       
       // Aufhören, Status-Updates zu senden, aber Tasks weiter verarbeiten
       // ...
   }
   ```

2. Fügen Sie einen neuen API-Endpunkt hinzu:
   ```go
   // task-manager/main.go
   r.HandleFunc("/api/workers/{id}/network-partition", func(w http.ResponseWriter, r *http.Request) {
       // Handler-Implementierung
   }).Methods("POST")
   ```

3. Erweitern Sie das Demo-Skript:
   ```bash
   network-partition-worker)
       echo -e "${RED}Simuliere Netzwerkpartition für Worker...${NC}"
       # Implementierung
       ;;
   ```

### Visualisierungserweiterungen

Das Frontend kann erweitert werden:

1. Fügen Sie neue Visualisierungsansichten hinzu:
   ```jsx
   // frontend/src/components/NetworkGraph.js
   // Implementierung einer alternativen Netzwerk-Graph-Visualisierung
   ```

2. Implementieren Sie Zeitreihen-Diagramme für die Performance:
   ```jsx
   // frontend/src/components/PerformanceCharts.js
   // Implementierung von Performance-Diagrammen
   ```

## Fehlerbehebung

### Häufige Probleme und Lösungen

#### System startet nicht korrekt

Problem: Nicht alle Container starten oder einige Dienste sind nicht erreichbar.

Lösungen:
- Prüfen Sie, ob Docker und Docker Compose korrekt installiert sind:
  ```bash
  docker --version
  docker-compose --version
  ```
- Überprüfen Sie die Container-Logs:
  ```bash
  ./demo.sh logs
  ```
- Stellen Sie sicher, dass die erforderlichen Ports nicht bereits verwendet werden:
  ```bash
  sudo lsof -i :8080
  sudo lsof -i :3000
  sudo lsof -i :5672
  sudo lsof -i :6379
  ```
- Starten Sie das System neu:
  ```bash
  ./demo.sh clean
  ./demo.sh start
  ```

#### Frontend zeigt keine Daten an

Problem: Die Web-Oberfläche wird geladen, zeigt aber keine Tasks oder Worker an.

Lösungen:
- Überprüfen Sie, ob der Task-Manager läuft:
  ```bash
  docker-compose ps task-manager
  ```
- Prüfen Sie die WebSocket-Verbindung in den Browser-Entwicklertools (Network-Tab)
- Überprüfen Sie die Logs des Task-Managers:
  ```bash
  ./demo.sh logs task-manager
  ```
- Prüfen Sie, ob der API-Endpunkt erreichbar ist:
  ```bash
  curl http://localhost:8080/api/system/status
  ```

#### Tasks bleiben im Status "CREATED"

Problem: Erstellte Tasks werden nicht von Workern abgeholt.

Lösungen:
- Überprüfen Sie, ob Worker-Knoten aktiv sind:
  ```bash
  docker-compose ps | grep worker
  ```
- Prüfen Sie die RabbitMQ-Warteschlange:
  ```bash
  # Öffnen Sie http://localhost:15672 und melden Sie sich an (guest/guest)
  # Überprüfen Sie die Warteschlange "task_created"
  ```
- Überprüfen Sie die Worker-Logs:
  ```bash
  ./demo.sh logs worker-node-1
  ```

### Debug-Modus aktivieren

Für erweiterte Fehlersuche:

```bash
# Task-Manager mit Debug-Logging starten
docker-compose stop task-manager
docker-compose run -e DEBUG=true task-manager

# Worker mit Debug-Logging starten
docker-compose stop worker-node-1
docker-compose run -e DEBUG=true worker-node-1
```

## Glossar

- **Task**: Eine Arbeitseinheit, die von einem Worker ausgeführt wird
- **Worker**: Ein Knoten, der Tasks ausführt
- **Task-Manager**: Zentrale Komponente zur Verwaltung von Tasks
- **Checkpoint**: Zwischenspeicherung des Task-Zustands
- **Migration**: Verschiebung eines Tasks von einem Worker zu einem anderen
- **Wiederherstellung**: Neustart eines Tasks nach einem Ausfall
- **Message Broker**: Komponente für den asynchronen Nachrichtenaustausch (RabbitMQ)
- **Status-Store**: Persistenter Speicher für Task-Zustände (Redis)
