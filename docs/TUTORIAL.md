# Tutorial: Verteilte Systeme und Task-Verarbeitung

## Einführung

Willkommen zu diesem Tutorial über verteilte Systeme! In diesem Kurs werden wir das "Distributed Task Demo System" nutzen, um die grundlegenden Konzepte verteilter Systeme anhand praktischer Beispiele zu verstehen.

Dieses Tutorial richtet sich an Studierende, die die Theorie verteilter Systeme anhand einer praktischen Demonstration nachvollziehen möchten. Wir werden Schritt für Schritt die verschiedenen Aspekte von Tasks in verteilten Systemen erkunden und dabei wichtige Konzepte wie Fehlertoleranz, Migration und Zustandsverwaltung kennenlernen.

## Lernziele

Nach Abschluss dieses Tutorials solltest du:

1. Die grundlegenden Komponenten eines verteilten Task-Systems verstehen
2. Den Lebenszyklus eines Tasks in einem verteilten System nachvollziehen können
3. Verschiedene Fehlerszenarien und deren Auswirkungen beobachtet haben
4. Die Konzepte der Task-Migration und -Wiederherstellung verstanden haben
5. Die Kommunikationsmuster zwischen verteilten Komponenten erkennen können

## Vorbereitung

Bevor wir beginnen, stelle sicher, dass du die folgenden Voraussetzungen erfüllt hast:

1. Installation von Docker und Docker Compose auf deinem System
2. Herunterladen des Projekt-Repositories:
   ```bash
   git clone https://github.com/scimbe/distributed-task-demo-system.git
   cd distributed-task-demo-system
   ```
3. Ausführungsrechte für das Demo-Skript:
   ```bash
   chmod +x demo.sh
   ```

## Teil 1: Das System starten und kennenlernen

### Schritt 1: System starten

Führe den folgenden Befehl aus, um das System zu starten:

```bash
./demo.sh start
```

Warte, bis alle Container gestartet sind. Wenn alles erfolgreich ist, solltest du eine Ausgabe ähnlich der folgenden sehen:

```
Distributed Task Demo System
=============================

Starte das gesamte System...

Creating network "distributed-task-demo-system_default" with the default driver
Creating distributed-task-demo-system_redis_1 ... done
Creating distributed-task-demo-system_rabbitmq_1 ... done
Creating distributed-task-demo-system_task-manager_1 ... done
Creating distributed-task-demo-system_worker-node-1_1 ... done
Creating distributed-task-demo-system_worker-node-2_1 ... done
Creating distributed-task-demo-system_worker-node-3_1 ... done
Creating distributed-task-demo-system_frontend_1 ... done

System gestartet. Öffne http://localhost:3000 im Browser.

Dienste:
- Frontend: http://localhost:3000
- Task Manager API: http://localhost:8080
- RabbitMQ Management: http://localhost:15672 (guest/guest)
- Redis Commander: http://localhost:8081
```

### Schritt 2: Frontend öffnen

Öffne deinen Browser und navigiere zu:
```
http://localhost:3000
```

Du solltest nun die Web-Oberfläche des Systems sehen. Hier sind die Hauptbereiche der Benutzeroberfläche:

1. **System-Visualisierung**: Zeigt den Task-Manager, die Worker und die Tasks in einer grafischen Darstellung
2. **Task-Erstellung**: Formular zum Erstellen neuer Tasks
3. **Task-Liste**: Tabelle mit allen Tasks im System
4. **Worker-Grid**: Übersicht über die Worker-Knoten und deren Status
5. **System-Ereignisse**: Chronologische Liste von Ereignissen im System
6. **Task-Details**: Detaillierte Informationen zu einem ausgewählten Task

Nimm dir einen Moment Zeit, um die verschiedenen Bereiche des Frontends zu erkunden.

### Schritt 3: Systemarchitektur verstehen

Bevor wir mit praktischen Übungen beginnen, lass uns die Architektur des Systems verstehen:

- **Task-Manager**: Zentrale Komponente, die Tasks erstellt, verwaltet und verteilt
- **Worker-Knoten**: Führen die eigentlichen Tasks aus
- **RabbitMQ**: Message Broker für die Kommunikation zwischen den Komponenten
- **Redis**: Speichert den Zustand der Tasks und Checkpoints
- **Frontend**: Visualisiert das System und ermöglicht Interaktionen

Die Komponenten kommunizieren asynchron über Nachrichten, die über RabbitMQ ausgetauscht werden. Der Zustand aller Tasks wird in Redis gespeichert, um Persistenz und Wiederherstellung zu ermöglichen.

## Teil 2: Den Task-Lebenszyklus verstehen

### Schritt 1: Einen einfachen Task erstellen

Lass uns unseren ersten Task erstellen:

1. Gehe zum Formular "Neuen Task erstellen" im Frontend
2. Wähle den Task-Typ "Berechnung"
3. Setze die Priorität auf 5
4. Gib folgende Daten im JSON-Format ein:
   ```json
   {
     "operation": "addition",
     "values": [10, 20, 30, 40, 50]
   }
   ```
5. Klicke auf "Task erstellen"

Beobachte nun, wie der Task im System erscheint:
- In der Visualisierung wird der Task zunächst beim Task-Manager angezeigt
- Nach kurzer Zeit wird der Task einem Worker zugewiesen
- Der Status des Tasks ändert sich von "CREATED" zu "ASSIGNED" und dann zu "RUNNING"
- Der Fortschrittsbalken des Tasks füllt sich langsam
- Schließlich wird der Task als "COMPLETED" markiert

### Schritt 2: Task-Status und Übergänge

Erstelle weitere Tasks mit unterschiedlichen Prioritäten (1-10) und beobachte, wie sie verarbeitet werden:

```bash
./demo.sh create-task
```

Dieser Befehl erstellt einen vordefinierten Task. Führe ihn mehrmals aus.

**Aufgabe**: Erstelle eine Zeichnung oder ein Diagramm, das die verschiedenen Status-Übergänge eines Tasks darstellt. Achte besonders darauf, wann und warum ein Task von einem Status zum anderen wechselt.

**Hinweis**: Beobachte die "System-Ereignisse"-Liste im Frontend, um die chronologische Abfolge der Status-Änderungen zu sehen.

## Teil 3: Fehlertoleranz und Wiederherstellung

### Schritt 1: Worker-Ausfall simulieren

Nachdem du einige Tasks erstellt hast und einige davon sich in Bearbeitung befinden, simulieren wir den Ausfall eines Workers:

```bash
./demo.sh fail-worker 1
```

Dieser Befehl stoppt den Worker mit der ID 1. Beobachte, was mit den Tasks geschieht, die diesem Worker zugewiesen waren:

1. Der Task-Manager erkennt, dass der Worker nicht mehr antwortet
2. Die betroffenen Tasks werden in den Status "RECOVERING" versetzt
3. Die Tasks werden anderen verfügbaren Workern zugewiesen
4. Die Worker laden den letzten Checkpoint des Tasks aus Redis
5. Die Tasks werden ab dem letzten Checkpoint fortgesetzt

**Fragen zur Diskussion**:
- Welche Mechanismen ermöglichen die Wiederherstellung von Tasks?
- Warum ist ein Checkpoint-System wichtig für die Fehlertoleranz?
- Wie würde das System reagieren, wenn es keine Checkpoints gäbe?

### Schritt 2: Worker wiederherstellen

Jetzt stellen wir den ausgefallenen Worker wieder her:

```bash
./demo.sh recover-worker 1
```

Beobachte, wie der Worker wieder in den aktiven Zustand zurückkehrt und beginnt, neue Tasks zu akzeptieren.

**Experiment**: Erstelle mehrere Tasks, während ein Worker ausgefallen ist, und stelle dann den Worker wieder her. Wie verteilt das System die Last?

## Teil 4: Task-Migration

### Schritt 1: Manuelle Migration

Wir können Tasks manuell von einem Worker zu einem anderen migrieren:

1. Warte, bis ein Worker einen aktiven Task hat (Status: "BUSY")
2. Klicke auf den "Task migrieren"-Button des entsprechenden Workers im Worker-Grid
3. Wähle den zu migrierenden Task
4. Wähle einen Ziel-Worker für die Migration
5. Bestätige die Migration

Beobachte, wie der Task vom Quell-Worker zum Ziel-Worker migriert wird:
- Der Task wird in den Status "MIGRATING" versetzt
- Ein Checkpoint wird erstellt
- Der Task wird auf dem Ziel-Worker fortgesetzt
- Der Status wechselt zurück zu "RUNNING"

### Schritt 2: Automatische Migration bei Überlastung

Das System kann auch automatisch Tasks migrieren, wenn ein Worker überlastet ist:

```bash
# Erstelle mehrere Tasks
for i in {1..10}; do ./demo.sh create-task; done

# Simuliere Überlastung von Worker 2
curl -X POST http://localhost:8080/api/workers/worker-2/overload
```

Beobachte, wie das System reagiert:
- Der Worker wird als "OVERLOADED" markiert
- Tasks mit niedrigerer Priorität werden zu anderen Workern migriert
- Die Last wird auf die verbleibenden Worker verteilt

**Fragen zur Diskussion**:
- Was sind die Vor- und Nachteile der automatischen Task-Migration?
- Welche Strategien könnte das System nutzen, um zu entscheiden, welche Tasks migriert werden sollen?

## Teil 5: Demo-Szenario durchführen

Zum Abschluss führen wir ein komplettes Demo-Szenario durch, das verschiedene Aspekte des Systems demonstriert:

```bash
./demo.sh demo-scenario
```

Dieses Szenario führt folgende Schritte aus:
1. Erstellt fünf Tasks mit unterschiedlichen Prioritäten
2. Wartet, während die Tasks verarbeitet werden
3. Simuliert den Ausfall eines Workers
4. Wartet, um die automatische Migration zu beobachten
5. Stellt den ausgefallenen Worker wieder her

Beobachte die Visualisierung im Frontend und verfolge das Geschehen in der Ereignisliste.

## Teil 6: Praktische Übungen

### Übung 1: Kaskadierender Ausfall

Simuliere einen kaskadierenden Ausfall aller Worker und beobachte, wie das System reagiert:

```bash
# Erzeuge mehrere Tasks
for i in {1..15}; do ./demo.sh create-task; sleep 1; done

# Simuliere kaskadierenden Ausfall aller Worker
./demo.sh fail-worker 1
sleep 5
./demo.sh fail-worker 2
sleep 5
./demo.sh fail-worker 3
```

**Fragen zur Diskussion**:
- Was passiert mit den Tasks, wenn alle Worker ausgefallen sind?
- Wie verhält sich das System, wenn du nach und nach die Worker wiederherstellst?
- Welche Mechanismen könnten implementiert werden, um mit einem kompletten Systemausfall umzugehen?

### Übung 2: Kommunikationsmuster analysieren

Analysiere die Kommunikation zwischen den Komponenten:

1. Öffne das RabbitMQ Management Interface:
   ```
   http://localhost:15672
   ```
   (Anmeldedaten: guest/guest)

2. Erkunde die verschiedenen Warteschlangen und deren Nachrichtenfluss

3. Erstelle einen neuen Task und beobachte, welche Nachrichten in welchen Warteschlangen erscheinen

**Aufgabe**: Zeichne ein Sequenzdiagramm, das den Nachrichtenfluss von der Task-Erstellung bis zum Abschluss darstellt.

### Übung 3: Systemlimits testen

Teste die Grenzen des Systems:

```bash
# Erstelle 50 Tasks in schneller Folge
for i in {1..50}; do ./demo.sh create-task; done
```

**Fragen zur Diskussion**:
- Wie gut skaliert das System mit einer großen Anzahl von Tasks?
- Welche Engpässe kannst du identifizieren?
- Wie könnte das System optimiert werden, um mit hoher Last umzugehen?

## Teil 7: Theoretische Vertiefung

### Konzeptfragen

Basierend auf deinen Beobachtungen und Experimenten, beantworte die folgenden Fragen:

1. Welche Prinzipien verteilter Systeme werden in diesem Demo-System umgesetzt?
2. Wie trägt die Asynchronität zur Robustheit des Systems bei?
3. Welche Konsistenzgarantien bietet das System für den Task-Zustand?
4. Wie könnte das System um weitere Fehlertoleranz-Mechanismen erweitert werden?
5. Welche Alternativen zu RabbitMQ und Redis könnten für ähnliche Zwecke eingesetzt werden?

### Abschlussprojekt

Entwirf eine Erweiterung des Systems, die einen der folgenden Aspekte verbessert:

1. Lastbalancierung: Entwickle einen intelligenteren Algorithmus zur Verteilung von Tasks
2. Fehlertoleranz: Implementiere zusätzliche Mechanismen zur Erkennung und Behandlung von Fehlern
3. Visualisierung: Entwirf eine alternative Visualisierung, die bestimmte Aspekte des Systems besser darstellt
4. Monitoring: Konzipiere ein Monitoring-System, das Metriken über die System-Performance sammelt

Beschreibe deine Erweiterung in Form eines Entwurfsdokuments, das Folgendes enthält:
- Ziele und Anforderungen
- Architekturdiagramm
- Implementierungsdetails
- Erwartete Verbesserungen
- Testplan

## Fazit

In diesem Tutorial hast du das "Distributed Task Demo System" kennengelernt und verschiedene Aspekte verteilter Systeme praktisch erkundet. Du hast gesehen, wie Tasks in einem verteilten System verwaltet werden, wie das System mit Fehlern umgeht und wie die Kommunikation zwischen den Komponenten funktioniert.

Die Konzepte, die du hier kennengelernt hast, sind grundlegend für das Verständnis und die Entwicklung skalierbarer, robuster verteilter Systeme in der realen Welt. Viele moderne Anwendungen basieren auf ähnlichen Architekturprinzipien und Kommunikationsmustern.

## Weiterführende Literatur

- "Designing Data-Intensive Applications" von Martin Kleppmann
- "Distributed Systems: Principles and Paradigms" von Andrew S. Tanenbaum
- "Building Microservices" von Sam Newman
- "Site Reliability Engineering" von Niall Richard Murphy, Betsy Beyer, Chris Jones und Jennifer Petoff

## Ressourcen zum Projekt

- [GitHub Repository](https://github.com/scimbe/distributed-task-demo-system)
- [Ausführliche Dokumentation](./DOCUMENTATION.md)
- [API-Referenz](./API_REFERENCE.md)
