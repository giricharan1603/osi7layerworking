import { useRef, useEffect, useMemo } from 'react';
import { buildBroadcastLevels } from '../utils/routing';

const NODE_COORDINATES = {
  A: { x: 50,  y: 190 },
  B: { x: 200, y: 70  },
  C: { x: 200, y: 310 },
  D: { x: 400, y: 70  },
  E: { x: 400, y: 310 },
  F: { x: 550, y: 190 }
};

export default function NetworkCanvas({ 
  activePackets, 
  shortestPath = ['A', 'F'],
  broadcastEdges = [],
  showBroadcast = false,
  setShowBroadcast,
  onPacketArrival,
  onPacketCorrupted,
  subnetGraph,
  speedMultiplier = 1,
  onSpeedChange,
  startNode = 'A',
  endNode = 'F',
  isDarkMode = true
}) {
  const canvasRef = useRef(null);
  
  // Independent high-performance animation state stored in refs to avoid 60fps React re-renders
  const packetsRef = useRef([]);
  const propsRef = useRef({});

  // Compute hierarchical tree levels rooted at startNode for concurrent branch propagation
  const broadcastLevels = useMemo(() => {
    return buildBroadcastLevels(broadcastEdges, startNode);
  }, [broadcastEdges, startNode]);

  // Keep props accessible to the continuous animation frame loop
  useEffect(() => {
    propsRef.current = {
      shortestPath,
      broadcastEdges,
      broadcastLevels,
      showBroadcast,
      subnetGraph,
      speedMultiplier,
      startNode,
      endNode,
      onPacketArrival,
      onPacketCorrupted,
      isDarkMode
    };
  }, [shortestPath, broadcastEdges, broadcastLevels, showBroadcast, subnetGraph, speedMultiplier, startNode, endNode, onPacketArrival, onPacketCorrupted, isDarkMode]);

  // Synchronize incoming packet events from React state without resetting animation progress
  useEffect(() => {
    if (!activePackets || activePackets.length === 0) {
      packetsRef.current = [];
      return;
    }

    const currentMap = new Map(packetsRef.current.map(p => [p.id, p]));
    const nextList = [];

    activePackets.forEach(p => {
      const existing = currentMap.get(p.id);
      if (existing) {
        // Update corruption status and speed while keeping physical in-flight position
        existing.status = p.status;
        existing.speed = p.speed;
        nextList.push(existing);
      } else {
        // Add newly spawned packet
        nextList.push({
          id: p.id,
          rawFrame: p.rawFrame,
          status: p.status,
          currentHopIndex: 0,
          progress: 0.0,
          speed: p.speed,
          x: NODE_COORDINATES[startNode] ? NODE_COORDINATES[startNode].x : 50,
          y: NODE_COORDINATES[startNode] ? NODE_COORDINATES[startNode].y : 190
        });
      }
    });

    packetsRef.current = nextList;
  }, [activePackets, startNode]);

  // Main stable 60fps canvas render loop that never freezes or cancels on view toggles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const {
        shortestPath: currentPath,
        broadcastEdges: currentBTree,
        broadcastLevels: currentBLevels,
        showBroadcast: isBroadcast,
        subnetGraph: currentGraph,
        startNode: currentStart,
        endNode: currentEnd,
        onPacketArrival: handleArrival,
        isDarkMode: currentDarkMode
      } = propsRef.current;

      ctx.fillStyle = currentDarkMode ? '#1a1a1a' : '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Default Subnet Links
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = currentDarkMode ? '#333' : '#cbd5e1';
      const allLinks = [
        ['A','B'], ['A','C'], ['B','C'], ['B','D'], 
        ['C','D'], ['C','E'], ['D','E'], ['D','F'], ['E','F']
      ];
      allLinks.forEach(([n1, n2]) => {
        ctx.beginPath();
        ctx.moveTo(NODE_COORDINATES[n1].x, NODE_COORDINATES[n1].y);
        ctx.lineTo(NODE_COORDINATES[n2].x, NODE_COORDINATES[n2].y);
        ctx.stroke();
      });

      // 2. Mode Visualization
      if (isBroadcast && currentBTree && currentBTree.length > 0) {
        // Highlight Subnet Spanning Broadcast Tree (Cyan)
        ctx.save();
        ctx.strokeStyle = '#00f7ff';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#00f7ff';
        ctx.shadowBlur = 8;
        currentBTree.forEach(edge => {
          if (!edge || !NODE_COORDINATES[edge.from] || !NODE_COORDINATES[edge.to]) return;
          ctx.beginPath();
          ctx.moveTo(NODE_COORDINATES[edge.from].x, NODE_COORDINATES[edge.from].y);
          ctx.lineTo(NODE_COORDINATES[edge.to].x, NODE_COORDINATES[edge.to].y);
          ctx.stroke();
        });
        ctx.restore();
      } else if (!isBroadcast && currentPath && currentPath.length > 1) {
        // Highlight Dijkstra Shortest Path (Gold)
        ctx.save();
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffc107';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(NODE_COORDINATES[currentPath[0]].x, NODE_COORDINATES[currentPath[0]].y);
        for (let i = 1; i < currentPath.length; i++) {
          const nodeName = currentPath[i];
          if (NODE_COORDINATES[nodeName]) {
            ctx.lineTo(NODE_COORDINATES[nodeName].x, NODE_COORDINATES[nodeName].y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw Distance / Weight Badges on Links
      allLinks.forEach(([n1, n2]) => {
        const weight = currentGraph && currentGraph[n1] ? currentGraph[n1][n2] : undefined;
        if (weight === undefined) return;

        const p1 = NODE_COORDINATES[n1];
        const p2 = NODE_COORDINATES[n2];
        let midX = (p1.x + p2.x) / 2;
        let midY = (p1.y + p2.y) / 2;

        if ((n1 === 'B' && n2 === 'C') || (n1 === 'C' && n2 === 'B')) midX -= 14;
        else if ((n1 === 'D' && n2 === 'E') || (n1 === 'E' && n2 === 'D')) midX -= 14;
        else if ((n1 === 'C' && n2 === 'D') || (n1 === 'D' && n2 === 'C')) midY -= 9;
        else if (n1 === 'A' && n2 === 'B') midY -= 11;
        else if (n1 === 'A' && n2 === 'C') midY += 11;
        else if (n1 === 'D' && n2 === 'F') midY -= 11;
        else if (n1 === 'E' && n2 === 'F') midY += 11;

        const isOnPath = !isBroadcast && currentPath && currentPath.some((node, i) => {
          if (i === currentPath.length - 1) return false;
          const next = currentPath[i + 1];
          return (node === n1 && next === n2) || (node === n2 && next === n1);
        });

        const isOnTree = isBroadcast && currentBTree && currentBTree.some(edge => 
          (edge.from === n1 && edge.to === n2) || (edge.from === n2 && edge.to === n1)
        );

        const badgeW = 20;
        const badgeH = 14;
        ctx.fillStyle = isOnPath ? '#ffc107' : isOnTree ? '#00f7ff' : (currentDarkMode ? '#141414' : '#ffffff');
        ctx.strokeStyle = isOnPath ? '#ffea00' : isOnTree ? '#00c4cc' : (currentDarkMode ? '#555' : '#cbd5e1');
        ctx.lineWidth = 1;
        ctx.fillRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);
        ctx.strokeRect(midX - badgeW / 2, midY - badgeH / 2, badgeW, badgeH);

        ctx.fillStyle = (isOnPath || isOnTree) ? '#000' : (currentDarkMode ? '#888' : '#334155');
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(weight.toString(), midX, midY);
      });

      // 4. Draw Subnet Nodes
      Object.entries(NODE_COORDINATES).forEach(([name, coords]) => {
        const isStart = name === currentStart;
        const isEnd = name === currentEnd;
        const isPathNode = currentPath && currentPath.includes(name);

        ctx.beginPath();
        ctx.arc(coords.x, coords.y, 16, 0, 2 * Math.PI);

        if (isBroadcast) {
          ctx.fillStyle = isStart ? '#00f7ff' : (currentDarkMode ? '#222' : '#ffffff');
          ctx.strokeStyle = isStart ? (currentDarkMode ? '#fff' : '#0284c7') : '#00f7ff';
        } else {
          ctx.fillStyle = isStart ? '#1e7e34' : isEnd ? '#bd2130' : isPathNode ? '#ffc107' : (currentDarkMode ? '#222' : '#ffffff');
          ctx.strokeStyle = isStart ? '#28a745' : isEnd ? '#dc3545' : isPathNode ? '#fff' : (currentDarkMode ? '#555' : '#94a3b8');
        }
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = (!isBroadcast && isPathNode && !isStart && !isEnd) || (isBroadcast && isStart) ? '#000' : (currentDarkMode || isStart || isEnd ? '#fff' : '#0f172a');
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, coords.x, coords.y);

        // Tags above nodes
        if (isBroadcast) {
          ctx.fillStyle = '#00f7ff';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(isStart ? 'ROOT (SRC)' : 'RCV', coords.x, coords.y - 23);
        } else {
          if (isStart) {
            ctx.fillStyle = '#28a745';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('START', coords.x, coords.y - 23);
          } else if (isEnd) {
            ctx.fillStyle = '#dc3545';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('END', coords.x, coords.y - 23);
          }
        }
      });

      // 5. Packet Vector Animation (Concurrent Broadcast Propagation + Dijkstra Unicast)
      const remainingPackets = [];

      packetsRef.current.forEach(packet => {
        const isCorrupted = packet.status === 'corrupted';
        packet.activeCoords = [];

        if (isBroadcast) {
          // Broadcast Tree Mode: Concurrently propagate across branches level-by-level
          if (!currentBLevels || currentBLevels.length === 0) {
            handleArrival(packet);
            return;
          }

          if (packet.currentHopIndex >= currentBLevels.length) {
            handleArrival(packet);
            return;
          }

          const currentLevelEdges = currentBLevels[packet.currentHopIndex];
          if (!currentLevelEdges || currentLevelEdges.length === 0) {
            handleArrival(packet);
            return;
          }

          packet.progress += packet.speed;
          const clampedProgress = Math.min(packet.progress, 1.0);

          // Animate packet copies concurrently along all outward branches of this level
          currentLevelEdges.forEach((edge, edgeIdx) => {
            const startCoord = NODE_COORDINATES[edge.from];
            const endCoord = NODE_COORDINATES[edge.to];
            if (!startCoord || !endCoord) return;

            const px = startCoord.x + (endCoord.x - startCoord.x) * clampedProgress;
            const py = startCoord.y + (endCoord.y - startCoord.y) * clampedProgress;
            packet.activeCoords.push({ x: px, y: py });

            // Store first branch position on packet object for compatibility
            if (edgeIdx === 0) {
              packet.x = px;
              packet.y = py;
            }

            // Draw Moving Packet Box on this branch
            ctx.save();
            if (isCorrupted) {
              ctx.shadowColor = '#dc3545';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#dc3545';
              ctx.strokeStyle = '#fff';
            } else {
              ctx.shadowColor = '#00f7ff';
              ctx.shadowBlur = 8;
              ctx.fillStyle = '#065961';
              ctx.strokeStyle = '#00f7ff';
            }

            ctx.fillRect(px - 22, py - 11, 44, 22);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px - 22, py - 11, 44, 22);
            ctx.restore();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              isCorrupted ? `F#${packet.id} ❌` : `F#${packet.id} 🌐`,
              px,
              py
            );
          });

          if (packet.progress >= 1.0) {
            if (packet.currentHopIndex + 1 >= currentBLevels.length) {
              // Completed all levels of the broadcast spanning tree!
              handleArrival(packet);
              return;
            } else {
              // Advance to next branch level in the tree
              packet.currentHopIndex += 1;
              packet.progress = 0;
            }
          }
        } else {
          // Unicast Mode: Dijkstra Shortest Path from Start to End
          if (!currentPath || currentPath.length < 2) return;
          const totalHops = currentPath.length - 1;
          if (packet.currentHopIndex >= totalHops) {
            handleArrival(packet);
            return;
          }

          const currentHop = currentPath[packet.currentHopIndex];
          const nextHop = currentPath[packet.currentHopIndex + 1];

          if (!currentHop || !nextHop || !NODE_COORDINATES[currentHop] || !NODE_COORDINATES[nextHop]) {
            handleArrival(packet);
            return;
          }

          const startCoord = NODE_COORDINATES[currentHop];
          const endCoord = NODE_COORDINATES[nextHop];

          packet.progress += packet.speed;
          const clampedProgress = Math.min(packet.progress, 1.0);
          packet.x = startCoord.x + (endCoord.x - startCoord.x) * clampedProgress;
          packet.y = startCoord.y + (endCoord.y - startCoord.y) * clampedProgress;
          packet.activeCoords.push({ x: packet.x, y: packet.y });

          // Draw Moving Packet Box
          ctx.save();
          if (isCorrupted) {
            ctx.shadowColor = '#dc3545';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#dc3545';
          } else {
            ctx.shadowColor = '#28a745';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#28a745';
          }

          ctx.fillRect(packet.x - 22, packet.y - 11, 44, 22);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.strokeRect(packet.x - 22, packet.y - 11, 44, 22);
          ctx.restore();

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            isCorrupted ? `F#${packet.id} ❌` : `F#${packet.id}`,
            packet.x,
            packet.y
          );

          if (packet.progress >= 1.0) {
            if (packet.currentHopIndex + 1 >= totalHops) {
              handleArrival(packet);
              return;
            } else {
              packet.currentHopIndex += 1;
              packet.progress = 0;
            }
          }
        }

        remainingPackets.push(packet);
      });

      packetsRef.current = remainingPackets;

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    packetsRef.current.forEach(p => {
      const coords = p.activeCoords && p.activeCoords.length > 0 ? p.activeCoords : [{ x: p.x, y: p.y }];
      const isHit = coords.some(c => Math.abs(c.x - clickX) < 32 && Math.abs(c.y - clickY) < 32);

      if (isHit && p.status !== 'corrupted') {
        p.status = 'corrupted';
        if (propsRef.current.onPacketCorrupted) {
          propsRef.current.onPacketCorrupted(p.id);
        }
      }
    });
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const isNear = packetsRef.current.some(p => {
      const coords = p.activeCoords && p.activeCoords.length > 0 ? p.activeCoords : [{ x: p.x, y: p.y }];
      return coords.some(c => Math.abs(c.x - mouseX) < 32 && Math.abs(c.y - mouseY) < 32);
    });
    canvas.style.cursor = isNear ? 'crosshair' : 'default';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Upper Control Bar: Graph Mode Toggle + Speed Controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '8px 14px', 
        background: isDarkMode ? '#232324' : '#f8fafc', 
        borderBottom: isDarkMode ? '1px solid #333' : '1px solid #e2e8f0', 
        fontSize: '11px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        
        {/* Direct Graph Mode Switch Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#aaa', fontWeight: 'bold' }}>Topology View:</span>
          <button
            onClick={() => setShowBroadcast && setShowBroadcast(false)}
            style={{
              background: !showBroadcast ? '#3d3007' : '#222',
              color: !showBroadcast ? '#ffc107' : '#888',
              border: !showBroadcast ? '1px solid #ffc107' : '1px solid #444',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📍 Dijkstra Shortest Path
          </button>
          <button
            onClick={() => setShowBroadcast && setShowBroadcast(true)}
            style={{
              background: showBroadcast ? '#06383b' : '#222',
              color: showBroadcast ? '#00f7ff' : '#888',
              border: showBroadcast ? '1px solid #00f7ff' : '1px solid #444',
              borderRadius: '4px',
              padding: '3px 9px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🌐 Broadcast Tree (Spanning)
          </button>
        </div>

        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#aaa' }}>Speed:</span>
          {[
            { label: '0.5x Slow', val: 0.5 },
            { label: '1x Normal', val: 1.0 },
            { label: '2x Fast', val: 2.0 }
          ].map(item => (
            <button
              key={item.label}
              onClick={() => onSpeedChange && onSpeedChange(item.val)}
              style={{
                background: Math.abs(speedMultiplier - item.val) < 0.1 ? '#007bff' : '#333',
                color: '#fff',
                border: Math.abs(speedMultiplier - item.val) < 0.1 ? '1px solid #00f7ff' : '1px solid #555',
                padding: '2px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: Math.abs(speedMultiplier - item.val) < 0.1 ? 'bold' : 'normal',
                fontSize: '11px'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          width={650} 
          height={340} 
          onClick={handleCanvasClick} 
          onMouseMove={handleCanvasMouseMove}
          style={{ width: '100%', height: '100%', display: 'block' }} 
        />

        {/* Mode Legend Banner */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '12px',
          background: isDarkMode ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.95)',
          boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          border: showBroadcast ? '1px solid #00f7ff' : '1px solid #ffc107',
          color: showBroadcast ? '#00f7ff' : '#ffc107',
          fontWeight: 'bold',
          pointerEvents: 'none'
        }}>
          {showBroadcast 
            ? `🌐 Spanning Broadcast Tree (Root Node: ${startNode})` 
            : `📍 Dijkstra Shortest Path: ${shortestPath.join(' ➔ ')}`}
        </div>
      </div>

    </div>
  );
}
