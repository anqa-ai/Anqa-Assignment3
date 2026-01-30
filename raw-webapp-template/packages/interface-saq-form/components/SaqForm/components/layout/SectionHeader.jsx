/**
 * SectionHeader Component
 * Standard header for major sections
 */

import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

export const SectionHeader = ({ stepNumber, title, description }) => {
  return (
    <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-6 ${SaqFormTheme.shadows.sm}`}>
      <h2 className={`${SaqFormTheme.typography.fontSize.xl} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[900]}`}>
        {stepNumber && `Step ${stepNumber}: `}{title}
      </h2>
      {description && (
        <p className={`mt-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>
          {description}
        </p>
      )}
    </div>
  )
}
