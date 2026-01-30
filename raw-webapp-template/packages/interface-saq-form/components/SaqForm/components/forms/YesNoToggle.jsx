/**
 * YesNoToggle Component
 * Binary toggle buttons for Yes/No questions
 */

import React from 'react'
import { SaqFormTheme, getButtonClasses } from '../../SaqFormTheme'

export const YesNoToggle = ({ value, onToggle, yesLabel = 'Yes', noLabel = 'No' }) => {
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`${SaqFormTheme.borderRadius.md} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
          value
            ? `${SaqFormTheme.colors.success[500]} text-white ${SaqFormTheme.shadows.sm} hover:${SaqFormTheme.colors.success[600]}`
            : `border ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.neutral.text[700]} hover:${SaqFormTheme.colors.neutral.border[400]}`
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onToggle(false)}
        className={`${SaqFormTheme.borderRadius.md} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} transition-colors ${
          !value
            ? `${SaqFormTheme.colors.neutral[500]} text-white ${SaqFormTheme.shadows.sm} hover:${SaqFormTheme.colors.neutral[600]}`
            : `border ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.neutral.text[700]} hover:${SaqFormTheme.colors.neutral.border[400]}`
        }`}
      >
        {noLabel}
      </button>
    </div>
  )
}
