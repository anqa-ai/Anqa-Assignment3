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
    <div className={`mt-5 p-5 ${SaqFormTheme.borderRadius.lg} ${style.bg} border-2 ${style.border} ${SaqFormTheme.shadows.sm}`}>
      <p className={`${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.semibold} ${style.text} mb-2.5`}>{title}</p>
      <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.lineHeight.relaxed} ${style.textLight} mb-4`}>
        {question}
      </p>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => onToggle(true)}
          className={`${SaqFormTheme.borderRadius.lg} px-5 py-2.5 ${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
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
          className={`${SaqFormTheme.borderRadius.lg} px-5 py-2.5 ${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
            !value
              ? `${style.button} text-white ${SaqFormTheme.shadows.sm} hover:opacity-90`
              : `border ${style.border} ${style.textLight} hover:opacity-80`
          }`}
        >
          {noLabel || 'No'}
        </button>
      </div>
      {yesResultMessage && value && (
        <div className={`mt-3 ${SaqFormTheme.borderRadius.lg} ${SaqFormTheme.colors.success[50]} border-2 ${SaqFormTheme.colors.success.border[300]} p-3`}>
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.success.text[800]}`}>{yesResultMessage}</p>
        </div>
      )}
      {noResultMessage && !value && (
        <div className={`mt-3 ${SaqFormTheme.borderRadius.lg} ${SaqFormTheme.colors.neutral[100]} border-2 ${SaqFormTheme.colors.neutral.border[300]} p-3`}>
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[700]}`}>{noResultMessage}</p>
        </div>
      )}
    </div>
  )
}
