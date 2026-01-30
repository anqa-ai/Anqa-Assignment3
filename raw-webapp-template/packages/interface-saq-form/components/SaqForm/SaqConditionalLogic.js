/**
 * Conditional Logic Evaluator for SAQ Questions
 * Handles depends_on format with direct/indirect dependencies
 */

/**
 * Normalize "Not Applicable" variants for comparison
 * Handles: "N/A", "NA", "Not Applicable", "n/a", "na", etc.
 * @param {any} value - Value to normalize
 * @returns {string} Normalized value or original if not a "not applicable" variant
 */
const normalizeNotApplicable = (value) => {
  if (typeof value !== 'string') return value
  
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  
  // Check for common "Not Applicable" variants
  const notApplicableVariants = [
    'not applicable',
    'not-applicable',
    'notapplicable',
    'n/a',
    'na',
    'n.a.',
    'n.a',
    'not_applicable'
  ]
  
  if (notApplicableVariants.includes(lower)) {
    return 'NOT_APPLICABLE' // Normalized constant
  }
  
  return value // Return original if not a variant
}

/**
 * Compare two values with "Not Applicable" normalization
 * @param {any} value1 - First value
 * @param {any} value2 - Second value
 * @param {boolean} caseInsensitive - Whether to do case-insensitive comparison
 * @returns {boolean} Whether values are equal
 */
const valuesEqual = (value1, value2, caseInsensitive = true) => {
  // Normalize both values for "Not Applicable" variants
  const normalized1 = normalizeNotApplicable(value1)
  const normalized2 = normalizeNotApplicable(value2)
  
  // If both are strings and case-insensitive comparison requested
  if (caseInsensitive && typeof normalized1 === 'string' && typeof normalized2 === 'string') {
    return normalized1.toLowerCase() === normalized2.toLowerCase()
  }
  
  return normalized1 === normalized2
}

/**
 * Evaluate a single dependency condition
 * @param {Object} dependency - Dependency object with question_uuid, condition, expected_value
 * @param {Object} responses - Map of question responses by question ID (properties.id)
 * @param {Array} allQuestions - Array of all questions to build UUID lookup
 * @returns {boolean} Whether the dependency condition is met
 */
const evaluateDependency = (dependency, responses, allQuestions = []) => {
  if (!dependency || !responses) return false
  
  const { question_uuid, condition, expected_value } = dependency
  
  // Build a mapping from question_uuid to properties.id
  const uuidToIdMap = {}
  allQuestions.forEach(q => {
    const uuid = q?.question_uuid || q?.questionUuid
    const id = q?.properties?.id || q?.rawProperties?.id
    if (uuid && id) {
      uuidToIdMap[uuid] = id
    }
  })
  
  // Find the question ID for this UUID
  const questionId = uuidToIdMap[question_uuid]
  if (!questionId) {
    // Dependency question not found in question bank
    return false
  }
  
  // Look up the response by question ID
  const actualValue = responses[questionId]?.value
  
  // If not answered yet, hide the dependent question
  if (actualValue === null || actualValue === undefined) {
    return false
  }
  
  // Evaluate condition
  switch (condition) {
    case 'equals':
      return valuesEqual(actualValue, expected_value)
    
    case 'not_equals':
      return !valuesEqual(actualValue, expected_value)
    
    case 'contains':
      if (Array.isArray(actualValue)) {
        // Check if any value in array matches (with normalization)
        return actualValue.some(item => valuesEqual(item, expected_value))
      }
      if (typeof actualValue === 'string') {
        // For string contains, check if normalized expected_value is in normalized actualValue
        const normalizedActual = normalizeNotApplicable(actualValue)
        const normalizedExpected = normalizeNotApplicable(expected_value)
        
        if (typeof normalizedActual === 'string' && typeof normalizedExpected === 'string') {
          return normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase())
        }
        return normalizedActual === normalizedExpected
      }
      return false
    
    case 'not_contains':
      if (Array.isArray(actualValue)) {
        // Check if no value in array matches (with normalization)
        return !actualValue.some(item => valuesEqual(item, expected_value))
      }
      if (typeof actualValue === 'string') {
        // For string not_contains, check if normalized expected_value is NOT in normalized actualValue
        const normalizedActual = normalizeNotApplicable(actualValue)
        const normalizedExpected = normalizeNotApplicable(expected_value)
        
        if (typeof normalizedActual === 'string' && typeof normalizedExpected === 'string') {
          return !normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase())
        }
        return normalizedActual !== normalizedExpected
      }
      return true
    
    case 'has_any_value':
      // Check if array has any elements or value is truthy and not empty
      if (Array.isArray(actualValue)) {
        return actualValue.length > 0
      }
      if (typeof actualValue === 'string') {
        return actualValue.trim().length > 0
      }
      // For other types, check truthiness
      return !!actualValue
    
    default:
      console.warn(`Unknown condition type: ${condition}`)
      return false
  }
}

/**
 * Evaluate depends_on logic
 * @param {Object} dependsOn - depends_on object from question.properties
 * @param {Object} responses - Map of question responses
 * @param {Array} allQuestions - Array of all questions to build UUID lookup
 * @returns {boolean} Whether all dependencies are met (question should be shown)
 */
const evaluateDependsOn = (dependsOn, responses, allQuestions = []) => {
  if (!dependsOn) return true // No dependencies means always show
  
  const { logic = 'AND', direct = [] } = dependsOn
  
  // Evaluate direct dependencies
  const directResults = direct.map(dep => evaluateDependency(dep, responses, allQuestions))
  
  // TODO: Implement indirect dependencies when needed
  // For now, we only check direct dependencies
  
  // Apply logic operator
  if (logic === 'OR') {
    return directResults.length === 0 || directResults.some(result => result === true)
  } else { // AND (default)
    return directResults.length === 0 || directResults.every(result => result === true)
  }
}

/**
 * Check if a specific question should be visible
 * @param {Object} question - Question object with potential depends_on
 * @param {Object} responses - Map of question responses
 * @param {Array} allQuestions - Array of all questions to build UUID lookup
 * @returns {boolean} Whether question should be visible
 */
export const isQuestionVisible = (question, responses, allQuestions = []) => {
  if (!question) return false
  
  // Check depends_on format (in rawProperties or properties)
  const dependsOn = question.rawProperties?.depends_on || question.properties?.depends_on || question.depends_on
  if (dependsOn) {
    return evaluateDependsOn(dependsOn, responses, allQuestions)
  }
  
  // No dependencies means always show
  return true
}

/**
 * Filter questions based on depends_on logic
 * @param {Array} questions - Array of questions
 * @param {Object} responses - Map of question responses
 * @returns {Array} Filtered questions that should be shown
 */
export const filterQuestionsByDependency = (questions, responses) => {
  if (!questions || questions.length === 0) return []
  
  return questions.filter(question => isQuestionVisible(question, responses, questions))
}

/**
 * Get visibility status for all questions with reasons
 * Useful for debugging dependency logic
 * @param {Array} questions - Array of questions
 * @param {Object} responses - Map of question responses
 * @returns {Array} Array of {question, visible, reason}
 */
export const getQuestionVisibilityDebug = (questions, responses) => {
  return questions.map(question => {
    const dependsOn = question.rawProperties?.depends_on || question.properties?.depends_on || question.depends_on
    const visible = isQuestionVisible(question, responses, questions)
    
    return {
      id: question.id,
      visible,
      hasDependency: !!dependsOn,
      dependsOn,
      reason: visible 
        ? 'Dependencies met or no dependencies' 
        : `Dependencies not met: ${JSON.stringify(dependsOn)}`
    }
  })
}

/**
 * Count total vs visible questions
 * @param {Array} questions - Array of questions
 * @param {Object} responses - Map of question responses
 * @returns {Object} {total, visible, hidden}
 */
export const getQuestionVisibilityStats = (questions, responses) => {
  const total = questions.length
  const visibleQuestions = filterQuestionsByDependency(questions, responses)
  const visible = visibleQuestions.length
  const hidden = total - visible
  
  return { total, visible, hidden }
}

/**
 * Export helper functions for external use
 */
export { normalizeNotApplicable, valuesEqual }
