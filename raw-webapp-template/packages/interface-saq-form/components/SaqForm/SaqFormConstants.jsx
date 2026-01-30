/**
 * Constants, helpers, and utility functions for SAQ Form Interface
 */

/**
 * Answer type constants for different question formats
 */
export const ANSWER_TYPES = {
  TEXT: 'text',
  BOOLEAN: 'boolean',
  DATE: 'date',
  MULTI_SELECT: 'multi_select',
  ENUM: 'enum',  // Single-select dropdown with custom options
  ARRAY_OBJECT: 'array<object>',
  OBJECT: 'object',
  COMPUTED: 'computed',
  SECTION_HEADER: 'section_header',
  NOTE: 'note'
}

export const SAQ_DEFINITIONS = {
  'SAQ A': {
    name: 'SAQ A',
    description: 'Card-not-present merchants who have fully outsourced all cardholder data functions to PCI DSS validated third-party service providers (like AllPayments.net), with no electronic storage, processing, or transmission of any cardholder data on the merchant\'s systems or premises.',
    checklist: [
      'Document each PCI DSS validated third-party provider and their Attestation of Compliance (AOC).',
      'Ensure every payment page and redirection is served directly by the validated provider.',
      'Train staff on procedures for handling any paper receipts that contain cardholder data.'
    ]
  },
  'SAQ C-VT': {
    name: 'SAQ C-VT',
    description: 'Merchants who manually enter payment data into an internet-based virtual terminal solution (like CallPay) provided by a PCI DSS validated third-party service provider, on isolated workstations. No electronic cardholder data storage.',
    checklist: [
      'Restrict the virtual terminal workstation so it is segmented from the rest of the network.',
      'Verify the service provider that hosts the virtual terminal maintains PCI DSS validation.',
      'Create procedures for securing, retaining, and destroying any paper-based cardholder data.'
    ]
  },
  'SAQ D': {
    name: 'SAQ D',
    description: 'All other merchants and service providers not covered by SAQ A or C-VT criteria, including those with systems that are not adequately isolated or who maintain electronic cardholder data storage.',
    checklist: [
      'Engage your acquiring bank or QSA to confirm full SAQ D scope and evidence requirements.',
      'Inventory every system that stores, processes, or transmits cardholder data.',
      'Schedule quarterly external and internal vulnerability scans and perform penetration testing as required by PCI DSS.',
      'Document compensating controls and remediation plans for any gaps discovered during the assessment.'
    ]
  }
}

// RESULT_STYLES uses standardized theme colors
// Note: These match SaqFormTheme but are kept as strings for backward compatibility
// All colors now use consistent emerald (success), cyan (primary), amber (warning), slate (neutral)
export const RESULT_STYLES = {
  'SAQ A': {
    bg: 'bg-emerald-50',      // Success color - standardized
    border: 'border-emerald-200',
    accent: 'bg-emerald-500',
    heading: 'text-emerald-900',
    subheading: 'text-emerald-800',
    body: 'text-emerald-700'
  },
  'SAQ B': {
    bg: 'bg-cyan-50',          // Primary color - standardized
    border: 'border-cyan-200',
    accent: 'bg-cyan-500',
    heading: 'text-cyan-900',
    subheading: 'text-cyan-800',
    body: 'text-cyan-700'
  },
  'SAQ C-VT': {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    accent: 'bg-cyan-500',
    heading: 'text-cyan-900',
    subheading: 'text-cyan-800',
    body: 'text-cyan-700'
  },
  'SAQ D': {
    bg: 'bg-amber-50',         // Warning color - standardized
    border: 'border-amber-200',
    accent: 'bg-amber-500',
    heading: 'text-amber-900',
    subheading: 'text-amber-800',
    body: 'text-amber-700'
  },
  default: {
    bg: 'bg-slate-50',         // Neutral color - standardized
    border: 'border-slate-200',
    accent: 'bg-slate-500',
    heading: 'text-slate-900',
    subheading: 'text-slate-800',
    body: 'text-slate-700'
  }
}

export const APPLICABILITY_DEFAULTS = {
  hasWireless: false,
  hasCustomApps: false,
  hasSensitiveAreas: false,
  usesNonConsoleAdmin: false,
  transmitsOverPublicNetworks: true,
  processesPINData: false,
  isServiceProvider: false
}

export const APPLICABILITY_QUESTIONS = [
  {
    key: 'hasWireless',
    label: 'Is there any wireless that could connect to or impact the cardholder data environment (CDE)?',
    helper: 'Includes corporate Wi-Fi, guest networks, or any wireless bridging into in-scope networks.',
    tag: 'wireless'
  },
  {
    key: 'hasCustomApps',
    label: 'Do you build or modify custom applications that store, process, or transmit cardholder data?',
    helper: 'Covers in-house development, integrated middleware, or proprietary payment flows.',
    tag: 'app_dev'
  },
  {
    key: 'hasSensitiveAreas',
    label: 'Do you operate sensitive areas (data centers, server rooms, vaults) where cardholder data is present?',
    helper: 'Used for physical access controls and video surveillance requirements.',
    tag: 'sensitive_areas'
  },
  {
    key: 'usesNonConsoleAdmin',
    label: 'Is non-console administrative access (SSH, RDP, VNC, etc.) used on in-scope systems?',
    helper: 'Determines applicability of strong cryptography and MFA for remote administration.',
    tag: 'remote_admin'
  },
  {
    key: 'transmitsOverPublicNetworks',
    label: 'Do you transmit cardholder data over open or public networks (internet, Wi-Fi, mobile, etc.)?',
    helper: 'Enables encryption and key management controls for data in transit.',
    tag: 'crypto_transport'
  },
  {
    key: 'processesPINData',
    label: 'Do you process PIN data?',
    helper: 'Most SAQ D merchants do not. Enables PIN security requirements when true.',
    tag: 'pin_data'
  },
  {
    key: 'isServiceProvider',
    label: "Are you acting as a service provider processing cardholder data for other entities' environments?",
    helper: 'Hides service-provider-only controls when false.',
    tag: 'service_provider_only'
  }
]

export const ATTESTATION_DEFAULTS = {
  preparedBy: '',
  preparedDate: '',
  authorizedSigner: '',
  signerTitle: '',
  actionPlanSummary: ''
}

export const WIZARD_STEPS = [
  { key: 'decision', label: 'Identify Channels' },
  { key: 'amendment', label: 'Review & Amend' },
  { key: 'applicability', label: 'Set Applicability' },
  { key: 'checklist', label: 'Answer Controls' },
  { key: 'attestation', label: 'Attestation' }
]

// Helper functions
export const getResultStyles = (saq) => RESULT_STYLES[saq] || RESULT_STYLES.default

/**
 * Extract SAQ mappings from question properties based on user answers
 * @param {Array} questions - Array of question objects with properties.saq_mapping
 * @param {Object} answers - User's current answers keyed by json_path
 * @returns {Array<string>} - Array of SAQ types from saq_mapping
 */
export const extractSAQsFromQuestions = (questions, answers) => {
  const saqSet = new Set()

  if (!Array.isArray(questions)) {
    return []
  }

  questions.forEach((question) => {
    const jsonPath = question.properties?.json_path
    const saqMapping = question.properties?.saq_mapping

    if (!jsonPath || !saqMapping || typeof saqMapping !== 'object') {
      return
    }

    // Get user's answer for this question
    const userAnswer = answers[jsonPath]

    // Check if there's a mapping for this answer value
    let mappingKey = String(userAnswer) // Convert to string for object key lookup
    
    // Try boolean string keys
    if (userAnswer === true) mappingKey = 'true'
    if (userAnswer === false) mappingKey = 'false'

    const saqList = saqMapping[mappingKey]

    // Add all SAQs from this mapping to the set
    if (Array.isArray(saqList)) {
      saqList.forEach((saq) => {
        if (saq && typeof saq === 'string') {
          saqSet.add(saq)
        }
      })
    }
  })

  return Array.from(saqSet)
}

export const determineRequiredSAQs = (answers, apiQuestions = []) => {
  const saqSet = new Set()

  // First, extract SAQs from API-loaded questions with saq_mapping
  const apiSAQs = extractSAQsFromQuestions(apiQuestions, answers)
  apiSAQs.forEach((saq) => saqSet.add(saq))

  // Then apply hardcoded business rules as fallback/supplement
  // Rule 1: Payment services via AllPayments.net (IVR, Payment Gateway, Pay by Link, CallPay with masking)
  if (answers.has_allpayments_services) {
    saqSet.add('SAQ A')
  }

  // Rule 2: Internet payments with redirect to AllPayments.net
  if (answers.has_internet_payments && answers.internet_redirects_to_allpayments) {
    saqSet.add('SAQ A')
  }

  // Rule 3: Text payments with redirect to AllPayments.net TextPay
  if (answers.has_text_payments && answers.text_redirects_to_allpayments) {
    saqSet.add('SAQ A')
  }

  // Rule 4: CallPay isolation determines C-VT vs D
  if (answers.uses_callpay) {
    if (answers.callpay_devices_isolated && !answers.callpay_devices_connected_elsewhere) {
      // Isolated CallPay = SAQ C-VT
      saqSet.add('SAQ C-VT')
    } else {
      // Not isolated or connected elsewhere = SAQ D
      saqSet.add('SAQ D')
    }
  }

  // Convert Set to Array
  const saqs = Array.from(saqSet)

  // Default: If no SAQs identified, this might need manual review
  if (saqs.length === 0) {
    return ['SAQ D']
  }

  return saqs
}

export const parseCsvText = (text, delimiter = ',') => {
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }

  const pushRow = () => {
    if (current.length > 0) {
      rows.push(current)
      current = []
    }
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        pushField()
      } else if (char === '\n') {
        pushField()
        pushRow()
      } else if (char === '\r') {
        // skip
      } else {
        field += char
      }
    }
  }

  if (field.length > 0 || current.length > 0) {
    pushField()
    pushRow()
  }

  if (rows.length === 0) {
    return []
  }

  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((row) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = row[index] !== undefined ? row[index] : ''
    })
    return record
  })
}

export const normalizeQuestion = (record) => {
  const tags = (record.applicability_tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  return {
    id: record.id || '',
    requirement: record.requirement || '',
    requirementTitle: record.requirement_title || '',
    questionText: record.question_text || '',
    expectedTesting: record.expected_testing || '',
    sourcePage: record.source_page || '',
    applicabilityTags: tags,
    requiresCcw: (record.requires_ccw || '').toLowerCase() === 'true',
    supportsNa: record.supports_na
      ? (record.supports_na || '').toLowerCase() === 'true'
      : true,
    supportsNotTested: record.supports_not_tested
      ? (record.supports_not_tested || '').toLowerCase() === 'true'
      : true
  }
}

export const isQuestionVisible = (question, flags) => {
  if (!question) return false

  if (question.id.startsWith('11.1')) {
    return false
  }

  if (!question.applicabilityTags || question.applicabilityTags.length === 0) {
    return true
  }

  const tagMap = {
    wireless: flags.hasWireless,
    app_dev: flags.hasCustomApps,
    sensitive_areas: flags.hasSensitiveAreas,
    remote_admin: flags.usesNonConsoleAdmin,
    crypto_transport: flags.transmitsOverPublicNetworks,
    pin_data: flags.processesPINData,
    service_provider_only: flags.isServiceProvider
  }

  return question.applicabilityTags.every((tag) => tagMap[tag] === true)
}

/**
 * Validation utilities for text inputs
 */

/**
 * Validate URL format - accepts both with and without protocol
 * @param {string} value - URL to validate
 * @returns {boolean} - true if valid URL format
 */
export const validateURL = (value) => {
  if (!value || value.trim() === '') return true // Empty is valid (not required check)
  
  const trimmed = value.trim()
  
  // Pattern accepts:
  // - http://example.com or https://example.com
  // - example.com or www.example.com
  // - example.com/path or example.com:8080
  const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/
  
  return urlPattern.test(trimmed)
}

/**
 * Validate email format
 * @param {string} value - Email to validate
 * @returns {boolean} - true if valid email format
 */
export const validateEmail = (value) => {
  if (!value || value.trim() === '') return true // Empty is valid (not required check)
  
  const trimmed = value.trim()
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  return emailPattern.test(trimmed)
}

/**
 * Validate phone number format - very lenient, accepts various formats
 * @param {string} value - Phone number to validate
 * @returns {boolean} - true if valid phone format
 */
export const validatePhone = (value) => {
  if (!value || value.trim() === '') return true // Empty is valid (not required check)
  
  const trimmed = value.trim()
  // Remove common separators and spaces to count digits
  const digitsOnly = trimmed.replace(/[\s()\-+.]/g, '')
  
  // Check if we have 7-15 digits (international phone range)
  const hasEnoughDigits = /^\d{7,15}$/.test(digitsOnly)
  
  return hasEnoughDigits
}

/**
 * Detect input type and validation requirements from question metadata
 * @param {Object} question - Question object with description and questionText
 * @returns {Object} - { inputType, htmlInputType, validator, errorMessage }
 */
export const detectInputType = (question) => {
  if (!question) {
    return {
      inputType: 'text',
      htmlInputType: 'text',
      validator: null,
      errorMessage: ''
    }
  }

  // Combine description and question text for pattern matching
  const description = (question.description || '').toLowerCase()
  const questionText = (question.questionText || '').toLowerCase()
  const combined = `${description} ${questionText}`

  // Check for integer/number patterns
  if (combined.includes('total number of')) {
    return {
      inputType: 'integer',
      htmlInputType: 'number',
      validator: null,
      errorMessage: ''
    }
  }

  // Check for URL patterns
  if (combined.includes('website url')) {
    return {
      inputType: 'url',
      htmlInputType: 'text', // Use text instead of url for better compatibility
      validator: validateURL,
      errorMessage: 'Please enter a valid website URL (e.g., https://example.com or example.com)'
    }
  }

  // Check for email patterns
  if (combined.includes('e-mail')) {
    return {
      inputType: 'email',
      htmlInputType: 'email', // Use email type for mobile keyboard
      validator: validateEmail,
      errorMessage: 'Please enter a valid email address (e.g., user@example.com)'
    }
  }

  // Check for phone patterns
  if (combined.includes('phone number') || combined.includes('telephone number')) {
    return {
      inputType: 'tel',
      htmlInputType: 'tel', // Use tel type for mobile keyboard
      validator: validatePhone,
      errorMessage: 'Please enter a valid phone number'
    }
  }

  // Default to plain text with no validation
  return {
    inputType: 'text',
    htmlInputType: 'text',
    validator: null,
    errorMessage: ''
  }
}

/**
 * Detect input type for array<object> schema fields based on field label
 * @param {string} label - Field label from schema
 * @returns {Object} - { inputType, htmlInputType, validator, errorMessage }
 */
export const detectInputTypeFromLabel = (label) => {
  if (!label) {
    return {
      inputType: 'text',
      htmlInputType: 'text',
      validator: null,
      errorMessage: ''
    }
  }

  const lowercaseLabel = label.toLowerCase()

  // Check for integer/number patterns
  if (lowercaseLabel.includes('total number of')) {
    return {
      inputType: 'integer',
      htmlInputType: 'number',
      validator: null,
      errorMessage: ''
    }
  }

  // Check for URL patterns
  if (lowercaseLabel.includes('website url')) {
    return {
      inputType: 'url',
      htmlInputType: 'text',
      validator: validateURL,
      errorMessage: 'Please enter a valid website URL (e.g., https://example.com or example.com)'
    }
  }

  // Check for email patterns
  if (lowercaseLabel.includes('e-mail')) {
    return {
      inputType: 'email',
      htmlInputType: 'email',
      validator: validateEmail,
      errorMessage: 'Please enter a valid email address (e.g., user@example.com)'
    }
  }

  // Check for phone patterns
  if (lowercaseLabel.includes('phone number') || lowercaseLabel.includes('telephone number')) {
    return {
      inputType: 'tel',
      htmlInputType: 'tel',
      validator: validatePhone,
      errorMessage: 'Please enter a valid phone number'
    }
  }

  // Default to plain text with no validation
  return {
    inputType: 'text',
    htmlInputType: 'text',
    validator: null,
    errorMessage: ''
  }
}

/**
 * Role display name mapping
 * Maps internal role names to user-friendly display names
 */
export const ROLE_DISPLAY_NAMES = {
  'duly_auth': 'Duly Authorised Officer',
  'merchant_exec': 'Merchant Executive Officer',
  'lead_qsa': 'Lead QSA Officer'
}

/**
 * Get display name for a role
 * @param {string} role - Internal role name (e.g., 'duly_auth')
 * @returns {string} - Display name (e.g., 'Duly Authorised Officer') or original role if not found
 */
export const getRoleDisplayName = (role) => {
  if (!role) return role
  return ROLE_DISPLAY_NAMES[role] || role
}
