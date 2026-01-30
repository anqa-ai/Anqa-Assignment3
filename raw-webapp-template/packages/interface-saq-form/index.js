import { createApiClient, validateSchema, InterfaceError } from '@webapp/interface-sdk';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

/**
 * Template component export
 */
export { default } from './render.jsx';

/**
 * Schema export
 */
export { schema };

/**
 * Data fetching function for SAQ Form
 * @param {TemplateContext} ctx - Template context
 * @returns {Promise<any>} Template data
 */
export async function getData(ctx) {
  console.log('🔄 SAQ Form getData called with context:', {
    nodeUUID: ctx.nodeUUID,
    workflowUUID: ctx.workflowUUID,
    user: ctx.user?.email || 'anonymous',
    api: ctx.api.baseUrl
  });

  try {
    // For now, return minimal data
    // In the future, we could fetch saved progress from API
    return {
      progress: null, // Could load saved progress
      config: {
        title: 'PCI SAQ Advisor',
        subtitle: 'Interactive questionnaire to identify the correct PCI Self-Assessment Questionnaire',
        showProgress: true,
        allowExport: true
      }
    };
  } catch (error) {
    console.error('❌ Error in SAQ Form getData:', error);
    throw new InterfaceError(
      `Failed to load SAQ form data: ${error.message}`,
      'DATA_FETCH_ERROR',
      { nodeUUID: ctx.nodeUUID, error: error.message }
    );
  }
}
