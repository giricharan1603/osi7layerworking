import { useState } from 'react';

export default function ProtocolPanels({ 
  bucketLevel, 
  bucketCapacity, 
  setBucketCapacity, 
  leakRate, 
  setLeakRate, 
  framingType, 
  setFramingType,
  subnetGraph,
  updateEdgeWeight,
  resetGraphWeights,
  shortestPath
}) {
  const [showDistanceControls, setShowDistanceControls] = useState(false);
  const percentage = Math.min((bucketLevel / bucketCapacity) * 100, 100);

  // Derive unique edges from the undirected graph
  const uniqueEdges = [];
  const seen = new Set();
  if (subnetGraph) {
    Object.keys(subnetGraph).forEach(u => {
      Object.keys(subnetGraph[u]).forEach(v => {
        const key = [u, v].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEdges.push({ from: u, to: v, weight: subnetGraph[u][v] });
        }
      });
    });
  }

  // Calculate current shortest path total cost
  let shortestPathCost = 0;
  if (shortestPath && subnetGraph && shortestPath.length > 1) {
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const u = shortestPath[i];
      const v = shortestPath[i + 1];
      if (subnetGraph[u] && subnetGraph[u][v] !== undefined) {
        shortestPathCost += subnetGraph[u][v];
      }
    }
  }

  const smallBtnStyle = {
    background: '#2d2d2d',
    color: '#00f7ff',
    border: '1px solid #444',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 'bold'
  };

  return (
    <div style={{ background: '#252526', padding: '14px', borderRadius: '6px', marginBottom: '15px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#00f7ff', fontSize: '13px' }}>Traffic Shaper & Framing Controls</h4>
      
      {/* --- Leaky Bucket (Simple & Clean UI) --- */}
      <div style={{ marginBottom: '14px', background: '#1c1c1c', padding: '12px', borderRadius: '6px', border: '1px solid #333' }}>
        
        {/* Status Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
          <span style={{ fontWeight: 'bold', color: '#ddd' }}>Leaky Bucket Buffer:</span>
          <span style={{ fontWeight: 'bold', color: percentage > 85 ? '#dc3545' : percentage > 60 ? '#ffc107' : '#28a745' }}>
            {bucketLevel.toFixed(1)} / {bucketCapacity} B ({percentage.toFixed(0)}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', background: '#111', border: '1px solid #444', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ 
            width: `${percentage}%`, 
            height: '100%', 
            background: percentage > 85 ? '#dc3545' : percentage > 60 ? '#ffc107' : '#28a745', 
            transition: 'width 0.1s linear, background 0.2s' 
          }} />
        </div>


        {/* Compact Settings: Capacity & Leak Rate Dropdowns */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingTop: '8px', 
          borderTop: '1px solid #2a2a2a', 
          fontSize: '11px', 
          color: '#aaa' 
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Size:</span>
            <select 
              value={bucketCapacity} 
              onChange={(e) => setBucketCapacity(Number(e.target.value))}
              style={{ background: '#252526', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '2px 4px', fontSize: '11px', cursor: 'pointer' }}
            >
              <option value={20}>20 B</option>
              <option value={30}>30 B (Default)</option>
              <option value={50}>50 B</option>
              <option value={100}>100 B</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Leak Rate:</span>
            <select 
              value={leakRate} 
              onChange={(e) => setLeakRate(Number(e.target.value))}
              style={{ background: '#252526', color: '#fff', border: '1px solid #555', borderRadius: '3px', padding: '2px 4px', fontSize: '11px', cursor: 'pointer' }}
            >
              <option value={2}>2 B/s (Slow)</option>
              <option value={5}>5 B/s (Normal)</option>
              <option value={10}>10 B/s (Fast)</option>
            </select>
          </label>
        </div>

      </div>

      {/* --- Layer 2 Framing Model Selection --- */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#ffc107' }}>Layer 2 Framing Model:</div>
        {['charCount', 'charStuff', 'bitStuff'].map((type) => (
          <label key={type} style={{ display: 'block', fontSize: '12px', margin: '4px 0', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="framing" 
              checked={framingType === type} 
              onChange={() => setFramingType(type)} 
              style={{ marginRight: '6px' }}
            />
            {type === 'charCount' && "Character Count Header"}
            {type === 'charStuff' && "Character Stuffing [DLE STX]"}
            {type === 'bitStuff' && "Bit Stuffing Flags"}
          </label>
        ))}
      </div>

      {/* --- Subnet Tree Distances / Edge Weights Modifier --- */}
      <div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffc107' }}>Network Edge Distances</span>
            <div style={{ fontSize: '10px', color: '#aaa' }}>
              Path Cost: <strong style={{ color: '#00f7ff' }}>{shortestPathCost}</strong> ({shortestPath.join(' → ')})
            </div>
          </div>
          <button 
            onClick={() => setShowDistanceControls(!showDistanceControls)} 
            style={{ ...smallBtnStyle, fontSize: '10px', padding: '2px 8px' }}
          >
            {showDistanceControls ? "Hide" : "Modify"}
          </button>
        </div>

        {showDistanceControls && (
          <div style={{ background: '#1c1c1c', padding: '8px', borderRadius: '4px', border: '1px solid #333', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#888', fontSize: '10px' }}>Link (Node ↔ Node)</span>
              <button 
                onClick={resetGraphWeights} 
                style={{ background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', fontSize: '10px', textDecoration: 'underline', padding: 0 }}
              >
                Reset Defaults
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {uniqueEdges.map(edge => {
                const isShortestPathEdge = shortestPath && shortestPath.some((node, i) => {
                  if (i === shortestPath.length - 1) return false;
                  const nextNode = shortestPath[i + 1];
                  return (node === edge.from && nextNode === edge.to) || (node === edge.to && nextNode === edge.from);
                });

                return (
                  <div 
                    key={`${edge.from}-${edge.to}`} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      background: isShortestPathEdge ? '#2b2609' : '#262626', 
                      border: isShortestPathEdge ? '1px solid #ffc107' : '1px solid #3a3a3a',
                      padding: '3px 6px', 
                      borderRadius: '3px' 
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: isShortestPathEdge ? '#ffc107' : '#ddd' }}>
                      {edge.from} ↔ {edge.to}:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <button 
                        onClick={() => updateEdgeWeight(edge.from, edge.to, Math.max(1, edge.weight - 1))}
                        style={{ ...smallBtnStyle, padding: '0 4px', fontSize: '10px' }}
                      >-</button>
                      <span style={{ minWidth: '16px', textAlign: 'center', fontWeight: 'bold', color: '#00f7ff' }}>
                        {edge.weight}
                      </span>
                      <button 
                        onClick={() => updateEdgeWeight(edge.from, edge.to, edge.weight + 1)}
                        style={{ ...smallBtnStyle, padding: '0 4px', fontSize: '10px' }}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
