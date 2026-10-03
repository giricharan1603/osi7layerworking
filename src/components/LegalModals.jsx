export function LegalModal({ isOpen, type, onClose, isDarkMode }) {
  if (!isOpen) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms & Conditions';

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: isDarkMode ? '#1a1d24' : '#ffffff',
          color: isDarkMode ? '#e2e8f0' : '#1e293b',
          border: isDarkMode ? '1px solid #334155' : '1px solid #cbd5e1',
          borderRadius: '6px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: isDarkMode ? '1px solid #2d3748' : '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#00f7ff' : '#0284c7' }}>
              {title}
            </h3>
            <div style={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
              KGC OSI - 7 Platform Governance and Compliance
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: isDarkMode ? '1px solid #475569' : '1px solid #cbd5e1',
              borderRadius: '4px',
              color: isDarkMode ? '#cbd5e1' : '#475569',
              padding: '4px 10px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Close
          </button>
        </div>

        {/* Modal Body */}
        <div 
          className="no-scrollbar"
          style={{
            padding: '20px',
            overflowY: 'auto',
            fontSize: '13px',
            lineHeight: '1.6',
            color: isDarkMode ? '#cbd5e1' : '#334155'
          }}
        >
          {isPrivacy ? (
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>Effective Date:</strong> October 3, 2026
              </p>
              
              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>1. Local Execution & Data Privacy</h4>
              <p>
                The KGC OSI - 7 simulation platform executes entirely within your browser environment. All network traffic simulation, framing algorithms, Dijkstra routing calculations, and message payloads are processed locally via client-side JavaScript. No packet contents, simulation states, or input strings are transmitted to remote servers.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>2. Data Collection and Tracking</h4>
              <p>
                We do not collect personal identification data, use persistent advertising cookies, or deploy third-party trackers. The application stores user interface preferences (such as light or dark display mode) exclusively in your browser session or standard local storage.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>3. Network Security Research Disclaimer</h4>
              <p>
                This platform is engineered as an educational simulation suite illustrating the International Organization for Standardization (ISO) 7-layer Open Systems Interconnection (OSI) model. It does not interface with actual physical network cards, raw hardware sockets, or unauthorized infrastructure.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>4. Amendments to this Policy</h4>
              <p>
                We reserve the right to revise this policy to reflect platform updates or regulatory compliance. Any revisions will be documented with an updated effective date.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ marginTop: 0 }}>
                <strong>Effective Date:</strong> October 3, 2026
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>1. Acceptance of Terms</h4>
              <p>
                By accessing or using the KGC OSI - 7 platform, you agree to comply with and be bound by these Terms and Conditions. If you do not accept these terms, you must discontinue platform use immediately.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>2. Permitted Use & Academic Integrity</h4>
              <p>
                KGC OSI - 7 is provided for research, education, and instructional simulation of computer network protocols (including framing techniques, Go-Back-N sliding window mechanisms, CRC error detection, and routing algorithms). You agree not to misrepresent simulation outputs as real-world hardware telemetry.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>3. Intellectual Property Rights</h4>
              <p>
                All brand identity assets, interface architectures, simulation engines, and visual materials associated with KGC and KGC OSI - 7 remain the exclusive property of the brand. Unauthorized commercial redistribution or white-labeling is strictly prohibited.
              </p>

              <h4 style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', marginBottom: '6px' }}>4. Warranty and Limitation of Liability</h4>
              <p>
                This software is provided "as is", without warranty of any kind, express or implied. Under no circumstances shall the creators or maintainers be held liable for damages, operational disruptions, or data inaccuracies arising from use of this simulation suite.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: isDarkMode ? '1px solid #2d3748' : '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: isDarkMode ? '#13151b' : '#f8fafc'
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#007bff',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Acknowledge &amp; Return
          </button>
        </div>
      </div>
    </div>
  );
}
