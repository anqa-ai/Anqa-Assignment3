/**
 * SAQDefinitionCard Component
 * Shows SAQ type with selection checkbox
 */

import React from 'react'
import { SaqFormTheme, getBadgeClasses } from '../../SaqFormTheme'

export const SAQDefinitionCard = ({ 
  saq, 
  isSelected, 
  isSuggested, 
  onToggle 
}) => {
  return (
    <div
      className={`${SaqFormTheme.borderRadius.xl} border p-5 ${SaqFormTheme.shadows.sm} transition-all ${
        isSelected
          ? isSuggested
            ? `${SaqFormTheme.colors.primary.border[400]} ${SaqFormTheme.colors.primary[50]}`
            : `${SaqFormTheme.colors.primary.border[400]} ${SaqFormTheme.colors.primary[50]}`
          : `${SaqFormTheme.colors.neutral.border[200]} bg-white hover:${SaqFormTheme.colors.neutral.border[300]}`
      }`}
    >
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          id={saq.name}
          checked={isSelected}
          onChange={onToggle}
          className={`mt-1 h-5 w-5 ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.primary.text[500]} focus:ring-${SaqFormTheme.colors.primary[500]}`}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <label
              htmlFor={saq.name}
              className={`${SaqFormTheme.typography.fontSize.lg} ${SaqFormTheme.typography.fontWeight.semibold} cursor-pointer ${
                isSelected ? SaqFormTheme.colors.primary.text[900] : SaqFormTheme.colors.neutral.text[900]
              }`}
            >
              {saq.name}
            </label>
            {isSuggested && (
              <span className={`${getBadgeClasses('primary')}`}>
                ⭐ Suggested
              </span>
            )}
            {isSelected && !isSuggested && (
              <span className={`${getBadgeClasses('primary')}`}>
                Custom Selection
              </span>
            )}
          </div>
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.lineHeight.relaxed} ${isSelected ? SaqFormTheme.colors.primary.text[800] : SaqFormTheme.colors.neutral.text[600]}`}>
            {saq.description}
          </p>
          {isSelected && saq.checklist && saq.checklist.length > 0 && (
            <div className="mt-3">
              <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} uppercase tracking-wide ${isSelected ? SaqFormTheme.colors.primary.text[700] : SaqFormTheme.colors.neutral.text[500]}`}>
                Key requirements:
              </p>
              <ul className={`mt-2 list-disc list-inside space-y-1 ${SaqFormTheme.typography.fontSize.sm} ${isSelected ? SaqFormTheme.colors.primary.text[700] : SaqFormTheme.colors.neutral.text[600]}`}>
                {saq.checklist.slice(0, 2).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
