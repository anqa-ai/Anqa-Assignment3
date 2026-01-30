'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { Theme, getButtonClasses, getInputClasses } from '../lib/theme'

/**
 * SignatureModal Component
 * Modal for capturing electronic signatures with legal agreement
 */
const SignatureModal = ({
  isOpen,
  onClose,
  signatureName,
  setSignatureName,
  legalAgreementChecked,
  setLegalAgreementChecked,
  onSave
}) => {
  if (!isOpen) return null

  const handleSave = () => {
    if (signatureName && legalAgreementChecked) {
      onSave()
    }
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-10"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className={`bg-white ${Theme.borderRadius.lg} ${Theme.shadows['2xl']} w-full max-w-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Add Signature</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              className={`w-full px-3 py-2 ${getInputClasses(false, false)}`}
              placeholder="Enter your full name"
            />
          </div>

          {/* Signature Preview */}
          <div className={`border-2 border-dashed ${Theme.colors.neutral.border[300]} ${Theme.borderRadius.md} p-6 ${Theme.colors.neutral[50]}`}>
            <p className="text-xs text-slate-500 mb-2">Preview:</p>
            <div className="text-center">
              <span className="font-cursive text-3xl text-slate-900">
                {signatureName}
              </span>
            </div>
          </div>

          {/* Legal Agreement Checkbox */}
          <div className={`${Theme.colors.warning[50]} border ${Theme.colors.warning.border[200]} ${Theme.borderRadius.md} p-4`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="legalAgreement"
                checked={legalAgreementChecked}
                onChange={(e) => setLegalAgreementChecked(e.target.checked)}
                className={`mt-1 ${Theme.borderRadius.sm} ${Theme.colors.neutral.border[300]}`}
              />
              <label htmlFor="legalAgreement" className="text-sm text-slate-700 flex-1">
                By selecting <span className="font-semibold">"Apply Signature"</span>, I agree that the above signature will be the electronic representation of my signature for all purposes and has the same legal effect as my ink signature on paper.
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={onClose}
              className={`px-4 py-2 ${Theme.typography.fontSize.sm} ${Theme.typography.fontWeight.medium} ${Theme.colors.neutral.text[700]} bg-white border ${Theme.colors.neutral.border[300]} ${Theme.borderRadius.md} hover:${Theme.colors.neutral[50]} transition`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!signatureName || !legalAgreementChecked}
              className={getButtonClasses('primary', 'sm', !signatureName || !legalAgreementChecked)}
            >
              Apply Signature
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SignatureModal
