import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './SystemVisualizer.css';

const SystemVisualizer = ({ tasks, workers, selectedTask }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  // Status-Farben
  const statusColors = {
    CREATED: '#aed6f1',
    ASSIGNED: '#5dade2',
    RUNNING: '#3498db',
    COMPLETED: '#2ecc71',
    FAILED: '#e74c3c',
    MIGRATING: '#f39c12',
    RECOVERING: '#9b59b6'
  };

  const workerStatusColors = {
    IDLE: '#2ecc71',
    BUSY: '#f39c12',
    OVERLOADED: '#e74c3c',
    FAILING: '#c0392b',
    SHUTDOWN: '#95a5a6'
  };

  useEffect(() => {
    if (!svgRef.current || Object.keys(workers).length === 0) return;

    const width = 800;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    // SVG erstellen
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove(); // Alles löschen

    // Task-Manager in der Mitte
    svg.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', 50)
      .attr('fill', '#34495e')
      .attr('stroke', '#2c3e50')
      .attr('stroke-width', 2);

    svg.append('text')
      .attr('x', centerX)
      .attr('y', centerY)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .text('Task Manager');

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    // Worker-Knoten um den Task-Manager herum platzieren
    const workerArray = Object.values(workers);
    const angleStep = (2 * Math.PI) / workerArray.length;

    workerArray.forEach((worker, index) => {
      const angle = index * angleStep;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // Worker-Knoten
      const workerNode = svg.append('g')
        .attr('class', 'worker-node')
        .attr('transform', `translate(${x}, ${y})`)
        .attr('data-id', worker.id);

      workerNode.append('circle')
        .attr('r', 40)
        .attr('fill', workerStatusColors[worker.status] || '#95a5a6')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 2)
        .on('mouseover', function(event) {
          tooltip
            .style('opacity', 1)
            .html(`
              <div><strong>Worker:</strong> ${worker.id.substring(0, 8)}...</div>
              <div><strong>Status:</strong> ${worker.status}</div>
              <div><strong>Aktueller Task:</strong> ${worker.task || 'Keiner'}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function() {
          tooltip.style('opacity', 0);
        });

      workerNode.append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'white')
        .text(`Worker ${index + 1}`);
    });

    // Verbindungen zum Task-Manager
    workerArray.forEach((worker, index) => {
      const angle = index * angleStep;
      const outerX = centerX + radius * Math.cos(angle);
      const outerY = centerY + radius * Math.sin(angle);
      
      svg.append('line')
        .attr('x1', centerX)
        .attr('y1', centerY)
        .attr('x2', outerX)
        .attr('y2', outerY)
        .attr('stroke', '#95a5a6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
    });

    // Tasks darstellen
    tasks.forEach(task => {
      if (task.workerId && workers[task.workerId]) {
        const workerIndex = workerArray.findIndex(w => w.id === task.workerId);
        if (workerIndex !== -1) {
          const angle = workerIndex * angleStep;
          const workerX = centerX + radius * Math.cos(angle);
          const workerY = centerY + radius * Math.sin(angle);
          
          // Task-Position relativ zum Worker berechnen
          const taskRadius = 15;
          const taskAngleOffset = (Math.random() - 0.5) * 0.5; // Zufällige Positionierung
          const taskDistance = 60 + Math.random() * 20;
          const taskX = workerX + taskDistance * Math.cos(angle + taskAngleOffset);
          const taskY = workerY + taskDistance * Math.sin(angle + taskAngleOffset);
          
          // Task zeichnen
          const taskNode = svg.append('g')
            .attr('class', 'task-node')
            .attr('transform', `translate(${taskX}, ${taskY})`)
            .attr('data-id', task.id);
          
          const isSelected = selectedTask && selectedTask.id === task.id;
          
          taskNode.append('circle')
            .attr('r', isSelected ? taskRadius * 1.3 : taskRadius)
            .attr('fill', statusColors[task.status] || '#95a5a6')
            .attr('stroke', isSelected ? '#f1c40f' : '#2c3e50')
            .attr('stroke-width', isSelected ? 3 : 1)
            .on('mouseover', function(event) {
              tooltip
                .style('opacity', 1)
                .html(`
                  <div><strong>Task:</strong> ${task.id.substring(0, 8)}...</div>
                  <div><strong>Typ:</strong> ${task.type}</div>
                  <div><strong>Status:</strong> ${task.status}</div>
                  <div><strong>Fortschritt:</strong> ${task.progress}%</div>
                `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 20) + 'px');
            })
            .on('mouseout', function() {
              tooltip.style('opacity', 0);
            });
          
          // Verbindung zum Worker
          svg.append('line')
            .attr('x1', workerX)
            .attr('y1', workerY)
            .attr('x2', taskX)
            .attr('y2', taskY)
            .attr('stroke', statusColors[task.status] || '#95a5a6')
            .attr('stroke-width', 1);
        }
      } else if (task.status === 'CREATED') {
        // Nicht zugewiesene Tasks um den Task-Manager anordnen
        const taskAngle = Math.random() * 2 * Math.PI;
        const taskDistance = 70;
        const taskX = centerX + taskDistance * Math.cos(taskAngle);
        const taskY = centerY + taskDistance * Math.sin(taskAngle);
        
        // Task zeichnen
        const taskNode = svg.append('g')
          .attr('class', 'task-node')
          .attr('transform', `translate(${taskX}, ${taskY})`)
          .attr('data-id', task.id);
        
        const isSelected = selectedTask && selectedTask.id === task.id;
        
        taskNode.append('circle')
          .attr('r', isSelected ? 15 * 1.3 : 15)
          .attr('fill', statusColors[task.status] || '#95a5a6')
          .attr('stroke', isSelected ? '#f1c40f' : '#2c3e50')
          .attr('stroke-width', isSelected ? 3 : 1)
          .on('mouseover', function(event) {
            tooltip
              .style('opacity', 1)
              .html(`
                <div><strong>Task:</strong> ${task.id.substring(0, 8)}...</div>
                <div><strong>Typ:</strong> ${task.type}</div>
                <div><strong>Status:</strong> ${task.status}</div>
                <div><strong>Fortschritt:</strong> ${task.progress}%</div>
              `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 20) + 'px');
          })
          .on('mouseout', function() {
            tooltip.style('opacity', 0);
          });
        
        // Verbindung zum Task-Manager
        svg.append('line')
          .attr('x1', centerX)
          .attr('y1', centerY)
          .attr('x2', taskX)
          .attr('y2', taskY)
          .attr('stroke', statusColors[task.status] || '#95a5a6')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3');
      }
    });

    // Legende
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 150}, 20)`);

    // Task-Status-Legende
    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .text('Task-Status:');

    Object.entries(statusColors).forEach(([status, color], i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', 15 + i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color);

      legend.append('text')
        .attr('x', 20)
        .attr('y', 27 + i * 20)
        .text(status);
    });

    // Worker-Status-Legende
    const workerLegend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(20, 20)`);

    workerLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .text('Worker-Status:');

    Object.entries(workerStatusColors).forEach(([status, color], i) => {
      workerLegend.append('rect')
        .attr('x', 0)
        .attr('y', 15 + i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color);

      workerLegend.append('text')
        .attr('x', 20)
        .attr('y', 27 + i * 20)
        .text(status);
    });

  }, [tasks, workers, selectedTask]);

  return (
    <div className="system-visualizer">
      <svg ref={svgRef}></svg>
      <div ref={tooltipRef} className="tooltip"></div>
    </div>
  );
};

export default SystemVisualizer;
