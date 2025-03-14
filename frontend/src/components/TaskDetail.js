import React from 'react';
import { Card, Badge, ProgressBar, Row, Col } from 'react-bootstrap';
import './TaskDetail.css';

const TaskDetail = ({ task }) => {
  // Status-Farbe
  const getStatusVariant = (status) => {
    switch (status) {
      case 'CREATED':
        return 'info';
      case 'ASSIGNED':
        return 'primary';
      case 'RUNNING':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'danger';
      case 'MIGRATING':
        return 'warning';
      case 'RECOVERING':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  // Formatieren des Datums
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // JSON formatieren
  const formatJSON = (obj) => {
    return JSON.stringify(obj, null, 2);
  };

  if (!task) {
    return <div>Kein Task ausgewählt</div>;
  }

  return (
    <Card className="task-detail-card">
      <Card.Header>
        <h5>Task: {task.id}</h5>
        <Badge bg={getStatusVariant(task.status)}>
          {task.status}
        </Badge>
      </Card.Header>
      <Card.Body>
        <Row>
          <Col md={6}>
            <p><strong>Typ:</strong> {task.type}</p>
            <p><strong>Priorität:</strong> {task.priority}</p>
            <p><strong>Erstellt:</strong> {formatDate(task.createdAt)}</p>
            <p><strong>Aktualisiert:</strong> {formatDate(task.updatedAt)}</p>
            <p><strong>Worker:</strong> {task.workerId || 'Nicht zugewiesen'}</p>
          </Col>
          <Col md={6}>
            <p><strong>Fortschritt:</strong></p>
            <ProgressBar 
              now={task.progress} 
              label={`${task.progress}%`} 
              variant={
                task.status === 'COMPLETED' ? 'success' : 
                task.status === 'FAILED' ? 'danger' : 'primary'
              }
              className="mb-3"
            />
          </Col>
        </Row>
        
        <h6 className="mt-4">Task-Daten:</h6>
        <pre className="data-json">{formatJSON(task.data || {})}</pre>
        
        {task.checkpointData && (
          <>
            <h6 className="mt-4">Checkpoint-Daten:</h6>
            <pre className="data-json">{formatJSON(task.checkpointData || {})}</pre>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default TaskDetail;
