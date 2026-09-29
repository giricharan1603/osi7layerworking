import React, { useRef, useEffect } from 'react';

const NODE_COORDINATES = {
  A: { x: 50,  y: 200 },
  B: { x: 200, y: 80  },
  C: { x: 200, y: 320 },
  D: { x: 400, y: 80  },
  E: { x: 400, y: 320 },
  F: { x: 550, y: 200 }
};

export default function NetworkCanvas({ 
  activePackets, 
  setActivePackets, 
  shortestPath,
  broadcastEdges,
  showBroadcast,
  onPacketArrival,
  onPacketCorrupted
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Default Links
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#3a3a3a';
      const links = [
        ['A','B'], ['A','C'], ['B','C'], ['B','D'], 
        ['C','D'], ['C','E'], ['D','E'], ['D','F'], ['E','F']
      ];
      links.forEach(([n1, n2]) => {
        ctx.beginPath();
        ctx.moveTo(NODE_COORDINATES[n1].x, NODE_COORDINATES[n1].y);
        ctx.lineTo(NODE_COORDINATES[n2].x, NODE_COORDINATES[n2].y);
        ctx.stroke();
      });

      // 2. Highlight Broadcast Tree
      if (showBroadcast && broadcastEdges) {
        ctx.strokeStyle = '#00f7ff';
        ctx.lineWidth = 3;
        broadcastEdges.forEach(edge => {
          ctx.beginPath();
          ctx.moveTo(NODE_COORDINATES[edge.from].x, NODE_COORDINATES[edge.from].y);
          ctx.lineTo(NODE_COORDINATES[edge.to].x, NODE_COORDINATES[edge.to].y);
          ctx.stroke();
        });
      }

      // 3. Highlight Dijkstra Shortest Path
      if (!showBroadcast && shortestPath && shortestPath.length > 1) {
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(NODE_COORDINATES[shortestPath[0]].x, NODE_COORDINATES[shortestPath[0]].y);
        for (let i = 1; i < shortestPath.length; i++) {
          ctx.lineTo(NODE_COORDINATES[shortestPath[i]].x, NODE_COORDINATES[shortestPath[i]].y);
        }
        ctx.stroke();
      }

      // 4. Draw Nodes
      Object.entries(NODE_COORDINATES).forEach(([name, coords]) => {
        ctx.fillStyle = shortestPath.includes(name) && !showBroadcast ? '#ffc107' : '#444';
        if (showBroadcast && name === 'A') ctx.fillStyle = '#00f7ff';
        ctx.beginPath(); ctx.arc(coords.x, coords.y, 16, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, coords.x, coords.y);
      });

      // 5. Packet Vector Animation Logic
      const updatedPackets = activePackets.map(packet => {
        const currentHopNode = shortestPath[packet.currentHopIndex];
        const nextHopNode = shortestPath[packet.currentHopIndex + 1];

        if (!nextHopNode) return packet;

        const start = NODE_COORDINATES[currentHopNode];
        const end = NODE_COORDINATES[nextHopNode];

        const nextProgress = packet.progress + packet.speed;
        let x = start.x + (end.x - start.x) * nextProgress;
        let y = start.y + (end.y - start.y) * nextProgress;

        let updated = { ...packet, x, y, progress: nextProgress };

        if (nextProgress >= 1.0) {
          if (packet.currentHopIndex + 1 === shortestPath.length - 1) {
            onPacketArrival(packet);
            return null;
          } else {
            updated.currentHopIndex += 1;
            updated.progress = 0;
          }
        }

        ctx.fillStyle = packet.status === 'corrupted' ? '#dc3545' : '#28a745';
        ctx.fillRect(x - 18, y - 10, 36, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '9px sans-serif';
        ctx.fillText(`F#${packet.id}`, x, y);

        return updated;
      }).filter(Boolean);

      if (activePackets.length > 0) {
        setActivePackets(updatedPackets);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [activePackets, shortestPath, broadcastEdges, showBroadcast]);

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const corruptedList = activePackets.map(p => {
      if (Math.abs(p.x - clickX) < 25 && Math.abs(p.y - clickY) < 25) {
        if (p.status !== 'corrupted') {
          onPacketCorrupted(p.id);
          return { ...p, status: 'corrupted' };
        }
      }
      return p;
    });
    setActivePackets(corruptedList);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} width={600} height={380} onClick={handleCanvasClick} style={{ border: '1px solid #333', borderRadius: '6px', width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.8)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: '#aaa' }}>
        ⚡ Click a moving packet in real-time to <b>Inject CRC Error</b>
      </div>
    </div>
  );
}
