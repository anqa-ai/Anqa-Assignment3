/**
 * SAQ Checklist Sections Component
 * Displays questionnaire responses organized by section
 */
import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SaqFormTheme, getButtonClasses, getBadgeClasses } from './SaqFormTheme'
import { ControlQuestionCard, InfoBox, NavigationButtons, ShareEmailPanel } from './SaqFormUI'
import { calculateSectionProgress, groupQuestionsBySections, getInstanceUuid, extractEmailsFromSentTo, normalizeSentTo, getCurrentUserEmail, getClientUuid } from './SaqFormDataService'
import { getApiBase } from './ENV_Specific/SaqFormConfig'
import { isQuestionVisible } from './SaqConditionalLogic'
import { getRoleDisplayName, ROLE_DISPLAY_NAMES } from './SaqFormConstants'
import PreviewPDF from './components/modals/PreviewPDF'
import { QuestionHeatmap } from './components/navigation/QuestionHeatmap'

/**
 * Section Navigation Row Component
 * Displays progress for the 3 PCI DSS sections with navigation
 * Progress is calculated based on currently visible (filtered) questions
 */
/**
 * Section Navigation Row Component
 * Shows progress for the 3 PCI DSS sections with navigation
 * 
 * @param {Array} uiVisibleQuestions - STAGE 2: Questions visible in UI (after all filters)
 * @param {Array} dependencyFilteredQuestions - STAGE 1: Questions after dependency filtering
 */
const SectionNavigationRow = ({ 
  activeQuestionnaire,
  responses, 
  uiVisibleQuestions,
  dependencyFilteredQuestions,
  onSectionClick,
  handleQuestionJump,
  currentQuestionId = null,
  currentQuestion = null,
  questionnaireMeta = {}
}) => {
  // Track which section's heatmap is open
  const [openHeatmapSection, setOpenHeatmapSection] = useState(null)
  if (!activeQuestionnaire || !uiVisibleQuestions || !dependencyFilteredQuestions) return null

  // Safety check for function availability
  if (typeof calculateSectionProgress !== 'function' || typeof groupQuestionsBySections !== 'function') {
    console.error('Section navigation functions not available')
    return null
  }

  // Calculate progress based on UI-VISIBLE questions (the subset user needs to complete)
  const sectionProgress = calculateSectionProgress(
    responses, 
    uiVisibleQuestions, 
    activeQuestionnaire
  )

  // Build assignee map from questionnaire metadata for heatmap borders
  const assignmentList = activeQuestionnaire
    ? questionnaireMeta?.[activeQuestionnaire]?.metadata?.question_assignments || []
    : []
  const assignedQuestionIds = new Set(
    assignmentList.flatMap(assignment => assignment?.question_ids || [])
  )
  const responsesForHeatmap = { ...(responses?.[activeQuestionnaire] || {}) }
  assignedQuestionIds.forEach((questionId) => {
    responsesForHeatmap[questionId] = {
      ...(responsesForHeatmap[questionId] || {}),
      assignee: true
    }
  })

  // Safety check for sectionProgress result
  if (!sectionProgress || !sectionProgress.section1 || !sectionProgress.section2 || !sectionProgress.section3) {
    console.error('Section progress calculation failed')
    return null
  }

  // Get section groupings for navigation
  const sectionGroups = groupQuestionsBySections(uiVisibleQuestions, dependencyFilteredQuestions)

  // Safety check for sectionGroups result
  if (!sectionGroups || !sectionGroups.section1 || !sectionGroups.section2 || !sectionGroups.section3) {
    console.error('Section grouping failed')
    return null
  }

  const sections = [
    { 
      key: 'section1', 
      label: 'Section 1',
      name: 'Assessment Information',
      ...sectionProgress.section1,
      group: sectionGroups.section1
    },
    { 
      key: 'section2', 
      label: 'Section 2',
      name: 'Self-Assessment Questionnaire',
      ...sectionProgress.section2,
      group: sectionGroups.section2
    },
    { 
      key: 'section3', 
      label: 'Section 3',
      name: 'Validation and Attestation',
      ...sectionProgress.section3,
      group: sectionGroups.section3
    }
  ]

  // Handler for question navigation from heatmap
  const handleQuestionClick = (question) => {
    if (!activeQuestionnaire || !handleQuestionJump) return
    
    // Find the question in dependencyFilteredQuestions to get the correct index
    const dependencyFilteredIdx = dependencyFilteredQuestions.findIndex(
      q => q.id === question.id
    )
    
    if (dependencyFilteredIdx >= 0) {
      handleQuestionJump(activeQuestionnaire, dependencyFilteredIdx)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <p className="text-xs font-medium text-slate-600 mb-2">Section Progress</p>
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => {
          // Only show sections that have questions in the filtered list
          if (!section.group || !section.group.hasQuestions) return null

          const percentage = section.total > 0 
            ? Math.round((section.answered / section.total) * 100) 
            : 0

          // Determine card styling
          let cardStyle = 'bg-slate-50 text-slate-700'
          if (section.complete) {
            cardStyle = 'bg-emerald-50 text-emerald-900'
          } else if (section.answered > 0) {
            cardStyle = 'bg-cyan-50 text-cyan-900'
          }

          const isHeatmapOpen = openHeatmapSection === section.key

          return (
            <div key={section.key} className="flex-1 min-w-[140px]">
              <div 
                onClick={() => {
                  setOpenHeatmapSection(isHeatmapOpen ? null : section.key)
                  onSectionClick(section.key, section.group)
                }}
                className={`px-2 py-1.5 ${SaqFormTheme.borderRadius.md} transition-all ${cardStyle} text-left relative cursor-pointer`}
              >
                <div className="pr-6">
                  <div className="mb-1">
                    <span className="text-xs font-semibold">{section.label}</span>
                  </div>
                  <p className="text-[11px] opacity-80 mb-1.5 line-clamp-1">{section.name}</p>
                  
                  {/* Progress bar */}
                  <div className={`w-full ${SaqFormTheme.colors.neutral[200]} ${SaqFormTheme.borderRadius.full} h-1 overflow-hidden`}>
                    <div 
                      className={`h-full transition-all ${section.complete ? SaqFormTheme.colors.success[600] : SaqFormTheme.colors.primary[600]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-70">{percentage}% complete</p>
                </div>
                
                {/* Arrow icon - bottom right (visual indicator only) */}
                <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
                  <svg
                    className={`h-3.5 w-3.5 text-slate-600 transition-transform ${isHeatmapOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Question Heatmap - Show for any section that has its arrow clicked */}
      {sections.map((section) => {
        if (!section.group || !section.group.hasQuestions) return null
        if (openHeatmapSection !== section.key) return null
        
        return (
          <QuestionHeatmap
            key={`heatmap-${section.key}`}
            questions={section.group.filteredQuestions || []}
            responses={responsesForHeatmap}
            currentQuestionId={currentQuestionId}
            onQuestionClick={handleQuestionClick}
            sectionTitle={`${section.label}: ${section.name}`}
            isOpen={true}
            sectionKey={section.key}
          />
        )
      })}
    </div>
  )
}

/**
 * QuestionnairesSection Component
 * Displays and manages questionnaire questions with multi-stage filtering
 * 
 * FILTERING STAGES:
 * - STAGE 0: sourceQuestions (all questions from API, never modified)
 * - STAGE 1: dependencyFilteredQuestions (dependency logic applied)
 * - STAGE 2: uiVisibleQuestions (answer status + user preferences applied)
 * 
 * @param {Object} dependencyFilteredQuestions - Questions after dependency filtering (STAGE 1)
 * @param {Object} sourceQuestions - Unfiltered source questions (STAGE 0) - used for dependency evaluation
 */
export const QuestionnairesSection = ({
  selectedSAQs = [],
  activeQuestionnaire = null,
  onSelectQuestionnaire = () => {},
  dependencyFilteredQuestions = {},
  sourceQuestions = {},
  questionIndex = {},
  responses = {},
  handleResponseChange,
  handleResponseNotesChange,
  handleQuestionAdvance,
  handleQuestionJump,
  handleJumpToNextUnanswered,
  handleJumpToAssignedQuestion,
  isLoadingQuestions = false,
  questionsError = null,
  reloadQuestionnaires = () => {},
  renderExpectedTesting,
  isReviewMode = false,
  reviewData = {},
  handleReviewToggle,
  handleReviewNotesChange,
  questionnaireMeta = {},
  isAdvancingQuestion = false,
  questionAdvanceError = null,
  templateContext = {},
  onBack,
  handleProceedToAttestation
}) => {
    // Filter state - show all questions by default (including valid ones)
    const [hideValidQuestions, setHideValidQuestions] = useState(false)

  // Track current user email for assigned-question navigation
  const [currentUserEmail, setCurrentUserEmail] = useState(null)
    
    // Track validation state for current question
    const [hasValidationIssue, setHasValidationIssue] = useState(false)
    
    // PreContext accordion state - persisted per SAQ type in localStorage
    const [preContextOpen, setPreContextOpen] = useState(() => {
      if (!activeQuestionnaire) return true
      const storageKey = `saq-precontext-open-${activeQuestionnaire}`
      const saved = localStorage.getItem(storageKey)
      return saved === null ? true : saved === 'true' // Default open
    })

    // Update localStorage when accordion state changes
    useEffect(() => {
      if (activeQuestionnaire) {
        const storageKey = `saq-precontext-open-${activeQuestionnaire}`
        localStorage.setItem(storageKey, preContextOpen.toString())
      }
    }, [preContextOpen, activeQuestionnaire])

    // Reset accordion state when switching questionnaires
    useEffect(() => {
      if (activeQuestionnaire) {
        const storageKey = `saq-precontext-open-${activeQuestionnaire}`
        const saved = localStorage.getItem(storageKey)
        setPreContextOpen(saved === null ? true : saved === 'true')
      }
    }, [activeQuestionnaire])

    // Fetch current user's email for assignment-based navigation
    useEffect(() => {
      let isMounted = true
      const fetchEmail = async () => {
        try {
          const email = await getCurrentUserEmail()
          if (isMounted) setCurrentUserEmail(email)
        } catch (error) {
          console.error('Failed to fetch current user email for assignments', error)
        }
      }
      fetchEmail()
      return () => { isMounted = false }
    }, [])

    // Get current template context
    const currentContext = activeQuestionnaire ? templateContext[activeQuestionnaire] : null
    const preContext = currentContext?.preContext
    const requirementNotes = currentContext?.requirementNotes || {}
    const guidanceByRequirement = currentContext?.guidanceByRequirement || {}

    const summaries = selectedSAQs.map((saq) => {
      const list = dependencyFilteredQuestions[saq] || []
      const idx = questionIndex[saq] || 0
      // Build a set of valid question IDs from the filtered questions list
      // This ensures we only count answers for questions that are actually visible
      const validQuestionIds = new Set(list.map(q => q.id))
      // Only count answers for questions that exist in the filtered questions list
      const answered = Object.keys(responses[saq] || {}).filter(
        qId => validQuestionIds.has(qId) && responses[saq][qId]?.value
      ).length
      const meta = questionnaireMeta[saq] || {}
      const status = meta.questionnaireStatus
      
      // Calculate if all questions are complete
      const sectionProgress = calculateSectionProgress(responses, list, saq)
      const isAllComplete = sectionProgress.section1.complete && 
                            sectionProgress.section2.complete && 
                            sectionProgress.section3.complete

      return {
        saq,
        total: list.length,
        current: list.length === 0 ? 0 : Math.min(idx + 1, list.length),
        answered,
        status,
        isAllComplete
      }
    })

    // STAGE 1: Get dependency-filtered questions for this SAQ
    const dependencyFiltered = activeQuestionnaire ? dependencyFilteredQuestions[activeQuestionnaire] || [] : []
    // STAGE 0: Get source questions (needed for dependency re-evaluation)
    const sourceQuestionsForSaq = activeQuestionnaire ? sourceQuestions[activeQuestionnaire] || [] : []
    
    // STAGE 2: Apply UI visibility filtering
    // Filters based on: answer status (hide 'valid'), user preference (hideValidQuestions toggle),
    // and questionnaire finalization status
    // IMPORTANT: Filter on dependencyFiltered (STAGE 1), not sourceQuestionsForSaq (STAGE 0)
    // This ensures we build on top of dependency filtering, not bypass it
    const uiVisibleQuestions = hideValidQuestions && activeQuestionnaire
      ? dependencyFiltered.filter((question) => {
          const response = responses[activeQuestionnaire]?.[question.id]
          const answerStatus = response?.answerStatus
          const tempStatus = response?.metadata?.temp_status
          
          // Hide if answer_status or temp_status is 'valid'
          if (answerStatus === 'valid' || tempStatus === 'valid') {
            return false
          }
          
          // Check if questionnaire is finalized (not in_progress or draft)
          const questionnaireStatus = questionnaireMeta[activeQuestionnaire]?.questionnaireStatus
          const isQuestionnaireFinalized = questionnaireStatus && 
            questionnaireStatus !== 'in_progress' && 
            questionnaireStatus !== 'draft'
          
          // If finalized, filter questions based on what needs user action:
          if (isQuestionnaireFinalized) {
            // FIRST: Check if this question is in a status that should be hidden from user
            // Hide questions with 'requires_review' status - these are approved and don't need user action
            // This check happens BEFORE dependency checks to ensure approved questions stay hidden
            // Check if question has dependencies
            const dependsOn = question.rawProperties?.depends_on || question.properties?.depends_on
            
            if (dependsOn) {
              // For questions with dependencies, check if they should be visible based on current answers
              // Use sourceQuestionsForSaq (STAGE 0) for dependency evaluation to ensure all questions are considered
              const shouldBeVisible = isQuestionVisible(question, responses[activeQuestionnaire] || {}, sourceQuestionsForSaq)
              
              // Debug logging for dependency evaluation
              if (question.id?.includes('channels_excluded') || question.id?.includes('sec1.2a')) {
                console.log(`🔍 Dependency check for ${question.id}:`, {
                  hasResponse: !!response,
                  answerStatus,
                  shouldBeVisible,
                  dependsOn,
                  allResponses: responses[activeQuestionnaire],
                  parentQuestionValue: responses[activeQuestionnaire]?.['sec1.part2a.channels_excluded']?.value
                })
              }
              
              if (!shouldBeVisible) {
                // Dependencies not met - hide the question
                return false
              }
              
              // Dependencies ARE met - check if parent question(s) were requested for clarification
              // If ANY parent question has requires_further_details, show this question regardless of its own status
              const directDeps = dependsOn.direct || []
              const hasParentRequiringDetails = directDeps.some(dep => {
                // Find parent question ID from UUID
                const parentQuestion = sourceQuestionsForSaq.find(q => 
                  (q.question_uuid || q.questionUuid) === dep.question_uuid
                )
                if (!parentQuestion) return false
                
                const parentQuestionId = parentQuestion.properties?.id || parentQuestion.rawProperties?.id
                const parentResponse = responses[activeQuestionnaire]?.[parentQuestionId]
                return parentResponse?.answerStatus === 'requires_further_details'
              })
              
              if (hasParentRequiringDetails) {
                // Parent question was requested for clarification - show dependent question
                // This allows cascading updates when parent answers change
                return true
              }
              
              // Dependencies met but parent not requiring details - check this question's own status
              // Don't show questions with requires_review status unless they or their parent need clarification
              if (answerStatus === 'requires_review') {
                return false // Hide approved questions waiting for submission
              }
              
              // Dependencies met AND status allows showing - show the question
              return true
            }
            
            // For questions without dependencies: hide if requires_review
            if (answerStatus === 'requires_review') {
              return false // Hide approved questions waiting for submission
            }
            
            // For questions without dependencies, apply standard filtering:
            if (!response) {
              return false // Hide unanswered questions without dependencies
            }
          }
          
          // Show everything else (requires_further_details, pending, invalid, unanswered in draft, etc.)
          return true
        })
      : dependencyFiltered
    
    // INDEX MAPPING:
    // - Global questionIndex uses dependency-filtered indices (STAGE 1)
    // - UI displays based on uiVisibleQuestions indices (STAGE 2)
    // - Need to map between the two stages
    const dependencyFilteredIndex = activeQuestionnaire ? questionIndex[activeQuestionnaire] || 0 : 0
    const questionAtDependencyFilteredIndex = dependencyFiltered[dependencyFilteredIndex] || null
    
    // Find this question in the UI-visible array to get the UI index
    const uiVisibleIndex = questionAtDependencyFilteredIndex 
      ? uiVisibleQuestions.findIndex(q => q.id === questionAtDependencyFilteredIndex.id)
      : 0
    
    // If the current question is filtered out by UI rules, uiVisibleIndex will be -1
    // In that case, default to first question in UI-visible array
    const currentQuestion = uiVisibleIndex >= 0 ? uiVisibleQuestions[uiVisibleIndex] : uiVisibleQuestions[0] || null
    const totalQuestionsVisible = uiVisibleQuestions.length
    const totalQuestionsAfterDependencyFilter = dependencyFiltered.length
    // Build a set of valid question IDs from the UI-visible questions list
    // This ensures we only count answers for questions that are actually visible
    const validQuestionIds = new Set(uiVisibleQuestions.map(q => q.id))
    const answeredCount = activeQuestionnaire
      ? Object.keys(responses[activeQuestionnaire] || {}).filter(
          qId => validQuestionIds.has(qId) && responses[activeQuestionnaire][qId]?.value
        ).length
      : 0

    // Assigned questions for current user (if any)
    const assignmentList = activeQuestionnaire
      ? questionnaireMeta?.[activeQuestionnaire]?.metadata?.question_assignments || []
      : []
    const normalizedEmail = currentUserEmail?.toLowerCase() || null
    const userAssignment = normalizedEmail
      ? assignmentList.find(assignment => assignment.email?.toLowerCase() === normalizedEmail)
      : null
    const availableQuestionIds = new Set((dependencyFilteredQuestions[activeQuestionnaire] || []).map(q => q.id))
    const assignedQuestionIds = (userAssignment?.question_ids || []).filter(id => availableQuestionIds.has(id))
    const hasAssignedQuestions = assignedQuestionIds.length > 0

    const isQuestionComplete = (questionId) => {
      const response = responses[activeQuestionnaire]?.[questionId]
      const hasAnswer = response?.value !== null && response?.value !== undefined
      const answerStatus = response?.answerStatus
      if (!hasAnswer) return false
      return answerStatus !== 'requires_further_details' &&
             answerStatus !== 'invalid' &&
             answerStatus !== 'requires_review'
    }

    const allAssignedComplete = hasAssignedQuestions
      ? assignedQuestionIds.every((questionId) => isQuestionComplete(questionId))
      : false

    const currentQuestionId = currentQuestion?.id || null
    const assignedTo = currentQuestion
      ? assignmentList.find(item => (item?.question_ids || []).includes(currentQuestion.id))?.email || null
      : null
    let nextAssignedQuestionId = assignedQuestionIds[0] || null
    if (currentQuestionId && assignedQuestionIds.length > 0) {
      const currentAssignedIndex = assignedQuestionIds.indexOf(currentQuestionId)
      if (currentAssignedIndex >= 0) {
        const nextIndex = (currentAssignedIndex + 1) % assignedQuestionIds.length
        nextAssignedQuestionId = assignedQuestionIds[nextIndex]
      }
    }
    
    // Sync global questionIndex when current question is filtered out by UI rules
    // This ensures navigation works correctly when UI filtering is active
    useEffect(() => {
      if (!activeQuestionnaire || !hideValidQuestions || totalQuestionsVisible === 0) return
      
      // If current question is filtered out by UI rules (not in UI-visible array)
      if (uiVisibleIndex === -1 && currentQuestion) {
        // Find the dependency-filtered index of the first UI-visible question
        const firstVisibleDependencyFilteredIndex = dependencyFiltered.findIndex(q => q.id === currentQuestion.id)
        if (firstVisibleDependencyFilteredIndex >= 0 && firstVisibleDependencyFilteredIndex !== dependencyFilteredIndex) {
          // Update global index to point to the first visible question
          handleQuestionJump(activeQuestionnaire, firstVisibleDependencyFilteredIndex)
        }
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeQuestionnaire, uiVisibleIndex, dependencyFilteredIndex, hideValidQuestions, totalQuestionsVisible])
    
    // Handle section navigation
    const handleSectionNavigation = (sectionKey, sectionGroup) => {
      if (!activeQuestionnaire) return

      // Use dependency-filtered index for global navigation
      const targetIndex = sectionGroup.firstUnfilteredIndex

      if (targetIndex >= 0) {
        handleQuestionJump(activeQuestionnaire, targetIndex)
      } else {
        console.warn(`No questions found for ${sectionKey}`)
      }
    }
    
    // Helper function to check if a question needs attention
    const needsAttention = (question) => {
      const response = responses[activeQuestionnaire]?.[question.id]
      const value = response?.value
      const answerStatus = response?.answerStatus
      
      // Question needs attention if:
      // 1. No answer provided yet (null or undefined)
      if (value === null || value === undefined) return true // Unanswered
      
      // Special handling for array<object> type questions
      if (question.answerType === 'array<object>') {
        // Check if array is empty or not an array
        if (!Array.isArray(value) || value.length === 0) {
          return true // Empty array needs attention
        }
        
        // For array<object> with schema, check if required fields are filled
        if (question.schema) {
          // Get the first entry (array<object> typically has a single mandatory entry)
          const entry = value[0]
          if (!entry || typeof entry !== 'object') {
            return true // Invalid entry structure
          }
          
          // Check all schema fields except 'requirement' (which is auto-populated)
          const schemaKeys = Object.keys(question.schema).filter(key => key !== 'requirement')
          const allFieldsFilled = schemaKeys.every(key => {
            const fieldValue = entry[key]
            return fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== ''
          })
          
          if (!allFieldsFilled) {
            return true // Incomplete entry needs attention
          }
        }
      }
      
      // If there's a value but no status (unsaved local answer), skip it - it's answered
      if (!answerStatus) return false
      
      // 2. Check if answer status indicates issues that need USER action
      // BUT: If the value has been modified locally and is now valid, don't count it as needing attention
      // This handles the case where a question has requires_further_details status but user just fixed it
      // NOTE: 'requires_review' is for REVIEWER attention, not user attention - exclude it!
      const hasIssueStatus = answerStatus === 'requires_further_details' || 
                            answerStatus === 'invalid'
      
      if (hasIssueStatus) {
        // Check if this is the current question being viewed
        const isCurrentQuestion = currentQuestion && question.id === currentQuestion.id
        
        // If it's the current question and user is actively fixing it,
        // hasValidationIssue will tell us if the current value is still invalid
        // For current question: only needs attention if hasValidationIssue is true
        if (isCurrentQuestion) {
          return hasValidationIssue
        }
        
        // For other questions with issue status: they need attention
        return true
      }
      
      // Skip questions that are already valid or pending
      return false
    }
    
    // Find next question that needs attention AFTER current index
    // Use uiVisibleQuestions so navigation only jumps to visible questions
    let nextUnansweredUiIndex = uiVisibleQuestions.findIndex((question, idx) => {
      if (idx <= uiVisibleIndex) return false // Skip questions before or at current position
      return needsAttention(question)
    })
    
    // If no question found after current position, wrap around from the beginning
    if (nextUnansweredUiIndex === -1) {
      nextUnansweredUiIndex = uiVisibleQuestions.findIndex((question, idx) => {
        if (idx >= uiVisibleIndex) return false // Only check questions before current position
        return needsAttention(question)
      })
    }
    
    // Convert UI-visible index to dependency-filtered index
    // This is critical because handleQuestionJump expects dependency-filtered indices
    let nextUnansweredIndex = -1
    if (nextUnansweredUiIndex >= 0) {
      const nextQuestion = uiVisibleQuestions[nextUnansweredUiIndex]
      nextUnansweredIndex = dependencyFiltered.findIndex(q => q.id === nextQuestion.id)
    }

    return (
      <section className="space-y-6">
        <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-4 ${SaqFormTheme.shadows.sm}`}>
          {selectedSAQs.length === 0 ? (
            <p className="text-sm text-slate-500">
              Select at least one SAQ in the previous step to unlock questionnaires.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-700">Active Questionnaires</h3>
              </div>

              <div className="flex flex-wrap gap-2">
                {summaries.map(({ saq, total, current, answered, status, isAllComplete }) => {
                  // Determine card styling based on completion status and status
                  let cardStyle = ''
                  if (status === 'approved') {
                    cardStyle = 'border-emerald-500 bg-emerald-100 text-emerald-900'
                  } else if (isAllComplete) {
                    // All questions completed - show green
                    cardStyle = 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  } else if (status === 'info_requested' || status === 'requires_info') {
                    cardStyle = 'border-amber-400 bg-amber-50 text-amber-900'
                  } else if (status === 'providing_info' || status === 'in_progress') {
                    cardStyle = 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  } else {
                    cardStyle = 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }
                  
                  return (
                    <button
                      key={saq}
                      type="button"
                      onClick={() => onSelectQuestionnaire(saq)}
                      className={`flex min-w-[140px] flex-col ${SaqFormTheme.borderRadius.md} border px-3 py-2 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.shadows.sm} transition ${cardStyle}`}
                    >
                      <div className="flex items-center justify-center gap-0.5 text-center">
                        {activeQuestionnaire === saq && (
                          <svg
                            className={`h-3 w-3 rotate-180 ${isAllComplete || status === 'approved' ? SaqFormTheme.colors.success.text[600] : SaqFormTheme.colors.neutral.text[500]}`}
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path d="M7 10l6 6V4l-6 6z" />
                          </svg>
                        )}
                        <span className="text-sm font-semibold">{saq}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* SAQ Introduction */}
              {preContext?.content && (
                <div className={`mb-4 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} ${SaqFormTheme.shadows.sm}`}>
                  {/* Header with explicit toggle button */}
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setPreContextOpen(!preContextOpen)}>
                    <h3
                      className={`font-semibold text-cyan-700 ${preContextOpen ? 'opacity-0' : ''}`}
                      aria-hidden={preContextOpen}
                    >
                      SAQ Introduction
                    </h3>
                    <button
                      type="button"
                      className={`flex items-center gap-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.primary[100]} px-3 py-1.5 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.primary.text[800]} hover:${SaqFormTheme.colors.primary[200]} transition-colors`}
                      aria-label={preContextOpen ? "Hide introduction" : "Show introduction"}
                    >
                      {preContextOpen ? (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Hide
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Show
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Collapsible content */}
                  {preContextOpen && (
                    <div className="px-4 pb-4 pt-0 text-slate-700 markdown-content">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: (props) => <h1 className="text-xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                        h2: (props) => <h2 className="text-lg font-bold text-slate-900 mt-5 mb-3" {...props} />,
                        h3: (props) => <h3 className="text-base font-bold text-slate-900 mt-4 mb-2" {...props} />,
                        p: (props) => <p className="text-slate-700 leading-relaxed my-3" {...props} />,
                        strong: (props) => <strong className="font-bold text-slate-900" {...props} />,
                        em: (props) => <em className="italic text-slate-700" {...props} />,
                        ul: (props) => <ul className="list-disc pl-6 my-3 space-y-1" {...props} />,
                        ol: (props) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />,
                        li: (props) => <li className="text-slate-700" {...props} />,
                        table: (props) => <table className="border-collapse border border-slate-300 my-4 w-full" {...props} />,
                        thead: (props) => <thead className="bg-slate-100" {...props} />,
                        th: (props) => <th className="border border-slate-300 p-2 font-semibold text-left text-slate-900" {...props} />,
                        td: (props) => <td className="border border-slate-300 p-2 text-slate-700" {...props} />,
                        a: (props) => <a className="text-cyan-600 underline hover:text-cyan-800" {...props} />,
                        code: ({inline, ...props}) => 
                          inline 
                            ? <code className="bg-slate-100 px-1 py-0.5 rounded-lg text-sm font-mono" {...props} />
                            : <code className="block bg-slate-100 p-3 rounded-lg text-sm font-mono overflow-x-auto" {...props} />
                      }}
                    >
                      {preContext.content}
                    </ReactMarkdown>
                    {/* Hide button at bottom */}
                    <div className="flex justify-center mt-4 pt-4 border-t border-cyan-200">
                      <button
                        type="button"
                        onClick={() => setPreContextOpen(false)}
                        className={`flex items-center gap-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.primary[100]} px-3 py-1.5 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.primary.text[800]} hover:${SaqFormTheme.colors.primary[200]} transition-colors`}
                        aria-label="Hide introduction"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Hide
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              )}

              {/* Section Navigation Row */}
              <SectionNavigationRow
                activeQuestionnaire={activeQuestionnaire}
                responses={responses}
                uiVisibleQuestions={uiVisibleQuestions}
                dependencyFilteredQuestions={dependencyFiltered}
                onSectionClick={handleSectionNavigation}
                handleQuestionJump={handleQuestionJump}
                currentQuestionId={currentQuestion?.id || null}
                currentQuestion={currentQuestion}
                questionnaireMeta={questionnaireMeta}
              />

              {!currentQuestion && totalQuestionsVisible === 0 && totalQuestionsAfterDependencyFilter > 0 && (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-semibold text-slate-900">All visible questions completed!</h3>
                  <p className="mt-1 text-sm text-slate-500">All questions requiring attention have been answered.</p>
                </div>
              )}

              {!currentQuestion && !(totalQuestionsVisible === 0 && totalQuestionsAfterDependencyFilter > 0) && (
                <div className={`${SaqFormTheme.borderRadius.md} border border-dashed ${SaqFormTheme.colors.neutral.border[200]} ${SaqFormTheme.colors.neutral[50]}/70 p-3 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[500]}`}>
                  {activeQuestionnaire
                    ? 'No controls are available for this questionnaire yet.'
                    : 'Choose a questionnaire above to begin answering controls.'}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedSAQs.length > 0 && (
          <div className="space-y-4">
            {isLoadingQuestions && (
              <InfoBox type="info">Loading questionnaire controls…</InfoBox>
            )}

            {questionsError && (
              <InfoBox type="error">
                <div className="flex flex-col gap-3">
                  <span>{questionsError}</span>
                  <button
                    type="button"
                    onClick={reloadQuestionnaires}
                    className={getButtonClasses('primary', 'sm', false)}
                  >
                    Retry loading
                  </button>
                </div>
              </InfoBox>
            )}

            {!isLoadingQuestions && !questionsError && !currentQuestion && (
              <InfoBox type="neutral">
                {activeQuestionnaire
                  ? 'No controls are available for this questionnaire yet.'
                  : 'Select a questionnaire to begin answering controls.'}
              </InfoBox>
            )}

            {currentQuestion && (
              <div className="space-y-4">
                {/* Requirement Section Note - Display when heading changes */}
                {(() => {
                  // Check if this is a new requirement section
                  const currentHeading = currentQuestion.properties?.heading || ''
                  const prevQuestion = uiVisibleIndex > 0 ? uiVisibleQuestions[uiVisibleIndex - 1] : null
                  const prevHeading = prevQuestion?.properties?.heading || ''
                  
                  // Check if heading changed AND contains "Requirement"
                  if (currentHeading !== prevHeading && currentHeading.includes('Requirement')) {
                    // Extract requirement key (e.g., "Requirement 3")
                    const match = currentHeading.match(/Requirement\s+(\d+)/i)
                    if (match) {
                      const requirementKey = `Requirement ${match[1]}`
                      const note = requirementNotes[requirementKey]
                      
                      if (note) {
                        return (
                          <details 
                            open
                            className={`mb-4 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.warning.border[300]} ${SaqFormTheme.colors.warning[50]} p-4 ${SaqFormTheme.shadows.sm}`}
                          >
                            <summary className="cursor-pointer font-semibold text-amber-700">
                              {requirementKey} Notes
                            </summary>
                            <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                              {note}
                            </div>
                          </details>
                        )
                      }
                    }
                  }
                  return null
                })()}

                <ControlQuestionCard
                  question={currentQuestion}
                  response={responses[activeQuestionnaire]?.[currentQuestion.id]}
                  onResponseChange={(qId, value) => handleResponseChange(qId, value, activeQuestionnaire)}
                  onNotesChange={(qId, notes) => handleResponseNotesChange(qId, notes, activeQuestionnaire)}
                  renderExpectedTesting={renderExpectedTesting}
                  isReviewMode={isReviewMode}
                  reviewData={reviewData[activeQuestionnaire]?.[currentQuestion.id]}
                  guidanceByRequirement={guidanceByRequirement}
                  onReviewToggle={(qId) => handleReviewToggle(qId, activeQuestionnaire)}
                  onReviewNotesChange={(qId, notes) => handleReviewNotesChange(qId, notes, activeQuestionnaire)}
                  questionnaireLabel={activeQuestionnaire}
                  templateName={activeQuestionnaire}
                  currentIndex={uiVisibleIndex}
                  totalQuestions={totalQuestionsVisible}
                  onValidationChange={setHasValidationIssue}
                  assignedTo={assignedTo}
                  onQuestionJump={(uiIdx) => {
                    // Convert UI-visible index to dependency-filtered index
                    const selectedQuestion = uiVisibleQuestions[uiIdx]
                    if (selectedQuestion) {
                      const dependencyFilteredIdx = dependencyFiltered.findIndex(q => q.id === selectedQuestion.id)
                      if (dependencyFilteredIdx >= 0) {
                        handleQuestionJump(activeQuestionnaire, dependencyFilteredIdx)
                      }
                    }
                  }}
                  allQuestions={sourceQuestionsForSaq}
                  visibleQuestions={uiVisibleQuestions}
                />

                {questionAdvanceError && (
                  <InfoBox type="error">{questionAdvanceError}</InfoBox>
                )}

                {/* Calculate if active questionnaire is complete */}
                {(() => {
                  const sectionProgress = calculateSectionProgress(
                    responses,
                    uiVisibleQuestions,
                    activeQuestionnaire
                  )
                  const isActiveQuestionnaireComplete = 
                    sectionProgress.section1.complete &&
                    sectionProgress.section2.complete &&
                    sectionProgress.section3.complete
                  
                  const hasUnansweredQuestions = nextUnansweredIndex >= 0
                  const showNextAssigned = hasAssignedQuestions
                  const showMarkAssignedComplete = hasAssignedQuestions && allAssignedComplete
                  const showNextUnanswered = hasUnansweredQuestions && !isActiveQuestionnaireComplete
                  const showSignAndSubmit = isActiveQuestionnaireComplete && selectedSAQs.length > 0
                  
                  return (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => handleQuestionAdvance(activeQuestionnaire, 'previous')}
                        className={`inline-flex items-center ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]} px-6 py-3 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[600]} hover:${SaqFormTheme.colors.neutral[50]} disabled:cursor-not-allowed disabled:opacity-60`}
                        disabled={uiVisibleIndex <= 0 || totalQuestionsVisible === 0}
                      >
                        ← Previous question
                      </button>
                      
                      {/* Combined button: Next unanswered question OR Sign and Submit */}
                      {showNextAssigned || showNextUnanswered ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                            {showNextUnanswered && (
                              <button
                                type="button"
                                onClick={async () => {
                                  // Save current answer and navigate to next unanswered question (if any)
                                  await handleJumpToNextUnanswered(activeQuestionnaire, nextUnansweredIndex, currentQuestion)
                                }}
                                className={getButtonClasses('primary', 'lg', false)}
                                disabled={isAdvancingQuestion || hasValidationIssue}
                              >
                                {isAdvancingQuestion ? 'Saving answer…' : 'Next unanswered question →'}
                              </button>
                            )}
                            {showNextAssigned && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!nextAssignedQuestionId) return
                                  await handleJumpToAssignedQuestion(activeQuestionnaire, nextAssignedQuestionId, currentQuestion)
                                }}
                                className={getButtonClasses('primary', 'lg', false)}
                                disabled={isAdvancingQuestion || hasValidationIssue || !nextAssignedQuestionId}
                              >
                                {isAdvancingQuestion ? 'Saving answer…' : 'Next assigned question →'}
                              </button>
                            )}
                          </div>
                          {showMarkAssignedComplete && (
                            <button
                              type="button"
                              onClick={() => handleProceedToAttestation(currentQuestion)}
                              className={`inline-flex items-center ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[600]} hover:${SaqFormTheme.colors.neutral[50]}`}
                            >
                              Mark assigned questions as complete
                            </button>
                          )}
                        </div>
                      ) : showSignAndSubmit ? (
                        <button
                          type="button"
                          onClick={() => handleProceedToAttestation(currentQuestion)}
                          className={`inline-flex items-center ${SaqFormTheme.borderRadius.md} bg-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600`}
                        >
                          Sign and Submit →
                        </button>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

      </section>
    )
  }

export const ChecklistSection = ({
  selectedSAQs,
  onBack,
  handleProceedToAttestation,
}) => {
  return (
    <section className="space-y-8">
      <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-6 ${SaqFormTheme.shadows.sm}`}>
        <p className="text-sm text-slate-500">
          ChecklistSection is now commented out. Use QuestionnairesSection for unified SAQ rendering.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Active SAQs: {selectedSAQs.join(', ') || 'None'}
        </p>
      </div>

      {/* Navigation */}
      <NavigationButtons
        onForward={handleProceedToAttestation}
        forwardLabel="Sign and Submit →"
      />
    </section>
  )
}

export const AttestationSection = ({
  selectedSAQs = [],
  onBack,
  onSubmitSAQ,
  isSubmitting = {},
  questionnaireMeta = {},
  responses = {},
  dependencyFilteredQuestions = {},
  onUpdateQuestionnaireMeta = null,
  reloadQuestionnaires = null,
  instanceUuid = null,
  onShare = null,
  onRemove = null,
  externalRefetchTrigger = 0
}) => {
  const DEFAULT_REQUIRED_ROLES = Object.keys(ROLE_DISPLAY_NAMES)
  // Track PDF rendering state for each SAQ
  const [pdfRenderingState, setPdfRenderingState] = useState({})
  // Track which SAQs have had their PDF rendered
  const [pdfRenderedSAQs, setPdfRenderedSAQs] = useState({})
  // Track which SAQ's signees modal is open
  const [openSigneesModalForSAQ, setOpenSigneesModalForSAQ] = useState(null)
  // Track missing roles for each SAQ
  const [missingRoles, setMissingRoles] = useState({}) // { saq: ['role1', 'role2'] }
  // Track when to refetch missing roles (increments when modal closes)
  const [refetchMissingRolesCounter, setRefetchMissingRolesCounter] = useState(0)
  // Track collaborators list
  const [collaborators, setCollaborators] = useState([]) // Array of {email, name}
  // Track required roles for each SAQ
  const [requiredRoles, setRequiredRoles] = useState({}) // { saq: ['role1', 'role2'] }
  // Track assigned roles for each SAQ (role -> email mapping)
  const [assignedRoles, setAssignedRoles] = useState({}) // { saq: { role: email } }
  // Track signature status for each role
  const [roleSignatureStatus, setRoleSignatureStatus] = useState({}) // { saq: { role: 'signed' | 'pending' | 'no_signee' } }

  const sendRoleAssignmentReminder = async ({ email, name, role, saq }) => {
    if (!email) return

    try {
      const apiBase = getApiBase()
      console.log('📧 Sending notify-to-sign email', { email, role, saq })

      const emailResponse = await fetch(`${apiBase}/documents/notify-to-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_email: email
        }),
        credentials: 'include'
      })

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text()
        console.warn('⚠️ Failed to send reminder email:', errorText)
        return
      }

      console.log('✅ Notify-to-sign email sent successfully')
    } catch (error) {
      console.warn('⚠️ Failed to send reminder email:', error)
    }
  }

  const parseTimestamp = (value) => {
    if (!value) return null
    if (typeof value === 'number') return value
    let normalized = value
    if (typeof value === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
      normalized = `${value}Z`
    }
    const time = Date.parse(normalized)
    return Number.isNaN(time) ? null : time
  }

  const getLatestAnswerUpdateMsForSaq = (saq) => {
    const saqResponses = responses?.[saq]
    if (!saqResponses || typeof saqResponses !== 'object') return null

    let latest = null
    Object.values(saqResponses).forEach((response) => {
      const ts = parseTimestamp(
        response?.updatedAt || response?.metadata?.updated_at || response?.metadata?.updatedAt
      )
      if (ts && (!latest || ts > latest)) {
        latest = ts
      }
    })

    return latest
  }

  // Function to trigger PDF render for an SAQ
  const triggerPdfRender = async (saq, questionnaireAnswerUuid) => {
    if (!questionnaireAnswerUuid) {
      console.warn(`⚠️ No questionnaire answer UUID for ${saq}`)
      return
    }

    // Mark as rendering
    setPdfRenderingState(prev => ({ ...prev, [saq]: 'rendering' }))

    try {
      const apiBase = getApiBase()
      console.log(`🔄 Triggering PDF render for ${saq}...`)
      
      const response = await fetch(`${apiBase}/documents/update-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questionnaire_answer_uuid: questionnaireAnswerUuid,
          s3_bucket: "main-dev-dev-client-files-bucket"
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Failed to render PDF: ${response.status}`)
      }

      const result = await response.json()
      console.log(`✅ PDF render complete for ${saq}:`, result)

      // Extract document_uuid from response and update state
      // API response structure: {success: true, data: {document_uuid: "...", ...}}
      const newDocumentUuid = result?.data?.document_uuid || 
                              result?.data?.document?.document_uuid ||
                              result?.document_uuid || 
                              result?.document?.document_uuid
      
      if (newDocumentUuid && onUpdateQuestionnaireMeta) {
        console.log(`📝 Updating ${saq} with new document_uuid:`, newDocumentUuid)
        onUpdateQuestionnaireMeta(saq, { 
          document_uuid: newDocumentUuid 
        })
      } else {
        console.warn(`⚠️ No document_uuid found in response for ${saq}.`)
        console.warn(`   Response structure:`, JSON.stringify(result, null, 2))
      }

      // Mark as complete
      setPdfRenderingState(prev => ({ ...prev, [saq]: 'complete' }))
      setPdfRenderedSAQs(prev => ({ ...prev, [saq]: true }))
    } catch (error) {
      console.error(`❌ Failed to render PDF for ${saq}:`, error)
      setPdfRenderingState(prev => ({ ...prev, [saq]: 'error' }))
    }
  }

  const checkAndRenderPdf = async (saq, questionnaireAnswerUuid, latestAnswerUpdateMs) => {
    if (!questionnaireAnswerUuid) {
      console.warn(`⚠️ No questionnaire answer UUID for ${saq}`)
      return
    }

    setPdfRenderingState(prev => ({ ...prev, [saq]: 'checking' }))

    try {
      const apiBase = getApiBase()
      const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
        credentials: 'include'
      })

      if (!qResponse.ok) {
        throw new Error(`Failed to fetch questionnaire answer: ${qResponse.status}`)
      }

      const qData = await qResponse.json()
      const questionnaireAnswer = qData?.questionnaire_answer
      const documentUuid = questionnaireAnswer?.metadata?.document_uuid
      const lastRenderAt = questionnaireAnswer?.metadata?.last_render_generated_at
      const updatedAt = questionnaireAnswer?.updated_at

      if (documentUuid && onUpdateQuestionnaireMeta) {
        onUpdateQuestionnaireMeta(saq, {
          document_uuid: documentUuid,
          last_render_generated_at: lastRenderAt
        })
      }

      const updatedAtMs = parseTimestamp(updatedAt)
      const lastRenderMs = parseTimestamp(lastRenderAt)
      const answerUpdatedMs = latestAnswerUpdateMs || null

      const needsRender = !documentUuid || !lastRenderMs || (answerUpdatedMs && answerUpdatedMs > lastRenderMs)

      if (needsRender) {
        await triggerPdfRender(saq, questionnaireAnswerUuid)
        return
      }

      setPdfRenderingState(prev => ({ ...prev, [saq]: 'complete' }))
      setPdfRenderedSAQs(prev => ({ ...prev, [saq]: true }))
    } catch (error) {
      console.error(`❌ Failed to check render status for ${saq}:`, error)
      setPdfRenderingState(prev => ({ ...prev, [saq]: 'error' }))
    }
  }

  // Calculate missing roles for each SAQ
  useEffect(() => {
    const calculateMissingRoles = async () => {
      const missingRolesMap = {}
      
      for (const saq of selectedSAQs) {
        const meta = questionnaireMeta[saq] || {}
        const documentUuid = meta?.metadata?.document_uuid
        const questionnaireAnswerUuid = meta?.questionnaireAnswerUuid
        const isSubmitted = meta.questionnaireStatus === 'submitted'
        
        // Don't show missing roles if questionnaire is submitted
        if (isSubmitted) {
          missingRolesMap[saq] = []
          continue
        }
        
        if (!documentUuid || !questionnaireAnswerUuid) {
          missingRolesMap[saq] = DEFAULT_REQUIRED_ROLES
          continue
        }
        
        try {
          const apiBase = getApiBase()
          let requiredRoles = []
          let assignedRoles = []
          
          // Fetch document metadata to get required roles (groups)
          const docResponse = await fetch(`${apiBase}/documents/get-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_uuid: documentUuid }),
            credentials: 'include'
          })
          
          if (docResponse.ok) {
            const docData = await docResponse.json()
            // Use groups directly from document_properties (consistent with SaqFormUI.jsx)
            requiredRoles = docData?.document?.metadata?.document_properties?.groups || []
          }
          
          // Fetch questionnaire answer to get assigned roles
          const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
            credentials: 'include'
          })
          
          if (qResponse.ok) {
            const qData = await qResponse.json()
            const rolesArray = qData?.questionnaire_answer?.metadata?.roles || []
            const requiredRolesFromQuestionnaire = 
              qData?.questionnaire_answer?.metadata?.required_roles ||
              qData?.questionnaire_answer?.metadata?.requiredRoles
            
            // Priority: document.groups > questionnaire.required_roles > empty array
            // Never fall back to DEFAULT_REQUIRED_ROLES - that can add roles not in the document
            if (!requiredRoles.length) {
              if (requiredRolesFromQuestionnaire !== undefined && requiredRolesFromQuestionnaire.length > 0) {
                // Use questionnaire required_roles if explicitly set and non-empty
                requiredRoles = requiredRolesFromQuestionnaire
              }
              // else: keep requiredRoles as empty array (from document.groups fetch above)
            }
            
            // Extract all assigned roles (flatten the array of objects)
            rolesArray.forEach(roleObj => {
              Object.values(roleObj).forEach(role => {
                if (role && !assignedRoles.includes(role)) {
                  assignedRoles.push(role)
                }
              })
            })
          }
          
          // Don't add DEFAULT_REQUIRED_ROLES - respect empty array
          // Empty array means no roles required, or document.groups was empty
          
          // Find missing roles
          const missing = requiredRoles.filter(role => !assignedRoles.includes(role))
          missingRolesMap[saq] = missing
        } catch (error) {
          console.error(`❌ Error calculating missing roles for ${saq}:`, error)
          missingRolesMap[saq] = DEFAULT_REQUIRED_ROLES
        }
      }
      
      setMissingRoles(missingRolesMap)
    }
    
    calculateMissingRoles()
  }, [selectedSAQs, questionnaireMeta, refetchMissingRolesCounter, externalRefetchTrigger])

  // Load collaborators and required roles
  useEffect(() => {
    const loadCollaboratorsAndRoles = async () => {
      if (!onShare) return
      
      try {
        const apiBase = getApiBase()
        const effectiveInstanceUuid = instanceUuid || await getInstanceUuid()
        console.log('🔎 Loading collaborators/roles', {
          selectedSAQs,
          effectiveInstanceUuid,
          hasOnShare: !!onShare
        })
        
        // Get interface instance to see sent_to list
        const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_uuid: effectiveInstanceUuid }),
          credentials: 'include'
        })
        
        if (!instanceResponse.ok) {
          console.error('❌ Failed to load interface instance:', instanceResponse.status)
          return
        }
        
        const instanceData = await instanceResponse.json()
        console.log('✅ Loaded interface instance', {
          sent_to_count: (instanceData?.instance?.sent_to || []).length
        })
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build collaborators list (use name if available, otherwise email)
        const collaboratorsList = sentToNormalized.map(item => ({ 
          email: item.email, 
          name: item.name || item.email 
        }))
        setCollaborators(collaboratorsList)
        
        // Get required roles and assigned roles for each SAQ
        const requiredRolesMap = {}
        const assignedRolesMap = {}
        const signatureStatusMap = {}
        
        for (const saq of selectedSAQs) {
          const meta = questionnaireMeta[saq] || {}
          const documentUuid = meta?.metadata?.document_uuid
          const questionnaireAnswerUuid = meta?.questionnaireAnswerUuid
          
          if (!documentUuid && !questionnaireAnswerUuid) {
            console.warn(`⚠️ Missing metadata for ${saq}`, {
              documentUuid,
              questionnaireAnswerUuid
            })
            requiredRolesMap[saq] = DEFAULT_REQUIRED_ROLES
            assignedRolesMap[saq] = {}
            signatureStatusMap[saq] = {}
            continue
          }
          
          try {
            let requiredRoles = []
            let roleEmailMap = {}
            let signedRoles = []

            // Get required roles from document
            if (documentUuid) {
              const docResponse = await fetch(`${apiBase}/documents/get-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_uuid: documentUuid }),
                credentials: 'include'
              })
              
              if (docResponse.ok) {
                const docData = await docResponse.json()
                requiredRoles = docData?.document?.metadata?.document_properties?.groups || []
                console.log(`📄 Document roles for ${saq}`, {
                  documentUuid,
                  requiredRoles
                })
              } else {
                console.warn(`⚠️ Document roles request failed for ${saq}`, {
                  documentUuid,
                  status: docResponse.status
                })
              }
            }
            
            // Get assigned roles from questionnaire
            if (questionnaireAnswerUuid) {
              const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
                credentials: 'include'
              })
              
              if (qResponse.ok) {
                const qData = await qResponse.json()
                const rolesArray = qData?.questionnaire_answer?.metadata?.roles || []
                const signatureSubmissions = qData?.questionnaire_answer?.metadata?.signature_submissions || {}
                signedRoles = qData?.questionnaire_answer?.metadata?.signed_roles || []
                const requiredRolesFromQuestionnaire = 
                  qData?.questionnaire_answer?.metadata?.required_roles ||
                  qData?.questionnaire_answer?.metadata?.requiredRoles ||
                  []
                
                // Extract all signer emails from signature_submissions
                const signatureEmails = []
                Object.values(signatureSubmissions).forEach(submission => {
                  const email = submission?.signatures?.signer_email
                  if (email && !signatureEmails.includes(email)) {
                    signatureEmails.push(email)
                  }
                })
                
                console.log(`🧾 Questionnaire roles for ${saq}`, {
                  questionnaireAnswerUuid,
                  rolesArray,
                  signedRoles,
                  signatureEmails,
                  signatureSubmissions,
                  requiredRolesFromQuestionnaire
                })
                
                // Priority: document.groups > questionnaire.required_roles > empty array
                // Never fall back to DEFAULT_REQUIRED_ROLES
                if (!requiredRoles.length) {
                  if (requiredRolesFromQuestionnaire !== undefined && requiredRolesFromQuestionnaire.length > 0) {
                    requiredRoles = requiredRolesFromQuestionnaire
                  }
                  // else: keep requiredRoles as empty (from document.groups)
                }
                
                // Build role -> email mapping
                rolesArray.forEach(roleObj => {
                  Object.entries(roleObj).forEach(([email, role]) => {
                    if (role) {
                      roleEmailMap[role] = email
                    }
                  })
                })
                
                // Store signature emails for status checking
                roleEmailMap['_signature_emails'] = signatureEmails
              } else {
                console.warn(`⚠️ Questionnaire roles request failed for ${saq}`, {
                  questionnaireAnswerUuid,
                  status: qResponse.status
                })
              }
            }
            
            // Don't add DEFAULT_REQUIRED_ROLES - respect what came from document.groups or questionnaire
            // Empty array is valid and means no roles required

            requiredRolesMap[saq] = requiredRoles
            assignedRolesMap[saq] = roleEmailMap
            
            // Build signature status map
            const statusMap = {}
            const signatureEmails = roleEmailMap['_signature_emails'] || []
            requiredRoles.forEach(role => {
              const assignedEmail = roleEmailMap[role]
              const hasAssignee = !!assignedEmail
              // Check if the assigned email has signed by looking in signature_emails array
              const hasSigned = hasAssignee && signatureEmails.includes(assignedEmail)
              
              if (!hasAssignee) {
                statusMap[role] = 'no_signee'
              } else if (hasSigned) {
                statusMap[role] = 'signed'
              } else {
                statusMap[role] = 'pending'
              }
            })
            signatureStatusMap[saq] = statusMap
            
            console.log(`✅ Resolved role UI data for ${saq}`, {
              requiredRoles,
              assignedRoles: roleEmailMap,
              signatureEmails,
              statusMap
            })
          } catch (error) {
            console.error(`❌ Error loading roles for ${saq}:`, error)
            requiredRolesMap[saq] = DEFAULT_REQUIRED_ROLES
            assignedRolesMap[saq] = {}
            signatureStatusMap[saq] = {}
          }
        }
        
        setRequiredRoles(requiredRolesMap)
        setAssignedRoles(assignedRolesMap)
        setRoleSignatureStatus(signatureStatusMap)
      } catch (error) {
        console.error('❌ Error loading collaborators and roles:', error)
      }
    }
    
    loadCollaboratorsAndRoles()
  }, [selectedSAQs, questionnaireMeta, instanceUuid, onShare, refetchMissingRolesCounter, externalRefetchTrigger])

  // Handle role assignment
  const handleRoleAssignment = async (saq, role, email) => {
    const meta = questionnaireMeta[saq] || {}
    const questionnaireAnswerUuid = meta?.questionnaireAnswerUuid
    
    if (!questionnaireAnswerUuid) {
      console.warn(`⚠️ No questionnaire answer UUID for ${saq}`)
      return
    }
    
    try {
      // If email is empty, unassign the role
      if (!email) {
        // Get the currently assigned email for this role
        const currentAssignedEmail = assignedRoles[saq]?.[role]
        
        // If there's a currently assigned email, remove it from the backend
        if (currentAssignedEmail && onRemove) {
          await onRemove({
            email: currentAssignedEmail,
            role,
            saq,
            questionnaireAnswerUuid
          })
        }
        
        // Update local state to remove assignment
        setAssignedRoles(prev => ({
          ...prev,
          [saq]: {
            ...prev[saq],
            [role]: ''
          }
        }))
        // Trigger refetch of missing roles
        setRefetchMissingRolesCounter(prev => prev + 1)
        return
      }
      
      // If assigning a different email, first remove the old assignment if it exists
      const currentAssignedEmail = assignedRoles[saq]?.[role]
      if (currentAssignedEmail && currentAssignedEmail !== email && onRemove) {
        await onRemove({
          email: currentAssignedEmail,
          role,
          saq,
          questionnaireAnswerUuid
        })
      }
      
      // Assign the role to the collaborator
      if (!onShare) return
      
      await onShare({
        email,
        role,
        saq,
        questionnaireAnswerUuid
      })
      
      // Update local state
      setAssignedRoles(prev => ({
        ...prev,
        [saq]: {
          ...prev[saq],
          [role]: email
        }
      }))
      
      // Trigger refetch of missing roles
      setRefetchMissingRolesCounter(prev => prev + 1)
    } catch (error) {
      console.error(`❌ Error assigning role ${role} to ${email} for ${saq}:`, error)
    }
  }

  return (
    <section className="space-y-6">
      {/* Attestation for each SAQ */}
      {selectedSAQs.map((saq) => {
        const meta = questionnaireMeta[saq] || {}
        const isSubmitted = meta.questionnaireStatus === 'submitted'
        const questionnaireAnswerUuid = meta.questionnaireAnswerUuid
        const latestAnswerUpdateMs = getLatestAnswerUpdateMsForSaq(saq)
        
        // Get dependency-filtered questions for this SAQ
        const saqQuestions = dependencyFilteredQuestions[saq] || []
        
        // Apply STAGE 2 UI filtering: same logic as questionnaires section
        // Only show questions that need attention (not valid)
        const uiVisibleSaqQuestions = saqQuestions.filter((question) => {
          const response = responses[saq]?.[question.id]
          const answerStatus = response?.answerStatus
          const tempStatus = response?.metadata?.temp_status
          
          // Hide if answer_status or temp_status is 'valid'
          if (answerStatus === 'valid' || tempStatus === 'valid') {
            return false
          }
          
          // Check if questionnaire is finalized (not in_progress or draft)
          const questionnaireStatus = meta.questionnaireStatus
          const isQuestionnaireFinalized = questionnaireStatus && 
            questionnaireStatus !== 'in_progress' && 
            questionnaireStatus !== 'draft'
          
          // If finalized, hide questions that don't need user action:
          // - Unanswered questions (no response object)
          // - Questions with requires_review status (already reviewed and approved, waiting for final submission)
          if (isQuestionnaireFinalized) {
            if (!response) {
              return false // Hide unanswered
            }
            if (answerStatus === 'requires_review') {
              return false // Hide approved questions waiting for submission
            }
          }
          
          // Show everything else (requires_further_details, pending, invalid, unanswered in draft, etc.)
          return true
        })
        
        // Calculate section progress based on UI-VISIBLE questions (questions that need attention)
        const sectionProgress = calculateSectionProgress(responses, uiVisibleSaqQuestions, saq)
        const isAllSectionsComplete = 
          sectionProgress.section1.complete &&
          sectionProgress.section2.complete &&
          sectionProgress.section3.complete
        
        // Get rendering state for this SAQ
        const renderState = pdfRenderingState[saq]
        const hasRendered = pdfRenderedSAQs[saq]
        
        // Trigger PDF render when sections become complete (only once)
        // Skip if already submitted
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          if (
            isAllSectionsComplete &&
            questionnaireAnswerUuid &&
            !isSubmitted &&
            !hasRendered &&
            renderState !== 'rendering' &&
            renderState !== 'checking' &&
            renderState !== 'error'
          ) {
            checkAndRenderPdf(saq, questionnaireAnswerUuid, latestAnswerUpdateMs)
          }
        }, [isAllSectionsComplete, hasRendered, renderState, saq, questionnaireAnswerUuid, isSubmitted, latestAnswerUpdateMs])
        
        return (
          <section key={saq} className={`${SaqFormTheme.borderRadius.xl} border-2 ${SaqFormTheme.colors.neutral.border[300]} bg-white p-6 ${SaqFormTheme.shadows.sm}`}>
            <div className="flex items-center gap-6">
              {/* Main content area */}
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{saq} Submission</h3>
                </div>

                {/* Card content area */}
                <div className="space-y-3">
            <div className="flex flex-col gap-1">
              {!isAllSectionsComplete && (
                <span className="text-sm font-medium text-slate-600">
                  {uiVisibleSaqQuestions.length} question{uiVisibleSaqQuestions.length !== 1 ? 's' : ''} requiring attention
                </span>
              )}
              {isAllSectionsComplete && (
                <>
                  {missingRoles[saq] && missingRoles[saq].length > 0 && (
                    <span className="text-sm font-medium text-red-600">
                      Missing role(s): {missingRoles[saq].map(role => getRoleDisplayName(role)).join(', ')}
                    </span>
                  )}
                </>
              )}
            </div>
            
            {/* Role assignments - show when sections are complete and not submitted */}
            {isAllSectionsComplete && !isSubmitted && onShare && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-600 mb-2">Role assignments:</p>
                <div className="space-y-2">
                  {((requiredRoles[saq] && requiredRoles[saq].length > 0)
                    ? requiredRoles[saq]
                    : (missingRoles[saq] || [])
                  ).map((role) => {
                    const assignedEmail = assignedRoles[saq]?.[role] || ''
                    const status = roleSignatureStatus[saq]?.[role] || 'no_signee'
                    
                    // Determine status display
                    let statusColor = 'text-slate-500'
                    let statusText = 'No Signee'
                    if (status === 'signed') {
                      statusColor = 'text-emerald-600'
                      statusText = 'Signed'
                    } else if (status === 'pending') {
                      statusColor = 'text-amber-600'
                      statusText = 'Pending'
                    }
                    
                    return (
                      <div key={role} className="flex items-center gap-3">
                        <label className="text-xs font-medium text-slate-700 min-w-[160px]">
                          {getRoleDisplayName(role)}:
                        </label>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <select
                            value={assignedEmail}
                            onChange={(e) => {
                              const value = e.target.value
                              if (value === '__ADD_COLLABORATOR__') {
                                // Open the add collaborator modal
                                setOpenSigneesModalForSAQ(saq)
                                // Reset the select to its previous value after a brief delay
                                // This ensures React re-renders with the controlled value
                                setTimeout(() => {
                                  e.target.value = assignedEmail
                                }, 0)
                              } else {
                                // Handle normal assignment or unassignment
                                handleRoleAssignment(saq, role, value)
                              }
                            }}
                            className={`flex-1 min-w-0 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[300]} bg-white px-2 py-1.5 text-xs ${SaqFormTheme.colors.neutral.text[900]} ${SaqFormTheme.shadows.sm} focus:border-${SaqFormTheme.colors.primary[500]} focus:outline-none focus:ring-1 focus:ring-${SaqFormTheme.colors.primary[500]}`}
                          >
                            <option value="">-----</option>
                            {collaborators.map((collab) => (
                              <option key={collab.email} value={collab.email}>
                                {collab.name || collab.email}
                              </option>
                            ))}
                            <option value="__ADD_COLLABORATOR__">Add Collaborator...</option>
                          </select>
                          <button
                            onClick={() => {
                              if (assignedEmail) {
                                const collaborator = collaborators.find(c => c.email === assignedEmail)
                                sendRoleAssignmentReminder({
                                  email: assignedEmail,
                                  name: collaborator?.name || null,
                                  role,
                                  saq
                                })
                              }
                            }}
                            disabled={!assignedEmail}
                            className={`${getButtonClasses('primary', 'md', !assignedEmail)} whitespace-nowrap px-6`}
                          >
                            Notify
                          </button>
                          <span className={`text-xs font-medium ${statusColor} min-w-[72px] text-right`}>
                            {statusText}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Section breakdown with PDF preview/loading state */}
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">
                  {isAllSectionsComplete ? 'Section completion:' : 'Complete all sections to enable submission:'}
                </p>
                <div className="flex gap-3 text-xs">
                  <span className={sectionProgress.section1.complete ? 'text-emerald-600' : 'text-slate-500'}>
                    {sectionProgress.section1.complete ? '✓' : '○'} Section 1
                  </span>
                  <span className={sectionProgress.section2.complete ? 'text-emerald-600' : 'text-slate-500'}>
                    {sectionProgress.section2.complete ? '✓' : '○'} Section 2
                  </span>
                  <span className={sectionProgress.section3.complete ? 'text-emerald-600' : 'text-slate-500'}>
                    {sectionProgress.section3.complete ? '✓' : '○'} Section 3
                  </span>
                </div>
              </div>
              
              {/* Button container with Preview/Submit buttons */}
              <div className="flex items-center gap-3">
                {/* Conditional rendering based on completion and render state */}
                {!isAllSectionsComplete ? (
                  // Not complete - show nothing (empty space)
                  <div className="w-[200px]"></div>
                ) : isSubmitted ? (
                  // Already submitted - don't show preview button
                  <div className="w-[200px]"></div>
                ) : renderState === 'rendering' ? (
                  // Rendering in progress - show loading box
                  <div className={`flex items-center justify-center gap-2 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.neutral[200]} px-6 py-2 w-[200px] h-[40px]`}>
                    <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-medium text-slate-600">Loading...</span>
                  </div>
                ) : renderState === 'error' ? (
                  // Error state - show retry button
                  <button
                    onClick={() => triggerPdfRender(saq, questionnaireAnswerUuid)}
                    className={`${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.error[100]} border ${SaqFormTheme.colors.error.border[300]} px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.error.text[700]} hover:${SaqFormTheme.colors.error[200]} w-[200px]`}
                  >
                    Retry PDF Render
                  </button>
                ) : renderState === 'complete' ? (
                  // Rendering complete - show PreviewPDF button
                  <PreviewPDF 
                    saqName={saq}
                    documentUuid={meta?.metadata?.document_uuid || null}
                    questionnaireAnswerUuid={questionnaireAnswerUuid}
                    buttonText="Sign PDF →"
                    disabled={isSubmitting[saq]}
                    isSubmitting={isSubmitting[saq]}
                    reloadQuestionnaires={reloadQuestionnaires}
                    signatureEmails={assignedRoles[saq]?.['_signature_emails'] || []}
                  />
                ) : null}
              </div>
            </div>
            
            {/* ShareEmailPanel for this specific SAQ */}
            {onShare && onRemove && (
              <ShareEmailPanel
                isOpen={openSigneesModalForSAQ === saq}
                onClose={() => {
                  setOpenSigneesModalForSAQ(null)
                  // Trigger refetch of missing roles when modal closes
                  setRefetchMissingRolesCounter(prev => prev + 1)
                }}
                onShare={onShare}
                onRemove={onRemove}
                questionnaireMeta={questionnaireMeta}
                instanceUuid={instanceUuid}
                initialSAQ={saq}
              />
            )}
          </div>
              </div>
              
              {/* Submitted button - vertically centered */}
              {isSubmitted && (
                <div className="flex items-center">
                  <span className={`flex items-center ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.success[600]} px-5 py-2.5 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} text-white`}>
                    <span className="mr-1.5 text-lg">✓</span>
                    Submitted
                  </span>
                </div>
              )}
            </div>
        </section>
        )
      })}

    </section>
  )
}
