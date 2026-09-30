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
  shortestPath,
  isDarkMode = true
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
    background: isDarkMode ? '#2d2d2d' : '#f1f5f9',
    color: isDarkMode ? '#00f7ff' : '#0284c7',
    border: isDarkMode ? '1px solid #444' : '1px solid #cbd5e1',
    borderRadius: '3px',
    padding: '2px 6px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 'bold'
  };

  return (
    <div 
      className="no-scrollbar"
      style={{
        background: isDarkMode ? '#252526' : '#f8fafc',
        padding: '10px 12px',
        borderRadius: '6px',
        marginBottom: '10px',
        border: isDarkMode ? '1px solid #333' : '1px solid #e2e8f0',
        color: isDarkMode ? '#e0e0e0' : '#1e293b',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      <h4 style={{ margin: '0 0 8px 0', color: isDarkMode ? '#00f7ff' : '#0284c7', fontSize: '12px' }}>Traffic Shaper & Framing Controls</h4>
      
      {/* --- Leaky Bucket (Simple & Clean UI) --- */}
      <div style={{
        marginBottom: '8px',
        background: isDarkMode ? '#1c1c1c' : '#ffffff',
        padding: '8px 10px',
        borderRadius: '6px',
        border: isDarkMode ? '1px solid #333' : '1px solid #e2e8f0',
        boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        
        {/* Status Line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '11px' }}>
          <span style={{ fontWeight: 'bold', color: isDarkMode ? '#ddd' : '#334155' }}>Leaky Bucket Buffer:</span>
          <span style={{ fontWeight: 'bold', color: percentage > 85 ? '#dc3545' : percentage > 60 ? '#ffc107' : '#28a745' }}>
            {bucketLevel.toFixed(1)} / {bucketCapacity} B ({percentage.toFixed(0)}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '6px', background: '#111', border: '1px solid #444', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
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
          paddingTop: '6px', 
          borderTop: isDarkMode ? '1px solid #2a2a2a' : '1px solid #e2e8f0', 
          fontSize: '11px', 
          color: isDarkMode ? '#aaa' : '#64748b' 
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>Size:</span>
            <select 
              value={bucketCapacity} 
              onChange={(e) => setBucketCapacity(Number(e.target.value))}
              style={{ background: isDarkMode ? '#252526' : '#f1f5f9', color: isDarkMode ? '#fff' : '#0f172a', border: isDarkMode ? '1px solid #555' : '1px solid #cbd5e1', borderRadius: '3px', padding: '2px 4px', fontSize: '11px', cursor: 'pointer' }}
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
              style={{ background: isDarkMode ? '#252526' : '#f1f5f9', color: isDarkMode ? '#fff' : '#0f172a', border: isDarkMode ? '1px solid #555' : '1px solid #cbd5e1', borderRadius: '3px', padding: '2px 4px', fontSize: '11px', cursor: 'pointer' }}
            >
              <option value={2}>2 B/s (Slow)</option>
              <option value={5}>5 B/s (Normal)</option>
              <option value={10}>10 B/s (Fast)</option>
            </select>
          </label>
        </div>

      </div>

      {/* --- Layer 2 Framing Model Selection --- */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: isDarkMode ? '#ffc107' : '#b45309' }}>Layer 2 Framing Model:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {['charCount', 'charStuff', 'bitStuff'].map((type) => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', fontSize: '11px', margin: '1px 0', cursor: 'pointer' }}>
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
      </div>

      {/* --- Subnet Tree Distances / Edge Weights Modifier --- */}
      <div style={{ borderTop: isDarkMode ? '1px solid #333' : '1px solid #e2e8f0', paddingTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: isDarkMode ? '#ffc107' : '#b45309' }}>Network Edge Distances</span>
            <div style={{ fontSize: '10px', color: isDarkMode ? '#aaa' : '#64748b' }}>
              Path Cost: <strong style={{ color: isDarkMode ? '#00f7ff' : '#0284c7' }}>{shortestPathCost}</strong> ({shortestPath.join(' → ')})
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
          <div style={{ background: isDarkMode ? '#1c1c1c' : '#ffffff', padding: '8px', borderRadius: '4px', border: isDarkMode ? '1px solid #333' : '1px solid #e2e8f0', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: isDarkMode ? '#888' : '#64748b', fontSize: '10px' }}>Link (Node ↔ Node)</span>
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
                      background: isShortestPathEdge ? (isDarkMode ? '#2b2609' : '#fef3c7') : (isDarkMode ? '#262626' : '#f1f5f9'), 
                      border: isShortestPathEdge ? '1px solid #ffc107' : (isDarkMode ? '1px solid #3a3a3a' : '1px solid #e2e8f0'),
                      padding: '3px 6px', 
                      borderRadius: '3px' 
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: isShortestPathEdge ? (isDarkMode ? '#ffc107' : '#b45309') : (isDarkMode ? '#ddd' : '#1e293b') }}>
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
