/**
 * PDF Signer Configuration - Webapp Deployed Environment
 * Dynamic configuration based on user context (internal vs external)
 */

// Default client for local development and fallbacks
const DEFAULT_CLIENT = 'dev-client'

/**
 * Determine the correct API proxy route based on user context
 * - /e/* paths (external recipients) → /api/proxy-public (uses Cognito JWT)
 * - /i/* paths (internal workflow) → /api/proxy (uses ALB OIDC)
 * @returns {string} - API base URL
 */
export const getApiBase = () => {
  if (typeof window === 'undefined') {
    console.warn('⚠️ getApiBase() called server-side, defaulting to /api/proxy')
    return '/api/proxy' // Server-side default
  }
  
  const path = window.location.pathname
  
  if (path.startsWith('/e/')) {
    console.log('🔓 External recipient detected (/e/*) → using /api/proxy-public')
    return '/api/proxy-public'
  } else if (path.startsWith('/i/')) {
    console.log('🔒 Workflow user detected (/i/*) → using /api/proxy')
    return '/api/proxy'
  } else {
    console.warn('⚠️ Unknown path pattern:', path, '→ defaulting to /api/proxy')
    return '/api/proxy'
  }
}

// Fallback interface instance UUIDs for PDF Signer (by client)
export const FALLBACK_PDF_SIGNER_INTERFACE_INSTANCE_UUIDS = {
  'dev-client': '6c31574a-0a77-4a8b-8f8a-776e3d876543',
  
}

export const DEFAULT_INTERFACE_INSTANCE_UUID = 
  FALLBACK_PDF_SIGNER_INTERFACE_INSTANCE_UUIDS[DEFAULT_CLIENT]

// Client UUIDs for local development fallback (by client)
// These are used when client_uuid cannot be extracted from JWT or URL token
export const FALLBACK_CLIENT_UUIDS = {
  'dev-client': 'ab76e63d-da74-3b16-e7ad-23ee09ab52e0',
}

// Get client UUID based on hostname or use dev-client default
export const getFallbackClientUuid = () => {
  if (typeof window === 'undefined') return FALLBACK_CLIENT_UUIDS[DEFAULT_CLIENT]
  
  const hostname = window.location.hostname || ''
  const match = hostname.match(/^(?:interface\.)?([^.]+)\.platform\.anqa\.ai$/)
  const clientName = match ? match[1] : DEFAULT_CLIENT
  
  return FALLBACK_CLIENT_UUIDS[clientName] || FALLBACK_CLIENT_UUIDS[DEFAULT_CLIENT]
}

/**
 * Get client name from hostname or use default
 * @returns {string} - Client name (e.g., 'allpay', 'dev-client')
 */
export const getClientName = () => {
  if (typeof window === 'undefined') return DEFAULT_CLIENT
  
  const hostname = window.location.hostname || ''
  const match = hostname.match(/^(?:interface\.)?([^.]+)\.platform\.anqa\.ai$/)
  const clientName = match ? match[1] : DEFAULT_CLIENT
  
  return clientName
}

// Cognito User Pool IDs for external users (by client)
export const COGNITO_USER_POOL_IDS = {
  'dev-client': 'eu-west-2_cH0tOvdit',
  'allpay': 'eu-west-2_ze33uCbDE'
}

// Get Cognito User Pool ID based on hostname or use dev-client default
export const getCognitoUserPoolId = () => {
  if (typeof window === 'undefined') return COGNITO_USER_POOL_IDS[DEFAULT_CLIENT]
  
  const hostname = window.location.hostname || ''
  const match = hostname.match(/^(?:interface\.)?([^.]+)\.platform\.anqa\.ai$/)
  const clientName = match ? match[1] : DEFAULT_CLIENT
  
  return COGNITO_USER_POOL_IDS[clientName] || COGNITO_USER_POOL_IDS[DEFAULT_CLIENT]
}

// Fallback questionnaire answer UUIDs for development/testing (by client)
// Used when testing the PDF Signer interface in isolation
export const FALLBACK_QUESTIONNAIRE_ANSWER_UUIDS = {
  'dev-client': '516a6ad1-27e0-465e-adb5-a4b94be4f7c1',
}

// Get fallback questionnaire answer UUID based on hostname or use default
export const getFallbackQuestionnaireAnswerUuid = () => {
  if (typeof window === 'undefined') return FALLBACK_QUESTIONNAIRE_ANSWER_UUIDS[DEFAULT_CLIENT]
  
  const hostname = window.location.hostname || ''
  const match = hostname.match(/^(?:interface\.)?([^.]+)\.platform\.anqa\.ai$/)
  const clientName = match ? match[1] : DEFAULT_CLIENT
  
  return FALLBACK_QUESTIONNAIRE_ANSWER_UUIDS[clientName] || FALLBACK_QUESTIONNAIRE_ANSWER_UUIDS[DEFAULT_CLIENT]
}
