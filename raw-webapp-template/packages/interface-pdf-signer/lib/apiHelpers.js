/**
 * API Helper Functions
 */

/**
 * Determine the correct API proxy route based on user context
 * - /e/* paths (external recipients) → /api/proxy-public (uses Cognito JWT)
 * - /i/* paths (internal workflow) → /api/proxy (uses ALB OIDC)
 * @returns {string} - API base URL
 */
export const getApiBase = () => {
  if (typeof window === 'undefined') {
    return '/api/proxy' // Server-side default
  }
  
  const path = window.location.pathname
  
  if (path.startsWith('/e/')) {
    return '/api/proxy-public'
  } else if (path.startsWith('/i/')) {
    return '/api/proxy'
  } else {
    return '/api/proxy'
  }
}

/**
 * Get current user email from authentication
 * Assumes auth layer handles JWT extraction
 * @returns {Promise<string|null>}
 */
export const getCurrentUserEmail = async () => {
  try {
    // In a real implementation, this would get the email from the auth context
    // For now, we'll rely on the server-side auth layer
    const apiBase = getApiBase()
    
    // Make a simple auth check request to get user info
    const response = await fetch(`${apiBase}/auth/user`, {
      method: 'GET',
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.email || null
    }
    
    return null
  } catch (error) {
    console.error('Failed to get user email:', error)
    return null
  }
}
