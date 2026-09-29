
import React from 'react';

export default function ProtocolPanels({ bucketLevel, bucketCapacity, leakRate, framingType, setFramingType }) {
  const percentage = Math.min((bucketLevel / bucketCapacity) * 100, 100);

  return (
    <div style={{ background: '#252526', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#00f7ff' }}>Traffic Shaper & Framing Controls</h4>
      
      {/* Leaky Bucket Monitoring UI */}
      <div style={{ marginBottom: '15px' }}>
        <div style={{ fontSize: '12px', marginBottom: '4px' }}>Leaky Bucket Buffer: {bucketLevel.toFixed(1)} / {bucketCapacity} bytes</div>
        <div style={{ width: '100%', height: '14px', bg: '#111', border: '1px solid #444', borderRadius: '3px', overflow: 'hidden', background: '#111' }}>
          <div style={{ width: `${percentage}%`, height: '100%', background: '#28a745', transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>Constant Constant Leak Rate: {leakRate} bytes/sec</div>
      </div>

      {/* Concept 1 selection checkboxes */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>Layer 2 Framing Model:</div>
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
    </div>
  );
}
