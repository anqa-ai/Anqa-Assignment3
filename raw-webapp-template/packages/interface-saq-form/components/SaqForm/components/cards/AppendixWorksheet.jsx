import React from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

/**
 * Generic Appendix Worksheet Component
 * Handles Appendix B, C, D, etc. with dynamic field rendering
 * Supports both single object (B) and array<object> (C, D) formats
 */
export const AppendixWorksheet = ({
  question,
  response,
  onNotesChange,
  isReviewMode = false,
  appendixQuestions = [],
  appendixLetter = 'B',
  title = 'Appendix Worksheet',
  colorScheme = 'purple' // purple, blue, amber, etc.
}) => {
  // Filter and sort Appendix questions by letter
  const sortedAppendixQuestions = (appendixQuestions || [])
    .filter((q) => {
      const props = q?.rawProperties || {}
      const hasNumber = props.number
      const isCorrectLetter = hasNumber && String(hasNumber).startsWith(`${appendixLetter}.`)
      // Exclude .0 questions (requirement definition) as we already have that info from the question
      const isNotZero = hasNumber && String(hasNumber) !== `${appendixLetter}.0`
      return isCorrectLetter && isNotZero
    })
    .sort((a, b) => {
      const numA = parseFloat(String(a.rawProperties.number).replace(`${appendixLetter}.`, ''))
      const numB = parseFloat(String(b.rawProperties.number).replace(`${appendixLetter}.`, ''))
      return numA - numB
    })

  // Determine if this is an array<object> type with schema (C and D) - using SORTED questions
  const isArrayType = sortedAppendixQuestions.length > 0 && 
    sortedAppendixQuestions[0]?.answerType === 'array<object>' &&
    sortedAppendixQuestions[0]?.schema

  // Parse worksheet data from notes JSON
  // For array types (C, D), we store a single-entry array but display it like a single object
  const worksheetData = (() => {
    try {
      const parsed = JSON.parse(response?.notes || (isArrayType ? '[{}]' : '{}'))
      // Ensure correct format based on type
      if (isArrayType) {
        if (!Array.isArray(parsed)) {
          return [{}]
        }
        // Always ensure we have exactly one entry for C and D
        if (parsed.length === 0) {
          return [{}]
        }
        return parsed
      } else {
        if (Array.isArray(parsed)) {
          return {}
        }
        return parsed
      }
    } catch {
      return isArrayType ? [{}] : {}
    }
  })()

  // Update a specific field in the worksheet (for single object type B)
  const updateWorksheetField = (fieldKey, value) => {
    const updated = { ...worksheetData, [fieldKey]: value }
    onNotesChange(question.id, JSON.stringify(updated))
  }

  // Update a field in the single entry (for array type C and D)
  const updateSchemaField = (fieldKey, value) => {
    const entry = worksheetData[0] || {}
    // Add app_c_ or app_d_ prefix to field names for proper namespacing
    const prefixedFieldKey = `app_${appendixLetter.toLowerCase()}_${fieldKey}`
    const updatedEntry = { ...entry, [prefixedFieldKey]: value }
    onNotesChange(question.id, JSON.stringify([updatedEntry]))
  }

  // Get schema if this is array<object> type (C, D)
  const schema = isArrayType && sortedAppendixQuestions.length > 0 
    ? (sortedAppendixQuestions[0].schema || sortedAppendixQuestions[0].rawProperties?.schema)
    : null

  // Calculate completion for single object type (B) or schema-based array type (C, D)
  const getCompletion = () => {
    if (isArrayType && schema) {
      // Array type with schema - check fields in the single entry using prefixed field names
      // Exclude 'requirement' field as it's auto-populated
      const entry = Array.isArray(worksheetData) && worksheetData.length > 0 ? worksheetData[0] : {}
      const schemaKeys = Object.keys(schema).filter(key => key !== 'requirement')
      // Check using prefixed field names
      const filledFields = schemaKeys.filter(key => {
        const prefixedKey = `app_${appendixLetter.toLowerCase()}_${key}`
        return entry[prefixedKey] && String(entry[prefixedKey]).trim() !== ''
      })
      return {
        requiredFields: schemaKeys,
        filledFields,
        percentage: schemaKeys.length > 0 ? Math.round((filledFields.length / schemaKeys.length) * 100) : 0
      }
    } else {
      // Single object type (B) - check fields from questions
      const requiredFields = sortedAppendixQuestions.map(q => q.rawProperties?.id).filter(Boolean)
      const filledFields = requiredFields.filter(field => worksheetData[field] && String(worksheetData[field]).trim() !== '')
      return {
        requiredFields,
        filledFields,
        percentage: requiredFields.length > 0 ? Math.round((filledFields.length / requiredFields.length) * 100) : 0
      }
    }
  }

  const completion = getCompletion()
  const completionPercentage = completion.percentage

  // Color scheme mappings - using theme colors
  const colors = {
    purple: {
      border: SaqFormTheme.colors.primary.border[300],
      bg: SaqFormTheme.colors.primary[50],
      text: SaqFormTheme.colors.primary.text[900],
      textLight: SaqFormTheme.colors.primary.text[700],
      textLighter: SaqFormTheme.colors.primary.text[600],
      barBg: SaqFormTheme.colors.primary[600],
      inputBorder: SaqFormTheme.colors.primary.border[300],
      inputFocus: `focus:${SaqFormTheme.colors.primary.border[500]} focus:ring-cyan-200`
    },
    blue: {
      border: SaqFormTheme.colors.primary.border[300],
      bg: SaqFormTheme.colors.primary[50],
      text: SaqFormTheme.colors.primary.text[900],
      textLight: SaqFormTheme.colors.primary.text[700],
      textLighter: SaqFormTheme.colors.primary.text[600],
      barBg: SaqFormTheme.colors.primary[600],
      inputBorder: SaqFormTheme.colors.primary.border[300],
      inputFocus: `focus:${SaqFormTheme.colors.primary.border[500]} focus:ring-cyan-200`
    },
    amber: {
      border: SaqFormTheme.colors.warning.border[300],
      bg: SaqFormTheme.colors.warning[50],
      text: SaqFormTheme.colors.warning.text[900],
      textLight: SaqFormTheme.colors.warning.text[700],
      textLighter: SaqFormTheme.colors.warning.text[600],
      barBg: SaqFormTheme.colors.warning[600],
      inputBorder: SaqFormTheme.colors.warning.border[300],
      inputFocus: `focus:${SaqFormTheme.colors.warning.border[500]} focus:ring-amber-200`
    }
  }

  const color = colors[colorScheme] || colors.purple

  return (
    <div className={`mt-3 rounded-lg border-2 ${color.border} ${color.bg} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className={`h-5 w-5 ${SaqFormTheme.colors.primary.text[600]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 className={`text-sm font-bold ${color.text}`}>{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            completionPercentage === 100 
              ? 'bg-emerald-100 text-emerald-700'
              : completionPercentage > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {completionPercentage}% Complete
          </span>
        </div>
      </div>

      <p className={`text-xs ${color.textLight} mb-4`}>
        Complete all fields below to document this appendix. All fields are required.
      </p>

      <div className="space-y-4">
        {sortedAppendixQuestions.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Appendix {appendixLetter} Questions Not Found</p>
                <p className="text-sm text-amber-800">
                  The Appendix {appendixLetter} questions could not be loaded from the template. Please ensure the template includes Appendix {appendixLetter} questions.
                </p>
              </div>
            </div>
          </div>
        ) : isArrayType && schema ? (
          /* Array<object> with schema (C, D) - Display schema fields as individual questions */
          /* Hide 'requirement' field as it's auto-populated from question.id */
          Object.entries(schema)
            .filter(([fieldKey]) => fieldKey !== 'requirement') // Hide requirement field
            .map(([fieldKey, fieldConfig]) => {
              const entry = Array.isArray(worksheetData) && worksheetData.length > 0 ? worksheetData[0] : {}
              // Use prefixed field names for storage
              const prefixedFieldKey = `app_${appendixLetter.toLowerCase()}_${fieldKey}`
              return (
                <div key={fieldKey}>
                  <label className={`text-xs font-semibold ${color.text} mb-1 block`}>
                    {fieldConfig.label} <span className="text-red-600">*</span>
                  </label>
                  {fieldConfig.description && (
                    <p className={`text-xs ${color.textLight} mb-1`}>
                      {fieldConfig.description}
                    </p>
                  )}
                  <textarea
                    className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                      isReviewMode 
                        ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                        : `${color.inputBorder} bg-white text-slate-800 focus:outline-none focus:ring-2 ${color.inputFocus}`
                    }`}
                    rows={3}
                    value={entry[prefixedFieldKey] || ''}
                    onChange={(e) => updateSchemaField(fieldKey, e.target.value)}
                    placeholder={isReviewMode ? 'Disabled in review mode' : `Enter ${fieldConfig.label.toLowerCase()}...`}
                    disabled={isReviewMode}
                    readOnly={isReviewMode}
                  />
                </div>
              )
            })
        ) : (
          /* Single object format - One set of fields (Appendix B) */
          sortedAppendixQuestions.map((q) => {
            const props = q.rawProperties || {}
            const fieldKey = props.id
            const questionNumber = props.number || ''
            const questionText = q.questionText || ''
            const description = q.description || ''
            const helpText = props.help_text || ''

            return (
              <div key={q.questionUuid}>
                <label className={`text-xs font-semibold ${color.text} mb-1 block`}>
                  {questionNumber}: {questionText} <span className="text-red-600">*</span>
                </label>
                {description && (
                  <p className={`text-xs ${color.textLight} mb-1`}>
                    {description}
                  </p>
                )}
                {helpText && (
                  <p className={`text-xs ${color.textLighter} mb-1 italic`}>
                    {helpText}
                  </p>
                )}
                <textarea
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                    isReviewMode 
                      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                      : `${color.inputBorder} bg-white text-slate-800 focus:outline-none focus:ring-2 ${color.inputFocus}`
                  }`}
                  rows={3}
                  value={worksheetData[fieldKey] || ''}
                  onChange={(e) => updateWorksheetField(fieldKey, e.target.value)}
                  placeholder={isReviewMode ? 'Disabled in review mode' : `Enter ${questionText.toLowerCase()}...`}
                  disabled={isReviewMode}
                  readOnly={isReviewMode}
                />
              </div>
            )
          })
        )}
      </div>

      {/* Completion Status */}
      {completionPercentage < 100 && !isReviewMode && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">Incomplete Worksheet</p>
              <p className="text-sm text-amber-800">
                {completion.filledFields.length} of {completion.requiredFields.length} fields completed. All fields must be filled before saving this answer.
              </p>
            </div>
          </div>
        </div>
      )}

      {completionPercentage === 100 && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-emerald-900">
              All fields completed! This worksheet is ready for submission.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
