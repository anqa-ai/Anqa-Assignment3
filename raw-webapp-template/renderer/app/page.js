import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Interface Renderer Service</h1>
      <p>
        This is the webapp interface renderer. Navigate to{' '}
        <code>/[node_uuid]</code> to render a specific interface.
      </p>
      
      <h2>Available Demo Nodes</h2>
      <div style={{ display: 'grid', gap: '16px', marginTop: '20px' }}>
        <Link
          href="/demo-saq-form-456"
          style={{
            display: 'block',
            padding: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            backgroundColor: '#f8f9fa',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0' }}>🔒 PCI SAQ Advisor</h3>
          <p style={{ margin: 0, color: '#666' }}>
            Node: <code>demo-saq-form-456</code> → @webapp/interface-saq-form
          </p>
        </Link>
        
        <Link
          href="/demo-pdf-signer-321"
          style={{
            display: 'block',
            padding: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'inherit',
            backgroundColor: '#f8f9fa',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0' }}>✍️ PDF Signer</h3>
          <p style={{ margin: 0, color: '#666' }}>
            Node: <code>demo-pdf-signer-321</code> → @webapp/interface-pdf-signer
          </p>
        </Link>
      </div>
      
      <h2>API Endpoints</h2>
      <ul>
        <li><code>GET /api/health</code> - Health check</li>
        <li><code>GET /api/nodes/[uuid]</code> - Get node configuration</li>
      </ul>
    </div>
  );
}