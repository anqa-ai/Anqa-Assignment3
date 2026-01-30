import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Document, Page, pdfjs } from 'react-pdf'

import { getApiBase } from './ENV_Specific/SaqFormConfig'
import { decodeJWTFromCookie, getCurrentUserEmail } from './SaqFormDataService'
import { SaqFormTheme, getButtonClasses } from './SaqFormTheme'

// Configure PDF.js worker - use worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'

const PDF_PAGE_WIDTH = 612
const PDF_PAGE_HEIGHT = 792

const ensureSignatureFontStyles = () => {
  if (document.head.querySelector('style[data-signature-font]')) {
    return
  }

  const styleSheet = document.createElement('style')
  styleSheet.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cedarville+Cursive&display=swap');
    .font-cursive {
      font-family: 'Cedarville Cursive', cursive;
    }
    .react-pdf__Document {
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: flex-start !important;
      align-content: flex-start !important;
      min-height: auto !important;
    }
    .react-pdf__Document,
    .react-pdf__Document > div,
    .react-pdf__Document > * {
      margin-top: 0 !important;
      padding-top: 0 !important;
      margin-bottom: 0 !important;
    }
    .react-pdf__Document > *:first-child,
    .react-pdf__Document > div:first-child {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    .react-pdf__Page {
      margin: 0 !important;
      padding: 0 !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    .react-pdf__Page:first-child {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    .react-pdf__Page__canvas {
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    }
    .react-pdf__Page__textContent {
      margin: 0 !important;
      padding: 0 !important;
    }
    .react-pdf__Page__annotations {
      margin: 0 !important;
      padding: 0 !important;
    }
  `
  styleSheet.setAttribute('data-signature-font', 'true')
  document.head.appendChild(styleSheet)
}

const getInputClasses = () => (
  `border ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.typography.fontSize.sm} ` +
  `${SaqFormTheme.colors.neutral.border[300]} bg-white focus:ring-2 focus:ring-cyan-200 focus:border-cyan-500`
)

const getFieldKey = (field) => {
  if (!field) return ''
  return (
    field.named_destination ||
    field.field_name ||
    field.name ||
    field.destination ||
    field.fieldName ||
    field.id ||
    field.field_id ||
    ''
  ).toString()
}

/**
 * PreviewPDF Component
 * Renders PDF with clickable field overlays positioned using metadata coordinates
 * @param {string} saqName - The SAQ name to display in the modal title (e.g., "SAQ A")
 * @param {string} documentUuid - The document UUID to fetch PDF and metadata from API (optional)
 * @param {string} questionnaireAnswerUuid - The questionnaire answer UUID to get role assignments (optional)
 * @param {string} buttonText - Text to display on the trigger button (e.g., "Sign and Submit SAQ A →")
 * @param {boolean} disabled - Whether the button should be disabled
 * @param {boolean} isSubmitting - Whether the form is currently submitting
 * @param {function} reloadQuestionnaires - Function to reload questionnaire data after signature submission
 * @param {Array<string>} signatureEmails - Array of emails that have already signed this document
 */
const PreviewPDF = ({ 
  saqName = 'SAQ', 
  documentUuid = null, 
  questionnaireAnswerUuid = null,
  buttonText = 'Sign and Submit →',
  disabled = false,
  isSubmitting = false,
  reloadQuestionnaires = null,
  signatureEmails = []
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [numPages, setNumPages] = useState(null)
  const [pageWidth, setPageWidth] = useState(1286) // US Letter width in points (110% zoomed in from original)
  const [fieldValues, setFieldValues] = useState({}) // Track filled field values
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [currentSignatureField, setCurrentSignatureField] = useState(null)
  const [signatureName, setSignatureName] = useState('')
  const [legalAgreementChecked, setLegalAgreementChecked] = useState(false)
  const [focusedField, setFocusedField] = useState(null) // Track currently focused field
  const [pdfUrl, setPdfUrl] = useState(null) // PDF blob URL from API
  const [fieldCoordinates, setFieldCoordinates] = useState([]) // Field coordinates from API or static
  const [userRoles, setUserRoles] = useState([]) // User's assigned roles for filtering fields
  const [rolesLoaded, setRolesLoaded] = useState(false) // Track if roles have been loaded
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false) // Track if user is view-only (no role assigned)
  const [currentUserEmail, setCurrentUserEmail] = useState(null) // Track current user's email for metadata updates
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [error, setError] = useState(null)
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const blobUrlRef = useRef(null)
  const pdfContainerRef = useRef(null)
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    ensureSignatureFontStyles()
  }, [])

  // Log when documentUuid prop changes (for debugging)
  useEffect(() => {
    console.log(`🔍 PreviewPDF [${saqName}] received documentUuid:`, documentUuid)
  }, [documentUuid, saqName])

  // Fetch user's assigned roles from questionnaire-answer metadata
  useEffect(() => {
    const fetchUserRoles = async () => {
      // Always get current user email for signature submission
      try {
        const userEmail = await getCurrentUserEmail()
        setCurrentUserEmail(userEmail)
        console.log('📧 Current user email set:', userEmail)
      } catch (error) {
        console.error('❌ Failed to get user email:', error)
      }

      if (!questionnaireAnswerUuid) {
        // If no questionnaire UUID, show all fields (backward compatibility)
        setRolesLoaded(true)
        return
      }

      try {
        const apiBase = getApiBase()
        const response = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionnaire_answer_uuid: questionnaireAnswerUuid }),
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch questionnaire answer: ${response.status}`)
        }

        const data = await response.json()
        const questionnaireAnswer = data?.questionnaire_answer
        
        // Get user email we already fetched above
        const userEmail = await getCurrentUserEmail()

        if (!userEmail) {
          console.warn('⚠️ No user email found in JWT token')
          setIsViewOnlyMode(true) // Prevent Finish button from showing when no JWT
          setRolesLoaded(true)
          return
        }

        // Extract roles array from metadata
        const rolesArray = questionnaireAnswer?.metadata?.roles || []
        
        // Find roles assigned to current user
        const assignedRoles = []
        rolesArray.forEach(roleMapping => {
          // roleMapping is like { "smiguez@anqa.ai": "lead_qsa" }
          if (roleMapping[userEmail]) {
            assignedRoles.push(roleMapping[userEmail])
          }
        })

        console.log(`✅ User ${userEmail} has assigned roles:`, assignedRoles)
        setUserRoles(assignedRoles)
        setRolesLoaded(true)
        
        // If user has no roles, enable view-only mode
        if (assignedRoles.length === 0) {
          console.log('👁️ User has no assigned roles - enabling view-only mode')
          setIsViewOnlyMode(true)
        }
      } catch (error) {
        console.error('❌ Failed to fetch user roles:', error)
        setRolesLoaded(true)
      }
    }

    fetchUserRoles()
  }, [questionnaireAnswerUuid])

  // Clean up blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  // Dynamically scale PDF to match modal width
  useEffect(() => {
    if (!isModalOpen || !pdfContainerRef.current) return

    const updatePageWidth = () => {
      if (pdfContainerRef.current) {
        const containerWidth = pdfContainerRef.current.clientWidth
        // Account for padding (py-4 = 16px on each side, but we'll use a small buffer)
        // Use 95% of container width to ensure PDF fits comfortably
        const availableWidth = containerWidth * 0.95
        // Convert pixels to points (1 point = 1 pixel at 96 DPI, but we'll use direct conversion)
        setPageWidth(availableWidth)
      }
    }

    // Initial calculation
    updatePageWidth()

    // Watch for resize events
    const resizeObserver = new ResizeObserver(updatePageWidth)
    resizeObserver.observe(pdfContainerRef.current)

    // Also listen to window resize as fallback
    window.addEventListener('resize', updatePageWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePageWidth)
    }
  }, [isModalOpen])

  // Scroll to top when modal opens and when PDF pages are rendered
  useEffect(() => {
    if (isModalOpen && scrollContainerRef.current && numPages) {
      // Wait for PDF to fully render before scrolling
      const scrollToTop = () => {
        if (scrollContainerRef.current) {
          // Force scroll to absolute top
          scrollContainerRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' })
          scrollContainerRef.current.scrollTop = 0
          // Also try scrolling the first page element if it exists
          const firstPage = scrollContainerRef.current.querySelector('[data-page-number="1"], .react-pdf__Page:first-child, div[class*="page-1"]')
          if (firstPage) {
            firstPage.scrollIntoView({ block: 'start', behavior: 'auto' })
          }
        }
      }
      
      // Use MutationObserver to detect when pages are actually rendered
      const observer = new MutationObserver(() => {
        scrollToTop()
      })
      
      if (scrollContainerRef.current) {
        observer.observe(scrollContainerRef.current, {
          childList: true,
          subtree: true
        })
      }
      
      // Use requestAnimationFrame to wait for next paint, then scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToTop()
          // Additional attempts with delays to catch late renders
          const timeout1 = setTimeout(scrollToTop, 100)
          const timeout2 = setTimeout(scrollToTop, 300)
          const timeout3 = setTimeout(scrollToTop, 600)
          const timeout4 = setTimeout(() => {
            scrollToTop()
            observer.disconnect()
          }, 1000)
          
          return () => {
            clearTimeout(timeout1)
            clearTimeout(timeout2)
            clearTimeout(timeout3)
            clearTimeout(timeout4)
            observer.disconnect()
          }
        })
      })
      
      return () => {
        observer.disconnect()
      }
    }
  }, [isModalOpen, numPages])

  // Fetch document metadata from API
  const fetchDocumentMetadata = async (docUuid) => {
    if (!docUuid) return null
    
    setIsLoadingMetadata(true)
    try {
      const apiBase = getApiBase()
      console.log('🌐 Fetching document metadata from:', `${apiBase}/documents/get-document`, 'with document_uuid:', docUuid)
      
      const response = await fetch(`${apiBase}/documents/get-document`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_uuid: docUuid }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch document metadata: ${response.status}`)
      }
      
      const jsonData = await response.json()
      // Extract field_coordinates from the nested structure
      const fieldCoords = jsonData?.document?.metadata?.document_properties?.field_coordinates || []
      
      console.log('✅ Fetched document metadata:', {
        totalFields: fieldCoords.length,
        fields: fieldCoords.map(f => f.named_destination)
      })
      
      setFieldCoordinates(fieldCoords)
      return fieldCoords
    } catch (err) {
      console.error('❌ Error fetching document metadata:', err)
      setFieldCoordinates([])
      return []
    } finally {
      setIsLoadingMetadata(false)
    }
  }

  // Fetch PDF from API
  const fetchPDFFromAPI = async () => {
    if (!documentUuid) {
      setError('No document UUID available. PDF cannot be loaded.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const apiBase = getApiBase()
      console.log('🌐 Fetching PDF from:', `${apiBase}/documents/get-from-s3`, 'with document_uuid:', documentUuid)
      
      const response = await fetch(`${apiBase}/documents/get-from-s3`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/pdf'
        },
        body: JSON.stringify({ document_uuid: documentUuid }),
        credentials: 'include'
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(`Failed to fetch PDF (${response.status}): ${message || 'Unknown error'}`)
      }

      const contentType = response.headers.get('content-type') || ''
      console.log('📄 Response Content-Type:', contentType)
      
      let pdfBlob
      
      // Check if response is JSON
      if (contentType.includes('application/json')) {
        console.log('⚠️ Response is JSON - checking for base64 encoding')
        
        // Parse JSON response
        const jsonData = await response.json()
        console.log('📝 JSON keys:', Object.keys(jsonData))
        
        // Look for base64-encoded PDF data in common field names
        let base64Data = jsonData.file_content || jsonData.pdf_base64 || jsonData.base64 || 
                         jsonData.pdf_content || jsonData.content || jsonData.data || jsonData.file
        
        if (!base64Data) {
          console.error('❌ No base64 PDF data found in JSON response')
          console.error('Available keys:', Object.keys(jsonData))
          throw new Error('PDF data not found in API response. Please configure API to return base64-encoded PDF.')
        }
        
        if (typeof base64Data !== 'string') {
          console.error('❌ Base64 data is not a string, got:', typeof base64Data)
          throw new Error('PDF data must be a base64-encoded string')
        }
        
        console.log('✅ Found base64 data in field:', 
          Object.keys(jsonData).find(k => jsonData[k] === base64Data),
          '(length:', base64Data.length, ')')
        
        // Decode base64 to binary
        try {
          // Remove any data URL prefix if present
          let base64String = base64Data.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '')
          console.log('📝 Decoding base64 string (length:', base64String.length, ')')
          
          // First decode - check if result is JSON (double-encoded case)
          let binaryString = atob(base64String)
          
          // Check if decoded result is JSON with another base64 layer
          if (binaryString.startsWith('{') || binaryString.startsWith('[')) {
            console.log('🔄 Detected double-encoded base64 (JSON layer), decoding again...')
            try {
              const innerJson = JSON.parse(binaryString)
              console.log('📝 Inner JSON keys:', Object.keys(innerJson))
              
              // Look for base64 field in inner JSON
              const innerBase64 = innerJson.file_content_base64 || innerJson.pdf_base64 || 
                                 innerJson.base64 || innerJson.content || innerJson.data
              
              if (innerBase64 && typeof innerBase64 === 'string') {
                console.log('✅ Found inner base64 field, using that instead')
                base64String = innerBase64.replace(/\s/g, '')
                binaryString = atob(base64String)
              }
            } catch (jsonError) {
              console.log('⚠️ Could not parse as JSON, treating as raw binary')
            }
          }
          
          const pdfBytes = new Uint8Array(binaryString.length)
          
          for (let i = 0; i < binaryString.length; i++) {
            pdfBytes[i] = binaryString.charCodeAt(i)
          }
          
          // Verify PDF header
          const header = String.fromCharCode(...pdfBytes.slice(0, 8))
          console.log('✅ PDF header:', header)
          
          if (!header.startsWith('%PDF')) {
            throw new Error('Invalid PDF header after base64 decode')
          }
          
          pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
          console.log('✅ Created PDF blob from base64 (size:', pdfBlob.size, 'bytes)')
        } catch (e) {
          console.error('❌ Failed to decode base64:', e)
          throw new Error('Failed to decode base64 PDF data: ' + e.message)
        }
      } else {
        // Direct binary response
        const blob = await response.blob()
        pdfBlob = new Blob([blob], { type: 'application/pdf' })
        console.log('✅ Created PDF blob from binary (size:', pdfBlob.size, 'bytes)')
      }
      
      // Create a blob URL for the PDF
      const blobUrl = URL.createObjectURL(pdfBlob)
      
      // Clean up previous blob URL if it exists
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      
      blobUrlRef.current = blobUrl
      setPdfUrl(blobUrl)
    } catch (err) {
      console.error('Error fetching PDF:', err)
      setError(err.message || 'Failed to load PDF')
    } finally {
      setIsLoading(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages: pages }) => {
    setNumPages(pages)
    console.log('📄 PDF loaded successfully:', {
      numPages: pages,
      totalFields: fieldCoordinates.length
    })
    
    // Initialize date fields with today's date
    const dateFields = fieldCoordinates.filter(f => {
      const key = getFieldKey(f).toLowerCase()
      return key.includes('date')
    })
    const initialValues = {}
    dateFields.forEach(field => {
      const key = getFieldKey(field)
      if (key) {
        initialValues[key] = new Date().toLocaleDateString('en-US')
      }
    })
    setFieldValues(prev => ({
      ...initialValues,
      ...prev
    }))
  }

  // Determine field type from name
  const getFieldType = (fieldName) => {
    const name = fieldName.toLowerCase()
    if (name.includes('sig')) return 'signature'
    if (name.includes('date')) return 'date'
    if (name.includes('name') || name.includes('title') || name.includes('company')) return 'text'
    return 'text'
  }

  // Check if field is filled
  const isFieldFilled = (field) => {
    const key = getFieldKey(field)
    const value = key ? fieldValues[key] : ''
    return value && value.trim() !== ''
  }

  // Get filtered fields based on user's assigned roles
  const getFilteredFields = () => {
    // View-only mode: hide all interactive fields
    if (isViewOnlyMode) {
      return []
    }
    
    // If user has already signed, make it read-only
    if (currentUserHasSigned) {
      return []
    }
    
    // If roles haven't loaded yet, show nothing
    if (!rolesLoaded) {
      return []
    }
    
    // If no roles and no questionnaire UUID, show all fields (backward compatibility)
    if (userRoles.length === 0 && !questionnaireAnswerUuid) {
      return fieldCoordinates
    }
    
    // Filter fields to only show those for user's assigned roles
    return fieldCoordinates.filter(field => userRoles.includes(field.group))
  }

  // Check if all assigned fields are filled
  const areAllAssignedFieldsFilled = () => {
    const filteredFields = getFilteredFields()
    
    if (filteredFields.length === 0) {
      return true // No fields to fill
    }
    
    // Check if every assigned field has a value
    return filteredFields.every(field => {
      const key = getFieldKey(field)
      const value = key ? fieldValues[key] : ''
      return value && value.trim() !== ''
    })
  }

  // Handle finish button click - submit signatures
  const handleFinishClick = async () => {
    console.log('🎯 Finish button clicked - All assigned fields completed!')
    console.log('📝 Field values:', fieldValues)
    console.log('👤 User roles:', userRoles)
    console.log('📄 Document UUID:', documentUuid)
    console.log('📋 Questionnaire Answer UUID:', questionnaireAnswerUuid)

    // Filter signatures to only include fields that belong to user's assigned roles
    const filteredFields = getFilteredFields()
    const filteredSignatures = {}
    
    filteredFields.forEach(field => {
      const fieldName = getFieldKey(field)
      if (fieldName && fieldValues[fieldName]) {
        filteredSignatures[fieldName] = fieldValues[fieldName]
      }
    })
    
    // Add signer email to signatures object
    if (currentUserEmail) {
      filteredSignatures.signer_email = currentUserEmail
    }
    
    console.log('🔍 Filtered signatures (only user\'s roles):', filteredSignatures)
    console.log('📧 Current user email for signature:', currentUserEmail)
    
    const payload = {
      document_uuid: documentUuid,
      questionnaire_answer_uuid: questionnaireAnswerUuid,
      signatures: filteredSignatures,
      roles: userRoles
    }

    console.log('🚀 Submitting signatures payload:', payload)
    
    const apiBase = getApiBase()
    
    // Fire off the request without waiting for the response
    fetch(`${apiBase}/documents/submit-signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async (response) => {
      console.log('📡 API Response status:', response.status, response.statusText)
      
      // Check if response is ok before parsing
      if (!response.ok) {
        // For non-ok responses, try to get error message but don't throw
        const errorText = await response.text().catch(() => 'Unknown error')
        console.warn('⚠️ Submit signature returned non-ok status:', response.status, errorText)
        return null // Return null to indicate failure
      }
      
      // Only parse JSON if response is ok
      try {
        return await response.json()
      } catch (parseError) {
        console.warn('⚠️ Failed to parse response as JSON:', parseError)
        return null
      }
    })
    .then(result => {
      // Only reload if we got a successful result
      if (result && reloadQuestionnaires) {
        console.log('✅ Signatures submitted successfully - Full API Response:', result)
        console.log('🔄 Reloading questionnaire data after signature submission...')
        reloadQuestionnaires(true) // Pass true to prevent section change
      } else {
        console.log('ℹ️ Signature submission completed (no reload needed)')
      }
    })
    .catch(error => {
      // Log errors but don't show them to the user or trigger reloads
      console.error('❌ Failed to submit signatures:', error)
      // Don't call reloadQuestionnaires on error to prevent infinite loops
    })
    
    // Show thank you modal immediately without waiting for the request
    setShowThankYouModal(true)
    setHasSubmitted(true) // Disable the submit button
  }

  // Handle button click - either navigate to next field or finish
  const handleButtonClick = () => {
    if (areAllAssignedFieldsFilled()) {
      handleFinishClick()
    } else {
      scrollToNextField()
    }
  }

  // Scroll to next field (any field, not just unfilled)
  // Only navigates through fields assigned to user's roles
  const scrollToNextField = () => {
    const filteredFields = getFilteredFields()
    
    if (filteredFields.length === 0) {
      console.warn('⚠️ No fields available for navigation')
      return
    }

    // Find currently visible field
    const container = scrollContainerRef.current
    if (!container) return
    
    const scrollTop = container.scrollTop
    const containerTop = container.getBoundingClientRect().top
    
    // Find next field below current scroll position
    for (const field of filteredFields) {
      const fieldKey = getFieldKey(field)
      const element = fieldKey ? document.getElementById(`field-${fieldKey}`) : null
      if (element) {
        const rect = element.getBoundingClientRect()
        const elementTop = rect.top - containerTop + scrollTop
        
        if (elementTop > scrollTop + 100) { // 100px threshold
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
      }
    }
    
    // If no field found below, wrap to first field
    const firstField = filteredFields[0]
    if (firstField) {
      const firstFieldKey = getFieldKey(firstField)
      const element = firstFieldKey ? document.getElementById(`field-${firstFieldKey}`) : null
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Open signature modal
  const openSignatureModal = (field) => {
    setCurrentSignatureField(field)
    setLegalAgreementChecked(false) // Reset checkbox when opening modal
    setSignatureModalOpen(true)
  }

  // Save signature
  const saveSignature = () => {
    const targetFieldName = getFieldKey(currentSignatureField) || focusedField
    const signatureText = typeof signatureName === 'string' ? signatureName.trim() : ''

    console.log('🖊️ Applying signature', {
      targetFieldName,
      signatureText,
      currentSignatureField,
      focusedField,
      hasFieldValue: !!(targetFieldName && fieldValues[targetFieldName])
    })

    if (targetFieldName && signatureText) {
      handleFieldChange(targetFieldName, signatureText)
    }
    setSignatureModalOpen(false)
    setCurrentSignatureField(null)
    setFocusedField(null)
  }

  // Handle field value change
  const handleFieldChange = (fieldName, value) => {
    console.log('✍️ Field value updated', { fieldName, value })
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }

  const openModal = async () => {
    console.log(`🚪 Opening PDF modal for ${saqName} with documentUuid:`, documentUuid)
    
    if (!documentUuid) {
      // If no documentUuid, use static PDF and metadata
      console.warn(`⚠️ No documentUuid provided for ${saqName}`)
      setIsModalOpen(true)
      return
    }
    
    setIsModalOpen(true)
    
    // Fetch metadata first
    await fetchDocumentMetadata(documentUuid)
    
    // Then fetch PDF
    if (!isLoading) {
      // Reset previous PDF URL if document_uuid changed
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
        setPdfUrl(null)
      }
      fetchPDFFromAPI()
    }
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  // Determine if current user has already signed
  const currentUserHasSigned = currentUserEmail && signatureEmails.includes(currentUserEmail)
  // Use "View PDF" if user has signed, otherwise use the provided buttonText
  const displayButtonText = currentUserHasSigned ? 'View PDF' : buttonText

  return (
    <>
      {/* Sign and Submit Button - Opens PDF Modal */}
      <button
        type="button"
        onClick={openModal}
        disabled={disabled || hasSubmitted}
        className={`${SaqFormTheme.borderRadius.md} ${getButtonClasses('success', 'md', disabled || hasSubmitted)} w-[200px]`}
      >
        {hasSubmitted ? 'Submitted' : isSubmitting ? 'Submitting...' : (isViewOnlyMode || currentUserHasSigned) ? 'View PDF' : displayButtonText}
      </button>

      {/* Modal - Rendered via Portal */}
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 flex items-center justify-center p-5 z-[9999]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={closeModal}
        >
          <div 
            className={`bg-white ${SaqFormTheme.borderRadius.lg} flex flex-col overflow-hidden ${SaqFormTheme.shadows['2xl']} w-full h-[90vh]`}
            style={{ maxWidth: '1500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{saqName} PDF Preview</h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* PDF Viewer with Overlays */}
            <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-slate-100 relative">
              {/* House-shaped Next Button - Positioned at left edge of modal - Only show if not view-only */}
              {!isViewOnlyMode && !areAllAssignedFieldsFilled() && (
                <div 
                  onClick={scrollToNextField}
                  className="sticky left-2 top-1/2 transform -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-50 float-left"
                  style={{ marginTop: '50vh' }}
                  title="Go to next field"
                >
                  <svg width="160" height="53" viewBox="0 0 160 53" className="drop-shadow-lg">
                    {/* House shape: square + triangle pointing right */}
                    <path
                      d="M 10 13.25 L 10 39.75 L 70 39.75 L 95 26.5 L 70 13.25 Z"
                      fill="#06b6d4"
                      stroke="#0891b2"
                      strokeWidth="2"
                      className="hover:fill-cyan-600 transition-colors"
                    />
                    <text
                      x="40"
                      y="29"
                      fill="white"
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      Next
                    </text>
                  </svg>
                </div>
              )}

              <div ref={pdfContainerRef} className="flex flex-col items-center pt-0 pb-4 gap-4 w-full" style={{ minHeight: 0 }}>
                  {(isLoading || isLoadingMetadata) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white bg-opacity-90 z-10">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
                      <p className="text-slate-600">
                        {isLoadingMetadata ? 'Loading metadata...' : 'Loading PDF...'}
                      </p>
                    </div>
                  )}
                  {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white bg-opacity-90 z-10">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                        <h3 className="text-red-800 font-semibold mb-2">Error Loading PDF</h3>
                        <p className="text-red-600 text-sm">{error}</p>
                        <button
                          onClick={fetchPDFFromAPI}
                          className={`mt-4 px-4 py-2 ${getButtonClasses('danger', 'sm', false)}`}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="w-full" style={{ margin: 0, padding: 0, alignSelf: 'flex-start', lineHeight: 0 }}>
                    <Document
                      className="react-pdf-document"
                      style={{ margin: 0, padding: 0 }}
                      file={pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={
                        <div className="flex flex-col items-center justify-center p-8">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
                          <p className="text-slate-600">Loading PDF...</p>
                        </div>
                      }
                      error={
                        <div className="flex flex-col items-center justify-center p-8">
                          <div className={`${SaqFormTheme.colors.error[50]} border ${SaqFormTheme.colors.error.border[200]} ${SaqFormTheme.borderRadius.md} p-6 max-w-md`}>
                            <h3 className="text-red-800 font-semibold mb-2">Error Loading PDF</h3>
                            <p className="text-red-600 text-sm">Failed to load PDF. Please try again.</p>
                          </div>
                        </div>
                      }
                    >
                    {/* Render all pages */}
                    {numPages && Array.from(new Array(numPages), (_, index) => {
                      const pageNumber = index + 1
                      
                      // Get filtered fields for this page (only user's assigned roles)
                      const filteredFields = getFilteredFields()
                      const pageFields = filteredFields.filter(f => f.page === pageNumber - 1)
                      
                      return (
                        <div 
                          key={`page-${pageNumber}`} 
                          className={`relative shadow-lg ${pageNumber === 1 ? 'mt-0' : ''} ${pageNumber < numPages ? 'mb-4' : ''}`}
                          style={pageNumber === 1 ? { 
                            marginTop: 0, 
                            paddingTop: 0,
                            marginBottom: pageNumber < numPages ? '1rem' : 0,
                            display: 'block',
                            position: 'relative',
                            top: 0
                          } : {}}
                        >
                          <Page
                            pageNumber={pageNumber}
                            width={pageWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                          
                          {/* Interactive form fields for this page */}
                          {pageFields.map((field, fieldIndex) => {
                            // PDF coordinates: origin at bottom-left
                            // HTML coordinates: origin at top-left
                            const PDF_HEIGHT = PDF_PAGE_HEIGHT
                            
                            const { bottom_left, top_right } = field.corners
                            
                            // Calculate dimensions
                            const fieldWidth = top_right.x - bottom_left.x
                            const fieldHeight = top_right.y - bottom_left.y
                            
                            // Convert Y coordinate (flip from bottom to top)
                            const topY = PDF_HEIGHT - top_right.y
                            
                            // Scale to match rendered page width
                            const scale = pageWidth / PDF_PAGE_WIDTH
                            
                            const fieldKey = getFieldKey(field)
                            if (!fieldKey) return null
                            const fieldType = getFieldType(fieldKey)
                            const fieldValue = fieldValues[fieldKey] || ''
                            const isFilled = isFieldFilled(field)
                            
                            return (
                              <div
                                key={`field-${fieldKey}`}
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
                                    className={`w-full h-full border-2 rounded transition-all ${currentUserHasSigned || isViewOnlyMode ? 'cursor-default' : 'cursor-pointer'} flex items-center justify-center overflow-hidden ${
                                      isFilled && focusedField !== fieldKey
                                        ? `${SaqFormTheme.colors.success[50]} ${SaqFormTheme.colors.success.border[300]}`
                                        : isFilled
                                        ? `${SaqFormTheme.colors.success[100]} ${SaqFormTheme.colors.success.border[400]}`
                                        : `${SaqFormTheme.colors.primary[100]} ${SaqFormTheme.colors.primary.border[400]} ${currentUserHasSigned || isViewOnlyMode ? '' : `hover:${SaqFormTheme.colors.primary[200]}`}`
                                    }`}
                                    onClick={() => {
                                      if (!currentUserHasSigned && !isViewOnlyMode) {
                                        setFocusedField(fieldKey)
                                        openSignatureModal(field)
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
                                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                    onFocus={() => setFocusedField(fieldKey)}
                                    onBlur={() => setFocusedField(null)}
                                    className={`w-full h-full px-1 border-2 rounded transition-all overflow-hidden ${
                                      isFilled && focusedField !== fieldKey
                                        ? 'bg-transparent border-transparent'
                                        : isFilled
                                        ? `${SaqFormTheme.colors.success[50]} ${SaqFormTheme.colors.success.border[400]}`
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
                                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                    onFocus={() => setFocusedField(fieldKey)}
                                    onBlur={() => setFocusedField(null)}
                                    className={`w-full h-full px-1 border-2 rounded transition-all overflow-hidden ${
                                      isFilled && focusedField !== fieldKey
                                        ? 'bg-transparent border-transparent'
                                        : isFilled
                                        ? `${SaqFormTheme.colors.success[50]} ${SaqFormTheme.colors.success.border[400]}`
                                        : 'bg-white border-blue-400'
                                    }`}
                                    style={{ fontSize: `${Math.min(fieldHeight * scale * 0.6, 12)}px` }}
                                    placeholder={fieldKey.replace(/_/g, ' ')}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </Document>
                  </div>
                </div>
              </div>

            {/* Modal Footer with Finish Button - Hide in view-only mode or when user has no roles */}
            {!isViewOnlyMode && areAllAssignedFieldsFilled() && userRoles.length > 0 && (
              <div className="flex items-center justify-end p-4 border-t border-slate-200 bg-white">
                <button
                  onClick={handleFinishClick}
                  className={getButtonClasses('success', 'md', false)}
                >
                  Finish
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Signature Modal */}
      {signatureModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-[10000] flex items-start justify-center pt-10"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setSignatureModalOpen(false)}
        >
          <div 
            className={`bg-white ${SaqFormTheme.borderRadius.lg} ${SaqFormTheme.shadows['2xl']} w-full max-w-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Signature Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Signature</h3>
              <button
                onClick={() => setSignatureModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Signature Modal Content */}
            <div className="p-6 space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className={`w-full px-3 py-2 ${getInputClasses(false, false)}`}
                  placeholder="Enter your full name"
                />
              </div>

              {/* Signature Preview */}
              <div className={`border-2 border-dashed ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.borderRadius.md} p-6 ${SaqFormTheme.colors.neutral[50]}`}>
                <p className="text-xs text-slate-500 mb-2">Preview:</p>
                <div className="text-center">
                  <span className="font-cursive text-3xl text-slate-900">
                    {signatureName}
                  </span>
                </div>
              </div>

              {/* Legal Agreement Checkbox */}
              <div className={`${SaqFormTheme.colors.warning[50]} border ${SaqFormTheme.colors.warning.border[200]} ${SaqFormTheme.borderRadius.md} p-4`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="legalAgreement"
                    checked={legalAgreementChecked}
                    onChange={(e) => setLegalAgreementChecked(e.target.checked)}
                    className={`mt-1 ${SaqFormTheme.borderRadius.sm} ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.colors.primary.text[600]} focus:ring-${SaqFormTheme.colors.primary[500]}`}
                  />
                  <label htmlFor="legalAgreement" className="text-sm text-slate-700 flex-1">
                    By selecting <span className="font-semibold">"Apply Signature"</span>, I agree that the above signature will be the electronic representation of my signature for all purposes and has the same legal effect as my ink signature on paper.
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4">
                <button
                  onClick={() => setSignatureModalOpen(false)}
                  className={`px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} ${SaqFormTheme.colors.neutral.text[700]} bg-white border ${SaqFormTheme.colors.neutral.border[300]} ${SaqFormTheme.borderRadius.md} hover:${SaqFormTheme.colors.neutral[50]} transition`}
                >
                  Cancel
                </button>
                <button
                  onClick={saveSignature}
                  disabled={!signatureName || !legalAgreementChecked}
                  className={getButtonClasses('primary', 'sm', false)}
                >
                  Apply Signature
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Thank You Modal */}
      {showThankYouModal && createPortal(
        <div 
          className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => {
            setShowThankYouModal(false)
            // Close the main modal after closing thank you modal
            closeModal()
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thank You Modal Header */}
            <div className="flex items-center justify-center p-6 border-b border-slate-200">
              <div className={`w-12 h-12 ${SaqFormTheme.colors.success[100]} ${SaqFormTheme.borderRadius.full} flex items-center justify-center`}>
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Thank You Modal Content */}
            <div className="p-6 text-center space-y-4">
              <h3 className="text-xl font-semibold text-slate-900">
                Thank you for submitting!
              </h3>
              <p className="text-slate-600">
                You will receive an email with the attached signed copy of this document when all other signees have finished.
              </p>
            </div>

            {/* Thank You Modal Footer */}
            <div className="flex justify-center p-6 pt-0">
              <button
                onClick={() => {
                  setShowThankYouModal(false)
                  // Close the main modal after closing thank you modal
                  closeModal()
                }}
                className={getButtonClasses('success', 'md', false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default PreviewPDF
