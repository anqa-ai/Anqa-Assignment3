import React, { useState, useEffect, useMemo } from 'react'
import { getApiBase } from '../../ENV_Specific/SaqFormConfig.js'
import { getInstanceUuid, getCurrentUserEmail, groupQuestionsBySections, calculateSectionProgress, loadQuestionsForTemplate, extractEmailsFromSentTo, normalizeSentTo, addEmailToSentTo, emailExistsInSentTo, removeEmailFromSentTo } from '../../SaqFormDataService.js'
import { isQuestionVisible } from '../../SaqConditionalLogic'
import { QuestionHeatmap } from '../navigation/QuestionHeatmap'
import { getRoleDisplayName } from '../../SaqFormConstants'
import { SaqFormTheme, getButtonClasses, getInputClasses } from '../../SaqFormTheme'

export const ShareEmailPanel = ({ isOpen, onClose, onShare, onRemove, questionnaireMeta = {}, instanceUuid = null, initialSAQ = null }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedSAQ, setSelectedSAQ] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [availableRoles, setAvailableRoles] = useState([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(false)
  const [error, setError] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [existingCollaborators, setExistingCollaborators] = useState([])
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [editingCollaborator, setEditingCollaborator] = useState(null)
  const [selectedRoleAssignments, setSelectedRoleAssignments] = useState([])
  const [currentUserEmail, setCurrentUserEmail] = useState(null)
  const [showAssignQuestionsModal, setShowAssignQuestionsModal] = useState(false)
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState(null)
  const [selectedSection, setSelectedSection] = useState(null)
  const [questionnaireQuestions, setQuestionnaireQuestions] = useState([])
  const [questionnaireResponses, setQuestionnaireResponses] = useState({})
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [selectedQuestionIdsBySection, setSelectedQuestionIdsBySection] = useState({})
  const [lastClickedQuestionId, setLastClickedQuestionId] = useState(null)
  const [showCollaboratorTooltip, setShowCollaboratorTooltip] = useState(false)
  const [assigningToCollaborator, setAssigningToCollaborator] = useState(null)
  // Store pending question assignments locally (not saved to API until Send is clicked)
  // Structure: { [questionnaireAnswerUuid]: [questionId1, questionId2, ...] }
  const [pendingQuestionAssignments, setPendingQuestionAssignments] = useState({})

  // Get available SAQs (those not yet submitted) - moved up so we can use it in useEffect
  const availableSAQs = useMemo(() => {
    const saqs = Object.entries(questionnaireMeta)
      .map(([saqType, meta]) => ({ saqType, meta }))
      .filter(({ meta }) => {
        // Show SAQs that have been created (have questionnaireAnswerUuid) and are not submitted
        return meta?.questionnaireAnswerUuid && meta?.questionnaireStatus !== 'submitted'
      })
      .map(({ saqType, meta }) => ({
        value: saqType,
        label: meta?.name || meta?.metadata?.name || saqType,
        documentUuid: meta?.metadata?.document_uuid,
        questionnaireAnswerUuid: meta?.questionnaireAnswerUuid,
        metadata: meta?.metadata
      }))
    
    return saqs
  }, [questionnaireMeta])

  // Fetch current user's email when modal opens
  useEffect(() => {
    const fetchCurrentUserEmail = async () => {
      if (isOpen) {
        try {
          const email = await getCurrentUserEmail()
          setCurrentUserEmail(email)
        } catch (error) {
          console.error('❌ Failed to fetch current user email:', error)
        }
      }
    }
    
    fetchCurrentUserEmail()
  }, [isOpen])

  // Auto-select initialSAQ when modal opens
  useEffect(() => {
    if (isOpen && initialSAQ) {
      // Check if initialSAQ is in availableSAQs
      const saqExists = availableSAQs.some(s => s.value === initialSAQ)
      if (saqExists) {
        setSelectedSAQ(initialSAQ)
        setShowAddForm(true) // Auto-open the add form
      }
    } else if (!isOpen) {
      // Reset when modal closes
      setSelectedSAQ('')
      setSelectedRole('')
      setShowAddForm(false)
      setName('')
      setEmail('')
      setError('')
      setSuccessMessage('')
      setEditingCollaborator(null)
      setSelectedRoleAssignments([])
    }
  }, [isOpen, initialSAQ, availableSAQs])

  // Load existing collaborators when modal opens
  useEffect(() => {
    const loadCollaborators = async () => {
      if (!isOpen) return
      
      setIsLoadingCollaborators(true)
      setError('')
      
      try {
        // Resolve instance UUID - use prop if available, otherwise resolve from URL/token
        let effectiveInstanceUuid = instanceUuid
        if (!effectiveInstanceUuid) {
          try {
            effectiveInstanceUuid = await getInstanceUuid()
          } catch (resolveError) {
            console.error('❌ Failed to resolve instance UUID:', resolveError)
            setError('Unable to load collaborators: instance UUID not found')
            setExistingCollaborators([])
            return
          }
        }
        
        const apiBase = getApiBase()
        
        // Get interface instance to see sent_to list
        const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_uuid: effectiveInstanceUuid }),
          credentials: 'include'
        })
        
        if (!instanceResponse.ok) {
          const errorText = await instanceResponse.text()
          console.error('❌ Failed to load interface instance:', instanceResponse.status, errorText)
          throw new Error('Failed to load interface instance')
        }
        
        const instanceData = await instanceResponse.json()
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build a map of email -> their role assignments
        const emailRoleMap = {}
        
        // Go through each questionnaire and extract roles
        for (const [saqType, meta] of Object.entries(questionnaireMeta)) {
          if (meta?.metadata?.document_uuid && meta?.questionnaireAnswerUuid) {
            try {
              // Fetch questionnaire to get roles from metadata
              const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionnaire_answer_uuid: meta.questionnaireAnswerUuid }),
                credentials: 'include'
              })
              
              if (qResponse.ok) {
                const qData = await qResponse.json()
                const roles = qData?.questionnaire_answer?.metadata?.roles || []
                
                // Roles are in format [{email: role}, {email: role}, ...]
                roles.forEach(roleObj => {
                  Object.entries(roleObj).forEach(([email, role]) => {
                    if (!emailRoleMap[email]) {
                      emailRoleMap[email] = []
                    }
                    emailRoleMap[email].push({
                      role,
                      saq: saqType,
                      questionnaireAnswerUuid: meta.questionnaireAnswerUuid
                    })
                  })
                })
              } else {
                console.warn(`⚠️ Failed to fetch questionnaire for ${saqType}:`, qResponse.status)
              }
            } catch (fetchError) {
              console.error(`❌ Error fetching questionnaire for ${saqType}:`, fetchError)
              // Continue processing other questionnaires
            }
          }
        }
        
        // Build collaborator list grouped by email
        const collaboratorsByEmail = {}
        sentToNormalized.forEach(item => {
          const email = item.email
          const roleAssignments = emailRoleMap[email] || []
          
          if (!collaboratorsByEmail[email]) {
            collaboratorsByEmail[email] = {
              email,
              name: item.name || email,
              roles: []
            }
          }
          
          if (roleAssignments.length > 0) {
            collaboratorsByEmail[email].roles.push(...roleAssignments)
          }
        })
        
        // Convert to array
        const collaboratorsList = Object.values(collaboratorsByEmail)
        setExistingCollaborators(collaboratorsList)
      } catch (err) {
        console.error('❌ Error loading collaborators:', err)
        setError(err.message || 'Failed to load collaborators')
        setExistingCollaborators([])
      } finally {
        setIsLoadingCollaborators(false)
      }
    }
    
    loadCollaborators()
  }, [isOpen, instanceUuid, questionnaireMeta])

  // Fetch roles when SAQ is selected
  useEffect(() => {
    const fetchRoles = async () => {
      if (!selectedSAQ) {
        setAvailableRoles([])
        setSelectedRole('')
        return
      }

      const saq = availableSAQs.find(s => s.value === selectedSAQ)
      
      if (!saq?.documentUuid) {
        console.warn(`⚠️ No document UUID found for SAQ: ${selectedSAQ}`)
        setAvailableRoles([])
        return
      }

      setIsLoadingRoles(true)
      setError('') // Clear any previous errors
      try {
        const apiBase = getApiBase()
        const response = await fetch(`${apiBase}/documents/get-document`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ document_uuid: saq.documentUuid }),
          credentials: 'include'
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`❌ Document fetch failed: ${response.status}`, errorText)
          throw new Error(`Failed to fetch document: ${response.status}`)
        }
        
        const jsonData = await response.json()
        const groups = jsonData?.document?.metadata?.document_properties?.groups || []
        
        setAvailableRoles(groups)
        // Don't auto-select a role - let user choose or leave as "No Role" for view-only access
      } catch (err) {
        console.error('❌ Error fetching roles:', err)
        setError('Failed to load available roles for this SAQ')
        setAvailableRoles([])
      } finally {
        setIsLoadingRoles(false)
      }
    }

    fetchRoles()
  }, [selectedSAQ, availableSAQs])

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Add collaborator without role assignment
  const handleAddCollaboratorWithoutRole = async () => {
    // Validate name
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }
    
    // Validate email
    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSharing(true)
    setError('')
    
    try {
      // Save pending question assignments first (if any)
      await savePendingQuestionAssignments(email.trim(), name.trim())
      
      // Add collaborator without role (role will be null)
      await onShare({
        name: name.trim(),
        email: email.trim(),
        role: null,
        saq: null,
        questionnaireAnswerUuid: null,
        metadata: null
      })
      
      // Reset form and clear pending assignments
      setName('')
      setEmail('')
      setSelectedSAQ('')
      setSelectedRole('')
      setSelectedRoleAssignments([])
      setPendingQuestionAssignments({})
      setShowAddForm(false)
      
      // Show success message
      setSuccessMessage(`${email.trim()} has been added successfully!`)
      setTimeout(() => setSuccessMessage(''), 5000)
      
      // Reload collaborators list
      const apiBase = getApiBase()
      const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_uuid: instanceUuid }),
        credentials: 'include'
      })
      
      if (instanceResponse.ok) {
        const instanceData = await instanceResponse.json()
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build a map of email -> their role assignments
        const emailRoleMap = {}
        
        // Go through each questionnaire and extract roles
        for (const [saqType, meta] of Object.entries(questionnaireMeta)) {
          if (meta?.metadata?.document_uuid && meta?.questionnaireAnswerUuid) {
            const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionnaire_answer_uuid: meta.questionnaireAnswerUuid }),
              credentials: 'include'
            })
            
            if (qResponse.ok) {
              const qData = await qResponse.json()
              const roles = qData?.questionnaire_answer?.metadata?.roles || []
              
              // Roles are in format [{email: role}, {email: role}, ...]
              roles.forEach(roleObj => {
                Object.entries(roleObj).forEach(([email, role]) => {
                  if (!emailRoleMap[email]) {
                    emailRoleMap[email] = []
                  }
                  emailRoleMap[email].push({
                    role,
                    saq: saqType,
                    questionnaireAnswerUuid: meta.questionnaireAnswerUuid
                  })
                })
              })
            }
          }
        }
        
        // Build collaborator list grouped by email
        const collaboratorsByEmail = {}
        sentToNormalized.forEach(item => {
          const email = item.email
          const roleAssignments = emailRoleMap[email] || []
          
          if (!collaboratorsByEmail[email]) {
            collaboratorsByEmail[email] = {
              email,
              name: item.name || email,
              roles: []
            }
          }
          
          if (roleAssignments.length > 0) {
            collaboratorsByEmail[email].roles.push(...roleAssignments)
          }
        })
        
        // Convert to array
        const collaboratorsList = Object.values(collaboratorsByEmail)
        setExistingCollaborators(collaboratorsList)
      }
    } catch (err) {
      setError(err.message || 'Failed to add collaborator')
    } finally {
      setIsSharing(false)
    }
  }

  const handleShare = async () => {
    setError('')
    
    // Validation
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    // Must have at least one role assignment
    if (selectedRoleAssignments.length === 0) {
      setError('Please add at least one role assignment')
      return
    }

    setIsSharing(true)
    try {
      // Save pending question assignments first (if any)
      await savePendingQuestionAssignments(email.trim(), name.trim() || email.trim())
      
      // Process each role assignment
      for (const assignment of selectedRoleAssignments) {
        await onShare({
          name: name.trim(),
          email: email.trim(),
          role: assignment.role,
          saq: assignment.saq,
          questionnaireAnswerUuid: assignment.questionnaireAnswerUuid || null,
          metadata: assignment.metadata || null
        })
      }
      
      // Reset form and clear pending assignments
      setName('')
      setEmail('')
      setSelectedSAQ('')
      setSelectedRole('')
      setSelectedRoleAssignments([])
      setPendingQuestionAssignments({})
      setError('')
      setShowAddForm(false)
      setEditingCollaborator(null)
      
      // Show success message
      const action = editingCollaborator ? 'updated' : 'added'
      setSuccessMessage(`${email.trim()} has been ${action} successfully!`)
      setTimeout(() => setSuccessMessage(''), 5000) // Clear after 5 seconds
      
      // Reload collaborators list
      const apiBase = getApiBase()
      const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_uuid: instanceUuid }),
        credentials: 'include'
      })
      
      if (instanceResponse.ok) {
        const instanceData = await instanceResponse.json()
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build a map of email -> their role assignments
        const emailRoleMap = {}
        
        // Go through each questionnaire and extract roles
        for (const [saqType, meta] of Object.entries(questionnaireMeta)) {
          if (meta?.metadata?.document_uuid && meta?.questionnaireAnswerUuid) {
            const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionnaire_answer_uuid: meta.questionnaireAnswerUuid }),
              credentials: 'include'
            })
            
            if (qResponse.ok) {
              const qData = await qResponse.json()
              const roles = qData?.questionnaire_answer?.metadata?.roles || []
              
              // Roles are in format [{email: role}, {email: role}, ...]
              roles.forEach(roleObj => {
                Object.entries(roleObj).forEach(([email, role]) => {
                  if (!emailRoleMap[email]) {
                    emailRoleMap[email] = []
                  }
                  emailRoleMap[email].push({
                    role,
                    saq: saqType,
                    questionnaireAnswerUuid: meta.questionnaireAnswerUuid
                  })
                })
              })
            }
          }
        }
        
        // Build collaborator list grouped by email
        const collaboratorsByEmail = {}
        sentToNormalized.forEach(item => {
          const email = item.email
          const roleAssignments = emailRoleMap[email] || []
          
          if (!collaboratorsByEmail[email]) {
            collaboratorsByEmail[email] = {
              email,
              name: item.name || email,
              roles: []
            }
          }
          
          if (roleAssignments.length > 0) {
            collaboratorsByEmail[email].roles.push(...roleAssignments)
          }
        })
        
        // Convert to array
        const collaboratorsList = Object.values(collaboratorsByEmail)
        setExistingCollaborators(collaboratorsList)
      }
    } catch (err) {
      setError(err.message || 'Failed to add collaborator')
    } finally {
      setIsSharing(false)
    }
  }

  const handleClose = () => {
    setName('')
    setEmail('')
    setSelectedSAQ('')
    setSelectedRole('')
    setSelectedRoleAssignments([])
    setPendingQuestionAssignments({})
    setError('')
    setShowAddForm(false)
    setSuccessMessage('')
    setEditingCollaborator(null)
    onClose()
  }

  // Load questions for selected questionnaire using the same approach as the main interface
  const loadQuestionnaireQuestions = async (questionnaire) => {
    if (!questionnaire || !questionnaire.questionnaireAnswerUuid) return
    
    setIsLoadingQuestions(true)
    setSelectedQuestionnaire(questionnaire)
    setSelectedSection(null)
    
    try {
      const apiBase = getApiBase()
      const currentInstanceUuid = await getInstanceUuid(instanceUuid)
      
      // Get questionnaire metadata from questionnaireMeta (has templateUuid)
      const meta = questionnaireMeta[questionnaire.value] || {}
      const templateUuid = meta?.templateUuid
      
      if (!templateUuid) {
        console.error('Template UUID not found in questionnaireMeta:', meta)
        throw new Error('Template UUID not found')
      }
      
      // Use get-questionnaire-with-latest-answers endpoint to get answers
      const response = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-with-latest-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaire_answer_uuid: questionnaire.questionnaireAnswerUuid,
          include_deleted: false
        }),
      })
      
      if (!response.ok) throw new Error('Failed to fetch questionnaire')
      const responseData = await response.json()
      
      const answers = responseData?.answers || []
      
      // Load questions using the template UUID from metadata
      const templateMeta = {
        templateUuid,
        questionnaireAnswerUuid: questionnaire.questionnaireAnswerUuid,
        shortName: questionnaire.value,
        name: questionnaire.label || meta?.name,
        metadata: {
          ...meta?.metadata,
          ...responseData?.questionnaire?.metadata
        }
      }
      
      const questions = await loadQuestionsForTemplate(templateUuid, templateMeta, currentInstanceUuid)
      console.log(`✅ Loaded ${questions.length} questions for ${questionnaire.value}`)
      setQuestionnaireQuestions(questions)
      
      // Build responses from answers (same format as main interface)
      const responses = {}
      if (answers && Array.isArray(answers)) {
        answers.forEach((answer) => {
          const question = questions.find(q => q.questionUuid === answer.remote_question_uuid)
          if (question) {
            responses[question.id] = { 
              value: answer.answer_value,
              answerStatus: answer.answer_status,
              metadata: {
                ...(answer.metadata || {}),
                temp_status: answer.temp_status || answer.metadata?.temp_status
              }
            }
          }
        })
      }
      // Attach assignee info from questionnaire metadata for heatmap borders
      const assignmentList = responseData?.questionnaire?.metadata?.question_assignments || []
      assignmentList.forEach((assignment) => {
        const questionIds = assignment?.question_ids || []
        questionIds.forEach((questionId) => {
          responses[questionId] = {
            ...(responses[questionId] || {}),
            assignee: true
          }
        })
      })
      console.log(`✅ Built ${Object.keys(responses).length} responses`)
      setQuestionnaireResponses(responses)
    } catch (error) {
      console.error('Error loading questionnaire questions:', error)
      setQuestionnaireQuestions([])
      setQuestionnaireResponses({})
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  // Get sections for selected questionnaire
  const getSections = () => {
    if (!questionnaireQuestions.length) {
      console.log('⚠️ No questions available for sections')
      return []
    }
    
    // STAGE 1: Apply dependency-based filtering (matches main UI)
    const dependencyFilteredQuestions = questionnaireQuestions.filter((question) => {
      const props = question?.rawProperties || question?.properties || {}
      const questionId = (props.id || question.id || '').toLowerCase()

      // Exclude questions with IDs starting with "sec3.3b", "sec3.3c", "sec3.part3b", or "sec3.part3c" (case-insensitive)
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

      // Check depends_on conditional logic
      if (!isQuestionVisible(question, questionnaireResponses, questionnaireQuestions)) {
        return false
      }

      return true
    })

    // STAGE 2: Filter questions to match the UI visibility logic used in the questionnaire view
    // Hide questions with answerStatus === 'valid' or temp_status === 'valid'
    const uiVisibleQuestions = dependencyFilteredQuestions.filter((question) => {
      const response = questionnaireResponses[question.id]
      const answerStatus = response?.answerStatus
      const tempStatus = response?.metadata?.temp_status
      
      // Hide if answer_status or temp_status is 'valid'
      if (answerStatus === 'valid' || tempStatus === 'valid') {
        return false
      }
      
      // Check if questionnaire is finalized (not in_progress or draft)
      const questionnaireStatus = questionnaireMeta[selectedQuestionnaire?.value]?.questionnaireStatus
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
    
    const sectionGroups = groupQuestionsBySections(uiVisibleQuestions, dependencyFilteredQuestions)
    const sectionProgress = calculateSectionProgress(questionnaireResponses, uiVisibleQuestions, selectedQuestionnaire?.value)
    
    console.log('📊 Section groups:', sectionGroups)
    console.log('📊 Section progress:', sectionProgress)
    console.log(`📊 Filtered ${questionnaireQuestions.length} questions to ${dependencyFilteredQuestions.length} dependency-visible and ${uiVisibleQuestions.length} UI-visible questions`)
    
    const sections = [
      { 
        key: 'section1', 
        label: 'Section 1',
        name: 'Assessment Information',
        ...sectionProgress?.section1 || {},
        group: sectionGroups?.section1 || {}
      },
      { 
        key: 'section2', 
        label: 'Section 2',
        name: 'Self-Assessment Questionnaire',
        ...sectionProgress?.section2 || {},
        group: sectionGroups?.section2 || {}
      },
      { 
        key: 'section3', 
        label: 'Section 3',
        name: 'Validation and Attestation',
        ...sectionProgress?.section3 || {},
        group: sectionGroups?.section3 || {}
      }
    ]
    
    const filteredSections = sections.filter(section => section.group?.hasQuestions)
    console.log(`📋 Found ${filteredSections.length} sections with questions`)
    return filteredSections
  }

  // Function to save pending question assignments to questionnaire metadata
  const savePendingQuestionAssignments = async (collaboratorEmail, collaboratorName) => {
    if (Object.keys(pendingQuestionAssignments).length === 0) {
      return // No pending assignments to save
    }
    
    try {
      const apiBase = getApiBase()
      const currentUserEmail = await getCurrentUserEmail()
      
      // Save assignments for each questionnaire
      for (const [questionnaireAnswerUuid, questionIds] of Object.entries(pendingQuestionAssignments)) {
        if (!questionIds || questionIds.length === 0) continue
        
        try {
          // Fetch current questionnaire to get existing metadata
          const getResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
            credentials: 'include'
          })
          
          if (!getResponse.ok) {
            console.warn(`⚠️ Failed to get questionnaire ${questionnaireAnswerUuid}: ${getResponse.status}`)
            continue
          }
          
          const questionnaireData = await getResponse.json()
          const currentQuestionnaire = questionnaireData?.questionnaire_answer
          const currentMetadata = currentQuestionnaire?.metadata || {}
          
          // Get existing question_assignments array (preserve it)
          const existingAssignments = currentMetadata.question_assignments || []
          
          // Remove any existing assignment for this email + questionnaire combination
          const filteredAssignments = existingAssignments.filter(
            assignment => !(assignment.email === collaboratorEmail && 
                           assignment.questionnaire_answer_uuid === questionnaireAnswerUuid)
          )
          
          // Add new assignment
          const updatedAssignments = [
            ...filteredAssignments,
            {
              email: collaboratorEmail,
              questionnaire_answer_uuid: questionnaireAnswerUuid,
              question_ids: questionIds,
              assigned_at: new Date().toISOString(),
              assigned_by: currentUserEmail
            }
          ]
          
          // Build the complete metadata object, preserving ALL existing fields
          const updatedMetadata = {
            ...currentMetadata,
            question_assignments: updatedAssignments
          }
          
          // Save updated questionnaire
          const updateResponse = await fetch(`${apiBase}/questionnaire-answers/update-questionnaire-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionnaire_answer_uuid: questionnaireAnswerUuid,
              update_details: {
                metadata: updatedMetadata
              }
            }),
            credentials: 'include'
          })
          
          if (updateResponse.ok) {
            console.log(`✅ Saved ${questionIds.length} question assignments for ${collaboratorEmail} in questionnaire ${questionnaireAnswerUuid}`)
          } else {
            const errorText = await updateResponse.text()
            console.error(`❌ Failed to update questionnaire ${questionnaireAnswerUuid}: ${updateResponse.status} - ${errorText}`)
          }
        } catch (error) {
          console.error(`❌ Error saving assignments for questionnaire ${questionnaireAnswerUuid}:`, error)
          // Continue with other questionnaires
        }
      }
      
      // Update interface instance sent_to list
      try {
        const currentInstanceUuid = await getInstanceUuid(instanceUuid)
        
        const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_uuid: currentInstanceUuid }),
          credentials: 'include'
        })
        
        if (instanceResponse.ok) {
          const instanceData = await instanceResponse.json()
          const currentInstance = instanceData?.instance
          
          if (currentInstance) {
            const currentSentTo = currentInstance.sent_to || []
            
            // Only add email if not already in the list
            if (!emailExistsInSentTo(currentSentTo, collaboratorEmail)) {
              const updatedSentTo = addEmailToSentTo(
                currentSentTo, 
                collaboratorEmail, 
                collaboratorName || null
              )
              
              await fetch(`${apiBase}/website/client/interface-instances/update-interface-instance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  instance_uuid: currentInstanceUuid,
                  instance_details: {
                    ...currentInstance,
                    sent_to: updatedSentTo
                  }
                }),
                credentials: 'include'
              })
              
              console.log(`✅ Added ${collaboratorEmail}${collaboratorName ? ` (${collaboratorName})` : ''} to interface instance sent_to list`)
            }
          }
        }
      } catch (updateError) {
        console.warn('⚠️ Failed to update interface instance sent_to list (non-critical):', updateError)
      }
    } catch (error) {
      console.error('❌ Failed to save pending question assignments:', error)
      throw error
    }
  }

  // Function to save question assignments to questionnaire metadata
  const saveQuestionAssignments = async (collaboratorEmail, questionnaireAnswerUuid, questionIds) => {
    const apiBase = getApiBase()
    
    try {
      // 1. Fetch current questionnaire to get existing metadata
      const getResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
        credentials: 'include'
      })
      
      if (!getResponse.ok) {
        throw new Error(`Failed to get questionnaire: ${getResponse.status}`)
      }
      
      const questionnaireData = await getResponse.json()
      const currentQuestionnaire = questionnaireData?.questionnaire_answer
      const currentMetadata = currentQuestionnaire?.metadata || {}
      
      // 2. Get current user email for assigned_by
      const currentUserEmail = await getCurrentUserEmail()
      
      // 3. Get existing question_assignments array (preserve it)
      const existingAssignments = currentMetadata.question_assignments || []
      
      // 4. Remove any existing assignment for this email + questionnaire combination
      const filteredAssignments = existingAssignments.filter(
        assignment => !(assignment.email === collaboratorEmail && 
                       assignment.questionnaire_answer_uuid === questionnaireAnswerUuid)
      )
      
      // 5. Add new assignment (only if there are questions to assign)
      let updatedAssignments = filteredAssignments
      if (questionIds.length > 0) {
        updatedAssignments = [
          ...filteredAssignments,
          {
            email: collaboratorEmail,
            questionnaire_answer_uuid: questionnaireAnswerUuid,
            question_ids: questionIds, // Array of question IDs
            assigned_at: new Date().toISOString(),
            assigned_by: currentUserEmail
          }
        ]
      }
      
      // 6. Build the complete metadata object, preserving ALL existing fields
      // This is critical - we spread currentMetadata first, then only update question_assignments
      const updatedMetadata = {
        ...currentMetadata,  // Preserve everything: roles, document_uuid, name, etc.
        question_assignments: updatedAssignments
      }
      
      // 7. Save updated questionnaire
      const updateResponse = await fetch(`${apiBase}/questionnaire-answers/update-questionnaire-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaire_answer_uuid: questionnaireAnswerUuid,
          update_details: {
            metadata: updatedMetadata
          }
        }),
        credentials: 'include'
      })
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        throw new Error(`Failed to update questionnaire: ${updateResponse.status} - ${errorText}`)
      }
      
      console.log(`✅ Saved ${questionIds.length} question assignments for ${collaboratorEmail}`)
      console.log('📋 Updated metadata (preserving all existing fields):', {
        roles: updatedMetadata.roles?.length || 0,
        question_assignments: updatedMetadata.question_assignments?.length || 0,
        document_uuid: updatedMetadata.document_uuid,
      })
      return true
    } catch (error) {
      console.error('❌ Failed to save question assignments:', error)
      throw error
    }
  }

  // Add role assignment and save immediately
  const handleAddRoleAssignment = async () => {
    // Validate email first
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    if (!email.trim()) {
      setError('Please enter an email address')
      return
    }
    
    if (!validateEmail(email)) {
      setError('Please enter a valid email address')
      return
    }
    
    if (!selectedSAQ || !selectedRole) {
      setError('Please select both SAQ and role')
      return
    }
    
    const saq = availableSAQs.find(s => s.value === selectedSAQ)
    if (!saq) {
      setError('Selected SAQ not found')
      return
    }
    
    // Check if this combination already exists in selectedRoleAssignments
    const exists = selectedRoleAssignments.some(
      a => a.saq === selectedSAQ && a.role === selectedRole
    )
    
    if (exists) {
      setError('This role assignment already exists')
      return
    }
    
    // Check if this combination already exists for this email in existing collaborators
    if (editingCollaborator) {
      const existsInExisting = editingCollaborator.roles.some(
        r => r.saq === selectedSAQ && r.role === selectedRole
      )
      if (existsInExisting) {
        setError('This role assignment already exists for this collaborator')
        return
      }
    }
    
    setError('')
    setIsSharing(true)
    
    try {
      // Save this role assignment immediately
      await onShare({
        name: name.trim(),
        email: email.trim(),
        role: selectedRole,
        saq: selectedSAQ,
        questionnaireAnswerUuid: saq.questionnaireAnswerUuid || null,
        metadata: saq.metadata || null
      })
      
      // Add to the list for display
      setSelectedRoleAssignments(prev => [...prev, {
        saq: selectedSAQ,
        role: selectedRole,
        questionnaireAnswerUuid: saq.questionnaireAnswerUuid,
        metadata: saq.metadata
      }])
      
      // Reset selection for next addition
      setSelectedSAQ('')
      setSelectedRole('')
      
      // Show success message
      setSuccessMessage(`Role assignment added successfully!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      // Reload collaborators list to reflect the change
      const apiBase = getApiBase()
      const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_uuid: instanceUuid }),
        credentials: 'include'
      })
      
      if (instanceResponse.ok) {
        const instanceData = await instanceResponse.json()
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build a map of email -> their role assignments
        const emailRoleMap = {}
        
        // Go through each questionnaire and extract roles
        for (const [saqType, meta] of Object.entries(questionnaireMeta)) {
          if (meta?.metadata?.document_uuid && meta?.questionnaireAnswerUuid) {
            const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionnaire_answer_uuid: meta.questionnaireAnswerUuid }),
              credentials: 'include'
            })
            
            if (qResponse.ok) {
              const qData = await qResponse.json()
              const roles = qData?.questionnaire_answer?.metadata?.roles || []
              
              // Roles are in format [{email: role}, {email: role}, ...]
              roles.forEach(roleObj => {
                Object.entries(roleObj).forEach(([email, role]) => {
                  if (!emailRoleMap[email]) {
                    emailRoleMap[email] = []
                  }
                  emailRoleMap[email].push({
                    role,
                    saq: saqType,
                    questionnaireAnswerUuid: meta.questionnaireAnswerUuid
                  })
                })
              })
            }
          }
        }
        
        // Build collaborator list grouped by email
        const collaboratorsByEmail = {}
        sentToNormalized.forEach(item => {
          const email = item.email
          const roleAssignments = emailRoleMap[email] || []
          
          if (!collaboratorsByEmail[email]) {
            collaboratorsByEmail[email] = {
              email,
              name: item.name || email,
              roles: []
            }
          }
          
          if (roleAssignments.length > 0) {
            collaboratorsByEmail[email].roles.push(...roleAssignments)
          }
        })
        
        // Convert to array
        const collaboratorsList = Object.values(collaboratorsByEmail)
        setExistingCollaborators(collaboratorsList)
        
        // Update editingCollaborator if we're in edit mode
        if (editingCollaborator) {
          const updated = collaboratorsList.find(c => c.email === editingCollaborator.email)
          if (updated) {
            setEditingCollaborator(updated)
            setSelectedRoleAssignments(updated.roles || [])
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to add role assignment')
    } finally {
      setIsSharing(false)
    }
  }
  
  // Remove role assignment from the list
  const handleRemoveRoleAssignment = (index) => {
    setSelectedRoleAssignments(prev => prev.filter((_, i) => i !== index))
  }
  
  // Edit collaborator
  const handleEdit = (collaborator) => {
    setEditingCollaborator(collaborator)
    setName(collaborator.name || '')
    setEmail(collaborator.email)
    setSelectedRoleAssignments(collaborator.roles || [])
    setShowAddForm(true)
    setError('')
  }
  
  // Remove individual role from a collaborator
  const handleRemoveIndividualRole = async (collaborator, roleIndex) => {
    const roleToRemove = collaborator.roles[roleIndex]
    if (!roleToRemove) return
    
    try {
      await onRemove({
        email: collaborator.email,
        role: roleToRemove.role,
        saq: roleToRemove.saq,
        questionnaireAnswerUuid: roleToRemove.questionnaireAnswerUuid
      })
      
      // Update local state
      setExistingCollaborators(prev => 
        prev.map(c => {
          if (c.email === collaborator.email) {
            const updatedRoles = c.roles.filter((_, i) => i !== roleIndex)
            return {
              ...c,
              roles: updatedRoles
            }
          }
          return c
        })
      )
    } catch (err) {
      console.error('❌ Error removing role:', err)
      alert('Failed to remove role: ' + err.message)
    }
  }
  
  // Remove entire collaborator
  const handleRemoveCollaborator = async (collaborator) => {
    try {
      // Remove all roles first
      for (const role of collaborator.roles) {
        await onRemove({
          email: collaborator.email,
          role: role.role,
          saq: role.saq,
          questionnaireAnswerUuid: role.questionnaireAnswerUuid
        })
      }
      
      // Remove from interface instance sent_to list (since we're removing the entire collaborator)
      try {
        const apiBase = getApiBase()
        const currentInstanceUuid = await getInstanceUuid(instanceUuid)
        
        const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_uuid: currentInstanceUuid }),
          credentials: 'include'
        })
        
        if (instanceResponse.ok) {
          const instanceData = await instanceResponse.json()
          const instance = instanceData?.instance
          
          if (instance) {
            const currentSentTo = instance.sent_to || []
            const updatedSentTo = removeEmailFromSentTo(currentSentTo, collaborator.email)
            
            const updateResponse = await fetch(`${apiBase}/website/client/interface-instances/update-interface-instance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instance_uuid: currentInstanceUuid,
                instance_details: {
                  ...instance,
                  sent_to: updatedSentTo
                }
              }),
              credentials: 'include'
            })
            
            if (updateResponse.ok) {
              console.log(`✅ Removed ${collaborator.email} from interface instance sent_to list`)
            } else {
              const errorText = await updateResponse.text()
              console.error(`❌ Failed to update interface instance sent_to: ${updateResponse.status} - ${errorText}`)
            }
          }
        }
      } catch (sentToError) {
        // Don't fail the entire operation if sent_to update fails
        console.warn('⚠️ Failed to remove from sent_to list (non-critical):', sentToError)
      }
      
      // Reload collaborators list
      const apiBase = getApiBase()
      const instanceResponse = await fetch(`${apiBase}/website/client/interface-instances/get-interface-instance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_uuid: instanceUuid }),
        credentials: 'include'
      })
      
      if (instanceResponse.ok) {
        const instanceData = await instanceResponse.json()
        const sentToNormalized = normalizeSentTo(instanceData?.instance?.sent_to || [])
        const sentToEmails = extractEmailsFromSentTo(instanceData?.instance?.sent_to || [])
        
        // Build a map of email -> their role assignments
        const emailRoleMap = {}
        
        // Go through each questionnaire and extract roles
        for (const [saqType, meta] of Object.entries(questionnaireMeta)) {
          if (meta?.metadata?.document_uuid && meta?.questionnaireAnswerUuid) {
            const qResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questionnaire_answer_uuid: meta.questionnaireAnswerUuid }),
              credentials: 'include'
            })
            
            if (qResponse.ok) {
              const qData = await qResponse.json()
              const roles = qData?.questionnaire_answer?.metadata?.roles || []
              
              // Roles are in format [{email: role}, {email: role}, ...]
              roles.forEach(roleObj => {
                Object.entries(roleObj).forEach(([email, role]) => {
                  if (!emailRoleMap[email]) {
                    emailRoleMap[email] = []
                  }
                  emailRoleMap[email].push({
                    role,
                    saq: saqType,
                    questionnaireAnswerUuid: meta.questionnaireAnswerUuid
                  })
                })
              })
            }
          }
        }
        
        // Build collaborator list grouped by email
        const collaboratorsByEmail = {}
        sentToNormalized.forEach(item => {
          const email = item.email
          const roleAssignments = emailRoleMap[email] || []
          
          if (!collaboratorsByEmail[email]) {
            collaboratorsByEmail[email] = {
              email,
              name: item.name || email,
              roles: []
            }
          }
          
          if (roleAssignments.length > 0) {
            collaboratorsByEmail[email].roles.push(...roleAssignments)
          }
        })
        
        // Convert to array
        const collaboratorsList = Object.values(collaboratorsByEmail)
        setExistingCollaborators(collaboratorsList)
      }
    } catch (err) {
      console.error('❌ Error removing collaborator:', err)
      alert('Failed to remove collaborator: ' + err.message)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={handleClose}
      />
      
      {/* Modal Content */}
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        <div 
          className={`bg-white ${SaqFormTheme.borderRadius.lg} ${SaqFormTheme.shadows.xl} max-w-2xl w-full max-h-[90vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={`sticky top-0 bg-white px-6 py-6 flex items-center justify-between ${showAddForm ? '' : 'border-b border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">
                {showAddForm ? 'Add New Collaborator' : 'Manage Collaborators'}
              </h2>
              {!showAddForm && (
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowCollaboratorTooltip(true)}
                    onMouseLeave={() => setShowCollaboratorTooltip(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    type="button"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  {showCollaboratorTooltip && (
                    <div className={`absolute left-0 top-full mt-2 w-64 p-3 ${SaqFormTheme.colors.neutral[900]} text-white ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.shadows.lg} z-50`}>
                      <p className="mb-2">
                        <strong>Collaborators</strong> are team members who can view and work on your questionnaires.
                      </p>
                      <p>
                        To add a collaborator, click the <strong>"Add Collaborator"</strong> button below and enter their name and email address.
                      </p>
                      <div className={`absolute -top-1 left-4 w-2 h-2 ${SaqFormTheme.colors.neutral[900]} transform rotate-45`}></div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              type="button"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-6">
            {/* Success Message */}
            {successMessage && (
              <div className={`mb-6 ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.colors.success[50]} border ${SaqFormTheme.colors.success.border[200]} p-4 flex items-center gap-2 animate-fade-in`}>
                <svg className="h-5 w-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.success.text[800]} ${SaqFormTheme.typography.fontWeight.medium}`}>{successMessage}</p>
              </div>
            )}

            {/* Existing Collaborators List */}
            {!showAddForm && (
              <div>
                {isLoadingCollaborators ? (
                  <div className="flex items-center justify-center py-12 text-slate-500">
                    <svg className="animate-spin h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Loading collaborators...</span>
                  </div>
                ) : existingCollaborators.length === 0 ? (
                  <div className={`text-center py-12 px-4 ${SaqFormTheme.colors.neutral[50]} ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]}`}>
                    <svg className="h-12 w-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-sm text-slate-600">No collaborators added yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingCollaborators.map((collab) => {
                      const displayName = collab.name || collab.email
                      const displayInitial = displayName.charAt(0).toUpperCase()
                      const showEmail = collab.name && collab.name !== collab.email
                      
                      return (
                      <div
                        key={collab.email}
                        className={`flex items-center justify-between p-4 ${SaqFormTheme.colors.neutral[50]} ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]} hover:${SaqFormTheme.colors.neutral.border[300]} transition-colors`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`flex-shrink-0 h-10 w-10 ${SaqFormTheme.borderRadius.full} ${SaqFormTheme.colors.primary[100]} flex items-center justify-center`}>
                            <span className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.primary.text[700]} leading-none`}>
                              {displayInitial}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.neutral.text[900]} truncate leading-tight m-0`}>{displayName}</p>
                            {showEmail && (
                              <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[500]} truncate leading-tight m-0 mt-0.5`}>{collab.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button
                            onClick={() => handleEdit(collab)}
                            className={`${SaqFormTheme.colors.primary.text[600]} hover:${SaqFormTheme.colors.primary.text[700]} hover:${SaqFormTheme.colors.primary[50]} ${SaqFormTheme.borderRadius.sm} p-1.5 transition-colors`}
                            type="button"
                            title="Edit collaborator"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {collab.email !== currentUserEmail && (
                            <button
                              onClick={() => handleRemoveCollaborator(collab)}
                              className={`${SaqFormTheme.colors.error.text[500]} hover:${SaqFormTheme.colors.error.text[700]} hover:${SaqFormTheme.colors.error[50]} ${SaqFormTheme.borderRadius.sm} p-1.5 transition-colors`}
                              type="button"
                              title="Remove collaborator"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
                
                {/* Add Collaborator Button */}
                <div className="flex items-center justify-end mt-6">
                  <button
                    onClick={() => {
                      setShowAddForm(true)
                      setEditingCollaborator(null)
                      setName('')
                      setEmail('')
                      setSelectedRoleAssignments([])
                      setPendingQuestionAssignments({})
                    }}
                    className={`${getButtonClasses('primary', 'md', false)} whitespace-nowrap flex items-center gap-2 px-6`}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Collaborator
                  </button>
                </div>
              </div>
            )}

            {/* Add/Edit Collaborator Form */}
            {showAddForm && (
              <div>
                {/* Name Field */}
                <div className="mb-6">
                  <label htmlFor="collab-name" className="block text-sm font-medium text-cyan-900 mb-2">
                    Name
                  </label>
                  <input
                    id="collab-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className={`${getInputClasses(false, false)} w-full`}
                    disabled={isSharing}
                  />
                </div>
      
                {/* Email Field */}
                <div className="mb-6">
                  <label htmlFor="collab-email" className="block text-sm font-medium text-cyan-900 mb-2">
                    Email Address
                  </label>
                  <input
                    id="collab-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !editingCollaborator && name.trim() && email.trim() && !isSharing) {
                        handleAddCollaboratorWithoutRole()
                      }
                    }}
                    placeholder="user@example.com"
                    className={`${getInputClasses(false, false)} w-full`}
                    disabled={isSharing || !!editingCollaborator || selectedRoleAssignments.length > 0}
                  />
                </div>

                {/* Assign Questions Button */}
                <div className="mb-6">
                  {(() => {
                    // Calculate total pending question assignments count
                    const totalPendingCount = Object.values(pendingQuestionAssignments).reduce(
                      (sum, questionIds) => sum + (Array.isArray(questionIds) ? questionIds.length : 0),
                      0
                    )
                    
                    return (
                      <button
                        onClick={() => {
                          // Store the collaborator we're assigning questions to
                          setAssigningToCollaborator({
                            email: email.trim(),
                            name: name.trim() || email.trim(),
                            roleAssignments: selectedRoleAssignments
                          })
                          setError('') // Clear any previous errors
                          setShowAssignQuestionsModal(true)
                        }}
                        type="button"
                        className={`w-full px-4 py-2.5 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.primary.text[700]} bg-white border ${SaqFormTheme.colors.primary.border[300]} ${SaqFormTheme.borderRadius.md} hover:${SaqFormTheme.colors.primary[50]} transition-colors`}
                      >
                        Assign Questions{totalPendingCount > 0 && ` (${totalPendingCount})`}
                      </button>
                    )
                  })()}
                </div>

                {/* Selected Role Assignments */}
                {selectedRoleAssignments.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-cyan-900 mb-2">
                      Role Assignments
                    </label>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      {selectedRoleAssignments.map((assignment, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 border border-cyan-200 rounded-lg text-xs"
                        >
                          <span className="font-medium text-cyan-700">{assignment.saq}</span>
                          <span className="text-cyan-600">•</span>
                          <span className="text-slate-700">{getRoleDisplayName(assignment.role)}</span>
                          <button
                            onClick={() => handleRemoveRoleAssignment(index)}
                            className={`ml-1 ${SaqFormTheme.colors.error.text[500]} hover:${SaqFormTheme.colors.error.text[700]} hover:${SaqFormTheme.colors.error[100]} ${SaqFormTheme.borderRadius.sm} p-0.5 transition-colors`}
                            type="button"
                            title="Remove this role assignment"
                            disabled={isSharing}
                          >
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-6 mb-0">
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span>{error}</span>
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setEditingCollaborator(null)
                      setName('')
                      setEmail('')
                      setSelectedRoleAssignments([])
                      setError('')
                    }}
                    type="button"
                    className={`px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.neutral.text[700]} bg-white border ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.borderRadius.md} hover:${SaqFormTheme.colors.neutral[50]} transition-colors flex items-center gap-2`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={handleAddCollaboratorWithoutRole}
                    type="button"
                    disabled={!name.trim() || !email.trim() || isSharing}
                    className={`${getButtonClasses('primary', 'md', false)} flex items-center gap-2`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Questions Modal */}
      {showAssignQuestionsModal && (
        <>
          {/* Modal Backdrop */}
          <div 
            className="fixed inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 60 }}
            onClick={() => {
              setShowAssignQuestionsModal(false)
              setSelectedQuestionnaire(null)
              setSelectedSection(null)
              setQuestionnaireQuestions([])
              setQuestionnaireResponses({})
              setSelectedQuestionIdsBySection({})
              setLastClickedQuestionId(null)
              setAssigningToCollaborator(null)
              setError('') // Clear errors when closing modal
            }}
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4" style={{ zIndex: 70 }}>
            <div 
              className={`bg-white ${SaqFormTheme.borderRadius.lg} ${SaqFormTheme.shadows.xl} max-w-5xl w-full max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-6 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Assign Questions
                </h2>
                <button
                  onClick={() => {
                    setShowAssignQuestionsModal(false)
                    setSelectedQuestionnaire(null)
                    setSelectedSection(null)
                    setQuestionnaireQuestions([])
                    setQuestionnaireResponses({})
                    setSelectedQuestionIdsBySection({})
                    setLastClickedQuestionId(null)
                    setAssigningToCollaborator(null)
                    setError('') // Clear errors when closing modal
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  type="button"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6">
                {/* Error Message */}
                {error && (
                  <div className={`mb-4 p-3 ${SaqFormTheme.colors.error[50]} border ${SaqFormTheme.colors.error.border[200]} ${SaqFormTheme.borderRadius.md}`}>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                <div className="flex gap-6 h-[calc(90vh-180px)]">
                  {/* Left Column - 35% */}
                  <div className="w-[35%] border-r border-slate-200 pr-6 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Questionnaires</h3>
                    {availableSAQs.length === 0 ? (
                      <p className="text-sm text-slate-500">No questionnaires available</p>
                    ) : (
                      <div className="space-y-2">
                        {availableSAQs.map((saq) => {
                          const isSelected = selectedQuestionnaire?.value === saq.value
                          return (
                            <div key={saq.value}>
                              <button
                                onClick={() => loadQuestionnaireQuestions(saq)}
                                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                                  isSelected
                                    ? `${SaqFormTheme.colors.primary[50]} ${SaqFormTheme.colors.primary.border[300]} ${SaqFormTheme.colors.primary.text[900]}`
                                    : `bg-white ${SaqFormTheme.colors.neutral.border[200]} hover:${SaqFormTheme.colors.neutral[50]} ${SaqFormTheme.colors.neutral.text[700]}`
                                }`}
                                type="button"
                              >
                                <span className="text-sm font-medium">{saq.label}</span>
                              </button>
                              
                              {/* Sections - Show when questionnaire is selected */}
                              {isSelected && !isLoadingQuestions && (
                                <div className="mt-2 ml-4 space-y-1">
                                  {getSections().map((section) => (
                                    <button
                                      key={section.key}
                                      onClick={() => {
                                        setSelectedSection(section.key)
                                        setLastClickedQuestionId(null) // Reset when changing sections
                                      }}
                                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                        selectedSection === section.key
                                          ? `${SaqFormTheme.colors.primary[100]} ${SaqFormTheme.colors.primary.text[900]} ${SaqFormTheme.typography.fontWeight.medium}`
                                          : `${SaqFormTheme.colors.neutral.text[600]} hover:${SaqFormTheme.colors.neutral[50]}`
                                      }`}
                                      type="button"
                                    >
                                      {section.label}: {section.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              {isSelected && isLoadingQuestions && (
                                <div className="mt-2 ml-4 text-xs text-slate-500">Loading...</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  {/* Right Column - 65% */}
                  <div className="flex-1 flex flex-col">
                    {!selectedQuestionnaire ? (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <p className="text-sm">Select a questionnaire to view sections</p>
                      </div>
                    ) : !selectedSection ? (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <p className="text-sm">Select a section to view questions</p>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        {(() => {
                          const sections = getSections()
                          const section = sections.find(s => s.key === selectedSection)
                          if (!section || !section.group?.filteredQuestions) {
                            return (
                              <div className="flex items-center justify-center h-full text-slate-400">
                                <p className="text-sm">No questions available for this section</p>
                              </div>
                            )
                          }
                          
                          // Get selected question IDs for this section (persist across section changes)
                          const sectionKey = `${selectedQuestionnaire?.value}-${section.key}`
                          const selectedQuestionIds = selectedQuestionIdsBySection[sectionKey] || new Set()
                          
                          // Calculate total selected questions across ALL questionnaires and sections
                          const allSelectedQuestions = []
                          Object.entries(selectedQuestionIdsBySection).forEach(([key, questionIds]) => {
                            allSelectedQuestions.push(...Array.from(questionIds))
                          })
                          const hasAnySelectedQuestions = allSelectedQuestions.length > 0
                          
                          // Also calculate for current questionnaire for display
                          const allSelectedForQuestionnaire = []
                          if (selectedQuestionnaire) {
                            Object.entries(selectedQuestionIdsBySection).forEach(([key, questionIds]) => {
                              if (key.startsWith(`${selectedQuestionnaire.value}-`)) {
                                allSelectedForQuestionnaire.push(...Array.from(questionIds))
                              }
                            })
                          }
                          
                          const handleQuestionClick = (question) => {
                            // Update the last clicked question for preview
                            setLastClickedQuestionId(question.id)
                            
                            // Toggle selection - if clicking the same question, deselect it
                            setSelectedQuestionIdsBySection(prev => {
                              const currentSet = prev[sectionKey] || new Set()
                              const newSet = new Set(currentSet)
                              if (newSet.has(question.id)) {
                                newSet.delete(question.id)
                              } else {
                                newSet.add(question.id)
                              }
                              return {
                                ...prev,
                                [sectionKey]: newSet
                              }
                            })
                          }
                          
                          // Determine which question to show in preview:
                          // 1. If a question was clicked and it's in the current section, show that one
                          // 2. Otherwise, show the first question that needs attention
                          let previewQuestion = null
                          
                          if (lastClickedQuestionId) {
                            // Try to find the clicked question in the current section
                            previewQuestion = section.group.filteredQuestions.find(q => q.id === lastClickedQuestionId)
                          }
                          
                          // If no clicked question or clicked question not in current section, find first question needing attention
                          if (!previewQuestion) {
                            previewQuestion = section.group.filteredQuestions.find((question) => {
                              const response = questionnaireResponses[question.id]
                              const answerStatus = response?.answerStatus
                              const tempStatus = response?.metadata?.temp_status
                              
                              // Check if question is unanswered
                              if (!response || response.value === null || response.value === undefined) {
                                return true
                              }
                              
                              // Check if question needs attention (invalid or requires further details)
                              if (answerStatus === 'requires_further_details' || answerStatus === 'invalid') {
                                return true
                              }
                              
                              return false
                            })
                          }
                          
                          const questionNeedingAttention = previewQuestion
                          
                          return (
                            <div className="flex flex-col h-full">
                              {/* Select Questions Section */}
                              <div className="mb-3">
                                <h3 className="text-sm font-semibold text-slate-900">Select Questions</h3>
                              </div>
                              
                              {/* Question Heatmap */}
                              <div className="mb-4 flex-shrink-0">
                                <QuestionHeatmap
                                  questions={section.group.filteredQuestions}
                                  responses={questionnaireResponses}
                                  selectedQuestionIds={selectedQuestionIds}
                                  onQuestionClick={handleQuestionClick}
                                  sectionTitle={`${section.label}: ${section.name}`}
                                  isOpen={true}
                                  sectionKey={section.key}
                                  minimal={true}
                                />
                              </div>
                              
                              {/* Question Preview - takes up remaining space */}
                              {questionNeedingAttention ? (
                                <div className={`flex-1 flex flex-col overflow-hidden bg-white ${SaqFormTheme.borderRadius.lg} border ${SaqFormTheme.colors.neutral.border[200]} ${SaqFormTheme.shadows.sm}`}>
                                  {/* Preview Header */}
                                  <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2">
                                    <h3 className="text-sm font-semibold text-slate-900">Question Preview</h3>
                                  </div>
                                  
                                  {/* Preview Body */}
                                  <div className="flex-1 overflow-y-auto px-4 py-4">
                                      {/* Section Context */}
                                      {(() => {
                                        const sectionTitle = questionNeedingAttention.sectionTitle || 
                                                           questionNeedingAttention.properties?.heading ||
                                                           questionNeedingAttention.rawProperties?.heading
                                        const sectionSubheading = questionNeedingAttention.sectionSubheading ||
                                                                 questionNeedingAttention.properties?.subheading ||
                                                                 questionNeedingAttention.rawProperties?.subheading
                                        const sectionSubsubheading = questionNeedingAttention.sectionSubsubheading ||
                                                                    questionNeedingAttention.properties?.subsubheading ||
                                                                    questionNeedingAttention.rawProperties?.subsubheading
                                        
                                        return (sectionTitle || sectionSubheading || sectionSubsubheading) ? (
                                          <div className="text-xs text-slate-600 mb-2">
                                            {sectionTitle && (
                                              <span className="font-semibold">{sectionTitle}</span>
                                            )}
                                            {sectionSubheading && (
                                              <span className="ml-1">› {sectionSubheading}</span>
                                            )}
                                            {sectionSubsubheading && (
                                              <span className="ml-1">›› {sectionSubsubheading}</span>
                                            )}
                                          </div>
                                        ) : null
                                      })()}
                                      
                                      {/* Question Number */}
                                      {(() => {
                                        const questionNumber = questionNeedingAttention.questionNumber ||
                                                              questionNeedingAttention.properties?.number ||
                                                              questionNeedingAttention.rawProperties?.number
                                        return questionNumber ? (
                                          <div className="mb-2">
                                            <span className="text-sm font-semibold text-slate-700">Question {questionNumber}</span>
                                          </div>
                                        ) : null
                                      })()}
                                      
                                      {/* Question Text */}
                                      <div className="mb-3">
                                        <p className="text-base font-semibold text-slate-900 leading-relaxed whitespace-pre-line">
                                          {questionNeedingAttention.questionText || 
                                           questionNeedingAttention.question_text || 
                                           questionNeedingAttention.properties?.question_text || 
                                           questionNeedingAttention.rawProperties?.question_text || 
                                           questionNeedingAttention.id}
                                        </p>
                                        {(questionNeedingAttention.description || 
                                          questionNeedingAttention.properties?.description ||
                                          questionNeedingAttention.rawProperties?.description) && (
                                          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                                            {questionNeedingAttention.description || 
                                             questionNeedingAttention.properties?.description ||
                                             questionNeedingAttention.rawProperties?.description}
                                          </p>
                                        )}
                                        {(questionNeedingAttention.help_text || 
                                          questionNeedingAttention.properties?.help_text ||
                                          questionNeedingAttention.rawProperties?.help_text) && (
                                          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed italic">
                                            {questionNeedingAttention.help_text || 
                                             questionNeedingAttention.properties?.help_text ||
                                             questionNeedingAttention.rawProperties?.help_text}
                                          </p>
                                        )}
                                      </div>
                                      
                                      {/* Expected Testing - for Section 2 */}
                                      {section.key === 'section2' && (() => {
                                        const expectedTesting = questionNeedingAttention.expectedTesting || 
                                                               questionNeedingAttention.expected_testing ||
                                                               questionNeedingAttention.properties?.expected_testing ||
                                                               questionNeedingAttention.rawProperties?.expected_testing
                                        return expectedTesting && Array.isArray(expectedTesting) && expectedTesting.length > 0 ? (
                                          <div className={`${SaqFormTheme.borderRadius.md} border-l-4 ${SaqFormTheme.colors.primary.border[500]} ${SaqFormTheme.colors.primary[50]} p-3 mt-3`}>
                                            <div className="flex items-start gap-2">
                                              <svg className="h-5 w-5 text-cyan-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              <div className="flex-1">
                                                <p className="text-sm font-bold text-cyan-900 mb-1.5">Expected Testing Procedures</p>
                                                <ul className="space-y-1 text-sm text-cyan-800">
                                                  {expectedTesting.map((test, index) => (
                                                    <li key={index} className="flex items-start gap-2">
                                                      <span className="text-cyan-600 font-bold mt-0.5">•</span>
                                                      <span className="flex-1">{test}</span>
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            </div>
                                          </div>
                                        ) : null
                                      })()}
                                      
                                      {/* Applicability Notes intentionally hidden in preview */}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-400">
                                  <p className="text-sm">No questions need attention</p>
                                </div>
                              )}
                              
                              <div className="mt-4 flex justify-end flex-shrink-0">
                                <button
                                  onClick={async () => {
                                    if (!assigningToCollaborator) {
                                      setError('Missing collaborator context')
                                      return
                                    }
                                    
                                    // Group selected questions by questionnaire (SAQ type)
                                    // sectionKey format: `${saqType}-${section.key}` (e.g., "SAQ A-section1", "SAQ C-VT-section2")
                                    const questionsByQuestionnaire = {}
                                    
                                    Object.entries(selectedQuestionIdsBySection).forEach(([sectionKey, questionIds]) => {
                                      // Find which SAQ type this sectionKey belongs to
                                      // We need to match against availableSAQs because SAQ types can contain hyphens (e.g., "SAQ C-VT")
                                      const matchingSAQ = availableSAQs.find(saq => {
                                        // Check if sectionKey starts with the SAQ type followed by a hyphen
                                        return sectionKey.startsWith(`${saq.value}-`)
                                      })
                                      
                                      if (matchingSAQ) {
                                        const saqType = matchingSAQ.value
                                        if (!questionsByQuestionnaire[saqType]) {
                                          questionsByQuestionnaire[saqType] = []
                                        }
                                        questionsByQuestionnaire[saqType].push(...Array.from(questionIds))
                                      }
                                    })
                                    
                                    // Filter out questionnaires with no selected questions
                                    const questionnairesWithQuestions = Object.entries(questionsByQuestionnaire)
                                      .filter(([_, questionIds]) => questionIds.length > 0)
                                    
                                    if (questionnairesWithQuestions.length === 0) {
                                      setError('Please select at least one question to assign')
                                      return
                                    }
                                    
                                    // Store question assignments locally (not saved to API until Send is clicked)
                                    const updatedPendingAssignments = { ...pendingQuestionAssignments }
                                    
                                    for (const [saqType, questionIds] of questionnairesWithQuestions) {
                                      // Find the questionnaire in availableSAQs to get questionnaireAnswerUuid
                                      const questionnaire = availableSAQs.find(saq => saq.value === saqType)
                                      
                                      if (!questionnaire?.questionnaireAnswerUuid) {
                                        console.warn(`⚠️ Questionnaire not found for ${saqType}, skipping`)
                                        continue
                                      }
                                      
                                      // Store assignments locally by questionnaireAnswerUuid
                                      updatedPendingAssignments[questionnaire.questionnaireAnswerUuid] = questionIds
                                    }
                                    
                                    // Update pending assignments state
                                    setPendingQuestionAssignments(updatedPendingAssignments)
                                    
                                    // Close modal and reset selection (but keep pending assignments)
                                    setShowAssignQuestionsModal(false)
                                    setSelectedQuestionnaire(null)
                                    setSelectedSection(null)
                                    setQuestionnaireQuestions([])
                                    setQuestionnaireResponses({})
                                    setSelectedQuestionIdsBySection({})
                                    setLastClickedQuestionId(null)
                                    setAssigningToCollaborator(null)
                                    setError('')
                                  }}
                                  disabled={!hasAnySelectedQuestions || !assigningToCollaborator}
                                  className={`${getButtonClasses('primary', 'lg', false)} flex items-center gap-2 whitespace-nowrap`}
                                  type="button"
                                >
                                  Assign {hasAnySelectedQuestions && `(${allSelectedQuestions.length})`}
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
