import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import './SystemVisualizer.css';

const SystemVisualizer = ({ tasks, workers, selectedTask }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  // Status-Farben
  const statusColors = {
    CREATED: '#aed6f1',    // Hellblau
    ASSIGNED: '#5dade2',   // Mittelblau
    RUNNING: '#3498db',    // Blau
    COMPLETED: '#2ecc71',  // Grün
    FAILED: '#e74c3c',     // Rot
    MIGRATING: '#f39c12',  // Orange
    RECOVERING: '#9b59b6'  // Lila
  };

  const workerStatusColors = {
    IDLE: '#2ecc71',      // Grün
    BUSY: '#f39c12',      // Orange
    OVERLOADED: '#e74c3c', // Rot
    FAILING: '#c0392b',    // Dunkelrot
    SHUTDOWN: '#95a5a6'    // Grau
  };

  useEffect(() => {
    if (!svgRef.current || Object.keys(workers).length === 0) return;

    const width = svgRef.current.parentElement.clientWidth;
    const height = 500;

    // SVG erstellen
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove(); // Alles löschen

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    // Container für die Visualisierung
    const visualContainer = svg.append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Hintergrund
    visualContainer.append('rect')
      .attr('x', -width / 2)
      .attr('y', -height / 2)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#f8f9fa')
      .attr('rx', 10)
      .attr('ry', 10);

    // Task-Manager in der Mitte
    const managerRadius = 50;
    visualContainer.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', managerRadius)
      .attr('fill', '#34495e')
      .attr('stroke', '#2c3e50')
      .attr('stroke-width', 2);

    visualContainer.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text('Task Manager');

    const workerArray = Array.isArray(workers) ? workers : Object.values(workers);
    const workerCount = workerArray.length;
    const workerRadius = 70;
    const visualRadius = Math.min(width, height) * 0.4 - workerRadius;
    
    // Worker-Boxen
    workerArray.forEach((worker, index) => {
      const angle = (index * 2 * Math.PI / workerCount) + Math.PI/2;
      const x = visualRadius * Math.cos(angle);
      const y = visualRadius * Math.sin(angle);
      
      // Worker-Box
      const workerGroup = visualContainer.append('g')
        .attr('class', 'worker-box')
        .attr('transform', `translate(${x}, ${y})`);
      
      // Box
      workerGroup.append('rect')
        .attr('x', -workerRadius)
        .attr('y', -workerRadius)
        .attr('width', workerRadius * 2)
        .attr('height', workerRadius * 2)
        .attr('rx', 10)
        .attr('ry', 10)
        .attr('fill', workerStatusColors[worker.status] || '#95a5a6')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 2)
        .on('mouseover', function(event) {
          tooltip
            .style('opacity', 1)
            .html(`
              <div><strong>Worker:</strong> ${worker.id}</div>
              <div><strong>Status:</strong> ${worker.status}</div>
              <div><strong>Aktueller Task:</strong> ${worker.task || 'Keiner'}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 20) + 'px');
        })
        .on('mouseout', function() {
          tooltip.style('opacity', 0);
        });
      
      // Worker-Name
      workerGroup.append('text')
        .attr('x', 0)
        .attr('y', -workerRadius/2)
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('fill', 'white')
        .text(`Worker ${index + 1}`);
      
      // Status-Text
      workerGroup.append('text')
        .attr('x', 0)
        .attr('y', workerRadius/2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .text(worker.status);
      
      // Verbindung zum Task-Manager
      visualContainer.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', '#95a5a6')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');
      
      // Tasks für diesen Worker
      const workerTasks = tasks.filter(task => task.worker_id === worker.id || task.workerId === worker.id);
      const taskCount = workerTasks.length;
      
      if (taskCount > 0) {
        // Anzeigen der Tasks in der Worker-Box
        workerTasks.forEach((task, taskIndex) => {
          const taskSize = 20;
          const taskX = (taskIndex - (taskCount - 1) / 2) * (taskSize * 1.5);
          
          const isSelected = selectedTask && (selectedTask.id === task.id);
          
          // Task-Kreis
          workerGroup.append('circle')
            .attr('cx', taskX)
            .attr('cy', 0)
            .attr('r', isSelected ? taskSize * 0.75 : taskSize * 0.6)
            .attr('fill', statusColors[task.status] || '#95a5a6')
            .attr('stroke', isSelected ? '#f1c40f' : '#2c3e50')
            .attr('stroke-width', isSelected ? 3 : 1)
            .on('mouseover', function(event) {
              tooltip
                .style('opacity', 1)
                .html(`
                  <div><strong>Task:</strong> ${task.id}</div>
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
          
          // Task-Fortschritt
          if (task.progress > 0 && task.progress < 100) {
            const arc = d3.arc()
              .innerRadius(0)
              .outerRadius(isSelected ? taskSize * 0.75 : taskSize * 0.6)
              .startAngle(0)
              .endAngle(2 * Math.PI * (task.progress / 100));
            
            workerGroup.append('path')
              .attr('d', arc)
              .attr('fill', '#f1c40f')
              .attr('transform', `translate(${taskX}, 0)`);
          }
        });
      }
    });
    
    // Nicht zugewiesene Tasks werden um den Task-Manager angeordnet
    const unassignedTasks = tasks.filter(task => 
      !task.worker_id && !task.workerId && task.status === 'CREATED'
    );
    
    if (unassignedTasks.length > 0) {
      const queueLabel = visualContainer.append('text')
        .attr('x', 0)
        .attr('y', managerRadius + 20)
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .text('Warteschlange');
      
      const queueRadius = 30;
      const queueCircle = visualContainer.append('circle')
        .attr('cx', 0)
        .attr('cy', managerRadius + 50)
        .attr('r', queueRadius)
        .attr('fill', '#ecf0f1')
        .attr('stroke', '#bdc3c7')
        .attr('stroke-width', 2);
      
      const queueText = visualContainer.append('text')
        .attr('x', 0)
        .attr('y', managerRadius + 50)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-weight', 'bold')
        .text(unassignedTasks.length);
      
      // Verbindung zur Warteschlange
      visualContainer.append('line')
        .attr('x1', 0)
        .attr('y1', managerRadius)
        .attr('x2', 0)
        .attr('y2', managerRadius + 30)
        .attr('stroke', '#bdc3c7')
        .attr('stroke-width', 2);
    }
    
    // Legende
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width - 150}, 20)`);

    // Task-Status-Legende
    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-weight', 'bold')
      .text('Task-Status:');

    Object.entries(statusColors).forEach(([status, color], i) => {
      legend.append('rect')
        .attr('x', 0)
        .attr('y', 15 + i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

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
      .attr('font-weight', 'bold')
      .text('Worker-Status:');

    Object.entries(workerStatusColors).forEach(([status, color], i) => {
      workerLegend.append('rect')
        .attr('x', 0)
        .attr('y', 15 + i * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', color)
        .attr('stroke', '#333')
        .attr('stroke-width', 1);

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