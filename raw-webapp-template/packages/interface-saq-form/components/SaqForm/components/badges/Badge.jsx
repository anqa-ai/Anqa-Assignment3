/**
 * Badge Component
 * Standardized badge for status indicators
 */

import React from 'react'
import { getBadgeClasses } from '../../SaqFormTheme'

export const Badge = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const classes = getBadgeClasses(variant)
  
  return (
    <span className={`${classes} ${className}`} {...props}>
      {children}
    </span>
  )
}
