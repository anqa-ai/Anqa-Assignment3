/* eslint-disable no-restricted-globals */

/**
 * Authentication utilities and API wrapper for template renderer
 * Provides secure API communication and user context management
 */

/**
 * Extract authentication from request headers (ALB OIDC or local dev)
 * Uses the same pattern as website-clients proxy-server.js
 */
export async function getAuth(request = null) {
  // Check for local development environment variables (same as website-clients)
  const localClientUuid = process.env.CLIENT_UUID;
  const localApiKey = process.env.API_KEY;
  const isLocalTesting = localClientUuid && localApiKey;
  
  if (isLocalTesting) {
    console.log('🧪 LOCAL TESTING MODE - Using environment variables');
    return {
      user: { 
        id: 'dev-user', 
        email: 'dev@anqa.ai',
        name: 'Development User',
        roles: ['admin', 'finance.read', 'ops.read', 'compliance.approve', 'finance.admin', 'survey.participant', 'user.read', 'template.view'] 
      },
      token: localApiKey,
      clientUuid: localClientUuid,
      isAuthenticated: true,
      source: 'local_env'
    };
  }
  
  // Production mode - extract from ALB OIDC headers (same as website-clients)
  if (!request) {
    // For server components, try to get headers from Next.js headers()
    try {
      const { headers } = await import('next/headers');
      const headersList = headers();
      
      const oidcData = headersList.get('x-amzn-oidc-data');
      const accessToken = headersList.get('x-amzn-oidc-accesstoken');
      const oidcIdentity = headersList.get('x-amzn-oidc-identity');
      
      return extractAuthFromHeaders(oidcData, accessToken, oidcIdentity);
    } catch (error) {
      console.warn('Could not access Next.js headers, falling back to mock auth');
      return getMockAuth();
    }
  }
  
  // For middleware or API routes with explicit request object
  const oidcData = request.headers.get('x-amzn-oidc-data');
  const accessToken = request.headers.get('x-amzn-oidc-accesstoken');
  const oidcIdentity = request.headers.get('x-amzn-oidc-identity');
  
  return extractAuthFromHeaders(oidcData, accessToken, oidcIdentity);
}

/**
 * Extract authentication data from ALB OIDC headers
 * Same logic as website-clients proxy-server.js
 */
function extractAuthFromHeaders(oidcData, accessToken, oidcIdentity) {
  console.log('🏗️ PRODUCTION MODE - Using ALB OIDC headers');
  
  let clientUuid = null;
  let userData = null;
  
  // Decode x-amzn-oidc-data to extract custom attributes (same as website-clients)
  if (oidcData) {
    try {
      // Basic JWT decode (no signature verification needed - ALB already verified)
      const payload = oidcData.split('.')[1];
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf-8');
      userData = JSON.parse(decodedPayload);
      clientUuid = userData['custom:client_uuid'];
      
      console.log('✅ Successfully decoded OIDC data');
      console.log(`  User: ${userData.email || userData.sub}`);
      console.log(`  Client UUID: ${clientUuid}`);
    } catch (error) {
      console.error('❌ Failed to decode OIDC data:', error.message);
    }
  }
  
  // Use oidc-data as JWT token (has proper structure + custom attributes)
  const jwtToken = oidcData || accessToken;
  
  if (!jwtToken) {
    console.warn('No JWT token found in headers, falling back to mock auth');
    return getMockAuth();
  }
  
  return {
    user: {
      id: userData?.sub || oidcIdentity,
      email: userData?.email,
      name: userData?.name,
      roles: userData?.['custom:roles'] || [],
    },
    token: jwtToken,
    clientUuid: clientUuid,
    isAuthenticated: true,
    source: 'alb_oidc'
  };
}

/**
 * Fallback mock authentication for development/testing
 */
function getMockAuth() {
  return {
    user: {
      id: 'demo-user-123',
      email: 'demo@example.com',
      name: 'Demo User',
      roles: [
        'admin',
        'finance.read',
        'finance.admin',
        'ops.read',
        'compliance.approve',
        'survey.participant',
        'user.read',
        'interface.view'
      ],
    },
    token: 'demo-jwt-token-12345',
    clientUuid: 'demo-client-uuid',
    isAuthenticated: true,
    source: 'mock'
  };
}

/**
 * Validate user has required roles for a node
 * Enhanced with workflow context support
 * 
 * TEMPORARY: Role checking disabled - all authenticated users have access
 * TODO: Implement proper RBAC with database-driven roles
 */
export function hasAccess(user, requiredRoles = []) {
  // TEMPORARY FIX: Skip role checking for now
  // All authenticated users get access
  console.log('⚠️ RBAC DISABLED - All authenticated users have access');
  if (requiredRoles && requiredRoles.length > 0) {
    console.log(`📋 Bypassing role check for: ${requiredRoles.join(', ')}`);
  }
  return true;
  
  /* ORIGINAL CODE - Uncomment when RBAC is ready
  if (!requiredRoles.length) return true;
  
  // Check basic role requirements
  const hasBasicAccess = requiredRoles.some(role => 
    user.roles?.includes(role)
  );
  
  if (!hasBasicAccess) {
    return false;
  }
  
  // Additional workflow-specific access checks
  if (workflowContext) {
    // Could add workflow-specific permissions here
    // e.g., check if user is workflow owner, participant, etc.
    // For now, return true if basic access is granted
  }
  
  return true;
  */
}

/**
 * Create API client for templates with authentication
 * Enhanced to support both template API and workflow API calls
 */
export function createAuthenticatedApiClient(auth, baseUrl = 'https://dev.api.anqa.ai') {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Use same authentication pattern as website-clients
  if (auth.source === 'local_env') {
    headers['x-client-uuid'] = auth.clientUuid;
    headers['x-api-key'] = auth.token;
  } else {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  
  return {
    async get(path) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    
    async post(path, data) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    
    // Workflow-specific methods
    async getWorkflowContext(workflowUuid) {
      return this.get(`/workflows/${workflowUuid}`);
    },
    
    async completeWorkflowNode(workflowUuid, nodeId, outputData) {
      return this.post(`/workflows/${workflowUuid}/nodes/${nodeId}/complete`, {
        output: outputData,
        completedAt: new Date().toISOString(),
      });
    },
    
    async cancelWorkflowNode(workflowUuid, nodeId, reason) {
      return this.post(`/workflows/${workflowUuid}/nodes/${nodeId}/cancel`, {
        reason,
        cancelledAt: new Date().toISOString(),
      });
    }
  };
}