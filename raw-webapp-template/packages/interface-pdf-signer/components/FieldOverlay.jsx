'use client'

import React from 'react'
import { Theme } from '../lib/theme'
import { getFieldKey, getFieldType, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT } from '../lib/pdfHelpers'

/**
 * FieldOverlay Component
 * Renders interactive field overlays on PDF pages
 */
const FieldOverlay = ({
  field,
  pageWidth,
  fieldValues,
  onFieldChange,
  focusedField,
  setFocusedField,
  onSignatureClick,
  isViewOnly = false
}) => {
  const fieldKey = getFieldKey(field)
  if (!fieldKey) return null

  const fieldType = getFieldType(fieldKey)
  const fieldValue = fieldValues[fieldKey] || ''
  const isFilled = fieldValue && fieldValue.trim() !== ''

  // PDF coordinates: origin at bottom-left
  // HTML coordinates: origin at top-left
  const { bottom_left, top_right } = field.corners

  // Calculate dimensions
  const fieldWidth = top_right.x - bottom_left.x
  const fieldHeight = top_right.y - bottom_left.y

  // Convert Y coordinate (flip from bottom to top)
  const topY = PDF_PAGE_HEIGHT - top_right.y

  // Scale to match rendered page width
  const scale = pageWidth / PDF_PAGE_WIDTH

  return (
    <div
      id={`field-${fieldKey}`}
      className="absolute"
      style={{
        left: `${bottom_left.x * scale}px`,
        top: `${topY * scale}px`,
        width: `${fieldWidth * scale}px`,
        height: `${fieldHeight * scale}px`,
        pointerEvents: 'auto',
        zIndex: 2
      }}
    >
      {fieldType === 'signature' ? (
        // Signature field - clickable placeholder
        <div
          className={`w-full h-full border-2 rounded transition-all ${isViewOnly ? 'cursor-default' : 'cursor-pointer'} flex items-center justify-center overflow-hidden ${
            isFilled && focusedField !== fieldKey
              ? `${Theme.colors.success[50]} ${Theme.colors.success.border[300]}`
              : isFilled
              ? `${Theme.colors.success[100]} ${Theme.colors.success.border[400]}`
              : `${Theme.colors.primary[100]} ${Theme.colors.primary.border[400]} ${isViewOnly ? '' : `hover:${Theme.colors.primary[200]}`}`
          }`}
          onClick={() => {
            if (!isViewOnly) {
              setFocusedField(fieldKey)
              onSignatureClick(field)
            }
          }}
          onBlur={() => setFocusedField(null)}
        >
          {isFilled ? (
            <span
              className="font-cursive text-slate-900 px-1 truncate inline-block"
              style={{
                fontSize: `${Math.min(fieldHeight * scale * 0.6, 16)}px`,
                lineHeight: '1.1',
                textShadow: '0 0 2px rgba(255,255,255,0.8)',
                backgroundColor: 'rgba(255,255,255,0.6)',
                borderRadius: '4px'
              }}
            >
              {fieldValue}
            </span>
          ) : (
            <span className="text-blue-700 px-1 truncate" style={{ fontSize: `${Math.min(fieldHeight * scale * 0.6, 10)}px` }}>
              Click to Sign
            </span>
          )}
        </div>
      ) : fieldType === 'date' ? (
        // Date field - auto-filled, editable
        <input
          type="text"
          value={fieldValue}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          onFocus={() => setFocusedField(fieldKey)}
          onBlur={() => setFocusedField(null)}
          disabled={isViewOnly}
          className={`w-full h-full px-1 border-2 rounded transition-all overflow-hidden ${
            isFilled && focusedField !== fieldKey
              ? 'bg-transparent border-transparent'
              : isFilled
              ? `${Theme.colors.success[50]} ${Theme.colors.success.border[400]}`
              : 'bg-white border-blue-400'
          }`}
          style={{ fontSize: `${Math.min(fieldHeight * scale * 0.6, 12)}px` }}
          placeholder="MM/DD/YYYY"
        />
      ) : (
        // Text field (name, title, company)
        <input
          type="text"
          value={fieldValue}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          onFocus={() => setFocusedField(fieldKey)}
          onBlur={() => setFocusedField(null)}
          disabled={isViewOnly}
          className={`w-full h-full px-1 border-2 rounded transition-all overflow-hidden ${
            isFilled && focusedField !== fieldKey
              ? 'bg-transparent border-transparent'
              : isFilled
              ? `${Theme.colors.success[50]} ${Theme.colors.success.border[400]}`
              : 'bg-white border-blue-400'
          }`}
          style={{ fontSize: `${Math.min(fieldHeight * scale * 0.6, 12)}px` }}
          placeholder={fieldKey.replace(/_/g, ' ')}
        />
      )}
    </div>
  )
}

export default FieldOverlay
