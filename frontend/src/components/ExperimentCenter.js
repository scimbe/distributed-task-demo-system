import React, { useState } from 'react';
import { Card, Button, Row, Col, Accordion, Badge, ProgressBar, Alert } from 'react-bootstrap';
import './ExperimentCenter.css';

const ExperimentCenter = ({ onRunExperiment, isRunning }) => {
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [runningExperiment, setRunningExperiment] = useState(null);
  const [experimentProgress, setExperimentProgress] = useState(0);
  const [experimentSteps, setExperimentSteps] = useState([]);
  const [completedSteps, setCompletedSteps] = useState([]);
  
  // Vordefinierte Experimente
  const experiments = [
    {
      id: 'basic-scenario',
      title: 'Grundlegendes Szenario',
      description: 'Erstellt mehrere Tasks und demonstriert die grundlegende Task-Verarbeitung.',
      difficulty: 'Einfach',
      duration: '~30 Sekunden',
      steps: [
        'Erstelle 5 Tasks mit unterschiedlicher Priorität',
        'Beobachte die Task-Verteilung auf Worker',
        'Warte auf die Verarbeitung der Tasks'
      ],
      commands: [
        { type: 'createTasks', count: 5, priorityRange: [1, 10] },
        { type: 'wait', duration: 5000 },
        { type: 'message', text: 'Tasks wurden erfolgreich erstellt und verteilt.' }
      ],
      icon: 'bi-play-circle',
      tag: 'Grundlagen'
    },
    {
      id: 'worker-failure',
      title: 'Worker-Ausfall',
      description: 'Simuliert den Ausfall eines Workers und zeigt, wie Tasks wiederhergestellt werden.',
      difficulty: 'Mittel',
      duration: '~1 Minute',
      steps: [
        'Erstelle mehrere Tasks',
        'Warte, bis die Tasks verarbeitet werden',
        'Simuliere einen Worker-Ausfall',
        'Beobachte die automatische Wiederherstellung'
      ],
      commands: [
        { type: 'createTasks', count: 3, priorityRange: [3, 8] },
        { type: 'wait', duration: 5000 },
        { type: 'failWorker', workerId: 'worker-1' },
        { type: 'wait', duration: 10000 },
        { type: 'message', text: 'Der Worker wurde wiederhergestellt und alle Tasks wurden migriert.' },
        { type: 'recoverWorker', workerId: 'worker-1' }
      ],
      icon: 'bi-exclamation-triangle',
      tag: 'Fehlertoleranz'
    },
    {
      id: 'task-migration',
      title: 'Task-Migration',
      description: 'Zeigt, wie Tasks von einem Worker zu einem anderen migriert werden können.',
      difficulty: 'Mittel',
      duration: '~45 Sekunden',
      steps: [
        'Erstelle einen langläufigen Task',
        'Warte, bis der Task einem Worker zugewiesen ist',
        'Führe eine manuelle Migration durch',
        'Beobachte den Task nach der Migration'
      ],
      commands: [
        { type: 'createTasks', count: 1, priority: 7, longRunning: true },
        { type: 'wait', duration: 5000 },
        { type: 'migrateTask', fromWorkerId: 'auto', toWorkerId: 'auto' },
        { type: 'wait', duration: 5000 },
        { type: 'message', text: 'Der Task wurde erfolgreich migriert und läuft weiter.' }
      ],
      icon: 'bi-arrow-left-right',
      tag: 'Migration'
    },
    {
      id: 'load-balancing',
      title: 'Lastbalancierung',
      description: 'Demonstriert, wie das System die Last zwischen Workern ausgleicht.',
      difficulty: 'Fortgeschritten',
      duration: '~1.5 Minuten',
      steps: [
        'Erstelle viele Tasks mit unterschiedlicher Priorität',
        'Überlasten eines Workers',
        'Beobachte die automatische Lastbalancierung',
        'Tasks mit höherer Priorität werden bevorzugt'
      ],
      commands: [
        { type: 'createTasks', count: 10, priorityRange: [1, 10] },
        { type: 'wait', duration: 8000 },
        { type: 'overloadWorker', workerId: 'worker-2' },
        { type: 'wait', duration: 10000 },
        { type: 'message', text: 'Tasks mit niedriger Priorität wurden zu anderen Workern migriert.' }
      ],
      icon: 'bi-bar-chart',
      tag: 'Lastverteilung'
    },
    {
      id: 'cascading-failure',
      title: 'Kaskadierender Ausfall',
      description: 'Simuliert einen kaskadierenden Ausfall mehrerer Worker und die Erholung des Systems.',
      difficulty: 'Fortgeschritten',
      duration: '~2 Minuten',
      steps: [
        'Erstelle viele Tasks',
        'Simuliere sequentielle Ausfälle mehrerer Worker',
        'Beobachte die Anpassung des Systems',
        'Stelle die Worker wieder her'
      ],
      commands: [
        { type: 'createTasks', count: 8, priorityRange: [3, 9] },
        { type: 'wait', duration: 10000 },
        { type: 'failWorker', workerId: 'worker-1' },
        { type: 'wait', duration: 8000 },
        { type: 'failWorker', workerId: 'worker-2' },
        { type: 'wait', duration: 10000 },
        { type: 'message', text: 'Das System versucht, mit der reduzierten Kapazität umzugehen.' },
        { type: 'recoverWorker', workerId: 'worker-1' },
        { type: 'wait', duration: 5000 },
        { type: 'recoverWorker', workerId: 'worker-2' }
      ],
      icon: 'bi-lightning',
      tag: 'Fehlertoleranz'
    },
    {
      id: 'priority-scheduling',
      title: 'Prioritätsbasiertes Scheduling',
      description: 'Zeigt, wie Tasks basierend auf ihrer Priorität verarbeitet werden.',
      difficulty: 'Einfach',
      duration: '~45 Sekunden',
      steps: [
        'Erstelle Tasks mit unterschiedlicher Priorität',
        'Beobachte die Reihenfolge der Verarbeitung',
        'Höhere Priorität = schnellere Verarbeitung'
      ],
      commands: [
        { type: 'createTasks', count: 1, priority: 1 },
        { type: 'createTasks', count: 1, priority: 5 },
        { type: 'createTasks', count: 1, priority: 10 },
        { type: 'wait', duration: 15000 },
        { type: 'message', text: 'Tasks mit höherer Priorität wurden zuerst verarbeitet.' }
      ],
      icon: 'bi-sort-numeric-down',
      tag: 'Scheduling'
    }
  ];
  
  // Experiment-Kategorie-Farbe
  const getTagColor = (tag) => {
    switch (tag) {
      case 'Grundlagen': return 'info';
      case 'Fehlertoleranz': return 'danger';
      case 'Migration': return 'warning';
      case 'Lastverteilung': return 'primary';
      case 'Scheduling': return 'success';
      default: return 'secondary';
    }
  };
  
  // Schwierigkeitsgrad-Farbe
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Einfach': return 'success';
      case 'Mittel': return 'warning';
      case 'Fortgeschritten': return 'danger';
      default: return 'secondary';
    }
  };
  
  // Experiment auswählen
  const handleSelectExperiment = (experiment) => {
    setSelectedExperiment(experiment);
  };
  
  // Experiment starten
  const handleStartExperiment = () => {
    if (!selectedExperiment || isRunning) return;
    
    setRunningExperiment(selectedExperiment);
    setExperimentProgress(0);
    setExperimentSteps(selectedExperiment.steps);
    setCompletedSteps([]);
    
    // Experiment an die übergeordnete Komponente übergeben
    if (onRunExperiment) {
      onRunExperiment(selectedExperiment);
    }
    
    // Simuliere Fortschritt für die UI
    simulateExperimentProgress(selectedExperiment);
  };
  
  // Simuliert den Fortschritt des Experiments für die UI
  const simulateExperimentProgress = (experiment) => {
    const steps = experiment.steps;
    const stepDuration = calculateExperimentDuration(experiment) / steps.length;
    
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < steps.length) {
        setCompletedSteps(prev => [...prev, steps[currentStep]]);
        currentStep++;
        setExperimentProgress(Math.round((currentStep / steps.length) * 100));
      } else {
        clearInterval(progressInterval);
        // Reset nach Abschluss
        setTimeout(() => {
          setRunningExperiment(null);
          setExperimentProgress(0);
        }, 5000);
      }
    }, stepDuration);
  };
  
  // Berechnet die ungefähre Dauer des Experiments in ms
  const calculateExperimentDuration = (experiment) => {
    // Aus der Dauer-Angabe eine ungefähre Zeit in ms extrahieren
    const durationText = experiment.duration;
    let durationMs = 30000; // Standardwert
    
    if (durationText.includes('Sekunden')) {
      const seconds = parseInt(durationText.match(/\d+/)[0]);
      durationMs = seconds * 1000;
    } else if (durationText.includes('Minute')) {
      const minutes = parseFloat(durationText.match(/\d+(\.\d+)?/)[0]);
      durationMs = minutes * 60 * 1000;
    }
    
    return durationMs;
  };
  
  return (
    <div className="experiment-center">
      <Card className="experiment-card">
        <Card.Header as="h5">Experimentierzentrum</Card.Header>
        <Card.Body>
          <Row>
            <Col md={7}>
              <div className="experiment-list">
                <h6>Verfügbare Experimente</h6>
                <div className="experiment-grid">
                  {experiments.map(experiment => (
                    <div 
                      key={experiment.id}
                      className={`experiment-item ${selectedExperiment?.id === experiment.id ? 'selected' : ''}`}
                      onClick={() => handleSelectExperiment(experiment)}
                    >
                      <div className="experiment-icon">
                        <i className={`bi ${experiment.icon}`}></i>
                      </div>
                      <div className="experiment-content">
                        <h6>{experiment.title}</h6>
                        <div className="experiment-tags">
                          <Badge bg={getTagColor(experiment.tag)}>{experiment.tag}</Badge>
                          <Badge bg={getDifficultyColor(experiment.difficulty)} className="ms-1">{experiment.difficulty}</Badge>
                        </div>
                        <p className="experiment-description">{experiment.description}</p>
                        <small className="experiment-duration">
                          <i className="bi bi-clock me-1"></i>
                          {experiment.duration}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Col>
            
            <Col md={5}>
              <div className="experiment-details">
                {selectedExperiment ? (
                  <>
                    <div className="experiment-header">
                      <h5>{selectedExperiment.title}</h5>
                      <div className="experiment-badges">
                        <Badge bg={getTagColor(selectedExperiment.tag)}>{selectedExperiment.tag}</Badge>
                        <Badge bg={getDifficultyColor(selectedExperiment.difficulty)} className="ms-1">
                          {selectedExperiment.difficulty}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="experiment-full-description">{selectedExperiment.description}</p>
                    
                    <div className="experiment-info">
                      <div className="info-item">
                        <i className="bi bi-clock"></i>
                        <span>Dauer: {selectedExperiment.duration}</span>
                      </div>
                      <div className="info-item">
                        <i className="bi bi-list-check"></i>
                        <span>Schritte: {selectedExperiment.steps.length}</span>
                      </div>
                    </div>
                    
                    <Accordion defaultActiveKey="0" className="mb-3">
                      <Accordion.Item eventKey="0">
                        <Accordion.Header>Experimentablauf</Accordion.Header>
                        <Accordion.Body>
                          <ol className="experiment-steps">
                            {selectedExperiment.steps.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </Accordion.Body>
                      </Accordion.Item>
                      <Accordion.Item eventKey="1">
                        <Accordion.Header>Erwartete Ergebnisse</Accordion.Header>
                        <Accordion.Body>
                          <p>Dieses Experiment wird folgendes demonstrieren:</p>
                          <ul>
                            <li>Wie Tasks im System verteilt werden</li>
                            <li>Wie das System auf Ereignisse reagiert</li>
                            <li>Wie die Fehlertoleranz-Mechanismen funktionieren</li>
                          </ul>
                        </Accordion.Body>
                      </Accordion.Item>
                    </Accordion>
                    
                    <Button 
                      variant="primary" 
                      className="w-100"
                      disabled={isRunning || runningExperiment !== null}
                      onClick={handleStartExperiment}
                    >
                      {isRunning || runningExperiment !== null ? 
                        'Experiment läuft...' : 
                        'Experiment starten'}
                    </Button>
                  </>
                ) : (
                  <div className="no-experiment-selected">
                    <i className="bi bi-clipboard-data"></i>
                    <p>Wähle ein Experiment aus der Liste</p>
                  </div>
                )}
              </div>
            </Col>
          </Row>
          
          {runningExperiment && (
            <div className="experiment-progress-container">
              <Card className="progress-card">
                <Card.Body>
                  <h6>
                    <i className="bi bi-gear-wide-connected me-2"></i>
                    Experiment läuft: {runningExperiment.title}
                  </h6>
                  <ProgressBar 
                    now={experimentProgress} 
                    label={`${experimentProgress}%`} 
                    className="my-3" 
                    animated
                  />
                  
                  <div className="completed-steps">
                    {completedSteps.map((step, index) => (
                      <Alert key={index} variant="info" className="step-alert">
                        <i className="bi bi-check-circle me-2"></i>
                        {step}
                      </Alert>
                    ))}
                    
                    {completedSteps.length === runningExperiment.steps.length && (
                      <Alert variant="success">
                        <i className="bi bi-trophy me-2"></i>
                        Experiment erfolgreich abgeschlossen!
                      </Alert>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default ExperimentCenter;