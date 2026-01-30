import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Middleware for application-level authorization
 * 
 * Runs AFTER ALB authentication passes, provides fine-grained control:
 * - Whitelist API endpoints for external users (custom:role=external)
 * - Block sensitive endpoints even if user is authenticated
 * - Add custom headers or logging
 */

const EXTERNAL_USER_ALLOWED_ENDPOINTS = [
  // Interface instance endpoints
  '/api/proxy/website/client/interface-instances/get-interface-instance-by-token',
  '/api/proxy/website/client/interface-instances/get-interface-instance',
  '/api/proxy/website/client/interface-instances/update-interface-instance',
  '/api/proxy/website/client/interface-instances/get-interface-instances',
  
  // Questionnaire template endpoints
  '/api/proxy/questionnaire-templates/get-template',
  '/api/proxy/questionnaire-templates/search',
  '/api/proxy/questionnaire-templates/get-templates-by-framework',
  '/api/proxy/questionnaire-template-questions/get-questions-by-template',
  
  // Questionnaire answers endpoints
  '/api/proxy/questionnaire-answers/add-questionnaire-answer',
  '/api/proxy/questionnaire-answers/get-questionnaire-answer',
  '/api/proxy/questionnaire-answers/get-questionnaire-with-latest-answers',
  '/api/proxy/questionnaire-answers/update-questionnaire-answer',
  '/api/proxy/questionnaire-answers/update-questionnaire-answer-status',
  
  // Document endpoints (for PDF preview and download)
  '/api/proxy/documents/get-document',
  '/api/proxy/documents/get-from-s3',
  '/api/proxy/documents/update-render',
  '/api/proxy/documents/submit-signature',

  //user info
 '/api/proxy/user-data/user-info',
  

  // Answer endpoints
  '/api/proxy/answers/add-answer',
  '/api/proxy/answers/bulk-update-answers',
  
  // Questionnaire-answers linking
  '/api/proxy/questionnaire-answers-answers/link-answer',
  
  // External user and email endpoints (for sharing)
  '/api/proxy/client/providers/aws/cognito/external-users/ensure-exists',
  '/api/proxy/client/providers/aws/send-form-link-email',
  '/api/proxy/client/providers/aws/send-email'
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for:
  // - Next.js internals (_next/*)
  // - Static files (*.png, *.ico, etc.)
  // - Public static data files (/data/*)
  // - Public auth endpoints (/api/auth/*)
  // - External form pages (/e/*)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/e/') ||
    pathname.startsWith('/data/') || // Allow public data directory
    pathname.includes('.') // Any file with extension
  ) {
    return NextResponse.next();
  }
  
  // Check if this is an API proxy request
  if (pathname.startsWith('/api/proxy/')) {
    // Get Cognito ID token from cookies
    const cookieStore = cookies();
    const idToken = cookieStore.get('cognito_id_token')?.value;
    
    if (idToken) {
      try {
        // Decode JWT to check user role (no verification needed - Lambda Authorizer does that)
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
        const userRole = payload['custom:role'];
        
        // If user is external, check whitelist
        if (userRole === 'external') {
          const isAllowed = EXTERNAL_USER_ALLOWED_ENDPOINTS.some(endpoint => 
            pathname === endpoint || pathname.startsWith(endpoint + '/')
          );
          
          if (!isAllowed) {
            console.log(`Blocked external user from accessing: ${pathname}`);
            return NextResponse.json(
              { error: 'Access denied', message: 'External users do not have access to this endpoint' },
              { status: 403 }
            );
          }
        }
        
        // Internal users (workflow users) can access all API endpoints
        // They've already passed ALB Cognito authentication
        
      } catch (error) {
        console.error('Error decoding JWT in middleware:', error);
        // Let the request through - Lambda Authorizer will validate properly
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  // Match all paths except those explicitly excluded
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, *.png, *.jpg, etc. (metadata files)
     * - data/* (public CSV and data files)
     */
    '/((?!_next/static|_next/image|data/|.*\\..*|_next/data).*)',
  ],
};
