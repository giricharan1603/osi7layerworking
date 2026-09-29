import React, { useState, useEffect, useRef } from 'react';
import NetworkCanvas from './NetworkCanvas';
import ProtocolPanels from './ProtocolPanels';
import { encryptData, decryptData } from '../utils/crypto';
import { applyFraming, stripFraming } from '../utils/framing';
import { findShortestPath, generateBroadcastTree } from '../utils/routing';

const SUBNET_GRAPH = {
  A: { B: 4, C: 2 }, B: { A: 4, C: 1, D: 5 }, C: { A: 2, B: 1, D: 8, E: 10 },
  D: { B: 5, C: 8, E: 2, F: 4 }, E: { C: 10, D: 2, F: 3 }, F: { D: 4, E: 3 }
};

export default function Dashboard() {
  const [inputText, setInputText] = useState("HELLO LAB");
  const [encrypted, setEncrypted] = useState("");
  const [framingType, setFramingType] = useState("charCount");
  const [frameQueue, setFrameQueue] = useState([]);
  const [activePackets, setActivePackets] = useState([]);
  
  // Go-Back-N Window Controls
  const [windowSize] = useState(3);
  const [baseAck, setBaseAck] = useState(0);
  const [nextSeqNum, setNextSeqNum] = useState(0);

  // Leaky Bucket State Variables
  const [bucketLevel, setBucketLevel] = useState(0);
  const bucketCapacity = 30;
  const leakRate = 5; 

  // Routing State
  const [shortestPath, setShortestPath] = useState(['A', 'F']); 
  const [broadcastEdges, setBroadcastEdges] = useState([]);
  const [showBroadcast, setShowBroadcast] = useState(false);

  // Destination Sorting & Integrity Buffers
  const [receiverBuffer, setReceiverBuffer] = useState([]);
  const [finalOutput, setFinalOutput] = useState("");

  useEffect(() => {
    // Compile dynamic shortest path structure values via Dijkstra
    const path = findShortestPath(SUBNET_GRAPH, 'A', 'F');
    if (path && path.length > 0) {
      setShortestPath(path);
    }
    const bTree = generateBroadcastTree(SUBNET_GRAPH, 'A');
    setBroadcastEdges(bTree);
  }, []);

  // Continuous background running loop executing the Leaky Bucket logic
  useEffect(() => {
    const interval = setInterval(() => {
      setBucketLevel(prev => {
        if (prev <= 0) return 0;
        return Math.max(prev - (leakRate / 10), 0);
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Frame sliding engine coordinator for sending packets
  useEffect(() => {
    if (frameQueue.length === 0) return;

    if (nextSeqNum < baseAck + windowSize && nextSeqNum < frameQueue.length) {
      const frameToSend = frameQueue[nextSeqNum];
      
      // Inject inside network link array pipeline vector parameters
      setActivePackets(prev => [...prev, {
        id: frameToSend.id,
        rawFrame: frameToSend.rawFrame,
        status: 'in-transit',
        currentHopIndex: 0,
        progress: 0.0,
        speed: 0.015
      }]);

      setNextSeqNum(prev => prev + 1);
    }
  }, [frameQueue, nextSeqNum, baseAck, windowSize]);

  const triggerPipeline = () => {
    if (!inputText) return;
    
    // Reset pipeline state cleanly
    setReceiverBuffer([]);
    setFinalOutput("");
    setActivePackets([]);
    
    // 1. Encryption
    const cipherText = encryptData(inputText);
    setEncrypted(cipherText);

    // 2. Leaky Bucket constraint evaluation
    const payloadSize = cipherText.length;
    if (bucketLevel + payloadSize > bucketCapacity) {
      alert("Traffic Shaper Overflow! Leaky bucket is full. Wait for buffer leak.");
      return;
    }
    setBucketLevel(prev => prev + payloadSize);

    // 3. Framing & CRC creation breakdown
    const chunks = cipherText.match(/.{1,2}/g) || [];
    const generatedFrames = chunks.map((chunk, index) => {
      const framedString = applyFraming(chunk, framingType);
      return { id: index, rawFrame: framedString, cleanChunk: chunk };
    });

    setFrameQueue(generatedFrames);
    setBaseAck(0);
    setNextSeqNum(0);
  };

  const handlePacketArrival = (packet) => {
    const decoded = stripFraming(packet.rawFrame, framingType);

    setReceiverBuffer(prev => {
      // Concept 8: Frame Sorting execution buffer inserts
      const updated = [...prev.filter(item => item.id !== packet.id), {
        id: packet.id,
        payload: decoded.payload,
        isValid: decoded.isValid && packet.status !== 'corrupted'
      }].sort((a, b) => a.id - b.id);

      // Verify continuous transmission block sequence matches sliding base
      const nextExpectedAck = packet.id === baseAck ? baseAck + 1 : baseAck;
      let checkAck = nextExpectedAck;
      while (updated.some(item => item.id === checkAck && item.isValid)) {
        checkAck++;
      }
      
      if (checkAck !== baseAck) {
        setBaseAck(checkAck);
        
        // Process decryption if all frames arrived securely
        if (checkAck === frameQueue.length) {
          const assembledCipherText = updated.map(item => item.payload).join('');
          setFinalOutput(decryptData(assembledCipherText));
        }
      }
      return updated;
    });
  };

  const handlePacketCorrupted = (id) => {
    // Go-Back-N Protocol error behavior: Reset window sequencer variables back to base ACK boundaries
    setTimeout(() => {
      setActivePackets([]);
      setNextSeqNum(baseAck);
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#121212', color: '#e0e0e0', fontFamily: 'Segoe UI, sans-serif' }}>
      
      {/* Left Configuration Control Hub Panel */}
      <div style={{ width: '320px', padding: '20px', borderRight: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#ffc107' }}>NetForge Protocol Suite</h3>
        
        <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Message Payload Input:</label>
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)}
          style={{ background: '#1e1e1e', border: '1px solid #444', color: '#fff', padding: '8px', borderRadius: '4px', margin: '6px 0 15px 0' }}
        />

        <ProtocolPanels 
          bucketLevel={bucketLevel} bucketCapacity={bucketCapacity} 
          leakRate={leakRate} framingType={framingType} setFramingType={setFramingType} 
        />

        <button onClick={triggerPipeline} style={{ background: '#28a745', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
          Execute Transmission Stream
        </button>

        <button onClick={() => setShowBroadcast(!showBroadcast)} style={{ background: '#007bff', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          {showBroadcast ? "View Dijkstra Paths Route" : "Show Subnet Spanning Broadcast Tree"}
        </button>
      </div>

      {/* Main Graph Canvas and Logging Console Panels Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '20px' }}>
        
        {/* Sliding Window Frame Queue Buffer Visualizer Header Row */}
        <div style={{ background: '#1e1e1e', padding: '15px', borderRadius: '6px', border: '1px solid #2d2d2d' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#ffc107' }}>Go-Back-N Transmit Sliding Window Ring Buffer</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {frameQueue.length === 0 && <span style={{ fontSize: '12px', color: '#666' }}>Queue empty. Init stream transmission.</span>}
            {frameQueue.map((f) => {
              const isActiveInWindow = f.id >= baseAck && f.id < baseAck + windowSize;
              const isConfirmed = f.id < baseAck;
              return (
                <div key={f.id} style={{
                  padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                  border: isActiveInWindow ? '2px solid #ffc107' : '1px solid #444',
                  background: isConfirmed ? '#28a745' : isActiveInWindow ? '#3a3010' : '#222'
                }}>
                  F#{f.id}
                </div>
              );
            })}
          </div>
        </div>

        {/* Network Layout Graph Visual Canvas Rendering Sandbox Area */}
        <div style={{ flex: 1, background: '#1e1e1e', borderRadius: '6px', overflow: 'hidden' }}>
          <NetworkCanvas 
            activePackets={activePackets} setActivePackets={setActivePackets}
            shortestPath={shortestPath} broadcastEdges={broadcastEdges} showBroadcast={showBroadcast}
            onPacketArrival={handlePacketArrival} onPacketCorrupted={handlePacketCorrupted}
          />
        </div>

        {/* Bottom Destination Stack Frame Assembler Tracker Readout Console Logs */}
        <div style={{ display: 'flex', gap: '20px', height: '140px' }}>
          <div style={{ flex: 1, background: '#1e1e1e', padding: '12px', borderRadius: '6px', border: '1px solid #2d2d2d', overflowY: 'auto' }}>
            <h5 style={{ margin: '0 0 8px 0', color: '#ffc107' }}>Receiver Sorting Buffer (Concept 8)</h5>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {receiverBuffer.map(item => (
                <div key={item.id} style={{ padding: '4px 8px', borderRadius: '3px', fontSize: '11px', background: item.isValid ? '#143a1a' : '#501414', border: `1px solid ${item.isValid ? '#28a745' : '#dc3545'}` }}>
                  Seq #{item.id} : {item.payload} [{item.isValid ? "CRC OK" : "CRC FAIL"}]
                </div>
              ))}
            </div>
          </div>
          
                    <div style={{ width: '280px', background: '#1e1e1e', padding: '12px', borderRadius: '6px', border: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '11px', color: '#aaa' }}>
              Encrypted Ciphertext: <span style={{ color: '#ffc107' }}>{encrypted || "None"}</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '10px' }}>
              Final Decrypted Output:
            </div>
            <div style={{ fontSize: '20px', color: '#28a745', fontWeight: 'bold', marginTop: '4px', letterSpacing: '1px' }}>
              {finalOutput || "..."}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
