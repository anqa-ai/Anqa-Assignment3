/**
 * PaymentChannelCard Component
 * Card for payment channel questions in Decision section
 */

import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'
import { YesNoToggle } from '../forms/YesNoToggle'

export const PaymentChannelCard = ({ 
  title, 
  subtitle, 
  description, 
  value, 
  onToggle, 
  children,
  resultMessage 
}) => {
  return (
    <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-5 ${SaqFormTheme.shadows.sm}`}>
      <div className="flex flex-col gap-3">
        <div>
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.neutral.text[900]}`}>{title}</p>
          {subtitle && <p className={`mt-1 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`} style={{ fontStyle: 'italic' }}>{subtitle}</p>}
          {description && (
            <ul className={`mt-2 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]} list-disc list-inside space-y-1`}>
              {Array.isArray(description) ? description.map((item, idx) => (
                <li key={idx}>{item}</li>
              )) : <li>{description}</li>}
            </ul>
          )}
        </div>
        <YesNoToggle value={value} onToggle={onToggle} />
        {resultMessage && value && (
          <div className={`mt-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.success[50]} border ${SaqFormTheme.colors.success.border[200]} p-3`}>
            <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.success.text[800]}`}>{resultMessage}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
