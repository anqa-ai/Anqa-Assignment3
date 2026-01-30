# Interface: SAQ Form

PCI SAQ Advisor - Interactive decision tree questionnaire to identify the correct PCI Self-Assessment Questionnaire (SAQ).

## Overview

This interface walks users through a branched questionnaire to determine which PCI DSS Self-Assessment Questionnaire (SAQ) applies to their merchant scenario:

- **SAQ A**: Fully outsourced e-commerce
- **SAQ B**: Standalone dial-out terminals
- **SAQ C-VT**: Hosted virtual terminal
- **SAQ D**: All other scenarios (full questionnaire)

## Features

- Interactive yes/no decision tree
- Progress tracking
- Answer history with ability to edit previous responses
- Styled results with next-step checklists
- Responsive design

## Usage

```javascript
import SAQForm, { getData, schema } from '@webapp/interface-saq-form';

// Fetch data
const data = await getData(context);

// Render
<SAQForm data={data} branding={branding} config={config} />
```

## Configuration

See `schema.json` for full configuration options:

```json
{
  "title": "PCI SAQ Advisor",
  "subtitle": "Interactive questionnaire...",
  "showProgress": true,
  "allowExport": true
}
```

## Testing

```bash
npm test
```

## License

Internal use only
