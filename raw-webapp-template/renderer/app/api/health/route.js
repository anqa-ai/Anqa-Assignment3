export async function GET(request) {
  const timestamp = new Date().toISOString();
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  // Log health check request
  console.log(`[${timestamp}] Health check from ${clientIp}`);
  
  return Response.json({
    status: 'healthy',
    timestamp,
    service: 'webapp-template-renderer',
    version: '1.0.0',
    clientIp,
  });
}