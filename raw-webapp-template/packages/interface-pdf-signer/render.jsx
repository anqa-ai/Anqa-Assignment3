'use client'

import React, { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Theme, getButtonClasses } from './lib/theme'
import { ensureSignatureFontStyles, getFieldKey } from './lib/pdfHelpers'
import { getApiBase, getFallbackQuestionnaireAnswerUuid } from './ENV_Specific/PdfSignerConfig'
import SignatureModal from './components/SignatureModal'
import ThankYouBanner from './components/ThankYouBanner'

// Dynamically import PDFViewer to avoid SSR issues with react-pdf
const PDFViewer = dynamic(() => import('./components/PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
      <p className="text-slate-600">Loading PDF viewer...</p>
    </div>
  )
})

/**
 * PDF Signer Interface - Main Component
 * Full-page PDF viewer with signature functionality
 */
export default function Render({ data, branding, config }) {
  const {
    questionnaireAnswerUuid,
    saqName = 'SAQ',
    userEmail
  } = data || {}

  // Use fallback questionnaire answer UUID if none provided
  const activeQuestionnaireAnswerUuid = questionnaireAnswerUuid || getFallbackQuestionnaireAnswerUuid()
  
  console.log('📋 PDF Signer using questionnaire answer UUID:', activeQuestionnaireAnswerUuid)

  const [fieldValues, setFieldValues] = useState({})
  const [signatureModalOpen, setSignatureModalOpen] = useState(false)
  const [currentSignatureField, setCurrentSignatureField] = useState(null)
  const [signatureName, setSignatureName] = useState('')
  const [legalAgreementChecked, setLegalAgreementChecked] = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [fieldCoordinates, setFieldCoordinates] = useState([])
  const [userRoles, setUserRoles] = useState([])
  const [signatureEmails, setSignatureEmails] = useState([])
  const [documentUuid, setDocumentUuid] = useState(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [showSuccessBanner, setShowSuccessBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const blobUrlRef = useRef(null)
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    ensureSignatureFontStyles()
  }, [])

  // Fetch all data client-side on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!activeQuestionnaireAnswerUuid) {
        setLoadError('No questionnaire answer UUID provided')
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const apiBase = getApiBase()
        console.log('📡 Fetching data from:', apiBase)

        // Step 1: Fetch questionnaire answer to get document UUID
        console.log('📋 Fetching questionnaire answer...')
        const questionnaireResponse = await fetch(`${apiBase}/questionnaire-answers/get-questionnaire-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionnaire_answer_uuid: activeQuestionnaireAnswerUuid }),
          credentials: 'include'
        })

        if (!questionnaireResponse.ok) {
          throw new Error(`Failed to fetch questionnaire answer: ${questionnaireResponse.status}`)
        }

        const questionnaireData = await questionnaireResponse.json()
        const extractedDocumentUuid = questionnaireData?.questionnaire_answer?.metadata?.document_uuid

        if (!extractedDocumentUuid) {
          throw new Error('Document UUID not found in questionnaire answer metadata')
        }

        console.log('✅ Extracted document UUID:', extractedDocumentUuid)
        setDocumentUuid(extractedDocumentUuid)

        // Extract user roles
        if (userEmail) {
          const rolesArray = questionnaireData?.questionnaire_answer?.metadata?.roles || []
          const roles = rolesArray
            .filter(roleMapping => roleMapping[userEmail])
            .map(roleMapping => roleMapping[userEmail])
          setUserRoles(roles)
          console.log('👤 User roles:', roles)
        }
        
        // Extract signature emails
        const sigs = questionnaireData?.questionnaire_answer?.metadata?.signatures || []
        setSignatureEmails(sigs)

        // Step 2: Fetch PDF and metadata in parallel using the extracted document UUID
        console.log('📄 Fetching PDF and metadata...')
        const [pdfResponse, metadataResponse] = await Promise.all([
          // Get PDF from S3
          fetch(`${apiBase}/documents/get-from-s3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_uuid: extractedDocumentUuid }),
            credentials: 'include'
          }),
          
          // Get field coordinates
          fetch(`${apiBase}/documents/get-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_uuid: extractedDocumentUuid }),
            credentials: 'include'
          })
        ])

        // Process PDF response
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`)
        }
        const pdfData = await pdfResponse.json()

        // Process metadata response
        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`)
        }
        const metadataData = await metadataResponse.json()
        const coords = metadataData?.document?.metadata?.document_properties?.field_coordinates || []
        setFieldCoordinates(coords)
        console.log('📍 Field coordinates:', coords.length, 'fields')

        // Process PDF data (base64 or URL)
        const pdfContent = pdfData.file_content
        if (typeof pdfContent === 'string' && (pdfContent.startsWith('data:') || pdfContent.length > 1000)) {
          // It's base64 - decode it
          let base64String = pdfContent.replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '')
          
          console.log('🔍 Decoding base64 string (length:', base64String.length, ')')
          
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
          
          const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(pdfBlob)
          
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
          }
          
          blobUrlRef.current = blobUrl
          setPdfUrl(blobUrl)
          console.log('✅ PDF blob created (size:', pdfBlob.size, 'bytes)')
        } else {
          setPdfUrl(pdfContent)
        }

        console.log('✅ All data fetched successfully')
      } catch (error) {
        console.error('❌ Failed to fetch data:', error)
        setLoadError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    // Cleanup
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [activeQuestionnaireAnswerUuid, userEmail])

  // Initialize date fields
  const handleDocumentLoadSuccess = ({ numPages }) => {
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

  // Handle field value change
  const handleFieldChange = (fieldName, value) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
  }

  // Open signature modal
  const openSignatureModal = (field) => {
    setCurrentSignatureField(field)
    setLegalAgreementChecked(false)
    setSignatureModalOpen(true)
  }

  // Save signature
  const saveSignature = () => {
    const targetFieldName = getFieldKey(currentSignatureField) || focusedField
    const signatureText = typeof signatureName === 'string' ? signatureName.trim() : ''

    if (targetFieldName && signatureText) {
      handleFieldChange(targetFieldName, signatureText)
    }
    
    setSignatureModalOpen(false)
    setCurrentSignatureField(null)
    setFocusedField(null)
    setSignatureName('')
  }

  // Check if all assigned fields are filled
  const areAllAssignedFieldsFilled = () => {
    const filteredFields = fieldCoordinates.filter(field => {
      if (!userRoles || userRoles.length === 0) return true
      return userRoles.includes(field.group)
    })
    
    if (filteredFields.length === 0) return true
    
    return filteredFields.every(field => {
      const key = getFieldKey(field)
      const value = key ? fieldValues[key] : ''
      return value && value.trim() !== ''
    })
  }

  // Scroll to next field
  const scrollToNextField = () => {
    const filteredFields = fieldCoordinates.filter(field => {
      if (!userRoles || userRoles.length === 0) return true
      return userRoles.includes(field.group)
    })
    
    if (filteredFields.length === 0) return

    const container = scrollContainerRef.current
    if (!container) return
    
    const scrollTop = container.scrollTop
    const containerTop = container.getBoundingClientRect().top
    
    for (const field of filteredFields) {
      const fieldKey = getFieldKey(field)
      const element = fieldKey ? document.getElementById(`field-${fieldKey}`) : null
      if (element) {
        const rect = element.getBoundingClientRect()
        const elementTop = rect.top - containerTop + scrollTop
        
        if (elementTop > scrollTop + 100) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
      }
    }
    
    // Wrap to first field
    const firstField = filteredFields[0]
    if (firstField) {
      const firstFieldKey = getFieldKey(firstField)
      const element = firstFieldKey ? document.getElementById(`field-${firstFieldKey}`) : null
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Submit signatures
  const handleFinishClick = async () => {
    console.log('🎯 Submitting signatures...')

    // Filter signatures to only include user's assigned roles
    const filteredFields = fieldCoordinates.filter(field => {
      if (!userRoles || userRoles.length === 0) return true
      return userRoles.includes(field.group)
    })
    
    const filteredSignatures = {}
    filteredFields.forEach(field => {
      const fieldName = getFieldKey(field)
      if (fieldName && fieldValues[fieldName]) {
        filteredSignatures[fieldName] = fieldValues[fieldName]
      }
    })
    
    if (userEmail) {
      filteredSignatures.signer_email = userEmail
    }
    
    const payload = {
      document_uuid: documentUuid,
      questionnaire_answer_uuid: activeQuestionnaireAnswerUuid,
      signatures: filteredSignatures,
      roles: userRoles
    }

    console.log('🚀 Submitting payload:', payload)
    
    const apiBase = getApiBase()
    
    try {
      const response = await fetch(`${apiBase}/documents/submit-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      })

      if (response.ok) {
        console.log('✅ Signatures submitted successfully')
        setHasSubmitted(true)
        setShowSuccessBanner(true)
      } else {
        console.error('❌ Failed to submit signatures:', response.status)
      }
    } catch (error) {
      console.error('❌ Error submitting signatures:', error)
    }
  }

  // Determine if user is in view-only mode
  const currentUserHasSigned = userEmail && signatureEmails.includes(userEmail)
  const isViewOnly = currentUserHasSigned || (userRoles && userRoles.length === 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">{saqName} PDF Signature</h1>
      </div>

      {/* Main Content */}
      <div className="max-w-[1500px] mx-auto p-6">
        {/* Success Banner */}
        {showSuccessBanner && (
          <ThankYouBanner onClose={() => setShowSuccessBanner(false)} />
        )}

        {/* PDF Viewer Container */}
        <div className={`bg-white ${Theme.borderRadius.lg} ${Theme.shadows.md} overflow-hidden`} style={{ height: 'calc(100vh - 200px)' }}>
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className={`${Theme.colors.error[50]} border ${Theme.colors.error.border[200]} ${Theme.borderRadius.md} p-6 max-w-md`}>
                <h3 className="text-red-800 font-semibold mb-2">Error Loading PDF</h3>
                <p className="text-red-600 text-sm">{loadError}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
              <p className="text-slate-600">Loading PDF...</p>
            </div>
          ) : pdfUrl ? (
            <PDFViewer
              pdfUrl={pdfUrl}
              fieldCoordinates={fieldCoordinates}
              userRoles={userRoles}
              fieldValues={fieldValues}
              onFieldChange={handleFieldChange}
              focusedField={focusedField}
              setFocusedField={setFocusedField}
              onSignatureClick={openSignatureModal}
              isViewOnly={isViewOnly}
              onDocumentLoadSuccess={handleDocumentLoadSuccess}
              scrollContainerRef={scrollContainerRef}
              onNextFieldClick={scrollToNextField}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-600">No PDF available</p>
            </div>
          )}

          {/* Finish Button */}
          {!isViewOnly && areAllAssignedFieldsFilled() && userRoles && userRoles.length > 0 && !hasSubmitted && (
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
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureModalOpen}
        onClose={() => setSignatureModalOpen(false)}
        signatureName={signatureName}
        setSignatureName={setSignatureName}
        legalAgreementChecked={legalAgreementChecked}
        setLegalAgreementChecked={setLegalAgreementChecked}
        onSave={saveSignature}
      />
    </div>
  )
}
