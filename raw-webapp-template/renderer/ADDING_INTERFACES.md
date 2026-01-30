# Adding New Interface Packages

When you need to add a new interface package to the renderer, follow these **3 simple steps**:

## 1. Create the Interface Package

Create your interface package in `packages/interface-{name}/`:

```bash
packages/
  interface-{name}/
    package.json      # Must have "name": "@webapp/interface-{name}"
    index.js          # Export default or named Interface component
    render.jsx        # React component
    schema.json       # Interface schema (optional)
```

**Note:** Root package.json auto-detects packages via `packages/*` glob pattern.

## 2. Add to Renderer Dependencies

Edit `renderer/package.json` and add:

```json
{
  "dependencies": {
    "@webapp/interface-{name}": "file:../packages/interface-{name}"
  }
}
```

## 3. Register the Interface (2 Edits)

### A. Edit `renderer/lib/interface-registry.js`

Add **2 lines** (copy-paste pattern):

```javascript
// ========== SECTION 1: Static Imports ==========
import * as InterfaceYourName from '@webapp/interface-{name}'; // ← ADD THIS

// ========== SECTION 2: Registry Mapping ==========
export const interfaceRegistry = {
  // ... existing packages ...
  '@webapp/interface-{name}': InterfaceYourName, // ← ADD THIS
};
```

### B. Edit `renderer/next.config.js`

Add **1 line** to `transpilePackages` array:

```javascript
transpilePackages: [
  // ... existing packages ...
  '@webapp/interface-{name}', // ← ADD THIS
],
```

## 4. Rebuild & Deploy

```bash
# Local development
npm install
docker compose up --build

# Production (triggers CodeBuild)
git add .
git commit -m "feat: add interface-{name}"
git push
```

---

## Why Static Imports? 🤔

### The Problem
Next.js uses **build-time static analysis** to determine what code to include in the production bundle. When you write:

```javascript
// ❌ DOESN'T WORK - Variable evaluated at runtime
const packageName = '@webapp/interface-saq-form';
const module = await import(packageName);
```

Next.js sees `import(packageName)` during build but **doesn't know the value** of `packageName` yet (it's a runtime variable). So it doesn't include the package → `MODULE_NOT_FOUND` in production.

### The Solution
```javascript
// ✅ WORKS - Literal string analyzed at build time
import * as InterfaceSaqForm from '@webapp/interface-saq-form';
```

Next.js sees the **exact string** `'@webapp/interface-saq-form'` during build and includes it in the bundle.

### Why Can't We Make It Fully Dynamic?

| Approach | When Analysis Happens | Works? |
|----------|----------------------|--------|
| `import(variable)` | Runtime (too late) | ❌ Package not bundled |
| `import('literal')` | Build time | ✅ Package bundled |

**Build time** happens **before** runtime, so build-time tools can't see runtime values.

---

## Architecture: Standalone Mode

We use **Next.js standalone mode** for optimal production builds:

```dockerfile
# Dockerfile.prod copies only what's needed:
COPY --from=builder /app/renderer/.next/standalone ./  # Optimized bundle
COPY --from=builder /app/renderer/.next/static ./      # Static assets
COPY --from=builder /app/packages ./packages           # Interface packages
```

### Benefits
- ✅ **Smallest image** (~200MB vs ~400MB full workspace)
- ✅ **Fastest startup** (pre-optimized code)
- ✅ **Production-ready** (follows Next.js best practices)

### Trade-off
- ⚠️ Requires static imports (3 files to edit per interface)

---

## Trade-offs Summary

| Approach | Scalability | Image Size | Speed | Files to Edit |
|----------|-------------|------------|-------|---------------|
| **Standalone + Static Registry** ✅ | ⭐⭐⭐ | Small (200MB) | Fast | 3 files |
| Full Workspace | ⭐⭐⭐⭐ | Large (400MB) | Slower | 2 files |
| True Dynamic Imports | ⭐⭐⭐⭐⭐ | N/A | N/A | **Impossible** |

**Current choice:** Standalone + Static Registry = Best balance of performance and maintainability.

---

## Quick Reference

**New interface checklist:**
- [ ] Create `packages/interface-{name}/`
- [ ] Add to `renderer/package.json` dependencies
- [ ] Add import to `renderer/lib/interface-registry.js` (Section 1)
- [ ] Add mapping to `renderer/lib/interface-registry.js` (Section 2)
- [ ] Add to `renderer/next.config.js` transpilePackages
- [ ] Run `docker compose up --build`
- [ ] Test at `/e/{token}` route
