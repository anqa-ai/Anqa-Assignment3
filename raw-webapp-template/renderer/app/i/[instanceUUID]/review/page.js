import { buildContext } from '@webapp/interface-sdk';
import ErrorPage from '../error.js';

/**
 * Internal Interface Review Page
 * Route: /i/[instanceUUID]/review
 * 
 * Dedicated route for internal reviewers to access forms in review mode.
 * Authentication: Cognito via ALB (path /i/* requires Cognito at ALB level)
 * 
 * Automatically activates review mode:
 * - Opens Answer Controls panel
 * - Enables review mode controls (mark questions for clarification)
 * 
 * Flow:
 * 1. Extract instanceUUID from URL
 * 2. Get Cognito JWT tokens from cookies (set by ALB)
 * 3. Load interface instance data
 * 4. Load interface details from registry
 * 5. Build context and render interface with reviewMode={true}
 */
export default async function InternalReviewPage({ params }) {
  const { instanceUUID } = params;
  
  try {
    // Validate instanceUUID format (36 chars with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!instanceUUID || !uuidRegex.test(instanceUUID)) {
      throw {
        message: 'Invalid instance ID format',
        code: 'INVALID_INSTANCE_UUID',
        details: { instanceUUID },
      };
    }
    
    console.log('🔍 REVIEW MODE: Loading interface for review');
    console.log(`   Instance UUID: ${instanceUUID}`);
    
    // Check for local development environment variables
    const localClientUuid = process.env.CLIENT_UUID;
    const localApiKey = process.env.API_KEY;
    const isLocalTesting = localClientUuid && localApiKey;
    
    // Get JWT from ALB OIDC headers (same pattern as proxy-server.js)
    // ALB adds these headers after Cognito authentication
    let idToken = null;
    let clientUuid = null;
    
    if (!isLocalTesting) {
      // Production mode - extract JWT from ALB OIDC headers
      console.log('🏗️ PRODUCTION MODE - Extracting JWT from ALB OIDC headers');
      
      // In Next.js, ALB headers are available through the headers() function
      const { headers } = await import('next/headers');
      const headersList = headers();
      
      // ALB OIDC headers (same as proxy-server.js)
      const oidcData = headersList.get('x-amzn-oidc-data'); // ID token JWT (with custom attributes)
      const accessToken = headersList.get('x-amzn-oidc-accesstoken'); // Access token JWT
      
      console.log(`ALB OIDC Headers:`);
      console.log(`  x-amzn-oidc-data: ${oidcData ? 'Present' : '❌ MISSING'}`);
      console.log(`  x-amzn-oidc-accesstoken: ${accessToken ? 'Present' : '❌ MISSING'}`);
      
      // Decode x-amzn-oidc-data to extract custom:client_uuid (same as proxy-server.js)
      if (oidcData) {
        try {
          const parts = oidcData.split('.');
          if (parts.length >= 2) {
            let payload = parts[1];
            // Add padding if needed for base64 decoding
            payload += '='.repeat((4 - payload.length % 4) % 4);
            
            const decoded = Buffer.from(payload, 'base64').toString('utf8');
            const userData = JSON.parse(decoded);
            clientUuid = userData['custom:client_uuid'];
            
            console.log(`✅ Extracted client_uuid from oidc-data: ${clientUuid}`);
          }
        } catch (error) {
          console.log(`⚠️ Failed to decode oidc-data: ${error.message}`);
        }
      }
      
      // Use oidc-data as JWT (it has proper structure + custom attributes)
      idToken = oidcData || accessToken;
      
      if (!idToken) {
        throw {
          message: 'Authentication required',
          code: 'NO_AUTH_TOKEN',
          details: { reason: 'No ALB OIDC headers found. ALB authentication may have failed.' },
        };
      }
      
      console.log(`✅ JWT token extracted from ALB headers (REVIEW MODE)`);
    } else {
      console.log('🧪 LOCAL TESTING MODE - Using environment variables');
      console.log(`Using CLIENT_UUID: ${localClientUuid}`);
    }
    
    // Step 1: Get instance data by UUID
    // Server-side: Call backend API directly (not through proxy)
    const apiUrl = process.env.API_URL || 'https://dev.api.anqa.ai';
    const instanceUrl = `${apiUrl}/website/client/interface-instances/get-interface-instance`;
    
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
      // Production: Forward ALB OIDC headers to Lambda authorizer
      const { headers: requestHeaders } = await import('next/headers');
      const headersList = requestHeaders();
      const oidcData = headersList.get('x-amzn-oidc-data');
      const oidcAccessToken = headersList.get('x-amzn-oidc-accesstoken');
      
      if (oidcData) {
        headers['x-amzn-oidc-data'] = oidcData;
      }
      if (oidcAccessToken) {
        headers['x-amzn-oidc-accesstoken'] = oidcAccessToken;
      }
      // Also send as Bearer token
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
    
    // eslint-disable-next-line no-restricted-globals
    const instanceResponse = await fetch(instanceUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ instance_uuid: instanceUUID }),
      cache: 'no-store',
    });
    
    console.log('Instance response status:', instanceResponse.status);
    
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
    const { interface_uuid, metadata, answers } = instance;
    
    // Step 2: Get interface details from registry
    // Server-side: Call backend API directly
    const interfaceUrl = `${apiUrl}/website/client/interfaces/get-interface`;
    // eslint-disable-next-line no-restricted-globals
    const interfaceResponse = await fetch(interfaceUrl, {
      method: 'POST',
      headers: headers,
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
    let InterfaceComponent;
    
    try {
      const { loadInterface } = await import('../../../../lib/interface-registry.js');
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
    
    // Step 4: Build context for the interface with review mode flag
    const contextData = {
      instanceUUID,
      interfaceUUID: interface_uuid,
      metadata,
      answers,
      reviewMode: true, // Always true for /review route
    };
    
    const context = await buildContext(contextData);
    
    console.log('✅ Review mode activated - rendering interface');
    
    // Step 5: Render the interface in review mode
    return (
      <InterfaceComponent
        context={context}
        initialAnswers={answers}
        metadata={metadata}
        instanceUUID={instanceUUID}
        interfaceUUID={interface_uuid}
        interfaceName={interface_name}
        reviewMode={true}
      />
    );
    
  } catch (error) {
    console.error('Internal review access error:', error);
    
    return (
      <ErrorPage
        error={{
          message: error.message || 'Failed to access form in review mode',
          code: error.code || 'REVIEW_ACCESS_ERROR',
          details: error.details || { instanceUUID: params.instanceUUID },
        }}
      />
    );
  }
}
