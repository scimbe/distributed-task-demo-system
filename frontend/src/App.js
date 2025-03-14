import React, { useState, useEffect } from 'react';
import './App.css';
import TaskList from './components/TaskList';
import WorkerGrid from './components/WorkerGrid';
import TaskDetail from './components/TaskDetail';
import SystemVisualizer from './components/SystemVisualizer';
import { Container, Row, Col, Button, Form } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [events, setEvents] = useState([]);
  const [newTaskFormData, setNewTaskFormData] = useState({
    type: 'computation',
    priority: 1,
    data: ''
  });

  // WebSocket für Echtzeit-Updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    
    ws.onopen = () => {
      console.log('WebSocket verbunden');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'task_update':
          updateTask(data.content);
          addEvent(`Task ${data.content.id} aktualisiert: ${data.content.status}`);
          break;
        case 'worker_update':
          updateWorker(data.content);
          break;
        case 'task_checkpoint':
          addEvent(`Checkpoint für Task ${data.taskId}: Progress ${data.content.progress}%`);
          break;
        case 'task_migration':
          addEvent(`Task ${data.taskId} migriert von Worker ${data.content.fromWorker} zu ${data.content.toWorker}`);
          break;
        default:
          console.log('Unbekannter Ereignistyp:', data.type);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket Fehler:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket Verbindung geschlossen');
    };
    
    return () => {
      ws.close();
    };
  }, []);

  // Initialen Systemzustand laden
  useEffect(() => {
    // Tasks laden
    fetch('/api/tasks')
      .then(response => response.json())
      .then(data => {
        setTasks(data);
      })
      .catch(error => console.error('Fehler beim Laden der Tasks:', error));
      
    // Worker-Status laden
    fetch('/api/workers')
      .then(response => response.json())
      .then(data => {
        const workersMap = {};
        data.forEach(worker => {
          workersMap[worker.id] = worker;
        });
        setWorkers(workersMap);
      })
      .catch(error => console.error('Fehler beim Laden der Worker:', error));
  }, []);

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
    setWorkers(prevWorkers => ({
      ...prevWorkers,
      [workerData.id]: workerData
    }));
  };

  // Event hinzufügen
  const addEvent = (message) => {
    const timestamp = new Date().toISOString();
    setEvents(prevEvents => [
      { id: Date.now(), timestamp, message },
      ...prevEvents.slice(0, 99) // Maximal 100 Ereignisse speichern
    ]);
  };

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
    
    let taskData;
    try {
      taskData = newTaskFormData.data.trim() 
        ? JSON.parse(newTaskFormData.data) 
        : {};
    } catch (error) {
      alert('Ungültiges JSON-Format für Task-Daten');
      return;
    }
    
    const newTask = {
      type: newTaskFormData.type,
      priority: newTaskFormData.priority,
      data: taskData
    };
    
    fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newTask)
    })
      .then(response => response.json())
      .then(data => {
        addEvent(`Neuer Task erstellt: ${data.id}`);
        setNewTaskFormData({
          type: 'computation',
          priority: 1,
          data: ''
        });
      })
      .catch(error => console.error('Fehler beim Erstellen des Tasks:', error));
  };

  // Task für Visualisierung auswählen
  const selectTask = (task) => {
    setSelectedTask(task);
  };

  // Task migrieren
  const migrateTask = (taskId, targetWorkerId) => {
    fetch(`/api/tasks/${taskId}/migrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workerId: targetWorkerId })
    })
      .then(response => response.json())
      .then(data => {
        addEvent(`Migration von Task ${taskId} zu Worker ${targetWorkerId} initiiert`);
      })
      .catch(error => console.error('Fehler bei der Task-Migration:', error));
  };

  return (
    <Container fluid className="app-container">
      <h1 className="text-center my-4">Verteiltes Task-System Demo</h1>
      
      <Row>
        <Col md={8}>
          <div className="visualizer-container">
            <h2>System-Visualisierung</h2>
            <SystemVisualizer 
              tasks={tasks} 
              workers={workers} 
              selectedTask={selectedTask}
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
                  onChange={handleTaskFormChange}
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
                  placeholder='{"key": "value"}'
                />
              </Form.Group>
              
              <Button variant="primary" type="submit">
                Task erstellen
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
          />
        </Col>
        
        <Col md={6}>
          <h2>Worker</h2>
          <WorkerGrid 
            workers={Object.values(workers)} 
            onMigrateTask={migrateTask}
            tasks={tasks}
          />
        </Col>
      </Row>
      
      <Row className="mt-4">
        <Col>
          <h2>System-Ereignisse</h2>
          <div className="events-container">
            {events.map(event => (
              <div key={event.id} className="event-item">
                <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                <span className="event-message">{event.message}</span>
              </div>
            ))}
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
