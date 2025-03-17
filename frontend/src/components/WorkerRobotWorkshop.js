import React, { useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, ListGroup, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import './WorkerRobotWorkshop.css';

const WorkerRobotWorkshop = ({ workers, tasks, onMigrateTask }) => {
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [showWorkerDetails, setShowWorkerDetails] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedTask, setSelectedTask] = useState('');
  const [targetWorker, setTargetWorker] = useState('');

  // Worker-Status-Farbe
  const getStatusColor = (status) => {
    switch (status) {
      case 'IDLE': return '#2ecc71';      // Grün
      case 'BUSY': return '#f39c12';      // Orange
      case 'OVERLOADED': return '#e74c3c'; // Rot
      case 'FAILING': return '#c0392b';    // Dunkelrot
      case 'SHUTDOWN': return '#95a5a6';   // Grau
      default: return '#bdc3c7';           // Hellgrau
    }
  };

  // Status-Badge-Variante
  const getStatusVariant = (status) => {
    switch (status) {
      case 'IDLE': return 'success';
      case 'BUSY': return 'warning';
      case 'OVERLOADED': return 'danger';
      case 'FAILING': return 'danger';
      case 'SHUTDOWN': return 'secondary';
      default: return 'light';
    }
  };

  // Task-Status-Badge
  const getTaskStatusVariant = (status) => {
    switch (status) {
      case 'CREATED': return 'info';
      case 'ASSIGNED': case 'RUNNING': return 'primary';
      case 'COMPLETED': return 'success';
      case 'FAILED': return 'danger';
      case 'MIGRATING': case 'RECOVERING': return 'warning';
      default: return 'secondary';
    }
  };

  // Worker-Auslastung berechnen
  const calculateWorkerLoad = (workerId) => {
    const workerTasks = tasks.filter(task => 
      (task.worker_id === workerId || task.workerId === workerId) && 
      ['RUNNING', 'ASSIGNED'].includes(task.status)
    );
    
    if (workerTasks.length === 0) return 0;
    
    // Berechne durchschnittlichen Fortschritt als Auslastungsindikator
    const totalProgress = workerTasks.reduce((sum, task) => sum + task.progress, 0);
    return Math.round(totalProgress / workerTasks.length);
  };

  // Öffnen des Migrations-Dialogs
  const openMigrateDialog = (worker) => {
    setSelectedWorker(worker);
    
    // Finde den aktuellen Task
    const currentTask = tasks.find(task => 
      (task.worker_id === worker.id || task.workerId === worker.id) && 
      ['RUNNING', 'ASSIGNED'].includes(task.status)
    );
    
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

  // Worker-Details anzeigen/ausblenden
  const toggleWorkerDetails = (workerId) => {
    if (showWorkerDetails === workerId) {
      setShowWorkerDetails(null);
    } else {
      setShowWorkerDetails(workerId);
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

  // Task-Liste für einen Worker
  const getWorkerTasks = (workerId) => {
    return tasks.filter(task => 
      (task.worker_id === workerId || task.workerId === workerId) && 
      task.status !== 'COMPLETED' && 
      task.status !== 'FAILED'
    );
  };

  // Roboter-Typ basierend auf Worker-ID
  const getRobotType = (workerId) => {
    // Extrahiere Nummer aus worker-X
    const workerNum = parseInt(workerId.replace('worker-', ''), 10);
    return (workerNum % 3) + 1; // 1, 2 oder 3 für verschiedene Roboter-Designs
  };

  return (
    <div className="worker-robot-workshop">
      <Card className="workshop-card">
        <Card.Header as="h5">Worker-Roboter Werkstatt</Card.Header>
        <Card.Body>
          <Row className="worker-grid">
            {workers.length === 0 ? (
              <Col>
                <div className="text-center py-5">
                  <i className="bi bi-robot robot-icon-large text-muted"></i>
                  <p className="mt-3">Keine Worker-Roboter verfügbar</p>
                </div>
              </Col>
            ) : (
              workers.map(worker => {
                const workerLoad = calculateWorkerLoad(worker.id);
                const workerTasks = getWorkerTasks(worker.id);
                const robotType = getRobotType(worker.id);
                
                return (
                  <Col key={worker.id} xs={12} sm={6} lg={4} className="mb-4">
                    <div 
                      className={`robot-card ${worker.status.toLowerCase()}`}
                      style={{ borderColor: getStatusColor(worker.status) }}
                    >
                      <div className="robot-header">
                        <h6>{worker.id.replace('worker-', 'Worker ')}</h6>
                        <Badge bg={getStatusVariant(worker.status)}>{worker.status}</Badge>
                      </div>
                      
                      <div className="robot-body">
                        <div className="robot-avatar">
                          <div className={`robot robot-${robotType} status-${worker.status.toLowerCase()}`}>
                            <div className="robot-head">
                              <div className="robot-eye robot-eye-left"></div>
                              <div className="robot-eye robot-eye-right"></div>
                              <div className="robot-mouth"></div>
                            </div>
                            <div className="robot-body">
                              <div className="robot-panel">
                                <div className={`robot-light ${worker.status === 'IDLE' ? 'light-green' : worker.status === 'BUSY' ? 'light-yellow' : 'light-red'}`}></div>
                              </div>
                            </div>
                            <div className="robot-arms">
                              <div className="robot-arm robot-arm-left"></div>
                              <div className="robot-arm robot-arm-right"></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="robot-stats">
                          <div className="load-indicator">
                            <span>Auslastung</span>
                            <div className="load-meter">
                              <div 
                                className="load-level" 
                                style={{ 
                                  width: `${workerLoad}%`,
                                  backgroundColor: 
                                    workerLoad < 30 ? '#2ecc71' : 
                                    workerLoad < 70 ? '#f39c12' : 
                                    '#e74c3c'
                                }}
                              ></div>
                            </div>
                            <span className="load-percentage">{workerLoad}%</span>
                          </div>
                          
                          <div className="active-tasks">
                            <span>Aktive Tasks: {workerTasks.length}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="robot-actions">
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          onClick={() => toggleWorkerDetails(worker.id)}
                          className="me-2"
                        >
                          {showWorkerDetails === worker.id ? 'Details ausblenden' : 'Details anzeigen'}
                        </Button>
                        
                        {worker.status === 'BUSY' && (
                          <Button 
                            variant="outline-warning" 
                            size="sm"
                            onClick={() => openMigrateDialog(worker)}
                          >
                            Task migrieren
                          </Button>
                        )}
                      </div>
                      
                      {showWorkerDetails === worker.id && (
                        <div className="worker-details">
                          <h6>Tasks</h6>
                          {workerTasks.length > 0 ? (
                            <ListGroup className="task-list">
                              {workerTasks.map(task => (
                                <ListGroup.Item key={task.id} className="task-item">
                                  <div className="task-header">
                                    <span className="task-id">{task.id.substring(0, 8)}...</span>
                                    <Badge bg={getTaskStatusVariant(task.status)}>{task.status}</Badge>
                                  </div>
                                  <div className="task-progress">
                                    <div className="progress">
                                      <div 
                                        className={`progress-bar progress-bar-striped ${task.status === 'RUNNING' ? 'progress-bar-animated' : ''}`}
                                        role="progressbar" 
                                        style={{ 
                                          width: `${task.progress}%`,
                                          backgroundColor: 
                                            task.status === 'COMPLETED' ? '#2ecc71' : 
                                            task.status === 'FAILED' ? '#e74c3c' : 
                                            '#4a90e2'
                                        }} 
                                        aria-valuenow={task.progress} 
                                        aria-valuemin="0" 
                                        aria-valuemax="100"
                                      >
                                        {task.progress}%
                                      </div>
                                    </div>
                                  </div>
                                  <div className="task-details">
                                    <small>Typ: {task.type}</small>
                                    <small>Priorität: {task.priority}</small>
                                  </div>
                                </ListGroup.Item>
                              ))}
                            </ListGroup>
                          ) : (
                            <p className="text-muted">Keine aktiven Tasks</p>
                          )}
                          
                          <div className="worker-status-info">
                            <div>
                              <small>Status: <Badge bg={getStatusVariant(worker.status)}>{worker.status}</Badge></small>
                            </div>
                            <div>
                              <small>Letztes Update: {worker.lastSeen ? new Date(worker.lastSeen).toLocaleTimeString() : 'N/A'}</small>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Col>
                );
              })
            )}
          </Row>
        </Card.Body>
      </Card>

      {/* Migrations-Dialog */}
      <Modal
        show={showMigrateModal}
        onHide={() => setShowMigrateModal(false)}
        centered
        className="migration-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Task migrieren</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="migration-diagram">
            <div className="from-worker">
              <div className={`mini-robot status-busy`}>
                <div className="robot-head">
                  <div className="robot-eye robot-eye-left"></div>
                  <div className="robot-eye robot-eye-right"></div>
                </div>
              </div>
              <div className="worker-label">Quell-Worker</div>
            </div>
            
            <div className="migration-arrow">
              <i className="bi bi-arrow-right"></i>
            </div>
            
            <div className="to-worker">
              <div className={`mini-robot status-idle`}>
                <div className="robot-head">
                  <div className="robot-eye robot-eye-left"></div>
                  <div className="robot-eye robot-eye-right"></div>
                </div>
              </div>
              <div className="worker-label">Ziel-Worker</div>
            </div>
          </div>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Task auswählen</Form.Label>
              <Form.Select 
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
              >
                <option value="">Wähle einen Task</option>
                {getAvailableTasks().map(task => (
                  <option key={task.id} value={task.id}>
                    {task.id.substring(0, 8)}... ({task.type}, Priorität: {task.priority})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Ziel-Worker auswählen</Form.Label>
              <div className="worker-selection">
                {getAvailableTargetWorkers().map(worker => (
                  <div 
                    key={worker.id}
                    className={`worker-option ${targetWorker === worker.id ? 'selected' : ''}`}
                    onClick={() => setTargetWorker(worker.id)}
                  >
                    <div className={`mini-robot status-${worker.status.toLowerCase()}`}>
                      <div className="robot-head">
                        <div className="robot-eye robot-eye-left"></div>
                        <div className="robot-eye robot-eye-right"></div>
                      </div>
                    </div>
                    <div className="worker-option-label">
                      {worker.id.replace('worker-', 'Worker ')}
                      <Badge bg={getStatusVariant(worker.status)} className="ms-1">{worker.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Form.Group>
          </Form>
          
          <div className="migration-info">
            <i className="bi bi-info-circle me-2"></i>
            <small>
              Bei der Migration wird der Task pausiert, sein aktueller Zustand gespeichert, 
              und dann auf dem Ziel-Worker fortgesetzt. Dies kann einige Sekunden dauern.
            </small>
          </div>
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

export default WorkerRobotWorkshop;