# Distributed Task Demo System

Diese Anwendung demonstriert die Kernkonzepte von Tasks in verteilten Systemen. Sie zeigt, wie Tasks erstellt, verteilt, ausgeführt, migriert und wiederhergestellt werden können.

## Hauptfunktionen

- **Task-Verteilung**: Zeigt, wie Tasks auf verschiedene Worker-Knoten verteilt werden
- **Task-Migration**: Demonstriert, wie laufende Tasks von einem Knoten zu einem anderen migriert werden können
- **Fehlertoleranz**: Implementiert Mechanismen zur Wiederherstellung von Tasks nach Ausfällen
- **Zustandsspeicherung**: Zeigt, wie der Zustand von Tasks gespeichert und wiederhergestellt wird
- **Visualisierung**: Bietet eine interaktive Benutzeroberfläche zur Visualisierung des Task-Lebenszyklus

## Architektur

Das System besteht aus den folgenden Komponenten:

1. **Task-Manager**: Zentrale Komponente für die Verwaltung des Task-Lebenszyklus
2. **Worker-Knoten**: Führen die eigentlichen Tasks aus
3. **Message Broker**: Ermöglicht die Kommunikation zwischen den Komponenten
4. **Status-Store**: Speichert den Zustand der Tasks für Wiederherstellung und Migration
5. **Visualisierungskomponente**: Web-basierte Oberfläche zur Darstellung der Prozesse

## Technologien

- Go für Backend-Komponenten (Task-Manager, Worker-Knoten)
- RabbitMQ als Message Broker für die Kommunikation
- Redis für Status-Speicherung
- React für die Visualisierungskomponente
- Docker und Docker Compose für einfaches Deployment

## Erste Schritte

1. Klonen Sie das Repository
2. Installieren Sie Docker und Docker Compose
3. Führen Sie `docker-compose up` aus
4. Öffnen Sie die Webanwendung unter `http://localhost:3000`

## Lernziele

Diese Demo veranschaulicht:

- Wie Tasks in verteilten Systemen verwaltet werden
- Wie Fehlertoleranz und Wiederherstellung implementiert werden können
- Wie der Zustand zwischen verschiedenen Knoten migriert werden kann
- Wie die Kommunikation zwischen verteilten Komponenten funktioniert
