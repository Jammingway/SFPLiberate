# [EPIC-001] Next.js Frontend Rewrite with shadcn/ui

**Epic ID:** EPIC-001
**Status:** 📋 Planning
**Priority:** P0 (Critical)
**Story Points:** 125
**Target Date:** 2025-03-01 (12 weeks)

---

## 📋 Overview

Complete frontend rewrite replacing vanilla JavaScript + NGINX with Next.js 16 SPA utilizing shadcn/ui components. Support two deployment modes via feature flags:
1. **Standalone** (Docker, self-hosted, no auth)
2. **Appwrite Cloud** (static export, Appwrite native auth with cookies)

## 🎯 Objectives

- ✅ **100% BLE Feature Parity** - Maintain all Web Bluetooth + proxy functionality
- ✅ **Dual Deployment via Feature Flags** - Single codebase, environment-driven builds
- ✅ **Modern Stack** - Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
- ✅ **Replace NGINX** - Next.js handles all routing, API proxying, static serving
- ✅ **Type Safety** - Full TypeScript strict mode coverage
- ✅ **Rich UI** - DataTables, dialogs, toasts, command palette, spinners

## ✅ Success Criteria

### Must-Have (P0)
- [ ] 100% BLE feature parity (direct Web Bluetooth + proxy modes)
- [ ] Standalone deployment works (Docker Compose, no auth)
- [ ] Appwrite deployment works (static export, native auth)
- [ ] All TypeScript in strict mode (zero errors)
- [ ] E2E tests passing for critical paths (7+ tests)

### Should-Have (P1)
- [ ] DataTable with search/sort/pagination
- [ ] Toast notifications + log drawer
- [ ] Command palette (Cmd+K)
- [ ] Lighthouse Accessibility score ≥ 90
- [ ] Responsive design (320px-1920px)
- [ ] Comprehensive documentation

### Nice-to-Have (P2)
- [ ] Community upload/browse features
- [ ] Import/export (CSV/ZIP)
- [ ] 80%+ test coverage
- [ ] Video walkthrough

## 📊 Phases & Story Breakdown

### Phase 1: Foundation (Weeks 1-2) - 21 points
- #XXX STORY-001: Project Scaffolding & Base Configuration (3 pts) - P0
- #XXX STORY-002: API Client & Type Definitions (5 pts) - P0
- #XXX STORY-003: BLE Service Layer (TypeScript Migration) (8 pts) - P0
- #XXX STORY-004: Layout & Navigation Components (3 pts) - P1
- #XXX STORY-005: Connection Status Dashboard (5 pts) - P1

**Deliverables:** Project scaffolded, API client, BLE layer, basic UI

### Phase 2: Core BLE Functionality (Weeks 3-4) - 29 points
- #XXX STORY-006: Device Connection Flow (8 pts) - P0
- #XXX STORY-007: Device Discovery (Web Bluetooth & Proxy) (8 pts) - P1
- #XXX STORY-008: SFP Read Operation & Live Data Display (5 pts) - P0
- #XXX STORY-009: SFP Write Operation with Safety Warnings (8 pts) - P1
- #XXX STORY-010: Status Monitoring & Device Info (3 pts) - P2

**Deliverables:** Connection flow, discovery, read/write, status monitoring

### Phase 3: Module Library UI (Weeks 5-6) - 16 points
- #XXX STORY-011: Module Library DataTable (8 pts) - P1
- #XXX STORY-012: Module Detail View & EEPROM Viewer (5 pts) - P2
- #XXX STORY-013: Save Module Flow (3 pts) - P1

**Deliverables:** DataTable, module detail, save flow

### Phase 4: Additional Features (Weeks 7-8) - 21 points
- #XXX STORY-014: Community Module Submission (5 pts) - P2
- #XXX STORY-015: Community Module Browser (8 pts) - P2
- #XXX STORY-016: Import/Export Features (5 pts) - P2
- #XXX STORY-017: Log Console & Toast Notifications (3 pts) - P1

**Deliverables:** Community features, import/export, logging

### Phase 5: Standalone Deployment (Week 9) - 10 points
- #XXX STORY-018: Docker Configuration for Next.js Standalone (5 pts) - P0
- #XXX STORY-019: E2E Testing for Standalone Deployment (5 pts) - P1

**Deliverables:** Docker config, E2E tests, standalone functional

### Phase 6: Appwrite Deployment (Weeks 10-11) - 18 points
- #XXX STORY-020: Appwrite Authentication Setup (8 pts) - P0
- #XXX STORY-021: Appwrite Static Export Configuration (3 pts) - P0
- #XXX STORY-022: Appwrite Deployment Workflow (5 pts) - P1
- #XXX STORY-023: Backend CORS Configuration for Appwrite (2 pts) - P1

**Deliverables:** Auth, static export, CI/CD, Appwrite functional

### Phase 7: Polish & Documentation (Week 12) - 10 points
- #XXX STORY-024: Accessibility & Responsiveness Audit (5 pts) - P2
- #XXX STORY-025: Documentation & Migration Guide (5 pts) - P1

**Deliverables:** WCAG AA compliance, docs, production ready

## 🔗 Dependencies & Blockers

**External Dependencies:**
- Next.js 16 stable release (available)
- shadcn/ui starter template (available)
- Appwrite Cloud account (create before Phase 6)

**Internal Blockers:**
- Backend must remain unchanged (confirmed ✅)
- Maintain localStorage key compatibility (confirmed ✅)

## ⚠️ Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Web Bluetooth API incompatibility | High | Medium | Maintain BLE proxy; test early on all browsers |
| Appwrite static export limitations | High | Medium | Test static mode in Phase 6; avoid SSR features |
| CORS with external backend | Medium | Medium | Configure CORS in STORY-023; test early |
| Scope creep (new features) | Medium | High | Freeze scope after Phase 4; park new ideas in backlog |
| Timeline delays | Medium | Medium | Track velocity weekly; adjust estimates |
| Feature flag complexity | Low | Low | Keep flags simple; document thoroughly |

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Language:** TypeScript 5 (strict mode)
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Data Fetching:** React Query / SWR (optional)
- **Tables:** TanStack Table
- **Testing:** Jest, React Testing Library, Playwright
- **Deployment:** Docker (standalone), Appwrite CLI (cloud)
- **CI/CD:** GitHub Actions

## 📚 Documentation

- [Epic Plan](../docs/NEXTJS_REWRITE_EPIC.md) - Full epic with all stories
- [Quick Summary](../docs/NEXTJS_REWRITE_SUMMARY.md) - TL;DR version
- [File Structure](../docs/NEXTJS_FILE_STRUCTURE.md) - Migration mapping
- [Roadmap](../docs/NEXTJS_ROADMAP.md) - Visual timeline

## 📈 Progress Tracking

**Story Points Completed:** 0 / 125
**Stories Completed:** 0 / 25
**Velocity:** TBD (calculate after Sprint 1)

### Sprint Burndown (Updated Weekly)

```
Week 1:  [ ] 10-12 points
Week 2:  [ ] 10-12 points
Week 3:  [ ] 10-12 points
...
Week 12: [ ] 10-12 points
```

## 🏁 Definition of Done

An epic is complete when:
- [ ] All child stories are closed
- [ ] Success criteria met (all P0 + P1 items checked)
- [ ] Documentation complete
- [ ] Both deployment modes tested and functional
- [ ] E2E tests passing
- [ ] Production deployment successful

---

**Created:** 2025-11-02
**Last Updated:** 2025-11-02
**Owner:** @josiah-nelson

## Related Issues

- #XXX - Standalone BLE Proxy Service (bonus feature, not blocking)

**Child Stories:** See phase breakdown above (create issues with `#epic-001` tag)
