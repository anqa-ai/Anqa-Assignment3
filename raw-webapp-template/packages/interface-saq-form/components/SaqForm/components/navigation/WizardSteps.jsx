/**
 * WizardSteps Component
 * Step indicator for multi-step form navigation
 */

import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

export const WizardSteps = ({ steps = [], activeSection, onStepClick = null }) => {
  const handleStepClick = (step) => {
    if (onStepClick) {
      onStepClick(step.key)
    }
  }

  // Determine grid columns based on number of steps
  const getGridCols = () => {
    if (steps.length === 4) return 'lg:grid-cols-4'
    if (steps.length === 3) return 'lg:grid-cols-3'
    if (steps.length === 5) return 'lg:grid-cols-5'
    return 'lg:grid-cols-4' // default
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${getGridCols()}`}>
      {steps.map((step) => {
        const isComplete = Boolean(step.complete)
        
        // Use theme colors
        const cardClasses = isComplete
          ? `${SaqFormTheme.colors.success.border[400]} ${SaqFormTheme.colors.success[50]} ${SaqFormTheme.colors.success.text[700]}`
          : `${SaqFormTheme.colors.neutral.border[200]} bg-white ${SaqFormTheme.colors.neutral.text[500]}`
        
        return (
          <div 
            key={step.key} 
            onClick={() => handleStepClick(step)}
            className={`${SaqFormTheme.borderRadius.md} border p-3 ${SaqFormTheme.shadows.sm} transition-all ${
              cardClasses
            } ${
              onStepClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
            }`}
          >
            <div className="flex flex-col items-center justify-center text-center gap-0.5">
              <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold}`}>{step.label}</p>
              {step.key === activeSection && (
                <svg
                  className={`h-8 w-8 rotate-180 ${step.complete ? SaqFormTheme.colors.success.text[600] : SaqFormTheme.colors.neutral.text[500]}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M10 14l-6-6h12l-6 6z" />
                </svg>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
