import { useState, useEffect, useRef, useMemo } from 'react';
import NetworkCanvas from './NetworkCanvas';
import ProtocolPanels from './ProtocolPanels';
import { encryptData, decryptData } from '../utils/crypto';
import { applyFraming, stripFraming } from '../utils/framing';
import { findShortestPath, generateBroadcastTree } from '../utils/routing';
import bannerLogo from '../assets/kgc-banner.png';
import brandLogo from '../assets/kgc-brand-logo.png';
import brandFavicon from '../assets/kgc-favicon.jpg';

const DEFAULT_GRAPH = {
  A: { B: 4, C: 2 }, 
  B: { A: 4, C: 1, D: 5 }, 
  C: { A: 2, B: 1, D: 8, E: 10 },
  D: { B: 5, C: 8, E: 2, F: 4 }, 
  E: { C: 10, D: 2, F: 3 }, 
  F: { D: 4, E: 3 }
};

const BASE_SPEED = 0.015;

export default function Dashboard() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('kgc_theme');
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('kgc_theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

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
  const [bucketCapacity, setBucketCapacity] = useState(30);
  const [leakRate, setLeakRate] = useState(5); 

  // Dynamic Subnet Topology & Routing State
  const [subnetGraph, setSubnetGraph] = useState(DEFAULT_GRAPH);
  const [startNode, setStartNode] = useState('A');
  const [endNode, setEndNode] = useState('F');
  const [showBroadcast, setShowBroadcast] = useState(false);

  // Speed and Noise Controls
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [simulateNoise, setSimulateNoise] = useState(false);
  const noiseInjectedRef = useRef(false);
  
  // Manual Retransmission State
  const [retransmittingInfo, setRetransmittingInfo] = useState(null);

  // Receiver Approval & Buffer Controls
  const [ackMode, setAckMode] = useState('auto'); // 'auto' | 'manual'
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [receiverBuffer, setReceiverBuffer] = useState([]);
  const [finalOutput, setFinalOutput] = useState("");

  // Computed shortest path & broadcast tree using useMemo (no cascading renders)
  const shortestPath = useMemo(() => {
    if (startNode === endNode) return [startNode];
    const path = findShortestPath(subnetGraph, startNode, endNode);
    return path && path.length > 0 ? path : [startNode, endNode];
  }, [subnetGraph, startNode, endNode]);

  const broadcastEdges = useMemo(() => {
    return generateBroadcastTree(subnetGraph, startNode);
  }, [subnetGraph, startNode]);

  const updateEdgeWeight = (u, v, weight) => {
    setSubnetGraph(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      if (!updated[u]) updated[u] = {};
      if (!updated[v]) updated[v] = {};
      updated[u][v] = weight;
      updated[v][u] = weight;
      return updated;
    });
  };

  const resetGraphWeights = () => {
    setSubnetGraph(DEFAULT_GRAPH);
  };

  // Continuous background running loop executing Leaky Bucket leak logic
  useEffect(() => {
    const interval = setInterval(() => {
      setBucketLevel(prev => {
        if (prev <= 0) return 0;
        return Math.max(prev - (leakRate / 10), 0);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [leakRate]);

  // Adjust packet speeds dynamically for in-flight packets
  const handleSpeedChange = (newMult) => {
    const clamped = Math.max(0.2, Math.min(4.0, Math.round(newMult * 100) / 100));
    setSpeedMultiplier(clamped);
    setActivePackets(prev => prev.map(p => ({
      ...p,
      speed: BASE_SPEED * clamped
    })));
  };

  // Frame sliding engine coordinator for sending packets
  useEffect(() => {
    if (frameQueue.length === 0) return;
    if (retransmittingInfo) return; // Pause while waiting for manual retransmission button click

    if (nextSeqNum < baseAck + windowSize && nextSeqNum < frameQueue.length) {
      const timer = setTimeout(() => {
        const frameToSend = frameQueue[nextSeqNum];
        
        // If user enabled "Simulate Noise", automatically inject CRC error into frame #1 on first attempt
        let willCorrupt = false;
        if (simulateNoise && !noiseInjectedRef.current && (nextSeqNum === 1 || frameQueue.length === 1)) {
          willCorrupt = true;
          noiseInjectedRef.current = true;
        }
        
        setActivePackets(prev => [...prev, {
          id: frameToSend.id,
          rawFrame: frameToSend.rawFrame,
          status: willCorrupt ? 'corrupted' : 'in-transit',
          currentHopIndex: 0,
          progress: 0.0,
          speed: BASE_SPEED * speedMultiplier
        }]);

        setNextSeqNum(prev => prev + 1);
      }, 40);

      return () => clearTimeout(timer);
    }
  }, [frameQueue, nextSeqNum, baseAck, windowSize, speedMultiplier, simulateNoise, retransmittingInfo]);

  const triggerPipeline = () => {
    if (!inputText) return;
    
    // Reset pipeline state cleanly
    setReceiverBuffer([]);
    setPendingApprovals([]);
    setFinalOutput("");
    setActivePackets([]);
    setRetransmittingInfo(null);
    noiseInjectedRef.current = false;
    
    // 1. Encryption
    const cipherText = encryptData(inputText);
    setEncrypted(cipherText);

    // 2. Leaky Bucket constraint evaluation
    const payloadSize = cipherText.length;
    if (bucketLevel + payloadSize > bucketCapacity) {
      alert(`Traffic Shaper Overflow! Leaky bucket is full (${bucketLevel.toFixed(1)} + ${payloadSize} > ${bucketCapacity} B). Wait for buffer leak or increase capacity.`);
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

  // Called when a packet arrives at Destination Node F
  const handlePacketArrival = (packet) => {
    const decoded = stripFraming(packet.rawFrame, framingType);
    const isCorrupted = packet.status === 'corrupted' || !decoded.isValid;

    if (isCorrupted) {
      // 1. Destination detects CRC error and discards the packet
      setReceiverBuffer(prev => {
        const updated = [...prev.filter(item => item.id !== packet.id), {
          id: packet.id,
          payload: decoded.payload,
          isValid: false
        }].sort((a, b) => a.id - b.id);
        return updated;
      });

      // 2. Activate manual retransmit button prompt
      setRetransmittingInfo({
        failedId: packet.id,
        fromAck: baseAck
      });

      return;
    }

    // Packet is valid!
    if (ackMode === 'manual') {
      setPendingApprovals(prev => {
        if (prev.some(p => p.id === packet.id)) return prev;
        return [...prev, packet];
      });
      return;
    }

    processPacketApproval(packet);
  };

  // Manual Retransmission Execution
  const triggerRetransmit = () => {
    setRetransmittingInfo(null);
    setActivePackets([]);
    setNextSeqNum(baseAck); // Rewind window sequence back to baseAck to retransmit
  };

  const processPacketApproval = (packet) => {
    const decoded = stripFraming(packet.rawFrame, framingType);

    setReceiverBuffer(prev => {
      const updated = [...prev.filter(item => item.id !== packet.id), {
        id: packet.id,
        payload: decoded.payload,
        isValid: true
      }].sort((a, b) => a.id - b.id);

      // Verify continuous transmission sequence matches sliding base
      const nextExpectedAck = packet.id === baseAck ? baseAck + 1 : baseAck;
      let checkAck = nextExpectedAck;
      while (updated.some(item => item.id === checkAck && item.isValid)) {
        checkAck++;
      }
      
      if (checkAck !== baseAck) {
        setBaseAck(checkAck);
        
        // Decrypt message if all frames are acknowledged
        if (checkAck === frameQueue.length) {
          const assembledCipherText = updated.map(item => item.payload).join('');
          setFinalOutput(decryptData(assembledCipherText));
        }
      }
      return updated;
    });

    setPendingApprovals(prev => prev.filter(p => p.id !== packet.id));
  };

  const approveSinglePacket = (packet) => {
    processPacketApproval(packet);
  };

  const approveAllPending = () => {
    pendingApprovals.forEach(p => {
      processPacketApproval(p);
    });
    setPendingApprovals([]);
  };

  const toggleAckMode = (newMode) => {
    setAckMode(newMode);
    if (newMode === 'auto' && pendingApprovals.length > 0) {
      pendingApprovals.forEach(p => processPacketApproval(p));
      setPendingApprovals([]);
    }
  };

  const handlePacketCorrupted = (id) => {
    setActivePackets(prev => prev.map(p => p.id === id ? { ...p, status: 'corrupted' } : p));
  };

  const hasCorruptedFrames = receiverBuffer.some(item => !item.isValid);

  const handleToggleMode = (newBroadcastState) => {
    setShowBroadcast(newBroadcastState);
    // Safely reset in-flight packet streams and buffers to prevent sliding window freeze
    setActivePackets([]);
    setFrameQueue([]);
    setBaseAck(0);
    setNextSeqNum(0);
    setRetransmittingInfo(null);
    setPendingApprovals([]);
    setReceiverBuffer([]);
    setFinalOutput("");
    noiseInjectedRef.current = false;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: isDarkMode ? '#121212' : '#f4f6f9',
      color: isDarkMode ? '#e0e0e0' : '#1e293b',
      fontFamily: 'Segoe UI, sans-serif',
      overflow: 'hidden',
      transition: 'background 0.25s ease, color 0.25s ease'
    }}>
      
      {/* Main Workspace (Left Hub + Canvas & Panels) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left Configuration Control Hub Panel */}
        {/* Left Configuration Control Hub Panel */}
        <div 
          className="no-scrollbar"
          style={{
            width: '320px',
            padding: '12px 14px',
            borderRight: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            background: isDarkMode ? '#16181d' : '#ffffff',
            color: isDarkMode ? '#e0e0e0' : '#1e293b',
            transition: 'background 0.25s ease, border-color 0.25s ease'
          }}
        >
          
          {/* Brand Header: KGC OSI - 7 Banner Image at Top */}
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <img 
              src={bannerLogo} 
              alt="KGC OSI - 7 Network Architecture Suite" 
              style={{ 
                width: '100%', 
                maxHeight: '80px',
                objectFit: 'contain',
                borderRadius: '6px', 
                display: 'block',
                boxShadow: isDarkMode 
                  ? '0 0 14px rgba(0, 247, 255, 0.2)' 
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                transition: 'box-shadow 0.25s ease'
              }} 
            />
          </div>
        
        <label style={{ fontSize: '11px', fontWeight: 'bold', color: isDarkMode ? '#e0e0e0' : '#334155' }}>Message Payload Input:</label>
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)}
          style={{
            background: isDarkMode ? '#1e1e1e' : '#f8fafc',
            border: isDarkMode ? '1px solid #444' : '1px solid #cbd5e1',
            color: isDarkMode ? '#fff' : '#0f172a',
            padding: '5px 8px',
            borderRadius: '4px',
            margin: '2px 0 6px 0',
            fontSize: '11px'
          }}
        />

        {/* Starting and Ending Positions Selector */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <label style={{ flex: 1, fontSize: '11px', color: isDarkMode ? '#ccc' : '#475569' }}>
            <span style={{ fontWeight: 'bold', color: '#28a745' }}>
              {showBroadcast ? "🟢 Root:" : "🟢 Start:"}
            </span>
            <select 
              value={startNode} 
              onChange={(e) => setStartNode(e.target.value)}
              style={{
                width: '100%',
                background: isDarkMode ? '#1e1e1e' : '#f8fafc',
                color: isDarkMode ? '#fff' : '#0f172a',
                border: isDarkMode ? '1px solid #444' : '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '4px',
                marginTop: '2px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              {['A', 'B', 'C', 'D', 'E', 'F'].map(n => (
                <option key={n} value={n} disabled={!showBroadcast && n === endNode}>{n}</option>
              ))}
            </select>
          </label>

          <label style={{ flex: 1, fontSize: '11px', color: isDarkMode ? '#ccc' : '#475569' }}>
            <span style={{ fontWeight: 'bold', color: showBroadcast ? '#00f7ff' : '#dc3545' }}>
              {showBroadcast ? "🌐 Target:" : "🔴 End:"}
            </span>
            {showBroadcast ? (
              <div style={{ 
                background: isDarkMode ? '#0c2e35' : '#e0f2fe', 
                border: isDarkMode ? '1px solid #00f7ff' : '1px solid #0284c7', 
                color: isDarkMode ? '#00f7ff' : '#0369a1', 
                borderRadius: '4px', 
                padding: '4px', 
                marginTop: '2px', 
                fontSize: '10px', 
                fontWeight: 'bold',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                All Nodes
              </div>
            ) : (
              <select 
                value={endNode} 
                onChange={(e) => setEndNode(e.target.value)}
                style={{
                  width: '100%',
                  background: isDarkMode ? '#1e1e1e' : '#f8fafc',
                  color: isDarkMode ? '#fff' : '#0f172a',
                  border: isDarkMode ? '1px solid #444' : '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '4px',
                  marginTop: '2px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
              >
                {['A', 'B', 'C', 'D', 'E', 'F'].map(n => (
                  <option key={n} value={n} disabled={n === startNode}>{n}</option>
                ))}
              </select>
            )}
          </label>
        </div>

        <ProtocolPanels 
          bucketLevel={bucketLevel} 
          bucketCapacity={bucketCapacity} 
          setBucketCapacity={setBucketCapacity}
          leakRate={leakRate} 
          setLeakRate={setLeakRate}
          framingType={framingType} 
          setFramingType={setFramingType}
          subnetGraph={subnetGraph}
          updateEdgeWeight={updateEdgeWeight}
          resetGraphWeights={resetGraphWeights}
          shortestPath={shortestPath}
          isDarkMode={isDarkMode}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          
          {/* Simple Noise Option Checkbox */}
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: simulateNoise ? '#381616' : (isDarkMode ? '#1e1e1e' : '#f1f5f9'), 
            border: simulateNoise ? '1px solid #dc3545' : (isDarkMode ? '1px solid #333' : '1px solid #cbd5e1'), 
            padding: '6px 8px', 
            borderRadius: '4px', 
            cursor: 'pointer' 
          }}>
            <input 
              type="checkbox" 
              checked={simulateNoise} 
              onChange={(e) => setSimulateNoise(e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#dc3545' }}
            />
            <div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: simulateNoise ? '#ff7878' : (isDarkMode ? '#ddd' : '#1e293b') }}>
                ⚡ Simulate Channel Noise
              </div>
              <div style={{ fontSize: '9px', color: isDarkMode ? '#888' : '#64748b' }}>
                Injects CRC error to test Go-Back-N manual retransmission
              </div>
            </div>
          </label>

          <button 
            onClick={triggerPipeline} 
            style={{ 
              background: showBroadcast ? '#00b4d8' : '#28a745', 
              color: '#fff', 
              border: 'none', 
              padding: '8px', 
              borderRadius: '4px', 
              fontWeight: 'bold', 
              fontSize: '12px',
              cursor: 'pointer' 
            }}
          >
            {showBroadcast ? "🌐 Broadcast Across Spanning Tree" : "Execute Transmission Stream"}
          </button>

          <button 
            onClick={() => handleToggleMode(!showBroadcast)} 
            style={{ background: '#007bff', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
          >
            {showBroadcast ? "View Dijkstra Shortest Path" : "Show Subnet Spanning Broadcast Tree"}
          </button>
        </div>
      </div>

      {/* Main Graph Canvas and Logging Console Panels Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '14px', boxSizing: 'border-box', overflowY: 'auto' }}>
        
        {/* Sliding Window Frame Queue Buffer Visualizer Header Row */}
        <div style={{
          background: isDarkMode ? '#1e1e1e' : '#ffffff',
          padding: '12px 16px',
          borderRadius: '6px',
          border: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e8f0',
          boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, color: isDarkMode ? '#ffc107' : '#b45309', fontSize: '14px' }}>
              Go-Back-N Transmit Sliding Window Ring Buffer (Window Size: {windowSize})
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#64748b' }}>
                Base ACK: <strong style={{ color: '#28a745' }}>{baseAck}</strong> | Next Seq: <strong style={{ color: isDarkMode ? '#ffc107' : '#b45309' }}>{nextSeqNum}</strong>
              </span>

              {/* Dark Mode Option at Right Side Top Corner */}
              <button
                onClick={toggleTheme}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, #1f2937, #111827)' 
                    : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                  color: isDarkMode ? '#00f7ff' : '#0f172a',
                  border: isDarkMode ? '1px solid #00f7ff66' : '1px solid #94a3b8',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: isDarkMode 
                    ? '0 0 10px rgba(0, 247, 255, 0.2)' 
                    : '0 2px 4px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.2s ease',
                  userSelect: 'none'
                }}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                <span>{isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
              </button>
            </div>
          </div>

          {/* Prominent Manual Retransmit Action Banner */}
          {retransmittingInfo && (
            <div style={{
              background: '#3d1616',
              border: '1px solid #dc3545',
              padding: '10px 14px',
              borderRadius: '6px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <div style={{ color: '#ff6666', fontWeight: 'bold', fontSize: '13px' }}>
                  ⚠️ CRC Error on Frame F#{retransmittingInfo.failedId}!
                </div>
                <div style={{ fontSize: '11px', color: '#ccc', marginTop: '2px' }}>
                  {showBroadcast 
                    ? "Subnet nodes detected CRC error and discarded the frame. Click the button to retransmit:" 
                    : `Destination Node ${endNode} discarded the frame. Click the button to retransmit:`}
                </div>
              </div>

              <button
                onClick={triggerRetransmit}
                style={{
                  background: '#28a745',
                  color: '#fff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 0 10px rgba(40,167,69,0.5)'
                }}
              >
                🔄 Retransmit From Frame F#{baseAck}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {frameQueue.length === 0 && <span style={{ fontSize: '12px', color: '#666' }}>Queue empty. Init stream transmission.</span>}
            {frameQueue.map((f) => {
              const isActiveInWindow = f.id >= baseAck && f.id < baseAck + windowSize;
              const isConfirmed = f.id < baseAck;
              const inTransitPacket = activePackets.find(p => p.id === f.id);
              const isCorrupted = inTransitPacket && inTransitPacket.status === 'corrupted';

              return (
                <div key={f.id} style={{
                  padding: '6px 14px', 
                  borderRadius: '4px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  border: isCorrupted ? '2px solid #dc3545' : isActiveInWindow ? '2px solid #ffc107' : '1px solid #444',
                  background: isCorrupted ? '#4a1414' : isConfirmed ? '#1e4620' : isActiveInWindow ? '#3a3010' : '#222',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>F#{f.id}</span>
                  {isConfirmed && <span style={{ color: '#28a745' }}>✓</span>}
                  {isCorrupted && <span style={{ color: '#ff6666', fontSize: '10px' }}>CRC ERR</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Network Layout Graph Visual Canvas */}
        <div style={{
          flex: 1,
          minHeight: '340px',
          background: isDarkMode ? '#1e1e1e' : '#ffffff',
          borderRadius: '6px',
          overflow: 'hidden',
          border: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e8f0',
          boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <NetworkCanvas 
            activePackets={activePackets} 
            shortestPath={shortestPath} 
            broadcastEdges={broadcastEdges} 
            showBroadcast={showBroadcast}
            setShowBroadcast={handleToggleMode}
            onPacketArrival={handlePacketArrival} 
            onPacketCorrupted={handlePacketCorrupted}
            subnetGraph={subnetGraph}
            speedMultiplier={speedMultiplier}
            onSpeedChange={handleSpeedChange}
            startNode={startNode}
            endNode={endNode}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Bottom Destination Stack Frame Assembler Tracker Readout Console Logs */}
        <div style={{ display: 'flex', gap: '16px', minHeight: '140px' }}>
          
          {/* Receiver Buffer with Manual/Auto Approve controls & Manual Retransmit */}
          <div style={{
            flex: 1,
            background: isDarkMode ? '#1e1e1e' : '#ffffff',
            padding: '12px 16px',
            borderRadius: '6px',
            border: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e8f0',
            overflowY: 'auto',
            boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h5 style={{ margin: 0, color: showBroadcast ? (isDarkMode ? '#00f7ff' : '#0284c7') : (isDarkMode ? '#ffc107' : '#b45309'), fontSize: '13px' }}>
                  {showBroadcast 
                    ? `Receiver Buffer (Broadcast Tree: Delivered to Subnet Nodes)` 
                    : `Receiver Sorting Buffer (Destination Node ${endNode})`}
                </h5>
                {hasCorruptedFrames && (
                  <button
                    onClick={triggerRetransmit}
                    style={{
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    title="Click to retransmit unacknowledged frames starting from base ACK"
                  >
                    🔄 Retransmit From Frame F#{baseAck}
                  </button>
                )}
              </div>
              
              {/* ACK Mode Switch: Auto vs Manual Approve */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <span style={{ color: '#aaa' }}>ACK Mode:</span>
                <button
                  onClick={() => toggleAckMode('auto')}
                  style={{
                    background: ackMode === 'auto' ? '#28a745' : '#333',
                    color: '#fff',
                    border: ackMode === 'auto' ? '1px solid #5cb85c' : '1px solid #555',
                    borderRadius: '3px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: ackMode === 'auto' ? 'bold' : 'normal'
                  }}
                >
                  ⚡ Auto ACK
                </button>
                <button
                  onClick={() => toggleAckMode('manual')}
                  style={{
                    background: ackMode === 'manual' ? '#007bff' : '#333',
                    color: '#fff',
                    border: ackMode === 'manual' ? '1px solid #00f7ff' : '1px solid #555',
                    borderRadius: '3px',
                    padding: '2px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: ackMode === 'manual' ? 'bold' : 'normal'
                  }}
                >
                  ✋ Manual Approve
                </button>
              </div>
            </div>

            {/* Pending Approvals Queue (Appears when in Manual Mode) */}
            {pendingApprovals.length > 0 && (
              <div style={{ 
                background: '#1d273b', 
                border: '1px solid #007bff', 
                borderRadius: '4px', 
                padding: '6px 10px', 
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                <div style={{ fontSize: '11px', color: '#90caf9' }}>
                  ⏳ <strong>{pendingApprovals.length}</strong> packet(s) arrived. Waiting for receiver manual approval:
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {pendingApprovals.map(p => (
                    <button
                      key={p.id}
                      onClick={() => approveSinglePacket(p)}
                      style={{
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Approve F#{p.id}
                    </button>
                  ))}
                  {pendingApprovals.length > 1 && (
                    <button
                      onClick={approveAllPending}
                      style={{
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Approve All
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Acknowledged / Validated Receiver Buffer Badges */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {receiverBuffer.length === 0 && (
                <span style={{ fontSize: '11px', color: '#666' }}>No frames arrived yet.</span>
              )}
              {receiverBuffer.map(item => (
                <div 
                  key={item.id} 
                  style={{ 
                    padding: '4px 8px', 
                    borderRadius: '3px', 
                    fontSize: '11px', 
                    background: item.isValid ? '#143a1a' : '#501414', 
                    border: `1px solid ${item.isValid ? '#28a745' : '#dc3545'}` 
                  }}
                >
                  Seq #{item.id} : <strong>{item.payload}</strong> [{item.isValid ? (showBroadcast ? "ALL NODES OK" : "CRC OK") : "CRC FAIL"}]
                </div>
              ))}
            </div>

          </div>
          
          {/* Final Decrypted Result Console */}
          <div style={{
            width: '280px',
            background: isDarkMode ? '#1e1e1e' : '#ffffff',
            padding: '12px 16px',
            borderRadius: '6px',
            border: isDarkMode ? '1px solid #2d2d2d' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{ fontSize: '11px', color: isDarkMode ? '#aaa' : '#64748b' }}>
              Encrypted Ciphertext: <span style={{ color: isDarkMode ? '#ffc107' : '#b45309', fontFamily: 'monospace' }}>{encrypted || "None"}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '8px', color: isDarkMode ? '#e0e0e0' : '#1e293b' }}>
              Final Decrypted Output:
            </div>
            <div style={{ fontSize: '20px', color: '#28a745', fontWeight: 'bold', marginTop: '4px', letterSpacing: '1px' }}>
              {finalOutput || "..."}
            </div>
          </div>

        </div>

      </div>

    </div>

    {/* Official KGC Brand Footer */}
      <footer style={{
        background: isDarkMode ? '#15181e' : '#ffffff',
        borderTop: isDarkMode ? '1px solid #262c37' : '1px solid #e2e8f0',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '12px',
        color: isDarkMode ? '#9aa0a6' : '#64748b',
        zIndex: 20,
        boxShadow: isDarkMode ? '0 -3px 12px rgba(0, 0, 0, 0.45)' : '0 -2px 8px rgba(0, 0, 0, 0.08)',
        transition: 'background 0.25s ease, border-color 0.25s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={brandFavicon} 
            alt="KGC Favicon" 
            style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1.5px solid #00f7ff' }} 
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', color: '#00f7ff', fontSize: '13px', letterSpacing: '0.6px' }}>
              KGC  OSI - 7
            </span>
            <span style={{ color: '#444' }}>|</span>
            <span style={{ color: '#b0b8c4', fontSize: '11px' }}>
              Comprehensive 7-Layer OSI Architecture &amp; Protocol Simulation Platform
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <img 
              src={brandLogo} 
              alt="KGC Brand" 
              style={{ height: '20px', width: 'auto', display: 'block' }} 
            />
          </div>
          <div style={{ color: '#8c94a0', fontSize: '11px' }}>
            &copy; {new Date().getFullYear()} <strong style={{ color: '#ffffff' }}>KGC</strong> Brand. All rights reserved.
          </div>
          <div style={{
            background: 'rgba(0, 247, 255, 0.1)',
            border: '1px solid rgba(0, 247, 255, 0.3)',
            color: '#00f7ff',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '0.5px'
          }}>
            KGC OFFICIAL
          </div>
        </div>
      </footer>
    </div>
  );
}
