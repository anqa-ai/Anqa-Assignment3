/**
 * FollowUpQuestion Component
 * Nested question that appears based on parent answer
 */

import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

export const FollowUpQuestion = ({ 
  title, 
  question, 
  value, 
  onToggle, 
  yesLabel, 
  noLabel,
  yesResultMessage,
  noResultMessage,
  variant = 'primary' // 'primary' | 'success' | 'warning'
}) => {
  // Use theme colors based on variant
  const variantStyles = {
    primary: {
      bg: SaqFormTheme.colors.primary[50],
      border: SaqFormTheme.colors.primary.border[200],
      text: SaqFormTheme.colors.primary.text[900],
      textLight: SaqFormTheme.colors.primary.text[800],
      button: SaqFormTheme.colors.primary[600],
    },
    success: {
      bg: SaqFormTheme.colors.success[50],
      border: SaqFormTheme.colors.success.border[200],
      text: SaqFormTheme.colors.success.text[900],
      textLight: SaqFormTheme.colors.success.text[800],
      button: SaqFormTheme.colors.success[600],
    },
    warning: {
      bg: SaqFormTheme.colors.warning[50],
      border: SaqFormTheme.colors.warning.border[200],
      text: SaqFormTheme.colors.warning.text[900],
      textLight: SaqFormTheme.colors.warning.text[800],
      button: SaqFormTheme.colors.warning[600],
    }
  }

  const style = variantStyles[variant] || variantStyles.primary

  return (
    <div className={`mt-4 p-4 ${SaqFormTheme.borderRadius.md} ${style.bg} border ${style.border}`}>
      <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${style.text} mb-2`}>{title}</p>
      <p className={`${SaqFormTheme.typography.fontSize.sm} ${style.textLight} mb-3`}>
        {question}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={`${SaqFormTheme.borderRadius.md} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
            value
              ? `${style.button} text-white ${SaqFormTheme.shadows.sm} hover:opacity-90`
              : `border ${style.border} ${style.textLight} hover:opacity-80`
          }`}
        >
          {yesLabel || 'Yes'}
        </button>
        <button
          type="button"
          onClick={() => onToggle(false)}
          className={`${SaqFormTheme.borderRadius.md} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
            !value
              ? `${style.button} text-white ${SaqFormTheme.shadows.sm} hover:opacity-90`
              : `border ${style.border} ${style.textLight} hover:opacity-80`
          }`}
        >
          {noLabel || 'No'}
        </button>
      </div>
      {yesResultMessage && value && (
        <div className={`mt-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.success[50]} border ${SaqFormTheme.colors.success.border[200]} p-2`}>
          <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.success.text[800]}`}>{yesResultMessage}</p>
        </div>
      )}
      {noResultMessage && !value && (
        <div className={`mt-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.neutral[100]} border ${SaqFormTheme.colors.neutral.border[300]} p-2`}>
          <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[700]}`}>{noResultMessage}</p>
        </div>
      )}
    </div>
  )
}
