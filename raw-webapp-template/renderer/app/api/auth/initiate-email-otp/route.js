import { NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

/**
 * Check if an email exists in sent_to array
 * Handles both old format (array of strings) and new format (array of objects)
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @param {string} email - Email to check for
 * @returns {boolean} - True if email exists
 */
function emailExistsInSentTo(sentTo, email) {
  if (!sentTo || !Array.isArray(sentTo)) return false;
  
  return sentTo.some(item => {
    if (typeof item === 'string') {
      // Old format: just email string
      return item === email;
    } else if (item && typeof item === 'object' && item.email) {
      // New format: object with email property
      return item.email === email;
    }
    return false;
  });
}

/**
 * POST /api/auth/initiate-email-otp
 * 
 * Initiates EMAIL_OTP authentication with AWS Cognito.
 * 
 * Request Body:
 * - email: string (user's email address)
 * - token: string (optional, the interface access token for validation)
 * 
 * Response:
 * - success: boolean
 * - session: string (Cognito session token for next step)
 * - message: string
 * 
 * Cognito Flow:
 * 1. Call InitiateAuth with EMAIL_OTP auth flow
 * 2. Cognito generates OTP and sends email
 * 3. Returns session token for verify step
 */
export async function POST(request) {
  try {
    const { email, token } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    // If token is provided, validate email against instance's sent_to
    if (token) {
      const apiUrl = process.env.API_URL || 'https://dev.api.anqa.ai';
      const instanceUrl = `${apiUrl}/website/client/interface-instances/get-interface-instance-by-token`;
      
      // Get instance to check sent_to (use local testing headers if available)
      const localClientUuid = process.env.CLIENT_UUID;
      const localApiKey = process.env.CLIENT_API_KEY;
      const isLocalTesting = localClientUuid && localApiKey;
      
      const headers = { 'Content-Type': 'application/json' };
      if (isLocalTesting) {
        headers['x-client-uuid'] = localClientUuid;
        headers['x-api-key'] = localApiKey;
      }
      
      try {
        const instanceResponse = await fetch(instanceUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ token }),
        });
        
        if (instanceResponse.ok) {
          const { instance } = await instanceResponse.json();
          
          if (instance?.sent_to && !emailExistsInSentTo(instance.sent_to, email)) {
            return NextResponse.json(
              { success: false, message: 'Email address not authorized for this interface' },
              { status: 403 }
            );
          }
        }
      } catch (instanceError) {
        // Don't fail OTP initiation if instance check fails
        // The final authorization check in page.js will catch unauthorized access
        console.warn('Failed to validate email against instance:', instanceError);
      }
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
    
    // Initiate EMAIL_OTP authentication
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_AUTH',
      ClientId: cognitoClientId,
      AuthParameters: {
        USERNAME: email,
        PREFERRED_CHALLENGE: 'EMAIL_OTP',
      },
    });
    
    console.log(`Initiating EMAIL_OTP for: ${email.substring(0, 3)}***`);
    
    const response = await cognitoClient.send(command);
    
    // Cognito returns a session token and challenge name
    if (response.ChallengeName === 'EMAIL_OTP') {
      return NextResponse.json({
        success: true,
        session: response.Session,
        message: 'Verification code sent to your email',
      });
    } else {
      console.error('Unexpected challenge:', response.ChallengeName);
      return NextResponse.json(
        { success: false, message: 'Unexpected authentication challenge' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error initiating EMAIL_OTP:', error);
    
    // Handle specific Cognito errors
    if (error.name === 'UserNotFoundException') {
      return NextResponse.json(
        { success: false, message: 'Email address not recognized' },
        { status: 404 }
      );
    }
    
    if (error.name === 'InvalidParameterException') {
      return NextResponse.json(
        { success: false, message: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    if (error.name === 'TooManyRequestsException') {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
