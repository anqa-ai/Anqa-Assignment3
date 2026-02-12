/**
 * Interface Package Registry - SIMPLIFIED
 * 
 * To add a new interface, add ONE line in each section below:
 * 1. Import statement
 * 2. Registry entry
 * 
 * Also update:
 * - renderer/package.json dependencies
 * - renderer/next.config.js transpilePackages
 */

// ========== SECTION 1: Static Imports (add new imports here) ==========
import * as InterfaceSaqForm from '@webapp/interface-saq-form';
import * as InterfacePdfSigner from '@webapp/interface-pdf-signer';
import * as InterfaceAuthentication from '@webapp/interface-authentication';
// ========== SECTION 2: Registry Mapping (add new entries here) ==========
export const interfaceRegistry = {
  '@webapp/interface-saq-form': InterfaceSaqForm,
  '@webapp/interface-pdf-signer': InterfacePdfSigner,
  '@webapp/interface-authentication': InterfaceAuthentication,
};

// ========== Helper Functions (no changes needed below) ==========
export async function loadInterface(packageName) {
  const module = interfaceRegistry[packageName];
  
  if (!module) {
    const available = Object.keys(interfaceRegistry).join(', ');
    throw new Error(
      `Interface package '${packageName}' not registered. ` +
      `Available: ${available}`
    );
  }
  
  return module;
}