/**
 * SAQ Form Data Service
 * Handles saving/loading SAQ data and template processing
 */

// Re-export conditional logic for easy access
export { filterQuestionsByDependency } from './SaqConditionalLogic'

// Import environment-specific configuration
import { 
  getApiBase,
  SUPPORTED_SAQ_SHORTNAMES,
  FALLBACK_SAQ_INTERFACE_INSTANCE_UUIDS,
  DEFAULT_INTERFACE_INSTANCE_UUID,
  getCognitoUserPoolId,
  getFallbackClientUuid,
  getClientName
} from './ENV_Specific/SaqFormConfig'

// Cache for instance UUID retrieved from token
let cachedInstanceUuid = null

/**
 * Normalize sent_to to always return array of objects with email property
 * Handles both old format (array of strings) and new format (array of objects)
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @returns {Array<{email: string, name?: string}>} - Normalized array
 */
export const normalizeSentTo = (sentTo) => {
  if (!Array.isArray(sentTo)) return []
  
  return sentTo.map(item => {
    if (typeof item === 'string') {
      // Old format: just email string
      return { email: item }
    } else if (item && typeof item === 'object' && item.email) {
      // New format: object with email (and optionally name)
      return { email: item.email, ...(item.name && { name: item.name }) }
    }
    return null
  }).filter(Boolean)
}

/**
 * Extract email addresses from sent_to array
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @returns {Array<string>} - Array of email addresses
 */
export const extractEmailsFromSentTo = (sentTo) => {
  return normalizeSentTo(sentTo).map(item => item.email)
}

/**
 * Check if an email exists in sent_to array
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @param {string} email - Email to check for
 * @returns {boolean} - True if email exists
 */
export const emailExistsInSentTo = (sentTo, email) => {
  const emails = extractEmailsFromSentTo(sentTo)
  return emails.includes(email)
}

/**
 * Add an email to sent_to array (returns new format)
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @param {string} email - Email to add
 * @param {string} [name] - Optional name
 * @returns {Array<{email: string, name?: string}>} - Updated array in new format
 */
export const addEmailToSentTo = (sentTo, email, name = null) => {
  const normalized = normalizeSentTo(sentTo)
  const emails = normalized.map(item => item.email)
  
  if (!emails.includes(email)) {
    // Add name if it's a non-empty string
    const nameValue = (name && typeof name === 'string' && name.trim()) ? name.trim() : null
    return [...normalized, { email, ...(nameValue && { name: nameValue }) }]
  }
  return normalized
}

/**
 * Remove an email from sent_to array (returns new format)
 * @param {Array<string|Object>} sentTo - The sent_to array (old or new format)
 * @param {string} email - Email to remove
 * @returns {Array<{email: string, name?: string}>} - Updated array in new format
 */
export const removeEmailFromSentTo = (sentTo, email) => {
  const normalized = normalizeSentTo(sentTo)
  return normalized.filter(item => item.email !== email)
}

/**
 * Get the correct SAQ interface instance UUID based on hostname
 * @returns {string} - The interface instance UUID for the current environment
 */
const getSAQInterfaceInstanceUUID = () => {
  if (typeof window === 'undefined') return DEFAULT_INTERFACE_INSTANCE_UUID

  const hostname = window.location.hostname || ''
  const match = hostname.match(/^(?:interface\.)?([^.]+)\.platform\.anqa\.ai$/)
  const clientName = match ? match[1] : null

  if (clientName && FALLBACK_SAQ_INTERFACE_INSTANCE_UUIDS[clientName]) {
    return FALLBACK_SAQ_INTERFACE_INSTANCE_UUIDS[clientName]
  }

  console.warn(`Unknown client host ${hostname}, defaulting SAQ interface instance UUID`)
  return DEFAULT_INTERFACE_INSTANCE_UUID
}

/**
 * Extract instance UUID or token from current URL
 * Supports two patterns:
 * - /i/{uuid} - Direct instance UUID
 * - /e/{token} - External token (requires API call to resolve)
 * @param {string} overrideInstanceUuid - Optional instance UUID to use instead of URL parsing
 * @returns {Promise<string>} - The instance UUID
 */
export const getInstanceUuid = async (overrideInstanceUuid = null) => {
  // Use override if provided
  if (overrideInstanceUuid) {
    console.log('📍 Using override instance UUID:', overrideInstanceUuid)
    // Don't cache the override - let each call use its own override or fallback
    return overrideInstanceUuid
  }
  
  // Return cached value if available
  if (cachedInstanceUuid) {
    console.log('📦 Using cached instance UUID:', cachedInstanceUuid)
    return cachedInstanceUuid
  }

  const path = window.location.pathname
  
  // Pattern 1: /i/{uuid} - Direct instance UUID
  if (path.startsWith('/i/')) {
    cachedInstanceUuid = path.split('/i/')[1]
    console.log('📍 Instance UUID from URL (/i/):', cachedInstanceUuid)
    return cachedInstanceUuid
  }
  
  // Pattern 2: /e/{token} - External token (format: {client_uuid}.{access_token})
  if (path.startsWith('/e/')) {
    const token = path.split('/e/')[1]
    console.log('🔑 Token from URL (/e/):', token)
    
    // Validate token format: uuid.base64-like-string
    const tokenPattern = /^[a-f0-9-]{36}\.[a-zA-Z0-9_-]+$/i
    if (!tokenPattern.test(token)) {
      console.error('❌ Invalid token format:', token)
      // console.log('Expected format: {client_uuid}.{access_token}')
      // Fall through to use fallback UUID
    } else {
      try {
        const response = await postJSON('/website/client/interface-instances/get-interface-instance-by-token', {
          token
        })
        
        if (response?.instance?.instance_uuid) {
          cachedInstanceUuid = response.instance.instance_uuid
          console.log('✅ Retrieved instance UUID from token:', cachedInstanceUuid)
          return cachedInstanceUuid
        } else {
          console.warn('⚠️ Token response missing instance_uuid, using fallback')
        }
      } catch (error) {
        console.error('❌ Failed to get instance by token:', error)
        console.log('🔄 Falling back to client-specific instance UUID')
      }
    }
  }
  
  // Fallback: Use client-specific instance UUID based on hostname
  cachedInstanceUuid = getSAQInterfaceInstanceUUID()
  console.log('🔧 Using fallback instance UUID:', cachedInstanceUuid)
  return cachedInstanceUuid
}

// Cache for user info to avoid repeated API calls
let userInfoCache = null;
let userInfoCachePromise = null;

/**
 * Decode JWT token - fetches from API endpoint since cookies are HttpOnly
 * @returns {Promise<Object|null>} - Decoded JWT payload or null
 */
export const decodeJWTFromCookie = async () => {
  if (typeof document === 'undefined') return null // Server-side
  
  // Return cached value if available
  if (userInfoCache) {
    return userInfoCache;
  }
  
  // If a request is already in progress, return that promise
  if (userInfoCachePromise) {
    return userInfoCachePromise;
  }
  
  // Fetch user info from API endpoint (proxy forwards JWT automatically)
  const apiBase = getApiBase()
  userInfoCachePromise = fetch(`${apiBase}/user-data/user-info`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(async (response) => {
      if (!response.ok) {
        console.warn('⚠️ Failed to fetch user info:', response.status);
        return null;
      }
      
      const data = await response.json();
      
      // The API returns { status: "success", user_attributes: {...}, jwt_payload: {...} }
      if (data.status === 'success' && data.jwt_payload) {
        userInfoCache = data.jwt_payload;
        return data.jwt_payload;
      }
      
      // Fallback: try user_attributes if jwt_payload not available
      if (data.status === 'success' && data.user_attributes) {
        userInfoCache = data.user_attributes;
        return data.user_attributes;
      }
      
      return null;
    })
    .catch((error) => {
      console.error('❌ Failed to fetch user info:', error);
      return null;
    })
    .finally(() => {
      // Clear the promise so we can retry if needed
      userInfoCachePromise = null;
    });
  
  return userInfoCachePromise;
}

const postJSON = async (path, payload) => {
  const apiBase = getApiBase()
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include' // Include cookies for JWT auth
  })

  if (!response.ok) {
    const message = await response.text()
    
    // Provide clear error messages for common issues
    let errorMessage = `Request to ${path} failed (${response.status}): ${message || 'Unknown error'}`
    
    if (response.status === 401) {
      errorMessage += '\n\n💡 Authentication failed. Please refresh the page to re-authenticate.'
      if (window.location.pathname.startsWith('/i/')) {
        errorMessage += '\n🔒 Workflow users: Ensure you are logged in via ALB authentication.'
      } else if (window.location.pathname.startsWith('/e/')) {
        errorMessage += '\n🔓 External users: Your session may have expired. Please check your email for a new access link.'
      }
    } else if (response.status === 403) {
      errorMessage += '\n\n💡 Access denied. You may not have permission to access this resource.'
    } else if (response.status >= 500) {
      errorMessage += '\n\n💡 Server error. Please try again in a moment.'
    }
    
    throw new Error(errorMessage)
  }

  return response.json()
}

/**
 * Fetch third party details by UUID
 * @param {string} thirdPartyUuid - Third party UUID from linked_entities
 * @returns {Promise<Object|null>} - Third party object with name field, or null if not found
 */
const fetchThirdParty = async (thirdPartyUuid) => {
  if (!thirdPartyUuid) {
    return null
  }

  try {
    console.log(`🏢 Fetching third party: ${thirdPartyUuid}`)
    const response = await postJSON('/third-parties/get-third-party', {
      third_party_uuid: thirdPartyUuid
    })
    console.log(`✅ Third party fetched: ${response?.name || 'Unknown'}`)
    return response
  } catch (error) {
    console.error(`❌ Failed to fetch third party ${thirdPartyUuid}:`, error)
    return null
  }
}

/**
 * Extract third party UUID from instance linked_entities
 * @param {Object} instance - Interface instance object
 * @returns {string|null} - Third party UUID or null
 */
const extractThirdPartyUuid = (instance) => {
  if (!instance?.linked_entities || !Array.isArray(instance.linked_entities)) {
    return null
  }
  
  const thirdPartyEntity = instance.linked_entities.find(
    entity => entity.entity_type === 'third_party'
  )
  
  return thirdPartyEntity?.entity_uuid || null
}

/**
 * Update interface instance metadata when toggling SAQ selection
 * @param {string} instanceUuid - Interface instance UUID (or null to use URL/fallback)
 * @param {string} saqType - SAQ type (e.g., 'SAQ A', 'SAQ C-VT', 'SAQ D')
 * @param {boolean} isSelected - Whether SAQ is being selected (true) or deselected (false)
 * @param {Object} questionnaireMeta - Metadata mapping SAQ types to questionnaire details
 * @returns {Promise<Object>} - Updated instance
 */
export const updateSAQSelectionInInstance = async (instanceUuid, saqType, isSelected, questionnaireMeta) => {
  // Resolve instance UUID if not provided
  const resolvedInstanceUuid = instanceUuid || await getInstanceUuid()
  
  if (!resolvedInstanceUuid || !saqType) {
    throw new Error('Instance UUID and SAQ type are required')
  }

  try {
    // Get current interface instance
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    // Get questionnaire info for this SAQ type
    const questionnaireInfo = questionnaireMeta[saqType]
    if (!questionnaireInfo) {
      throw new Error(`No questionnaire metadata found for ${saqType}`)
    }

    const questionnaireAnswerUuid = questionnaireInfo.questionnaireAnswerUuid
    const templateUuid = questionnaireInfo.templateUuid

    // Update metadata.questionnaires array
    const currentMetadata = instance.metadata || {}
    let questionnaires = currentMetadata.questionnaires || []

    // Case 1: SAQ already exists in metadata (has questionnaireAnswerUuid)
    if (questionnaireAnswerUuid) {
      questionnaires = questionnaires.map(q => {
        if (q.questionnaire_answer_uuid === questionnaireAnswerUuid) {
          if (isSelected) {
            // Remove the status field when re-selecting
            // eslint-disable-next-line no-unused-vars
            const { status, ...rest } = q
            return rest
          } else {
            // Add status: "removed" when deselecting
            return { ...q, status: 'removed' }
          }
        }
        return q
      })
    } 
    // Case 2: New SAQ being selected (no questionnaireAnswerUuid yet)
    else if (isSelected) {
      // Check if an entry already exists for this template UUID
      const existingIndex = questionnaires.findIndex(
        q => q.questionnaire_template_uuid === templateUuid
      )
      
      if (existingIndex >= 0) {
        // Entry exists, just remove "removed" status if present
        const existing = questionnaires[existingIndex]
        // eslint-disable-next-line no-unused-vars
        const { status, ...rest } = existing
        questionnaires[existingIndex] = rest
        console.log(`ℹ️ Restored existing entry for ${saqType} (removed "removed" status)`)
      } else {
        // Add new placeholder entry to metadata (without questionnaire_answer_uuid for now)
        console.log(`ℹ️ New SAQ ${saqType} being selected - template UUID: ${templateUuid}`)
        console.log(`⚠️ Questionnaire-answer record doesn't exist yet. Will be created on confirm.`)
        
        questionnaires.push({
          questionnaire_template_uuid: templateUuid
          // questionnaire_answer_uuid will be added when created
          // Do NOT include saq_type, name, description - those come from template
        })
      }
    } else {
      // Trying to deselect a SAQ that was never selected - no-op
      console.log(`ℹ️ Cannot deselect ${saqType} - it was never selected (no questionnaire_answer_uuid)`)
      return instance
    }

    // Update interface instance metadata
    const updateResponse = await postJSON('/website/client/interface-instances/update-interface-instance', {
      instance_uuid: resolvedInstanceUuid,
      instance_details: {
        metadata: {
          ...currentMetadata,
          questionnaires
        }
      }
    })

    console.log(`✅ Updated ${saqType} selection in interface instance: ${isSelected ? 'selected' : 'removed'}`)
    return updateResponse?.instance
  } catch (error) {
    console.error(`❌ Failed to update SAQ selection for ${saqType}:`, error)
    throw error
  }
}

/**
 * Create questionnaire-answer records for newly selected SAQs
 * Only creates new records for SAQs that don't have a questionnaire_answer_uuid yet.
 * SAQs with existing questionnaire-answer records (even if marked "removed") are skipped.
 * @param {string} instanceUuid - Interface instance UUID (or null to use URL/fallback)
 * @param {Array<string>} selectedSAQs - Array of selected SAQ shortNames (e.g., ['SAQ A', 'SAQ D'])
 * @param {Object} questionnaireMeta - Questionnaire metadata map
 * @returns {Promise<Object>} - Map of created questionnaire-answer UUIDs by SAQ type
 */
export const createQuestionnaireAnswersForNewSAQs = async (instanceUuid, selectedSAQs, questionnaireMeta) => {
  // Resolve instance UUID if not provided
  const resolvedInstanceUuid = instanceUuid || await getInstanceUuid()
  
  if (!resolvedInstanceUuid || !selectedSAQs || selectedSAQs.length === 0) {
    console.log('ℹ️ No SAQs to create questionnaire-answers for')
    return {}
  }

  // Also need to check interface instance metadata for SAQs marked as "removed"
  // They still have questionnaire_answer_uuid, just with status: "removed"
  const instance = await loadInterfaceInstance(resolvedInstanceUuid)
  const existingQuestionnaires = instance?.metadata?.questionnaires || []
  
  // Build a map of existing questionnaire-answer UUIDs (including removed ones)
  const existingQuestionnaireMap = {}
  existingQuestionnaires.forEach(q => {
    if (q.questionnaire_answer_uuid && q.questionnaire_template_uuid) {
      existingQuestionnaireMap[q.questionnaire_template_uuid] = q.questionnaire_answer_uuid
    }
  })

  const createdAnswers = {}
  const creationPromises = []

  for (const saqType of selectedSAQs) {
    const meta = questionnaireMeta[saqType]
    if (!meta) {
      console.warn(`⚠️ No metadata found for ${saqType}`)
      continue
    }

    // Skip if questionnaire-answer already exists in metadata
    if (meta.questionnaireAnswerUuid) {
      console.log(`ℹ️ ${saqType} already has questionnaire-answer: ${meta.questionnaireAnswerUuid}`)
      continue
    }

    // Also check if it exists in interface instance metadata (might be marked "removed")
    const existingAnswerUuid = existingQuestionnaireMap[meta.templateUuid]
    if (existingAnswerUuid) {
      console.log(`ℹ️ ${saqType} already has questionnaire-answer (marked as removed): ${existingAnswerUuid}`)
      console.log(`   Will be restored by updateSAQSelectionInInstance, not creating a new one`)
      continue
    }

    // Create questionnaire-answer for truly new SAQ
    console.log(`📝 Creating questionnaire-answer for new SAQ: ${saqType}`)
    
    // Get user info from JWT token
    const jwtPayload = await decodeJWTFromCookie()
    const userEmail = jwtPayload?.email || 'test@anqa.ai'
    const thirdPartyUuid = jwtPayload?.['custom:third_party_uuid'] || 'a65a55a0-5eb8-47fc-8636-ee1148070cb7' // Dummy UUID for testing
    
    console.log(`📧 User email: ${userEmail}`)
    console.log(`🆔 Third party UUID: ${thirdPartyUuid}`)

    const payload = {
      questionnaire_answer_details: {
        remote_template_uuid: meta.templateUuid,
        entity_type: 'third_party',
        entity_uuid: thirdPartyUuid,
        status: 'draft',
        priority: 'medium',
        created_by: {
          email: userEmail,
          timestamp: new Date().toISOString()
        },
        metadata: {
          interface_instance_uuid: resolvedInstanceUuid,
          saq_type: saqType,
          name: meta.name
        }
      }
    }

    const promise = postJSON('/questionnaire-answers/add-questionnaire-answer', payload)
      .then((response) => {
        const questionnaireAnswerUuid = response?.questionnaire_answer?.questionnaire_answer_uuid
        if (questionnaireAnswerUuid) {
          createdAnswers[saqType] = {
            questionnaireAnswerUuid,
            templateUuid: meta.templateUuid,
            name: meta.name,
            description: meta.description
          }
          console.log(`✅ Created questionnaire-answer for ${saqType}: ${questionnaireAnswerUuid}`)
        }
        return response
      })
      .catch((error) => {
        console.error(`❌ Failed to create questionnaire-answer for ${saqType}:`, error)
        throw error
      })

    creationPromises.push(promise)
  }

  // Wait for all creations to complete
  await Promise.all(creationPromises)

  console.log(`✅ Created ${Object.keys(createdAnswers).length} new questionnaire-answer record(s)`)

  // Update interface instance metadata with new questionnaire_answer_uuids
  if (Object.keys(createdAnswers).length > 0) {
    try {
      console.log('🔄 Updating interface instance metadata with new questionnaire-answer UUIDs...')
      
      // Get current interface instance
      const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
        instance_uuid: resolvedInstanceUuid
      })

      const instance = response?.instance
      if (!instance) {
        throw new Error('Interface instance not found')
      }

      const currentMetadata = instance.metadata || {}
      let questionnaires = currentMetadata.questionnaires || []

      // Update or add questionnaire entries with new questionnaire_answer_uuids
      for (const [_saqType, info] of Object.entries(createdAnswers)) {
        // Find existing entry by template_uuid
        const existingIndex = questionnaires.findIndex(
          q => q.questionnaire_template_uuid === info.templateUuid
        )

        if (existingIndex >= 0) {
          // Update existing entry with questionnaire_answer_uuid only
          questionnaires[existingIndex] = {
            ...questionnaires[existingIndex],
            questionnaire_answer_uuid: info.questionnaireAnswerUuid
          }
        } else {
          // Add new entry with minimal data (template and answer UUIDs only)
          questionnaires.push({
            questionnaire_template_uuid: info.templateUuid,
            questionnaire_answer_uuid: info.questionnaireAnswerUuid
            // Do NOT include saq_type, name, description - those come from template
          })
        }
      }

      // Update interface instance
      await postJSON('/website/client/interface-instances/update-interface-instance', {
        instance_uuid: resolvedInstanceUuid,
        instance_details: {
          metadata: {
            ...currentMetadata,
            questionnaires
          }
        }
      })

      console.log('✅ Interface instance metadata updated with new questionnaire-answer UUIDs')
    } catch (error) {
      console.error('❌ Failed to update interface instance metadata:', error)
      throw error
    }
  }

  return createdAnswers
}

const deriveTemplateShortName = (name = '') => {
  if (!name) return 'SAQ'
  return name.replace(/^PCI DSS\s+/i, '').trim() || name
}

const parseApplicabilityTags = (tags) => {
  if (!tags) return []
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).map((tag) => tag.trim())
  }
  return String(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

const normalizeQuestion = (question, templateMeta) => {
  const properties = question?.properties || {}
  const applicabilityTags = parseApplicabilityTags(properties?.applicability_tags)
  const legacyId =
    properties?.id ||
    properties?.requirement_id ||
    properties?.control_id ||
    properties?.json_path ||
    question?.question_uuid
  
  // Extract context metadata
  const context = properties?.context || {}
  const contextParagraphs = context?.paragraphs || []
  const contextNotes = context?.notes || []
  const sectionHierarchy = context?.section_hierarchy || []
  const sectionPath = context?.section_path || null
  
  // Extract checklist items and table structure
  const checklistItems = properties?.checklist_items || []
  const tableStructure = properties?.table_structure || null
  const schema = properties?.schema || null
  
  // Extract notes configuration for enum questions
  const notesRequiredFor = properties?.notes_required_for || []
  const notesLabels = properties?.notes_labels || {}
  const appendixMapping = properties?.appendix_mapping || {}
  
  // Extract answer options (can be in properties.response_options, properties.answer_options, or properties.options)
  const answerOptionsFromProps = properties?.response_options || properties?.answer_options || properties?.options || []
  
  return {
    id: legacyId,
    questionUuid: question?.question_uuid,
    templateUuid: templateMeta?.templateUuid,
    templateName: templateMeta?.name,
    saqType: properties?.saq_type || templateMeta?.shortName,
    questionText: question?.question_text,
    description: question?.description,
    answerType: question?.answer_type,
    sourceUrl: question?.source_url,
    sourcePage: properties?.source_page || properties?.page || null,
    ordinal: question?.ordinal ?? 0,
    isMandatory: question?.is_mandatory,
    evidenceMandatory: question?.evidence_mandatory,
    answerOptions: answerOptionsFromProps.length > 0 ? answerOptionsFromProps : (properties?.options || []),
    options: answerOptionsFromProps.length > 0 ? answerOptionsFromProps : (properties?.options || []),
    expectedTesting: properties?.expected_testing || null,
    expected_testing: properties?.expected_testing || null,
    helpText: properties?.help_text || null,
    help_text: properties?.help_text || null,
    sectionTitle: properties?.heading || properties?.section_title || null,
    section_title: properties?.heading || properties?.section_title || null,
    sectionGuidance: properties?.section_guidance || null,
    section_guidance: properties?.section_guidance || null,
    sectionSubheading: properties?.subheading || null,
    sectionSubsubheading: properties?.subsubheading || null,
    questionNumber: properties?.number || null,
    saqGuidance: properties?.saq_guidance || null,
    saq_guidance: properties?.saq_guidance || null,
    nodes: properties?.nodes || [],
    applicabilityNotes: properties?.applicability_notes || properties?.applicability || null,
    applicabilityTags,
    requirementId: properties?.requirement_id || null,
    requirement_id: properties?.requirement_id || null,
    requirementLabel: properties?.requirement_label || null,
    requirement_label: properties?.requirement_label || null,
    jsonPath: properties?.json_path || null,
    appendixTrigger: properties?.appendix_trigger || null,
    framework: properties?.framework || templateMeta?.framework,
    // Context metadata
    contextParagraphs,
    contextNotes,
    sectionHierarchy,
    sectionPath,
    // Checklist and table data
    checklistItems,
    tableStructure,
    schema,
    // Notes configuration for enum
    notesRequiredFor,
    notesLabels,
    appendixMapping,
    rawProperties: properties
  }
}

const loadInterfaceInstance = async (instanceId) => {
  const instanceUuid = await getInstanceUuid(instanceId)
  try {
    console.log('📥 Fetching interface instance for questionnaires...')
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    if (!response?.instance) {
      throw new Error('Interface instance not found in API response')
    }

    return response.instance
  } catch (error) {
    console.error('❌ Error loading interface instance:', error)
    throw error
  }
}

const fetchTemplateDetails = async (templateUuid) => {
  if (!templateUuid) {
    throw new Error('Template UUID is required to fetch template details')
  }

  try {
    console.log(`📥 Fetching template details for ${templateUuid}...`)
    const template = await postJSON('/questionnaire-templates/get-template', {
      template_uuid: templateUuid,
      platform_node: true
    })

    if (!template) {
      throw new Error(`Template ${templateUuid} not found`)
    }

    return template
  } catch (error) {
    console.error(`❌ Error loading template details for ${templateUuid}:`, error)
    throw error
  }
}

/**
 * Search for SAQ templates by tags
 * @param {Array<string>} tags - Tags to search for (e.g., ['SAQ-A', 'SAQ-C-VT', 'SAQ-D'])
 * @returns {Promise<Array>} - Array of matching templates (max 3: one per SAQ type)
 */
const searchSAQTemplatesByTags = async (tags = ['SAQ-A', 'SAQ-C-VT', 'SAQ-D']) => {
  try {
    console.log('🔍 Searching for SAQ templates by tags:', tags)
    const response = await postJSON('/questionnaire-templates/search', {
      tags,
      framework: 'PCI-DSS',
      platform_node: true
    })

    console.log('📡 Raw search response:', response)
    
    const templates = response?.templates || []
    console.log(`📋 Found ${templates.length} SAQ templates from search`)

    // Filter to get the newest version for each SAQ type
    // Group by SAQ tag (SAQ-A, SAQ-C-VT, SAQ-D)
    const templatesBySAQType = {}
    
    templates.forEach((template) => {
      // Parse tags if it's a JSON string
      let templateTags = template.tags
      if (typeof templateTags === 'string') {
        try {
          templateTags = JSON.parse(templateTags)
        } catch (e) {
          console.warn('⚠️ Failed to parse tags for template:', template.name, e)
          templateTags = []
        }
      }
      
      // Ensure tags is an array
      templateTags = Array.isArray(templateTags) ? templateTags : []
      
      // Update template with parsed tags
      template.tags = templateTags
      
      const saqTag = templateTags.find(tag => tag.startsWith('SAQ-'))
      if (!saqTag) {
        console.warn('⚠️ Template missing SAQ tag:', template)
        return
      }
      
      // Keep the newest template for each SAQ type (based on created_at)
      if (!templatesBySAQType[saqTag]) {
        templatesBySAQType[saqTag] = template
      } else {
        const existingCreatedAt = new Date(templatesBySAQType[saqTag].created_at)
        const currentCreatedAt = new Date(template.created_at)
        
        if (currentCreatedAt > existingCreatedAt) {
          templatesBySAQType[saqTag] = template
        }
      }
    })

    const filteredTemplates = Object.values(templatesBySAQType)
    console.log(`✅ Filtered to ${filteredTemplates.length} unique SAQ templates (max 3)`)
    
    return filteredTemplates
  } catch (error) {
    console.error('❌ Error searching for SAQ templates:', error)
    throw error
  }
}

/**
 * Fetch the questionnaire and latest version of all answers
 * This endpoint returns the questionnaire metadata plus one answer per question (most recent version)
 * with all data fully decrypted and link metadata included
 */
const fetchQuestionnaireWithAnswers = async (questionnaireAnswerUuid) => {
  if (!questionnaireAnswerUuid) {
    return { questionnaire: null, answers: [] }
  }

  try {
    const response = await postJSON('/questionnaire-answers/get-questionnaire-with-latest-answers', {
      questionnaire_answer_uuid: questionnaireAnswerUuid,
      include_deleted: false
    })

    return {
      questionnaire: response?.questionnaire || null,
      answers: response?.answers || []
    }
  } catch (error) {
    console.error(`❌ Error loading questionnaire with answers for ${questionnaireAnswerUuid}:`, error)
    return { questionnaire: null, answers: [] }
  }
}

const extractPrimaryValue = (answerValue) => {
  if (answerValue === null || answerValue === undefined) {
    return null
  }

  if (Array.isArray(answerValue)) {
    return answerValue
  }

  if (typeof answerValue === 'object') {
    const candidateKeys = ['value', 'answer', 'selected', 'selection', 'text', 'response']
    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(answerValue, key)) {
        return answerValue[key]
      }
    }
    // Return null if object doesn't have any expected keys
    // This prevents default values from appearing for boolean questions
    return null
  }

  return answerValue
}

const extractAnswerNotes = (answerValue, linkMetadata, answerMetadata) => {
  const candidates = []

  if (answerValue && typeof answerValue === 'object') {
    candidates.push(answerValue.notes, answerValue.note, answerValue.comment, answerValue.comments)
  }

  if (linkMetadata && typeof linkMetadata === 'object') {
    candidates.push(linkMetadata.notes, linkMetadata.note, linkMetadata.comment)
  }

  if (answerMetadata && typeof answerMetadata === 'object') {
    candidates.push(answerMetadata.notes, answerMetadata.note)
  }

  return candidates.find((entry) => typeof entry === 'string' && entry.trim().length > 0) || ''
}

/**
 * Normalize answer from the get-questionnaire-with-latest-answers endpoint
 * This endpoint returns fully decrypted data with link metadata already included
 */
const normalizeAnswerForUI = (answer, questionnaireAnswerUuid, question) => {
  if (!answer || !question) {
    return null
  }

  const answerValue = answer?.answer_value
  const linkMetadata = answer?.link_metadata || {}
  const questionId = question?.id || question?.questionUuid

  if (!questionId) {
    return null
  }

  // Extract evidence data and map back to UI format (notes field only)
  const evidence = answer?.evidence || []
  let extractedNotes = extractAnswerNotes(answerValue, linkMetadata, answer?.metadata)
  
  // Get the current answer value to determine if we should load evidence
  const currentValue = extractPrimaryValue(answerValue)
  
  // Check if evidence contains appendix data and convert back to notes format
  // BUT ONLY if the current answer value matches the appendix type
  if (evidence.length > 0) {
    const firstItem = evidence[0]
    const appendixType = firstItem.appendix_type
    
    // Only reconstruct notes from evidence if the current answer requires this appendix
    if (appendixType === 'D' && currentValue === 'not_tested') {
      // Appendix D: Always stored as single-entry array in UI, single evidence item in DB
      // Only include app_d_ prefixed fields
      const entry = {}
      Object.keys(firstItem).forEach(key => {
        if (key !== 'appendix_type' && key !== 'requirement_number' && key.startsWith('app_d_') && firstItem[key]) {
          entry[key] = firstItem[key]
        }
      })
      // Store as single-entry array for UI
      extractedNotes = JSON.stringify([entry])
    } else if (appendixType === 'C' && currentValue === 'not_applicable') {
      // Appendix C: Always stored as single-entry array in UI, single evidence item in DB
      // Only include app_c_ prefixed fields
      const entry = {}
      Object.keys(firstItem).forEach(key => {
        if (key !== 'appendix_type' && key !== 'requirement_number' && key.startsWith('app_c_') && firstItem[key]) {
          entry[key] = firstItem[key]
        }
      })
      // Store as single-entry array for UI
      extractedNotes = JSON.stringify([entry])
    } else if (appendixType === 'B' && currentValue === 'in_place_with_ccw') {
      // Appendix B: Single object format only
      // Only include app_b_ prefixed fields
      const worksheetData = {}
      Object.keys(firstItem).forEach(key => {
        if (key !== 'appendix_type' && key !== 'requirement_number' && key.startsWith('app_b_') && firstItem[key]) {
          worksheetData[key] = firstItem[key]
        }
      })
      extractedNotes = JSON.stringify(worksheetData)
    }
    // If appendix type doesn't match current value, use the plain notes from answer_value.notes
  }

  return {
    value: extractPrimaryValue(answerValue),
    originalValue: extractPrimaryValue(answerValue), // Track original saved value for clarification display
    notes: extractedNotes,
    answerUuid: answer?.answer_uuid,
    questionId,
    questionUuid: question?.questionUuid,
    remoteQuestionUuid: answer?.remote_question_uuid,
    questionnaireAnswerUuid,
    answerStatus: answer?.answer_status,
    reviewerNotes: answer?.reviewer_notes || '',
    isComplete: answer?.is_complete,
    linkedAt: answer?.linked_at || null,
    createdAt: answer?.created_at,
    updatedAt: answer?.updated_at,
    metadata: {
      ...(answer?.metadata || {}),
      linkMetadata
    }
  }
}

const hydrateLinkedAnswersForTemplates = async (questionnaireMap = {}) => {
  const responsesBySaq = {}
  const questionnaireEntries = Object.values(questionnaireMap)

  if (questionnaireEntries.length === 0) {
    return responsesBySaq
  }

  await Promise.all(
    questionnaireEntries.map(async ({ template, questions }) => {
      const questionnaireAnswerUuid = template?.questionnaireAnswerUuid
      if (!questionnaireAnswerUuid) {
        return
      }

      try {
        // Use new endpoint - returns questionnaire + latest answer per question with all data decrypted
        const { questionnaire, answers } = await fetchQuestionnaireWithAnswers(questionnaireAnswerUuid)
        
        console.log(`🔍 Questionnaire ${questionnaireAnswerUuid} current status: ${questionnaire?.status}`)
        
        // Check if questionnaire status needs to be updated to 'in_progress'
        // Don't auto-update if status is 'info_requested', 'providing_info', 'submitted', or 'approved'
        // Only change when user modifies an answer
        if (questionnaire?.status && 
            questionnaire.status !== 'in_progress' && 
            questionnaire.status !== 'submitted' && 
            questionnaire.status !== 'approved' &&
            questionnaire.status !== 'info_requested' &&
            questionnaire.status !== 'providing_info') {
          // Update status to in_progress when user opens the form (only for 'draft' status)
          console.log(`🔄 Updating questionnaire ${questionnaireAnswerUuid} from '${questionnaire.status}' to 'in_progress'`)
          await updateQuestionnaireStatus(questionnaireAnswerUuid, 'in_progress')
          console.log(`✅ Updated questionnaire ${questionnaireAnswerUuid} status to 'in_progress'`)
        } else {
          console.log(`⏭️ Skipping status update for ${questionnaireAnswerUuid} (current: ${questionnaire?.status})`)
        }
        
        if (!answers.length) {
          return
        }

        // Build lookup map for questions by UUID
        const questionByUuid = (questions || []).reduce((acc, question) => {
          if (question?.questionUuid) {
            acc[question.questionUuid] = question
          }
          return acc
        }, {})

        // Process each answer
        answers.forEach((answer) => {
          const question = questionByUuid[answer?.remote_question_uuid]
          if (!question) {
            return
          }

          const saqType = question?.saqType || template?.shortName
          if (!saqType) {
            return
          }

          const normalized = normalizeAnswerForUI(
            answer,
            questionnaireAnswerUuid,
            question
          )

          if (!normalized) {
            return
          }

          if (!responsesBySaq[saqType]) {
            responsesBySaq[saqType] = {}
          }

          responsesBySaq[saqType][normalized.questionId] = normalized
        })
      } catch (error) {
        console.error(`❌ Failed to hydrate linked answers for questionnaire ${questionnaireAnswerUuid}:`, error)
      }
    })
  )

  return responsesBySaq
}

/**
 * Organize template context sections into structured format
 * @param {Array} sections - Raw context.sections array from template
 * @returns {Object} - Organized context with preContext, requirementNotes, and guidanceByRequirement
 */
const organizeContextSections = (sections = []) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      preContext: null,
      requirementNotes: {},
      guidanceByRequirement: {}
    }
  }

  let preContext = null
  const requirementNotes = {}
  const guidanceByRequirement = {}

  sections.forEach((section) => {
    if (!section || typeof section !== 'object') {
      return
    }

    // Extract PreContext from first section that has it
    if (section.PreContext && !preContext) {
      preContext = section.PreContext
      return
    }

    // Process requirement-specific sections
    const requirementKeys = Object.keys(section).filter(key => key.startsWith('Requirement '))
    
    requirementKeys.forEach(reqKey => {
      // Store requirement notes (the string value)
      const noteValue = section[reqKey]
      if (typeof noteValue === 'string' && noteValue.trim()) {
        requirementNotes[reqKey] = noteValue
      }
    })

    // Extract saq_completion_guidance if present
    if (section.saq_completion_guidance && Array.isArray(section.saq_completion_guidance)) {
      // Find the requirement key this guidance belongs to
      const reqKey = requirementKeys[0] // Should only be one requirement per section
      if (reqKey) {
        guidanceByRequirement[reqKey] = section.saq_completion_guidance
      }
    }
  })

  return {
    preContext,
    requirementNotes,
    guidanceByRequirement
  }
}

/**
 * Load questionnaire templates from the platform API
 * Searches for all SAQ templates (SAQ-A, SAQ-C-VT, SAQ-D) and merges with existing questionnaires from metadata
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Array>} - Array of normalized templates
 */
export const loadAllSAQTemplates = async (instanceId) => {
  console.log('🚀 Starting loadAllSAQTemplates...')
  const instance = await loadInterfaceInstance(instanceId)
  const existingQuestionnaires = instance?.metadata?.questionnaires || []
  console.log(`📦 Interface instance loaded. Existing questionnaires: ${existingQuestionnaires.length}`)

  // Search for all available SAQ templates by tags
  console.log('🔎 About to search for SAQ templates...')
  const allSAQTemplates = await searchSAQTemplatesByTags(['SAQ-A', 'SAQ-C-VT', 'SAQ-D'])
  console.log(`📥 Received ${allSAQTemplates.length} templates from search`)

  if (allSAQTemplates.length === 0) {
    throw new Error('No SAQ templates found in the system')
  }

  // Build a map of ALL existing questionnaires (including removed) by template_uuid
  // We need to include removed ones so we can pass their status through to the UI
  const existingQuestionnaireMap = {}
  existingQuestionnaires.forEach(q => {
    if (q.questionnaire_template_uuid && q.questionnaire_answer_uuid) {
      existingQuestionnaireMap[q.questionnaire_template_uuid] = q
    }
  })
  
  // Count active questionnaires for logging
  const activeQuestionnaires = existingQuestionnaires.filter(q => q.status !== 'removed')

  // Map SAQ tag to shortName
  const tagToShortName = (tags) => {
    console.log('🏷️ Processing tags:', tags)
    
    // Parse tags if it's a JSON string
    let parsedTags = tags
    if (typeof tags === 'string') {
      try {
        parsedTags = JSON.parse(tags)
      } catch {
        console.warn('⚠️ Failed to parse tags string:', tags)
        return null
      }
    }
    
    if (!Array.isArray(parsedTags)) return null
    const saqTag = parsedTags.find(tag => tag.startsWith('SAQ-'))
    console.log('🏷️ Found SAQ tag:', saqTag)
    if (!saqTag) return null
    const result = saqTag.replace('SAQ-', 'SAQ ') // 'SAQ-A' -> 'SAQ A'
    console.log('🏷️ Mapped to shortName:', result)
    return result
  }

  // Create template refs for all SAQ templates
  const templateRefs = allSAQTemplates.map((template) => {
    const templateUuid = template.template_uuid
    const existingQuestionnaire = existingQuestionnaireMap[templateUuid]
    const shortName = tagToShortName(template.tags) || template.name

    return {
      templateUuid,
      questionnaireAnswerUuid: existingQuestionnaire?.questionnaire_answer_uuid || null,
      status: existingQuestionnaire?.status || null,
      shortName,
      name: template.name,
      description: template.description,
      tags: template.tags || [],
      clientName: instance?.metadata?.client_name || null,
      workflowContext: instance?.metadata?.workflow_context || null,
      metadata: {
        ...(existingQuestionnaire || {}),
        instance_uuid: instance?.instance_uuid,
        template: template
      }
    }
  }).filter((template) => Boolean(template.templateUuid))

  if (templateRefs.length === 0) {
    throw new Error('No valid SAQ template UUIDs found')
  }

  console.log(
    `✅ Loaded ${templateRefs.length} SAQ template reference(s) from search (${activeQuestionnaires.length} with existing questionnaire answers, ${existingQuestionnaires.length - activeQuestionnaires.length} removed)`
  )

  return templateRefs
}

/**
 * Load questions for a specific template
 * @param {string} templateUuid - Template UUID
 * @param {Object} templateMeta - Normalized template metadata
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Array>} - Array of normalized questions
 */
export const loadQuestionsForTemplate = async (templateUuid, templateMeta, instanceId = null) => {
  if (!templateUuid) {
    throw new Error('Template UUID is required to load questions')
  }

  const instanceUuid = await getInstanceUuid(instanceId)
  try {
    console.log(`📥 Loading questions for template ${templateUuid}...`)
    const response = await postJSON('/questionnaire-template-questions/get-questions-by-template', {
      platform_node: true,
      template_uuid: templateUuid,
      instance_uuid: instanceUuid
    })

    const questions = (response?.questions || []).map((question) => normalizeQuestion(question, templateMeta))

    console.log(`✅ Loaded ${questions.length} questions for ${templateMeta?.shortName || templateUuid}`)
    return questions
  } catch (error) {
    console.error(`❌ Error loading questions for template ${templateUuid}:`, error)
    throw error
  }
}

/**
 * Load templates and all related questions in parallel
 * @param {Array<string>} requestedSAQs - SAQ types to load
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<{ templates: Array, questionnaires: Object }>} - Templates list and map keyed by template UUID
 */
export const loadTemplatesWithQuestions = async (requestedSAQs = SUPPORTED_SAQ_SHORTNAMES, instanceId = null) => {
  const templateRefs = await loadAllSAQTemplates(instanceId)

  if (templateRefs.length === 0) {
    return { templates: [], questionnaires: {}, prefilledResponses: {}, shouldSkipWizard: false, questionnaireStatuses: {} }
  }

  const questionnaires = {}
  const resolvedTemplates = []
  const seenTemplateUuids = new Set()
  const questionnaireStatuses = {}
  const questionnaireMetadatas = {}
  let hasNonDraftStatus = false

  // First, fetch all questionnaire statuses and metadata
  await Promise.all(
    templateRefs.map(async (reference) => {
      if (reference?.questionnaireAnswerUuid) {
        try {
          const { questionnaire } = await fetchQuestionnaireWithAnswers(reference.questionnaireAnswerUuid)
          if (questionnaire?.status) {
            questionnaireStatuses[reference.questionnaireAnswerUuid] = questionnaire.status
            if (questionnaire.status !== 'draft') {
              hasNonDraftStatus = true
            }
          }
          // Store questionnaire metadata (includes document_uuid)
          if (questionnaire?.metadata) {
            questionnaireMetadatas[reference.questionnaireAnswerUuid] = questionnaire.metadata
            console.log(`📄 Stored metadata for ${reference.questionnaireAnswerUuid}:`, {
              document_uuid: questionnaire.metadata.document_uuid,
              name: questionnaire.metadata.name
            })
          }
        } catch (error) {
          console.error(`Failed to fetch status for questionnaire ${reference.questionnaireAnswerUuid}:`, error)
        }
      }
    })
  )

  // If no questionnaires have statuses, assume draft
  if (Object.keys(questionnaireStatuses).length === 0) {
    hasNonDraftStatus = false
  }

  await Promise.all(
    templateRefs.map(async (reference) => {
      if (!reference?.templateUuid || seenTemplateUuids.has(reference.templateUuid)) {
        return
      }

      const templateDetails = await fetchTemplateDetails(reference.templateUuid)
      
      // Extract and organize context sections
      const contextSections = templateDetails?.context?.sections || []
      const organizedContext = organizeContextSections(contextSections)
      
      const templateStub = {
        templateUuid: templateDetails?.template_uuid || reference.templateUuid,
        questionnaireAnswerUuid: reference.questionnaireAnswerUuid,
        questionnaireStatus: questionnaireStatuses[reference.questionnaireAnswerUuid] || 'draft',
        status: reference.status || null, // 'removed' or null
        shortName: reference.shortName || deriveTemplateShortName(templateDetails?.name),
        name: templateDetails?.name || reference.name,
        description: templateDetails?.description || reference.description,
        framework: templateDetails?.framework || null,
        version: templateDetails?.version || null,
        tags: templateDetails?.tags || [],
        createdBy: templateDetails?.created_by || null,
        createdByLogo: templateDetails?.created_by_logo || templateDetails?.logo_url || null,
        documentationUrl: templateDetails?.documentation_url || null,
        clientName: reference.clientName,
        workflowContext: reference.workflowContext,
        contextSections,
        organizedContext,
        metadata: {
          ...templateDetails,
          ...reference.metadata,
          // Include questionnaire answer metadata (contains document_uuid)
          ...(questionnaireMetadatas[reference.questionnaireAnswerUuid] || {})
        }
      }

      const questions = await loadQuestionsForTemplate(reference.templateUuid, templateStub, instanceId)
      // Use reference.shortName first (from tags), then question saqType, then templateStub.shortName
      console.log(`📝 Template ${reference.name}: reference.shortName="${reference.shortName}", questions[0]?.saqType="${questions[0]?.saqType}", templateStub.shortName="${templateStub.shortName}"`)
      const inferredShortName = questions[0]?.saqType || reference.shortName || templateStub.shortName || reference.templateUuid
      const resolvedTemplate = {
        ...templateStub,
        shortName: inferredShortName,
        name: templateStub.name || inferredShortName,
        description: templateStub.description || `Questionnaire ${inferredShortName}`
      }

      questionnaires[reference.templateUuid] = {
        template: resolvedTemplate,
        questions
      }
      resolvedTemplates.push(resolvedTemplate)
      seenTemplateUuids.add(reference.templateUuid)
    })
  )

  if (resolvedTemplates.length === 0) {
    return { templates: [], questionnaires: {}, prefilledResponses: {} }
  }

  console.log('📋 Resolved templates before filtering:', resolvedTemplates.map(t => t.shortName))
  console.log('📋 Requested SAQs:', requestedSAQs)

  const filteredTemplates = Array.isArray(requestedSAQs) && requestedSAQs.length > 0
    ? resolvedTemplates.filter((template) => requestedSAQs.includes(template.shortName))
    : resolvedTemplates

  console.log('📋 Filtered templates:', filteredTemplates.map(t => t.shortName))

  const filteredQuestionnaires = {}
  filteredTemplates.forEach((template) => {
    filteredQuestionnaires[template.templateUuid] = questionnaires[template.templateUuid]
  })

  const finalTemplates = filteredTemplates.length === 0 ? resolvedTemplates : filteredTemplates
  const finalQuestionnaires = filteredTemplates.length === 0 ? questionnaires : filteredQuestionnaires

  if (filteredTemplates.length === 0) {
    console.warn('⚠️ No questionnaires matched the requested SAQ list; returning all loaded questionnaires instead')
  }

  const prefilledResponses = await hydrateLinkedAnswersForTemplates(finalQuestionnaires)

  return { 
    templates: finalTemplates, 
    questionnaires: finalQuestionnaires, 
    prefilledResponses,
    shouldSkipWizard: hasNonDraftStatus,
    questionnaireStatuses
  }
}

/**
 * Save SAQ responses to API
 * @param {Object} data - The data to save
 * @param {Object} data.responses - All responses organized by SAQ type
 * @param {Object} data.reviewData - All review data organized by SAQ type
 * @param {Object} data.attestation - Attestation data organized by SAQ type
 * @param {Object} data.applicability - Applicability settings (for SAQ D)
 * @param {Array} data.selectedSAQs - List of selected SAQ types
 * @returns {Promise<Object>} - API response
 */
export const saveSAQData = async (data) => {
  try {
    console.log('💾 Saving SAQ data:', data)
    
    // TODO: Replace with actual API endpoint
    // const response = await fetch('/api/saq/save', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${getAuthToken()}`
    //   },
    //   body: JSON.stringify(data)
    // })
    
    // if (!response.ok) {
    //   throw new Error(`API error: ${response.status}`)
    // }
    
    // return await response.json()
    
    // Placeholder: Simulate API call with delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('✅ SAQ data saved successfully')
    return { 
      success: true, 
      message: 'Data saved successfully',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ Error saving SAQ data:', error)
    throw error
  }
}

/**
 * Load SAQ responses from API
 * @param {string} assessmentId - The assessment ID to load
 * @returns {Promise<Object>} - The saved SAQ data
 */
export const loadSAQData = async (assessmentId) => {
  try {
    console.log('📥 Loading SAQ data for assessment:', assessmentId)
    
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`/api/saq/load/${assessmentId}`, {
    //   method: 'GET',
    //   headers: {
    //     'Authorization': `Bearer ${getAuthToken()}`
    //   }
    // })
    
    // if (!response.ok) {
    //   throw new Error(`API error: ${response.status}`)
    // }
    
    // return await response.json()
    
    // Placeholder: Return empty data structure
    return {
      responses: {
        'SAQ A': {},
        'SAQ C-VT': {},
        'SAQ D': {}
      },
      reviewData: {
        'SAQ A': {},
        'SAQ C-VT': {},
        'SAQ D': {}
      },
      attestation: {
        'SAQ A': {},
        'SAQ C-VT': {},
        'SAQ D': {}
      },
      applicability: {},
      selectedSAQs: []
    }
  } catch (error) {
    console.error('❌ Error loading SAQ data:', error)
    throw error
  }
}

/**
 * Export SAQ data as JSON
 * @param {Object} data - The data to export
 * @returns {string} - JSON string
 */
export const exportSAQDataAsJSON = (data) => {
  return JSON.stringify(data, null, 2)
}

/**
 * Download SAQ data as JSON file
 * @param {Object} data - The data to download
 * @param {string} filename - The filename for the download
 */
export const downloadSAQDataAsJSON = (data, filename = 'saq-assessment.json') => {
  const jsonString = exportSAQDataAsJSON(data)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  
  console.log('📥 Downloaded SAQ data as JSON')
}

export const saveAnswerForQuestion = async ({ question, response, questionnaireAnswerUuid }) => {
  if (!question || !question.questionUuid) {
    throw new Error('Question details are required to save an answer')
  }

  if (!questionnaireAnswerUuid) {
    throw new Error('Questionnaire answer UUID is required to link answers')
  }

  if (!response || response.value === null || response.value === undefined) {
    throw new Error('A response value is required before saving an answer')
  }

  // Construct evidence array based on answer type and notes
  // For Appendix B, C, and D storage in evidence field as structured data
  const evidence = []
  const questionNumber = question.questionNumber || question.id
  
  if (response.value === 'not_applicable' && response.notes) {
    // Appendix C: Not Applicable Worksheet (stored as JSON in notes)
    try {
      const worksheetData = JSON.parse(response.notes)
      
      // Check if it's an array (new format with single mandatory entry) or single object (old format)
      if (Array.isArray(worksheetData)) {
        // Array format: single mandatory entry stored as array[0]
        const entry = worksheetData[0] || {}
        const evidenceItem = {
          requirement_number: questionNumber,
          appendix_type: 'C',
          // Auto-populate requirement field with question number
          app_c_requirement: questionNumber
        }
        // Add ONLY app_c_ fields to prevent cross-contamination from other appendixes
        Object.keys(entry).forEach(key => {
          if (entry[key] && key.startsWith('app_c_')) {
            evidenceItem[key] = entry[key]
          }
        })
        evidence.push(evidenceItem)
      } else {
        // Single object format (legacy)
        const evidenceItem = {
          requirement_number: questionNumber,
          appendix_type: 'C',
          // Auto-populate requirement field with question number
          app_c_requirement: questionNumber
        }
        // Add ONLY app_c_ fields to prevent cross-contamination from other appendixes
        Object.keys(worksheetData).forEach(key => {
          if (worksheetData[key] && key.startsWith('app_c_')) {
            evidenceItem[key] = worksheetData[key]
          }
        })
        evidence.push(evidenceItem)
      }
    } catch {
      // Fallback: if notes is plain text (old format), store as reason
      evidence.push({
        requirement_number: questionNumber,
        reason: response.notes,
        appendix_type: 'C'
      })
    }
  } else if (response.value === 'not_tested' && response.notes) {
    // Appendix D: Not Tested Worksheet (stored as JSON in notes)
    try {
      const worksheetData = JSON.parse(response.notes)
      
      // Check if it's an array (new format with single mandatory entry) or single object (old format)
      if (Array.isArray(worksheetData)) {
        // Array format: single mandatory entry stored as array[0]
        const entry = worksheetData[0] || {}
        const evidenceItem = {
          requirement_number: questionNumber,
          appendix_type: 'D',
          // Auto-populate requirement field with question number
          app_d_requirement: questionNumber
        }
        // Add ONLY app_d_ fields to prevent cross-contamination from other appendixes
        Object.keys(entry).forEach(key => {
          if (entry[key] && key.startsWith('app_d_')) {
            evidenceItem[key] = entry[key]
          }
        })
        evidence.push(evidenceItem)
      } else {
        // Single object format (legacy)
        const evidenceItem = {
          requirement_number: questionNumber,
          appendix_type: 'D',
          // Auto-populate requirement field with question number
          app_d_requirement: questionNumber
        }
        // Add ONLY app_d_ fields to prevent cross-contamination from other appendixes
        Object.keys(worksheetData).forEach(key => {
          if (worksheetData[key] && key.startsWith('app_d_')) {
            evidenceItem[key] = worksheetData[key]
          }
        })
        evidence.push(evidenceItem)
      }
    } catch {
      // Fallback: if notes is plain text (old format), store as reason
      evidence.push({
        requirement_number: questionNumber,
        reason: response.notes,
        appendix_type: 'D'
      })
    }
  } else if (response.value === 'in_place_with_ccw' && response.notes) {
    // Appendix B: Compensating Controls Worksheet (stored as JSON in notes)
    try {
      const worksheetData = JSON.parse(response.notes)
      const evidenceItem = {
        requirement_number: questionNumber,
        appendix_type: 'B'
      }
      // Add ONLY app_b_ fields to prevent cross-contamination from other appendixes
      Object.keys(worksheetData).forEach(key => {
        if (worksheetData[key] && key.startsWith('app_b_')) {
          evidenceItem[key] = worksheetData[key]
        }
      })
      evidence.push(evidenceItem)
    } catch {
      // If notes is not valid JSON, skip evidence creation
      console.warn('in_place_with_ccw notes is not valid JSON:', response.notes)
    }
  }

  const answerPayload = {
    remote_question_uuid: question.questionUuid,
    answer_value: {
      value: response.value,
      // Only include notes if we're NOT storing appendix data in evidence
      notes: evidence.length > 0 ? '' : (response.notes || ''),
      question_id: question.id,
      saq_type: question.saqType || question.templateName || null
    },
    answer_type: question.answerType || 'enum',
    answer_status: 'pending',
    is_complete: true,
    // Add evidence field if we have appendix-related data
    ...(evidence.length > 0 && { evidence }),
    metadata: {
      question_id: question.id,
      saq_type: question.saqType || question.templateName || null
    }
  }

  const addAnswerResponse = await postJSON('/answers/add-answer', {
    answer_details: answerPayload
  })

  const answerRecord = addAnswerResponse?.answer
  const answerUuid = answerRecord?.answer_uuid

  if (!answerUuid) {
    throw new Error('Answer API did not return an answer UUID')
  }

  const linkResponse = await postJSON('/questionnaire-answers-answers/link-answer', {
    questionnaire_answer_uuid: questionnaireAnswerUuid,
    answer_uuid: answerUuid,
    metadata: {
      question_id: question.id,
      saq_type: question.saqType || question.templateName || null
    }
  })

  const normalized = normalizeAnswerForUI(
    answerRecord,
    linkResponse?.link,
    questionnaireAnswerUuid,
    question
  )

  return {
    answer: answerRecord,
    link: linkResponse?.link,
    normalized
  }
}

/**
 * Calculate completion statistics
 * @param {Object} responses - All responses
 * @param {Object} questions - All questions
 * @returns {Object} - Completion stats per SAQ type
 */
export const calculateCompletionStats = (responses, questions) => {
  const stats = {}
  
  const saqTypes = ['SAQ A', 'SAQ C-VT', 'SAQ D']
  
  saqTypes.forEach(saqType => {
    const saqQuestions = questions[saqType] || []
    const saqResponses = responses[saqType] || {}
    
    // Build a set of valid question IDs from the filtered questions list
    // This ensures we only count answers for questions that are actually visible
    const validQuestionIds = new Set(saqQuestions.map(q => q.id))
    
    const totalQuestions = saqQuestions.length
    // Only count answers for questions that exist in the filtered questions list
    const answeredQuestions = Object.keys(saqResponses).filter(
      qId => validQuestionIds.has(qId) && saqResponses[qId]?.value
    ).length
    
    stats[saqType] = {
      total: totalQuestions,
      answered: answeredQuestions,
      percentage: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0
    }
  })
  
  return stats
}

/**
 * Get Section 1 questions for a specific SAQ type
 * Section 1 contains merchant/company information and attestation details
 * @param {string} saqType - The SAQ type (e.g., 'SAQ A', 'SAQ C-VT', 'SAQ D')
 * @returns {Array} - Array of section 1 questions
 */
export const getSection1QuestionsForSAQ = () => {
  // Return common Section 1 questions for merchant information
  return [
    {
      id: 'company_name',
      label: 'Company Name',
      type: 'text',
      required: true,
      description: 'Legal name of your organization'
    },
    {
      id: 'dba_name',
      label: 'DBA Name',
      type: 'text',
      required: false,
      description: 'Doing Business As name (if applicable)'
    },
    {
      id: 'contact_name',
      label: 'Contact Name',
      type: 'text',
      required: true,
      description: 'Primary contact for this assessment'
    },
    {
      id: 'contact_email',
      label: 'Contact Email',
      type: 'text',
      required: true,
      description: 'Email address for primary contact'
    },
    {
      id: 'assessment_date',
      label: 'Assessment Date',
      type: 'date',
      required: true,
      description: 'Date of this SAQ assessment'
    }
  ]
}

/**
 * Get Section 2 questions for a specific SAQ type
 * Section 2 contains PCI DSS requirement questions
 * @param {string} saqType - The SAQ type (e.g., 'SAQ A', 'SAQ C-VT', 'SAQ D')
 * @returns {Array} - Array of section 2 questions (currently returns empty as these are loaded from templates)
 */
export const getSection2QuestionsForSAQ = () => {
  // Section 2 questions are typically loaded from questionnaire templates
  // This function is a placeholder for backwards compatibility
  return []
}

/**
 * Load Payment Services Identification questions from the API
 * @returns {Promise<Object>} - Object containing template info and questions
 */
export const loadPaymentServicesQuestions = async () => {
  try {
    console.log('📥 Loading Payment Services Identification questionnaire...')
    
    // Step 1: Get template by framework
    const templatesResponse = await postJSON('/questionnaire-templates/get-templates-by-framework', {
      platform_node: true,
      framework: 'ALLPAY-PCI-QUESTIONNAIRE'
    })

    const templates = templatesResponse?.templates || []
    if (templates.length === 0) {
      throw new Error('Payment Services Identification template not found')
    }

    // Use the first template (should only be one)
    const template = templates[0]
    console.log(`✅ Found template: ${template.name} (${template.template_uuid})`)

    // Step 2: Get questions for this template
    const questionsResponse = await postJSON('/questionnaire-template-questions/get-questions-by-template', {
      platform_node: true,
      template_uuid: template.template_uuid
    })

    const questions = questionsResponse?.questions || []
    console.log(`✅ Loaded ${questions.length} questions`)

    // Step 3: Normalize questions to match expected format
    const normalizedQuestions = questions.map((q) => {
      const properties = q.properties || {}
      return {
        id: properties.id || properties.json_path || q.question_uuid,
        question_uuid: q.question_uuid,
        question_text: q.question_text,
        answer_type: q.answer_type,
        description: q.description,
        properties: properties,
        rawProperties: properties, // Add rawProperties for conditional logic compatibility
        ordinal: q.ordinal,
        is_mandatory: q.is_mandatory,
        // Extract depends_on (new format)
        depends_on: properties.depends_on || null,
        // Extract context/help text
        context: properties.context || [],
        help_text: properties.help_text || null,
        // Extract result messages
        result_messages: properties.result_messages || {}
      }
    })

    return {
      template,
      questions: normalizedQuestions
    }
  } catch (error) {
    console.error('❌ Error loading payment services questions:', error)
    throw error
  }
}

/**
 * Update questionnaire answer status
 * @param {string} questionnaireAnswerUuid - UUID of the questionnaire answer
 * @param {string} status - New status value
 * @returns {Promise<Object>} - Result of the status update
 */
export const updateQuestionnaireStatus = async (questionnaireAnswerUuid, status) => {
  if (!questionnaireAnswerUuid) {
    throw new Error('Questionnaire answer UUID is required')
  }

  try {
    const response = await postJSON('/questionnaire-answers/update-questionnaire-answer-status', {
      questionnaire_answer_uuid: questionnaireAnswerUuid,
      status
    })

    return {
      success: true,
      questionnaireAnswerUuid,
      status,
      response
    }
  } catch (error) {
    console.error(`❌ Failed to update questionnaire status to ${status}:`, error)
    throw error
  }
}

/**
 * Submit assessment for review
 * Updates questionnaire_answers status to 'submitted'
 * @param {string} questionnaireAnswerUuid - UUID of the questionnaire answer to submit
 * @returns {Promise<Object>} - Result of the status update
 */
export const submitAssessmentForReview = async (questionnaireAnswerUuid, responses = {}) => {
  if (!questionnaireAnswerUuid) {
    throw new Error('Questionnaire answer UUID is required to submit assessment')
  }

  console.log('📤 Submitting assessment for review:', questionnaireAnswerUuid)

  try {
    // Step 1: Update questionnaire-answer status to 'submitted'
    const response = await postJSON('/questionnaire-answers/update-questionnaire-answer-status', {
      questionnaire_answer_uuid: questionnaireAnswerUuid,
      status: 'submitted',
      submitted_by: {
        timestamp: new Date().toISOString()
        // User info can be added here if available from context
      }
    })

    // Step 2: Bulk update answer statuses to 'requires_review' 
    // Only update answers that are NOT already 'valid'
    // Check both answerStatus and metadata.temp_status for 'valid'
    // Valid answers have been reviewed and approved - keep them as valid
    // Pending answers need review - change to requires_review
    const answerUpdates = []
    Object.values(responses).forEach(response => {
      const isValid = response?.answerStatus === 'valid' || response?.metadata?.temp_status === 'valid'
      if (response?.answerUuid && !isValid) {
        answerUpdates.push({
          answer_uuid: response.answerUuid,
          answer_details: {
            answer_status: 'requires_review'
          }
        })
      }
    })

    if (answerUpdates.length > 0) {
      console.log(`📝 Updating ${answerUpdates.length} answer statuses to 'requires_review'...`)
      await postJSON('/answers/bulk-update-answers', {
        updates: answerUpdates
      })
      console.log('✅ Answer statuses updated successfully')
    }

    console.log('✅ Assessment submitted successfully')
    return {
      success: true,
      questionnaireAnswerUuid,
      status: 'submitted',
      answersUpdated: answerUpdates.length,
      submittedAt: new Date().toISOString(),
      response
    }
  } catch (error) {
    console.error('❌ Failed to submit assessment:', error)
    throw error
  }
}

/**
 * Update total SAQs received count
 * Called only on first submission (when previous status was 'in_progress')
 * Not called for resubmissions (when status is 'providing_info')
 * @returns {Promise<Object>} - Result of the update
 */
export const updateTotalSAQsReceived = async () => {
  console.log('📊 Updating total SAQs received count...')

  try {
    const response = await postJSON('/pci-form/update-total-saqs-received', {})

    console.log('✅ Total SAQs received count updated')
    return {
      success: true,
      response
    }
  } catch (error) {
    console.error('❌ Failed to update total SAQs received:', error)
    throw error
  }
}

// ============================================================================
// FRESH IMPLEMENTATION - Section 2 SAQ Selection Logic
// ============================================================================

/**
 * Update status of SAQs in interface-instance metadata when Section 2 is rendered
 * Sets status based on whether SAQ is in recommended list (from Section 1)
 * 
 * @param {Array<string>} recommendedSAQs - SAQ types recommended from Section 1 (e.g., ['SAQ A', 'SAQ D'])
 * @param {Object} allSAQMeta - All SAQ metadata { 'SAQ A': { templateUuid, ... }, ... }
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Object>} - Updated instance
 */
export const updateSAQStatusOnSection2Render = async (recommendedSAQs, allSAQMeta, instanceId = null) => {
  const instanceUuid = await getInstanceUuid(instanceId)
  console.log('📋 Updating SAQ status on Section 2 render...')
  console.log('   Recommended SAQs:', recommendedSAQs)
  
  try {
    // Get current interface instance
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    const currentMetadata = instance.metadata || {}
    let questionnaires = currentMetadata.questionnaires || []

    // Update status for each SAQ in metadata
    questionnaires = questionnaires.map(q => {
      const templateUuid = q.questionnaire_template_uuid
      
      // Find which SAQ type this template belongs to
      const saqType = Object.keys(allSAQMeta).find(type => 
        allSAQMeta[type]?.templateUuid === templateUuid
      )
      
      if (!saqType) return q

      // If SAQ is in recommended list, remove status; otherwise mark as removed
      if (recommendedSAQs.includes(saqType)) {
        const { status: _status, ...rest } = q
        return rest
      } else {
        return { ...q, status: 'removed' }
      }
    })

    // Update interface instance
    const updateResponse = await postJSON('/website/client/interface-instances/update-interface-instance', {
      instance_uuid: instanceUuid,
      instance_details: {
        metadata: {
          ...currentMetadata,
          questionnaires
        }
      }
    })

    console.log('✅ Updated SAQ status on Section 2 render')
    return updateResponse?.instance
  } catch (error) {
    console.error('❌ Failed to update SAQ status on Section 2 render:', error)
    throw error
  }
}

/**
 * Process SAQ selections when Section 2 "Confirm" button is pressed
 * 
 * Logic:
 * 1. Compare selected SAQs with existing ones in interface-instance metadata
 * 2. For existing SAQs: update status (remove "removed" if re-selected)
 * 3. For new SAQs: create questionnaire-answer and add to metadata
 * 4. Update interface-instance with all changes in one call
 * 
 * @param {Array<string>} selectedSAQTypes - Selected SAQ types (e.g., ['SAQ A', 'SAQ C-VT'])
 * @param {Object} allSAQMeta - All SAQ metadata with templates
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Object>} - Result with created answers and updated instance
 */
export const processSection2Confirmation = async (selectedSAQTypes, allSAQMeta, instanceId = null) => {
  const instanceUuid = await getInstanceUuid(instanceId)
  console.log('🔄 Processing Section 2 confirmation...')
  console.log('   Selected SAQs:', selectedSAQTypes)
  console.log('   Available SAQ metadata:', Object.keys(allSAQMeta))
  
  try {

    // Step 1: Get current interface instance
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    const currentMetadata = instance.metadata || {}
    let questionnaires = currentMetadata.questionnaires || []

    // Step 2: Build map of existing questionnaires by template UUID
    const existingMap = {}
    questionnaires.forEach(q => {
      if (q.questionnaire_template_uuid) {
        existingMap[q.questionnaire_template_uuid] = q
      }
    })

    // Step 3: Process each selected SAQ
    const newQuestionnairesToCreate = []
    const updatedQuestionnaires = []
    
    for (const saqType of selectedSAQTypes) {
      const saqMeta = allSAQMeta[saqType]
      if (!saqMeta) {
        console.warn(`⚠️ No metadata found for ${saqType}`)
        continue
      }

      const templateUuid = saqMeta.templateUuid
      const existing = existingMap[templateUuid]

      if (existing) {
        // SAQ exists in interface-instance
        // Check if it has status (was marked as removed)
        if (existing.status === 'removed') {
          console.log(`   ✅ Re-activating ${saqType} (removing "removed" status)`)
          const { status: _status, ...rest } = existing
          updatedQuestionnaires.push(rest)
        } else {
          // No status, already active - keep as is
          console.log(`   ℹ️ ${saqType} already active, no change needed`)
          updatedQuestionnaires.push(existing)
        }
      } else {
        // New SAQ not in interface-instance
        // Need to create questionnaire-answer first
        console.log(`   📝 New SAQ ${saqType} - will create questionnaire-answer`)
        newQuestionnairesToCreate.push({
          saqType,
          templateUuid,
          name: saqMeta.name,
          description: saqMeta.description
        })
      }
    }

    // Step 4: Mark unselected SAQs as removed
    const allSAQTypes = Object.keys(allSAQMeta)
    for (const saqType of allSAQTypes) {
      if (selectedSAQTypes.includes(saqType)) continue

      const saqMeta = allSAQMeta[saqType]
      const templateUuid = saqMeta?.templateUuid
      const existing = existingMap[templateUuid]

      if (existing && existing.questionnaire_answer_uuid) {
        // Only mark as removed if it has a questionnaire-answer
        console.log(`   ⚠️ Marking ${saqType} as removed`)
        updatedQuestionnaires.push({
          ...existing,
          status: 'removed'
        })
      }
    }

    // Step 5: Create questionnaire-answers for new SAQs
    const createdAnswers = {}
    if (newQuestionnairesToCreate.length > 0) {
      const jwtPayload = await decodeJWTFromCookie()
      const userEmail = jwtPayload?.email || 'test@anqa.ai'
      const thirdPartyUuid = jwtPayload?.['custom:third_party_uuid'] || 'a65a55a0-5eb8-47fc-8636-ee1148070cb7'

      for (const newSAQ of newQuestionnairesToCreate) {
        const payload = {
          questionnaire_answer_details: {
            remote_template_uuid: newSAQ.templateUuid,
            entity_type: 'third_party',
            entity_uuid: thirdPartyUuid,
            status: 'draft',
            priority: 'medium',
            created_by: {
              email: userEmail,
              timestamp: new Date().toISOString()
            },
            metadata: {
              interface_instance_uuid: instanceUuid,
              saq_type: newSAQ.saqType,
              name: newSAQ.name
            }
          }
        }

        const createResponse = await postJSON('/questionnaire-answers/add-questionnaire-answer', payload)
        const questionnaireAnswerUuid = createResponse?.questionnaire_answer?.questionnaire_answer_uuid

        if (questionnaireAnswerUuid) {
          console.log(`   ✅ Created questionnaire-answer for ${newSAQ.saqType}: ${questionnaireAnswerUuid}`)
          createdAnswers[newSAQ.saqType] = questionnaireAnswerUuid

          // Add to updated questionnaires list
          updatedQuestionnaires.push({
            questionnaire_template_uuid: newSAQ.templateUuid,
            questionnaire_answer_uuid: questionnaireAnswerUuid
          })
        }
      }
    }

    // Step 6: Update interface-instance with all changes
    // Make sure we're replacing the entire questionnaires array with our updated list
    console.log(`   📊 Final questionnaires count: ${updatedQuestionnaires.length}`)
    
    const updateResponse = await postJSON('/website/client/interface-instances/update-interface-instance', {
      instance_uuid: instanceUuid,
      instance_details: {
        metadata: {
          ...currentMetadata,
          questionnaires: updatedQuestionnaires
        }
      }
    })

    console.log('✅ Section 2 confirmation processed successfully')
    return {
      instance: updateResponse?.instance,
      createdAnswers,
      updatedCount: updatedQuestionnaires.length
    }
  } catch (error) {
    console.error('❌ Failed to process Section 2 confirmation:', error)
    throw error
  }
}

/**
 * Get client UUID using multiple fallback methods
 * @returns {Promise<string>} - Client UUID (never null, uses fallback)
 */
export const getClientUuid = async () => {
  let clientUuid = null

  // Method 1: Try to get from JWT token (most reliable for authenticated users)
  const jwtPayload = await decodeJWTFromCookie()
  if (jwtPayload?.['custom:client_uuid']) {
    clientUuid = jwtPayload['custom:client_uuid']
    console.log('🆔 Client UUID extracted from JWT:', clientUuid)
    return clientUuid
  }

  // Method 2: If not in JWT, try to extract from URL token (for external users)
  if (typeof window !== 'undefined') {
    const path = window.location.pathname
    if (path.startsWith('/e/')) {
      const token = path.split('/e/')[1]
      const tokenPattern = /^([a-f0-9-]{36})\.[a-zA-Z0-9_-]+$/i
      const match = token.match(tokenPattern)
      if (match) {
        clientUuid = match[1]
        console.log('🆔 Client UUID extracted from URL token:', clientUuid)
        return clientUuid
      }
    }
  }

  // Method 3: Try environment variable (for local development)
  try {
    // eslint-disable-next-line no-undef
    if (typeof process !== 'undefined' && process?.env?.CLIENT_UUID) {
      // eslint-disable-next-line no-undef
      clientUuid = process.env.CLIENT_UUID
      console.log('🆔 Client UUID extracted from environment variable:', clientUuid)
      return clientUuid
    }
  } catch (error) {
    console.log('ℹ️ Environment variable CLIENT_UUID not available (browser environment):', error.message)
  }

  // Method 4: Use client-specific fallback from config (for local browser testing)
  clientUuid = getFallbackClientUuid()
  console.log('🆔 Client UUID from fallback config:', clientUuid)
  return clientUuid
}

/**
 * Create external user in AWS Cognito for SAQ sharing
 * @param {string} email - Email address of the user to share with
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Object>} - Created user details
 */
export const createExternalUserForSharing = async (email, instanceId = null) => {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required')
  }

  const instanceUuid = await getInstanceUuid(instanceId)

  try {
    console.log('👤 Creating external user for sharing:', email)

    // Get interface instance to extract third_party_uuid
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    // Extract third_party_uuid from linked_entities
    const linkedEntities = instance.linked_entities || []
    const thirdPartyEntity = linkedEntities.find(entity => entity.entity_type === 'third_party')
    
    if (!thirdPartyEntity) {
      throw new Error('No third_party entity found in interface instance')
    }

    const thirdPartyUuid = thirdPartyEntity.entity_uuid
    console.log('🆔 Third party UUID:', thirdPartyUuid)

    // Get client UUID using helper function
    const clientUuid = await getClientUuid()

    // Get user pool ID from environment variable or use client-specific default
    // In production (ECS), COGNITO_EXTERNAL_USER_POOL_ID is set in task definition
    // When running locally or from website, falls back to client-specific default from config
    let userPoolId = null
    
    try {
      // eslint-disable-next-line no-undef
      if (typeof process !== 'undefined' && process?.env?.COGNITO_EXTERNAL_USER_POOL_ID) {
        // eslint-disable-next-line no-undef
        userPoolId = process.env.COGNITO_EXTERNAL_USER_POOL_ID
        console.log('🆔 Cognito User Pool ID from environment:', userPoolId)
      }
    } catch {
      // process not available in browser environment
    }
    
    // If not in environment, get client-specific default from config
    if (!userPoolId) {
      userPoolId = getCognitoUserPoolId()
      console.log('🆔 Cognito User Pool ID from client config:', userPoolId)
    }

    // Create payload
    const payload = {
      user_pool_id: userPoolId,
      email: email,
      client_uuid: clientUuid,
      role: 'external',
      third_party_uuid: thirdPartyUuid
    }

    console.log('📤 Sending ensure external user exists request:', payload)

    // Make API call
    const createResponse = await postJSON('/client/providers/aws/cognito/external-users/ensure-exists', payload)

    console.log('✅ External user ensured successfully:', email)
    
    return {
      success: true,
      email,
      user_pool_id: payload.user_pool_id,
      client_uuid: clientUuid,
      third_party_uuid: thirdPartyUuid,
      response: createResponse
    }
  } catch (error) {
    console.error('❌ Failed to create external user:', error)
    throw error
  }
}

/**
 * Send form link email to external user
 * @param {string} email - Email address of the recipient
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Object>} - Email send result
 */
export const sendFormLinkEmail = async (email, instanceId = null) => {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required')
  }

  const instanceUuid = await getInstanceUuid(instanceId)

  try {
    console.log('📧 Sending form link email to:', email)

    // Get interface instance to extract expires_at
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    // Get current URL (form link)
    const formLink = window.location.href
    console.log('🔗 Form link:', formLink)

    // Get expires_at from interface instance
    const expiresAt = instance.expires_at
    console.log('⏰ Expires at:', expiresAt)

    // Create payload
    const payload = {
      recipient_email: email,
      form_link: formLink,
      form_name: 'PCI SAQ Form',
      expires_at: expiresAt
    }

    console.log('📤 Sending form link email request:', payload)

    // Make API call
    const emailResponse = await postJSON('/client/providers/aws/send-form-link-email', payload)

    console.log('✅ Form link email sent successfully to:', email)
    
    return {
      success: true,
      sent_at: emailResponse.sent_at,
      recipient: emailResponse.recipient,
      subject: emailResponse.subject,
      message_id: emailResponse.message_id,
      response: emailResponse
    }
  } catch (error) {
    console.error('❌ Failed to send form link email:', error)
    throw error
  }
}

/**
 * Share SAQ form with external user (create user + send email)
 * @param {string} email - Email address to share with
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @param {string} [name] - Optional name for the collaborator
 * @returns {Promise<Object>} - Combined result of user creation and email sending
 */
export const shareSAQForm = async (email, instanceId = null, name = null) => {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required')
  }

  try {
    console.log('🔄 Starting SAQ form sharing process for:', email, name ? `(${name})` : '')

    // Step 1: Create external user in Cognito
    const userResult = await createExternalUserForSharing(email, instanceId)
    console.log('✅ Step 1/3: External user created')

    // Step 2: Send form link email
    const emailResult = await sendFormLinkEmail(email, instanceId)
    console.log('✅ Step 2/3: Form link email sent')

    // Step 3: Update interface instance sent_to list
    try {
      const instanceUuid = await getInstanceUuid(instanceId)
      const instanceResponse = await postJSON('/website/client/interface-instances/get-interface-instance', {
        instance_uuid: instanceUuid
      })
      
      const instance = instanceResponse?.instance
      if (instance) {
        const currentSentTo = instance.sent_to || []
        
        // Only add email if not already in the list
        if (!emailExistsInSentTo(currentSentTo, email)) {
          const updatedSentTo = addEmailToSentTo(currentSentTo, email, name)
          
          await postJSON('/website/client/interface-instances/update-interface-instance', {
            instance_uuid: instanceUuid,
            instance_details: {
              ...instance,
              sent_to: updatedSentTo
            }
          })
          
          console.log(`✅ Step 3/3: Added ${email}${name ? ` (${name})` : ''} to interface instance sent_to list`)
        } else {
          // If email exists, update the name if provided and name is currently missing or empty
          const normalized = normalizeSentTo(currentSentTo)
          const existingEntry = normalized.find(item => item.email === email)
          if (name && (!existingEntry?.name || existingEntry.name === email || !existingEntry.name.trim())) {
            const updatedSentTo = normalized.map(item => 
              item.email === email ? { ...item, name } : item
            )
            
            await postJSON('/website/client/interface-instances/update-interface-instance', {
              instance_uuid: instanceUuid,
              instance_details: {
                ...instance,
                sent_to: updatedSentTo
              }
            })
            
            console.log(`✅ Step 3/3: Updated name for ${email} in sent_to list`)
          } else {
            console.log(`ℹ️ Step 3/3: ${email} already in sent_to list, skipping update`)
          }
        }
      } else {
        console.warn('⚠️ Step 3/3: Interface instance not found, skipping sent_to update')
      }
    } catch (updateError) {
      // Don't fail the entire operation if sent_to update fails
      console.warn('⚠️ Step 3/3: Failed to update sent_to list (non-critical):', updateError)
    }

    console.log('🎉 SAQ form shared successfully with:', email)

    return {
      success: true,
      email,
      userCreated: userResult,
      emailSent: emailResult
    }
  } catch (error) {
    console.error('❌ Failed to share SAQ form:', error)
    throw error
  }
}

/**
 * Send SAQ submission notification email
 * @param {string} recipientEmail - Email address of the recipient (reviewer)
 * @param {Array<string>} submittedSAQs - List of SAQ types that were submitted
 * @param {string} submitterEmail - Email of the person who submitted (optional)
 * @param {string} instanceId - Optional instance UUID to use instead of URL/fallback
 * @returns {Promise<Object>} - Email send result
 */
export const sendSAQSubmissionNotification = async (recipientEmail, submittedSAQs = [], submitterEmail = null, instanceId = null) => {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    throw new Error('Valid recipient email address is required')
  }

  const instanceUuid = await getInstanceUuid(instanceId)

  try {
    console.log('📧 Sending SAQ submission notification to:', recipientEmail)

    // Get interface instance
    const response = await postJSON('/website/client/interface-instances/get-interface-instance', {
      instance_uuid: instanceUuid
    })

    const instance = response?.instance
    if (!instance) {
      throw new Error('Interface instance not found')
    }

    // Extract and fetch third party name
    let thirdPartyName = null
    const thirdPartyUuid = extractThirdPartyUuid(instance)
    
    if (thirdPartyUuid) {
      console.log('🔍 Found third_party_uuid in linked_entities:', thirdPartyUuid)
      const thirdParty = await fetchThirdParty(thirdPartyUuid)
      thirdPartyName = thirdParty?.name || null
      
      if (thirdPartyName) {
        console.log('✅ Third party name retrieved:', thirdPartyName)
      } else {
        console.warn('⚠️ Third party name not found, email will not include merchant name')
      }
    } else {
      console.warn('⚠️ No third_party_uuid found in linked_entities')
    }

    // Get all interfaces to find the PCI SAQ Dashboard
    const interfacesResponse = await postJSON('/website/client/interfaces/get-interfaces', {})
    const interfaces = interfacesResponse?.interfaces || []
    
    // Find the review dashboard interface by name or package
    const reviewDashboardInterface = interfaces.find(iface => 
      iface.interface_name === 'PCI SAQ Dashboard' || 
      iface.interface_package === '@webapp/interface-saq-review-dash'
    )
    
    if (!reviewDashboardInterface) {
      throw new Error('PCI SAQ Dashboard interface not found')
    }
    
    const reviewDashboardInterfaceUuid = reviewDashboardInterface.interface_uuid
    console.log('📋 Found review dashboard interface:', reviewDashboardInterfaceUuid)
    
    // Get instances of the review dashboard interface
    const dashboardResponse = await postJSON('/website/client/interface-instances/get-interface-instances', {
      interface_uuid: reviewDashboardInterfaceUuid
    })
    
    const dashboardInstances = dashboardResponse?.instances || []
    if (dashboardInstances.length === 0) {
      throw new Error('No review dashboard instances found')
    }
    
    // Use the first dashboard instance UUID for the review link
    const reviewDashboardInstanceUuid = dashboardInstances[0].instance_uuid
    console.log('📋 Using review dashboard instance:', reviewDashboardInstanceUuid)
    
    // Get client name from hostname for dynamic URL construction
    const clientName = getClientName()
    const reviewLink = `https://interface.${clientName}.platform.anqa.ai/i/${reviewDashboardInstanceUuid}`

    // Get user info
    const jwtPayload = await decodeJWTFromCookie()
    const userEmail = submitterEmail || jwtPayload?.email || 'A user'

    // Build SAQ list for display
    const saqList = submittedSAQs.length > 0 ? submittedSAQs.join(', ') : 'SAQ'
    
    // Create email subject with optional third party name
    const subject = thirdPartyName 
      ? `Action Required: ${thirdPartyName} - ${saqList} Submitted for Review`
      : `Action Required: ${saqList} Submitted for Review`

    // Create HTML email body
    const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>Action Required: SAQ Submission</title>
    <style>
        @media (prefers-color-scheme: dark) {
            .email-container { background-color: #1a1a1a !important; }
            .email-body { background-color: #2d2d2d !important; }
            .email-text { color: #e0e0e0 !important; }
            .email-footer { background-color: #1f1f1f !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" class="email-container" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px; text-align: center; background-color: #667eea; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff !important; font-size: 28px; font-weight: 600;">Action Required</h1>
                        </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                        <td class="email-body" style="padding: 40px; background-color: #ffffff;">
                            <p class="email-text" style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                                Hello,
                            </p>
                            
                            <p class="email-text" style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #333333;">
                                ${userEmail} has submitted <strong>${saqList}</strong>${thirdPartyName ? ` for <strong>${thirdPartyName}</strong>` : ''} for your review.
                            </p>
                            
                            <p class="email-text" style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #333333;">
                                Please review the submission and provide your feedback.
                            </p>
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${reviewLink}" style="display: inline-block; padding: 16px 40px; background-color: #667eea; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; mso-padding-alt: 0; text-underline-color: #ffffff;">
                                            <span style="color: #ffffff !important;">Review Submission</span>
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p class="email-text" style="margin: 30px 0 0 0; font-size: 14px; line-height: 20px; color: #666666;">
                                Or copy and paste this link into your browser:
                            </p>
                            <p class="email-text" style="margin: 10px 0 0 0; font-size: 12px; line-height: 18px; color: #999999; word-break: break-all;">
                                ${reviewLink}
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td class="email-footer" style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                            <p class="email-text" style="margin: 0; font-size: 12px; line-height: 18px; color: #999999;">
                                This is an automated message, please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim()

    // Create plain text fallback
    const bodyText = `
Action Required: SAQ Submission

Hello,

${userEmail} has submitted ${saqList}${thirdPartyName ? ` for ${thirdPartyName}` : ''} for your review.

Please review the submission and provide your feedback.

Review link: ${reviewLink}

This is an automated message, please do not reply to this email.
    `.trim()

    // Create payload
    const payload = {
      recipient_email: recipientEmail,
      subject: subject,
      body_html: bodyHtml,
      body_text: bodyText
    }

    console.log('📤 Sending SAQ submission notification email:', {
      recipient: recipientEmail,
      subject: subject,
      saqs: submittedSAQs
    })

    // Make API call
    const emailResponse = await postJSON('/client/providers/aws/send-email', payload)

    console.log('✅ SAQ submission notification sent successfully')
    
    return {
      success: true,
      sent_at: emailResponse.sent_at,
      recipient: emailResponse.recipient,
      subject: emailResponse.subject,
      message_id: emailResponse.message_id,
      response: emailResponse
    }
  } catch (error) {
    console.error('❌ Failed to send SAQ submission notification:', error)
    throw error
  }
}

/**
 * Get current user's email from JWT token
 * @returns {Promise<string|null>} - User email or null
 */
export const getCurrentUserEmail = async () => {
  const jwtPayload = await decodeJWTFromCookie()
  return jwtPayload?.email || null
}

/**
 * Calculate questionnaire completion stats
 * Returns absolute counts: answered/total for a specific SAQ type
 * 
 * @param {Object} responses - All responses state object
 * @param {Object} questions - All questions state object  
 * @param {String} saqType - SAQ type (e.g., 'SAQ A', 'SAQ C-VT', 'SAQ D')
 * @returns {Object} { answered: number, total: number }
 */
export const calculateQuestionnaireStats = (responses, questions, saqType) => {
  const saqQuestions = questions[saqType] || []
  const saqResponses = responses[saqType] || {}
  
  // Build a set of valid question IDs from the filtered questions list
  // This ensures we only count answers for questions that are actually visible
  const validQuestionIds = new Set(saqQuestions.map(q => q.id))
  
  const total = saqQuestions.length
  // Only count answers for questions that exist in the filtered questions list
  const answered = Object.keys(saqResponses).filter(
    qId => validQuestionIds.has(qId) && saqResponses[qId]?.value
  ).length
  
  return { answered, total }
}

/**
 * Calculate progress for each of the 3 PCI DSS sections
 * Works with both complete question sets and filtered subsets
 * @param {Object} responses - Responses object organized by SAQ type
 * @param {Array} questionsList - Array of questions (filtered or unfiltered)
 * @param {string} saqType - SAQ type identifier
 * @returns {Object} - Section progress with answered/total counts
 */
export const calculateSectionProgress = (responses, questionsList, saqType) => {
  const sectionProgress = {
    section1: { answered: 0, total: 0, complete: false },
    section2: { answered: 0, total: 0, complete: false },
    section3: { answered: 0, total: 0, complete: false }
  }

  if (!saqType || !questionsList || !Array.isArray(questionsList) || questionsList.length === 0) {
    return sectionProgress
  }

  if (!responses || typeof responses !== 'object') {
    return sectionProgress
  }

  const saqResponses = responses[saqType] || {}

  // Count based on the provided question list (filtered or unfiltered)
  questionsList.forEach(question => {
    const heading = question.sectionTitle || question.heading || ''
    const response = saqResponses[question.id]
    
    // A question is considered "answered and complete" if:
    // 1. It has a value (including false for boolean questions)
    // 2. AND it doesn't have answer_status requiring further work
    const hasAnswer = response?.value !== null && response?.value !== undefined
    const answerStatus = response?.answerStatus
    const isComplete = hasAnswer && 
                       answerStatus !== 'requires_further_details' && 
                       answerStatus !== 'invalid'

    // Section 1: Assessment Information
    if (heading.includes('Section 1')) {
      sectionProgress.section1.total++
      if (isComplete) sectionProgress.section1.answered++
    }
    // Section 2: Requirements and Appendices
    else if (heading.includes('Requirement') || heading.includes('Appendix')) {
      sectionProgress.section2.total++
      if (isComplete) sectionProgress.section2.answered++
    }
    // Section 3: Validation and Attestation
    else if (heading.includes('Section 3')) {
      sectionProgress.section3.total++
      if (isComplete) sectionProgress.section3.answered++
    }
  })

  // Mark sections as complete if all visible questions are answered
  // Empty sections (total === 0) are considered complete (nothing to answer)
  sectionProgress.section1.complete = 
    sectionProgress.section1.total === 0 ||
    sectionProgress.section1.answered === sectionProgress.section1.total
  sectionProgress.section2.complete = 
    sectionProgress.section2.total === 0 ||
    sectionProgress.section2.answered === sectionProgress.section2.total
  sectionProgress.section3.complete = 
    sectionProgress.section3.total === 0 ||
    sectionProgress.section3.answered === sectionProgress.section3.total

  return sectionProgress
}

/**
 * Group questions by PCI DSS sections for navigation
 * Handles both filtered and unfiltered question lists
 * @param {Array} filteredQuestions - Array of currently visible questions
 * @param {Array} allQuestions - Array of all questions (unfiltered)
 * @returns {Object} - Question groups by section with navigation indices
 */
export const groupQuestionsBySections = (filteredQuestions, allQuestions) => {
  const sections = {
    section1: { 
      filteredQuestions: [], 
      firstFilteredIndex: -1, 
      firstUnfilteredIndex: -1,
      hasQuestions: false 
    },
    section2: { 
      filteredQuestions: [], 
      firstFilteredIndex: -1, 
      firstUnfilteredIndex: -1,
      hasQuestions: false 
    },
    section3: { 
      filteredQuestions: [], 
      firstFilteredIndex: -1, 
      firstUnfilteredIndex: -1,
      hasQuestions: false 
    }
  }

  // Validate inputs
  if (!Array.isArray(filteredQuestions)) {
    return sections
  }

  // Group filtered questions and find their indices
  filteredQuestions.forEach((question, filteredIndex) => {
    const heading = question.sectionTitle || question.heading || ''
    
    if (heading.includes('Section 1')) {
      sections.section1.filteredQuestions.push(question)
      if (sections.section1.firstFilteredIndex === -1) {
        sections.section1.firstFilteredIndex = filteredIndex
      }
    } else if (heading.includes('Requirement') || heading.includes('Appendix')) {
      sections.section2.filteredQuestions.push(question)
      if (sections.section2.firstFilteredIndex === -1) {
        sections.section2.firstFilteredIndex = filteredIndex
      }
    } else if (heading.includes('Section 3')) {
      sections.section3.filteredQuestions.push(question)
      if (sections.section3.firstFilteredIndex === -1) {
        sections.section3.firstFilteredIndex = filteredIndex
      }
    }
  })

  // Find unfiltered indices by matching first question IDs in the unfiltered list
  const sectionKeys = ['section1', 'section2', 'section3']
  sectionKeys.forEach(sectionKey => {
    const firstFilteredQuestion = sections[sectionKey].filteredQuestions[0]
    sections[sectionKey].hasQuestions = sections[sectionKey].filteredQuestions.length > 0
    
    if (firstFilteredQuestion && allQuestions && allQuestions.length > 0) {
      const unfilteredIdx = allQuestions.findIndex(q => q.id === firstFilteredQuestion.id)
      sections[sectionKey].firstUnfilteredIndex = unfilteredIdx
    }
  })

  return sections
}
