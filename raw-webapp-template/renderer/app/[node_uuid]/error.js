'use client';

import Link from 'next/link';

export default function ErrorPage({ error }) {
  return (
    <div className="error-page">
      <h1>Interface Error</h1>
      <p>{error.message}</p>
      
      {error.code && (
        <p>
          <strong>Error Code:</strong> {error.code}
        </p>
      )}
      
      <Link href="/" style={{ 
        display: 'inline-block',
        padding: '10px 20px',
        background: '#007bff',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        ← Back to Home
      </Link>
      
      {error.details && process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <h3>Debug Information</h3>
          <pre>{JSON.stringify(error.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}