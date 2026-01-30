/**
 * SectionHeader Component
 * Standard header for major sections
 */

import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

export const SectionHeader = ({ stepNumber, title, description }) => {
  return (
    <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-7 ${SaqFormTheme.shadows.md}`}>
      <h2 className={`${SaqFormTheme.typography.fontSize['2xl']} ${SaqFormTheme.typography.fontWeight.bold} ${SaqFormTheme.colors.neutral.text[900]}`}>
        {stepNumber && `Step ${stepNumber}: `}{title}
      </h2>
      {description && (
        <p className={`mt-3 ${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.colors.neutral.text[600]} ${SaqFormTheme.typography.lineHeight.relaxed}`}>
          {description}
        </p>
      )}
    </div>
  )
}
