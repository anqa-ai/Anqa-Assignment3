/**
 * NavigationButtons Component
 * Standard back/forward navigation buttons
 */

import React from 'react'
import { getButtonClasses, SaqFormTheme } from '../../SaqFormTheme'

export const NavigationButtons = ({ 
  onForward, 
  forwardLabel = 'Continue →',
  forwardDisabled = false,
  showForward = true,
  onBack,
  backLabel = '← Back',
  showBack = false
}) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`${SaqFormTheme.borderRadius.md} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.neutral.text[700]} bg-white border ${SaqFormTheme.colors.neutral.border[300]} hover:${SaqFormTheme.colors.neutral[50]} transition-colors`}
        >
          {backLabel}
        </button>
      )}
      {showForward && onForward && (
        <button
          type="button"
          onClick={onForward}
          disabled={forwardDisabled}
          className={getButtonClasses('primary', 'lg', forwardDisabled)}
        >
          {forwardLabel}
        </button>
      )}
    </div>
  )
}
