/**
 * Button Component
 * Standardized button with consistent styling
 */

import React from 'react'
import { getButtonClasses } from '../../SaqFormTheme'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const classes = getButtonClasses(variant, size, disabled)
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
