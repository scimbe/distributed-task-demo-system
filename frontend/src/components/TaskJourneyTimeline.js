import React, { useState } from 'react';
import { Card, Badge, ListGroup, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import './TaskJourneyTimeline.css';

const TaskJourneyTimeline = ({ tasks, onSelectTask }) => {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeTab, setActiveTab] = useState('running');
  
  // Sortiere Tasks nach Priorität und dann nach Update-Zeitpunkt
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    
    const dateA = a.updated_at ? new Date(a.updated_at) : new Date(0);
    const dateB = b.updated_at ? new Date(b.updated_at) : new Date(0);
    
    return dateB - dateA;
  });
  
  // Tasks nach Tab filtern
  const filteredTasks = sortedTasks.filter(task => {
    switch (activeTab) {
      case 'running':
        return ['RUNNING', 'ASSIGNED', 'MIGRATING', 'RECOVERING'].includes(task.status);
      case 'completed':
        return task.status === 'COMPLETED';
      case 'created':
        return task.status === 'CREATED';
      case 'failed':
        return task.status === 'FAILED';
      case 'all':
      default:
        return true;
    }
  });
  
  // Task-Status-Info abrufen
  const getStatusInfo = (status) => {
    switch (status) {
      case 'CREATED':
        return {
          color: '#aed6f1',
          variant: 'info',
          icon: 'bi-plus-circle',
          description: 'Der Task wurde erstellt und wartet auf Zuweisung zu einem Worker.'
        };
      case 'ASSIGNED':
        return {
          color: '#5dade2',
          variant: 'primary',
          icon: 'bi-arrow-right-circle',
          description: 'Der Task wurde einem Worker zugewiesen, aber die Ausführung hat noch nicht begonnen.'
        };
      case 'RUNNING':
        return {
          color: '#3498db',
          variant: 'primary',
          icon: 'bi-play-circle',
          description: 'Der Task wird aktuell von einem Worker ausgeführt.'
        };
      case 'COMPLETED':
        return {
          color: '#2ecc71',
          variant: 'success',
          icon: 'bi-check-circle',
          description: 'Der Task wurde erfolgreich abgeschlossen.'
        };
      case 'FAILED':
        return {
          color: '#e74c3c',
          variant: 'danger',
          icon: 'bi-x-circle',
          description: 'Bei der Ausführung des Tasks ist ein Fehler aufgetreten.'
        };
      case 'MIGRATING':
        return {
          color: '#f39c12',
          variant: 'warning',
          icon: 'bi-arrow-repeat',
          description: 'Der Task wird von einem Worker zu einem anderen migriert.'
        };
      case 'RECOVERING':
        return {
          color: '#9b59b6',
          variant: 'warning',
          icon: 'bi-arrow-counterclockwise',
          description: 'Der Task wird nach einem Worker-Ausfall wiederhergestellt.'
        };
      default:
        return {
          color: '#95a5a6',
          variant: 'secondary',
          icon: 'bi-question-circle',
          description: 'Unbekannter Status'
        };
    }
  };
  
  // Task auswählen
  const handleTaskSelect = (task) => {
    setSelectedTaskId(task.id);
    if (onSelectTask) {
      onSelectTask(task);
    }
  };
  
  // Zeitformat für die Timeline
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return '';
    }
  };
  
  // Task-Journey-Phase bestimmen
  const getTaskPhase = (task) => {
    if (task.status === 'CREATED') return 1;
    if (task.status === 'ASSIGNED') return 2;
    if (['RUNNING', 'MIGRATING', 'RECOVERING'].includes(task.status)) return 3;
    if (['COMPLETED', 'FAILED'].includes(task.status)) return 4;
    return 0;
  };
  
  // Tab-Badge-Count berechnen
  const getTabCounts = () => {
    return {
      all: tasks.length,
      running: tasks.filter(task => ['RUNNING', 'ASSIGNED', 'MIGRATING', 'RECOVERING'].includes(task.status)).length,
      completed: tasks.filter(task => task.status === 'COMPLETED').length,
      created: tasks.filter(task => task.status === 'CREATED').length,
      failed: tasks.filter(task => task.status === 'FAILED').length
    };
  };
  
  const tabCounts = getTabCounts();
  
  return (
    <div className="task-journey-timeline">
      <Card className="timeline-card">
        <Card.Header as="h5">Task Journey Timeline</Card.Header>
        <Card.Body>
          <div className="timeline-tabs">
            <Button
              variant={activeTab === 'all' ? 'primary' : 'outline-primary'}
              className="timeline-tab"
              onClick={() => setActiveTab('all')}
            >
              Alle <Badge bg="secondary">{tabCounts.all}</Badge>
            </Button>
            <Button
              variant={activeTab === 'running' ? 'primary' : 'outline-primary'}
              className="timeline-tab"
              onClick={() => setActiveTab('running')}
            >
              Aktiv <Badge bg="primary">{tabCounts.running}</Badge>
            </Button>
            <Button
              variant={activeTab === 'created' ? 'primary' : 'outline-primary'}
              className="timeline-tab"
              onClick={() => setActiveTab('created')}
            >
              Erstellt <Badge bg="info">{tabCounts.created}</Badge>
            </Button>
            <Button
              variant={activeTab === 'completed' ? 'primary' : 'outline-primary'}
              className="timeline-tab"
              onClick={() => setActiveTab('completed')}
            >
              Fertig <Badge bg="success">{tabCounts.completed}</Badge>
            </Button>
            <Button
              variant={activeTab === 'failed' ? 'primary' : 'outline-primary'}
              className="timeline-tab"
              onClick={() => setActiveTab('failed')}
            >
              Fehler <Badge bg="danger">{tabCounts.failed}</Badge>
            </Button>
          </div>
          
          <div className="timeline-legend">
            <div className="legend-item">
              <div className="legend-marker created"></div>
              <span>Erstellt</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker assigned"></div>
              <span>Zugewiesen</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker running"></div>
              <span>Ausführung</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker completed"></div>
              <span>Abschluss</span>
            </div>
          </div>
          
          {filteredTasks.length === 0 ? (
            <div className="no-tasks-message">
              <i className="bi bi-clipboard-x"></i>
              <p>Keine Tasks in dieser Kategorie</p>
            </div>
          ) : (
            <ListGroup className="tasks-list">
              {filteredTasks.map(task => {
                const statusInfo = getStatusInfo(task.status);
                const taskPhase = getTaskPhase(task);
                
                return (
                  <ListGroup.Item 
                    key={task.id}
                    className={`task-item ${selectedTaskId === task.id ? 'selected' : ''}`}
                    onClick={() => handleTaskSelect(task)}
                  >
                    <div className="task-header">
                      <div className="task-title">
                        <i className={`bi ${statusInfo.icon} status-icon`} style={{ color: statusInfo.color }}></i>
                        <div className="task-info">
                          <h6 className="task-id">{task.id.substring(0, 8)}...</h6>
                          <small className="task-type">{task.type}, Priorität: {task.priority}</small>
                        </div>
                      </div>
                      <Badge bg={statusInfo.variant}>{task.status}</Badge>
                    </div>
                    
                    <div className="task-journey">
                      <div className={`journey-step ${taskPhase >= 1 ? 'active' : ''}`}>
                        <div className="step-indicator"></div>
                        <div className="step-label">Erstellt</div>
                        <div className="step-time">{formatTime(task.created_at)}</div>
                      </div>
                      <div className={`journey-connector ${taskPhase >= 2 ? 'active' : ''}`}></div>
                      <div className={`journey-step ${taskPhase >= 2 ? 'active' : ''}`}>
                        <div className="step-indicator"></div>
                        <div className="step-label">Zugewiesen</div>
                        <div className="step-time">{task.worker_id ? formatTime(task.updated_at) : ''}</div>
                      </div>
                      <div className={`journey-connector ${taskPhase >= 3 ? 'active' : ''}`}></div>
                      <div className={`journey-step ${taskPhase >= 3 ? 'active' : ''}`}>
                        <div className="step-indicator"></div>
                        <div className="step-label">Ausführung</div>
                        <div className="step-progress">{task.progress}%</div>
                      </div>
                      <div className={`journey-connector ${taskPhase >= 4 ? 'active' : ''}`}></div>
                      <div className={`journey-step ${taskPhase >= 4 ? 'active' : ''} ${task.status === 'FAILED' ? 'failed' : ''}`}>
                        <div className="step-indicator"></div>
                        <div className="step-label">{task.status === 'FAILED' ? 'Fehler' : 'Abschluss'}</div>
                        <div className="step-time">
                          {(task.status === 'COMPLETED' || task.status === 'FAILED') ? 
                            formatTime(task.updated_at) : ''}
                        </div>
                      </div>
                    </div>
                    
                    <div className="task-details">
                      <div className="worker-info">
                        {task.worker_id ? (
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Worker, der diesen Task ausführt</Tooltip>}
                          >
                            <span>
                              <i className="bi bi-robot"></i> {task.worker_id}
                            </span>
                          </OverlayTrigger>
                        ) : (
                          <span className="text-muted">Nicht zugewiesen</span>
                        )}
                      </div>
                      <div className="task-timestamp">
                        <OverlayTrigger
                          placement="top"
                          overlay={<Tooltip>Letzte Aktualisierung</Tooltip>}
                        >
                          <span>
                            <i className="bi bi-clock"></i> {formatTime(task.updated_at)}
                          </span>
                        </OverlayTrigger>
                      </div>
                    </div>
                    
                    <div className="status-description">
                      <i className="bi bi-info-circle"></i>
                      <span>{statusInfo.description}</span>
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default TaskJourneyTimeline;