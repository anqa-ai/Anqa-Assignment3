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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className={`${SaqFormTheme.borderRadius.lg} px-5 py-2.5 ${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[700]} bg-white border-2 ${SaqFormTheme.colors.neutral.border[300]} hover:${SaqFormTheme.colors.neutral[50]} transition-colors`}
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
