import React, { useState, useEffect } from 'react';
import './App.css';
import TaskList from './components/TaskList';
import TaskDetail from './components/TaskDetail';
import SystemVisualizer from './components/SystemVisualizer';
import WorkerRobotWorkshop from './components/WorkerRobotWorkshop';
import TaskJourneyTimeline from './components/TaskJourneyTimeline';
import StepByStepExplainer from './components/StepByStepExplainer';
import ExperimentCenter from './components/ExperimentCenter';
import TaskControlCenter from './components/TaskControlCenter';
import { Container, Row, Col, Button, Nav, Navbar, Badge, Alert } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Demo-Mock-Daten für den Fall, dass die API nicht funktioniert
const MOCK_WORKERS = [
  { id: "worker-1", status: "IDLE" },
  { id: "worker-2", status: "IDLE" },
  { id: "worker-3", status: "IDLE" }
];

// Task-Fortschritt simulieren für Demo-Zwecke
const simulateTaskProgress = (tasks) => {
  return tasks.map(task => {
    if (task.status === 'RUNNING') {
      // Simuliere Fortschritt um 5-10%
      const newProgress = Math.min(95, task.progress + Math.floor(Math.random() * 5) + 5);
      
      // Bei 100% als abgeschlossen markieren
      if (newProgress >= 95) {
        return { ...task, progress: 100, status: 'COMPLETED' };
      }
      
      return { ...task, progress: newProgress };
    } else if (task.status === 'CREATED' && Math.random() > 0.7) {
      // Einige erstellte Tasks zu RUNNING umwandeln (Demo-Modus)
      const randomWorker = `worker-${Math.floor(Math.random() * 3) + 1}`;
      return { 
        ...task, 
        status: 'RUNNING', 
        worker_id: randomWorker,
        progress: Math.floor(Math.random() * 20) + 10 
      };
    }
    return task;
  });
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState(MOCK_WORKERS);
  const [selectedTask, setSelectedTask] = useState(null);
  const [events, setEvents] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [inDemoMode, setInDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [experimentRunning, setExperimentRunning] = useState(false);

  // WebSocket für Echtzeit-Updates
  useEffect(() => {
    // Verwende relative URL für WebSocket, damit der Proxy funktioniert
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    console.log('Verbinde mit WebSocket auf:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket verbunden');
      addEvent('WebSocket-Verbindung hergestellt');
      setInDemoMode(false);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'task_update':
            updateTask(data.content);
            addEvent(`Task ${data.content.id.substring(0, 8)}... aktualisiert: ${data.content.status}`);
            break;
          case 'worker_update':
            updateWorker(data.content);
            break;
          case 'task_checkpoint':
            addEvent(`Checkpoint für Task ${data.taskId.substring(0, 8)}...: Progress ${data.content.progress}%`);
            break;
          case 'task_migration':
            addEvent(`Task ${data.taskId.substring(0, 8)}... migriert von Worker ${data.content.fromWorker} zu ${data.content.toWorker}`);
            break;
          case 'task_recovery':
            addEvent(`Task ${data.taskId.substring(0, 8)}... wird wiederhergestellt: ${data.content.message}`);
            break;
          case 'welcome':
            console.log('WebSocket Welcome-Nachricht:', data);
            break;
          default:
            console.log('Unbekannter Ereignistyp:', data.type);
        }
      } catch (err) {
        console.error('Fehler beim Verarbeiten der WebSocket-Nachricht:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket Fehler:', error);
      addEvent('WebSocket-Verbindungsfehler');
      setInDemoMode(true);
    };
    
    ws.onclose = () => {
      console.log('WebSocket Verbindung geschlossen');
      addEvent('WebSocket-Verbindung geschlossen');
      setInDemoMode(true);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Funktion zum Laden der Tasks
  const loadTasks = () => {
    setLoadingTasks(true);
    
    fetch('/api/tasks')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Tasks geladen:', data.length);
        setTasks(data);
        setError(null);
        setInDemoMode(false);
        
        // Wenn ein Task ausgewählt ist, aktualisiere ihn
        if (selectedTask) {
          const updatedTask = data.find(t => t.id === selectedTask.id);
          if (updatedTask) {
            setSelectedTask(updatedTask);
          }
        }
      })
      .catch(err => {
        console.error('Fehler beim Laden der Tasks:', err);
        setError('Fehler beim Laden der Tasks. API möglicherweise nicht erreichbar.');
        setInDemoMode(true);
        
        // Keine Benutzerinteraktion blockieren - UI weiter verwendbar lassen
        // Mock-Tasks für die Demo anzeigen, wenn keine Daten geladen werden können
        if (tasks.length === 0) {
          const mockTasks = [
            {
              id: "demo-task-1",
              type: "computation",
              status: "CREATED",
              priority: 5,
              data: { operation: "complex-calculation", input: [1, 2, 3, 4, 5], iterations: 100 },
              progress: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "demo-task-2",
              type: "computation",
              status: "RUNNING",
              priority: 3,
              worker_id: "worker-2",
              data: { operation: "matrix-multiplication", input: [10, 20], iterations: 50 },
              progress: 45,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              id: "demo-task-3",
              type: "io",
              status: "COMPLETED",
              priority: 2,
              worker_id: "worker-1",
              data: { operation: "file-processing", path: "/data/file.txt" },
              progress: 100,
              created_at: new Date(Date.now() - 300000).toISOString(),
              updated_at: new Date(Date.now() - 100000).toISOString()
            }
          ];
          setTasks(mockTasks);
        } else if (inDemoMode) {
          // Im Demo-Modus den Fortschritt simulieren
          setTasks(simulateTaskProgress(tasks));
        }
      })
      .finally(() => {
        setLoadingTasks(false);
      });
  };

  // Lade auch Worker
  const loadWorkers = () => {
    fetch('/api/workers')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Workers geladen:', data.length);
        setWorkers(data);
        setInDemoMode(false);
      })
      .catch(err => {
        console.error('Fehler beim Laden der Workers:', err);
        setInDemoMode(true);
        
        // Behalte die Mock-Workers bei, wenn die API nicht erreichbar ist
        // Aktualisiere aber die Worker mit den aktuellen Tasks
        if (inDemoMode) {
          const updatedWorkers = [...MOCK_WORKERS];
          
          // Status basierend auf zugewiesenen Tasks aktualisieren
          tasks.forEach(task => {
            if (task.worker_id) {
              const workerIndex = updatedWorkers.findIndex(w => w.id === task.worker_id);
              if (workerIndex !== -1) {
                updatedWorkers[workerIndex].status = 'BUSY';
                updatedWorkers[workerIndex].task = task.id;
              }
            }
          });
          
          setWorkers(updatedWorkers);
        }
      });
  };

  // Funktion zur Aktualisierung der Daten
  const refreshData = () => {
    loadTasks();
    loadWorkers();
    setLastRefresh(new Date());
  };

  // Task aktualisieren
  const updateTask = (taskData) => {
    setTasks(prevTasks => {
      const updatedTasks = [...prevTasks];
      const index = updatedTasks.findIndex(task => task.id === taskData.id);
      
      if (index !== -1) {
        updatedTasks[index] = taskData;
      } else {
        updatedTasks.push(taskData);
      }
      
      // Wenn der ausgewählte Task aktualisiert wurde, auch diesen aktualisieren
      if (selectedTask && selectedTask.id === taskData.id) {
        setSelectedTask(taskData);
      }
      
      return updatedTasks;
    });
  };

  // Worker aktualisieren
  const updateWorker = (workerData) => {
    setWorkers(prevWorkers => {
      const updatedWorkers = Array.isArray(prevWorkers) ? [...prevWorkers] : Object.values(prevWorkers);
      const index = updatedWorkers.findIndex(worker => worker.id === workerData.id);
      
      if (index !== -1) {
        updatedWorkers[index] = workerData;
      } else {
        updatedWorkers.push(workerData);
      }
      
      return updatedWorkers;
    });
  };

  // Event hinzufügen
  const addEvent = (message) => {
    const timestamp = new Date().toISOString();
    setEvents(prevEvents => [
      { id: Date.now(), timestamp, message },
      ...prevEvents.slice(0, 99) // Maximal 100 Ereignisse speichern
    ]);
  };

  // Demo-Modus-Aktualisierung
  useEffect(() => {
    if (inDemoMode) {
      // Im Demo-Modus alle 3 Sekunden Fortschritt simulieren
      const interval = setInterval(() => {
        setTasks(prevTasks => simulateTaskProgress(prevTasks));
        setLastRefresh(new Date());
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [inDemoMode]);

  // Automatische Aktualisierung
  useEffect(() => {
    // Initiale Daten laden
    loadTasks();
    loadWorkers();
    addEvent('Anwendung gestartet');

    // Automatische Aktualisierung alle 3 Sekunden
    const interval = setInterval(() => {
      loadTasks();
      loadWorkers();
      setLastRefresh(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Neuen Task erstellen
  const createNewTask = (taskFormData) => {
    setCreatingTask(true);
    
    let taskData;
    try {
      taskData = typeof taskFormData.data === 'string' && taskFormData.data.trim() 
        ? JSON.parse(taskFormData.data) 
        : (typeof taskFormData.data === 'object' ? taskFormData.data : {});
    } catch (error) {
      alert('Ungültiges JSON-Format für Task-Daten');
      setCreatingTask(false);
      return;
    }
    
    const newTask = {
      type: taskFormData.type,
      priority: taskFormData.priority,
      data: taskData
    };
    
    console.log('Task wird erstellt:', newTask);
    
    fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newTask)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Task erstellt:', data);
        addEvent(`Neuer Task erstellt: ${data.id}`);
        
        // Daten sofort neu laden
        loadTasks();
        setLastRefresh(new Date());
        setError(null);
        setInDemoMode(false);
      })
      .catch(error => {
        console.error('Fehler beim Erstellen des Tasks:', error);
        addEvent('Fehler beim Erstellen des Tasks');
        setError('Fehler beim Erstellen des Tasks. API möglicherweise nicht erreichbar.');
        setInDemoMode(true);
        
        // Trotzdem eine Task-Erstellung simulieren für die Demo
        const demoTask = {
          id: `demo-${Date.now()}`,
          type: taskFormData.type,
          status: "CREATED",
          priority: taskFormData.priority,
          data: taskData,
          progress: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        setTasks(prevTasks => [...prevTasks, demoTask]);
      })
      .finally(() => {
        setCreatingTask(false);
      });
  };

  // Task für Visualisierung auswählen
  const selectTask = (task) => {
    console.log('Task ausgewählt:', task);
    setSelectedTask(task);
  };

  // Task migrieren
  const migrateTask = (taskId, targetWorkerId) => {
    console.log(`Task ${taskId} soll zu Worker ${targetWorkerId} migriert werden`);
    addEvent(`Migration von Task ${taskId.substring(0, 8)}... zu Worker ${targetWorkerId} angefordert`);
    
    fetch(`/api/tasks/${taskId}/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ worker_id: targetWorkerId })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Migration initiiert:', data);
        addEvent(`Task ${taskId.substring(0, 8)}... erfolgreich zu Worker ${targetWorkerId} migriert`);
        
        // Task-Status in der UI aktualisieren
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? {...task, worker_id: targetWorkerId, status: "MIGRATING"} 
              : task
          )
        );
        
        // Daten sofort neu laden
        loadTasks();
        setInDemoMode(false);
      })
      .catch(error => {
        console.error('Fehler bei der Task-Migration:', error);
        addEvent(`Fehler bei der Migration von Task ${taskId.substring(0, 8)}...`);
        setInDemoMode(true);
        
        // Simuliere erfolgreiche Migration für die Demo
        setTimeout(() => {
          addEvent(`Task ${taskId.substring(0, 8)}... erfolgreich zu Worker ${targetWorkerId} migriert (simuliert)`);
          
          // Task-Status in der UI aktualisieren
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === taskId 
                ? {...task, worker_id: targetWorkerId, status: "RUNNING"} 
                : task
            )
          );
        }, 1000);
      });
  };

  // Experiment ausführen
  const runExperiment = (experiment) => {
    setExperimentRunning(true);
    addEvent(`Experiment "${experiment.title}" gestartet`);
    
    // Führe nacheinander die Command-Schritte aus
    const executeCommands = async (commands) => {
      for (const command of commands) {
        switch(command.type) {
          case 'createTasks':
            for (let i = 0; i < command.count; i++) {
              const priority = command.priorityRange 
                ? Math.floor(Math.random() * (command.priorityRange[1] - command.priorityRange[0])) + command.priorityRange[0]
                : (command.priority || 5);
                
              const taskData = {
                type: 'computation',
                priority,
                data: {
                  operation: 'complex-calculation',
                  input: [1, 2, 3, 4, 5],
                  iterations: command.longRunning ? 500 : 100
                }
              };
              
              await new Promise(resolve => {
                createNewTask(taskData);
                setTimeout(resolve, 1000); // Kurze Pause zwischen Task-Erstellungen
              });
            }
            break;
            
          case 'wait':
            await new Promise(resolve => setTimeout(resolve, command.duration));
            break;
            
          case 'failWorker':
            addEvent(`Simuliere Ausfall von ${command.workerId}`);
            
            if (inDemoMode) {
              // Im Demo-Modus: Simuliere Worker-Ausfall
              setWorkers(prevWorkers => 
                prevWorkers.map(worker => 
                  worker.id === command.workerId 
                    ? {...worker, status: "FAILING"} 
                    : worker
                )
              );
              
              // Simuliere Task-Recovery
              const affectedTasks = tasks.filter(task => task.worker_id === command.workerId && task.status === 'RUNNING');
              if (affectedTasks.length > 0) {
                setTimeout(() => {
                  // Verschiebe Tasks zu anderen Workern
                  const availableWorkers = workers.filter(w => w.id !== command.workerId && w.status !== 'FAILING');
                  if (availableWorkers.length > 0) {
                    affectedTasks.forEach(task => {
                      const targetWorker = availableWorkers[Math.floor(Math.random() * availableWorkers.length)];
                      migrateTask(task.id, targetWorker.id);
                    });
                  }
                }, 2000);
              }
            } else {
              // Im echten Modus: API-Aufruf
              try {
                await fetch(`/api/workers/${command.workerId}/fail`, {
                  method: 'POST'
                });
              } catch (error) {
                console.error('Fehler beim Simulieren des Worker-Ausfalls:', error);
              }
            }
            break;
            
          case 'recoverWorker':
            addEvent(`Stelle Worker ${command.workerId} wieder her`);
            
            if (inDemoMode) {
              // Im Demo-Modus: Simuliere Worker-Wiederherstellung
              setWorkers(prevWorkers => 
                prevWorkers.map(worker => 
                  worker.id === command.workerId 
                    ? {...worker, status: "IDLE"} 
                    : worker
                )
              );
            } else {
              // Im echten Modus: API-Aufruf
              try {
                await fetch(`/api/workers/${command.workerId}/recover`, {
                  method: 'POST'
                });
              } catch (error) {
                console.error('Fehler beim Wiederherstellen des Workers:', error);
              }
            }
            break;
            
          case 'message':
            addEvent(command.text);
            break;
            
          default:
            console.log('Unbekannter Experiment-Befehl:', command);
        }
      }
      
      // Experiment abgeschlossen
      addEvent(`Experiment "${experiment.title}" abgeschlossen`);
      setExperimentRunning(false);
    };
    
    // Experiment-Befehle ausführen
    executeCommands(experiment.commands);
  };

  // Formatiere das Datum für die Anzeige
  const formatTime = (date) => {
    return date ? date.toLocaleTimeString() : '';
  };

  // Anzahl der Tasks nach Status
  const taskCounts = tasks.reduce((counts, task) => {
    const status = task.status || 'UNKNOWN';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand href="#home">Verteiltes Task-System Demo</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link 
                href="#dashboard" 
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </Nav.Link>
              <Nav.Link 
                href="#worker-workshop" 
                active={activeTab === 'worker-workshop'}
                onClick={() => setActiveTab('worker-workshop')}
              >
                Worker-Werkstatt
              </Nav.Link>
              <Nav.Link 
                href="#task-journey" 
                active={activeTab === 'task-journey'}
                onClick={() => setActiveTab('task-journey')}
              >
                Task-Reise
              </Nav.Link>
              <Nav.Link 
                href="#experiments" 
                active={activeTab === 'experiments'}
                onClick={() => setActiveTab('experiments')}
              >
                Experimente
              </Nav.Link>
            </Nav>
            <div className="d-flex align-items-center text-light">
              {inDemoMode && (
                <Badge bg="warning" className="me-2">Demo-Modus</Badge>
              )}
              <span className="me-2">Letzte Aktualisierung: {formatTime(lastRefresh)}</span>
              <Button 
                variant="outline-light" 
                size="sm"
                onClick={refreshData}
                disabled={loadingTasks}
              >
                <i className="bi bi-arrow-clockwise me-1"></i>
                {loadingTasks ? 'Wird aktualisiert...' : 'Aktualisieren'}
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    
      <Container fluid className="app-container">
        {error && (
          <Alert variant="warning" className="mt-2 mb-3">
            <strong>{error}</strong>
            <div className="small">Die Demo arbeitet mit simulierten Daten weiter.</div>
          </Alert>
        )}
        
        {activeTab === 'dashboard' && (
          <>
            <Row className="mb-4">
              <Col>
                <TaskControlCenter 
                  tasks={tasks} 
                  workers={workers} 
                  onCreateTask={createNewTask}
                  isLoading={creatingTask}
                />
              </Col>
            </Row>
            
            <Row>
              <Col lg={8}>
                <div className="visualizer-container">
                  <h2>System-Visualisierung</h2>
                  <div className="mb-2">
                    <span className="badge bg-primary me-2">Tasks: {tasks.length}</span>
                    {taskCounts.CREATED && <span className="badge bg-info me-2">Erstellt: {taskCounts.CREATED}</span>}
                    {taskCounts.RUNNING && <span className="badge bg-warning me-2">Laufend: {taskCounts.RUNNING}</span>}
                    {taskCounts.COMPLETED && <span className="badge bg-success me-2">Abgeschlossen: {taskCounts.COMPLETED}</span>}
                    {taskCounts.FAILED && <span className="badge bg-danger me-2">Fehlgeschlagen: {taskCounts.FAILED}</span>}
                  </div>
                  <SystemVisualizer 
                    tasks={tasks} 
                    workers={workers} 
                    selectedTask={selectedTask}
                    key={`vis-${lastRefresh.getTime()}`}
                  />
                </div>
              </Col>
              
              <Col lg={4}>
                <StepByStepExplainer 
                  tasks={tasks} 
                  workers={workers}
                  events={events}
                />
              </Col>
            </Row>
          
            <Row className="mt-4">
              <Col lg={6}>
                <h2>Tasks</h2>
                <TaskList 
                  tasks={tasks} 
                  onSelectTask={selectTask} 
                  selectedTaskId={selectedTask?.id}
                  key={`tasks-${lastRefresh.getTime()}`}
                />
              </Col>
              
              <Col lg={6}>
                <h2>System-Ereignisse</h2>
                <div className="events-container">
                  {events.length > 0 ? (
                    events.map(event => (
                      <div key={event.id} className="event-item">
                        <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                        <span className="event-message">{event.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-3 text-muted">
                      Keine Ereignisse vorhanden
                    </div>
                  )}
                </div>
              </Col>
            </Row>
            
            {selectedTask && (
              <Row className="mt-4">
                <Col>
                  <h2>Task-Details</h2>
                  <TaskDetail task={selectedTask} />
                </Col>
              </Row>
            )}
          </>
        )}
        
        {activeTab === 'worker-workshop' && (
          <Row>
            <Col>
              <WorkerRobotWorkshop 
                workers={workers} 
                onMigrateTask={migrateTask}
                tasks={tasks}
                key={`workers-${lastRefresh.getTime()}`}
              />
            </Col>
          </Row>
        )}
        
        {activeTab === 'task-journey' && (
          <Row>
            <Col>
              <TaskJourneyTimeline
                tasks={tasks}
                onSelectTask={selectTask}
              />
            </Col>
          </Row>
        )}
        
        {activeTab === 'experiments' && (
          <Row>
            <Col>
              <ExperimentCenter
                onRunExperiment={runExperiment}
                isRunning={experimentRunning}
              />
            </Col>
          </Row>
        )}
      </Container>
    </>
  );
}

export default App;