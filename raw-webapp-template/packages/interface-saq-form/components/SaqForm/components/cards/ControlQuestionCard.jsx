import React, { useState, useEffect, useRef } from 'react'
import { detectInputType, detectInputTypeFromLabel } from '../../SaqFormConstants'
import { AppendixWorksheet } from './AppendixWorksheet'
import { SaqFormTheme } from '../../SaqFormTheme'

/**
 * Control Question Card (for SAQ checklist)
 * Supports enum answer type with response options from question.answerOptions
 */
export const ControlQuestionCard = ({ 
  question, 
  response,
  onResponseChange,
  onNotesChange,
  // Review mode props
  isReviewMode = false,
  reviewData = {},
  onReviewToggle,
  onReviewNotesChange,
  templateName = null,
  // Question navigation props (moved from parent)
  currentIndex = null,
  totalQuestions = null,
  onQuestionJump = null,
  allQuestions = null, // Unfiltered questions (for AppendixWorksheet)
  visibleQuestions = null, // Filtered questions (for dropdown display)
  // Template context for guidance
  guidanceByRequirement = {},
  // Validation callback
  onValidationChange = null,
  assignedTo = null
}) => {
  // Use question-specific options from the template (mapped via DataService)
  const baseResponseOptions = question.answerOptions?.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  ) || []
  
  // Filter out "Not Tested" option for SAQ A and SAQ C-VT
  // SAQ D keeps all options including "Not Tested" for QSA assessments
  const effectiveResponseOptions = baseResponseOptions.filter(opt => {
    const optionValue = opt.value || opt
    // Remove "not_tested" for SAQ A and SAQ C-VT (self-assessments)
    if (optionValue === 'not_tested' && (templateName === 'SAQ A' || templateName === 'SAQ C-VT')) {
      return false
    }
    return true
  })
  
  // Notes configuration - use per-question settings or fall back to defaults
  const defaultNotesRequiredFor = ['in_place_with_ccw', 'not_applicable', 'not_tested', 'not_in_place']
  const notesRequiredForValues = question.notesRequiredFor && question.notesRequiredFor.length > 0
    ? question.notesRequiredFor
    : defaultNotesRequiredFor
  
  const notesRequired = notesRequiredForValues.includes(response?.value)
  
  // All options are always available for enum
  const disabledOption = () => false

  // Use per-question notes labels or fall back to defaults
  const defaultNotesLabels = {
    in_place_with_ccw: 'Summarize compensating control (Appendix B)',
    not_in_place: 'Action plan / remediation notes',
    not_applicable: 'Explain why this requirement is not applicable (Appendix C)',
    not_tested: 'Describe what was not tested and explain why (Appendix D)'
  }
  const notesLabelMap = question.notesLabels && Object.keys(question.notesLabels).length > 0
    ? question.notesLabels
    : defaultNotesLabels

  const needsClarification = reviewData?.needsClarification || false
  const reviewNotes = reviewData?.reviewNotes || ''
  
  // Check if clarification was requested (from saved answer status)
  // Use metadata to preserve the clarification state even when value changes
  const savedAnswerStatus = response?.answerStatus
  const clarificationRequested = savedAnswerStatus === 'requires_further_details'
  const reviewerNotes = response?.reviewerNotes || ''
  
  // Use the originalValue from the saved answer (set when answer was first saved)
  // This shows the value that triggered the clarification request
  const originalAnswerValue = response?.originalValue || null

  // Text input validation state
  const [validationWarning, setValidationWarning] = useState('')
  const [isFieldValid, setIsFieldValid] = useState(true) // Tracks if field passes validation (controls button state)
  
  // Array<object> field validation state
  const [fieldValidationWarnings, setFieldValidationWarnings] = useState({})
  
  // Appendix worksheet completeness state (tracked separately from text validation)
  const [isAppendixComplete, setIsAppendixComplete] = useState(true)
  
  // Store local state per question ID to preserve unsaved changes when navigating
  // Structure: { questionId: { appendixB, appendixC, appendixD, plainNotes } }
  const localStateByQuestionRef = useRef({})
  
  // Current question's local state (loaded from ref)
  const [currentLocalState, setCurrentLocalState] = useState({
    appendixB: null,
    appendixC: null,
    appendixD: null,
    plainNotes: ''
  })
  
  // Debounce timeout ref for text input validation
  const validationTimeoutRef = useRef(null)
  
  // Helper function to check if appendix worksheet is complete
  const checkAppendixCompleteness = () => {
    // If no response value yet, consider complete (user hasn't started answering)
    if (!response?.value) {
      setIsAppendixComplete(true)
      return
    }
    
    // Check if this response requires an appendix worksheet
    const requiresAppendix = ['in_place_with_ccw', 'not_applicable', 'not_tested'].includes(response.value)
    
    if (!requiresAppendix) {
      setIsAppendixComplete(true)
      return
    }
    
    // Determine which appendix letter based on response value
    let appendixLetter = null
    if (response.value === 'in_place_with_ccw') appendixLetter = 'B'
    else if (response.value === 'not_applicable') appendixLetter = 'C'
    else if (response.value === 'not_tested') appendixLetter = 'D'
    
    if (!appendixLetter || !response.notes) {
      setIsAppendixComplete(false)
      return
    }
    
    try {
      const worksheetData = JSON.parse(response.notes)
      
      // Get all appendix questions for this letter (excluding .0 questions)
      const appendixQuestions = (allQuestions || [])
        .filter(q => {
          const props = q?.rawProperties || {}
          const isAppendix = props.type === 'Appendix'
          const hasNumber = props.number
          const isCorrectLetter = hasNumber && String(hasNumber).startsWith(`${appendixLetter}.`)
          // Exclude .0 questions (requirement definition)
          const isNotZero = hasNumber && String(hasNumber) !== `${appendixLetter}.0`
          return isAppendix && isCorrectLetter && isNotZero
        })
      
      if (appendixQuestions.length === 0) {
        setIsAppendixComplete(false)
        return
      }

      // Check if this is an array<object> type with schema (C, D)
      const isArrayType = appendixQuestions[0]?.answerType === 'array<object>' && appendixQuestions[0]?.schema
      
      if (isArrayType) {
        // Array type with schema - check single mandatory entry
        const schema = appendixQuestions[0].schema
        if (!schema || !Array.isArray(worksheetData) || worksheetData.length === 0) {
          setIsAppendixComplete(false)
          return
        }
        
        // Get the single entry (always index 0)
        const entry = worksheetData[0]
        // Exclude 'requirement' field as it's auto-populated
        const schemaKeys = Object.keys(schema).filter(key => key !== 'requirement')
        // Check using prefixed field names (app_c_ or app_d_)
        const allFieldsFilled = schemaKeys.every(key => {
          const prefixedKey = `app_${appendixLetter.toLowerCase()}_${key}`
          return entry[prefixedKey] && String(entry[prefixedKey]).trim() !== ''
        })
        setIsAppendixComplete(allFieldsFilled)
      } else {
        // Single object type validation - all fields must be filled (B)
        const requiredFields = appendixQuestions.map(q => q.rawProperties?.id).filter(Boolean)
        
        // Check if all required fields are filled
        const allFieldsFilled = requiredFields.every(field => 
          worksheetData[field] && String(worksheetData[field]).trim() !== ''
        )
        
        const isComplete = allFieldsFilled && requiredFields.length > 0
        setIsAppendixComplete(isComplete)
      }
    } catch {
      setIsAppendixComplete(false)
    }
  }
  
  // Notify parent when validation state changes
  // Combines text field validation AND appendix completeness
  // Use isFieldValid to prevent flickering during typing
  useEffect(() => {
    if (onValidationChange) {
      const hasValidationIssue = !isFieldValid || !isAppendixComplete
      onValidationChange(hasValidationIssue)
    }
  }, [isFieldValid, isAppendixComplete, onValidationChange])

  // Load local state for current question when question changes
  useEffect(() => {
    setValidationWarning('')
    setFieldValidationWarnings({}) // Clear array field warnings too
    setIsFieldValid(true) // Reset to valid state when question changes
    
    // Load local state for this question ID (or initialize empty if first time)
    const questionId = question.id
    if (!localStateByQuestionRef.current[questionId]) {
      // Initialize from saved response if available
      const notes = response?.notes || ''
      const value = response?.value
      
      localStateByQuestionRef.current[questionId] = {
        appendixB: null,
        appendixC: null,
        appendixD: null,
        plainNotes: ''
      }
      
      // Load from saved response
      if (notes) {
        try {
          const parsed = JSON.parse(notes)
          if (Array.isArray(parsed)) {
            if (value === 'not_applicable') {
              localStateByQuestionRef.current[questionId].appendixC = notes
            } else if (value === 'not_tested') {
              localStateByQuestionRef.current[questionId].appendixD = notes
            }
          } else if (typeof parsed === 'object') {
            if (value === 'in_place_with_ccw') {
              localStateByQuestionRef.current[questionId].appendixB = notes
            }
          }
        } catch {
          if (value !== 'in_place_with_ccw' && value !== 'not_applicable' && value !== 'not_tested') {
            localStateByQuestionRef.current[questionId].plainNotes = notes
          }
        }
      }
    }
    
    // Load the state for current question into component state
    setCurrentLocalState({ ...localStateByQuestionRef.current[questionId] })
    
    // Clear any pending validation timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
    }
    
    // Re-validate existing answer when question loads (with slight delay to avoid flicker)
    const timeoutId = setTimeout(() => {
      if (question.answerType === 'text' && response?.value && !isReviewMode) {
        const inputTypeInfo = detectInputType(question)
        if (inputTypeInfo.validator) {
          const isValid = inputTypeInfo.validator(response.value)
          if (!isValid) {
            setValidationWarning(inputTypeInfo.errorMessage)
            setIsFieldValid(false)
          }
        }
      }
      
      // Check appendix worksheet completeness on question load
      checkAppendixCompleteness()
    }, 500)
    
    return () => {
      clearTimeout(timeoutId)
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, isReviewMode])
  
  // Re-check appendix completeness whenever worksheet data (notes) changes
  useEffect(() => {
    checkAppendixCompleteness()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response?.notes, response?.value])

  // Wrapper for onNotesChange that stores to per-question local state
  const handleNotesChange = (questionId, newNotes) => {
    const currentValue = response?.value
    
    // Ensure question state exists
    if (!localStateByQuestionRef.current[questionId]) {
      localStateByQuestionRef.current[questionId] = {
        appendixB: null,
        appendixC: null,
        appendixD: null,
        plainNotes: ''
      }
    }
    
    // Store to appropriate field based on current answer value
    if (currentValue === 'in_place_with_ccw') {
      localStateByQuestionRef.current[questionId].appendixB = newNotes
      setCurrentLocalState(prev => ({ ...prev, appendixB: newNotes }))
    } else if (currentValue === 'not_applicable') {
      localStateByQuestionRef.current[questionId].appendixC = newNotes
      setCurrentLocalState(prev => ({ ...prev, appendixC: newNotes }))
    } else if (currentValue === 'not_tested') {
      localStateByQuestionRef.current[questionId].appendixD = newNotes
      setCurrentLocalState(prev => ({ ...prev, appendixD: newNotes }))
    } else {
      localStateByQuestionRef.current[questionId].plainNotes = newNotes
      setCurrentLocalState(prev => ({ ...prev, plainNotes: newNotes }))
    }
    
    // Call original handler to trigger validation/completeness checks
    onNotesChange(questionId, newNotes)
  }
  
  // Get the current notes value based on answer type from local state
  const getCurrentNotes = () => {
    const currentValue = response?.value
    
    if (currentValue === 'in_place_with_ccw') {
      return currentLocalState.appendixB || '{}'
    } else if (currentValue === 'not_applicable') {
      return currentLocalState.appendixC || '[{}]'
    } else if (currentValue === 'not_tested') {
      return currentLocalState.appendixD || '[{}]'
    } else {
      return currentLocalState.plainNotes || ''
    }
  }
  
  // Create a modified response object that uses current notes from local state
  const responseWithCurrentNotes = {
    ...response,
    notes: getCurrentNotes()
  }
  
  const quickFillOptions = [
    'Insufficient information provided',
    'Further clarification needed'
  ]
  
  // Determine section type from question properties
  const isSection2 = question.sectionTitle?.includes('Requirement') || 
                     question.sectionTitle?.includes('Appendix')

  return (
    <article className={`${SaqFormTheme.borderRadius.lg} border ${SaqFormTheme.shadows.sm} ${
      needsClarification 
        ? `${SaqFormTheme.colors.warning.border[400]} ${SaqFormTheme.colors.warning[50]}` 
        : `${SaqFormTheme.colors.neutral.border[200]} bg-white`
    }`}>
      {/* Card Header with Question Navigation */}
      <div className={`border-b ${SaqFormTheme.colors.neutral.border[200]} bg-gradient-to-r ${SaqFormTheme.colors.neutral[50]} to-white px-5 py-3`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* Section Context in Header */}
            {(question.sectionTitle || question.sectionSubheading || question.sectionSubsubheading) && (
              <div className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`}>
                {question.sectionTitle && (
                  <span className="font-semibold">{question.sectionTitle}</span>
                )}
                {question.sectionSubheading && (
                  <span className="ml-1">› {question.sectionSubheading}</span>
                )}
                {question.sectionSubsubheading && (
                  <span className="ml-1">›› {question.sectionSubsubheading}</span>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {question.questionNumber && (
                <span className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[700]}`}>Question {question.questionNumber}</span>
              )}
              {question.sourcePage && (
                <span className={`text-[11px] ${SaqFormTheme.colors.neutral.text[400]}`}>Page {question.sourcePage}</span>
              )}
              {question.id && (
                <span className={`text-[10px] uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[400]}`}>
                  Question ID: {question.id}
                </span>
              )}
              {templateName && (
                <span className={`text-[10px] uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[400]}`}>
                  Template: {templateName}
                </span>
              )}
              {assignedTo && (
                <span className={`text-[10px] uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[400]}`}>
                  Assigned to {assignedTo}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4">
        {/* Clarification Requested Warning - Show when answer_status is requires_further_details */}
        {clarificationRequested && (
          <div className={`mb-4 ${SaqFormTheme.borderRadius.md} border-2 ${SaqFormTheme.colors.warning.border[400]} ${SaqFormTheme.colors.warning[50]} p-4`}>
            <div className="flex items-start gap-3">
              <svg className={`h-5 w-5 ${SaqFormTheme.colors.warning.text[600]} mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.bold} ${SaqFormTheme.colors.warning.text[900]} mb-1`}>Clarification Requested by Reviewer</p>
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.warning.text[800]} mb-2`}>
                  {reviewerNotes || '(No specific notes provided - please review this answer)'}
                </p>
                {originalAnswerValue && (
                  <div className={`mt-2 ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.warning[100]} p-2 border ${SaqFormTheme.colors.warning.border[200]}`}>
                    <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.warning.text[900]} mb-1`}>Previous Answer:</p>
                    <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.warning.text[800]}`}>
                      {(() => {
                        // Format enum values to show label instead of raw value
                        if (question.answerType === 'enum' && typeof originalAnswerValue === 'string') {
                          const matchingOption = effectiveResponseOptions.find(opt => opt.value === originalAnswerValue)
                          return matchingOption?.label || originalAnswerValue
                        }
                        // Format array<object> to show readable summary
                        if (Array.isArray(originalAnswerValue) && originalAnswerValue.length > 0 && typeof originalAnswerValue[0] === 'object') {
                          return `${originalAnswerValue.length} item${originalAnswerValue.length !== 1 ? 's' : ''} provided`
                        }
                        // Format simple arrays (multiselect) - map values to labels
                        if (Array.isArray(originalAnswerValue)) {
                          // Check if this is a multiselect with options
                          if (effectiveResponseOptions && effectiveResponseOptions.length > 0) {
                            const labels = originalAnswerValue.map(val => {
                              const matchingOption = effectiveResponseOptions.find(opt => opt.value === val)
                              return matchingOption?.label || val
                            })
                            return labels.join(', ')
                          }
                          // Fallback: just join the values
                          return originalAnswerValue.join(', ')
                        }
                        // Format objects
                        if (typeof originalAnswerValue === 'object') {
                          return JSON.stringify(originalAnswerValue)
                        }
                        // Default: convert to string
                        return String(originalAnswerValue)
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Question Text */}
        <div>
          <p className={`${SaqFormTheme.typography.fontSize.base} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[900]} leading-relaxed whitespace-pre-line`}>
            {question.questionText}
          </p>
          {question.description && (
            <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]} mt-1.5 leading-relaxed`}>
              {question.description}
            </p>
          )}
          {question.help_text && (
            <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[500]} mt-1.5 leading-relaxed italic`}>
              {question.help_text}
            </p>
          )}
        </div>
        
        {/* Expected Testing - Prominently displayed for Section 2 (Requirements) */}
        {isSection2 && question.expectedTesting && question.expectedTesting.length > 0 && (
          <div className={`${SaqFormTheme.borderRadius.md} border-l-4 ${SaqFormTheme.colors.primary.border[500]} ${SaqFormTheme.colors.primary[50]} p-3 mt-3`}>
            <div className="flex items-start gap-2">
              <svg className={`h-5 w-5 ${SaqFormTheme.colors.primary.text[600]} mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.bold} ${SaqFormTheme.colors.primary.text[900]} mb-1.5`}>Expected Testing Procedures</p>
                <ul className={`space-y-1 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.primary.text[800]}`}>
                  {question.expectedTesting.map((test, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className={`${SaqFormTheme.colors.primary.text[600]} ${SaqFormTheme.typography.fontWeight.bold} mt-0.5`}>•</span>
                      <span className="flex-1">{test}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Applicability Notes */}
        {(question.applicability_notes || question.applicabilityNotes) && (
          <div className={`${SaqFormTheme.borderRadius.md} border-l-4 ${SaqFormTheme.colors.primary.border[500]} ${SaqFormTheme.colors.primary[50]} p-3 mt-3`}>
            <div className="flex items-start gap-2">
              <svg className={`h-5 w-5 ${SaqFormTheme.colors.primary.text[600]} mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.bold} ${SaqFormTheme.colors.primary.text[900]} mb-1`}>Applicability Notes</p>
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.primary.text[800]}`}>{question.applicability_notes || question.applicabilityNotes}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Review Mode Checkbox */}
        {isReviewMode && onReviewToggle && (
          <div className="mt-2">
            <label className={`flex items-center gap-3 cursor-pointer ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.warning.border[300]} ${SaqFormTheme.colors.warning[100]} px-4 py-2.5 ${SaqFormTheme.shadows.sm} hover:${SaqFormTheme.colors.warning[200]} transition-colors`}>
              <input
                type="checkbox"
                checked={needsClarification}
                onChange={() => onReviewToggle(question.id)}
                className={`h-4 w-4 ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.warning.border[400]} ${SaqFormTheme.colors.warning.text[600]} focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer`}
              />
              <span className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.warning.text[900]}`}>
                Needs Clarification
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Review Notes Section - Only shown in review mode when marked */}
      <div className="px-5 pb-4">
        {isReviewMode && needsClarification && onReviewNotesChange && (
          <div className={`${SaqFormTheme.borderRadius.md} border-2 ${SaqFormTheme.colors.warning.border[300]} ${SaqFormTheme.colors.warning[50]} p-4`}>
            <label className={`block ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.warning.text[900]} mb-2`}>
              Review Notes / Request for Clarification
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              {quickFillOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => onReviewNotesChange(question.id, option)}
                  className={`${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.warning[200]} px-3 py-1 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.warning.text[900]} hover:${SaqFormTheme.colors.warning[300]} transition-colors`}
                >
                  {option}
                </button>
              ))}
            </div>
            <textarea
              className={`w-full ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.warning.border[300]} bg-white px-3 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[800]} ${SaqFormTheme.shadows.sm} focus:${SaqFormTheme.colors.warning.border[500]} focus:outline-none focus:ring-2 focus:ring-amber-200`}
              rows={3}
              value={reviewNotes}
              onChange={(e) => onReviewNotesChange(question.id, e.target.value)}
              placeholder="Enter review notes or clarification request..."
            />
          </div>
        )}
      </div>

      {/* Answer Input Section */}
      <div className="px-5 pb-4">
      {/* Answer Section - Render based on answer_type */}
      {question.answerType === 'text' ? (
        /* Text input with validation */
        (() => {
          const inputTypeInfo = detectInputType(question)
          
          // Check if description mentions "Not Applicable" to show quick-fill button
          const description = question.description || question.questionDescription || ''
          const mentionsNotApplicable = /not applicable|n\/a/i.test(description)
          
          const handleBlur = (value) => {
            // Validate on blur and update warning message
            if (isReviewMode || !inputTypeInfo.validator) {
              return
            }
            
            if (!value || value.trim() === '') {
              // Empty field - clear warning
              setValidationWarning('')
              setIsFieldValid(true)
              return
            }
            
            const isValid = inputTypeInfo.validator(value)
            // Update warning message on blur (this is when we show/hide the banner)
            setValidationWarning(isValid ? '' : inputTypeInfo.errorMessage)
            setIsFieldValid(isValid)
          }
          
          const handleChange = (e) => {
            let newValue = e.target.value
            
            // Filter input based on type to prevent invalid characters
            if (inputTypeInfo.htmlInputType === 'email') {
              newValue = newValue.replace(/[^a-zA-Z0-9@.\-_+]/g, '')
            } else if (inputTypeInfo.htmlInputType === 'url') {
              newValue = newValue.replace(/[^a-zA-Z0-9:/.\-_~?#[\]@!$&'()*+,;=%]/g, '')
            } else if (inputTypeInfo.htmlInputType === 'tel') {
              newValue = newValue.replace(/[^0-9+\-() ]/g, '')
            }
            
            onResponseChange(question.id, newValue)
            
            // Clear any existing timeout
            if (validationTimeoutRef.current) {
              clearTimeout(validationTimeoutRef.current)
            }
            
            // If there's a warning and user is typing, mark field as invalid immediately
            // This keeps buttons disabled while typing
            if (validationWarning !== '' && inputTypeInfo.validator) {
              setIsFieldValid(false)
            }
            
            // Validation strategy:
            // - Show warning when field becomes invalid
            // - Clear warning when field becomes valid (after debounce)
            // - Update both banner and button state together
            if (inputTypeInfo.validator) {
              validationTimeoutRef.current = setTimeout(() => {
                if (newValue && newValue.trim() !== '') {
                  const isValid = inputTypeInfo.validator(newValue)
                  // Update both button state and warning message together
                  setIsFieldValid(isValid)
                  setValidationWarning(isValid ? '' : inputTypeInfo.errorMessage)
                } else {
                  // Empty field - clear warning and mark as valid
                  setIsFieldValid(true)
                  setValidationWarning('')
                }
              }, 500)
            }
          }
          
          return (
            <div>
              {validationWarning && (
                <div className="mb-3 rounded-lg border-2 border-amber-400 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <svg className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-1">Format Warning</p>
                      <p className="text-sm text-amber-800">{validationWarning}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 items-start">
                <input
                  type={inputTypeInfo.htmlInputType}
                  value={response?.value || ''}
                  onChange={handleChange}
                  onBlur={(e) => handleBlur(e.target.value)}
                  disabled={isReviewMode}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm shadow-sm ${
                    isReviewMode 
                      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                      : validationWarning
                      ? 'border-amber-400 bg-white text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200'
                      : 'border-slate-300 bg-white text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200'
                  }`}
                  placeholder={isReviewMode ? 'Disabled in review mode' : 'Enter your answer...'}
                />
                {mentionsNotApplicable && !isReviewMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onResponseChange(question.id, 'Not Applicable')
                      // Clear validation warning since "Not Applicable" is valid text
                      setValidationWarning('')
                      setIsFieldValid(true)
                    }}
                    className="flex-shrink-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-200 transition-colors"
                    title="Fill with 'Not Applicable'"
                  >
                    N/A
                  </button>
                )}
              </div>
            </div>
          )
        })()
      ) : question.answerType === 'date' ? (
        /* Date input */
        <div>
          <input
            type="date"
            value={response?.value || ''}
            onChange={(e) => onResponseChange(question.id, e.target.value)}
            disabled={isReviewMode}
            className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${
              isReviewMode 
                ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                : 'border-slate-300 bg-white text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200'
            }`}
          />
        </div>
      ) : question.answerType === 'multiselect' ? (
        /* Multiselect checkboxes */
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Select all that apply:</p>
          <div className="flex flex-wrap gap-3">
            {effectiveResponseOptions.map((option) => {
              const optionValue = typeof option === 'string' ? option : option.value
              const optionLabel = typeof option === 'string' ? option : option.label
              const isChecked = Array.isArray(response?.value) && response.value.includes(optionValue)
              return (
                <label
                  key={optionValue}
                  className={`flex items-center gap-2 ${SaqFormTheme.borderRadius.md} border-2 px-3 py-2 cursor-pointer transition-all ${
                    isChecked
                      ? `${SaqFormTheme.colors.primary.border[500]} ${SaqFormTheme.colors.primary[50]}`
                      : `${SaqFormTheme.colors.neutral.border[200]} hover:${SaqFormTheme.colors.neutral.border[300]}`
                  } ${isReviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isReviewMode) return
                      const currentValue = Array.isArray(response?.value) ? response.value : []
                      const newValue = isChecked
                        ? currentValue.filter(v => v !== optionValue)
                        : [...currentValue, optionValue]
                      onResponseChange(question.id, newValue)
                    }}
                    disabled={isReviewMode}
                    className={`h-4 w-4 ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.primary.text[600]} focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0`}
                  />
                  <span className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[700]} ${SaqFormTheme.typography.fontWeight.medium}`}>{optionLabel}</span>
                </label>
              )
            })}
          </div>
          
          {/* Summary of selected items */}
          {Array.isArray(response?.value) && response.value.length > 0 && (
            <div className={`mt-3 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-3`}>
              <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.primary.text[900]}`}>
                Selected: {response.value.length} of {effectiveResponseOptions.length} options
              </p>
            </div>
          )}
          
          {/* Optional notes for multiselect */}
          {onNotesChange && (
            <div className="mt-3">
              <label className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[500]}`}>
                Additional Notes (Optional)
              </label>
              <textarea
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                  isReviewMode 
                    ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                    : 'border-slate-300 bg-white text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200'
                }`}
                rows={3}
                value={responseWithCurrentNotes?.notes || ''}
                onChange={(event) => handleNotesChange(question.id, event.target.value)}
                placeholder={isReviewMode ? 'Disabled in review mode' : 'Add notes or reference evidence...'}
                disabled={isReviewMode}
                readOnly={isReviewMode}
              />
            </div>
          )}
        </div>
      ) : question.answerType === 'boolean' ? (
        /* Yes/No toggle */
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onResponseChange(question.id, true)}
            disabled={isReviewMode}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
              response?.value === true
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg ring-2 ring-emerald-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300'
            } ${isReviewMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onResponseChange(question.id, false)}
            disabled={isReviewMode}
            className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold transition-all ${
              response?.value === false
                ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-lg ring-2 ring-rose-200'
                : 'border-slate-200 text-slate-700 hover:border-slate-300'
            } ${isReviewMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            No
          </button>
        </div>
      ) : question.answerType === 'array<object>' && question.schema ? (
        /* Array of objects - Dynamic table input */
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">Add entries:</p>
          
          {/* Display existing entries */}
          {Array.isArray(response?.value) && response.value.length > 0 && (
            <div className="mb-3 space-y-2">
              {response.value.map((entry, entryIndex) => (
                <div key={entryIndex} className="rounded-lg border-2 border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="text-xs font-semibold text-slate-700">Entry {entryIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (isReviewMode) return
                        const newValue = response.value.filter((_, idx) => idx !== entryIndex)
                        onResponseChange(question.id, newValue)
                      }}
                      disabled={isReviewMode}
                      className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.error.text[600]} hover:${SaqFormTheme.colors.error.text[800]} ${SaqFormTheme.typography.fontWeight.medium} disabled:opacity-50`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(question.schema).map(([fieldKey, fieldConfig]) => (
                      <div key={fieldKey}>
                        <label className="text-xs font-medium text-slate-600">{fieldConfig.label}</label>
                        <div className="text-sm text-slate-800 bg-white px-2 py-1.5 rounded-lg border border-slate-200">
                          {entry[fieldKey] || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Add new entry form */}
          {!isReviewMode && (
            <div className={`${SaqFormTheme.borderRadius.md} border-2 ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-3`}>
              <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.primary.text[900]} mb-2`}>New Entry</p>
              <div className="space-y-2">
                {Object.entries(question.schema).map(([fieldKey, fieldConfig]) => {
                  // Detect input type based on field label for validation
                  const fieldInputType = detectInputTypeFromLabel(fieldConfig.label)
                  const fieldWarning = fieldValidationWarnings[fieldKey]
                  
                  const handleFieldBlur = (e) => {
                    const value = e.target.value
                    if (!fieldInputType.validator || !value || value.trim() === '') {
                      setFieldValidationWarnings(prev => ({ ...prev, [fieldKey]: '' }))
                      return
                    }
                    
                    const isValid = fieldInputType.validator(value)
                    if (!isValid) {
                      setFieldValidationWarnings(prev => ({ ...prev, [fieldKey]: fieldInputType.errorMessage }))
                    } else {
                      setFieldValidationWarnings(prev => ({ ...prev, [fieldKey]: '' }))
                    }
                  }
                  
                  const handleFieldChange = (e) => {
                    let newValue = e.target.value
                    
                    // Filter input based on type to prevent invalid characters
                    if (fieldInputType.htmlInputType === 'email') {
                      newValue = newValue.replace(/[^a-zA-Z0-9@.\-_+]/g, '')
                    } else if (fieldInputType.htmlInputType === 'url') {
                      newValue = newValue.replace(/[^a-zA-Z0-9:/.\-_~?#[\]@!$&'()*+,;=%]/g, '')
                    } else if (fieldInputType.htmlInputType === 'tel') {
                      newValue = newValue.replace(/[^0-9+\-() ]/g, '')
                    }
                    
                    // Update the input value
                    e.target.value = newValue
                    
                    setFieldValidationWarnings(prev => ({ ...prev, [fieldKey]: '' }))
                  }
                  
                  return (
                    <div key={fieldKey}>
                      <label className="text-xs font-medium text-slate-700">{fieldConfig.label}</label>
                      {fieldWarning && (
                        <div className="mt-1 mb-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                          {fieldWarning}
                        </div>
                      )}
                      {fieldConfig.type === 'text' ? (
                        <input
                          type={fieldInputType.htmlInputType}
                          id={`new-entry-${question.id}-${fieldKey}`}
                          className={`mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm ${
                            fieldWarning ? 'border-amber-400' : 'border-slate-300'
                          }`}
                          placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                          onBlur={handleFieldBlur}
                          onChange={handleFieldChange}
                        />
                      ) : fieldConfig.type === 'integer' || fieldInputType.inputType === 'integer' ? (
                        <input
                          type="number"
                          id={`new-entry-${question.id}-${fieldKey}`}
                          className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                        />
                      ) : fieldConfig.type === 'date' ? (
                        <input
                          type="date"
                          id={`new-entry-${question.id}-${fieldKey}`}
                          className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <input
                          type="text"
                          id={`new-entry-${question.id}-${fieldKey}`}
                          className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newEntry = {}
                  Object.keys(question.schema).forEach(fieldKey => {
                    const input = document.getElementById(`new-entry-${question.id}-${fieldKey}`)
                    newEntry[fieldKey] = input?.value || ''
                  })
                  
                  // Check if at least one field has a value
                  const hasValue = Object.values(newEntry).some(val => val !== '')
                  if (hasValue) {
                    const currentValue = Array.isArray(response?.value) ? response.value : []
                    onResponseChange(question.id, [...currentValue, newEntry])
                    
                    // Clear inputs
                    Object.keys(question.schema).forEach(fieldKey => {
                      const input = document.getElementById(`new-entry-${question.id}-${fieldKey}`)
                      if (input) input.value = ''
                    })
                  }
                }}
                className={`mt-3 w-full ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.primary[600]} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} text-white hover:${SaqFormTheme.colors.primary[700]}`}
              >
                Add Entry
              </button>
            </div>
          )}
          
          {/* Summary */}
          {Array.isArray(response?.value) && response.value.length > 0 && (
            <div className="mt-2 text-xs text-slate-600">
              Total entries: {response.value.length}
            </div>
          )}
        </div>
      ) : question.answerType === 'array' && question.checklistItems && question.checklistItems.length > 0 ? (
        /* Checklist for array answer type */
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">Select all that apply:</p>
          <div className="space-y-2">
            {question.checklistItems.map((item, index) => {
              const itemId = `checklist-${question.id}-${index}`
              const isChecked = Array.isArray(response?.value) && response.value.includes(index)
              return (
                <label
                  key={itemId}
                  className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all ${
                    isChecked
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${isReviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    id={itemId}
                    checked={isChecked}
                    onChange={() => {
                      if (isReviewMode) return
                      const currentValue = Array.isArray(response?.value) ? response.value : []
                      const newValue = isChecked
                        ? currentValue.filter(i => i !== index)
                        : [...currentValue, index]
                      onResponseChange(question.id, newValue)
                    }}
                    disabled={isReviewMode}
                    className="mt-0.5 h-5 w-5 rounded-lg border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="flex-1 text-sm text-slate-700 leading-relaxed">{item}</span>
                </label>
              )
            })}
          </div>
          
          {/* Summary of selected items */}
          {Array.isArray(response?.value) && response.value.length > 0 && (
            <div className={`mt-3 rounded-lg border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-3`}>
              <p className={`text-xs font-semibold ${SaqFormTheme.colors.primary.text[900]} mb-2`}>
                Selected: {response.value.length} of {question.checklistItems.length} items
              </p>
            </div>
          )}
          
          {/* Optional notes for checklist */}
          {onNotesChange && (
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Additional Notes (Optional)
              </label>
              <textarea
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                  isReviewMode 
                    ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                    : 'border-slate-300 bg-white text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200'
                }`}
                rows={3}
                value={responseWithCurrentNotes?.notes || ''}
                onChange={(event) => handleNotesChange(question.id, event.target.value)}
                placeholder={isReviewMode ? 'Disabled in review mode' : 'Add notes or reference evidence...'}
                disabled={isReviewMode}
                readOnly={isReviewMode}
              />
            </div>
          )}
        </div>
      ) : question.answerType === 'enum' ? (
        /* Generic enum - handle both PCI DSS and other enum types */
        <>
          <div
            className="grid gap-4 md:grid-cols-2"
            role="radiogroup"
            aria-label="Control response options"
          >
            {effectiveResponseOptions.map((option) => {
              const disabled = disabledOption(option) || isReviewMode
              const isSelected = response?.value === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={disabled || undefined}
                  onClick={() => {
                    if (disabled) return
                    // Toggle: if already selected, deselect (set to null)
                    const newValue = isSelected ? null : option.value
                    onResponseChange(question.id, newValue)
                  }}
                  className={`flex h-full w-full items-center justify-center rounded-lg border-2 px-4 py-3 text-sm font-semibold text-center shadow-sm transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg ring-2 ring-blue-200'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${
                    isReviewMode ? 'pointer-events-none' : ''
                  }`}
                  title={isReviewMode ? 'Disabled in review mode' : ''}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
          
          {/* Conditional notes for enum */}
          {notesRequired && onNotesChange && (
            <div className="mt-3">
              {response?.value === 'in_place_with_ccw' ? (
                /* Appendix B: Compensating Controls Worksheet */
                <AppendixWorksheet
                  question={question}
                  response={response}
                  onNotesChange={onNotesChange}
                  isReviewMode={isReviewMode}
                  appendixQuestions={allQuestions || []}
                  appendixLetter="B"
                  title="Appendix B: Compensating Controls Worksheet"
                  colorScheme="purple"
                />
              ) : response?.value === 'not_applicable' ? (
                /* Appendix C: Not Applicable Worksheet */
                <AppendixWorksheet
                  question={question}
                  response={response}
                  onNotesChange={onNotesChange}
                  isReviewMode={isReviewMode}
                  appendixQuestions={allQuestions || []}
                  appendixLetter="C"
                  title="Appendix C: Explanation of Not Applicable"
                  colorScheme="blue"
                />
              ) : response?.value === 'not_tested' ? (
                /* Appendix D: Not Tested Worksheet */
                <AppendixWorksheet
                  question={question}
                  response={response}
                  onNotesChange={onNotesChange}
                  isReviewMode={isReviewMode}
                  appendixQuestions={allQuestions || []}
                  appendixLetter="D"
                  title="Appendix D: Explanation of Not Tested"
                  colorScheme="amber"
                />
              ) : (
                <>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {notesLabelMap[response?.value]}
                  </label>
                  <textarea
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm ${
                      isReviewMode 
                        ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed' 
                        : 'border-slate-300 bg-white text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200'
                    }`}
                    rows={3}
                    value={responseWithCurrentNotes?.notes || ''}
                    onChange={(event) => handleNotesChange(question.id, event.target.value)}
                    placeholder={isReviewMode ? 'Disabled in review mode' : 'Add notes or reference evidence...'}
                    disabled={isReviewMode}
                    readOnly={isReviewMode}
                  />
                </>
              )}
            </div>
          )}
        </>
      ) : (
        /* Fallback for unsupported answer types */
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Answer type <code className="rounded-lg bg-slate-200 px-1 py-0.5 text-xs font-mono">{question.answerType}</code> is not supported in this card view.
          </p>
        </div>
      )}
      
      {/* Optional Contextual Information - Placed after answer inputs */}
      {/* Context Paragraphs Section */}
      {question.contextParagraphs && question.contextParagraphs.length > 0 && (
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Context Information
          </summary>
          <div className="mt-2 space-y-2">
            {question.contextParagraphs.map((paragraph, index) => (
              paragraph && <p key={index} className="text-slate-700">{paragraph}</p>
            ))}
          </div>
        </details>
      )}

      {/* Context Notes Section */}
      {question.contextNotes && question.contextNotes.length > 0 && (
        <details className={`mt-3 rounded-lg border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-3 text-sm text-slate-600`}>
          <summary className={`cursor-pointer text-sm font-semibold ${SaqFormTheme.colors.primary.text[600]}`}>
            Additional Notes
          </summary>
          <div className="mt-2 space-y-2">
            {question.contextNotes.map((note, index) => (
              <p key={index} className="text-slate-700">{note}</p>
            ))}
          </div>
        </details>
      )}

      {/* SAQ Guidance (SAQ-specific instructions) */}
      {question.saq_guidance && (
        <details className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-600">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-600">
            SAQ Guidance
          </summary>
          <div className="mt-2 text-slate-700">{question.saq_guidance}</div>
        </details>
      )}

      {/* SAQ Completion Guidance - matched by requirement number */}
      {(() => {
        // Extract requirement number from question.properties.number using split('.')[0]
        const questionNumber = question.properties?.number || question.questionNumber
        if (!questionNumber) return null
        
        const firstSegment = questionNumber.toString().split('.')[0]
        const requirementKey = `Requirement ${firstSegment}`
        const guidance = guidanceByRequirement[requirementKey]
        
        // Only render if guidance exists and has items
        if (!guidance || !Array.isArray(guidance) || guidance.length === 0) {
          return null
        }
        
        return (
          <details className={`mt-3 rounded-lg border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-3`}>
            <summary className={`cursor-pointer text-sm font-semibold ${SaqFormTheme.colors.primary.text[700]}`}>
              SAQ Completion Guidance ({requirementKey})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {guidance.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>
        )
      })()}
      </div>
    </article>
  )
}
