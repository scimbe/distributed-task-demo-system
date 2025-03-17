import React, { useState } from 'react';
import { Card, Badge, Button, Row, Col, ProgressBar, Form, Alert } from 'react-bootstrap';
import './TaskControlCenter.css';

const TaskControlCenter = ({ tasks, workers, onCreateTask, isLoading }) => {
  const [newTaskFormData, setNewTaskFormData] = useState({
    type: 'computation',
    priority: 5,
    data: JSON.stringify({
      operation: 'complex-calculation',
      input: [1, 2, 3, 4, 5],
      iterations: 100
    }, null, 2)
  });
  
  // Task-Statistiken berechnen
  const taskCounts = tasks.reduce((counts, task) => {
    const status = task.status || 'UNKNOWN';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  
  // Höchste Prioritäts-Tasks finden
  const highPriorityTasks = [...tasks]
    .filter(task => task.priority > 7)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  // Task-Formular-Handler
  const handleTaskFormChange = (e) => {
    const { name, value } = e.target;
    setNewTaskFormData(prevData => ({
      ...prevData,
      [name]: name === 'priority' ? parseInt(value, 10) : value
    }));
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

  // Neuen Task erstellen
  const handleSubmit = (e) => {
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
    
    onCreateTask({
      type: newTaskFormData.type,
      priority: newTaskFormData.priority,
      data: taskData
    });
  };

  // Status-Badge-Farbe
  const getStatusVariant = (status) => {
    switch (status) {
      case 'CREATED': return 'info';
      case 'ASSIGNED': case 'RUNNING': return 'primary';
      case 'COMPLETED': return 'success';
      case 'FAILED': return 'danger';
      case 'MIGRATING': case 'RECOVERING': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div className="task-control-center">
      <Card className="dashboard-card">
        <Card.Header as="h5">Task Control Center</Card.Header>
        <Card.Body>
          <Row>
            <Col md={7}>
              <div className="dashboard-stats mb-4">
                <h6>System-Übersicht</h6>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{tasks.length}</div>
                    <div className="stat-label">Gesamt</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{taskCounts.RUNNING || 0}</div>
                    <div className="stat-label">Aktiv</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{taskCounts.COMPLETED || 0}</div>
                    <div className="stat-label">Abgeschlossen</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{workers.filter(w => w.status === 'IDLE').length}</div>
                    <div className="stat-label">Freie Worker</div>
                  </div>
                </div>
              </div>

              <div className="high-priority-tasks">
                <h6>Hochprioritäre Tasks</h6>
                {highPriorityTasks.length > 0 ? (
                  highPriorityTasks.map(task => (
                    <div key={task.id} className="priority-task-item">
                      <div className="task-info">
                        <span className="task-id">{task.id.substring(0, 8)}...</span>
                        <Badge bg={getStatusVariant(task.status)}>{task.status}</Badge>
                      </div>
                      <ProgressBar 
                        now={task.progress} 
                        variant={task.status === 'COMPLETED' ? 'success' : 'primary'} 
                        animated={task.status === 'RUNNING'} 
                      />
                    </div>
                  ))
                ) : (
                  <Alert variant="light">Keine hochprioritären Tasks vorhanden</Alert>
                )}
              </div>
            </Col>
            
            <Col md={5}>
              <div className="task-creator">
                <h6>Neuen Task erstellen</h6>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Task-Typ</Form.Label>
                    <div className="task-type-selector">
                      <div 
                        className={`type-option ${newTaskFormData.type === 'computation' ? 'selected' : ''}`}
                        onClick={() => handleTaskTypeChange({ target: { value: 'computation' } })}
                      >
                        <i className="bi bi-cpu"></i>
                        <span>Berechnung</span>
                      </div>
                      <div 
                        className={`type-option ${newTaskFormData.type === 'io' ? 'selected' : ''}`}
                        onClick={() => handleTaskTypeChange({ target: { value: 'io' } })}
                      >
                        <i className="bi bi-hdd"></i>
                        <span>I/O</span>
                      </div>
                      <div 
                        className={`type-option ${newTaskFormData.type === 'network' ? 'selected' : ''}`}
                        onClick={() => handleTaskTypeChange({ target: { value: 'network' } })}
                      >
                        <i className="bi bi-globe"></i>
                        <span>Netzwerk</span>
                      </div>
                    </div>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Priorität: {newTaskFormData.priority}</Form.Label>
                    <Form.Range 
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
                      rows={5} 
                      value={newTaskFormData.data}
                      onChange={handleTaskFormChange}
                      className="code-textarea"
                    />
                  </Form.Group>
                  
                  <Button 
                    variant="primary" 
                    type="submit" 
                    className="w-100"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Task wird erstellt...' : 'Task erstellen'}
                  </Button>
                </Form>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default TaskControlCenter;