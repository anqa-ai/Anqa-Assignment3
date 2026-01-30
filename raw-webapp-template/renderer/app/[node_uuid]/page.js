import { getInterfaceForNode } from '../../lib/interface-loader.js';
import { getAuth, hasAccess } from '../../lib/auth.js';
import { buildContext } from '@webapp/interface-sdk';
import { notFound } from 'next/navigation';
import ErrorPage from './error.js';

export default async function NodePage({ params, searchParams }) {
  const { node_uuid } = params;
  const workflow_uuid = searchParams?.workflow_uuid || null;
  
  // Skip if this looks like a static file request (has file extension)
  if (node_uuid.includes('.')) {
    notFound();
  }
  
  try {
    // Get authentication
    const auth = await getAuth();
    
    // Load interface configuration with workflow support
    const interfaceInfo = await getInterfaceForNode(node_uuid, workflow_uuid);
    
    // Check access permissions
    if (!hasAccess(auth.user, interfaceInfo.node.policy?.roles, interfaceInfo.workflow)) {
      return (
        <ErrorPage
          error={{
            message: 'Access denied',
            code: 'ACCESS_DENIED',
            details: { 
              nodeUUID: node_uuid, 
              workflowUUID: workflow_uuid,
              requiredRoles: interfaceInfo.node.policy?.roles 
            },
          }}
        />
      );
    }
    
    // Interface context for data fetching and rendering using SDK
    const context = buildContext({
      nodeUUID: node_uuid,
      workflowUUID: workflow_uuid,
      user: auth.user,
      params: searchParams || {}, // Add URL/query parameters
      api: {
        baseUrl: '/api-proxy', // Use local BFF proxy instead of direct API calls
        authToken: auth.token,
      },
      branding: interfaceInfo.node.branding,
      workflow: interfaceInfo.workflow,
    });
    
    // Add config to context (buildContext doesn't include this)
    context.config = interfaceInfo.config;
    
    // Fetch interface data
    const data = await interfaceInfo.interface.getData(context);
    
    // Render interface
    const InterfaceComponent = interfaceInfo.interface.default;
    
    return (
      <div>
        {/* Debug info header (remove in production) */}
        <div style={{
          background: '#f8f9fa',
          padding: '8px 16px',
          borderBottom: '1px solid #dee2e6',
          fontSize: '12px',
          color: '#6c757d',
        }}>
          <strong>Debug:</strong> Node {node_uuid} → {interfaceInfo.node.interface}@{interfaceInfo.node.version}
          {workflow_uuid && (
            <span> | Workflow: {workflow_uuid}</span>
          )}
          {interfaceInfo.workflow && (
            <span> | Process: {interfaceInfo.workflow.title}</span>
          )}
        </div>
        
        <InterfaceComponent 
          data={data} 
          branding={interfaceInfo.branding}
          config={interfaceInfo.config}
          workflow={interfaceInfo.workflow}
        />
      </div>
    );
    
  } catch (error) {
    console.error('Template render error:', error);
    
    return (
      <ErrorPage
        error={{
          message: error.message || 'Template rendering failed',
          code: error.code || 'RENDER_ERROR',
          details: error.details || { nodeUUID: node_uuid },
        }}
      />
    );
  }
}