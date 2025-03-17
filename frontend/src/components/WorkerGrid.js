import React, { useState } from 'react';
import { Row, Col, Card, Badge, Button, Modal, Form, ListGroup } from 'react-bootstrap';
import './WorkerGrid.css';

const WorkerGrid = ({ workers, onMigrateTask, tasks }) => {
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedTask, setSelectedTask] = useState('');
  const [targetWorker, setTargetWorker] = useState('');

  // Status-Farbe
  const getStatusColor = (status) => {
    switch (status) {
      case 'IDLE':
        return '#2ecc71';
      case 'BUSY':
        return '#f39c12';
      case 'OVERLOADED':
        return '#e74c3c';
      case 'FAILING':
        return '#c0392b';
      case 'SHUTDOWN':
        return '#95a5a6';
      default:
        return '#bdc3c7';
    }
  };

  // Öffnen des Migrations-Dialogs
  const openMigrateDialog = (worker) => {
    setSelectedWorker(worker);
    
    // Finde den aktuellen Task
    const currentTask = tasks.find(task => (task.worker_id === worker.id || task.workerId === worker.id));
    if (currentTask) {
      setSelectedTask(currentTask.id);
    } else {
      setSelectedTask('');
    }
    
    setShowMigrateModal(true);
  };

  // Task migrieren
  const handleMigrateTask = () => {
    if (selectedTask && targetWorker) {
      onMigrateTask(selectedTask, targetWorker);
      setShowMigrateModal(false);
    }
  };

  // Liste der verfügbaren Tasks für Migration
  const getAvailableTasks = () => {
    if (!selectedWorker) return [];
    return tasks.filter(task => 
      (task.worker_id === selectedWorker.id || task.workerId === selectedWorker.id) && 
      ['RUNNING', 'ASSIGNED'].includes(task.status)
    );
  };

  // Liste der Worker, die als Ziel dienen können (außer dem ausgewählten)
  const getAvailableTargetWorkers = () => {
    if (!selectedWorker) return [];
    return workers.filter(worker => 
      worker.id !== selectedWorker.id && 
      worker.status !== 'SHUTDOWN' && 
      worker.status !== 'FAILING'
    );
  };

  // Filtere Tasks für jeden Worker
  const getWorkerTasks = (workerId) => {
    return tasks.filter(task => 
      (task.worker_id === workerId || task.workerId === workerId) && 
      task.status !== 'COMPLETED' && 
      task.status !== 'FAILED'
    );
  };

  // Task-Status-Badge
  const renderTaskStatusBadge = (status) => {
    let variant;
    switch (status) {
      case 'RUNNING':
        variant = 'primary';
        break;
      case 'ASSIGNED':
        variant = 'info';
        break;
      case 'MIGRATING':
        variant = 'warning';
        break;
      case 'RECOVERING':
        variant = 'warning';
        break;
      case 'COMPLETED':
        variant = 'success';
        break;
      case 'FAILED':
        variant = 'danger';
        break;
      default:
        variant = 'secondary';
    }
    return <Badge bg={variant}>{status}</Badge>;
  };

  return (
    <div className="worker-grid">
      <Row>
        {workers.length === 0 ? (
          <Col>
            <p>Keine Worker verfügbar</p>
          </Col>
        ) : (
          workers.map(worker => {
            const workerTasks = getWorkerTasks(worker.id);
            
            return (
              <Col md={6} lg={4} key={worker.id} className="mb-3">
                <Card 
                  className="worker-card h-100"
                  style={{ borderLeft: `5px solid ${getStatusColor(worker.status)}` }}
                >
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <div>
                      <h5 className="mb-0">Worker {worker.id.replace('worker-', '')}</h5>
                    </div>
                    <Badge 
                      bg={
                        worker.status === 'IDLE' ? 'success' :
                        worker.status === 'BUSY' ? 'warning' :
                        worker.status === 'OVERLOADED' ? 'danger' :
                        worker.status === 'FAILING' ? 'danger' :
                        'secondary'
                      }
                    >
                      {worker.status}
                    </Badge>
                  </Card.Header>
                  
                  <Card.Body>
                    <div className="mb-3">
                      <strong>Aktive Tasks:</strong> {workerTasks.length}
                    </div>
                    
                    {workerTasks.length > 0 ? (
                      <ListGroup className="mb-3">
                        {workerTasks.map(task => (
                          <ListGroup.Item key={task.id} className="d-flex justify-content-between align-items-center">
                            <div>
                              <small>{task.id.substring(0, 8)}...</small>
                              <div className="progress mt-1" style={{ height: '8px' }}>
                                <div 
                                  className={`progress-bar bg-${task.status === 'FAILED' ? 'danger' : 'primary'}`} 
                                  role="progressbar" 
                                  style={{ width: `${task.progress}%` }} 
                                  aria-valuenow={task.progress} 
                                  aria-valuemin="0" 
                                  aria-valuemax="100"
                                ></div>
                              </div>
                            </div>
                            {renderTaskStatusBadge(task.status)}
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    ) : (
                      <div className="text-muted mb-3">Keine aktiven Tasks</div>
                    )}
                    
                    <div className="last-update">
                      <small className="text-muted">
                        Letztes Update: {worker.lastSeen ? new Date(worker.lastSeen).toLocaleTimeString() : 'N/A'}
                      </small>
                    </div>
                    
                    <div className="mt-3">
                      {worker.status === 'BUSY' && (
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => openMigrateDialog(worker)}
                        >
                          Task migrieren
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })
        )}
      </Row>

      {/* Migrations-Dialog */}
      <Modal
        show={showMigrateModal}
        onHide={() => setShowMigrateModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Task migrieren</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Task</Form.Label>
              <Form.Select 
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
              >
                <option value="">Wähle einen Task</option>
                {getAvailableTasks().map(task => (
                  <option key={task.id} value={task.id}>
                    {task.id.substring(0, 8)}... ({task.type})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Ziel-Worker</Form.Label>
              <Form.Select 
                value={targetWorker}
                onChange={(e) => setTargetWorker(e.target.value)}
              >
                <option value="">Wähle einen Ziel-Worker</option>
                {getAvailableTargetWorkers().map(worker => (
                  <option key={worker.id} value={worker.id}>
                    Worker {worker.id.replace('worker-', '')} ({worker.status})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMigrateModal(false)}>
            Abbrechen
          </Button>
          <Button 
            variant="primary" 
            onClick={handleMigrateTask}
            disabled={!selectedTask || !targetWorker}
          >
            Task migrieren
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WorkerGrid;