# [STORY-001] Project Scaffolding & Base Configuration

**Story ID:** STORY-001
**Parent Epic:** #XXX (EPIC-001)
**Priority:** P0 (Blocker)
**Story Points:** 3
**Phase:** Phase 1 - Foundation
**Labels:** `story`, `foundation`, `setup`, `p0`

---

## 📋 Description

**As a** developer,
**I want** a fully configured Next.js project with TypeScript, ESLint, Prettier, and shadcn/ui,
**So that** I have a solid foundation to build the frontend rewrite on.

## ✅ Acceptance Criteria

- [ ] Next.js 16 project initialized from shadcn/ui starter template
- [ ] TypeScript configured with strict mode (`tsconfig.json`)
- [ ] Tailwind CSS 4 configured and working
- [ ] shadcn/ui CLI installed and initialized
- [ ] Folder structure created as per [File Structure doc](../../docs/NEXTJS_FILE_STRUCTURE.md)
- [ ] Environment variables configured (`.env.example`, `.env.local`)
- [ ] Feature flags implemented (`lib/features.ts`)
- [ ] `next.config.ts` configured with conditional output modes
- [ ] Dev server runs successfully: `npm run dev`
- [ ] Dark/light/system theme toggle working (from template)
- [ ] Initial README.md written for frontend-nextjs/

## 🔧 Tasks

- [ ] Clone shadcn/ui starter template
  ```bash
  git clone https://github.com/siddharthamaity/nextjs-16-starter-shadcn frontend-nextjs
  cd frontend-nextjs
  npm install
  ```
- [ ] Configure `tsconfig.json` (strict mode, path aliases)
- [ ] Create folder structure:
  - `app/` (pages)
  - `components/ui/` (shadcn)
  - `components/ble/`, `components/modules/`, `components/layout/`
  - `lib/api/`, `lib/ble/`, `lib/appwrite/`
  - `hooks/`, `types/`, `styles/`, `public/`
  - `tests/unit/`, `tests/e2e/`, `tests/fixtures/`
- [ ] Set up environment variable schema:
  ```bash
  # .env.example
  DEPLOYMENT_MODE=standalone
  NEXT_PUBLIC_DEPLOYMENT_MODE=standalone
  NEXT_PUBLIC_ENABLE_AUTH=false
  NEXT_PUBLIC_API_URL=/api
  BACKEND_URL=http://backend
  ```
- [ ] Create `lib/features.ts` with feature flag helpers
- [ ] Update `next.config.ts` for conditional builds (standalone/export)
- [ ] Initialize shadcn/ui: `npx shadcn@latest init`
- [ ] Verify dev server: `npm run dev` → http://localhost:3000
- [ ] Write `frontend-nextjs/README.md` with:
  - Getting started
  - Folder structure explanation
  - Available scripts
  - Environment variables

## 🔗 Dependencies

**Depends on:** None (first story)
**Blocks:** STORY-002, STORY-003, STORY-004

## 🧪 Testing Requirements

- [ ] Dev server starts without errors
- [ ] TypeScript compilation succeeds: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Theme toggle works (visual test)

## 📝 Notes

- Use the exact starter template for consistency: https://github.com/siddharthamaity/nextjs-16-starter-shadcn
- Strict mode TypeScript from day 1 - no `any` types allowed
- Feature flags are critical for dual deployment support
- Document any deviations from starter template in README

## 📚 Reference Documents

- [Epic Plan](../../docs/NEXTJS_REWRITE_EPIC.md#story-001-project-scaffolding--base-configuration)
- [File Structure](../../docs/NEXTJS_FILE_STRUCTURE.md)

---

**Assignee:** TBD
**Status:** 📋 To Do
**Created:** 2025-11-02
**Target Completion:** Week 1
