/**
 * Card Component
 * Standardized card container with consistent styling
 */

import React from 'react'
import { getCardClasses } from '../../SaqFormTheme'

export const Card = ({
  children,
  variant = 'default',
  className = '',
  padding = 'p-5',
  ...props
}) => {
  const classes = getCardClasses(variant)
  
  return (
    <div className={`${classes} ${padding} ${className}`} {...props}>
      {children}
    </div>
  )
}
