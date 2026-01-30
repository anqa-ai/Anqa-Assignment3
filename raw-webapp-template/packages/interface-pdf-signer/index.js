import { createApiClient, validateSchema, InterfaceError } from '@webapp/interface-sdk';
import { getFallbackQuestionnaireAnswerUuid } from './ENV_Specific/PdfSignerConfig.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

/**
 * Interface component export
 */
export { default } from './render.jsx';

/**
 * Schema export
 */
export { schema };

/**
 * Data fetching function
 * @param {InterfaceContext} ctx - Interface context
 * @returns {Promise<any>} Interface data
 */
export async function getData(ctx) {
  console.log('🔄 PDF Signer getData called with context:', {
    nodeUUID: ctx.nodeUUID,
    user: ctx.user?.email || 'anonymous',
    config: ctx.config
  });

  try {
    const { questionnaireAnswerUuid, saqName } = ctx.config || {}
    
    // Use fallback if no questionnaireAnswerUuid provided
    const activeQuestionnaireAnswerUuid = questionnaireAnswerUuid || getFallbackQuestionnaireAnswerUuid()
    
    console.log('📋 PDF Signer getData using questionnaire answer UUID:', activeQuestionnaireAnswerUuid)

    // Return config for client-side data fetching
    // The client component will fetch questionnaire answer to get document UUID,
    // then fetch PDF, metadata, and roles using the proxy API
    return {
      questionnaireAnswerUuid: activeQuestionnaireAnswerUuid,
      saqName: saqName || 'SAQ',
      userEmail: ctx.user?.email || null,
    }
  } catch (error) {
    if (error instanceof InterfaceError) {
      throw error;
    }
    
    throw new InterfaceError(
      `Failed to load PDF signer config: ${error.message}`,
      'DATA_FETCH_ERROR',
      { originalError: error.message }
    );
  }
}
