'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Error Page Component for Temporal Interface Access
 * Displays user-friendly error messages for link access failures
 */
export default function ErrorPage({ error }) {
  const [isClearing, setIsClearing] = useState(false);
  
  const clearSessionAndReload = useCallback(async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    try {
      // eslint-disable-next-line no-restricted-globals
      await fetch('/api/auth/clear-session', {
        method: 'POST',
      });
      
      // Reload the page to show login form
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear session:', err);
      setIsClearing(false);
    }
  }, [isClearing]);
  
  // Automatically clear session for auth-related errors
  useEffect(() => {
    const authErrorCodes = [
      'EMAIL_NOT_AUTHORIZED',
      'NO_AUTH_TOKEN',
      'INVALID_ID_TOKEN',
      'NO_EMAIL_IN_TOKEN'
    ];
    
    if (authErrorCodes.includes(error.code)) {
      clearSessionAndReload();
    }
  }, [error.code, clearSessionAndReload]);
  const getErrorMessage = (code) => {
    switch (code) {
      case 'INVALID_TOKEN_FORMAT':
        return 'This link appears to be invalid or corrupted.';
      case 'INVALID_CLIENT_UUID':
        return 'This link is not associated with a valid client.';
      case 'INVALID_ACCESS_TOKEN':
        return 'The access token in this link is invalid.';
      case 'TOKEN_EXPIRED':
        return 'This link has expired. Please request a new one.';
      case 'TOKEN_REVOKED':
        return 'This link has been revoked and is no longer valid.';
      case 'ACCESS_DENIED':
        return 'You do not have permission to access this form.';
      case 'EMAIL_NOT_AUTHORIZED':
        return 'You are not authorized to access this form. Please use the email address that received the invitation.';
      case 'NO_AUTH_TOKEN':
      case 'INVALID_ID_TOKEN':
      case 'NO_EMAIL_IN_TOKEN':
        return 'Authentication error. Please try logging in again.';
      case 'FORM_SUBMITTED':
        return 'This form has already been submitted.';
      default:
        return 'An error occurred while accessing this form.';
    }
  };
  
  const getErrorIcon = (code) => {
    switch (code) {
      case 'TOKEN_EXPIRED':
      case 'TOKEN_REVOKED':
      case 'FORM_SUBMITTED':
        return '⏱️';
      case 'ACCESS_DENIED':
      case 'EMAIL_NOT_AUTHORIZED':
        return '🔒';
      case 'NO_AUTH_TOKEN':
      case 'INVALID_ID_TOKEN':
      case 'NO_EMAIL_IN_TOKEN':
        return '🔑';
      default:
        return '⚠️';
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '100%',
        padding: '40px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>
          {getErrorIcon(error.code)}
        </div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: '#1a202c',
          marginBottom: '12px',
        }}>
          {getErrorMessage(error.code)}
        </h1>
        
        <p style={{
          fontSize: '16px',
          color: '#718096',
          marginBottom: '24px',
          lineHeight: '1.6',
        }}>
          {error.message}
        </p>
        
        {error.details && (
          <details style={{
            marginTop: '24px',
            padding: '16px',
            background: '#f7fafc',
            borderRadius: '8px',
            textAlign: 'left',
            fontSize: '14px',
            color: '#4a5568',
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: '500',
              marginBottom: '8px',
            }}>
              Technical Details
            </summary>
            <pre style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '12px',
              color: '#718096',
            }}>
              {JSON.stringify(error.details, null, 2)}
            </pre>
          </details>
        )}
        
        {/* Show login button for auth errors */}
        {['EMAIL_NOT_AUTHORIZED', 'NO_AUTH_TOKEN', 'INVALID_ID_TOKEN', 'NO_EMAIL_IN_TOKEN'].includes(error.code) && (
          <button
            onClick={clearSessionAndReload}
            disabled={isClearing}
            style={{
              marginTop: '24px',
              width: '100%',
              padding: '12px',
              background: isClearing ? '#cbd5e0' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isClearing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isClearing ? 'Clearing session...' : 'Try logging in again'}
          </button>
        )}
        
        <div style={{
          marginTop: '32px',
          padding: '16px',
          background: '#edf2f7',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#4a5568',
        }}>
          <p style={{ margin: 0 }}>
            <strong>Need help?</strong> Contact the person who sent you this link.
          </p>
        </div>
      </div>
    </div>
  );
}
