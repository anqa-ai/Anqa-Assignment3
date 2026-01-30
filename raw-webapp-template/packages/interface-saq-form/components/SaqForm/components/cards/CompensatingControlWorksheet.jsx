import React from 'react'

/**
 * @deprecated This component is deprecated and replaced by AppendixWorksheet.jsx
 * Please use AppendixWorksheet with colorScheme="purple" instead.
 * This file will be removed in a future version.
 * 
 * Compensating Control Worksheet (Appendix B)
 * Inline collapsible form for completing CCW when "In Place with CCW" is selected
 */
export const CompensatingControlWorksheet = ({
  question,
  response,
  onNotesChange,
  isReviewMode = false,
  appendixBQuestions = []
}) => {
  // Parse worksheet data from notes JSON
  const worksheetData = (() => {
    try {
      return JSON.parse(response?.notes || '{}')
    } catch {
      return {}
    }
  })()

  // Update a specific field in the worksheet
  const updateWorksheetField = (fieldKey, value) => {
    const updated = { ...worksheetData, [fieldKey]: value }
    onNotesChange(question.id, JSON.stringify(updated))
  }

  // Filter and sort Appendix B questions
  const sortedAppendixBQuestions = (appendixBQuestions || [])
    .filter(q => {
      const props = q?.rawProperties || {}
      const isAppendix = props.type === 'Appendix'
      const hasNumber = props.number
      const isBQuestion = hasNumber && String(hasNumber).startsWith('B.')
      return isAppendix && isBQuestion
    })
    .sort((a, b) => {
      const numA = parseFloat(String(a.rawProperties.number).replace('B.', ''))
      const numB = parseFloat(String(b.rawProperties.number).replace('B.', ''))
      return numA - numB
    })

  // Get field keys from sorted questions
  const requiredFields = sortedAppendixBQuestions.map(q => q.rawProperties?.id).filter(Boolean)
  const filledFields = requiredFields.filter(field => worksheetData[field] && worksheetData[field].trim() !== '')
  const completionPercentage = requiredFields.length > 0 
    ? Math.round((filledFields.length / requiredFields.length) * 100)
    : 0

  return (
    <div className="mt-3 rounded-lg border-2 border-purple-300 bg-purple-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h4 className="text-sm font-bold text-purple-900">Appendix B: Compensating Controls Worksheet</h4>
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

      <p className="text-xs text-purple-800 mb-4">
        Complete all fields below to document the compensating control for this requirement. All fields are required.
      </p>

      <div className="space-y-4">
        {sortedAppendixBQuestions.length === 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Appendix B Questions Not Found</p>
                <p className="text-sm text-amber-800">
                  The Appendix B questions could not be loaded from the template. Please ensure the template includes Appendix B questions.
                </p>
              </div>
            </div>
          </div>
        ) : (
          sortedAppendixBQuestions.map((q) => {
            const props = q.rawProperties || {}
            const fieldKey = props.id
            const questionNumber = props.number || ''
            const questionText = q.questionText || ''
            const description = q.description || ''
            const helpText = props.help_text || ''

            return (
              <div key={q.questionUuid}>
                <label className="text-xs font-semibold text-purple-900 mb-1 block">
                  {questionNumber}: {questionText} <span className="text-red-600">*</span>
                </label>
                {description && (
                  <p className="text-xs text-purple-700 mb-1">
                    {description}
                  </p>
                )}
                {helpText && (
                  <p className="text-xs text-purple-600 mb-1 italic">
                    {helpText}
                  </p>
                )}
                <textarea
                  className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                    isReviewMode 
                      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                      : 'border-purple-300 bg-white text-slate-800 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200'
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
                {filledFields.length} of {requiredFields.length} fields completed. All fields must be filled before saving this answer.
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
              Worksheet Complete
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
