'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Theme } from '../lib/theme'
import { getFieldKey } from '../lib/pdfHelpers'
import FieldOverlay from './FieldOverlay'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'

/**
 * PDFViewer Component
 * Renders PDF with interactive field overlays
 */
const PDFViewer = ({
  pdfUrl,
  fieldCoordinates,
  userRoles,
  fieldValues,
  onFieldChange,
  focusedField,
  setFocusedField,
  onSignatureClick,
  isViewOnly = false,
  onDocumentLoadSuccess,
  scrollContainerRef,
  onNextFieldClick
}) => {
  const [numPages, setNumPages] = useState(null)
  const [pageWidth, setPageWidth] = useState(1286)
  const pdfContainerRef = useRef(null)

  const handleDocumentLoadSuccess = ({ numPages: pages }) => {
    setNumPages(pages)
    if (onDocumentLoadSuccess) {
      onDocumentLoadSuccess({ numPages: pages })
    }
  }

  // Dynamically scale PDF to container width
  useEffect(() => {
    if (!pdfContainerRef.current) return

    const updatePageWidth = () => {
      if (pdfContainerRef.current) {
        const containerWidth = pdfContainerRef.current.clientWidth
        const availableWidth = containerWidth * 0.95
        setPageWidth(availableWidth)
      }
    }

    updatePageWidth()

    const resizeObserver = new ResizeObserver(updatePageWidth)
    resizeObserver.observe(pdfContainerRef.current)

    window.addEventListener('resize', updatePageWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePageWidth)
    }
  }, [])

  // Get filtered fields based on user's assigned roles
  const getFilteredFields = (pageNumber) => {
    if (isViewOnly) {
      return []
    }

    // If no roles, show all fields (backward compatibility)
    if (!userRoles || userRoles.length === 0) {
      return fieldCoordinates.filter(f => f.page === pageNumber - 1)
    }

    // Filter fields to only show those for user's assigned roles
    return fieldCoordinates.filter(field => {
      return field.page === pageNumber - 1 && userRoles.includes(field.group)
    })
  }

  // Check if all fields are filled
  const areAllFieldsFilled = () => {
    if (isViewOnly) return true

    const allFilteredFields = fieldCoordinates.filter(field => {
      if (!userRoles || userRoles.length === 0) return true
      return userRoles.includes(field.group)
    })

    if (allFilteredFields.length === 0) return true

    return allFilteredFields.every(field => {
      const key = getFieldKey(field)
      const value = key ? fieldValues[key] : ''
      return value && value.trim() !== ''
    })
  }

  const allFieldsFilled = areAllFieldsFilled()

  return (
    <div ref={scrollContainerRef} className="h-full overflow-auto bg-slate-100 relative">
      {/* Next Button - Only show if not view-only and fields not all filled */}
      {!isViewOnly && !allFieldsFilled && onNextFieldClick && (
        <div 
          onClick={onNextFieldClick}
          className="sticky left-2 top-1/2 transform -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform z-50 float-left"
          style={{ marginTop: '50vh' }}
          title="Go to next field"
        >
          <svg width="160" height="53" viewBox="0 0 160 53" className="drop-shadow-lg">
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

      <div ref={pdfContainerRef} className="flex flex-col items-center pt-0 pb-4 gap-4 w-full">
        <div className="w-full" style={{ margin: 0, padding: 0, alignSelf: 'flex-start', lineHeight: 0 }}>
          <Document
            className="react-pdf-document"
            style={{ margin: 0, padding: 0 }}
            file={pdfUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mb-4"></div>
                <p className="text-slate-600">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center p-8">
                <div className={`${Theme.colors.error[50]} border ${Theme.colors.error.border[200]} ${Theme.borderRadius.md} p-6 max-w-md`}>
                  <h3 className="text-red-800 font-semibold mb-2">Error Loading PDF</h3>
                  <p className="text-red-600 text-sm">Failed to load PDF. Please try again.</p>
                </div>
              </div>
            }
          >
            {/* Render all pages */}
            {numPages && Array.from(new Array(numPages), (_, index) => {
              const pageNumber = index + 1
              const pageFields = getFilteredFields(pageNumber)

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
                  {pageFields.map((field) => (
                    <FieldOverlay
                      key={`field-${getFieldKey(field)}`}
                      field={field}
                      pageWidth={pageWidth}
                      fieldValues={fieldValues}
                      onFieldChange={onFieldChange}
                      focusedField={focusedField}
                      setFocusedField={setFocusedField}
                      onSignatureClick={onSignatureClick}
                      isViewOnly={isViewOnly}
                    />
                  ))}
                </div>
              )
            })}
          </Document>
        </div>
      </div>
    </div>
  )
}

export default PDFViewer
