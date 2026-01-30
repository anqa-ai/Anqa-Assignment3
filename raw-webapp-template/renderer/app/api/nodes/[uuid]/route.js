import { getNodeConfig } from '../../../../lib/interface-loader.js';

export async function GET(request, { params }) {
  try {
    const { uuid } = params;
    const nodeConfig = await getNodeConfig(uuid);
    
    return Response.json({
      success: true,
      data: nodeConfig,
    });
  } catch (error) {
    const status = error.code === 'NODE_NOT_FOUND' ? 404 : 500;
    
    return Response.json({
      success: false,
      error: {
        message: error.message,
        code: error.code || 'INTERNAL_ERROR',
      },
    }, { status });
  }
}