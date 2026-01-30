/**
 * Public API Proxy for External Recipients (/e/* paths)
 * Does NOT require ALB authentication - uses Cognito JWT cookies instead
 * This route should NOT be in ALB path-based authentication patterns
 * 
 * Uses the same pattern as /api/proxy but without ALB OIDC dependency
 * Forwards requests to ANQA Platform API with Cognito JWT authentication
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
    // Extract API path
    const pathArray = params?.path || [];
    const apiPath = '/' + pathArray.join('/');
    
    // Check for local development environment variables
    const localClientUuid = process.env.CLIENT_UUID;
    const localApiKey = process.env.API_KEY;
    const isLocalTesting = localClientUuid && localApiKey;
    
    let cognitoTokens = null;
    
    // Extract Cognito JWT tokens from cookies (for /e/* external recipient auth)
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
    
    // Forward to actual API
    const apiUrl = `https://dev.api.anqa.ai${apiPath}`;
    
    // Build headers to forward to API
    const forwardHeaders = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
    };
    
    if (isLocalTesting) {
      // Local testing mode - use custom headers instead of JWT
      forwardHeaders['x-client-uuid'] = localClientUuid;
      forwardHeaders['x-api-key'] = localApiKey;
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
      // No authentication method available
      console.error('Public API Proxy - No authentication method available');
      console.error('Missing: Cognito JWT cookies and local env vars');
      console.error('This route is for /e/* external recipients who should have Cognito JWT cookies');
      
      // Check if this might be a workflow user who should use proxy
      const referer = request.headers.get('referer') || '';
      const isWorkflowUser = referer.includes('/i/');
      
      return Response.json({
        success: false,
        error: 'Authentication required',
        details: 'No authentication method available. External recipients must authenticate via OTP to receive JWT tokens.',
        hint: isWorkflowUser
          ? '🔒 Workflow users should not hit this endpoint. Your client code should route to /api/proxy/* instead. Check that your data service is using the correct getApiBase() function.'
          : '🔓 External recipients: Please check your email for a new access link. Your session may have expired.'
      }, { status: 401 });
    }

    // Forward only essential request headers
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
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          requestBody = await request.json();
        } else {
          requestBody = await request.text();
        }
      } catch (error) {
        console.error('Error reading request body:', error);
      }
    }
    
    // Use axios to forward request
    const apiResponse = await axios({
      method: method,
      url: apiUrl,
      headers: forwardHeaders,
      data: method !== 'GET' && method !== 'HEAD' ? requestBody : undefined,
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500; // Accept all status codes below 500
      }
    });
    
    // Check if response is HTML
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
    console.error('Public proxy error:', error.message);
    
    if (error.response) {
      return Response.json(error.response.data || { 
        success: false, 
        error: 'API error', 
        status: error.response.status 
      }, { status: error.response.status });
    } else if (error.code === 'ECONNABORTED') {
      return Response.json({ 
        success: false, 
        error: 'Request timeout',
        details: 'API request took too long' 
      }, { status: 408 });
    } else {
      return Response.json({ 
        success: false, 
        error: 'Proxy request failed',
        details: error.message 
      }, { status: 500 });
    }
  }
}
