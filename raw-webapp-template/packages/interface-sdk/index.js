import Ajv from 'ajv';

const ajv = new Ajv();

/**
 * Validates data against a JSON Schema
 * @param {any} data - The data to validate
 * @param {object} schema - JSON Schema object
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateSchema(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  
  return {
    valid,
    errors: valid ? undefined : validate.errors?.map(err => 
      `${err.instancePath || 'root'} ${err.message}`
    ),
  };
}

/**
 * Builds the template context from request parameters
 * Enhanced for workflow integration with ANQA platform
 * @param {object} options - Request context options
 * @param {string} options.nodeUUID - The node UUID from the route
 * @param {string} [options.workflowUUID] - The workflow UUID (for workflow integration)
 * @param {object} options.user - User information
 * @param {object} options.params - URL/query parameters
 * @param {object} options.api - API configuration
 * @param {object} options.branding - Branding configuration
 * @param {object} [options.workflow] - Workflow context data
 * @returns {TemplateContext}
 */
export function buildContext({ 
  nodeUUID, 
  workflowUUID, 
  user, 
  params, 
  api, 
  branding, 
  workflow 
}) {
  const context = {
    nodeUUID,
    user: user || { id: 'anonymous', roles: [] },
    params: params || {},
    api: {
      baseUrl: api?.baseUrl || process.env.CLIENT_API_URL || 'https://dev.api.anqa.ai',
      authToken: api?.authToken || '',
    },
    branding: branding || {},
  };

  // Add workflow integration if provided
  if (workflowUUID) {
    context.workflowUUID = workflowUUID;
    context.workflow = workflow || {};
    context.api.workflowApi = `${context.api.baseUrl}/workflows/${workflowUUID}`;
  }

  return context;
}

/**
 * Enhanced API client with workflow capabilities
 * Integrates with ANQA platform authentication
 */
export function createApiClient(ctx) {
  const baseUrl = ctx.api.baseUrl;
  const authToken = ctx.api.authToken;
  
  if (!baseUrl) {
    throw new InterfaceError('API base URL is required', 'MISSING_API_CONFIG');
  }
  
  // Check if using relative URL for BFF proxy pattern
  const isRelativeUrl = baseUrl.startsWith('/');
  
  // Validate base URL to prevent SSRF attacks
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    'dev.api.anqa.ai',
    'api.anqa.ai',
    'staging.api.anqa.ai'
  ];
  
  // Allow relative URLs for BFF proxy pattern
  if (!isRelativeUrl) {
    try {
      const url = new URL(baseUrl);
      if (!allowedHosts.includes(url.hostname)) {
        throw new InterfaceError(
          `API calls only allowed to approved hosts: ${allowedHosts.join(', ')}`,
          'INVALID_API_HOST',
          { hostname: url.hostname, allowedHosts }
        );
      }
    } catch (error) {
      throw new InterfaceError('Invalid API base URL', 'INVALID_API_URL', { baseUrl });
    }
  }
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // For BFF proxy pattern, authentication is handled by the proxy
  // Only add auth headers for direct API calls (not relative URLs)
  if (!isRelativeUrl && authToken) {
    // Support both Bearer tokens and API key authentication
    if (authToken.startsWith('Bearer ') || authToken.includes('.')) {
      headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`;
    } else {
      headers['x-api-key'] = authToken;
    }
  }
  
  return {
    async get(path) {
      let fetchUrl = `${baseUrl}${path}`;
      
      // For server-side rendering, convert relative URLs to absolute URLs
      if (isRelativeUrl && typeof window === 'undefined') {
        // We're in a server environment (Next.js SSR)
        // Use environment variable or default to localhost for local development
        const serverBaseUrl = process.env.RENDERER_INTERNAL_URL || 'http://localhost:3001';
        fetchUrl = `${serverBaseUrl}${fetchUrl}`;
      }
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new InterfaceError(
          `API request failed: ${response.status} ${response.statusText}`,
          'API_REQUEST_FAILED',
          { status: response.status, path }
        );
      }
      
      return response.json();
    },
    
    async post(path, data) {
      let fetchUrl = `${baseUrl}${path}`;
      
      // For server-side rendering, convert relative URLs to absolute URLs
      if (isRelativeUrl && typeof window === 'undefined') {
        // We're in a server environment (Next.js SSR)
        // Use environment variable or default to localhost for local development
        const serverBaseUrl = process.env.RENDERER_INTERNAL_URL || 'http://localhost:3001';
        fetchUrl = `${serverBaseUrl}${fetchUrl}`;
      }
      
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new InterfaceError(
          `API request failed: ${response.status} ${response.statusText}`,
          'API_REQUEST_FAILED',
          { status: response.status, path }
        );
      }
      
      return response.json();
    },
    
    // Workflow-specific methods for ANQA platform integration
    async getWorkflowData() {
      if (!ctx.workflowUUID) {
        throw new InterfaceError('No workflow UUID provided', 'MISSING_WORKFLOW_CONTEXT');
      }
      
      return this.get(`/workflows/${ctx.workflowUUID}`);
    },
    
    async getWorkflowNode(nodeId = ctx.nodeUUID) {
      if (!ctx.workflowUUID) {
        throw new InterfaceError('No workflow UUID provided', 'MISSING_WORKFLOW_CONTEXT');
      }
      
      return this.get(`/workflows/${ctx.workflowUUID}/nodes/${nodeId}`);
    },
    
    async completeWorkflowNode(outputData, nodeId = ctx.nodeUUID) {
      if (!ctx.workflowUUID) {
        throw new InterfaceError('No workflow UUID provided', 'MISSING_WORKFLOW_CONTEXT');
      }
      
      return this.post(`/workflows/${ctx.workflowUUID}/nodes/${nodeId}/complete`, {
        output: outputData,
        completedAt: new Date().toISOString(),
        completedBy: ctx.user.id,
      });
    },
    
    async updateWorkflowNode(data, nodeId = ctx.nodeUUID) {
      if (!ctx.workflowUUID) {
        throw new InterfaceError('No workflow UUID provided', 'MISSING_WORKFLOW_CONTEXT');
      }
      
      return this.post(`/workflows/${ctx.workflowUUID}/nodes/${nodeId}/update`, {
        data,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user.id,
      });
    }
  };
}

/**
 * Template error class
 */
export class InterfaceError extends Error {
  constructor(message, code = 'TEMPLATE_ERROR', details = {}) {
    super(message);
    this.name = 'InterfaceError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Common UI components for templates
 */
export const UI = {
  ErrorBoundary: ({ children }) => {
    // Simple error boundary implementation
    // In a real implementation, you'd use a proper React error boundary
    return children;
  },
};

/**
 * React components for templates
 * Note: These use React.createElement to avoid JSX syntax issues in Node.js
 */

/**
 * Loading spinner component
 * @param {object} props
 * @param {'small'|'medium'|'large'} props.size - Size of the spinner
 * @returns {React.Element|string}
 */
export function LoadingSpinner({ size = 'medium' } = {}) {
  // Check if we're in a React environment
  if (typeof window === 'undefined') {
    // Server-side or Node.js environment - return a placeholder
    return '⏳ Loading...';
  }

  // Try to get React from global scope (Next.js environment)
  const React = globalThis.React;
  if (!React) {
    return '⏳ Loading...';
  }

  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px',
  };

  // Add CSS for spin animation if not already present
  if (typeof document !== 'undefined' && !document.querySelector('#spinner-styles')) {
    const style = document.createElement('style');
    style.id = 'spinner-styles';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return React.createElement('div', {
    style: {
      width: sizeMap[size],
      height: sizeMap[size],
      border: '2px solid #f3f3f3',
      borderTop: '2px solid #3498db',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      display: 'inline-block',
    }
  });
}

/**
 * Error message component
 * @param {object} props
 * @param {Error} props.error - Error object
 * @param {Function} props.onRetry - Retry callback
 * @returns {React.Element|string}
 */
export function ErrorMessage({ error, onRetry } = {}) {
  // Check if we're in a React environment
  if (typeof window === 'undefined') {
    // Server-side or Node.js environment - return a simple string
    return `❌ Error: ${error?.message || 'An error occurred'}`;
  }

  const React = globalThis.React;
  if (!React) {
    return `❌ Error: ${error?.message || 'An error occurred'}`;
  }

  return React.createElement('div', {
    style: { 
      padding: '16px', 
      border: '1px solid #ff6b6b', 
      borderRadius: '4px', 
      backgroundColor: '#ffe0e0',
      fontFamily: 'system-ui, sans-serif'
    }
  }, [
    React.createElement('h3', {
      key: 'title',
      style: { margin: '0 0 8px 0', color: '#d63031' }
    }, 'Error'),
    React.createElement('p', {
      key: 'message',
      style: { margin: '0 0 12px 0' }
    }, error?.message || 'An error occurred'),
    onRetry && React.createElement('button', {
      key: 'retry',
      onClick: onRetry,
      style: { 
        padding: '6px 12px', 
        fontSize: '14px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }
    }, 'Retry')
  ].filter(Boolean));
}