'use client';

import { useState } from 'react';

/**
 * OTP Login Form Component
 * 
 * Two-step authentication:
 * 1. User enters email address (must match instance.sent_to)
 * 2. System sends OTP code to email
 * 3. User enters OTP code to verify
 * 4. On success, redirect to authenticated interface
 */
export default function OTPLoginForm({ fullToken }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'loading'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cognitoSession, setCognitoSession] = useState(''); // Cognito session token
  
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Initiate EMAIL_OTP authentication with Cognito
      const response = await fetch('/api/auth/initiate-email-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          token: fullToken
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send verification code');
      }
      
      const data = await response.json();
      console.log('Cognito EMAIL_OTP initiated successfully');
      
      // Store Cognito session for verify step
      setCognitoSession(data.session);
      
      // Move to OTP input step
      setStep('otp');
      
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Verify EMAIL_OTP code with Cognito
      const response = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        credentials: 'include', // Important: Receive Cognito token cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          otp,
          session: cognitoSession,
          token: fullToken
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid verification code');
      }
      
      await response.json();
      console.log('Cognito EMAIL_OTP verified successfully');
      
      // Cognito tokens set in HttpOnly cookies (cognito_id_token, cognito_access_token, cognito_refresh_token)
      // Reload page - it will detect cookies and show interface
      window.location.href = `/e/${fullToken}`;
      
    } catch (err) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResendOTP = async () => {
    setError('');
    setLoading(true);
    
    try {
      // Re-initiate EMAIL_OTP authentication to get a new code
      const response = await fetch('/api/auth/initiate-email-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          token: fullToken
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to resend code');
      }
      
      const data = await response.json();
      
      // Update Cognito session with new session token
      setCognitoSession(data.session);
      
      // Clear OTP input
      setOtp('');
      
      // Show success message
      alert('A new verification code has been sent to your email.');
      
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setLoading(false);
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
        maxWidth: '440px',
        width: '100%',
        padding: '40px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '32px',
          }}>
            🔐
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1a202c',
            marginBottom: '8px',
          }}>
            {step === 'email' ? 'Verify Your Identity' : 'Enter Verification Code'}
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#718096',
          }}>
            {step === 'email' 
              ? 'Please enter your email address to receive a verification code'
              : `We sent a code to ${email}`
            }
          </p>
        </div>
        
        {/* Error Message */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c53030',
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}
        
        {/* Email Step */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#4a5568',
                marginBottom: '8px',
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                color: 'white',
                background: loading || !email 
                  ? '#cbd5e0' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!loading && email) {
                  e.target.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1';
              }}
            >
              {loading ? 'Sending Code...' : 'Send Verification Code'}
            </button>
          </form>
        )}
        
        {/* OTP Step */}
        {step === 'otp' && (
          <form onSubmit={handleOTPSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#4a5568',
                marginBottom: '8px',
              }}>
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000"
                required
                disabled={loading}
                maxLength={8}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '24px',
                  fontWeight: '600',
                  textAlign: 'center',
                  letterSpacing: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <p style={{
                fontSize: '12px',
                color: '#a0aec0',
                marginTop: '8px',
                textAlign: 'center',
              }}>
                Enter the 8-digit code from your email
              </p>
            </div>
            
            <button
              type="submit"
              disabled={loading || otp.length !== 8}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                color: 'white',
                background: loading || otp.length !== 8
                  ? '#cbd5e0' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || otp.length !== 8 ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s',
                marginBottom: '12px',
              }}
              onMouseEnter={(e) => {
                if (!loading && otp.length === 8) {
                  e.target.style.opacity = '0.9';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.opacity = '1';
              }}
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667eea',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textDecoration: 'underline',
                  padding: '8px',
                }}
              >
                Didn't receive the code? Resend
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                }}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#718096',
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '8px',
                  marginLeft: '16px',
                }}
              >
                Change email
              </button>
            </div>
          </form>
        )}
        
        {/* Security Notice */}
        <div style={{
          marginTop: '32px',
          padding: '16px',
          background: '#f7fafc',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#718096',
          textAlign: 'center',
        }}>
          🔒 This is a secure, one-time access link. Your information is encrypted and protected.
        </div>
      </div>
    </div>
  );
}
