'use client'

import React from 'react'
import { Theme } from '../lib/theme'

/**
 * ThankYouBanner Component
 * Persistent success message shown after signature submission
 */
const ThankYouBanner = ({ onClose }) => {
  return (
    <div className={`${Theme.colors.success[50]} border ${Theme.colors.success.border[300]} ${Theme.borderRadius.lg} p-6 mb-6`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 ${Theme.colors.success[100]} ${Theme.borderRadius.full} flex items-center justify-center`}>
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Thank you for submitting!
          </h3>
          <p className="text-slate-700">
            You will receive an email with the attached signed copy of this document when all other signees have finished.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default ThankYouBanner
