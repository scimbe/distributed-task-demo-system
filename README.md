# Distributed Task Demo System

Diese Anwendung demonstriert die Kernkonzepte von Tasks in verteilten Systemen mit einem Mobile-First-Designansatz. Sie zeigt, wie Tasks erstellt, verteilt, ausgeführt, migriert und wiederhergestellt werden können.

## Hauptfunktionen

- **Task-Verteilung**: Zeigt, wie Tasks auf verschiedene Worker-Knoten verteilt werden
- **Task-Migration**: Demonstriert, wie laufende Tasks von einem Knoten zu einem anderen migriert werden können
- **Fehlertoleranz**: Implementiert Mechanismen zur Wiederherstellung von Tasks nach Ausfällen
- **Zustandsspeicherung**: Zeigt, wie der Zustand von Tasks gespeichert und wiederhergestellt wird
- **Interaktive Visualisierung**: Bietet mehrere Ansichten zur Visualisierung des Task-Lebenszyklus
- **Experimentierzentrum**: Ermöglicht vordefinierte Szenarien zum Testen verschiedener Aspekte

## Neu: Mobile-First Design

Die Anwendung wurde komplett überarbeitet und folgt nun einem Mobile-First-Designansatz:

- **Responsive Oberfläche**: Optimiert für alle Geräte von Smartphones bis Desktop-PCs
- **Interaktive Komponenten**: Benutzerfreundliche Steuerungselemente mit visueller Rückmeldung
- **Gamifizierte Elemente**: Spielerische Interaktionen zum Entdecken und Experimentieren
- **Visuelle Klarheit**: Einfach verständliche Darstellung komplexer Konzepte
- **Zugänglichkeit**: Designt für alle Lerntypen und Benutzer

## Hauptkomponenten

### 1. Task Control Center
Zentrales Dashboard mit Echtzeit-Visualisierung und interaktiven Steuerungselementen.

### 2. Worker-Roboter Werkstatt
Visuelle Darstellung der Worker als interaktive Roboter mit Animations- und Statusanzeigen.

### 3. Task Journey Timeline
Interaktive Zeitleiste zum Verfolgen des Task-Lebenszyklus mit detaillierten Erklärungen.

### 4. Experimentierzentrum
Vordefinierte Szenarien zum Testen verschiedener Aspekte verteilter Systeme mit schrittweiser Komplexität.

## Architektur

Das System besteht aus den folgenden Komponenten:

1. **Task-Manager**: Zentrale Komponente für die Verwaltung des Task-Lebenszyklus
2. **Worker-Knoten**: Führen die eigentlichen Tasks aus
3. **Message Broker**: Ermöglicht die Kommunikation zwischen den Komponenten
4. **Status-Store**: Speichert den Zustand der Tasks für Wiederherstellung und Migration
5. **Visualisierungskomponente**: Web-basierte Oberfläche zur interaktiven Darstellung der Prozesse

## Technologien

- Go für Backend-Komponenten (Task-Manager, Worker-Knoten)
- RabbitMQ als Message Broker für die Kommunikation
- Redis für Status-Speicherung
- React und Bootstrap für die responsive Frontend-Komponenten
- D3.js für interaktive Visualisierungen
- Docker und Docker Compose für einfaches Deployment

## Erste Schritte

1. Klonen Sie das Repository
2. Installieren Sie Docker und Docker Compose
3. Führen Sie `docker-compose up` aus
4. Öffnen Sie die Webanwendung unter `http://localhost:3000`

Alternativ können Sie das Demo-Script nutzen:

```bash
./demo.sh start
```

## Demo-Skript Optionen

- `./demo.sh start` - Startet das System
- `./demo.sh stop` - Stoppt das System
- `./demo.sh restart` - Neustart des Systems
- `./demo.sh logs [dienst]` - Zeigt Logs an
- `./demo.sh create-task` - Erstellt einen Demo-Task
- `./demo.sh fail-worker N` - Simuliert Ausfall von Worker N (1-3)
- `./demo.sh recover-worker N` - Stellt Worker N (1-3) wieder her
- `./demo.sh status` - Zeigt Status aller Dienste
- `./demo.sh demo-scenario` - Führt ein vollständiges Demo-Szenario aus
- `./demo.sh clean` - Löscht alle Daten und Container

## Lernziele

Diese Demo veranschaulicht:

- Wie Tasks in verteilten Systemen verwaltet werden
- Wie Fehlertoleranz und Wiederherstellung implementiert werden können
- Wie der Zustand zwischen verschiedenen Knoten migriert werden kann
- Wie die Kommunikation zwischen verteilten Komponenten funktioniert
- Wie interaktive Visualisierungen komplexe Konzepte verständlich darstellen

## UI-Komponenten im Detail

### Navigation
- **Dashboard**: Hauptübersicht mit allen Systemelementen
- **Worker-Werkstatt**: Detailansicht der Worker mit Animation und interaktiven Elementen
- **Task-Timeline**: Zeitleiste für den Task-Lebenszyklus
- **Experimente**: Vordefinierte Szenarien zum Testen

### Interaktives Design
- **Gamifizierte Elemente**: Animierte Roboter-Worker mit unterschiedlichem Verhalten
- **Visuelle Hinweise**: Farbcodierte Status und Übergänge
- **Progress-Anzeigen**: Fortschrittsbalken und Statusanzeigen
- **Interaktive Zeitlinien**: Nachverfolgung des Task-Fortschritts

## Ausführliche Dokumentation

Weitere Informationen finden Sie in der [ausführlichen Dokumentation](./docs/DOCUMENTATION.md) und im [Tutorial](./docs/TUTORIAL.md).
