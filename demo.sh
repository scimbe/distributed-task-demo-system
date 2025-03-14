#!/bin/bash

# Farben für Ausgabe
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Distributed Task Demo System${NC}"
echo "============================="
echo

case "$1" in
  start)
    echo -e "${GREEN}Starte das gesamte System...${NC}"
    docker-compose up -d
    echo
    echo -e "System gestartet. Öffne ${YELLOW}http://localhost:3000${NC} im Browser."
    echo
    echo -e "Dienste:"
    echo -e "- Frontend: ${YELLOW}http://localhost:3000${NC}"
    echo -e "- Task Manager API: ${YELLOW}http://localhost:8080${NC}"
    echo -e "- RabbitMQ Management: ${YELLOW}http://localhost:15672${NC} (guest/guest)"
    echo -e "- Redis Commander: ${YELLOW}http://localhost:8081${NC}"
    ;;
    
  stop)
    echo -e "${YELLOW}Stoppe das System...${NC}"
    docker-compose down
    echo -e "${GREEN}System gestoppt.${NC}"
    ;;
    
  restart)
    echo -e "${YELLOW}Neustart des Systems...${NC}"
    docker-compose down
    docker-compose up -d
    echo -e "${GREEN}System neu gestartet.${NC}"
    ;;
    
  logs)
    echo -e "${BLUE}Zeige Logs an...${NC}"
    if [ -z "$2" ]; then
      docker-compose logs -f
    else
      docker-compose logs -f "$2"
    fi
    ;;
    
  create-task)
    echo -e "${BLUE}Erstelle einen neuen Task...${NC}"
    curl -X POST -H "Content-Type: application/json" -d '{
      "type": "computation",
      "priority": 5,
      "data": {
        "operation": "complex-calculation",
        "input": [1, 2, 3, 4, 5],
        "iterations": 100
      }
    }' http://localhost:8080/api/tasks
    echo
    ;;
    
  fail-worker)
    echo -e "${RED}Simuliere Ausfall eines Workers...${NC}"
    if [ -z "$2" ]; then
      echo "Bitte Worker-ID angeben (1, 2 oder 3)"
    else
      docker-compose stop worker-node-"$2"
      echo -e "${YELLOW}Worker $2 wurde gestoppt.${NC}"
    fi
    ;;
    
  recover-worker)
    echo -e "${GREEN}Worker wiederherstellen...${NC}"
    if [ -z "$2" ]; then
      echo "Bitte Worker-ID angeben (1, 2 oder 3)"
    else
      docker-compose start worker-node-"$2"
      echo -e "${GREEN}Worker $2 wurde wiederhergestellt.${NC}"
    fi
    ;;
    
  status)
    echo -e "${BLUE}System-Status:${NC}"
    docker-compose ps
    ;;
    
  demo-scenario)
    echo -e "${BLUE}Starte Demo-Szenario...${NC}"
    echo -e "${YELLOW}1. Erstelle fünf Tasks${NC}"
    for i in {1..5}; do
      echo -e "   Erstelle Task $i..."
      curl -s -X POST -H "Content-Type: application/json" -d '{
        "type": "computation",
        "priority": '"$i"',
        "data": {
          "operation": "complex-calculation",
          "input": [1, 2, 3, 4, 5],
          "iterations": 100
        }
      }' http://localhost:8080/api/tasks > /dev/null
      sleep 1
    done
    
    echo -e "${YELLOW}2. Warte 10 Sekunden, während Tasks verarbeitet werden...${NC}"
    sleep 10
    
    echo -e "${YELLOW}3. Simuliere Worker-Ausfall (Worker 1)${NC}"
    docker-compose stop worker-node-1
    
    echo -e "${YELLOW}4. Warte 15 Sekunden, um Migration zu beobachten...${NC}"
    sleep 15
    
    echo -e "${YELLOW}5. Stelle Worker wieder her${NC}"
    docker-compose start worker-node-1
    
    echo -e "${GREEN}Demo-Szenario abgeschlossen. Bitte beobachte die Visualisierung im Browser.${NC}"
    ;;
    
  clean)
    echo -e "${RED}Bereinige das System (alle Daten werden gelöscht)...${NC}"
    docker-compose down -v
    echo -e "${GREEN}System bereinigt.${NC}"
    ;;
    
  *)
    echo -e "${BLUE}Distributed Task Demo System - Verwendung:${NC}"
    echo "  ./demo.sh start         - Startet das System"
    echo "  ./demo.sh stop          - Stoppt das System"
    echo "  ./demo.sh restart       - Neustart des Systems"
    echo "  ./demo.sh logs [dienst] - Zeigt Logs (optional für einen bestimmten Dienst)"
    echo "  ./demo.sh create-task   - Erstellt einen Demo-Task"
    echo "  ./demo.sh fail-worker N - Simuliert Ausfall von Worker N (1-3)"
    echo "  ./demo.sh recover-worker N - Stellt Worker N (1-3) wieder her"
    echo "  ./demo.sh status        - Zeigt Status aller Dienste"
    echo "  ./demo.sh demo-scenario - Führt ein vollständiges Demo-Szenario aus"
    echo "  ./demo.sh clean         - Löscht alle Daten und Container"
    ;;
esac
