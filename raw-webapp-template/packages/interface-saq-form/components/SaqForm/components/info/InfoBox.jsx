/**
 * InfoBox Component
 * Alert/info box with different variants
 */

import React from 'react'
import { getAlertClasses, SaqFormTheme } from '../../SaqFormTheme'

export const InfoBox = ({ type = 'info', title, children, className = '' }) => {
  const alertClasses = getAlertClasses(type)
  
  return (
    <div className={`${SaqFormTheme.borderRadius.xl} border p-5 ${SaqFormTheme.shadows.sm} ${alertClasses.bg} ${alertClasses.border} ${className}`}>
      {title && <h3 className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${alertClasses.text} mb-2`}>{title}</h3>}
      <div className={`${SaqFormTheme.typography.fontSize.sm} ${alertClasses.text}`}>{children}</div>
    </div>
  )
}
