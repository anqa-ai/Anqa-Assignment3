/**
 * ApplicabilityBadge Component
 * Badge for applicability tags
 */

import React from 'react'
import { SaqFormTheme, getBadgeClasses } from '../../SaqFormTheme'

export const ApplicabilityBadge = ({ tag, isActive }) => {
  return (
    <span
      className={`inline-flex items-center ${SaqFormTheme.borderRadius.full} border px-3 py-1 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} uppercase tracking-wide ${
        isActive
          ? `${SaqFormTheme.colors.primary.border[400]} ${SaqFormTheme.colors.primary[50]} ${SaqFormTheme.colors.primary.text[700]}`
          : `${SaqFormTheme.colors.neutral.border[200]} ${SaqFormTheme.colors.neutral.text[500]}`
      }`}
    >
      {tag}
    </span>
  )
}
