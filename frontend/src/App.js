import React, { useState, useEffect } from 'react';
import './App.css';
import TaskList from './components/TaskList';
import WorkerGrid from './components/WorkerGrid';
import TaskDetail from './components/TaskDetail';
import SystemVisualizer from './components/SystemVisualizer';
import { Container, Row, Col, Button, Form, Alert, Badge } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

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
  const [newTaskFormData, setNewTaskFormData] = useState({
    type: 'computation',
    priority: 5,
    data: JSON.stringify({
      operation: 'complex-calculation',
      input: [1, 2, 3, 4, 5],
      iterations: 100
    }, null, 2)
  });
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [error, setError] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [inDemoMode, setInDemoMode] = useState(false);

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

  // Task-Formular-Handler
  const handleTaskFormChange = (e) => {
    const { name, value } = e.target;
    setNewTaskFormData(prevData => ({
      ...prevData,
      [name]: name === 'priority' ? parseInt(value, 10) : value
    }));
  };

  // Neuen Task erstellen
  const createNewTask = (e) => {
    e.preventDefault();
    setCreatingTask(true);
    
    let taskData;
    try {
      taskData = newTaskFormData.data.trim() 
        ? JSON.parse(newTaskFormData.data) 
        : {};
    } catch (error) {
      alert('Ungültiges JSON-Format für Task-Daten');
      setCreatingTask(false);
      return;
    }
    
    const newTask = {
      type: newTaskFormData.type,
      priority: newTaskFormData.priority,
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
        
        // Formular zurücksetzen
        setNewTaskFormData({
          type: 'computation',
          priority: 5,
          data: JSON.stringify({
            operation: 'complex-calculation',
            input: [1, 2, 3, 4, 5],
            iterations: 100
          }, null, 2)
        });
        
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
          type: newTaskFormData.type,
          status: "CREATED",
          priority: newTaskFormData.priority,
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
      body: JSON.stringify({ workerId: targetWorkerId })
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

  // JSON-Beispieldaten für den Task
  const getExampleJSON = (type) => {
    switch(type) {
      case 'computation':
        return JSON.stringify({
          operation: 'complex-calculation',
          input: [1, 2, 3, 4, 5],
          iterations: 100
        }, null, 2);
      case 'io':
        return JSON.stringify({
          operation: 'file-processing',
          filePath: '/path/to/file.txt',
          encoding: 'utf-8'
        }, null, 2);
      case 'network':
        return JSON.stringify({
          operation: 'http-request',
          url: 'https://example.com/api',
          method: 'GET'
        }, null, 2);
      default:
        return '{\n  "key": "value"\n}';
    }
  };

  // Handler für die Änderung des Task-Typs
  const handleTaskTypeChange = (e) => {
    const newType = e.target.value;
    setNewTaskFormData(prevData => ({
      ...prevData,
      type: newType,
      data: getExampleJSON(newType)
    }));
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
    <Container fluid className="app-container">
      <h1 className="text-center my-4">Verteiltes Task-System Demo</h1>
      
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <span>Letzte Aktualisierung: {formatTime(lastRefresh)}</span>
              {inDemoMode && (
                <Badge bg="warning" className="ms-2">Demo-Modus</Badge>
              )}
              {error && (
                <Alert variant="warning" className="mt-2 mb-0">
                  <strong>{error}</strong>
                  <div className="small">Die Demo arbeitet mit simulierten Daten weiter.</div>
                </Alert>
              )}
            </div>
            <Button 
              variant="primary" 
              onClick={refreshData}
              disabled={loadingTasks}
            >
              {loadingTasks ? 'Wird aktualisiert...' : 'Aktualisieren'}
            </Button>
          </div>
        </Col>
      </Row>
      
      <Row>
        <Col md={8}>
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
        
        <Col md={4}>
          <div className="control-panel">
            <h2>Neuen Task erstellen</h2>
            <Form onSubmit={createNewTask}>
              <Form.Group className="mb-3">
                <Form.Label>Task-Typ</Form.Label>
                <Form.Select 
                  name="type" 
                  value={newTaskFormData.type}
                  onChange={handleTaskTypeChange}
                >
                  <option value="computation">Berechnung</option>
                  <option value="io">I/O-Operation</option>
                  <option value="network">Netzwerkoperation</option>
                </Form.Select>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Priorität</Form.Label>
                <Form.Control 
                  type="number" 
                  name="priority" 
                  min="1" 
                  max="10" 
                  value={newTaskFormData.priority}
                  onChange={handleTaskFormChange}
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Task-Daten (JSON)</Form.Label>
                <Form.Control 
                  as="textarea" 
                  name="data" 
                  rows={4} 
                  value={newTaskFormData.data}
                  onChange={handleTaskFormChange}
                />
              </Form.Group>
              
              <Button 
                variant="primary" 
                type="submit" 
                className="w-100"
                disabled={creatingTask}
              >
                {creatingTask ? 'Task wird erstellt...' : 'Task erstellen'}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col md={6}>
          <h2>Tasks</h2>
          <TaskList 
            tasks={tasks} 
            onSelectTask={selectTask} 
            selectedTaskId={selectedTask?.id}
            key={`tasks-${lastRefresh.getTime()}`}
          />
        </Col>
        
        <Col md={6}>
          <h2>Worker</h2>
          <WorkerGrid 
            workers={workers} 
            onMigrateTask={migrateTask}
            tasks={tasks}
            key={`workers-${lastRefresh.getTime()}`}
          />
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col>
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
    </Container>
  );
}

export default App;