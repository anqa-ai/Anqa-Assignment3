import { InterfaceError } from '@webapp/interface-sdk';
import { interfaceRegistry } from './interface-registry.js';
import mockNodes from './mock-nodes.json';

/**
 * Mock node registry - in production this would be a database/API call
 * Get interface configuration for a node UUID
 * Enhanced with workflow context support for ANQA platform integration
 */
export async function getInterfaceForNode(nodeUUID, workflowUUID = null) {
  console.log(`🔍 Loading interface for node: ${nodeUUID}${workflowUUID ? ` (workflow: ${workflowUUID})` : ''}`);
  
  const nodeConfig = mockNodes[nodeUUID];
  
  if (!nodeConfig) {
    throw new InterfaceError(
      `Node not found: ${nodeUUID}`,
      'NODE_NOT_FOUND',
      { nodeUUID, availableNodes: Object.keys(mockNodes) }
    );
  }
  
  // Enhanced node config with workflow context
  const enhancedConfig = {
    ...nodeConfig,
    workflowUUID,
  };
  
  // If this is a workflow-integrated node, fetch additional workflow context
  if (workflowUUID) {
    try {
      // In production, this would fetch from the workflow API
      const workflowContext = await getWorkflowContext(workflowUUID);
      enhancedConfig.workflow = workflowContext;
    } catch (error) {
      console.warn(`Could not fetch workflow context for ${workflowUUID}:`, error.message);
      // Continue without workflow context - interface should handle gracefully
    }
  }
  
  try {
    const interfaceModule = await loadInterface(enhancedConfig.interface);
    
    return {
      interface: interfaceModule,
      node: enhancedConfig,
      branding: enhancedConfig.branding,
      config: enhancedConfig.config,
      workflow: enhancedConfig.workflow,
    };
  } catch (error) {
    throw new InterfaceError(
      `Failed to load interface: ${enhancedConfig.interface}`,
      'INTERFACE_LOAD_FAILED',
      { nodeUUID, interfaceName: enhancedConfig.interface, originalError: error.message }
    );
  }
}

/**
 * Get workflow context from ANQA platform API
 * In production, this would make authenticated API calls
 */
async function getWorkflowContext(workflowUUID) {
  console.log(`🔄 Fetching workflow context: ${workflowUUID}`);
  
  // Mock workflow data for development
  // In production, this would call the ANQA API with authentication
  const mockWorkflowData = {
    workflow_uuid: workflowUUID,
    title: 'Sample Business Process',
    description: 'A workflow triggered business process',
    status: 'in_progress',
    current_node: 'interface-node-001',
    created_at: '2024-01-15T10:30:00Z',
    variables: {
      customer_id: 'CUST-12345',
      request_type: 'onboarding',
      priority: 'high',
    },
    context: {
      originating_system: 'crm',
      business_unit: 'finance',
      compliance_required: true,
    }
  };
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return mockWorkflowData;
}

/**
 * Get node configuration from registry
 * @param {string} nodeUUID - The node UUID
 * @returns {Promise<object>} Node configuration
 */
export async function getNodeConfig(nodeUUID) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const config = mockNodes[nodeUUID];
  if (!config) {
    throw new InterfaceError(
      `Node not found: ${nodeUUID}`,
      'NODE_NOT_FOUND',
      { nodeUUID }
    );
  }
  
  return config;
}

/**
 * Load interface module dynamically
 * @param {string} interfaceName - The interface package name
 * @returns {Promise<object>} Interface module
 */
export async function loadInterface(interfaceName) {
  const module = interfaceRegistry[interfaceName];
  if (!module) {
    throw new InterfaceError(
      `Interface not found: ${interfaceName}`,
      'INTERFACE_NOT_FOUND',
      { interfaceName, available: Object.keys(interfaceRegistry) }
    );
  }
  
  try {
    // Module is already imported statically in interface-registry.js
    // No need to call it as a function
    
    // Validate interface exports
    if (!module.default) {
      throw new InterfaceError(
        `Interface ${interfaceName} missing default export (React component)`,
        'INVALID_INTERFACE',
        { interfaceName }
      );
    }
    
    if (!module.getData || typeof module.getData !== 'function') {
      throw new InterfaceError(
        `Interface ${interfaceName} missing getData function`,
        'INVALID_INTERFACE',
        { interfaceName }
      );
    }
    
    if (!module.schema) {
      throw new InterfaceError(
        `Interface ${interfaceName} missing schema export`,
        'INVALID_INTERFACE',
        { interfaceName }
      );
    }
    
    return module;
  } catch (error) {
    if (error instanceof InterfaceError) {
      throw error;
    }
    
    throw new InterfaceError(
      `Failed to load interface ${interfaceName}: ${error.message}`,
      'INTERFACE_LOAD_ERROR',
      { interfaceName, originalError: error.message }
    );
  }
}

