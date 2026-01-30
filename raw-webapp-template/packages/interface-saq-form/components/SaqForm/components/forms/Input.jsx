/**
 * Input Component
 * Standardized text input with consistent styling
 */

import React from 'react'
import { getInputClasses } from '../../SaqFormTheme'

export const Input = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  error = false,
  className = '',
  ...props
}) => {
  const classes = getInputClasses(error, disabled)
  
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder || 'Enter your response...'}
      disabled={disabled}
      className={`${classes} ${className}`}
      {...props}
    />
  )
}
