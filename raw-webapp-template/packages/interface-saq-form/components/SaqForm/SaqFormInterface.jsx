/**
 * PCI SAQ Advisor – Example Interface
 *
 * Interactive decision tree that walks an operator through a branched
 * questionnaire to identify the correct PCI Self-Assessment Questionnaire (SAQ).
 * This version is frontend-only and intended for use inside the workflow
 * builder interface modal.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, WizardSteps } from './components'
import { ShareEmailPanel } from './SaqFormUI'
import { DecisionSection, AmendmentSection } from './SaqFormSections'
import { QuestionnairesSection, AttestationSection } from './SaqChecklistSections'
import {
  determineRequiredSAQs,
  APPLICABILITY_DEFAULTS,
  ROLE_DISPLAY_NAMES
} from './SaqFormConstants'
import { isQuestionVisible } from './SaqConditionalLogic'
import {
  saveSAQData, 
  downloadSAQDataAsJSON, 
  calculateCompletionStats,
  loadTemplatesWithQuestions,
  saveAnswerForQuestion,
  loadPaymentServicesQuestions,
  submitAssessmentForReview,
  updateSAQStatusOnSection2Render,
  processSection2Confirmation,
  shareSAQForm,
  sendSAQSubmissionNotification,
  updateQuestionnaireStatus,
  updateTotalSAQsReceived,
  calculateSectionProgress,
  normalizeSentTo,
  extractEmailsFromSentTo,
  emailExistsInSentTo,
  addEmailToSentTo,
  removeEmailFromSentTo,
  getClientUuid,
  getCurrentUserEmail
} from './SaqFormDataService'
import { getReviewerEmail, getApiBase } from './ENV_Specific/SaqFormConfig'
import { SaqFormTheme } from './SaqFormTheme'

const ensureStateForSaqs = (currentState, saqKeys, initializer) => {
  const nextState = { ...currentState }
  saqKeys.forEach((saqKey) => {
    if (!nextState[saqKey]) {
      nextState[saqKey] = initializer()
    }
  })
  return nextState
}

/**
 * Apply dependency-based filtering to questions
 * STAGE 1 FILTER: Removes questions based on:
 * - Appendix B/C/D (inline questions)
 * - Auto-generated questions (assess_2g_*)
 * - depends_on conditional logic
 * 
 * This is the first filtering stage - UI visibility filtering happens in child components
 */
const applyDependencyFiltering = (sourceQuestionBank, currentResponses = {}) => {
  const result = {}
  Object.entries(sourceQuestionBank).forEach(([saqType, questionList]) => {
    if (!Array.isArray(questionList)) {
      result[saqType] = []
      return
    }
    
    // Get responses for this SAQ type for dependency evaluation
    const saqResponses = currentResponses[saqType] || {}
    
    // Filter out Appendix B, C, D questions - these are answered inline within control questions
    // Keep Appendix A visible as it's a standalone section
    // Also filter out assess_2g_* questions (Summary of Assessment auto-generated questions)
    // Also filter based on depends_on conditional logic
    // Also filter out questions with IDs starting with "sec3.3b", "sec3.3c", "sec3.part3b", or "sec3.part3c"
    const dependencyFilteredQuestions = questionList.filter(q => {
      const props = q?.rawProperties || {}
      
      // Exclude questions with IDs starting with "sec3.3b", "sec3.3c", "sec3.part3b", or "sec3.part3c" (case-insensitive)
      const questionId = (props.id || '').toLowerCase()
      if (questionId.startsWith('sec3.3b') || questionId.startsWith('sec3.3c') ||
          questionId.startsWith('sec3.part3b') || questionId.startsWith('sec3.part3c')) {
        return false
      }
      
      // Exclude assess_2g_* questions (Summary of Assessment - auto-generated)
      if (questionId.startsWith('assess_2g_')) {
        return false
      }
      
      // Exclude questions where type is 'Appendix' AND number starts with B., C., or D.
      if (props.type === 'Appendix') {
        const number = String(props.number || '')
        if (number.startsWith('B.') || number.startsWith('C.') || number.startsWith('D.')) {
          return false
        }
      }
      
      // Check depends_on conditional logic (new format)
      // Pass the full questionList so UUID->ID mapping can be built
      if (!isQuestionVisible(q, saqResponses, questionList)) {
        return false
      }
      
      return true
    })
    
    result[saqType] = dependencyFilteredQuestions
  })
  return result
}

// Constants and helper functions now imported from SaqFormConstants.jsx

const SAQFormInterface = ({ instanceId = null }) => {
  // Store the instance ID for use in data service calls
  const instanceIdRef = useRef(instanceId)
  
  // Update ref when prop changes
  useEffect(() => {
    instanceIdRef.current = instanceId
  }, [instanceId])
  
  // Log instance ID on mount for debugging
  useEffect(() => {
    if (instanceId) {
      console.log('📍 SAQFormInterface initialized with instance UUID:', instanceId)
    } else {
      console.warn('⚠️ SAQFormInterface initialized without instance UUID - using fallback logic')
    }
  }, [instanceId])
  
  const [activeSection, setActiveSection] = useState('decision')
  const [paymentAnswers, setPaymentAnswers] = useState({
    has_allpayments_services: false,
    has_internet_payments: false,
    internet_redirects_to_allpayments: false,
    has_text_payments: false,
    text_redirects_to_allpayments: false,
    uses_callpay: false,
    callpay_devices_isolated: false,
    callpay_devices_connected_elsewhere: false
  })
  const [suggestedSAQs, setSuggestedSAQs] = useState([])
  const [selectedSAQs, setSelectedSAQs] = useState([])
  const [applicability, setApplicability] = useState(() => ({ ...APPLICABILITY_DEFAULTS }))
  
  // Payment services questions loaded from API
  const [paymentServicesQuestions, setPaymentServicesQuestions] = useState([])
  const [isLoadingPaymentQuestions, setIsLoadingPaymentQuestions] = useState(false)
  const [paymentQuestionsError, setPaymentQuestionsError] = useState(null)
  
  // Multi-questionnaire support: responses organized by SAQ type
  // Structure: { 'SAQ A': { questionId: { value, notes } }, 'SAQ C-VT': {...}, 'SAQ D': {...} }
  const [responses, setResponses] = useState({})
  
  // Session-based re-render tracking
  // Track which SAQs need re-rendering due to answer changes
  const [pendingRenders, setPendingRenders] = useState(new Set())
  const [renderingInProgress, setRenderingInProgress] = useState(new Set())
  const renderTimeoutRef = useRef({})
  
  // Questions organized by SAQ type - STAGE 1: Dependency-filtered
  // Structure: { 'SAQ A': [...questions], 'SAQ C-VT': [...questions], 'SAQ D': [...questions] }
  // These questions have dependency logic applied but NOT UI visibility filters
  const [dependencyFilteredQuestions, setDependencyFilteredQuestions] = useState({})
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [questionsError, setQuestionsError] = useState(null)
  const [questionnaireMeta, setQuestionnaireMeta] = useState({})
  const roleRedirectAppliedRef = useRef(false)
  // STAGE 0: Source questions (unfiltered, loaded from API, never modified)
  const sourceQuestionsRef = useRef({})
  const hasLoadedQuestionnairesRef = useRef(false)
  const hasUserResetRef = useRef(false)
  const [questionIndex, setQuestionIndex] = useState({})
  const [activeQuestionnaire, setActiveQuestionnaire] = useState(null)
  const [questionnaireLoadVersion, setQuestionnaireLoadVersion] = useState(0)
  const [isAdvancingQuestion, setIsAdvancingQuestion] = useState(false)
  const [questionAdvanceError, setQuestionAdvanceError] = useState(null)
  
  // Template context organized by SAQ type
  // Structure: { 'SAQ A': { preContext, requirementNotes, guidanceByRequirement }, ... }
  const [templateContext, setTemplateContext] = useState({})
  // Shared refetch trigger for missing roles (increments when ShareEmailPanel closes)
  const [refetchMissingRolesTrigger, setRefetchMissingRolesTrigger] = useState(0)
  
  // Review mode state - for reviewers to mark questions needing clarification
  const isReviewMode = false
  // Structure: { 'SAQ A': { questionId: { needsClarification, reviewNotes } }, ... }
  const [reviewData, setReviewData] = useState({})

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [lastSaved, setLastSaved] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState({})

  // Function to trigger PDF render
  const triggerPdfRender = async (saqType, questionnaireAnswerUuid) => {
    // Mark this SAQ as rendering in progress
    setRenderingInProgress(prev => new Set(prev).add(saqType))
    
    try {
      const apiBase = getApiBase()
      const response = await fetch(`${apiBase}/documents/update-render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          questionnaire_answer_uuid: questionnaireAnswerUuid,
          s3_bucket: "main-dev-dev-client-files-bucket"
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`Render failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Update questionnaire meta with new render info
      // API response structure: {success: true, data: {document_uuid: "...", ...}}
      const newDocumentUuid = data?.data?.document_uuid || 
                              data?.data?.document?.document_uuid ||
                              data?.document_uuid || 
                              data?.document?.document_uuid
      
      if (newDocumentUuid) {
        setQuestionnaireMeta(prev => ({
          ...prev,
          [saqType]: {
            ...prev[saqType],
            metadata: {
              ...prev[saqType]?.metadata,
              document_uuid: newDocumentUuid,
              last_render_generated_at: new Date().toISOString(),
            }
          }
        }))
      }
      
      return data
    } finally {
      // Remove from rendering in progress
      setRenderingInProgress(prev => {
        const updated = new Set(prev)
        updated.delete(saqType)
        return updated
      })
    }
  }

  // Manual re-render trigger function
  const handleManualRender = async () => {
    if (pendingRenders.size === 0) {
      alert('No pending renders')
      return
    }
    
    try {
      const renderPromises = Array.from(pendingRenders).map(async (saqType) => {
        const questionnaireAnswerUuid = questionnaireMeta[saqType]?.questionnaireAnswerUuid
        if (questionnaireAnswerUuid) {
          return triggerPdfRender(saqType, questionnaireAnswerUuid)
        }
      })

      await Promise.all(renderPromises)
      
      setPendingRenders(new Set())
      alert('All pending renders completed!')
    } catch (error) {
      console.error('Manual render failed:', error)
      alert('Render failed. Check console for details.')
    }
  }

  // Debounced re-render effect - triggers 2 seconds after last answer change
  useEffect(() => {
    if (pendingRenders.size === 0) return

    // Clear any existing timeouts
    Object.values(renderTimeoutRef.current).forEach(timeout => clearTimeout(timeout))
    renderTimeoutRef.current = {}

    // Set up debounced renders for each pending SAQ
    pendingRenders.forEach(saqType => {
      // Skip if already rendering
      if (renderingInProgress.has(saqType)) {
        console.log(`⏭️ Skipping ${saqType} - already rendering`)
        return
      }
      
      const questionnaireAnswerUuid = questionnaireMeta[saqType]?.questionnaireAnswerUuid
      
      if (!questionnaireAnswerUuid) {
        console.warn(`⚠️ No questionnaire UUID for ${saqType}, skipping render`)
        return
      }

      console.log(`⏱️ Scheduling re-render for ${saqType} in 2 seconds...`)
      
      renderTimeoutRef.current[saqType] = setTimeout(async () => {
        try {
          console.log(`🎨 Triggering re-render for ${saqType}`)
          
          // Call the render API (this will handle adding/removing from renderingInProgress)
          await triggerPdfRender(saqType, questionnaireAnswerUuid)
          
          // Remove from pending set
          setPendingRenders(prev => {
            const updated = new Set(prev)
            updated.delete(saqType)
            return updated
          })
          
          console.log(`✅ Re-render completed for ${saqType}`)
        } catch (error) {
          console.error(`❌ Re-render failed for ${saqType}:`, error)
        }
      }, 2000) // 2 second debounce
    })

    // Cleanup on unmount or when dependencies change
    return () => {
      Object.values(renderTimeoutRef.current).forEach(timeout => clearTimeout(timeout))
    }
  }, [pendingRenders, questionnaireMeta, renderingInProgress])

  // Clear pending renders and timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(renderTimeoutRef.current).forEach(timeout => clearTimeout(timeout))
      setPendingRenders(new Set())
    }
  }, [])

  // Load payment services identification questions on mount
  useEffect(() => {
    let isMounted = true

    const loadPaymentQuestions = async () => {
      try {
        setIsLoadingPaymentQuestions(true)
        setPaymentQuestionsError(null)

        const { questions } = await loadPaymentServicesQuestions()
        
        if (!isMounted) return

        console.log('✅ Payment services questions loaded:', questions)
        setPaymentServicesQuestions(questions)
      } catch (error) {
        if (isMounted) {
          console.error('❌ Error loading payment questions:', error)
          setPaymentQuestionsError(error.message || 'Unable to load payment questions.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingPaymentQuestions(false)
        }
      }
    }

    loadPaymentQuestions()

    return () => {
      isMounted = false
    }
  }, [])

  // Load questionnaire templates & questions on mount
  useEffect(() => {
    let isMounted = true

    if (questionnaireLoadVersion === 0 && hasLoadedQuestionnairesRef.current) {
      return () => {
        isMounted = false
      }
    }

    hasLoadedQuestionnairesRef.current = true

    const loadQuestionnaires = async () => {
      let shouldSkipWizard = false
      
      try {
        setIsLoadingQuestions(true)
        setQuestionsError(null)

        const result = await loadTemplatesWithQuestions(undefined, instanceIdRef.current)
        shouldSkipWizard = result.shouldSkipWizard
        const { templates, questionnaires, prefilledResponses, questionnaireStatuses } = result
        if (!isMounted) return

        console.log('📊 Questionnaire statuses:', questionnaireStatuses)
        console.log('🔀 Should skip wizard:', shouldSkipWizard)
        console.log('📋 Templates returned:', templates.map(t => t.shortName))

        const questionMap = {}
        const saqKeys = []
        const activeSaqKeys = [] // SAQs that are not removed
        const metaMap = {}

        templates.forEach((template) => {
          const saqType = template.shortName
          saqKeys.push(saqType)
          metaMap[saqType] = template
          
          // Track active SAQs: must exist in interface-instance AND not be removed
          if (template.questionnaireAnswerUuid && template.status !== 'removed') {
            activeSaqKeys.push(saqType)
          }
          
          const templateQuestions = questionnaires[template.templateUuid]?.questions || []
          questionMap[saqType] = templateQuestions
        })

        sourceQuestionsRef.current = questionMap
        setQuestionnaireMeta(metaMap)
        
        // Build template context map from loaded templates
        const contextMap = {}
        templates.forEach((template) => {
          const saqType = template.shortName
          if (template.organizedContext) {
            contextMap[saqType] = template.organizedContext
          }
        })
        setTemplateContext(contextMap)

        setResponses((prev) => {
          const ensured = ensureStateForSaqs(prev, saqKeys, () => ({}))
          if (!prefilledResponses || Object.keys(prefilledResponses).length === 0) {
            // Apply STAGE 1 filtering with current (empty) responses
            const filtered = applyDependencyFiltering(questionMap, ensured)
            setDependencyFilteredQuestions(filtered)
            return ensured
          }

          const next = { ...ensured }

          Object.entries(prefilledResponses).forEach(([saqType, saqResponses]) => {
            if (!next[saqType]) {
              next[saqType] = {}
            }
            next[saqType] = {
              ...next[saqType],
              ...saqResponses
            }
          })

          // Apply STAGE 1 filtering with prefilled responses
          const filtered = applyDependencyFiltering(questionMap, next)
          setDependencyFilteredQuestions(filtered)
          
          return next
        })
        setReviewData((prev) => ensureStateForSaqs(prev, saqKeys, () => ({})))

        setQuestionIndex((prev) => {
          const next = { ...prev }
          saqKeys.forEach((saq) => {
            // Only initialize to 0 if this SAQ doesn't have an index yet
            // Preserve existing index to avoid resetting user's position
            if (prev[saq] === undefined) {
              next[saq] = 0
            } else {
              // Preserve existing index
              next[saq] = prev[saq]
            }
          })
          return next
        })

        setActiveQuestionnaire((current) => current || saqKeys[0] || null)

        // Pre-select SAQs that already have questionnaire-answer records
        const preselectedSAQs = saqKeys.filter(saqType => {
          const meta = metaMap[saqType]
          return meta?.questionnaireAnswerUuid // Has existing questionnaire-answer
        })

        // Pre-select SAQs that already exist
        if (preselectedSAQs.length > 0) {
          setSelectedSAQs(preselectedSAQs)
          console.log('✅ Pre-selected SAQs with existing questionnaire-answers:', preselectedSAQs)
        }

        // If any questionnaire is not draft, auto-select all active SAQs
        // But only do this on initial load, not after user has manually reset
        if (shouldSkipWizard && !hasUserResetRef.current) {
          setSelectedSAQs(activeSaqKeys)
          console.log('⏩ Will skip wizard sections - at least one questionnaire is not in draft status')
          console.log('✅ Auto-selected SAQs:', activeSaqKeys)
        }
      } catch (error) {
        if (isMounted) {
          setQuestionsError(error.message || 'Unable to load questionnaires.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingQuestions(false)
          
          // Skip to questionnaires section AFTER loading completes
          // This ensures the loading skeleton is visible during data fetch
          if (shouldSkipWizard && !hasUserResetRef.current) {
            setActiveSection('questionnaires')
            console.log('⏩ Skipped to questionnaires section')
          }
        }
      }
    }

    loadQuestionnaires()

    return () => {
      isMounted = false
    }
  }, [questionnaireLoadVersion])

  // Recompute SAQ D visibility whenever applicability toggles change
  useEffect(() => {
    if (!Object.keys(sourceQuestionsRef.current).length) return
    setDependencyFilteredQuestions(applyDependencyFiltering(sourceQuestionsRef.current, responses))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicability])

  // Update SAQ status when Section 2 (amendment) is rendered
  useEffect(() => {
    if (activeSection === 'amendment' && suggestedSAQs.length > 0 && Object.keys(questionnaireMeta).length > 0) {
      updateSAQStatusOnSection2Render(suggestedSAQs, questionnaireMeta, instanceIdRef.current)
        .catch(error => console.error('Failed to update SAQ status on Section 2 render:', error))
    }
  }, [activeSection, suggestedSAQs, questionnaireMeta])

  // Auto-jump to Sign and Submit if current user has a role on any in-progress questionnaire
  useEffect(() => {
    if (roleRedirectAppliedRef.current) return
    if (!questionnaireMeta || Object.keys(questionnaireMeta).length === 0) return

    let isMounted = true
    const checkRoleAssignments = async () => {
      try {
        const currentEmail = await getCurrentUserEmail()
        if (!isMounted || !currentEmail) return

        const normalizedEmail = currentEmail.toLowerCase()
        const hasRoleOnInProgress = Object.values(questionnaireMeta).some((meta) => {
          const status = meta?.questionnaireStatus || meta?.status
          if (status !== 'in_progress') return false
          const roles = meta?.metadata?.roles || []
          return roles.some((roleObj) => roleObj?.[normalizedEmail] || roleObj?.[currentEmail])
        })

        if (hasRoleOnInProgress) {
          roleRedirectAppliedRef.current = true
          setActiveSection('attestation')
        }
      } catch (error) {
        console.error('Failed to evaluate role assignments for auto-redirect', error)
      }
    }

    checkRoleAssignments()
    return () => { isMounted = false }
  }, [questionnaireMeta])

  const reloadQuestionnaires = (preventSectionChange = false) => {
    if (preventSectionChange) {
      hasUserResetRef.current = true // Prevent automatic section changes
    }
    setQuestionnaireLoadVersion((prev) => prev + 1)
  }

  useEffect(() => {
    setQuestionIndex((prev) => {
      const next = { ...prev }
      Object.entries(dependencyFilteredQuestions).forEach(([saqType, saqQuestions]) => {
        if (!Array.isArray(saqQuestions) || saqQuestions.length === 0) {
          next[saqType] = 0
        } else {
          const current = prev[saqType] || 0
          next[saqType] = Math.min(current, saqQuestions.length - 1)
        }
      })
      return next
    })
  }, [dependencyFilteredQuestions])

  useEffect(() => {
    if (selectedSAQs.length === 0) return
    setActiveQuestionnaire((current) => {
      if (current && selectedSAQs.includes(current)) {
        return current
      }
      return selectedSAQs[0]
    })
  }, [selectedSAQs])

  const renderExpectedTesting = (text) => {
    if (!text) return null
    const segments = text
      .split('')
      .map((segment) => segment.trim())
      .filter(Boolean)

    if (segments.length === 0) {
      return <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>{text}</p>
    }

    return (
      <ul className={`list-disc list-inside space-y-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>
        {segments.map((segment, index) => (
          <li key={index}>{segment}</li>
        ))}
      </ul>
    )
  }

  const handleReviewToggle = (questionId, saqType) => {
    setReviewData((prev) => ({
      ...prev,
      [saqType]: {
        ...prev[saqType],
        [questionId]: {
          needsClarification: !prev[saqType]?.[questionId]?.needsClarification,
          reviewNotes: prev[saqType]?.[questionId]?.reviewNotes || ''
        }
      }
    }))
  }

  const handleReviewNotesChange = (questionId, notes, saqType) => {
    setReviewData((prev) => ({
      ...prev,
      [saqType]: {
        ...prev[saqType],
        [questionId]: {
          ...prev[saqType]?.[questionId],
          needsClarification: prev[saqType]?.[questionId]?.needsClarification || false,
          reviewNotes: notes
        }
      }
    }))
  }

  // Save data to API
  const handleSave = async () => {
    setIsSaving(true)
    setSaveError(null)
    
    try {
      const dataToSave = {
        responses,
        reviewData,
        applicability,
        selectedSAQs,
        paymentAnswers,
        metadata: {
          savedAt: new Date().toISOString(),
          completionStats: calculateCompletionStats(responses, dependencyFilteredQuestions)
        }
      }
      
      const result = await saveSAQData(dataToSave)
      setLastSaved(new Date())
      console.log('Save result:', result)
    } catch (error) {
      setSaveError(error.message || 'Failed to save data')
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Download data as JSON file
  const handleDownloadJSON = () => {
    const dataToDownload = {
      responses,
      reviewData,
      applicability,
      selectedSAQs,
      paymentAnswers,
      metadata: {
        exportedAt: new Date().toISOString(),
        completionStats: calculateCompletionStats(responses, dependencyFilteredQuestions)
      }
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    downloadSAQDataAsJSON(dataToDownload, `saq-assessment-${timestamp}.json`)
  }

  // Share SAQ access with another user via email
  const handleShare = async (collaboratorData) => {
    try {
      console.log('📤 Adding collaborator:', collaboratorData)
      
      const { name, email, role, saq, questionnaireAnswerUuid } = collaboratorData
      const apiBase = getApiBase()
      const instanceUuid = instanceIdRef.current
      
      // Step 1: Create external user, send form link email, and add email to sent_to
      // Pass name to shareSAQForm so it's saved in sent_to
      await shareSAQForm(email, instanceUuid, name || null)
      console.log(`✅ Added ${email}${name ? ` (${name})` : ''} to interface instance sent_to list`)
      
      // Step 2: Update questionnaire answer with role assignment (only if role is provided)
      if (role && questionnaireAnswerUuid) {
        // First, fetch the current questionnaire to get existing metadata
        const questionnaireResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
          credentials: 'include'
        })
        
        if (!questionnaireResponse.ok) {
          throw new Error(`Failed to get questionnaire answer: ${questionnaireResponse.status}`)
        }
        
        const questionnaireData = await questionnaireResponse.json()
        const currentQuestionnaire = questionnaireData?.questionnaire_answer
        
        if (currentQuestionnaire) {
          const currentMetadata = currentQuestionnaire.metadata || {}
          const currentRoles = currentMetadata.roles || []
          
          console.log('📋 Current metadata before update:', currentMetadata)
          console.log('📋 Current roles before update:', currentRoles)
          
          // Add new role assignment as {email: role}
          const newRole = { [email]: role }
          const updatedRoles = [...currentRoles, newRole]
          
          // Get current required_roles from questionnaire metadata
          // IMPORTANT: Do NOT fall back to default roles if array is empty - respect the empty array
          // Only use document.groups if required_roles is completely missing (undefined)
          let currentRequiredRoles = currentMetadata.required_roles || currentMetadata.requiredRoles
          
          // If required_roles is undefined (not just empty), initialize from document groups
          if (currentRequiredRoles === undefined) {
            console.log('⚠️ required_roles is undefined, will fetch from document.groups')
            // Fetch document to get the actual required roles
            try {
              const docResponse = await fetch(`${apiBase}/documents/get-document`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_uuid: currentMetadata.document_uuid }),
                credentials: 'include'
              })
              
              if (docResponse.ok) {
                const docData = await docResponse.json()
                const documentGroups = docData?.document?.metadata?.document_properties?.groups || []
                currentRequiredRoles = documentGroups
                console.log(`📄 Initialized required_roles from document.groups: ${JSON.stringify(documentGroups)}`)
              } else {
                console.warn('⚠️ Failed to fetch document, using empty array for required_roles')
                currentRequiredRoles = []
              }
            } catch (error) {
              console.error('❌ Error fetching document groups:', error)
              currentRequiredRoles = []
            }
          } else {
            // Ensure it's an array (could be undefined, null, or other)
            currentRequiredRoles = Array.isArray(currentRequiredRoles) ? currentRequiredRoles : []
          }
          
          // Add the new role to required_roles if not already present (but don't add default roles)
          const updatedRequiredRoles = currentRequiredRoles.includes(role)
            ? currentRequiredRoles
            : [...currentRequiredRoles, role]
          
          console.log('📋 Updated roles after adding new one:', updatedRoles)
          console.log('📋 Updated required_roles:', updatedRequiredRoles)
          
          // Build the complete metadata object, preserving all existing fields
          const updatedMetadata = {
            ...currentMetadata,
            roles: updatedRoles,
            required_roles: updatedRequiredRoles
          }
          
          console.log('📋 Final metadata to send:', updatedMetadata)
          
          const updatePayload = {
            questionnaire_answer_uuid: questionnaireAnswerUuid,
            update_details: {
              metadata: updatedMetadata
            }
          }
          
          console.log('📤 Sending update payload:', JSON.stringify(updatePayload, null, 2))
          
          const updateQuestionnaireResponse = await fetch(`${apiBase}/questionnaire-answers/update-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
            credentials: 'include'
          })
          
          if (!updateQuestionnaireResponse.ok) {
            const errorText = await updateQuestionnaireResponse.text()
            console.error('❌ Update failed:', errorText)
            throw new Error(`Failed to update questionnaire answer: ${updateQuestionnaireResponse.status}`)
          }
          
          const responseData = await updateQuestionnaireResponse.json()
          console.log('✅ Update response:', responseData)
          console.log(`✅ Added role ${role} for ${email} in questionnaire ${saq}`)
        }
      } else if (role && !questionnaireAnswerUuid) {
        console.warn('⚠️ Role provided but no questionnaireAnswerUuid, skipping role assignment')
      }
      
      // Step 3: Get link_token and send role assignment email notification (only if role is provided)
      if (role) {
        try {
          console.log('📧 Preparing role assignment email for:', email)
          
          // Fetch interface instance to get link_token
          const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance_uuid: instanceUuid }),
            credentials: 'include'
          })
          
          if (instanceResponse.ok) {
            const instanceData = await instanceResponse.json()
            const linkToken = instanceData?.instance?.link_token
            
            if (linkToken) {
              // Get client UUID to format link_token correctly
              const clientUuid = await getClientUuid()
              
              // Format link_token as client_uuid.token (API requirement)
              const formattedLinkToken = `${clientUuid}.${linkToken}`
              
              // Ensure recipient_name is always provided (use email as fallback if name is missing)
              const recipientName = (name && name.trim()) ? name.trim() : email
              
              // Get current page URL for interface_base_url
              const currentPageUrl = window.location.origin
              
              console.log('📧 Sending role assignment email with link_token')
              
              const emailResponse = await fetch(`${apiBase}/roles/send-request-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient_email: email,
                  recipient_name: recipientName,
                  link_token: formattedLinkToken,
                  interface_base_url: currentPageUrl
                }),
                credentials: 'include'
              })
              
              if (emailResponse.ok) {
                console.log('✅ Role assignment email sent successfully')
              } else {
                const errorText = await emailResponse.text()
                console.warn('⚠️ Failed to send role assignment email (non-critical):', errorText)
              }
            } else {
              console.warn('⚠️ No link_token found in interface instance')
            }
          } else {
            console.warn('⚠️ Failed to fetch interface instance for link_token')
          }
        } catch (emailError) {
          // Don't fail the entire operation if email fails
          console.warn('⚠️ Failed to send role assignment email:', emailError)
        }
      } else {
        console.log('ℹ️ No role provided, skipping role assignment email')
      }
      
      console.log('✅ Collaborator added successfully')
      // Success message now shown in modal instead of alert
    } catch (error) {
      console.error('❌ Add collaborator error:', error)
      throw new Error(error.message || 'Failed to add collaborator')
    }
  }

  // Remove collaborator
  const handleRemoveCollaborator = async (collaborator) => {
    try {
      console.log('🗑️ Removing collaborator:', collaborator)
      
      const apiBase = getApiBase()
      const instanceUuid = instanceIdRef.current
      const { email, questionnaireAnswerUuid, role, saq } = collaborator
      
      // Step 1: Remove from interface instance sent_to list
      // Only remove from sent_to if we're removing all roles (not a specific role assignment)
      // Check if this is a full collaborator removal (no role/saq) or if we need to check if all roles are being removed
      const isFullRemoval = !role || !saq
      
      if (isFullRemoval) {
        const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_uuid: instanceUuid }),
          credentials: 'include'
        })
        
        if (instanceResponse.ok) {
          const instanceData = await instanceResponse.json()
          const instance = instanceData?.instance
          
          if (instance) {
            const currentSentTo = instance.sent_to || []
            const updatedSentTo = removeEmailFromSentTo(currentSentTo, email)
            
            const updateResponse = await fetch(`${apiBase}/website/client/interface-instances/update-interface-instance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instance_uuid: instanceUuid,
                instance_details: {
                  ...instance,
                  sent_to: updatedSentTo
                }
              }),
              credentials: 'include'
            })
            
            if (updateResponse.ok) {
              console.log(`✅ Removed ${email} from interface instance sent_to list`)
            } else {
              const errorText = await updateResponse.text()
              console.error(`❌ Failed to update interface instance sent_to: ${updateResponse.status} - ${errorText}`)
            }
          }
        } else {
          console.error(`❌ Failed to get interface instance: ${instanceResponse.status}`)
        }
      } else {
        console.log(`ℹ️ Skipping sent_to removal for specific role assignment removal: ${email} - ${role} for ${saq}`)
      }
      
      // Step 2: Remove role and question assignments from questionnaire metadata
      // If removing entire collaborator (!role || !saq), process all questionnaires
      // If removing specific role, only process that questionnaire
      const questionnairesToProcess = (!role || !saq) 
        ? Object.entries(questionnaireMeta).map(([saqType, meta]) => ({
            saqType,
            questionnaireAnswerUuid: meta?.questionnaireAnswerUuid
          })).filter(q => q.questionnaireAnswerUuid)
        : [{ questionnaireAnswerUuid }].filter(q => q.questionnaireAnswerUuid)
      
      for (const { questionnaireAnswerUuid: qAnswerUuid } of questionnairesToProcess) {
        if (!qAnswerUuid) continue
        
        try {
          const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionnaire_answer_uuid: qAnswerUuid }),
            credentials: 'include'
          })
          
          if (!qResponse.ok) {
            console.warn(`⚠️ Failed to fetch questionnaire ${qAnswerUuid}: ${qResponse.status}`)
            continue
          }
          
          const qData = await qResponse.json()
          const currentQuestionnaire = qData?.questionnaire_answer
          
          if (!currentQuestionnaire) {
            continue
          }
          
          const currentMetadata = currentQuestionnaire.metadata || {}
          const currentRoles = currentMetadata.roles || []
          const currentQuestionAssignments = currentMetadata.question_assignments || []
          
          // Remove role object(s)
          let updatedRoles
          if (role && saq) {
            // Remove specific role assignment: remove object where email matches AND role value matches
            updatedRoles = currentRoles.filter(roleObj => {
              // Keep the role object if it doesn't have this email, or if it has this email but different role
              if (!roleObj.hasOwnProperty(email)) {
                return true
              }
              // If it has this email, check if the role value matches
              return roleObj[email] !== role
            })
            console.log(`✅ Removing specific role assignment: ${email} - ${role} for ${saq}`)
          } else {
            // Remove all role assignments for this email
            updatedRoles = currentRoles.filter(roleObj => !roleObj.hasOwnProperty(email))
            console.log(`✅ Removing all role assignments for ${email}`)
          }
          
          // Remove question assignments for this email
          // If removing entire collaborator, remove all assignments
          // If removing specific role, we could optionally keep assignments, but for simplicity, remove all
          const updatedQuestionAssignments = currentQuestionAssignments.filter(
            assignment => assignment.email !== email
          )
          
          const removedQuestionCount = currentQuestionAssignments.length - updatedQuestionAssignments.length
          if (removedQuestionCount > 0) {
            console.log(`✅ Removing ${removedQuestionCount} question assignment(s) for ${email} from questionnaire ${qAnswerUuid}`)
          }
          
          // Build updated metadata, preserving all existing fields
          const updatedMetadata = {
            ...currentMetadata,
            roles: updatedRoles,
            question_assignments: updatedQuestionAssignments
          }
          
          await fetch(`${apiBase}/questionnaire-answers/update-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionnaire_answer_uuid: qAnswerUuid,
              update_details: {
                status: currentQuestionnaire.status || 'in_progress',
                metadata: updatedMetadata
              }
            }),
            credentials: 'include'
          })
          
          console.log(`✅ Updated questionnaire ${qAnswerUuid}`)
        } catch (error) {
          console.error(`❌ Error updating questionnaire ${qAnswerUuid}:`, error)
          // Continue processing other questionnaires even if one fails
        }
      }
      
      console.log('✅ Collaborator removed successfully')
    } catch (error) {
      console.error('❌ Remove collaborator error:', error)
      throw new Error(error.message || 'Failed to remove collaborator')
    }
  }

  // Handle response changes with SAQ type context
  const handleResponseChange = (questionId, value, saqType = 'SAQ D') => {
    setResponses((prev) => {
      const saqResponses = prev[saqType] || {}
      const existingResponse = saqResponses[questionId]
      
      // Handle array comparison for checklist questions
      const isSameValue = Array.isArray(value) && Array.isArray(existingResponse?.value)
        ? JSON.stringify(value.sort()) === JSON.stringify(existingResponse.value.sort())
        : existingResponse?.value === value

      const updatedResponse = {
        // Preserve saved answer metadata (status, reviewerNotes, originalValue, etc.) even when value changes
        ...existingResponse,
        value: value,
        // Preserve notes even when deselecting (value becomes null) so they can be restored on re-selection
        notes: existingResponse?.notes || ''
      }

      // Clear answerUuid if value changed - marks as dirty/needing persistence
      // But keep a backup of the original answerUuid AND the last saved state for comparison purposes
      if (!isSameValue && existingResponse?.answerUuid) {
        updatedResponse.savedAnswerUuid = existingResponse.answerUuid // Backup for comparison
        updatedResponse.savedValue = existingResponse.value // Track last saved value
        updatedResponse.savedNotes = existingResponse.notes // Track last saved notes
        delete updatedResponse.answerUuid
        delete updatedResponse.linkedAt
      }

      const newResponses = {
        ...prev,
        [saqType]: {
          ...saqResponses,
          [questionId]: updatedResponse
        }
      }
      
      // Mark this SAQ as needing a re-render if value actually changed
      if (!isSameValue) {
        console.log(`📝 Answer changed for ${saqType}, marking for re-render`)
        setPendingRenders(prevPending => new Set(prevPending).add(saqType))
      }
      
      // Rebuild dependency-filtered questions if dependencies may have changed
      // This ensures questions with depends_on conditions update their visibility
      if (Object.keys(sourceQuestionsRef.current).length > 0) {
        setDependencyFilteredQuestions(applyDependencyFiltering(sourceQuestionsRef.current, newResponses))
      }
      
      return newResponses
    })
  }

  // Handle response notes changes with SAQ type context
  const handleResponseNotesChange = (questionId, notes, saqType = 'SAQ D') => {
    setResponses((prev) => {
      const saqResponses = prev[saqType] || {}
      const existingResponse = saqResponses[questionId]
      
      const notesChanged = existingResponse?.notes !== notes

      const updatedResponse = {
        ...(existingResponse || {}),
        notes: notes
      }

      // Clear answerUuid if notes changed - marks as dirty/needing persistence
      if (notesChanged && existingResponse?.answerUuid) {
        delete updatedResponse.answerUuid
        delete updatedResponse.linkedAt
      }
      
      return {
        ...prev,
        [saqType]: {
          ...saqResponses,
          [questionId]: updatedResponse
        }
      }
    })
  }

  const persistAnswerForQuestion = async (saqType, question, response, forceSkipCheck = false) => {
    const questionnaireAnswerUuid = questionnaireMeta[saqType]?.questionnaireAnswerUuid
    if (!questionnaireAnswerUuid) {
      throw new Error('Questionnaire metadata missing an answer UUID. Reload and try again.')
    }

    // Check if the current value is the same as the existing saved value
    // Compare against the last saved state (stored in existingResponse)
    const existingResponse = responses[saqType]?.[question.id]
    
    // If answerUuid is missing, it means the answer was modified and needs to be saved
    // (answerUuid gets cleared when value changes in handleResponseChange)
    const needsSave = !existingResponse?.answerUuid
    
    // Skip redundancy checks if forceSkipCheck is true (e.g., explicit "Save answer" button click)
    if (!forceSkipCheck) {
      // If we have a previously saved answer and answerUuid is present, check if anything actually changed
      if (existingResponse && !needsSave) {
        // Compare values - deep equality for objects/arrays, simple equality for primitives
        const currentValue = response.value
        const existingValue = existingResponse.value
        const valuesEqual = JSON.stringify(currentValue) === JSON.stringify(existingValue)
        const notesEqual = (response.notes || '') === (existingResponse.notes || '')
        
        // Skip save if both value and notes are unchanged
        if (valuesEqual && notesEqual) {
          console.log(`⏭️ Skipping save - answer unchanged for question ${question.id}`)
          return // Skip save if nothing changed
        }
      }
      
      // If answerUuid was cleared but we're saving the exact same data that was last saved,
      // we can restore the answerUuid and skip the save
      if (needsSave && existingResponse?.savedAnswerUuid) {
        const currentValue = response.value
        const currentNotes = response.notes || ''
        const lastSavedValue = existingResponse.savedValue
        const lastSavedNotes = existingResponse.savedNotes || ''
        
        const valuesEqual = JSON.stringify(currentValue) === JSON.stringify(lastSavedValue)
        const notesEqual = currentNotes === lastSavedNotes
        
        if (valuesEqual && notesEqual) {
          console.log(`⏭️ Restoring answerUuid - data matches last saved state for question ${question.id}`)
          setResponses((prev) => ({
            ...prev,
            [saqType]: {
              ...prev[saqType],
              [question.id]: {
                ...prev[saqType][question.id],
                answerUuid: existingResponse.savedAnswerUuid
              }
            }
          }))
          return // Skip save
        }
      }
    }

    setIsAdvancingQuestion(true)
    setQuestionAdvanceError(null)

    try {
      // Trim string values and notes before saving to API
      const trimmedResponse = {
        ...response,
        value: typeof response.value === 'string' ? response.value.trim() : response.value,
        notes: typeof response.notes === 'string' ? response.notes.trim() : response.notes
      }
      
      const persisted = await saveAnswerForQuestion({
        question,
        response: trimmedResponse,
        questionnaireAnswerUuid
      })

      // If questionnaire is in 'info_requested' status, update to 'providing_info' when user modifies an answer
      const currentStatus = questionnaireMeta[saqType]?.questionnaireStatus
      if (currentStatus === 'info_requested') {
        await updateQuestionnaireStatus(questionnaireAnswerUuid, 'providing_info')
        console.log(`✅ Updated questionnaire status from 'info_requested' to 'providing_info'`)
        
        // Update local state
        setQuestionnaireMeta((prev) => ({
          ...prev,
          [saqType]: {
            ...prev[saqType],
            questionnaireStatus: 'providing_info'
          }
        }))
      }

      setResponses((prev) => {
        const next = { ...prev }
        next[saqType] = {
          ...(next[saqType] || {}),
          [question.id]: persisted.normalized || {
            ...(next[saqType]?.[question.id] || {}),
            value: response.value,
            notes: response.notes || '',
            answerUuid: persisted.answer?.answer_uuid,
            savedAnswerUuid: persisted.answer?.answer_uuid, // Backup for comparison
            savedValue: response.value, // Track last saved value
            savedNotes: response.notes || '', // Track last saved notes
            answerStatus: persisted.answer?.answer_status || 'pending',
            questionnaireAnswerUuid,
            linkedAt: persisted.link?.linked_at || null,
            createdAt: persisted.answer?.created_at,
            updatedAt: persisted.answer?.updated_at
          }
        }
        
        // Rebuild dependency-filtered questions after save to re-evaluate dependencies
        // This ensures questions with depends_on conditions update based on saved values
        if (Object.keys(sourceQuestionsRef.current).length > 0) {
          setDependencyFilteredQuestions(applyDependencyFiltering(sourceQuestionsRef.current, next))
        }
        
        return next
      })
      
      // Mark this SAQ as needing re-render after successful save
      console.log(`💾 Answer saved for ${saqType}, marking for re-render`)
      setPendingRenders(prevPending => new Set(prevPending).add(saqType))
    } catch (error) {
      setQuestionAdvanceError(error.message || 'Failed to save answer before advancing.')
      throw error
    } finally {
      setIsAdvancingQuestion(false)
    }
  }

  const handleQuestionAdvance = async (saqType, direction) => {
    const total = dependencyFilteredQuestions[saqType]?.length || 0
    if (total === 0) return

    if (direction === 'next') {
      const current = questionIndex[saqType] || 0
      const currentQuestion = dependencyFilteredQuestions[saqType]?.[current]
      const currentResponse = currentQuestion ? responses[saqType]?.[currentQuestion.id] : null
      
      // Persist if:
      // 1. There's a value (including false for boolean) AND no answerUuid (new or modified answer marked as dirty)
      // 2. There's a value AND answer was marked as requiring clarification
      const needsPersist = Boolean(
        currentQuestion &&
        currentResponse?.value !== null &&
        currentResponse?.value !== undefined &&
        (!currentResponse?.answerUuid || currentResponse?.answerStatus === 'requires_further_details')
      )

      if (needsPersist) {
        try {
          await persistAnswerForQuestion(saqType, currentQuestion, currentResponse)
        } catch (error) {
          console.error('Failed to persist answer before advancing', error)
          return
        }
      }
    }

    setQuestionAdvanceError(null)
    setQuestionIndex((prev) => {
      const current = prev[saqType] || 0
      const nextIndex = direction === 'next'
        ? Math.min(current + 1, total - 1)
        : Math.max(current - 1, 0)

      if (nextIndex === current) {
        return prev
      }

      return {
        ...prev,
        [saqType]: nextIndex
      }
    })
  }

  const handleQuestionJump = (saqType, targetIndex) => {
    setQuestionIndex((prev) => {
      const total = dependencyFilteredQuestions[saqType]?.length || 0
      if (total === 0) return prev
      const clampedIndex = Math.min(Math.max(targetIndex, 0), total - 1)

      if (clampedIndex === prev[saqType]) {
        return prev
      }

      return {
        ...prev,
        [saqType]: clampedIndex
      }
    })
  }

  const handleJumpToNextUnanswered = async (saqType, nextUnansweredIndex, currentQuestionFromFilter = null) => {
    // Use the passed currentQuestion from filtered view, fallback to dependency-filtered lookup
    const currentQuestion = currentQuestionFromFilter || dependencyFilteredQuestions[saqType]?.[questionIndex[saqType] || 0]
    const currentResponse = currentQuestion ? responses[saqType]?.[currentQuestion.id] : null
    
    // Persist current answer if needed (same logic as handleQuestionAdvance)
    const needsPersist = Boolean(
      currentQuestion &&
      currentResponse?.value !== null &&
      currentResponse?.value !== undefined &&
      (!currentResponse?.answerUuid || currentResponse?.answerStatus === 'requires_further_details')
    )

    if (needsPersist) {
      try {
        // If all questions are answered (nextUnansweredIndex === -1), force save even if unchanged
        const forceSkipCheck = nextUnansweredIndex === -1
        await persistAnswerForQuestion(saqType, currentQuestion, currentResponse, forceSkipCheck)
      } catch (error) {
        console.error('Failed to persist answer before jumping to next unanswered', error)
        return
      }
    }

    // Jump to next unanswered (nextUnansweredIndex should be unfiltered index)
    // If -1, means all questions answered - stay on last question or wrap to first
    if (nextUnansweredIndex >= 0) {
      handleQuestionJump(saqType, nextUnansweredIndex)
    }
    // When no unanswered questions, the component will handle cycling through filtered questions
  }

  const handleJumpToAssignedQuestion = async (saqType, targetQuestionId, currentQuestionFromFilter = null) => {
    if (!saqType || !targetQuestionId) return

    // Use the passed currentQuestion from filtered view, fallback to dependency-filtered lookup
    const currentQuestion = currentQuestionFromFilter || dependencyFilteredQuestions[saqType]?.[questionIndex[saqType] || 0]
    const currentResponse = currentQuestion ? responses[saqType]?.[currentQuestion.id] : null

    // Persist current answer if needed (same logic as handleQuestionAdvance)
    const needsPersist = Boolean(
      currentQuestion &&
      currentResponse?.value !== null &&
      currentResponse?.value !== undefined &&
      (!currentResponse?.answerUuid || currentResponse?.answerStatus === 'requires_further_details')
    )

    if (needsPersist) {
      try {
        await persistAnswerForQuestion(saqType, currentQuestion, currentResponse)
      } catch (error) {
        console.error('Failed to persist answer before jumping to assigned question', error)
        return
      }
    }

    const targetIndex = dependencyFilteredQuestions[saqType]?.findIndex(q => q.id === targetQuestionId) ?? -1
    if (targetIndex >= 0) {
      handleQuestionJump(saqType, targetIndex)
    }
  }

  const handleAnswerToggle = (key, value) => {
    setPaymentAnswers((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleChannelSubmit = async () => {
    const recommended = determineRequiredSAQs(paymentAnswers)
    setSuggestedSAQs(recommended)
    setSelectedSAQs([...recommended])
    setActiveSection('amendment')
  }

  // Submit individual SAQ
  const handleSubmitSAQ = async (saqType) => {
    setIsSubmitting((prev) => ({ ...prev, [saqType]: true }))
    
    try {
      const meta = questionnaireMeta[saqType]
      const questionnaireAnswerUuid = meta?.questionnaireAnswerUuid
      const status = meta?.status
      
      // Skip if no UUID or if status is 'removed'
      if (!questionnaireAnswerUuid) {
        console.warn(`⚠️ No questionnaire answer UUID found for ${saqType}`)
        alert(`Unable to submit ${saqType}: questionnaire not found`)
        return
      }
      
      if (status === 'removed') {
        console.warn(`⚠️ ${saqType} is marked as removed`)
        alert(`Unable to submit ${saqType}: questionnaire was removed`)
        return
      }
      
      console.log(`📤 Submitting ${saqType}...`)
      const saqResponses = responses[saqType] || {}
      
      // Get current status before submission
      const currentStatus = meta?.questionnaireStatus
      console.log(`📊 Current questionnaire status before submission: ${currentStatus}`)
      
      const result = await submitAssessmentForReview(questionnaireAnswerUuid, saqResponses)
      
      console.log(`✅ ${saqType} submitted:`, result)
      
      // Only update total SAQs received on first submission (when status was 'in_progress')
      // Skip for resubmissions (when status is 'providing_info')
      if (currentStatus === 'in_progress') {
        try {
          console.log('📊 First submission detected - updating total SAQs received...')
          await updateTotalSAQsReceived()
          console.log('✅ Total SAQs received count updated')
        } catch (countError) {
          console.error('⚠️ Failed to update total SAQs received count:', countError)
          // Don't fail the submission if count update fails
        }
      } else if (currentStatus === 'providing_info') {
        console.log('⏭️ Resubmission detected (providing_info) - skipping SAQs received count update')
      } else {
        console.log(`⏭️ Skipping SAQs received count update - status is '${currentStatus}' (expected 'in_progress' for first submission)`)
      }
      
      // Update local questionnaireMeta to reflect submitted status
      setQuestionnaireMeta((prev) => ({
        ...prev,
        [saqType]: {
          ...prev[saqType],
          questionnaireStatus: 'submitted'
        }
      }))
      
      // Send notification email to reviewer
      try {
        console.log(`📧 Sending submission notification for ${saqType}...`)
        const reviewerEmail = getReviewerEmail()
        await sendSAQSubmissionNotification(reviewerEmail, [saqType], null, instanceIdRef.current)
        console.log('✅ Notification email sent')
      } catch (emailError) {
        console.error('⚠️ Failed to send notification email:', emailError)
        // Don't fail the submission if email fails
      }
      
      alert(`Successfully submitted ${saqType} for review!`)
      
      // Reload to get updated answers and status from server (stay in attestation section)
      reloadQuestionnaires(true)
    } catch (error) {
      console.error(`❌ Failed to submit ${saqType}:`, error)
      alert(`Failed to submit ${saqType}: ${error.message}`)
    } finally {
      setIsSubmitting((prev) => ({ ...prev, [saqType]: false }))
    }
  }

  // Update questionnaire metadata (e.g., after PDF render completes)
  const handleUpdateQuestionnaireMeta = (saqType, updates) => {
    console.log(`🔄 Updating questionnaireMeta for ${saqType}:`, updates)
    setQuestionnaireMeta((prev) => {
      const updated = {
        ...prev,
        [saqType]: {
          ...prev[saqType],
          metadata: {
            ...prev[saqType]?.metadata,
            ...updates
          }
        }
      }
      console.log(`✅ Updated questionnaireMeta[${saqType}].metadata.document_uuid:`, updated[saqType]?.metadata?.document_uuid)
      return updated
    })
  }

  const handleSAQToggle = async (saq) => {
    // Just update local selected SAQs state
    // Metadata will be updated when clicking "Confirm Selection & Continue"
    setSelectedSAQs((prev) => {
      if (prev.includes(saq)) {
        return prev.filter(s => s !== saq)
      } else {
        return [...prev, saq]
      }
    })
  }

  const handleProceedToQuestionnaires = async () => {
    try {
      // Process Section 2 confirmation with fresh implementation
      const result = await processSection2Confirmation(selectedSAQs, questionnaireMeta, instanceIdRef.current)
      console.log('✅ Processed Section 2 confirmation:', result)
      
      // Reload questionnaires to get fresh data
      // The reload will update selectedSAQs based on which ones are active (not removed)
      // We need to ensure selectedSAQs reflects the user's choice from Step 2
      reloadQuestionnaires()
      
      // After reload completes, selectedSAQs will be updated in the useEffect
      // But we want to preserve the user's selection, so we'll update it again
      // Note: This will be overridden by the useEffect, so we need a different approach
      setActiveSection('questionnaires')
    } catch (error) {
      console.error('❌ Failed to process Section 2 confirmation:', error)
      // Still proceed to questionnaires section
      setActiveSection('questionnaires')
    }
  }
  
  const handleProceedToAttestation = async (currentQuestionFromFilter = null) => {
    // Save current answer before proceeding to attestation (if there is one)
    // Accept currentQuestion from the filtered view to handle the case where filtering is active
    if (activeQuestionnaire) {
      // Use the question passed from the filtered view, or fall back to index-based lookup
      const currentQuestion = currentQuestionFromFilter || 
        (dependencyFilteredQuestions[activeQuestionnaire]?.[questionIndex[activeQuestionnaire] || 0])
      const currentResponse = currentQuestion ? responses[activeQuestionnaire]?.[currentQuestion.id] : null
      
      // Check if answer needs to be persisted (same logic as handleJumpToNextUnanswered)
      const needsPersist = Boolean(
        currentQuestion &&
        currentResponse?.value !== null &&
        currentResponse?.value !== undefined &&
        (!currentResponse?.answerUuid || currentResponse?.answerStatus === 'requires_further_details')
      )

      if (needsPersist) {
        try {
          console.log('💾 Saving current answer before proceeding to attestation...')
          await persistAnswerForQuestion(activeQuestionnaire, currentQuestion, currentResponse)
          console.log('✅ Answer saved successfully')
        } catch (error) {
          console.error('❌ Failed to persist answer before proceeding to attestation:', error)
          // Don't block navigation if save fails - user can still submit later
        }
      }
    }
    
    setActiveSection('attestation')
  }

  const reset = () => {
    hasUserResetRef.current = true
    setActiveSection('decision')
    setPaymentAnswers({
      has_allpayments_services: false,
      has_internet_payments: false,
      internet_redirects_to_allpayments: false,
      has_text_payments: false,
      text_redirects_to_allpayments: false,
      uses_callpay: false,
      callpay_devices_isolated: false,
      callpay_devices_connected_elsewhere: false
    })
    setSuggestedSAQs([])
    setSelectedSAQs([])
    setApplicability({ ...APPLICABILITY_DEFAULTS })
    
    // Clear user responses and attestations, but keep questions loaded (they're static)
    setResponses((prev) => {
      const cleared = {}
      Object.keys(prev).forEach((saq) => {
        cleared[saq] = {}
      })
      return cleared
    })
    setReviewData((prev) => {
      const cleared = {}
      Object.keys(prev).forEach((saq) => {
        cleared[saq] = {}
      })
      return cleared
    })
    setQuestionIndex((prev) => {
      const cleared = {}
      Object.keys(prev).forEach((saq) => {
        cleared[saq] = 0
      })
      return cleared
    })
    setActiveQuestionnaire(null)
    // Trigger a fresh reload so questions/answers are rehydrated from the API
    setQuestionnaireLoadVersion((prev) => prev + 1)
    // Don't clear questions - they're loaded once on mount and don't change
  }

  const wizardSteps = useMemo(() => {
    const allSelectedSaqsHaveMeta =
      selectedSAQs.length > 0 &&
      selectedSAQs.every((saq) => questionnaireMeta?.[saq]?.questionnaireAnswerUuid)

    const isQuestionnairesComplete =
      selectedSAQs.length > 0 &&
      selectedSAQs.every((saqType) => {
        const saqQuestions = dependencyFilteredQuestions?.[saqType] || []
        if (saqQuestions.length === 0) return false

        const uiVisibleQuestions = saqQuestions.filter((question) => {
          const response = responses[saqType]?.[question.id]
          const answerStatus = response?.answerStatus
          const tempStatus = response?.metadata?.temp_status

          if (answerStatus === 'valid' || tempStatus === 'valid') {
            return false
          }

          const questionnaireStatus = questionnaireMeta?.[saqType]?.questionnaireStatus
          const isQuestionnaireFinalized = questionnaireStatus &&
            questionnaireStatus !== 'in_progress' &&
            questionnaireStatus !== 'draft'

          if (isQuestionnaireFinalized) {
            if (!response) return false
            if (answerStatus === 'requires_review') return false
          }

          return true
        })

        const sectionProgress = calculateSectionProgress(responses, uiVisibleQuestions, saqType)
        return sectionProgress.section1.complete &&
          sectionProgress.section2.complete &&
          sectionProgress.section3.complete
      })

    const isAttestationComplete = selectedSAQs.length > 0 &&
      selectedSAQs.every((saqType) => questionnaireMeta?.[saqType]?.questionnaireStatus === 'submitted')

    return [
      { key: 'decision', label: 'Identify Channels', complete: suggestedSAQs.length > 0 || selectedSAQs.length > 0 },
      { key: 'amendment', label: 'Review SAQs', complete: allSelectedSaqsHaveMeta },
      { key: 'questionnaires', label: 'Answer Questionnaires', complete: isQuestionnairesComplete },
      { key: 'attestation', label: 'Sign and Submit', complete: isAttestationComplete }
    ]
  }, [selectedSAQs, suggestedSAQs, questionnaireMeta, dependencyFilteredQuestions, responses])

  // Check if any questionnaire is ready to submit
  const hasReadyToSubmitQuestionnaire = useMemo(() => {
    if (!questionnaireMeta || Object.keys(questionnaireMeta).length === 0) {
      return false
    }
    
    if (!dependencyFilteredQuestions || Object.keys(dependencyFilteredQuestions).length === 0) {
      return false
    }
    
    // Check each questionnaire to see if it's ready to submit
    return Object.entries(questionnaireMeta).some(([saqType, meta]) => {
      // Must have a questionnaire answer UUID (exists)
      if (!meta.questionnaireAnswerUuid) return false
      
      // Must not be already submitted
      if (meta.questionnaireStatus === 'submitted') return false
      
      // Get questions for this SAQ
      const saqQuestions = dependencyFilteredQuestions[saqType] || []
      if (saqQuestions.length === 0) return false
      
      // Apply UI filtering to get visible questions (same logic as AttestationSection)
      const uiVisibleQuestions = saqQuestions.filter((question) => {
        const response = responses[saqType]?.[question.id]
        const answerStatus = response?.answerStatus
        const tempStatus = response?.metadata?.temp_status
        
        // Hide if answer_status or temp_status is 'valid'
        if (answerStatus === 'valid' || tempStatus === 'valid') {
          return false
        }
        
        // Check if questionnaire is finalized
        const questionnaireStatus = meta.questionnaireStatus
        const isQuestionnaireFinalized = questionnaireStatus && 
          questionnaireStatus !== 'in_progress' && 
          questionnaireStatus !== 'draft'
        
        // If finalized, hide questions that don't need user action
        if (isQuestionnaireFinalized) {
          if (!response) return false // Hide unanswered
          if (answerStatus === 'requires_review') return false // Hide approved questions
        }
        
        return true
      })
      
      // Calculate section progress
      const sectionProgress = calculateSectionProgress(responses, uiVisibleQuestions, saqType)
      
      // All sections must be complete
      return sectionProgress.section1.complete && 
             sectionProgress.section2.complete && 
             sectionProgress.section3.complete
    })
  }, [questionnaireMeta, dependencyFilteredQuestions, responses])

  // Show loading state while wizard is initializing and determining which section to display
  const isInitializing = isLoadingQuestions && questionnaireLoadVersion === 0

  return (
    <div className="max-w-5xl mx-auto space-y-12 p-10">
      <PageHeader
        onReset={reset}
        onSave={handleSave}
        onDownloadJSON={handleDownloadJSON}
        onShare={handleShare}
        onRemove={handleRemoveCollaborator}
        isSaving={isSaving}
        saveError={saveError}
        lastSaved={lastSaved}
        hasReadyToSubmitQuestionnaire={hasReadyToSubmitQuestionnaire}
        activeSection={activeSection}
        onNavigateToSigning={() => setActiveSection('attestation')}
        questionnaireMeta={questionnaireMeta}
        instanceUuid={instanceIdRef.current}
        onSharePanelClose={() => setRefetchMissingRolesTrigger(prev => prev + 1)}
      />

      {isInitializing ? (
        <>
          {/* Skeleton wizard steps - show outline while loading */}
          <div className="flex justify-between items-center gap-4 -mt-8">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className="flex-1 bg-gray-100 rounded-lg p-6 animate-pulse"
              >
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>

          {/* Loading card */}
          <div className={`bg-white ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.shadows.md} p-8`}>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`animate-spin ${SaqFormTheme.borderRadius.full} h-12 w-12 border-b-2 ${SaqFormTheme.colors.primary.border[600]}`}></div>
              <p className={SaqFormTheme.colors.neutral.text[600]}>Loading assessment...</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="-mt-8">
            <WizardSteps
              steps={wizardSteps}
              activeSection={activeSection}
              onStepClick={(stepKey) => setActiveSection(stepKey)}
            />
          </div>

      {activeSection === 'decision' && (
        <DecisionSection
          paymentAnswers={paymentAnswers}
          handleAnswerToggle={handleAnswerToggle}
          handleChannelSubmit={handleChannelSubmit}
          paymentServicesQuestions={paymentServicesQuestions}
          isLoadingPaymentQuestions={isLoadingPaymentQuestions}
          paymentQuestionsError={paymentQuestionsError}
        />
      )}

      {activeSection === 'amendment' && (
        <AmendmentSection
          selectedSAQs={selectedSAQs}
          suggestedSAQs={suggestedSAQs}
          paymentAnswers={paymentAnswers}
          handleSAQToggle={handleSAQToggle}
          handleProceedToQuestionnaires={handleProceedToQuestionnaires}
          onBack={() => setActiveSection('decision')}
        />
      )}

      {activeSection === 'questionnaires' && (
        <QuestionnairesSection
          selectedSAQs={selectedSAQs}
          activeQuestionnaire={activeQuestionnaire}
          onSelectQuestionnaire={setActiveQuestionnaire}
          dependencyFilteredQuestions={dependencyFilteredQuestions}
          sourceQuestions={sourceQuestionsRef.current}
          questionIndex={questionIndex}
          responses={responses}
          handleResponseChange={handleResponseChange}
          handleResponseNotesChange={handleResponseNotesChange}
          handleQuestionAdvance={handleQuestionAdvance}
          handleQuestionJump={handleQuestionJump}
          handleJumpToNextUnanswered={handleJumpToNextUnanswered}
          handleJumpToAssignedQuestion={handleJumpToAssignedQuestion}
          isLoadingQuestions={isLoadingQuestions}
          questionsError={questionsError}
          reloadQuestionnaires={reloadQuestionnaires}
          renderExpectedTesting={renderExpectedTesting}
          isReviewMode={isReviewMode}
          reviewData={reviewData}
          handleReviewToggle={handleReviewToggle}
          handleReviewNotesChange={handleReviewNotesChange}
          questionnaireMeta={questionnaireMeta}
          isAdvancingQuestion={isAdvancingQuestion}
          questionAdvanceError={questionAdvanceError}
          templateContext={templateContext}
          onBack={() => setActiveSection('amendment')}
          handleProceedToAttestation={handleProceedToAttestation}
        />
      )}

      {activeSection === 'attestation' && selectedSAQs.length > 0 && (
        <AttestationSection
          selectedSAQs={selectedSAQs}
          onBack={() => setActiveSection('questionnaires')}
          onSubmitSAQ={handleSubmitSAQ}
          isSubmitting={isSubmitting}
          questionnaireMeta={questionnaireMeta}
          responses={responses}
          dependencyFilteredQuestions={dependencyFilteredQuestions}
          onUpdateQuestionnaireMeta={handleUpdateQuestionnaireMeta}
          reloadQuestionnaires={reloadQuestionnaires}
          instanceUuid={instanceIdRef.current}
          onShare={handleShare}
          onRemove={handleRemoveCollaborator}
          externalRefetchTrigger={refetchMissingRolesTrigger}
          pendingRenders={pendingRenders}
          renderingInProgress={renderingInProgress}
        />
      )}
        </>
      )}
    </div>
  )
}

export default SAQFormInterface
