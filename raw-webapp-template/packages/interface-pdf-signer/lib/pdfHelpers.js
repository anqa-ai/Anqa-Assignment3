/**
 * PDF Helper Functions
 */

export const PDF_PAGE_WIDTH = 612
export const PDF_PAGE_HEIGHT = 792

/**
 * Ensure signature font styles are loaded
 */
export const ensureSignatureFontStyles = () => {
  if (typeof window === 'undefined') return
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

/**
 * Get unique field key from field object
 */
export const getFieldKey = (field) => {
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
 * Determine field type from field name
 */
export const getFieldType = (fieldName) => {
  const name = fieldName.toLowerCase()
  if (name.includes('sig')) return 'signature'
  if (name.includes('date')) return 'date'
  if (name.includes('name') || name.includes('title') || name.includes('company')) return 'text'
  return 'text'
}
