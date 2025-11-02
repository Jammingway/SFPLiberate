# Next.js Rewrite - Quick Reference

## 📋 Overview

**Epic:** Complete frontend rewrite with Next.js 16 + shadcn/ui
**Duration:** 12 weeks (3 months)
**Total Stories:** 25 stories across 7 phases

## 🎯 Key Objectives

1. ✅ **100% Feature Parity** - All BLE functionality (direct + proxy) maintained
2. ✅ **Dual Deployment** - Standalone (Docker) + Appwrite Cloud (separate branches)
3. ✅ **Modern Stack** - Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
4. ✅ **Replace NGINX** - Next.js handles all routing and serving
5. ✅ **Type Safety** - Full TypeScript strict mode coverage

## 🏗️ Architecture Comparison

### Current (Vanilla JS + NGINX)
```
Browser → NGINX (reverse proxy) → FastAPI Backend
  ↓
Vanilla JS (script.js, 1264 lines)
```

### New (Next.js Standalone)
```
Browser → Next.js Server (port 3000) → FastAPI Backend
  ↓
React Components + TypeScript + shadcn/ui
```

### New (Appwrite Cloud)
```
Browser → Appwrite Static Hosting → FastAPI Backend (VPS)
  ↓            ↓
  └─ Appwrite Auth (cookies)
```

## 📦 Deployment Modes (Feature Flag Based)

| Aspect | Standalone | Appwrite Cloud |
|--------|-----------|----------------|
| **Branch** | `main` (single branch) | `main` (single branch) |
| **Feature Flag** | `DEPLOYMENT_MODE=standalone` | `DEPLOYMENT_MODE=appwrite` |
| **Output** | Standalone server | Static export |
| **Auth** | None (`ENABLE_AUTH=false`) | Appwrite native (`ENABLE_AUTH=true`) |
| **Hosting** | Docker (self-hosted) | Appwrite Cloud |
| **API** | Proxied via Next.js | Direct to external backend |
| **Deployment** | `docker-compose up` | GitHub Actions → Appwrite CLI |
| **Build** | `npm run build` | `DEPLOYMENT_MODE=appwrite npm run build` |

## 📅 Implementation Timeline

```
Week 1-2:   Phase 1 - Foundation (Stories 1-5)
            ├─ Project setup, API client, BLE service layer
            └─ Layout, navigation, connection status

Week 3-4:   Phase 2 - Core BLE (Stories 6-10)
            ├─ Device connection & discovery
            └─ Read/write operations, status monitoring

Week 5-6:   Phase 3 - Module Library (Stories 11-13)
            ├─ DataTable with search/sort/pagination
            └─ Module detail view, save flow

Week 7-8:   Phase 4 - Features (Stories 14-17)
            ├─ Community upload/browse
            └─ Import/export, toast notifications

Week 9:     Phase 5 - Standalone Deploy (Stories 18-19)
            ├─ Docker configuration
            └─ E2E tests with Playwright

Week 10-11: Phase 6 - Appwrite Deploy (Stories 20-23)
            ├─ Authentication integration
            ├─ Static export config
            └─ CI/CD pipeline

Week 12:    Phase 7 - Polish (Stories 24-25)
            ├─ Accessibility audit (WCAG AA)
            └─ Documentation & migration guide
```

## 🧩 Story Breakdown by Priority

### P0 (Blockers) - 8 stories
- STORY-001: Project Scaffolding
- STORY-002: API Client & Types
- STORY-003: BLE Service Layer
- STORY-006: Device Connection Flow
- STORY-008: SFP Read Operation
- STORY-018: Docker Configuration
- STORY-020: Appwrite Auth Setup
- STORY-021: Appwrite Static Export

### P1 (High) - 12 stories
- STORY-004: Layout & Navigation
- STORY-005: Connection Status Dashboard
- STORY-007: Device Discovery
- STORY-009: SFP Write Operation
- STORY-011: Module Library DataTable
- STORY-013: Save Module Flow
- STORY-017: Log Console & Toasts
- STORY-019: E2E Testing
- STORY-022: Appwrite Deployment Workflow
- STORY-023: Backend CORS Config
- STORY-025: Documentation

### P2 (Medium) - 5 stories
- STORY-010: Status Monitoring
- STORY-012: Module Detail View
- STORY-014: Community Submission
- STORY-015: Community Browser
- STORY-016: Import/Export
- STORY-024: Accessibility Audit

## 🛠️ Tech Stack

### Core Framework
- **Next.js 16** (App Router, standalone/static export)
- **React 19** (Server Components, Suspense)
- **TypeScript 5** (strict mode)
- **Tailwind CSS 4**

### UI Library
- **shadcn/ui** (25+ components)
  - DataTable (TanStack Table)
  - Dialog, Toast, Sheet
  - Command Palette
  - Form components

### Data Fetching
- **React Query** or **SWR** (optional, recommended)
- Native fetch with TypeScript wrappers

### Testing
- **Jest** + **React Testing Library** (unit/integration)
- **Playwright** (E2E tests)

### Deployment
- **Docker** (standalone mode)
- **Appwrite CLI** (cloud mode)
- **GitHub Actions** (CI/CD)

## 📊 Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| TypeScript strict mode | 100% | 🎯 Plan |
| Test coverage | 80%+ | 🎯 Plan |
| Lighthouse Accessibility | ≥90 | 🎯 Plan |
| E2E tests (critical paths) | 7+ tests | 🎯 Plan |
| BLE feature parity | 100% | 🎯 Plan |
| Responsive (viewports) | 320px-1920px | 🎯 Plan |

## 🚀 Quick Start (After Implementation)

### Standalone Mode (Docker)
```bash
# Clone repo (single main branch)
git clone https://github.com/josiah-nelson/SFPLiberate

# Start full stack with feature flags
DEPLOYMENT_MODE=standalone docker-compose up --build

# Access app
open http://localhost:8080
```

### Appwrite Mode (Cloud)
```bash
# Clone repo (same main branch)
git clone https://github.com/josiah-nelson/SFPLiberate

# Install dependencies
cd frontend-nextjs && npm install

# Build static export with feature flag
DEPLOYMENT_MODE=appwrite \
NEXT_PUBLIC_ENABLE_AUTH=true \
npm run build

# Deploy to Appwrite
appwrite deploy
```

### Hybrid Mode (Bonus: Standalone BLE Proxy + Appwrite UI)
```bash
# Run standalone BLE proxy on local machine
docker run -d -p 8081:8081 \
  --name sfp-ble-proxy \
  ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest

# Open Appwrite UI on iOS/Safari
# Go to Settings → BLE Proxy Configuration
# Enter: ws://YOUR_LOCAL_IP:8081/ble/ws

# Now use public Appwrite UI with local SFP Wizard!
```

## 📚 Key Documentation

- **[Epic Plan](NEXTJS_REWRITE_EPIC.md)** - Full epic with 25 stories
- **[GitHub Issues Guide](GITHUB_ISSUES_GUIDE.md)** - How to create and manage issues
- **[File Structure](NEXTJS_FILE_STRUCTURE.md)** - Migration mapping (old → new)
- **[Roadmap](NEXTJS_ROADMAP.md)** - Visual timeline and dependencies
- **[Standalone BLE Proxy](STANDALONE_BLE_PROXY_SERVICE.md)** - Bonus feature spec
- **[Migration Guide](NEXTJS_MIGRATION_GUIDE.md)** - Old vs new comparison (to be created)
- **[Frontend README](../frontend-nextjs/README.md)** - Developer guide (to be created)

## ⚠️ Risks & Mitigations

### High Risks
1. **Web Bluetooth API compatibility**
   - Mitigation: Maintain BLE proxy; test early
2. **Appwrite static export limitations**
   - Mitigation: Test static mode in Phase 6
3. **CORS with external backend**
   - Mitigation: Configure CORS properly (STORY-023)

### Medium Risks
1. **Scope creep**
   - Mitigation: Freeze scope after Phase 4
2. **Timeline delays**
   - Mitigation: Track velocity, adjust estimates

## 🎬 Next Actions

1. ✅ Review epic plan with team
2. ⏳ Create GitHub issues (see [GitHub Issues Guide](GITHUB_ISSUES_GUIDE.md)):
   - Create parent epic issue from `.github/issues/EPIC-001-nextjs-rewrite.md`
   - Create all 25 story issues + 1 bonus feature
   - Link dependencies
   - Add labels and priorities
3. ⏳ Kick off STORY-001 (Project Scaffolding)
4. ⏳ Weekly sync meetings
5. ⏳ Track progress via issue labels and epic updates

---

**Created:** 2025-11-02
**Last Updated:** 2025-11-02
**Epic Document:** [NEXTJS_REWRITE_EPIC.md](NEXTJS_REWRITE_EPIC.md)
