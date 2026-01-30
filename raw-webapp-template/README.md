# RAW Webapp Template

A minimal template for building client-specific web interfaces with Next.js. This template provides the core infrastructure for rendering dynamic interfaces through a URL-based routing system.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start with Docker (recommended)
docker compose up --build

# OR start development mode
cd renderer
npm run dev

# Visit http://localhost:3005
```

---

## 📁 Repository Structure

```
raw-webapp-template/
├── packages/
│   ├── interface-sdk/              # Core SDK utilities
│   ├── interface-pdf-signer/       # PDF signature interface
│   └── interface-saq-form/         # PCI SAQ questionnaire interface
│
├── renderer/                       # Next.js renderer service
│   ├── app/
│   │   ├── [node_uuid]/page.js    # Dynamic interface routing
│   │   ├── e/[token]/             # Email token authentication
│   │   ├── i/[instanceUUID]/      # Instance-based routing
│   │   └── api/                   # API routes (auth, health, proxy)
│   └── lib/
│       ├── interface-loader.js    # Interface loading logic
│       ├── interface-registry.js  # Interface registry
│       └── auth.js                # Authentication helpers
│
├── Dockerfile.prod                 # Production Docker image
├── docker-compose.yml              # Local development setup
└── buildspec-prod.yml              # AWS CodeBuild configuration
```

---

## 🏗️ How It Works

The system uses URL-based routing to dynamically load and render interfaces:

```
User visits URL → Renderer fetches config → Loads interface module → Renders React component
       ↓                    ↓                       ↓                        ↓
/{node_uuid}         API: /nodes/{uuid}    Dynamic import()         Interface UI + Data
```

**Key Concepts:**

- **Interfaces** are standalone packages in `packages/` with React components and data fetching logic
- **Node UUIDs** map to specific interface instances with custom configuration
- **Dynamic loading** allows interfaces to be rendered without rebuilding the renderer
- **API integration** fetches configuration and data from ANQA API

---

## 🔧 Interface Contract

Each interface package exports three things:

```javascript
// index.js
export { default } from './render.jsx';     // React component
export { schema };                          // Configuration schema (JSON Schema)
export async function getData(ctx) {        // Server-side data fetching
  // Fetch and return data for the interface
  return data;
}
```

**Interface Context** passed to components and `getData()`:

```javascript
{
  nodeUUID: "abc-123",
  user: { id: "user_id", roles: ["role.access"] },
  params: { /* URL/query parameters */ },
  api: { baseUrl: "https://api.anqa.ai", authToken: "..." },
  branding: { /* client-specific styling */ }
}
```

---

## 🌐 Available Routes

### Main Routes
- `/{node_uuid}` - Render interface for a specific node
- `/e/{token}` - Email token authentication flow
- `/i/{instanceUUID}` - Instance-based interface rendering

### API Routes
- `/api/health` - Health check endpoint
- `/api/nodes/{uuid}` - Fetch node configuration
- `/api/auth/*` - Authentication endpoints (OTP initiation/verification)
- `/api/proxy/*` - Authenticated API proxy
- `/api/proxy-public/*` - Public API proxy

---

## 🎨 Included Interfaces

### 1. PDF Signer (`@webapp/interface-pdf-signer`)
Interactive PDF viewing and signature capture with role-based field access.

**Features:**
- PDF rendering with react-pdf
- Electronic signature capture
- Field type detection (signature, date, text)
- Auto-date population
- Submission tracking

### 2. SAQ Form (`@webapp/interface-saq-form`)
PCI DSS Self-Assessment Questionnaire advisor with branching logic.

**Features:**
- Interactive decision tree
- Progress tracking
- Answer history with editing
- Styled results with checklists
- Determines applicable SAQ type (A, B, C-VT, or D)

---

## 🚀 Docker Deployment

### Local Development

```bash
# Set environment variables in .env file
cp .env.example .env

# Start the service
docker compose up --build

# Access at http://localhost:3005
```

### Production Build

```bash
# Build production image
docker build -f Dockerfile.prod -t webapp-renderer .

# Run container
docker run -p 3005:3000 \
  -e CLIENT_API_URL=https://api.anqa.ai \
  -e API_KEY=your_api_key \
  webapp-renderer
```

**Environment Variables:**
- `CLIENT_API_URL` - ANQA API base URL
- `API_KEY` - API authentication key
- `CLIENT_UUID` - Client identifier
- `PORT` - Internal container port (default: 3000)
- `HOST_PORT` - External host port (default: 3005)

---

## 🔐 Authentication

The template supports multiple authentication methods:

- **Email OTP** - One-time password sent via email
- **Token-based** - JWT tokens for session management
- **AWS Cognito** - Integration with AWS Cognito identity provider

Authentication is handled through the `/api/auth` endpoints with session management.

---

## 🧪 Development

### Run Tests
```bash
npm test                    # Run all tests
npm run lint               # ESLint checks
npm run format             # Prettier formatting
```

### Adding New Interfaces

1. Create a new package in `packages/interface-{name}/`
2. Implement the interface contract (render.jsx, getData(), schema.json)
3. Register it in `renderer/lib/interface-registry.js`
4. Add configuration for a node UUID via the ANQA API

---

## 📋 Configuration

### Interface Registry

Interfaces are registered in `renderer/lib/interface-registry.js`:

```javascript
const INTERFACE_REGISTRY = {
  '@webapp/interface-pdf-signer': () => 
    import('@webapp/interface-pdf-signer'),
  '@webapp/interface-saq-form': () => 
    import('@webapp/interface-saq-form'),
};
```

### Node Configuration

Node-to-interface mappings are fetched from the ANQA API:

```json
{
  "node_uuid": "abc-123",
  "interface": "@webapp/interface-pdf-signer",
  "config": { /* interface-specific config */ },
  "policy": { "roles": ["user.sign"] }
}
```

---

## 📚 Additional Documentation

- See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for deployment architecture details
- See individual interface READMEs in `packages/` for interface-specific documentation
- See [Next.js Documentation](https://nextjs.org/docs) for framework details

---

**Template Version**: 1.0.0  
**Next.js Version**: 14.2.5  
**Node Version**: 18+