import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Button, Accordion } from 'react-bootstrap';
import './StepByStepExplainer.css';

const StepByStepExplainer = ({ tasks, workers, events }) => {
  const [explanation, setExplanation] = useState([]);

  // Aktualisiere die Erklärungen basierend auf aktuellen System-Events und -Zuständen
  useEffect(() => {
    const generateExplanations = () => {
      let newExplanations = [];

      // Allgemeine Informationen zum System
      newExplanations.push({
        id: 'system-overview',
        title: 'System-Überblick',
        content: `Das verteilte Task-System besteht aktuell aus ${workers.length} Workern und ${tasks.length} Tasks.`,
        type: 'info'
      });

      // Erkläre den Task-Lebenszyklus
      newExplanations.push({
        id: 'task-lifecycle',
        title: 'Task-Lebenszyklus',
        content: 
          `Ein Task durchläuft folgende Status:
          1. CREATED: Der Task wurde erstellt und wartet in der Warteschlange.
          2. ASSIGNED: Der Task wurde einem Worker zugewiesen.
          3. RUNNING: Der Worker verarbeitet den Task aktiv.
          4. COMPLETED/FAILED: Der Task wurde erfolgreich abgeschlossen oder ist fehlgeschlagen.`,
        type: 'info'
      });

      // Aktuelle Task-Verteilung
      const runningTasks = tasks.filter(t => t.status === 'RUNNING').length;
      const queuedTasks = tasks.filter(t => t.status === 'CREATED').length;
      const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
      
      newExplanations.push({
        id: 'current-distribution',
        title: 'Aktuelle Task-Verteilung',
        content: 
          `Aktuell sind ${runningTasks} Tasks in Bearbeitung, ${queuedTasks} warten in der Warteschlange, und ${completedTasks} wurden abgeschlossen.`,
        type: 'status'
      });

      // Fehlgeschlagene Tasks und Wiederaufnahme
      const failedTasks = tasks.filter(t => t.status === 'FAILED').length;
      if (failedTasks > 0) {
        newExplanations.push({
          id: 'failed-tasks',
          title: 'Fehlgeschlagene Tasks',
          content: 
            `${failedTasks} Tasks sind fehlgeschlagen. Diese können neu gestartet werden, indem man auf das grüne Wiederaufnahme-Symbol klickt. Dies ist ein wichtiger Aspekt der Fehlertoleranz in verteilten Systemen.`,
          type: 'warning'
        });
      }

      // Worker-Status
      const failingWorkers = workers.filter(w => w.status === 'FAILING').length;
      if (failingWorkers > 0) {
        newExplanations.push({
          id: 'failing-workers',
          title: 'Fehlerhafte Worker',
          content: 
            `${failingWorkers} Worker fallen aus. Das System reagiert, indem es die betroffenen Tasks in den Status RECOVERING versetzt und sie anderen Worker zuweist. Dieser Failover-Mechanismus gewährleistet die Robustheit des Systems.`,
          type: 'danger'
        });
      }

      // Migrations-Erklärung
      const migratingTasks = tasks.filter(t => t.status === 'MIGRATING').length;
      if (migratingTasks > 0) {
        newExplanations.push({
          id: 'migrations',
          title: 'Task-Migration',
          content: 
            `${migratingTasks} Tasks werden gerade zwischen Workern migriert. Bei einer Migration wird der aktuelle Zustand des Tasks gespeichert (Checkpoint) und zum Ziel-Worker übertragen. Dieser setzt die Ausführung genau an dem Punkt fort, an dem der vorherige Worker aufgehört hat.`,
          type: 'warning'
        });
      }

      // Checkpoint-System erklären, wenn Tasks in Bearbeitung sind
      if (runningTasks > 0) {
        newExplanations.push({
          id: 'checkpoints',
          title: 'Checkpoint-System',
          content: 
            `Während der Ausführung erstellen Worker regelmäßig Checkpoints - Snapshots des Task-Fortschritts. Diese Checkpoints ermöglichen die Wiederaufnahme von Tasks nach einem Ausfall oder während einer Migration. Dies ist ein zentrales Element für die Fehlertoleranz und Flexibilität des Systems.`,
          type: 'info'
        });
      }

      // Lastverteilung erklären
      const busyWorkers = workers.filter(w => w.status === 'BUSY').length;
      const idleWorkers = workers.filter(w => w.status === 'IDLE').length;
      
      if (busyWorkers > 0 && idleWorkers > 0) {
        newExplanations.push({
          id: 'load-balancing',
          title: 'Lastverteilung',
          content: 
            `Aktuell sind ${busyWorkers} Worker beschäftigt und ${idleWorkers} sind frei. Das System verteilt neue Tasks bevorzugt an freie Worker, um eine optimale Ressourcennutzung zu gewährleisten. Tasks mit hoher Priorität werden bevorzugt verarbeitet.`,
          type: 'info'
        });
      }

      // Jüngste Ereignisse hervorheben (maximal 3)
      if (events.length > 0) {
        const recentEvents = events.slice(0, 3);
        newExplanations.push({
          id: 'recent-events',
          title: 'Aktuelle Ereignisse',
          content: 
            `Letzte Ereignisse im System:
            ${recentEvents.map(e => `- ${e.message}`).join('\n')}`,
          type: 'event'
        });
      }

      // Detaillierte Erklärungen zu Schlüsselkonzepten
      newExplanations.push({
        id: 'key-concepts',
        title: 'Schlüsselkonzepte',
        concepts: [
          {
            name: 'Verteilte Ausführung',
            description: 'Tasks werden über mehrere unabhängige Worker-Knoten verteilt, was Parallelität und Skalierbarkeit ermöglicht.',
          },
          {
            name: 'Fehlertoleranz',
            description: 'Das System kann den Ausfall einzelner Komponenten (Worker) verkraften, ohne dass der Gesamtbetrieb beeinträchtigt wird.',
          },
          {
            name: 'Checkpointing',
            description: 'Regelmäßiges Speichern des Zustands ermöglicht die Wiederaufnahme von Tasks nach Ausfällen ohne Datenverlust.',
          },
          {
            name: 'Task-Migration',
            description: 'Laufende Tasks können zwischen Workern verschoben werden, was Lastausgleich und Wartungsarbeiten ermöglicht.',
          },
          {
            name: 'Prioritätsbasiertes Scheduling',
            description: 'Tasks mit höherer Priorität werden bevorzugt behandelt, was wichtige Aufgaben beschleunigt.',
          }
        ],
        type: 'concept'
      });

      return newExplanations;
    };

    setExplanation(generateExplanations());
  }, [tasks, workers, events]);

  // Bestimme die Hintergrundfarbe basierend auf dem Typ der Erklärung
  const getCardBackground = (type) => {
    switch (type) {
      case 'warning': return 'bg-warning-subtle';
      case 'danger': return 'bg-danger-subtle';
      case 'status': return 'bg-success-subtle';
      case 'event': return 'bg-info-subtle';
      case 'concept': return 'bg-primary-subtle';
      default: return 'bg-light';
    }
  };

  return (
    <div className="step-by-step-explainer">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Schritt-für-Schritt Erklärung</h5>
          <Badge bg="primary">Lerntool</Badge>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">
            Diese Erklärungen helfen dir, die Prinzipien verteilter Systeme anhand der laufenden Demo zu verstehen.
          </p>
          
          <div className="explanation-container">
            {explanation.map((item) => (
              <div 
                key={item.id} 
                className={`explanation-card ${getCardBackground(item.type)}`}
              >
                <h6>
                  {item.title}
                  {item.type === 'warning' && <i className="bi bi-exclamation-triangle ms-2"></i>}
                  {item.type === 'danger' && <i className="bi bi-exclamation-circle ms-2"></i>}
                  {item.type === 'event' && <i className="bi bi-bell ms-2"></i>}
                </h6>
                
                {item.content && (
                  <div className="explanation-content">
                    {item.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-1">{line}</p>
                    ))}
                  </div>
                )}
                
                {item.concepts && (
                  <Accordion className="concept-accordion">
                    {item.concepts.map((concept, idx) => (
                      <Accordion.Item key={idx} eventKey={idx.toString()}>
                        <Accordion.Header>
                          <span className="fw-medium">{concept.name}</span>
                        </Accordion.Header>
                        <Accordion.Body>
                          <p>{concept.description}</p>
                        </Accordion.Body>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                )}
              </div>
            ))}
          </div>
        </Card.Body>
        <Card.Footer>
          <Button variant="outline-primary" size="sm" className="w-100">
            <i className="bi bi-book me-2"></i>
            Weitere Informationen zur Theorie verteilter Systeme
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default StepByStepExplainer;