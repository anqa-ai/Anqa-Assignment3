/**
 * API Proxy for Template Renderer
 * Uses the exact same pattern as website-clients proxy-server.js
 * Forwards requests to ANQA Platform API with authentication
 */

import axios from 'axios';

export async function GET(request, { params }) {
  return handleApiProxy(request, { params }, 'GET');
}

export async function POST(request, { params }) {
  return handleApiProxy(request, { params }, 'POST');
}

export async function PUT(request, { params }) {
  return handleApiProxy(request, { params }, 'PUT');
}

export async function DELETE(request, { params }) {
  return handleApiProxy(request, { params }, 'DELETE');
}

async function handleApiProxy(request, { params }, method) {
  try {
    // Extract API path (same as proxy-server.js)
    // Convert Next.js params.path array to path string
    const pathArray = params?.path || [];
    const apiPath = '/' + pathArray.join('/');
    
    // Check for local development environment variables (same as proxy-server.js)
    const localClientUuid = process.env.CLIENT_UUID;
    const localApiKey = process.env.CLIENT_API_KEY || process.env.API_KEY;
    const isLocalTesting = localClientUuid && localApiKey;
    
    let clientUuid = null;
    let userData = null;
    let jwtToken = null;
    let cognitoTokens = null;
    
    // Check for Cognito JWT tokens in cookies (for /e/* external recipient auth)
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => {
          const [key, ...v] = c.split('=');
          return [key, v.join('=')];
        })
      );
      
      if (cookies.cognito_id_token || cookies.cognito_access_token) {
        cognitoTokens = {
          idToken: cookies.cognito_id_token,
          accessToken: cookies.cognito_access_token,
          refreshToken: cookies.cognito_refresh_token,
        };
      }
    }
    
    if (isLocalTesting) {
      // Local testing mode - use environment variables (same as proxy-server.js)
      clientUuid = localClientUuid;
      
      // In local dev, also try to extract JWT from cookies for user-info endpoint
      // This allows the /user-data/user-info endpoint to work in local development
      if (cognitoTokens?.idToken) {
        jwtToken = cognitoTokens.idToken;
        console.log('✅ Extracted JWT from cognito_id_token cookie for local dev');
      }
    } else {
      // Production mode - extract from ALB OIDC headers (same as proxy-server.js)
      const oidcData = request.headers.get('x-amzn-oidc-data');
      const accessToken = request.headers.get('x-amzn-oidc-accesstoken');
      
      // Decode x-amzn-oidc-data to extract custom:client_uuid (same as proxy-server.js)
      if (oidcData) {
        try {
          const parts = oidcData.split('.');
          if (parts.length >= 2) {
            let payload = parts[1];
            payload += '='.repeat((4 - payload.length % 4) % 4);
            const decoded = Buffer.from(payload, 'base64').toString('utf8');
            userData = JSON.parse(decoded);
            clientUuid = userData['custom:client_uuid'];
            
            // Log client UUID for debugging in development
            if (process.env.NODE_ENV === 'development' && clientUuid) {
              console.log('API Proxy - Client UUID:', clientUuid);
            }
          }
        } catch (error) {
          // Silent error handling for OIDC data parsing
        }
      }
      
      // Try using oidc-data directly as JWT (same as proxy-server.js)
      jwtToken = oidcData || accessToken;
    }
    
    // Forward to actual API (same as proxy-server.js)
    const apiBaseUrl = process.env.API_URL || 'https://dev.api.anqa.ai';
    const apiUrl = `${apiBaseUrl}${apiPath}`;
    
    // Build headers to forward to API (same as proxy-server.js)
    const forwardHeaders = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'User-Agent': request.headers.get('user-agent') || 'template-renderer/1.0',
    };
    
    if (isLocalTesting) {
      // Local testing mode - use custom headers instead of JWT (same as proxy-server.js)
      forwardHeaders['x-client-uuid'] = localClientUuid;
      forwardHeaders['x-api-key'] = localApiKey;
      
      // Also forward JWT token if we extracted it from cookies (for user-info endpoint)
      if (jwtToken) {
        forwardHeaders['Authorization'] = `Bearer ${jwtToken}`;
        console.log(`✅ Authorization: Bearer [JWT from cookie - ${jwtToken.length} chars]`);
      }
    } else if (cognitoTokens) {
      // Cognito JWT authentication mode (for /e/* external recipients)
      // Forward Cognito tokens as cookies so backend can validate them
      const cognitoCookies = [];
      if (cognitoTokens.idToken) {
        cognitoCookies.push(`cognito_id_token=${cognitoTokens.idToken}`);
      }
      if (cognitoTokens.accessToken) {
        cognitoCookies.push(`cognito_access_token=${cognitoTokens.accessToken}`);
      }
      if (cognitoTokens.refreshToken) {
        cognitoCookies.push(`cognito_refresh_token=${cognitoTokens.refreshToken}`);
      }
      
      if (cognitoCookies.length > 0) {
        forwardHeaders['Cookie'] = cognitoCookies.join('; ');
      }
      
      // Also forward as Bearer token for API Gateway compatibility
      if (cognitoTokens.idToken) {
        forwardHeaders['Authorization'] = `Bearer ${cognitoTokens.idToken}`;
      }
    } else {
      // Production mode - forward ALB OIDC headers AND Bearer token (same as proxy-server.js)
      const oidcData = request.headers.get('x-amzn-oidc-data');
      const accessToken = request.headers.get('x-amzn-oidc-accesstoken');
      
      // Forward ALB OIDC headers for Lambda Authorizer
      if (oidcData) {
        forwardHeaders['x-amzn-oidc-data'] = oidcData;
      }
      if (accessToken) {
        forwardHeaders['x-amzn-oidc-accesstoken'] = accessToken;
      }
      
      // Also send as Bearer token for compatibility
      if (jwtToken) {
        forwardHeaders['Authorization'] = `Bearer ${jwtToken}`;
      }
      
      // Lambda Authorizer at API Gateway can use either method
      
      // Validate that we have some form of authentication
      if (!oidcData && !accessToken && !jwtToken) {
        console.error('API Proxy - No authentication method available');
        console.error('Missing: OIDC headers, Cognito cookies, and local env vars');
        console.error('This usually means /api/proxy/* is not in ALB authenticated path patterns');
        
        // Check if this might be an external user who should use proxy-public
        const referer = request.headers.get('referer') || '';
        const isExternalUser = referer.includes('/e/');
        
        return Response.json({
          success: false,
          error: 'Authentication required',
          details: 'No authentication method available. The proxy requires either ALB OIDC headers (for /i/* users), Cognito JWT cookies (for /e/* users), or local environment variables for testing.',
          hint: isExternalUser 
            ? '🔓 External recipients should not hit this endpoint. Your client code should route to /api/proxy-public/* instead. Check that your data service is using the correct getApiBase() function.'
            : '🔒 Workflow users: Ensure /api/proxy/* is included in ALB path-based authentication patterns and you are logged in. If you are an external recipient (/e/* paths), ensure you have logged in via OTP.'
        }, { status: 401 });
      }
    }

    // Forward only essential request headers (same as proxy-server.js)
    const essentialHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'accept',
      'accept-language',
      'accept-encoding'
    ];

    essentialHeaders.forEach(headerName => {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        forwardHeaders[headerName] = headerValue;
      }
    });

    // Get request body for POST/PUT requests
    let requestBody = undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        // For JSON requests, parse the body. For others, keep as text
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          requestBody = await request.json();
        } else {
          const bodyText = await request.text();
          requestBody = bodyText || undefined;
        }
      } catch (error) {
        // Silent error handling for request body parsing
      }
    }
    
    // Use axios exactly like proxy-server.js
    const apiResponse = await axios({
      method: method,
      url: apiUrl,
      headers: forwardHeaders,
      data: method !== 'GET' && method !== 'HEAD' ? requestBody : undefined,
      timeout: 30000,
      // Do not follow redirects (maxRedirects: 0) - intentional for security and API consistency
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500; // Accept all status codes below 500
      }
    });
    
    // Check if response is HTML (like /docs endpoint) - same as proxy-server.js
    const contentType = apiResponse.headers['content-type'] || '';
    const isHtmlResponse = contentType.includes('text/html');
    
    if (isHtmlResponse) {
      return new Response(apiResponse.data, {
        status: apiResponse.status,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    } else {
      return Response.json(apiResponse.data, {
        status: apiResponse.status,
      });
    }
    
  } catch (error) {
    console.error('Template proxy error:', error.message);
    
    // Handle errors exactly like proxy-server.js
    if (error.response) {
      // API returned an error
      return Response.json(error.response.data || { 
        success: false, 
        error: 'API error', 
        status: error.response.status 
      }, { status: error.response.status });
    } else if (error.code === 'ECONNABORTED') {
      // Timeout error
      return Response.json({ 
        success: false, 
        error: 'Request timeout',
        details: 'API request took too long' 
      }, { status: 408 });
    } else {
      // Network or other error
      return Response.json({ 
        success: false, 
        error: 'Proxy request failed',
        details: error.message 
      }, { status: 500 });
    }
  }
}