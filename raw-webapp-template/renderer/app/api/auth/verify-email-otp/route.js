import { NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider';

/**
 * POST /api/auth/verify-email-otp
 * 
 * Verifies EMAIL_OTP code and completes authentication with AWS Cognito.
 * 
 * Request Body:
 * - email: string (user's email address)
 * - otp: string (8-digit OTP code)
 * - session: string (Cognito session from initiate step)
 * - token: string (optional, the interface access token)
 * 
 * Response:
 * - success: boolean
 * - message: string
 * - Sets HttpOnly cookie with JWT access token
 * 
 * Cognito Flow:
 * 1. Call RespondToAuthChallenge with EMAIL_OTP code
 * 2. Cognito validates OTP
 * 3. Returns ID token, access token, refresh token
 * 4. Store tokens in HttpOnly cookies
 */
export async function POST(request) {
  try {
    const { email, otp, session } = await request.json();
    
    if (!email || !otp || !session) {
      return NextResponse.json(
        { success: false, message: 'Email, OTP code, and session are required' },
        { status: 400 }
      );
    }
    
    // Validate OTP format (8 digits)
    if (!/^\d{8}$/.test(otp)) {
      return NextResponse.json(
        { success: false, message: 'OTP must be 8 digits' },
        { status: 400 }
      );
    }
    
    // Get Cognito configuration from environment variables
    const cognitoClientId = process.env.COGNITO_EXTERNAL_CLIENT_ID;
    const awsRegion = process.env.AWS_REGION || 'eu-west-2';
    
    if (!cognitoClientId) {
      console.error('COGNITO_EXTERNAL_CLIENT_ID not configured');
      return NextResponse.json(
        { success: false, message: 'Authentication service not configured' },
        { status: 500 }
      );
    }
    
    // Initialize Cognito client
    const cognitoClient = new CognitoIdentityProviderClient({
      region: awsRegion,
    });
    
    // Verify EMAIL_OTP code
    const command = new RespondToAuthChallengeCommand({
      ChallengeName: 'EMAIL_OTP',
      ClientId: cognitoClientId,
      Session: session,
      ChallengeResponses: {
        EMAIL_OTP_CODE: otp,
        USERNAME: email,
      },
    });
    
    console.log(`Verifying EMAIL_OTP for: ${email.substring(0, 3)}***`);
    
    const response = await cognitoClient.send(command);
    
    // Check if authentication succeeded
    if (!response.AuthenticationResult) {
      return NextResponse.json(
        { success: false, message: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    const { IdToken, AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;
    
    // Create response with cookies
    const nextResponse = NextResponse.json({
      success: true,
      message: 'Authentication successful',
    });
    
    // Set HttpOnly cookies for tokens
    // ID Token contains user claims (email, sub, etc.)
    nextResponse.cookies.set('cognito_id_token', IdToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ExpiresIn, // Cognito default is 3600 seconds (1 hour)
      path: '/',
    });
    
    // Access Token for API calls
    nextResponse.cookies.set('cognito_access_token', AccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: ExpiresIn,
      path: '/',
    });
    
    // Refresh Token for getting new tokens
    if (RefreshToken) {
      nextResponse.cookies.set('cognito_refresh_token', RefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days (Cognito default)
        path: '/',
      });
    }
    
    console.log(`Authentication successful for: ${email.substring(0, 3)}***`);
    
    return nextResponse;
    
  } catch (error) {
    console.error('Error verifying EMAIL_OTP:', error);
    
    // Handle specific Cognito errors
    if (error.name === 'CodeMismatchException') {
      return NextResponse.json(
        { success: false, message: 'Invalid verification code' },
        { status: 400 }
      );
    }
    
    if (error.name === 'ExpiredCodeException') {
      return NextResponse.json(
        { success: false, message: 'Verification code has expired' },
        { status: 400 }
      );
    }
    
    if (error.name === 'NotAuthorizedException') {
      return NextResponse.json(
        { success: false, message: 'Invalid session or code' },
        { status: 401 }
      );
    }
    
    if (error.name === 'TooManyFailedAttemptsException') {
      return NextResponse.json(
        { success: false, message: 'Too many failed attempts. Please request a new code.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
