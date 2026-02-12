// Use openapi to create template and instance
// Need to dynamically send form data for right token using endpoint
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
  console.log('🔄 Authentication getData called with context:', {
    nodeUUID: ctx.nodeUUID,
    user: ctx.user?.email || 'anonymous',
    config: ctx.config
  });
  return { authenticated: !!ctx.api.authToken };
}
