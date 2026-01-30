/**
 * InfoBox Component
 * Alert/info box with different variants
 */

import React from 'react'
import { getAlertClasses, SaqFormTheme } from '../../SaqFormTheme'

export const InfoBox = ({ type = 'info', title, children, className = '' }) => {
  const alertClasses = getAlertClasses(type)
  
  return (
    <div className={`${SaqFormTheme.borderRadius.xl} border-2 p-6 ${SaqFormTheme.shadows.md} ${alertClasses.bg} ${alertClasses.border} ${className}`}>
      {title && <h3 className={`${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.bold} ${alertClasses.text} mb-3`}>{title}</h3>}
      <div className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.lineHeight.relaxed} ${alertClasses.text}`}>{children}</div>
    </div>
  )
}
