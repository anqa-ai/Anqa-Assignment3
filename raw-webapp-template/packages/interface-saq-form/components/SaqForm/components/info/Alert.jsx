/**
 * Alert Component
 * Standardized alert/notification component
 */

import React from 'react'
import { getAlertClasses, SaqFormTheme } from '../../SaqFormTheme'

export const Alert = ({
  children,
  variant = 'info',
  className = '',
  icon,
  ...props
}) => {
  const alertClasses = getAlertClasses(variant)
  const baseClasses = `${SaqFormTheme.borderRadius.md} border p-4 flex items-center gap-2`
  
  return (
    <div 
      className={`${baseClasses} ${alertClasses.bg} ${alertClasses.border} ${className}`}
      {...props}
    >
      {icon && (
        <div className={`flex-shrink-0 ${alertClasses.icon}`}>
          {icon}
        </div>
      )}
      <div className={alertClasses.text}>
        {children}
      </div>
    </div>
  )
}
