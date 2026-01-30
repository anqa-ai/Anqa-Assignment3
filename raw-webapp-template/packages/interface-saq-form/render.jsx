'use client';

import React from 'react';
import SaqFormInterface from './components/SaqForm/SaqFormInterface.jsx';

/**
 * PCI SAQ Advisor – Interface Package Render
 * 
 * This is the entry point for the interface package.
 * It imports and renders the full SaqFormInterface component.
 */

export default function Render({ data, branding, config, workflow, instanceUUID, interfaceUUID, context, reviewMode }) {
  // Pass through instanceUUID as instanceId prop to the SaqFormInterface component
  // instanceUUID comes from /e/[token] or /i/[instanceUUID] page routing
  // This ensures the component uses the correct instance UUID for API calls
  // reviewMode prop activates review controls automatically (from /i/[instanceUUID]/review route)
  return (
    <SaqFormInterface 
      instanceId={instanceUUID}
      instanceUUID={instanceUUID}
      interfaceUUID={interfaceUUID}
      context={context}
      reviewMode={reviewMode}
    />
  );
}
