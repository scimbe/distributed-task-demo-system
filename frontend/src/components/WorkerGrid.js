import React, { useState } from 'react';
import { Row, Col, Card, Badge, Button, Modal, Form } from 'react-bootstrap';
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
    const currentTask = tasks.find(task => task.workerId === worker.id);
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
      task.workerId === selectedWorker.id && 
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

  return (
    <div className="worker-grid">
      <Row>
        {workers.length === 0 ? (
          <Col>
            <p>Keine Worker verfügbar</p>
          </Col>
        ) : (
          workers.map(worker => (
            <Col md={6} lg={4} key={worker.id} className="mb-3">
              <Card 
                className="worker-card h-100"
                style={{ borderLeft: `5px solid ${getStatusColor(worker.status)}` }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h5 className="mb-1">Worker {worker.id.substring(0, 8)}...</h5>
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
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <p className="mb-1">
                      <strong>Aktueller Task:</strong><br/>
                      {worker.task ? worker.task.substring(0, 12) + '...' : 'Kein aktiver Task'}
                    </p>
                    
                    <p className="mb-1">
                      <strong>Letztes Update:</strong><br/>
                      {worker.time ? new Date(worker.time).toLocaleTimeString() : '-'}
                    </p>
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
          ))
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
                    {worker.id.substring(0, 8)}... ({worker.status})
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
