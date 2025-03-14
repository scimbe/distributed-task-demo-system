import React from 'react';
import { Table, Badge, ProgressBar } from 'react-bootstrap';
import './TaskList.css';

const TaskList = ({ tasks, onSelectTask, selectedTaskId }) => {
  // Sortieren nach Priorität und dann nach erstelltem Datum
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Höhere Priorität zuerst
    }
    return new Date(b.createdAt) - new Date(a.createdAt); // Neuere zuerst
  });

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

  return (
    <div className="task-list">
      <Table hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Typ</th>
            <th>Status</th>
            <th>Priorität</th>
            <th>Fortschritt</th>
            <th>Worker</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center">Keine Tasks vorhanden</td>
            </tr>
          ) : (
            sortedTasks.map(task => (
              <tr 
                key={task.id} 
                onClick={() => onSelectTask(task)}
                className={selectedTaskId === task.id ? 'selected-task' : ''}
              >
                <td>{task.id.substring(0, 8)}...</td>
                <td>{task.type}</td>
                <td>
                  <Badge bg={getStatusVariant(task.status)}>
                    {task.status}
                  </Badge>
                </td>
                <td>{task.priority}</td>
                <td>
                  <ProgressBar 
                    now={task.progress} 
                    label={`${task.progress}%`} 
                    variant={
                      task.status === 'COMPLETED' ? 'success' : 
                      task.status === 'FAILED' ? 'danger' : 'primary'
                    }
                  />
                </td>
                <td>{task.workerId ? task.workerId.substring(0, 8) + '...' : '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default TaskList;
