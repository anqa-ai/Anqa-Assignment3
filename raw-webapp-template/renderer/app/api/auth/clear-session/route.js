import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CognitoIdentityProviderClient, RevokeTokenCommand } from '@aws-sdk/client-cognito-identity-provider';

/**
 * POST /api/auth/clear-session
 * 
 * Clears all Cognito authentication cookies AND revokes tokens at Cognito.
 * Used when:
 * - User logs out
 * - Unauthorized access detected (wrong email)
 * - Token validation fails
 * 
 * Security: Revoking the refresh token invalidates all associated access/id tokens,
 * preventing token reuse even if copied before session clear.
 * 
 * Response:
 * - success: boolean
 * - message: string
 */
export async function POST() {
  try {
    const cookieStore = cookies();
    
    // Get refresh token before deleting (needed to revoke at Cognito)
    const refreshTokenCookie = cookieStore.get('cognito_refresh_token');
    const refreshToken = refreshTokenCookie?.value;
    
    // Clear all Cognito cookies first
    cookieStore.delete('cognito_id_token');
    cookieStore.delete('cognito_access_token');
    cookieStore.delete('cognito_refresh_token');
    
    console.log('Session cookies cleared');
    
    // Revoke tokens at Cognito to prevent reuse
    if (refreshToken) {
      try {
        const cognitoClientId = process.env.COGNITO_EXTERNAL_CLIENT_ID;
        const awsRegion = process.env.AWS_REGION || 'eu-west-2';
        
        if (cognitoClientId) {
          const cognitoClient = new CognitoIdentityProviderClient({
            region: awsRegion,
          });
          
          const command = new RevokeTokenCommand({
            Token: refreshToken,
            ClientId: cognitoClientId,
          });
          
          await cognitoClient.send(command);
          console.log('✅ Cognito tokens revoked successfully');
        } else {
          console.warn('⚠️ COGNITO_EXTERNAL_CLIENT_ID not configured - tokens not revoked at Cognito');
        }
      } catch (revokeError) {
        console.error('Failed to revoke tokens at Cognito:', revokeError);
        // Don't fail the entire request - cookies are already cleared
      }
    } else {
      console.log('No refresh token found - skipping Cognito revocation');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Session cleared and tokens revoked',
    });
    
  } catch (error) {
    console.error('Failed to clear session:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to clear session',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
