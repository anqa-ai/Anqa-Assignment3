# Quick Reference Guide: Dual Deployment System

## 🎯 System Overview

**Purpose**: Enable live preview during interface development + production serving for workflow executions

**Key URLs**:
- **Preview**: `https://client-a.anqa.ai/{interface_uuid}`
- **Production**: `https://client-a.anqa.ai/i/{workflow_uuid}/{node_uuid}/{execution_uuid}`

---

## 📂 Repository Structure

```
templates/raw-client-template/webapp-interfaces/
├── .gitattributes                    # Merge strategy for branch-specific files
├── DUAL_DEPLOYMENT_IMPLEMENTATION_PLAN.md  # Full implementation plan
├── ARCHITECTURE_DECISIONS.md         # Architecture decisions record
│
├── .github/workflows/
│   ├── dev.yml                       # dev branch: Webhook → git pull in container
│   └── main.yml                      # main branch: Trigger CodeBuild
│
├── buildspec-dev.yml                 # Dev build: npm run dev (hot reload)
├── buildspec-prod.yml                # Prod build: npm run build (optimized)
│
├── Dockerfile.dev                    # Dev container with git + hot reload
├── Dockerfile.prod                   # Prod container (multi-stage optimized)
│
├── renderer/
│   ├── .env.dev                      # Dev environment vars
│   ├── .env.production               # Production environment vars
│   │
│   └── app/
│       ├── [...segments]/page.js    # Dual routing logic (preview + production)
│       └── api/
│           └── submit/[execution_uuid]/[node_uuid]/route.js  # Form submission
│
└── packages/
    └── [interface-packages]/         # Interface implementations
```

---

## 🏗️ Infrastructure Components

### ECS Services in `client-a-cluster`

| Service | Purpose | Port | Resources | Update Strategy |
|---------|---------|------|-----------|----------------|
| `client-a-api-service` | API endpoints | 8080 | 256/512 | CodeBuild |
| `client-a-interface-preview` | Live preview (dev branch) | 3001 | 512/1024 | Git webhook |
| `client-a-interface-production` | Production serving (main) | 3000 | 256/512 | CodeBuild |

### ALB Routing Rules

| Priority | Pattern | Target | Purpose |
|----------|---------|--------|---------|
| 5 | `/i/*/*/*` | interface-production-service | Workflow execution interfaces |
| 10 | `/*` (not `/i/*`) | interface-preview-service | Interface preview |
| 100 | `*` | api-service | API fallback |

### CodeBuild Projects

| Project | Branch | Buildspec | Trigger | Deploy To |
|---------|--------|-----------|---------|-----------|
| `client-a-interface-preview` | dev | buildspec-dev.yml | Push to dev | TASK A (preview) |
| `client-a-interface-production` | main | buildspec-prod.yml | Push to main | TASK B (production) |

---

## 🔧 Key Configuration Files

### `.gitattributes` (Branch Protection)

```bash
# Prevent merge conflicts for deployment configs
.github/workflows/main.yml merge=ours
buildspec.yml merge=ours
Dockerfile merge=ours
docker-compose.yml merge=ours
renderer/.env.* merge=ours
```

**How it works**: During merge, Git keeps "our" version (target branch) for these files

### `buildspec-dev.yml` (TASK A - Preview)

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install
  build:
    commands:
      - echo "Starting dev server in background"
      - npm run dev &
      - sleep infinity  # Keep container running
```

### `buildspec-prod.yml` (TASK B - Production)

```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - npm install --production
  build:
    commands:
      - npm run build
      - docker build -f Dockerfile.prod -t $ECR_REPOSITORY:$BUILD_NUMBER .
      - docker push $ECR_REPOSITORY:$BUILD_NUMBER
  post_build:
    commands:
      - aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment
```

---

## 🗄️ Database Schema

### `workflow_execution_nodes` (Existing - No Changes Needed)

**Key Interface Fields**:
```sql
interface_package TEXT,                  -- e.g., @webapp/interface-invoice
interface_uuid TEXT,                     -- Interface registry UUID
interface_url TEXT,                      -- Generated production URL
interface_response BYTEA,                -- ENCRYPTED: User submission
interface_opened_at TIMESTAMPTZ,
interface_submitted_at TIMESTAMPTZ,
assigned_user_id BYTEA,                  -- ENCRYPTED: Assigned user
```

### `interface_registry` (New Table)

**Purpose**: Track interface development/preview versions

```sql
CREATE TABLE interface_registry (
    interface_uuid UUID PRIMARY KEY,
    interface_name TEXT NOT NULL,
    interface_package TEXT NOT NULL,       -- npm package name
    interface_version TEXT DEFAULT '1.0.0',
    status TEXT DEFAULT 'draft',           -- draft, published, archived
    git_branch TEXT DEFAULT 'dev',
    git_commit_hash TEXT,
    config JSONB DEFAULT '{}',
    schema JSONB DEFAULT '{}',
    branding JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 API Endpoints

### Interface Management

```python
# Create interface in registry
POST /interfaces/create
{
    "interface_name": "Customer Registration",
    "interface_package": "@webapp/interface-customer-reg",
    "config": {...},
    "schema": {...}
}
→ Returns: { "interface_uuid": "abc-123" }

# Get interface for preview
GET /interfaces/{interface_uuid}
→ Returns: Interface configuration + package name

# Publish interface (merge dev → main)
POST /interfaces/{interface_uuid}/publish
→ Triggers: Git merge + CodeBuild + TASK B deployment
```

### Workflow Execution Interfaces

```python
# Generate interface URL for execution node
POST /workflow-executions/{execution_uuid}/nodes/{node_uuid}/generate-url
→ Returns: "https://client-a.anqa.ai/i/{wf_uuid}/{node_uuid}/{exec_uuid}"

# Get execution node for rendering
GET /workflow-executions/{execution_uuid}/nodes/{node_uuid}
→ Returns: Interface package, config, workflow context

# Submit interface response
PATCH /workflow-executions/{execution_uuid}/nodes/{node_uuid}/submit
{
    "response_data": {...}
}
→ Updates: workflow_execution_nodes.interface_response (encrypted)
→ Triggers: Workflow continuation
```

---

## 🔄 Deployment Flows

### Preview Update Flow (TASK A)

```
1. Developer pushes to 'dev' branch
   ↓
2. GitHub webhook triggers Lambda
   ↓
3. Lambda executes command on TASK A container:
   $ cd /app && git pull origin dev && npm install
   ↓
4. Next.js dev server detects changes, hot reloads
   ↓
5. Preview updates in Interface Customization Modal iframe
   
⏱️ Total time: ~10 seconds
```

### Production Deploy Flow (TASK B)

```
1. User clicks "Publish" in Interface Customization Modal
   ↓
2. Frontend calls POST /interfaces/{uuid}/publish
   ↓
3. API executes:
   - git merge dev → main
   - Trigger CodeBuild project
   - Update interface_registry.status = 'published'
   ↓
4. CodeBuild:
   - Checkout main branch
   - npm install --production
   - npm run build (Next.js standalone)
   - Build Docker image
   - Push to ECR
   - Update ECS service (TASK B)
   ↓
5. ECS performs blue-green deployment
   
⏱️ Total time: ~5 minutes
```

---

## 🔐 Security Checklist

- [ ] ALB enforces Cognito authentication
- [ ] JWT validation in Next.js renderer
- [ ] interface_response encrypted before storage
- [ ] assigned_user_id encrypted in database
- [ ] GitHub webhook signature verification
- [ ] ECS task IAM roles with least privilege
- [ ] Secrets Manager for sensitive config
- [ ] Security group isolation (preview vs production)
- [ ] Audit logging enabled for all interface actions

---

## 🧪 Testing Guide

### Test Preview Update

```bash
# 1. Make change in dev branch
cd /home/ubuntu/dev/templates/raw-client-template/webapp-interfaces
git checkout dev
echo "// Test change" >> packages/interface-invoice/render.jsx
git commit -m "test: preview update" && git push

# 2. Wait 10 seconds

# 3. Check preview
curl https://client-a.anqa.ai/{test-interface-uuid}
# Should see updated content
```

### Test Production Deploy

```bash
# 1. Trigger publish via API
curl -X POST https://client-a.api.anqa.ai/interfaces/{uuid}/publish \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json"

# 2. Monitor CodeBuild
aws codebuild batch-get-builds --ids $BUILD_ID

# 3. Wait ~5 minutes

# 4. Check production
curl https://client-a.anqa.ai/i/wf-123/node-456/exec-789
# Should see published version
```

### Test Workflow Interface

```bash
# 1. Create workflow execution with interface node
curl -X POST https://client-a.api.anqa.ai/workflow-executions \
  -d '{ "workflow_uuid": "...", "nodes": [...] }'

# 2. Get interface URL for node
curl https://client-a.api.anqa.ai/workflow-executions/{exec_uuid}/nodes/{node_uuid}/generate-url

# 3. Visit URL in browser
# Should render interface with workflow context

# 4. Submit form
# Should update workflow_execution_nodes and continue workflow
```

---

## 🚨 Troubleshooting

### Preview Not Updating

```bash
# Check ECS task logs
aws logs tail /aws/ecs/client-a-interface-preview --follow

# Check git webhook logs
aws logs tail /aws/lambda/interface-preview-webhook --follow

# Manual update
aws ecs execute-command \
  --cluster client-a-cluster \
  --task ${TASK_ARN} \
  --container interface-preview \
  --command "cd /app && git pull origin dev && npm install" \
  --interactive
```

### Production Deploy Failed

```bash
# Check CodeBuild logs
aws codebuild batch-get-builds --ids $BUILD_ID

# Check ECS deployment
aws ecs describe-services \
  --cluster client-a-cluster \
  --services client-a-interface-production

# Rollback if needed
aws ecs update-service \
  --cluster client-a-cluster \
  --service client-a-interface-production \
  --task-definition ${PREVIOUS_TASK_DEF_ARN} \
  --force-new-deployment
```

### Interface Not Loading

```bash
# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn ${TARGET_GROUP_ARN}

# Check Next.js logs
aws logs tail /aws/ecs/client-a-interface-* --follow

# Verify routing
curl -v https://client-a.anqa.ai/{interface_uuid}
# Check X-Forwarded-* headers and response
```

---

## 📊 Monitoring Dashboards

### CloudWatch Metrics to Track

**TASK A (Preview)**:
- `GitPullSuccess` - Webhook-triggered updates
- `HotReloadTime` - Time to reflect changes
- `ContainerRestarts` - Stability metric

**TASK B (Production)**:
- `DeploymentDuration` - CodeBuild → ECS deploy time
- `InterfaceRenderTime` - Page load performance
- `FormSubmissionRate` - Interface interactions

**Both**:
- `TargetHealthyHostCount` - Service availability
- `RequestCount` - Traffic patterns
- `4XXErrorRate` - Client errors
- `5XXErrorRate` - Server errors

---

## 🔗 Related Documentation

- **Full Implementation Plan**: [DUAL_DEPLOYMENT_IMPLEMENTATION_PLAN.md](./DUAL_DEPLOYMENT_IMPLEMENTATION_PLAN.md)
- **Architecture Decisions**: [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md)
- **Integration Guide**: [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md)
- **Interface Development**: [interface-repo-roadmap.md](./interface-repo-roadmap.md)

---

## 🆘 Support Contacts

- **Platform Team**: #platform-team
- **DevOps**: #devops-support
- **On-Call**: PagerDuty rotation

---

**Last Updated**: October 3, 2025  
**Maintained By**: Platform Team
