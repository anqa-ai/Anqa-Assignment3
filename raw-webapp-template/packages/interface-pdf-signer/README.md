# Interface: PDF Signer

A standalone full-page PDF signature interface extracted from the SAQ form modal component.

## Overview

This interface provides a complete PDF viewing and signing experience with:

- **Interactive PDF rendering** with react-pdf
- **Role-based field access** - users only see fields assigned to their roles
- **Electronic signature capture** with legal agreement
- **Field type detection** - signatures, dates, and text fields
- **Auto-date population** for date fields
- **Navigation** - "Next" button to scroll through fields
- **Submission tracking** - persistent success banner after submission
- **View-only mode** for users who have already signed

## Component Structure

```
interface-pdf-signer/
├── index.js                    # getData() server-side data fetching
├── render.jsx                  # Main component (full-page interface)
├── schema.json                 # Configuration schema
├── package.json
├── components/
│   ├── PDFViewer.jsx          # PDF rendering with react-pdf
│   ├── FieldOverlay.jsx       # Interactive field overlays
│   ├── SignatureModal.jsx     # Signature capture modal
│   └── ThankYouBanner.jsx     # Success message banner
└── lib/
    ├── theme.js               # Design system tokens
    ├── apiHelpers.js          # API utility functions
    └── pdfHelpers.js          # PDF coordinate & field helpers
```

## Configuration

The interface requires the following config in `mock-nodes.json`:

```json
{
  "config": {
    "documentUuid": "uuid-of-document",
    "questionnaireAnswerUuid": "uuid-of-questionnaire-answer",
    "saqName": "SAQ A"
  }
}
```

### Required Config

- **documentUuid** (required): UUID of the PDF document to display
- **questionnaireAnswerUuid** (optional): UUID for role assignments
- **saqName** (optional): Display name (defaults to "SAQ")

## Data Flow

1. **Server-side (getData)**: Fetches PDF, field coordinates, and user roles
2. **Client-side (render)**: Displays PDF with interactive overlays
3. **User interaction**: Fill fields, capture signatures
4. **Submission**: POST to `/documents/submit-signature` API
5. **Success**: Display persistent banner, disable further editing

## Role-Based Field Filtering

Fields are filtered based on the `group` property in field coordinates:

- If user has roles `["lead_qsa"]`, only fields with `group: "lead_qsa"` are shown
- If no roles assigned, user sees view-only mode
- If no questionnaire UUID, all fields are shown (backward compatibility)

## API Endpoints

### getData (Server-side)

- `POST /documents/get-from-s3` - Fetch PDF blob (base64 or binary)
- `POST /documents/get-document` - Fetch field coordinates metadata
- `POST /questionnaire-answers/get-questionnaire-answer` - Fetch user roles

### Render (Client-side)

- `POST /documents/submit-signature` - Submit signatures and field values

## Field Types

The interface automatically detects field types based on field names:

- **Signature fields**: Contains "sig" in name → Opens signature modal
- **Date fields**: Contains "date" in name → Auto-filled with today's date
- **Text fields**: Other fields → Standard text input

## Dependencies

- `react-pdf: ^10.3.0` - PDF rendering (includes pdfjs-dist)
- `@webapp/interface-sdk` - Interface utilities

## Worker Configuration

PDF.js worker is loaded from `/public/pdf.worker.mjs` (already in renderer).

## Signature Font

Uses Google Fonts "Cedarville Cursive" for signature styling, loaded via stylesheet injection.

## Testing

Access the interface at: `http://localhost:3001/demo-pdf-signer-886`

**Note**: Replace placeholder UUIDs in `mock-nodes.json` with real document and questionnaire UUIDs for testing.

## Key Differences from Original Modal

| Original Modal | New Interface |
|----------------|---------------|
| Modal overlay with trigger button | Full-page standalone interface |
| Opens via button click | Direct URL access |
| Rendered via Portal | Normal React rendering |
| Parent callback for reload | Persistent success banner |
| Embedded in SAQ form | Independent package |

## Future Enhancements

- Server-side auth integration for `getCurrentUserEmail()`
- Schema-based configuration options
- Enhanced error handling and UI
- Real-time collaboration tracking
- Mobile-responsive optimizations
