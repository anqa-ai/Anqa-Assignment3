import { cookies } from 'next/headers';
import { buildContext } from '@webapp/interface-sdk';
import { jwtDecode } from 'jwt-decode';
import ErrorPage from './error.js';
import OTPLoginForm from './otp-login.js';

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
 * Temporal Interface Access Page
 * Route: /e/[token]
 * 
 * Handles multi-use temporal form links with OTP authentication.
 * Token format: {client_uuid}.{27-char-base64url}
 * 
 * Flow:
 * 1. Extract and validate token from URL
 * 2. Check for session cookie (set by OTP verification)
 * 3. If no session: Show OTP login form
 * 4. If session valid: Load and render interface
 * 5. Track usage and activity for expiration management
 */
export default async function TemporalInterfacePage({ params }) {
  const { token } = params;
  
  
  try {
    // Validate token format: {client_uuid}.{27-char-token}
    if (!token || typeof token !== 'string') {
      throw {
        message: 'Invalid link format',
        code: 'INVALID_TOKEN_FORMAT',
        details: { reason: 'Token is required' },
      };
    }
    
    const tokenParts = token.split('.');
    if (tokenParts.length !== 2) {
      throw {
        message: 'Invalid link format',
        code: 'INVALID_TOKEN_FORMAT',
        details: { 
          reason: 'Token must be in format: {client_uuid}.{access_token}',
          received: token 
        },
      };
    }
    
    const [clientUUID, accessToken] = tokenParts;
    
    // Validate client UUID format (36 chars with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientUUID)) {
      throw {
        message: 'Invalid link format',
        code: 'INVALID_CLIENT_UUID',
        details: { clientUUID },
      };
    }
    
    // Validate access token (27 characters base64url)
    if (accessToken.length !== 27) {
      throw {
        message: 'Invalid link format',
        code: 'INVALID_ACCESS_TOKEN',
        details: { 
          reason: 'Access token must be 27 characters',
          length: accessToken.length 
        },
      };
    }
    
    // Check for local development environment variables (same as proxy route.js)
    const localClientUuid = process.env.CLIENT_UUID;
    const localApiKey = process.env.API_KEY;
    const isLocalTesting = localClientUuid && localApiKey;
    
    if (isLocalTesting) {
      console.log('🧪 LOCAL TESTING MODE - Skipping OTP authentication entirely');
      console.log('Using CLIENT_UUID:', localClientUuid);
    } else {
      // Production mode - check Cognito authentication
      // Check if user is authenticated via Cognito tokens
      // Tokens are set by /api/auth/verify-email-otp after successful OTP verification
      const cookieStore = cookies();
      const cognitoIdToken = cookieStore.get('cognito_id_token');
      const cognitoAccessToken = cookieStore.get('cognito_access_token');
      const isAuthenticated = !!(cognitoIdToken?.value && cognitoAccessToken?.value);
      
      // If tokens exist, they will be automatically sent with API requests
      // Backend should validate the Cognito ID token to extract user email
      if (isAuthenticated) {
        console.log('Cognito authentication tokens found');
      }
      
      if (!isAuthenticated) {
        // Show OTP login form
        return (
          <OTPLoginForm 
            clientUUID={clientUUID}
            accessToken={accessToken}
            fullToken={token}
          />
        );
      }
    }
    
    // User is authenticated (or in local testing mode) - load and render the interface
    
    // Extract Cognito ID token for JWT authentication (only used in production)
    // In local testing mode, cognitoIdToken will be undefined, but that's okay
    const cookieStore = cookies();
    const cognitoIdToken = cookieStore.get('cognito_id_token');
    const idToken = cognitoIdToken?.value;
    
    // Step 1: Get instance data by token
    // Server-side: Call backend API directly (not through proxy)
    const apiUrl = process.env.API_URL || 'https://dev.api.anqa.ai';
    const instanceUrl = `${apiUrl}/website/client/interface-instances/get-interface-instance-by-token`;
    
    if (isLocalTesting) {
      console.log('🧪 LOCAL TESTING MODE - Skipping Cognito auth');
      console.log('Using CLIENT_UUID:', localClientUuid);
    } else {
      console.log('🏗️ PRODUCTION MODE - Using Cognito JWT');
    }
    console.log('Fetching instance from:', instanceUrl);
    
    // Build headers for API request
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (isLocalTesting) {
      // Local mode: Use environment variables
      headers['x-client-uuid'] = localClientUuid;
      headers['x-api-key'] = localApiKey;
    } else {
      // Production: Send Cognito JWT as Bearer token
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
    
    const instanceResponse = await fetch(instanceUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ token }),
      cache: 'no-store', // Don't cache temporal form data
    });
    console.log('Instance response status:', instanceResponse.status);
    console.log('Instance response headers:', Object.fromEntries(instanceResponse.headers.entries()));
    
    if (!instanceResponse.ok) {
      const responseText = await instanceResponse.text();
      console.error('Instance fetch failed - Response body:', responseText);
      
      let errorData = {};
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        errorData = { raw_response: responseText.substring(0, 500) };
      }
      
      throw {
        message: errorData.detail || 'Failed to load form',
        code: 'INSTANCE_LOAD_FAILED',
        details: errorData,
      };
    }
    
    const { instance } = await instanceResponse.json();
    const { interface_uuid, instance_uuid, metadata, answers, sent_to } = instance;
    
    // SECURITY: Verify authenticated email is authorized to access this instance
    if (!isLocalTesting) {
      if (!idToken) {
        throw {
          message: 'Authentication required',
          code: 'NO_AUTH_TOKEN',
          details: { reason: 'No Cognito ID token found' },
        };
      }
      
      // Decode the Cognito ID token to extract the email
      let decodedToken;
      try {
        decodedToken = jwtDecode(idToken);
      } catch (decodeError) {
        console.error('Failed to decode ID token:', decodeError);
        throw {
          message: 'Invalid authentication token',
          code: 'INVALID_ID_TOKEN',
          details: { reason: 'Token decode failed' },
        };
      }
      
      const authenticatedEmail = decodedToken.email;
      
      if (!authenticatedEmail) {
        throw {
          message: 'Invalid authentication token',
          code: 'NO_EMAIL_IN_TOKEN',
          details: { reason: 'ID token does not contain email claim' },
        };
      }
      
      // Check if authenticated email is in the sent_to array (handles both old and new formats)
      if (!emailExistsInSentTo(sent_to, authenticatedEmail)) {
        console.warn(`Unauthorized access attempt: ${authenticatedEmail} not in sent_to array`);
        
        // Extract emails for logging (handle both formats)
        const authorizedEmails = sent_to?.map(item => 
          typeof item === 'string' ? item : item?.email
        ).filter(Boolean) || [];
        console.warn(`Authorized emails: ${authorizedEmails.join(', ')}`);
        
        throw {
          message: 'You are not authorized to access this interface',
          code: 'EMAIL_NOT_AUTHORIZED',
          details: { 
            reason: 'Your email is not in the list of authorized recipients',
            authenticatedEmail: authenticatedEmail 
          },
        };
      }
      
      console.log(`✅ Email authorization verified: ${authenticatedEmail}`);
    }
    
    // Step 2: Get interface details from registry
    // Server-side: Call backend API directly
    const interfaceUrl = `${apiUrl}/website/client/interfaces/get-interface`;
    const interfaceResponse = await fetch(interfaceUrl, {
      method: 'POST',
      headers: headers, // Reuse the same headers (with client-uuid or JWT)
      body: JSON.stringify({ interface_uuid }),
      cache: 'no-store',
    });
    
    if (!interfaceResponse.ok) {
      throw {
        message: 'Failed to load interface details',
        code: 'INTERFACE_LOAD_FAILED',
      };
    }
    
    const { interface: interfaceDetails } = await interfaceResponse.json();
    const { interface_package, interface_name } = interfaceDetails;
    
    // Step 3: Load interface package from registry
    // Use centralized registry for consistent package resolution
    // See: renderer/lib/interface-registry.js for adding new interfaces
    let InterfaceComponent;
    
    try {
      const { loadInterface } = await import('../../../lib/interface-registry.js');
      const module = await loadInterface(interface_package);
      InterfaceComponent = module.default || module.Interface;
      
      if (!InterfaceComponent) {
        throw new Error('Interface module does not export a default or Interface component');
      }
    } catch (importError) {
      console.error('Failed to load interface package:', importError);
      throw {
        message: `Interface package not found: ${interface_package}`,
        code: 'INTERFACE_IMPORT_FAILED',
        details: { package: interface_package, error: importError.message },
      };
    }
    
    // Step 4: Build context for the interface
    const context = await buildContext({
      instanceUUID: instance_uuid,
      interfaceUUID: interface_uuid,
      token,
      metadata,
      answers,
    });
    
    // Step 5: Render the interface
    return (
      <InterfaceComponent
        context={context}
        initialAnswers={answers}
        metadata={metadata}
        instanceUUID={instance_uuid}
        interfaceUUID={interface_uuid}
        interfaceName={interface_name}
      />
    );
    
  } catch (error) {
    console.error('Temporal interface access error:', error);
    
    return (
      <ErrorPage
        error={{
          message: error.message || 'Failed to access form',
          code: error.code || 'ACCESS_ERROR',
          details: error.details || { token: params.token },
        }}
      />
    );
  }
}
