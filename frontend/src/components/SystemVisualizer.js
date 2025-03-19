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

  // Hilfsfunktion zum Erstellen eines Pfades zwischen Punkten
  const createPathBetweenPoints = (source, target) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    return `M${source.x},${source.y}C${source.x},${source.y + dy/3} ${target.x},${target.y - dy/3} ${target.x},${target.y}`;
  };

  // Hilfsfunktion für Animation entlang eines Pfades
  const translateAlong = (path) => {
    const l = path.getTotalLength();
    return function(d, i) {
      return function(t) {
        const p = path.getPointAtLength(t * l);
        return `translate(${p.x},${p.y})`;
      };
    };
  };

  useEffect(() => {
    if (!svgRef.current || Object.keys(workers).length === 0) return;

    const width = svgRef.current.parentElement.clientWidth;
    const height = 600; // Erhöht für die Baumstruktur

    // SVG erstellen
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove(); // Alles löschen

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    // Container für die Visualisierung
    const visualContainer = svg.append('g')
      .attr('transform', `translate(${width / 2}, 80)`); // Verschoben nach oben

    // Hintergrund
    visualContainer.append('rect')
      .attr('x', -width / 2)
      .attr('y', -80)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#f8f9fa')
      .attr('rx', 10)
      .attr('ry', 10);

    // Task-Manager in der Mitte oben
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
    
    // Horizontale Ausbreitung der Worker
    const horizontalSpacing = width / (workerCount + 1);
    
    // Speichert die Worker-Positionen für den Migrationspfad
    const workerPositions = {};
    
    // Worker-Boxen - horizontal angeordnet unterhalb des Task-Managers
    workerArray.forEach((worker, index) => {
      const x = (index + 1) * horizontalSpacing - width / 2; // Horizontal verteilt
      const y = 250; // Alle Worker auf derselben Höhe
      
      // Speichere Worker-Position für spätere Verwendung
      workerPositions[worker.id] = { x, y };
      
      // Worker-Box
      const workerGroup = visualContainer.append('g')
        .attr('class', 'worker-box')
        .attr('transform', `translate(${x}, ${y})`)
        .attr('data-worker-id', worker.id);
      
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
        .attr('class', 'worker-rect')
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
      
      // Verbindung zum Task-Manager - kurvenförmig
      const path = createPathBetweenPoints({x: 0, y: 0}, {x: x, y: y});
      visualContainer.append('path')
        .attr('d', path)
        .attr('fill', 'none')
        .attr('stroke', worker.status === 'FAILING' ? '#e74c3c' : '#95a5a6')
        .attr('stroke-width', worker.status === 'FAILING' ? 3 : 2)
        .attr('stroke-dasharray', worker.status === 'FAILING' ? '8,4' : '5,5')
        .attr('class', 'connection-line');
      
      // Spezielle Effekte für FAILING Worker
      if (worker.status === 'FAILING') {
        // Pulsierender Kreis für FAILING Worker
        workerGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', workerRadius * 1.1)
          .attr('fill', 'none')
          .attr('stroke', '#e74c3c')
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '10,5')
          .attr('class', 'failing-indicator')
          .call(g => {
            // Pulsierende Animation
            g.append('animate')
              .attr('attributeName', 'r')
              .attr('values', `${workerRadius * 1.1};${workerRadius * 1.3};${workerRadius * 1.1}`)
              .attr('dur', '2s')
              .attr('repeatCount', 'indefinite');
            
            // Rotation der gestrichelten Linie
            g.append('animateTransform')
              .attr('attributeName', 'transform')
              .attr('type', 'rotate')
              .attr('from', '0 0 0')
              .attr('to', '360 0 0')
              .attr('dur', '8s')
              .attr('repeatCount', 'indefinite');
          });
        
        // Warnsymbol
        workerGroup.append('text')
          .attr('x', 0)
          .attr('y', -workerRadius * 0.2)
          .attr('text-anchor', 'middle')
          .attr('font-size', '24px')
          .attr('fill', 'white')
          .text('⚠')
          .call(g => {
            // Blinkende Animation
            g.append('animate')
              .attr('attributeName', 'opacity')
              .attr('values', '1;0.3;1')
              .attr('dur', '1s')
              .attr('repeatCount', 'indefinite');
          });
      }
      
      // Tasks für diesen Worker
      const workerTasks = tasks.filter(task => task.worker_id === worker.id || task.workerId === worker.id);
      const taskCount = workerTasks.length;
      
      if (taskCount > 0) {
        // Anzeigen der Tasks in der Worker-Box
        workerTasks.forEach((task, taskIndex) => {
          const taskSize = 20;
          const taskX = (taskIndex - (taskCount - 1) / 2) * (taskSize * 1.5);
          
          const isSelected = selectedTask && (selectedTask.id === task.id);
          
          // Task-Gruppe
          const taskGroup = workerGroup.append('g')
            .attr('class', 'task-group')
            .attr('transform', `translate(${taskX}, 0)`)
            .attr('data-task-id', task.id);
          
          // Task-Kreis
          taskGroup.append('circle')
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
            
            taskGroup.append('path')
              .attr('d', arc)
              .attr('fill', '#f1c40f');
          }
          
          // Animation für migrierende Tasks
          if (task.status === 'MIGRATING') {
            taskGroup.select('circle')
              .call(g => {
                // Pulsierende Animation
                g.append('animate')
                  .attr('attributeName', 'r')
                  .attr('values', `${taskSize * 0.6};${taskSize * 0.8};${taskSize * 0.6}`)
                  .attr('dur', '1s')
                  .attr('repeatCount', 'indefinite');
                
                // Farbwechsel
                g.append('animate')
                  .attr('attributeName', 'fill')
                  .attr('values', `${statusColors.MIGRATING};${statusColors.RUNNING};${statusColors.MIGRATING}`)
                  .attr('dur', '2s')
                  .attr('repeatCount', 'indefinite');
              });
          }
          
          // Animation für wiederherzustellende Tasks
          if (task.status === 'RECOVERING') {
            taskGroup.select('circle')
              .attr('stroke', statusColors.RECOVERING)
              .attr('stroke-width', 3)
              .call(g => {
                // Pulsierende Animation
                g.append('animate')
                  .attr('attributeName', 'stroke-width')
                  .attr('values', '3;5;3')
                  .attr('dur', '1.5s')
                  .attr('repeatCount', 'indefinite');
              });
            
            // Hinzufügen eines "Wiederherstellungs"-Symbols
            taskGroup.append('text')
              .attr('y', 5)
              .attr('text-anchor', 'middle')
              .attr('font-size', '16px')
              .attr('fill', 'white')
              .text('↻')
              .call(g => {
                // Rotationsanimation
                g.append('animateTransform')
                  .attr('attributeName', 'transform')
                  .attr('type', 'rotate')
                  .attr('from', '0')
                  .attr('to', '360')
                  .attr('dur', '2s')
                  .attr('repeatCount', 'indefinite');
              });
          }
          
          // Animation für fehlgeschlagene Tasks mit Wiederaufnahme-Option
          if (task.status === 'FAILED') {
            taskGroup.select('circle')
              .attr('stroke', statusColors.FAILED)
              .attr('stroke-width', 3)
              .call(g => {
                // Pulsierende Animation
                g.append('animate')
                  .attr('attributeName', 'stroke-width')
                  .attr('values', '3;5;3')
                  .attr('dur', '2s')
                  .attr('repeatCount', 'indefinite');
              });
            
            // X-Symbol für Fehler
            taskGroup.append('text')
              .attr('y', 5)
              .attr('text-anchor', 'middle')
              .attr('font-size', '16px')
              .attr('fill', 'white')
              .text('✗');
              
            // "Retry"-Symbol hinzufügen
            taskGroup.append('circle')
              .attr('r', taskSize * 0.3)
              .attr('cx', taskSize * 0.6)
              .attr('cy', -taskSize * 0.6)
              .attr('fill', '#27ae60')
              .attr('stroke', 'white')
              .attr('stroke-width', 1)
              .attr('class', 'retry-button')
              .attr('cursor', 'pointer');
              
            taskGroup.append('text')
              .attr('x', taskSize * 0.6)
              .attr('y', -taskSize * 0.6)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', '10px')
              .attr('fill', 'white')
              .text('↻')
              .attr('class', 'retry-icon')
              .attr('cursor', 'pointer');
          }
        });
      }
    });
    
    // Migration-Pfade anzeigen für Tasks im Status MIGRATING
    const migratingTasks = tasks.filter(task => task.status === 'MIGRATING');
    migratingTasks.forEach(task => {
      // Finde den Quell- und Ziel-Worker aus den Task-Daten
      // In einer realen Anwendung würden diese Informationen aus den Task-Daten kommen
      // Hier verwenden wir eine Heuristik zur Demonstration
      const sourceWorkerId = task.worker_id || Object.keys(workerPositions)[0];
      
      // Als Ziel nehmen wir einen aktiven Worker, der nicht der Quell-Worker ist
      const availableWorkers = workerArray.filter(w => 
        w.id !== sourceWorkerId && w.status !== 'FAILING' && w.status !== 'SHUTDOWN'
      );
      
      const targetWorkerId = availableWorkers.length > 0 
        ? availableWorkers[0].id 
        : Object.keys(workerPositions).find(id => id !== sourceWorkerId);
      
      if (sourceWorkerId && targetWorkerId && workerPositions[sourceWorkerId] && workerPositions[targetWorkerId]) {
        const sourcePos = workerPositions[sourceWorkerId];
        const targetPos = workerPositions[targetWorkerId];
        
        // Migrationspfad erstellen - kurvenförmig
        const pathData = createPathBetweenPoints(sourcePos, targetPos);
        
        // Pfad zeichnen
        const migrationPath = visualContainer.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', statusColors.MIGRATING)
          .attr('stroke-width', 3)
          .attr('stroke-dasharray', '8,4')
          .attr('class', 'migration-path');
        
        // Animation des Pfades
        migrationPath.call(g => {
          g.append('animate')
            .attr('attributeName', 'stroke-dashoffset')
            .attr('from', '0')
            .attr('to', '24')
            .attr('dur', '1.5s')
            .attr('repeatCount', 'indefinite');
        });
        
        // Task-Symbol, das entlang des Pfades wandert
        const migrationSymbol = visualContainer.append('circle')
          .attr('r', 8)
          .attr('fill', statusColors.MIGRATING)
          .attr('stroke', '#2c3e50')
          .attr('stroke-width', 2)
          .attr('class', 'migration-symbol');
        
        // Animation des Symbols entlang des Pfades
        migrationSymbol.call(g => {
          g.append('animateMotion')
            .attr('dur', '3s')
            .attr('repeatCount', 'indefinite')
            .attr('path', pathData);
        });
      }
    });
    
    // Verbesserte Warteschlange für nicht zugewiesene Tasks
    const unassignedTasks = tasks.filter(task => 
      !task.worker_id && !task.workerId && task.status === 'CREATED'
    );
    
    if (unassignedTasks.length > 0) {
      // Erstelle eine visuelle Warteschlange
      const queueWidth = 200;
      const queueHeight = 120;
      const queueX = 0;
      const queueY = managerRadius + 40;
      
      // Container für die Warteschlange
      const queueGroup = visualContainer.append('g')
        .attr('class', 'task-queue')
        .attr('transform', `translate(${queueX}, ${queueY})`);
      
      // Hintergrund der Warteschlange
      queueGroup.append('rect')
        .attr('x', -queueWidth/2)
        .attr('y', 0)
        .attr('width', queueWidth)
        .attr('height', queueHeight)
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', '#ecf0f1')
        .attr('stroke', '#bdc3c7')
        .attr('stroke-width', 2);
      
      // "Warteschlange"-Label
      queueGroup.append('text')
        .attr('x', 0)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('font-size', '14px')
        .text('Warteschlange');
      
      // Tasks in der Warteschlange anzeigen
      const taskRadius = 15;
      const tasksPerRow = 5;
      const rowHeight = 40;
      
      unassignedTasks.slice(0, 15).forEach((task, index) => {
        const row = Math.floor(index / tasksPerRow);
        const col = index % tasksPerRow;
        
        const taskX = (col - Math.floor(tasksPerRow/2)) * (taskRadius * 2.5);
        const taskY = row * rowHeight + 30;
        
        const isSelected = selectedTask && (selectedTask.id === task.id);
        
        // Task-Kreis
        const taskGroup = queueGroup.append('g')
          .attr('class', 'queue-task')
          .attr('transform', `translate(${taskX}, ${taskY})`)
          .attr('data-task-id', task.id);
          
        taskGroup.append('circle')
          .attr('r', taskRadius)
          .attr('fill', statusColors.CREATED)
          .attr('stroke', isSelected ? '#f1c40f' : '#2c3e50')
          .attr('stroke-width', isSelected ? 3 : 1)
          .on('mouseover', function(event) {
            tooltip
              .style('opacity', 1)
              .html(`
                <div><strong>Task:</strong> ${task.id}</div>
                <div><strong>Typ:</strong> ${task.type}</div>
                <div><strong>Status:</strong> ${task.status}</div>
                <div><strong>Priorität:</strong> ${task.priority}</div>
              `)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 20) + 'px');
          })
          .on('mouseout', function() {
            tooltip.style('opacity', 0);
          });
          
        // Prioritätsanzeige
        taskGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text(task.priority);
          
        // Pulsierende Animation für höchste Priorität
        if (task.priority >= 9) {
          taskGroup.select('circle')
            .call(g => {
              g.append('animate')
                .attr('attributeName', 'r')
                .attr('values', `${taskRadius};${taskRadius * 1.2};${taskRadius}`)
                .attr('dur', '2s')
                .attr('repeatCount', 'indefinite');
            });
        }
      });
      
      // Anzeige für überzählige Tasks
      if (unassignedTasks.length > 15) {
        queueGroup.append('text')
          .attr('x', 0)
          .attr('y', queueHeight - 10)
          .attr('text-anchor', 'middle')
          .attr('font-style', 'italic')
          .attr('font-size', '12px')
          .text(`+ ${unassignedTasks.length - 15} weitere`);
      }
      
      // Animationen für Tasks, die gerade zugewiesen werden
      const tasksBeingAssigned = tasks.filter(task => task.status === 'ASSIGNED');
      
      tasksBeingAssigned.forEach(task => {
        // Finde den Ziel-Worker
        const targetWorkerId = task.worker_id || task.workerId;
        
        if (targetWorkerId && workerPositions[targetWorkerId]) {
          const targetPos = workerPositions[targetWorkerId];
          
          // Ausgangspunkt ist die Warteschlange
          const sourcePos = { x: queueX, y: queueY + queueHeight/2 };
          
          // Pfad von der Warteschlange zum Worker
          const pathData = createPathBetweenPoints(sourcePos, targetPos);
          
          // Pfad zeichnen (unsichtbar für die Animation)
          const assignmentPath = visualContainer.append('path')
            .attr('d', pathData)
            .attr('fill', 'none')
            .attr('stroke', 'none')
            .attr('id', `assignment-path-${task.id}`);
          
          // Animiertes Task-Symbol
          const assignmentSymbol = visualContainer.append('g')
            .attr('class', 'assignment-group');
            
          assignmentSymbol.append('circle')
            .attr('r', 10)
            .attr('fill', statusColors.ASSIGNED)
            .attr('stroke', '#2c3e50')
            .attr('stroke-width', 1);
          
          assignmentSymbol.append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '8px')
            .attr('font-weight', 'bold')
            .text(task.priority);
          
          // Animation des Symbols entlang des Pfades
          assignmentSymbol.append('animateMotion')
            .attr('dur', '2s')
            .attr('repeatCount', '1')
            .attr('path', pathData)
            .attr('rotate', 'auto')
            .attr('fill', 'freeze');
          
          // Aufleuchten am Ende der Animation
          assignmentSymbol.append('animate')
            .attr('attributeName', 'opacity')
            .attr('values', '1;1;0')
            .attr('keyTimes', '0;0.8;1')
            .attr('dur', '2s')
            .attr('fill', 'freeze');
        }
      });
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