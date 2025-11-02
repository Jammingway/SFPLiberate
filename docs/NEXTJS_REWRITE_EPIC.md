# Epic: Next.js Frontend Rewrite with shadcn/ui

**Epic ID:** EPIC-001
**Status:** Planning
**Owner:** TBD
**Created:** 2025-11-02
**Target Completion:** TBD

---

## Table of Contents

1. [Epic Overview](#epic-overview)
2. [Technical Architecture](#technical-architecture)
3. [Branch & Deployment Strategy](#branch--deployment-strategy)
4. [Story Breakdown](#story-breakdown)
5. [Implementation Phases](#implementation-phases)
6. [Component Inventory](#component-inventory)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)
9. [CI/CD Workflows](#cicd-workflows)
10. [Risk Assessment](#risk-assessment)
11. [Success Criteria](#success-criteria)

---

## Epic Overview

### Objectives

Replace the current vanilla JavaScript frontend with a modern Next.js 16 SPA utilizing shadcn/ui components, with support for two distinct deployment modes:

1. **Standalone/Self-Hosted** (Docker): No authentication, no Appwrite references
2. **Public Cloud** (Appwrite): Appwrite native authentication with cookies, hosted by maintainer

### Goals

- **100% Feature Parity**: Maintain all BLE functionality (direct + proxy), EEPROM read/write, module library management
- **Modern Stack**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Native Next.js**: Replace NGINX entirely; all routing/serving via Next.js
- **Improved UX**: Rich UI components (DataTables, dialogs, toasts, command palette, popovers, spinners)
- **Dual Deployment**: Clean separation between standalone and Appwrite deployments
- **Type Safety**: Full TypeScript coverage with strict mode
- **Maintainability**: Component-driven architecture with clear separation of concerns

### Non-Goals

- Backend modifications (FastAPI remains unchanged)
- Auth for standalone deployment (auth only for Appwrite cloud)
- Mobile native apps (Web Bluetooth + proxy mode sufficient)

---

## Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────┐
│           Next.js 16 Frontend (SSG/SSR)         │
│  - App Router (Pages in /app directory)        │
│  - React 19 + TypeScript 5                     │
│  - Tailwind CSS 4 + shadcn/ui                  │
│  - Web Bluetooth API (direct mode)             │
│  - WebSocket Client (BLE proxy mode)           │
└───────────────┬─────────────────────────────────┘
                │ HTTP/WS
                ▼
┌─────────────────────────────────────────────────┐
│        FastAPI Backend (unchanged)              │
│  - REST API (/api/v1/*)                        │
│  - WebSocket (/api/v1/ble/ws)                  │
│  - SQLite + SQLAlchemy                         │
└─────────────────────────────────────────────────┘
```

### Deployment Architectures

#### Standalone/Self-Hosted Mode

```
┌──────────────────────────────────────────────────┐
│  Docker Container: sfpliberate-frontend          │
│  ┌────────────────────────────────────────────┐  │
│  │  Next.js Server (standalone build)        │  │
│  │  - Port 3000 → exposed as 8080            │  │
│  │  - No auth middleware                     │  │
│  │  - ENV: DEPLOYMENT_MODE=standalone        │  │
│  │  - No Appwrite references                 │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │ API proxy to backend            │
│                 ▼                                 │
│  ┌────────────────────────────────────────────┐  │
│  │  FastAPI Backend (existing container)     │  │
│  │  - Internal network only                  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Single Docker Compose stack
- Next.js handles static serving + API proxying
- No authentication layer
- Environment variables: `DEPLOYMENT_MODE=standalone`, `NEXT_PUBLIC_API_URL=http://backend`

#### Appwrite Cloud Mode

```
┌──────────────────────────────────────────────────┐
│  Appwrite Cloud                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Next.js Static Export (hosted)           │  │
│  │  - ENV: DEPLOYMENT_MODE=appwrite          │  │
│  │  - Appwrite SDK initialized               │  │
│  │  - Auth middleware in app/middleware.ts   │  │
│  │  - NEXT_PUBLIC_APPWRITE_ENDPOINT          │  │
│  │  - NEXT_PUBLIC_APPWRITE_PROJECT_ID        │  │
│  └──────────────┬─────────────────────────────┘  │
│                 │                                 │
│  ┌────────────────────────────────────────────┐  │
│  │  Appwrite Authentication                  │  │
│  │  - Cookie-based sessions                  │  │
│  │  - Account API                            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────────────────┐
│  Self-Hosted FastAPI Backend (VPS/Cloud)        │
│  - Public HTTPS endpoint                        │
│  - CORS configured for Appwrite domain          │
└──────────────────────────────────────────────────┘
```

**Key Characteristics:**
- Next.js static export deployed to Appwrite Functions/Static Hosting
- Appwrite native auth with cookies (Account API)
- GitHub Actions workflow deploys to Appwrite CLI
- Environment variables: `DEPLOYMENT_MODE=appwrite`, `NEXT_PUBLIC_API_URL=https://api.sfpliberate.com`

---

## Feature Flag & Deployment Strategy

### Single Branch with Feature Flags

We'll use **feature flags** in a single codebase to avoid maintaining separate branches:

```
main (production)
└── frontend-nextjs/
    ├── lib/
    │   └── features.ts (feature flag definitions)
    ├── middleware.ts (conditional based on DEPLOYMENT_MODE)
    ├── next.config.ts (conditional output mode)
    ├── Dockerfile (supports both modes)
    ├── docker-compose.yml (standalone config)
    ├── appwrite.json (Appwrite config)
    └── .github/workflows/
        ├── deploy-standalone.yml
        └── deploy-appwrite.yml
```

### Feature Flag Implementation

**Runtime flags** (environment variables):
- `NEXT_PUBLIC_DEPLOYMENT_MODE=standalone|appwrite`
- `NEXT_PUBLIC_ENABLE_AUTH=true|false`
- `NEXT_PUBLIC_BLE_PROXY_ENDPOINT=<url>` (optional override)

**Build-time flags** (next.config.ts):
- `output: process.env.DEPLOYMENT_MODE === 'appwrite' ? 'export' : 'standalone'`
- Conditional middleware loading
- Conditional API rewrites

### Merge Strategy

1. **Single main branch** - all development happens here
2. **CI/CD splits deployments** based on environment:
   - GitHub Actions workflow A → builds standalone Docker image
   - GitHub Actions workflow B → builds Appwrite static export
3. **No branch divergence** - feature flags keep code unified

### Build Configuration with Feature Flags

```typescript
// next.config.ts
const deploymentMode = process.env.DEPLOYMENT_MODE || 'standalone';
const isAppwrite = deploymentMode === 'appwrite';

const config: NextConfig = {
  output: isAppwrite ? 'export' : 'standalone',

  // API rewrites (standalone only - static export doesn't support rewrites)
  async rewrites() {
    if (!isAppwrite) {
      return [
        {
          source: '/api/:path*',
          destination: process.env.BACKEND_URL + '/api/:path*',
        },
      ];
    }
    return [];
  },

  env: {
    NEXT_PUBLIC_DEPLOYMENT_MODE: deploymentMode,
  },
};
```

**Feature flag helper:**
```typescript
// lib/features.ts
export const features = {
  isAppwriteMode: process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'appwrite',
  isStandaloneMode: process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'standalone',
  enableAuth: process.env.NEXT_PUBLIC_ENABLE_AUTH === 'true',
  bleProxyEndpoint: process.env.NEXT_PUBLIC_BLE_PROXY_ENDPOINT || '',
} as const;

// Usage in components:
import { features } from '@/lib/features';

if (features.enableAuth) {
  // Load Appwrite auth components
}
```

**Conditional middleware:**
```typescript
// middleware.ts
import { features } from './lib/features';

export function middleware(request: NextRequest) {
  // Only run auth middleware in Appwrite mode
  if (!features.isAppwriteMode || !features.enableAuth) {
    return NextResponse.next();
  }

  // Appwrite auth logic here
  const session = request.cookies.get('appwrite-session');
  if (!session && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Story Breakdown

### Phase 1: Foundation (Stories 1-5)

#### **STORY-001: Project Scaffolding & Base Configuration**
**Priority:** P0 (Blocker)
**Story Points:** 3
**Branch:** `feature/nextjs-standalone`

**Description:**
Initialize Next.js project using the shadcn/ui starter template, configure TypeScript, ESLint, Prettier, and set up base folder structure.

**Acceptance Criteria:**
- [ ] Fork starter template: `https://github.com/siddharthamaity/nextjs-16-starter-shadcn`
- [ ] Configure `next.config.ts` with standalone output mode
- [ ] Set up environment variables (`.env.local`, `.env.example`)
- [ ] Configure TypeScript with strict mode (`tsconfig.json`)
- [ ] Install shadcn/ui CLI and initialize
- [ ] Create folder structure:
  ```
  frontend-nextjs/
  ├── app/
  │   ├── layout.tsx (root layout)
  │   ├── page.tsx (home page)
  │   ├── modules/ (module library pages)
  │   └── api/ (API route handlers if needed)
  ├── components/
  │   ├── ui/ (shadcn components)
  │   ├── ble/ (BLE-specific components)
  │   └── modules/ (module-specific components)
  ├── lib/
  │   ├── ble/ (BLE logic)
  │   ├── api/ (API client)
  │   └── utils.ts
  ├── hooks/
  ├── types/
  └── public/
  ```
- [ ] Verify dev server runs: `npm run dev`
- [ ] Configure dark/light mode (already in template)

**Tasks:**
1. Clone and customize starter template
2. Configure environment variable schema
3. Set up TypeScript strict mode
4. Initialize shadcn/ui
5. Create folder structure
6. Write initial README for Next.js frontend

**Dependencies:** None

---

#### **STORY-002: API Client & Type Definitions**
**Priority:** P0 (Blocker)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Create type-safe API client for FastAPI backend with full TypeScript definitions for all endpoints.

**Acceptance Criteria:**
- [ ] Define TypeScript interfaces for all API responses:
  - `SfpModule` (matches backend schema)
  - `ModuleListResponse`
  - `ModuleSaveResponse`
  - `SubmissionResponse`
  - `BleConfig`
  - `BleAdapter`
  - `BleDeviceInfo`
- [ ] Create `lib/api/client.ts` with fetch wrapper
- [ ] Implement API methods:
  - `getModules(): Promise<SfpModule[]>`
  - `saveModule(data): Promise<ModuleSaveResponse>`
  - `getModuleEeprom(id): Promise<ArrayBuffer>`
  - `deleteModule(id): Promise<void>`
  - `submitToCommunity(data): Promise<SubmissionResponse>`
  - `getConfig(): Promise<BleConfig>`
  - `getAdapters(): Promise<BleAdapter[]>`
  - `saveProfileToEnv(profile): Promise<void>`
- [ ] Add error handling with typed errors
- [ ] Add loading states with React Query or SWR
- [ ] Write unit tests for API client

**Tasks:**
1. Generate TypeScript types from backend schemas (manual or openapi-typescript)
2. Implement fetch wrapper with error handling
3. Implement all API methods
4. Add React Query setup (optional but recommended)
5. Write unit tests

**Dependencies:** STORY-001

---

#### **STORY-003: BLE Service Layer (TypeScript Migration)**
**Priority:** P0 (Blocker)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Migrate BLE logic from vanilla JavaScript to TypeScript, creating a clean service layer for both direct Web Bluetooth and proxy mode.

**Acceptance Criteria:**
- [ ] Create `lib/ble/types.ts` with BLE-specific types:
  - `BleProfile` (serviceUuid, writeCharUuid, notifyCharUuid)
  - `ConnectionMode` ('direct' | 'proxy' | 'auto')
  - `BleConnectionStatus`
  - `SfpStatus`
  - `DeviceStatus`
- [ ] Migrate `lib/ble/direct.ts` (Web Bluetooth API):
  - `connectToDevice(profile: BleProfile): Promise<BleDevice>`
  - `sendCommand(command: string): Promise<void>`
  - `disconnect(): Promise<void>`
  - Handle notifications with EventEmitter pattern
- [ ] Migrate `lib/ble/proxy.ts` (WebSocket proxy):
  - Port `ble-proxy-client.js` to TypeScript
  - `connectViaProxy(wsUrl: string, profile: BleProfile): Promise<void>`
  - WebSocket message type safety
- [ ] Create `lib/ble/manager.ts` (unified interface):
  - Auto-detect connection mode
  - Expose unified API regardless of mode
  - Event emitters for notifications, status changes
- [ ] Implement SFF-8472 parser in TypeScript (`lib/ble/parser.ts`)
- [ ] Handle chunked writes (BLE_WRITE_CHUNK_SIZE)
- [ ] Write comprehensive tests for BLE layer

**Tasks:**
1. Define BLE types
2. Port Web Bluetooth logic to TypeScript
3. Port BLE proxy client to TypeScript
4. Create unified BLE manager
5. Implement SFF-8472 parser
6. Add event handling system
7. Write unit tests (mocked Web Bluetooth)
8. Write integration tests (with test fixtures)

**Dependencies:** STORY-002

---

#### **STORY-004: Layout & Navigation Components**
**Priority:** P1 (High)
**Story Points:** 3
**Branch:** `feature/nextjs-standalone`

**Description:**
Build the root layout with navigation, theme toggle, and command palette.

**Acceptance Criteria:**
- [ ] Create `app/layout.tsx` with:
  - Header with app title
  - Theme toggle (dark/light/system) using shadcn
  - Navigation menu (shadcn NavigationMenu)
  - Footer with log console toggle
- [ ] Install and configure shadcn components:
  - `npx shadcn@latest add navigation-menu`
  - `npx shadcn@latest add button`
  - `npx shadcn@latest add dropdown-menu`
  - `npx shadcn@latest add command` (command palette)
- [ ] Implement command palette (Cmd+K / Ctrl+K):
  - Quick actions: Connect, Read SFP, Load Library
  - Navigation shortcuts
  - Search modules (if library loaded)
- [ ] Create responsive mobile navigation
- [ ] Add accessibility (keyboard navigation, ARIA labels)

**Tasks:**
1. Design layout structure
2. Install shadcn components
3. Implement header/nav
4. Build command palette
5. Add theme provider (already in template)
6. Test responsiveness

**Dependencies:** STORY-001

---

#### **STORY-005: Connection Status Dashboard**
**Priority:** P1 (High)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Build connection status dashboard showing BLE status, SFP presence, battery, and connection type.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add card`
  - `npx shadcn@latest add badge`
  - `npx shadcn@latest add separator`
- [ ] Create `components/ble/ConnectionStatus.tsx`:
  - BLE Status (Connected/Disconnected) with colored badge
  - SFP Status (Present/Not Present/Unknown)
  - Battery level (if available)
  - Connection Type (Direct/Proxy/Not Connected)
  - Firmware version display
- [ ] Create `components/ble/ConnectionModeSelector.tsx`:
  - Select: Auto / Web Bluetooth / Proxy
  - Mode hint text (dynamic based on browser capabilities)
  - Adapter selector (proxy mode only)
  - Refresh adapters button
- [ ] Wire up to BLE manager state (React Context or Zustand)
- [ ] Real-time updates via BLE manager events
- [ ] Add visual indicators (icons, colors matching current design)

**Tasks:**
1. Design status card UI
2. Install shadcn components
3. Build ConnectionStatus component
4. Build ConnectionModeSelector component
5. Create BLE state management (Context/Zustand)
6. Wire up real-time updates
7. Add icons and styling

**Dependencies:** STORY-003, STORY-004

---

### Phase 2: Core BLE Functionality (Stories 6-10)

#### **STORY-006: Device Connection Flow**
**Priority:** P0 (Blocker)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement device connection UI and logic for both direct and proxy modes.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add dialog`
  - `npx shadcn@latest add alert`
  - `npx shadcn@latest add toast`
- [ ] Create `components/ble/ConnectButton.tsx`:
  - "Connect to SFP Wizard" primary button
  - Disabled state when no profile configured
  - Loading spinner during connection
  - Error toast on failure
  - Success toast on connection
- [ ] Implement profile management:
  - Load profile from localStorage on mount
  - `components/ble/ProfileManager.tsx` dialog
  - Manual UUID entry (fallback)
  - Profile validation
- [ ] Implement browser compatibility checks:
  - Detect Web Bluetooth availability
  - Show warning banner for Safari/iOS
  - Auto-select proxy mode on unsupported browsers
- [ ] Handle disconnection events:
  - Auto-reconnect prompt
  - Clean up BLE resources
  - Update UI state
- [ ] Add version check warning (firmware != 1.0.10)

**Tasks:**
1. Build ConnectButton component
2. Implement profile management dialog
3. Add browser compatibility detection
4. Handle connection lifecycle
5. Add error handling and user feedback
6. Write E2E test (Playwright)

**Dependencies:** STORY-003, STORY-005

---

#### **STORY-007: Device Discovery (Web Bluetooth & Proxy)**
**Priority:** P1 (High)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement device discovery UI for both Web Bluetooth scanning and proxy-based discovery.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add table`
  - `npx shadcn@latest add skeleton`
- [ ] Create `components/ble/DeviceDiscovery.tsx`:
  - "Scan (Web Bluetooth)" button (hidden on iOS)
  - "Discover via Proxy" button (visible in proxy mode)
  - Discovery results table:
    - Device name
    - Address (proxy mode)
    - RSSI (signal strength)
    - "Connect" action button
  - Loading skeleton during scan
  - Empty state message
- [ ] Implement Web Bluetooth scanning (experimental API)
- [ ] Implement proxy discovery:
  - Call `/api/v1/ble/discover` via WebSocket
  - Display results with filtering (name contains "SFP")
  - Handle timeouts
- [ ] Add GATT inspection on connect (proxy mode):
  - Fetch `/api/v1/ble/inspect?device_address=XX`
  - Auto-populate profile from GATT services
  - Save profile to localStorage
- [ ] Add "Save as Deployment Defaults" button:
  - POST to `/api/v1/ble/profile/env`
  - Prompt for docker restart
  - Only show in standalone mode

**Tasks:**
1. Design discovery UI
2. Implement Web Bluetooth scan
3. Implement proxy discovery
4. Build GATT inspection flow
5. Add profile persistence
6. Handle edge cases (no devices, timeouts)
7. Test on multiple browsers

**Dependencies:** STORY-006

---

#### **STORY-008: SFP Read Operation & Live Data Display**
**Priority:** P0 (Blocker)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement SFP EEPROM read functionality with live data parsing and display.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add card`
  - `npx shadcn@latest add input`
- [ ] Create `components/ble/ReadSfpButton.tsx`:
  - "Read SFP Data" button (disabled when not connected)
  - Loading state with spinner
  - Send `[POST] /sif/start` command
  - Wait for binary EEPROM response (handleNotifications)
  - Parse SFF-8472 data
  - Store raw EEPROM in React state
- [ ] Create `components/ble/LiveSfpData.tsx`:
  - Display parsed data:
    - Vendor name
    - Model number
    - Serial number
  - Module name input field
  - "Save to Library" button (enabled after read)
  - "Upload to Community" button (TODO placeholder)
- [ ] Implement notification handler:
  - Distinguish text vs binary responses
  - Parse firmware version, status, EEPROM
  - Trigger React state updates
  - Handle message listeners (waitForMessage pattern)
- [ ] Add error handling:
  - Timeout if no response
  - Invalid EEPROM data
  - Disconnection during read

**Tasks:**
1. Build ReadSfpButton component
2. Build LiveSfpData card
3. Implement notification handler in BLE manager
4. Wire up state management
5. Add error handling
6. Write integration tests

**Dependencies:** STORY-006

---

#### **STORY-009: SFP Write Operation with Safety Warnings**
**Priority:** P1 (High)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement SFP EEPROM write functionality with chunking, progress tracking, and safety warnings.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add alert-dialog`
  - `npx shadcn@latest add progress`
- [ ] Create `components/modules/WriteButton.tsx`:
  - "Write" button on each module in library
  - Safety warning AlertDialog:
    - ⚠️ Warning message (match current implementation)
    - Checklist of precautions
    - "Cancel" and "Continue" buttons
  - Disabled when not connected
- [ ] Implement write flow:
  1. Fetch EEPROM binary from `/api/modules/{id}/eeprom`
  2. Send `[POST] /sif/write` command
  3. Wait for "SIF write start" acknowledgment
  4. Chunk binary data (BLE_WRITE_CHUNK_SIZE = 20 bytes)
  5. Send chunks with delay (BLE_WRITE_CHUNK_DELAY_MS = 10ms)
  6. Show progress bar (0-100%)
  7. Wait for "SIF write complete" acknowledgment
  8. Show verification reminder dialog
- [ ] Add progress tracking:
  - Real-time progress percentage
  - Chunks sent / total chunks
  - Cancel button (if safe to implement)
- [ ] Error handling:
  - Chunk write failure → retry or abort
  - Timeout waiting for acknowledgment
  - Disconnection during write
- [ ] Post-write verification reminder:
  - Alert with next steps (read back, compare, test)

**Tasks:**
1. Build WriteButton with safety dialog
2. Implement chunked write logic
3. Add progress tracking UI
4. Handle write lifecycle (init → chunks → complete)
5. Add error handling and recovery
6. Write E2E test with mock device
7. Test on real hardware (if available)

**Dependencies:** STORY-008

---

#### **STORY-010: Status Monitoring & Device Info**
**Priority:** P2 (Medium)
**Story Points:** 3
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement periodic status monitoring (battery, SFP presence, firmware version) with UI display.

**Acceptance Criteria:**
- [ ] Create `lib/ble/statusMonitor.ts`:
  - Send `[GET] /stats` every 5 seconds when connected
  - Parse response: `sysmon: ver:X.X.X, bat:[x]|^|XX%, sfp:[x], ...`
  - Emit events for status updates
- [ ] Update `components/ble/ConnectionStatus.tsx`:
  - Display battery percentage
  - Battery icon with color based on level (green/yellow/red)
  - SFP presence indicator (green checkmark / red x)
  - Firmware version badge
  - Warning if firmware != 1.0.10
- [ ] Create `components/ble/DeviceInfo.tsx`:
  - Expandable card with detailed device info
  - Firmware version
  - Battery level history chart (optional)
  - Last status check timestamp
- [ ] Optimize polling:
  - Only poll when connected
  - Stop during long operations (read/write)
  - Configurable interval (env var)
- [ ] Add manual refresh button

**Tasks:**
1. Implement status monitor service
2. Update ConnectionStatus component
3. Build DeviceInfo component
4. Add polling lifecycle management
5. Test battery parsing edge cases

**Dependencies:** STORY-006

---

### Phase 3: Module Library UI (Stories 11-13)

#### **STORY-011: Module Library DataTable**
**Priority:** P1 (High)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Build the module library page with shadcn DataTable (TanStack Table), featuring search, sort, pagination, and row actions.

**Acceptance Criteria:**
- [ ] Install dependencies:
  - `npm install @tanstack/react-table`
  - `npx shadcn@latest add table`
  - `npx shadcn@latest add input` (search)
  - `npx shadcn@latest add button`
  - `npx shadcn@latest add dropdown-menu` (row actions)
- [ ] Create `app/modules/page.tsx` (Module Library page)
- [ ] Create `components/modules/ModuleTable.tsx`:
  - Columns: Name, Vendor, Model, Serial, Created At, Actions
  - Sortable columns (name, vendor, model, created date)
  - Search/filter by name, vendor, model
  - Pagination (10/25/50 per page)
  - Row actions dropdown:
    - Write to SFP
    - View Details
    - Download EEPROM (.bin)
    - Delete
  - Empty state with CTA to read first module
  - Loading skeleton
- [ ] Implement data fetching:
  - Fetch modules on mount via `getModules()`
  - React Query for caching and refetching
  - Optimistic updates on delete
- [ ] Add bulk actions (optional):
  - Select multiple rows
  - Bulk delete
  - Bulk export

**Tasks:**
1. Set up TanStack Table with shadcn
2. Define table columns and types
3. Implement search and filter logic
4. Add pagination controls
5. Build row actions dropdown
6. Wire up API calls
7. Add loading and empty states
8. Write component tests

**Dependencies:** STORY-002, STORY-004

---

#### **STORY-012: Module Detail View & EEPROM Viewer**
**Priority:** P2 (Medium)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Create a detailed module view page showing parsed metadata and hex viewer for EEPROM data.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add tabs`
  - `npx shadcn@latest add scroll-area`
  - `npx shadcn@latest add code` (if available, or custom)
- [ ] Create `app/modules/[id]/page.tsx` (dynamic route)
- [ ] Create `components/modules/ModuleDetail.tsx`:
  - Tab 1: **Metadata**
    - Name, Vendor, Model, Serial
    - SHA256 checksum
    - Created date
    - Edit name button (inline edit)
  - Tab 2: **EEPROM Hex Viewer**
    - Fetch binary via `getModuleEeprom(id)`
    - Hex viewer (00-FF display, ASCII column)
    - Highlight key regions (vendor 20-36, model 40-56, serial 68-84)
    - Copy to clipboard button
  - Tab 3: **Raw JSON** (API response)
- [ ] Add action buttons:
  - Download EEPROM (.bin)
  - Write to SFP
  - Delete module
  - Share (copy link)
- [ ] Breadcrumbs: Home > Modules > [Module Name]

**Tasks:**
1. Create dynamic route page
2. Build ModuleDetail component
3. Implement hex viewer (use library or custom)
4. Add download functionality
5. Wire up actions (write, delete)
6. Test with various EEPROM sizes
7. Add responsive design

**Dependencies:** STORY-011

---

#### **STORY-013: Save Module Flow**
**Priority:** P1 (High)
**Story Points:** 3
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement module save flow with name input, duplicate detection, and library refresh.

**Acceptance Criteria:**
- [ ] Update `components/ble/LiveSfpData.tsx`:
  - Module name input (required)
  - "Save to Library" button
  - Validation: name must be non-empty
- [ ] Implement save flow:
  1. Convert raw EEPROM ArrayBuffer to Base64
  2. POST to `/api/modules` with name + eeprom_data_base64
  3. Handle duplicate response (SHA256 match)
  4. Show toast:
    - Success: "Module saved with ID: X"
    - Duplicate: "Duplicate detected, using existing ID: X"
  5. Clear input field
  6. Navigate to module library page (or refresh if already there)
- [ ] Add optimistic update to module list
- [ ] Add undo action (toast with undo button)

**Tasks:**
1. Add name input validation
2. Implement save API call
3. Handle duplicate detection
4. Show appropriate toasts
5. Refresh module library
6. Test edge cases (network error, duplicate, etc.)

**Dependencies:** STORY-008, STORY-011

---

### Phase 4: Additional Features (Stories 14-17)

#### **STORY-014: Community Module Submission (TODO Removal)**
**Priority:** P2 (Medium)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement community module submission flow (currently a TODO placeholder).

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add dialog`
  - `npx shadcn@latest add textarea`
  - `npx shadcn@latest add checkbox`
- [ ] Create `components/modules/CommunityUploadDialog.tsx`:
  - Triggered by "Upload to Community" button
  - Form fields:
    - Module name (pre-filled)
    - Vendor (pre-filled)
    - Model (pre-filled)
    - Serial (pre-filled)
    - Notes (optional textarea)
    - Checkbox: "I verify this is accurate data from a real module"
  - Submit to `/api/submissions`
  - Show success message with inbox ID and SHA256
- [ ] Add submission status tracking (optional):
  - Badge on module: "Submitted" or "Approved"
  - Link to community repo PR (if available)
- [ ] Update UI to remove "TODO" label

**Tasks:**
1. Design community upload dialog
2. Build form with validation
3. Implement submission API call
4. Add success/error handling
5. Update button to remove TODO
6. Write integration test

**Dependencies:** STORY-008

---

#### **STORY-015: Community Module Browser (TODO Removal)**
**Priority:** P2 (Medium)
**Story Points:** 8
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement community module browser that fetches index from GitHub Pages and allows import.

**Acceptance Criteria:**
- [ ] Create `app/community/page.tsx` (Community Modules page)
- [ ] Create `components/modules/CommunityTable.tsx`:
  - Similar to ModuleTable but read-only
  - Fetch from `COMMUNITY_INDEX_URL` (GitHub Pages JSON)
  - Columns: Name, Vendor, Model, SHA256, Submitted Date
  - "Import" action button
  - Search and filter
  - Tag/category filter (if metadata supports)
- [ ] Implement import flow:
  1. Fetch community module JSON (includes Base64 EEPROM)
  2. POST to `/api/modules` (same as save flow)
  3. Handle duplicate detection
  4. Navigate to module library
- [ ] Add caching:
  - Cache community index for 1 hour
  - Refresh button to bypass cache
- [ ] Handle fetch errors:
  - Show error banner if GitHub Pages unreachable
  - Fallback to cached version

**Tasks:**
1. Define community index JSON schema
2. Create CommunityTable component
3. Implement fetch from GitHub Pages
4. Build import flow
5. Add caching logic
6. Handle errors gracefully
7. Test with mock community index
8. Update button to remove TODO

**Dependencies:** STORY-011

---

#### **STORY-016: Import/Export Features (TODO Removal)**
**Priority:** P2 (Medium)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Implement import from file (.bin/.json) and bulk export (CSV/ZIP) features.

**Acceptance Criteria:**
- [ ] **Import from File:**
  - File input accepts `.bin` or `.json`
  - `.bin`: Prompt for module name, parse EEPROM, save to library
  - `.json`: Read metadata + Base64 EEPROM, save to library
  - Drag-and-drop support
  - Validate file format
  - Show progress for large files
- [ ] **Export All Modules:**
  - Download options:
    - CSV: metadata only (id, name, vendor, model, serial, created_at, sha256)
    - ZIP: folder with `{id}_metadata.json` + `{id}_eeprom.bin` for each module
  - Generate files client-side (no backend endpoint needed)
  - Stream large exports (don't block UI)
- [ ] Create `components/modules/ImportExport.tsx`:
  - Import button with file dialog
  - Export dropdown (CSV / ZIP)
  - Progress indicators
- [ ] Add to module library page toolbar
- [ ] Update buttons to remove TODO

**Tasks:**
1. Implement file import logic (.bin and .json)
2. Add drag-and-drop support
3. Implement CSV export (use library like papaparse)
4. Implement ZIP export (use JSZip)
5. Add progress tracking
6. Handle large file edge cases
7. Write tests for import/export
8. Update UI to remove TODO

**Dependencies:** STORY-011

---

#### **STORY-017: Log Console & Toast Notifications**
**Priority:** P1 (High)
**Story Points:** 3
**Branch:** `feature/nextjs-standalone`

**Description:**
Replace simple log console with rich toast notifications and expandable log drawer.

**Acceptance Criteria:**
- [ ] Install shadcn components:
  - `npx shadcn@latest add toast`
  - `npx shadcn@latest add sheet` (drawer)
- [ ] Create `components/ui/LogDrawer.tsx`:
  - Bottom drawer (slide up from footer)
  - Toggle button in footer
  - Scrollable log list (reverse chronological)
  - Log entries with:
    - Timestamp
    - Log level (info/error)
    - Message text
    - Color coding
  - Clear logs button
  - Export logs button (download .txt)
- [ ] Replace `log()` function with toast system:
  - Info messages → toast (bottom-right)
  - Errors → toast with red styling
  - Critical errors → AlertDialog
- [ ] Create global logging context:
  - Stores log history (max 100 entries)
  - Exposes `addLog(message, level)` function
  - Accessible via hook: `useLogger()`
- [ ] Add log filtering:
  - Filter by level (info/error)
  - Search logs
- [ ] Persist logs in sessionStorage (survive page refresh)

**Tasks:**
1. Install toast and sheet components
2. Build LogDrawer component
3. Create logging context
4. Replace all log() calls with useLogger()
5. Add filtering and search
6. Implement export functionality
7. Test log persistence

**Dependencies:** STORY-004

---

### Phase 5: Standalone Deployment (Stories 18-19)

#### **STORY-018: Docker Configuration for Next.js Standalone**
**Priority:** P0 (Blocker)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Create Dockerfile and docker-compose configuration for Next.js standalone build.

**Acceptance Criteria:**
- [ ] Create `frontend-nextjs/Dockerfile`:
  - Multi-stage build:
    - Stage 1: Build (Node 22 Alpine)
      - Install dependencies with `npm ci`
      - Build Next.js: `npm run build`
      - Output: standalone mode
    - Stage 2: Runtime (Node 22 Alpine)
      - Copy standalone output + public + .next/static
      - Expose port 3000
      - USER node (non-root)
      - CMD: `node server.js`
  - Build args: NODE_VERSION, BUILD_DATE, VCS_REF
  - Labels for metadata
- [ ] Update `docker-compose.yml`:
  - Replace `frontend` service with `frontend-nextjs`
  - Build context: `./frontend-nextjs`
  - Environment variables:
    - `DEPLOYMENT_MODE=standalone`
    - `BACKEND_URL=http://backend`
    - `NEXT_PUBLIC_API_URL=/api` (client-side, uses proxy)
  - Port mapping: `${HOST_PORT:-8080}:3000`
  - Depends on backend (health check)
  - Networks: sfp-internal
  - Healthcheck: `curl http://localhost:3000/api/health`
- [ ] Configure Next.js rewrites:
  - Proxy `/api/*` to `http://backend/*`
  - Proxy `/api/v1/ble/ws` (WebSocket upgrade)
- [ ] Add `.dockerignore`:
  - `node_modules`, `.next`, `.git`, `*.md`, etc.
- [ ] Test full stack:
  - `docker-compose up --build`
  - Verify frontend accessible on :8080
  - Verify API calls reach backend
  - Verify WebSocket proxy works
- [ ] Document build process in README

**Tasks:**
1. Create multi-stage Dockerfile
2. Update docker-compose.yml
3. Configure Next.js API rewrites
4. Add .dockerignore
5. Test local build
6. Test full stack integration
7. Write deployment docs

**Dependencies:** All Phase 1-4 stories

---

#### **STORY-019: E2E Testing for Standalone Deployment**
**Priority:** P1 (High)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone`

**Description:**
Set up Playwright E2E tests for critical user flows in standalone mode.

**Acceptance Criteria:**
- [ ] Install Playwright: `npm create playwright@latest`
- [ ] Configure Playwright:
  - Test against local Docker stack
  - Browsers: Chromium, Firefox, Webkit (Safari)
  - Base URL: `http://localhost:8080`
- [ ] Write E2E tests:
  - **Test 1: Home page loads**
    - Verify title, theme toggle, navigation
  - **Test 2: Module library**
    - Load modules, search, sort, pagination
  - **Test 3: Connection flow (mocked BLE)**
    - Select connection mode
    - Mock Web Bluetooth API
    - Verify connection status updates
  - **Test 4: Read SFP (mocked device)**
    - Mock BLE notifications
    - Verify EEPROM parsing
    - Verify live data display
  - **Test 5: Save module**
    - Fill module name
    - Submit save
    - Verify module appears in library
  - **Test 6: Delete module**
    - Delete from library
    - Verify confirmation dialog
    - Verify module removed
  - **Test 7: Write module (mocked)**
    - Select module
    - Click write
    - Verify safety warning
    - Mock write chunks
    - Verify progress bar
- [ ] Set up CI pipeline:
  - GitHub Actions: run tests on PR
  - Use `docker-compose up` in CI
- [ ] Add visual regression tests (optional)

**Tasks:**
1. Install and configure Playwright
2. Write test fixtures (mock BLE API)
3. Write E2E test suites
4. Set up CI workflow
5. Document test running process
6. Add test coverage reporting

**Dependencies:** STORY-018

---

### Phase 6: Appwrite Deployment (Stories 20-23)

#### **STORY-020: Appwrite Authentication Setup**
**Priority:** P0 (Blocker)
**Story Points:** 8
**Branch:** `feature/nextjs-appwrite` (fork from standalone)

**Description:**
Integrate Appwrite SDK and implement cookie-based authentication with Account API.

**Acceptance Criteria:**
- [ ] Install Appwrite SDK:
  - `npm install appwrite`
- [ ] Create `lib/appwrite/client.ts`:
  - Initialize Appwrite client with environment variables:
    - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
    - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
  - Export `account`, `client` instances
- [ ] Create `lib/appwrite/auth.ts`:
  - `login(email, password): Promise<Session>`
  - `logout(): Promise<void>`
  - `getCurrentUser(): Promise<User | null>`
  - `checkSession(): Promise<boolean>`
- [ ] Create `app/login/page.tsx`:
  - Login form (email + password)
  - "Login" button
  - Error handling (invalid credentials)
  - Redirect to home after successful login
- [ ] Create `middleware.ts`:
  - Check for Appwrite session cookie
  - Redirect unauthenticated users to `/login`
  - Allow public paths: `/login`, `/api/health`
- [ ] Create `components/auth/UserMenu.tsx`:
  - User avatar/name in header
  - Dropdown menu: Profile, Logout
  - Logout triggers `auth.logout()` + redirect to login
- [ ] Add environment variable checks:
  - Only load Appwrite code if `DEPLOYMENT_MODE=appwrite`
  - Fail gracefully in standalone mode
- [ ] Test authentication flow end-to-end

**Tasks:**
1. Install Appwrite SDK
2. Configure Appwrite client
3. Implement auth service
4. Build login page
5. Create middleware for auth check
6. Build UserMenu component
7. Add conditional loading based on deployment mode
8. Write auth flow tests

**Dependencies:** STORY-018 (needs standalone working first)

---

#### **STORY-021: Appwrite Static Export Configuration**
**Priority:** P0 (Blocker)
**Story Points:** 3
**Branch:** `feature/nextjs-appwrite`

**Description:**
Configure Next.js for static export compatible with Appwrite Static Hosting.

**Acceptance Criteria:**
- [ ] Update `next.config.ts`:
  - Set `output: 'export'` when `DEPLOYMENT_MODE=appwrite`
  - Remove server-side rewrites (not supported in static export)
  - Configure `trailingSlash: true` (optional, for Appwrite routing)
- [ ] Create `appwrite.json`:
  - Configure Appwrite project settings
  - Define static hosting output directory: `out/`
- [ ] Update API client:
  - Use `NEXT_PUBLIC_API_URL` (absolute URL to external backend)
  - No API routes (static export limitation)
- [ ] Handle client-side routing:
  - All routing via React Router (Next.js App Router in SPA mode)
- [ ] Build and test static export:
  - `DEPLOYMENT_MODE=appwrite npm run build`
  - Verify `out/` directory created
  - Test locally with `npx serve out`
  - Verify all routes work
  - Verify authentication works
- [ ] Document differences from standalone mode

**Tasks:**
1. Update next.config.ts for static export
2. Create appwrite.json
3. Update API client for absolute URLs
4. Test static export locally
5. Verify auth flow in static mode
6. Document configuration

**Dependencies:** STORY-020

---

#### **STORY-022: Appwrite Deployment Workflow**
**Priority:** P1 (High)
**Story Points:** 5
**Branch:** `feature/nextjs-appwrite`

**Description:**
Create GitHub Actions workflow to deploy Next.js static export to Appwrite Cloud.

**Acceptance Criteria:**
- [ ] Create `.github/workflows/deploy-appwrite.yml`:
  - Trigger: push to `feature/nextjs-appwrite` or manual workflow_dispatch
  - Steps:
    1. Checkout code
    2. Setup Node.js 22
    3. Install dependencies: `npm ci`
    4. Build static export:
       - `DEPLOYMENT_MODE=appwrite npm run build`
    5. Install Appwrite CLI: `npm install -g appwrite-cli`
    6. Deploy to Appwrite:
       - `appwrite deploy`
  - Secrets (GitHub Secrets):
    - `APPWRITE_ENDPOINT`
    - `APPWRITE_PROJECT_ID`
    - `APPWRITE_API_KEY` (for CLI authentication)
    - `NEXT_PUBLIC_API_URL` (backend URL)
- [ ] Configure Appwrite project:
  - Create project in Appwrite Cloud console
  - Enable Account service
  - Configure OAuth providers (optional)
  - Set allowed domains for CORS
- [ ] Add deployment status badge to README
- [ ] Test workflow:
  - Trigger manual deployment
  - Verify static site deployed
  - Test authentication on deployed site
  - Verify API calls to external backend work
- [ ] Document deployment process

**Tasks:**
1. Create GitHub Actions workflow
2. Configure Appwrite Cloud project
3. Add GitHub Secrets
4. Test manual deployment
5. Verify deployed app works end-to-end
6. Write deployment documentation
7. Add status badge to README

**Dependencies:** STORY-021

---

#### **STORY-023: Backend CORS Configuration for Appwrite**
**Priority:** P1 (High)
**Story Points:** 2
**Branch:** `feature/nextjs-appwrite` (backend update)

**Description:**
Update FastAPI backend CORS settings to allow requests from Appwrite-hosted frontend.

**Acceptance Criteria:**
- [ ] Update `backend/app/main.py`:
  - Add Appwrite domain to CORS allowed origins
  - Environment variable: `CORS_ORIGINS` (comma-separated list)
  - Default: `http://localhost:3000,http://localhost:8080`
  - Production: Add Appwrite domain (e.g., `https://sfpliberate.appwrite.io`)
- [ ] Update `backend/app/config.py`:
  - Add `cors_origins: list[str]` setting
  - Parse from env var, split by comma
- [ ] Test CORS configuration:
  - Deploy backend to VPS/Cloud
  - Configure HTTPS (Let's Encrypt or cloud provider)
  - Test API calls from Appwrite frontend
  - Verify OPTIONS preflight requests work
  - Test WebSocket upgrade (if needed for BLE proxy)
- [ ] Document CORS configuration in deployment docs

**Tasks:**
1. Update CORS middleware in FastAPI
2. Add environment variable for allowed origins
3. Deploy backend with HTTPS
4. Test CORS from Appwrite domain
5. Document configuration

**Dependencies:** STORY-022

---

### Phase 7: Polish & Documentation (Stories 24-25)

#### **STORY-024: Accessibility & Responsiveness Audit**
**Priority:** P2 (Medium)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone` + `feature/nextjs-appwrite`

**Description:**
Conduct accessibility and responsiveness audit, fix issues, and achieve WCAG 2.1 AA compliance.

**Acceptance Criteria:**
- [ ] **Accessibility Audit:**
  - Run Lighthouse audit (Accessibility score ≥ 90)
  - Run axe DevTools scan
  - Fix all critical and serious issues:
    - Proper heading hierarchy (h1 → h2 → h3)
    - ARIA labels on interactive elements
    - Keyboard navigation (Tab, Enter, Escape)
    - Focus indicators visible
    - Color contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text)
    - Screen reader compatibility (test with NVDA/JAWS)
  - Add skip-to-content link
  - Ensure form labels are associated
  - Add alt text to images/icons
- [ ] **Responsiveness Audit:**
  - Test on viewports: 320px, 768px, 1024px, 1920px
  - Mobile menu works correctly
  - Tables responsive (horizontal scroll or card view)
  - Buttons and inputs touch-friendly (≥ 44px tap target)
  - Test on devices: iPhone, iPad, Android, Desktop
- [ ] **Browser Compatibility:**
  - Test on Chrome, Firefox, Edge, Safari (macOS/iOS)
  - Verify Web Bluetooth fallback messaging
  - Verify BLE proxy works on Safari/iOS
- [ ] Document accessibility features in README

**Tasks:**
1. Run Lighthouse and axe audits
2. Fix accessibility issues
3. Test keyboard navigation
4. Test screen reader compatibility
5. Test responsive design on all viewports
6. Test on real devices
7. Document accessibility features

**Dependencies:** All Phase 1-6 stories

---

#### **STORY-025: Documentation & Migration Guide**
**Priority:** P1 (High)
**Story Points:** 5
**Branch:** `feature/nextjs-standalone` + `feature/nextjs-appwrite`

**Description:**
Write comprehensive documentation for the Next.js rewrite, including user guide, developer guide, and migration guide.

**Acceptance Criteria:**
- [ ] Update `CLAUDE.md`:
  - Replace frontend architecture section
  - Update commands and workflows
  - Document new folder structure
  - Update API endpoints section
  - Add TypeScript conventions
- [ ] Create `docs/NEXTJS_MIGRATION_GUIDE.md`:
  - Side-by-side comparison (old vs new)
  - Breaking changes (if any)
  - Feature mapping (where did each old feature go?)
  - Data migration (none needed, backend unchanged)
- [ ] Create `frontend-nextjs/README.md`:
  - **Getting Started**
    - Prerequisites (Node.js 22+)
    - Installation: `npm install`
    - Development: `npm run dev`
    - Build: `npm run build`
  - **Deployment**
    - Standalone (Docker)
    - Appwrite (static export)
  - **Project Structure**
    - Folder layout
    - Key files explanation
  - **Environment Variables**
    - Table of all env vars with descriptions
  - **Development Guide**
    - Adding new components
    - Using shadcn/ui
    - BLE service layer
    - API client usage
  - **Testing**
    - Running unit tests
    - Running E2E tests
  - **Troubleshooting**
    - Common issues and solutions
- [ ] Create `docs/APPWRITE_DEPLOYMENT.md`:
  - Appwrite project setup
  - Authentication configuration
  - GitHub Actions setup
  - Environment variables
  - CORS configuration
  - Debugging tips
- [ ] Update root `README.md`:
  - Add section on frontend options (standalone vs Appwrite)
  - Link to new docs
  - Update screenshots (if applicable)
- [ ] Record video walkthrough (optional):
  - 5-minute demo of new UI
  - Upload to YouTube, link in README

**Tasks:**
1. Update CLAUDE.md
2. Write migration guide
3. Write frontend-nextjs README
4. Write Appwrite deployment guide
5. Update root README
6. Review and polish all docs
7. Optional: record video walkthrough

**Dependencies:** All Phase 1-6 stories

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- **Duration:** 2 weeks
- **Stories:** 1-5
- **Goal:** Project scaffolding, API client, BLE service layer, basic UI
- **Deliverables:**
  - Next.js project running locally
  - BLE manager (direct + proxy) functional
  - Basic layout and navigation
  - Connection status dashboard

### Phase 2: Core BLE Functionality (Weeks 3-4)
- **Duration:** 2 weeks
- **Stories:** 6-10
- **Goal:** Device connection, discovery, read/write operations, status monitoring
- **Deliverables:**
  - Full BLE connection flow (Web Bluetooth + proxy)
  - Device discovery UI
  - SFP read with live data display
  - SFP write with safety warnings and progress
  - Status monitoring dashboard

### Phase 3: Module Library UI (Weeks 5-6)
- **Duration:** 2 weeks
- **Stories:** 11-13
- **Goal:** Module library management with rich UI
- **Deliverables:**
  - DataTable with search/sort/pagination
  - Module detail view with hex viewer
  - Save module flow with duplicate detection

### Phase 4: Additional Features (Weeks 7-8)
- **Duration:** 2 weeks
- **Stories:** 14-17
- **Goal:** Community features, import/export, logging
- **Deliverables:**
  - Community upload functional
  - Community browser functional
  - Import/export working
  - Toast notifications + log drawer

### Phase 5: Standalone Deployment (Week 9)
- **Duration:** 1 week
- **Stories:** 18-19
- **Goal:** Docker deployment and E2E testing
- **Deliverables:**
  - Docker image for Next.js
  - Updated docker-compose.yml
  - E2E test suite passing
  - Standalone mode fully functional

### Phase 6: Appwrite Deployment (Weeks 10-11)
- **Duration:** 2 weeks
- **Stories:** 20-23
- **Goal:** Appwrite authentication and cloud deployment
- **Deliverables:**
  - Authentication flow working
  - Static export configuration
  - GitHub Actions deployment pipeline
  - Backend CORS configured
  - Appwrite deployment functional

### Phase 7: Polish & Documentation (Week 12)
- **Duration:** 1 week
- **Stories:** 24-25
- **Goal:** Accessibility, responsiveness, documentation
- **Deliverables:**
  - WCAG AA compliance
  - Responsive on all devices
  - Comprehensive documentation
  - Migration guide

**Total Duration:** 12 weeks (3 months)

---

## Component Inventory

### shadcn/ui Components to Install

```bash
# Foundation
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add separator

# Navigation
npx shadcn@latest add navigation-menu
npx shadcn@latest add dropdown-menu
npx shadcn@latest add command

# Feedback
npx shadcn@latest add toast
npx shadcn@latest add dialog
npx shadcn@latest add alert
npx shadcn@latest add alert-dialog
npx shadcn@latest add skeleton
npx shadcn@latest add progress
npx shadcn@latest add spinner # (if available, or use lucide-react icons)

# Data Display
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add badge
npx shadcn@latest add scroll-area
npx shadcn@latest add sheet

# Forms
npx shadcn@latest add select
npx shadcn@latest add checkbox
npx shadcn@latest add textarea
npx shadcn@latest add switch

# Utility
npx shadcn@latest add popover
npx shadcn@latest add tooltip
```

### Custom Components to Build

```
components/
├── ble/
│   ├── ConnectionStatus.tsx
│   ├── ConnectionModeSelector.tsx
│   ├── ConnectButton.tsx
│   ├── DeviceDiscovery.tsx
│   ├── ProfileManager.tsx
│   ├── ReadSfpButton.tsx
│   ├── LiveSfpData.tsx
│   └── DeviceInfo.tsx
├── modules/
│   ├── ModuleTable.tsx
│   ├── ModuleDetail.tsx
│   ├── WriteButton.tsx
│   ├── CommunityUploadDialog.tsx
│   ├── CommunityTable.tsx
│   └── ImportExport.tsx
├── ui/
│   ├── LogDrawer.tsx
│   ├── HexViewer.tsx
│   └── [shadcn components]
└── auth/ (Appwrite only)
    ├── LoginForm.tsx
    └── UserMenu.tsx
```

---

## Migration Strategy

### Feature Parity Checklist

| Feature | Current (Vanilla JS) | Next.js Implementation | Status |
|---------|---------------------|------------------------|--------|
| **BLE Connection** |
| Web Bluetooth API | `connectToDevice()` | `lib/ble/direct.ts` | ✅ Plan |
| BLE Proxy Mode | `connectViaProxy()` | `lib/ble/proxy.ts` | ✅ Plan |
| Auto mode detection | `resolveConnectionMode()` | `lib/ble/manager.ts` | ✅ Plan |
| Profile management | localStorage | localStorage + Context | ✅ Plan |
| **Device Operations** |
| Device discovery | `limitedScanTODO()`, `discoverViaProxy()` | `components/ble/DeviceDiscovery.tsx` | ✅ Plan |
| GATT inspection | Fetch `/api/v1/ble/inspect` | Same | ✅ Plan |
| Adapter selection | `<select>` | `components/ble/ConnectionModeSelector.tsx` | ✅ Plan |
| **SFP Operations** |
| Read EEPROM | `requestSfpRead()` | `components/ble/ReadSfpButton.tsx` | ✅ Plan |
| Parse SFF-8472 | `parseAndDisplaySfpData()` | `lib/ble/parser.ts` | ✅ Plan |
| Write EEPROM | `writeSfp()` | `components/modules/WriteButton.tsx` | ✅ Plan |
| Chunked writes | Manual loop | Same logic in TypeScript | ✅ Plan |
| **Module Library** |
| List modules | `loadSavedModules()` | DataTable in `app/modules/page.tsx` | ✅ Plan |
| Save module | `saveCurrentModule()` | `components/ble/LiveSfpData.tsx` | ✅ Plan |
| Delete module | `deleteModule()` | Row action in DataTable | ✅ Plan |
| Duplicate detection | Backend SHA256 | Same | ✅ Plan |
| **Community** |
| Upload submission | `uploadToCommunityTODO()` | `components/modules/CommunityUploadDialog.tsx` | ✅ Plan |
| Browse community | `loadCommunityModulesTODO()` | `app/community/page.tsx` | ✅ Plan |
| **Import/Export** |
| Import from file | `importFromFileTODO()` | `components/modules/ImportExport.tsx` | ✅ Plan |
| Export all | `backupAllTODO()` | Same component (CSV/ZIP) | ✅ Plan |
| **Status & Monitoring** |
| Connection status | `updateConnectionStatus()` | React state in `ConnectionStatus.tsx` | ✅ Plan |
| SFP presence | Parse `sysmon` | Same | ✅ Plan |
| Battery level | Parse `sysmon` | Same | ✅ Plan |
| Firmware version | Parse `Version:` | Same | ✅ Plan |
| Periodic status | `setInterval` | React useInterval hook | ✅ Plan |
| **UI/UX** |
| Theme toggle | CSS variables | shadcn theme provider | ✅ Plan |
| Log console | `<div id="logConsole">` | Toast + LogDrawer | ✅ Plan |
| Browser warnings | Banner | Alert component | ✅ Plan |

### Data Migration

**No data migration needed** - backend database remains unchanged. Frontend state is ephemeral (localStorage only).

### Backward Compatibility

**Not required** - this is a full rewrite. Users will upgrade by pulling new Docker image or redeploying.

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

**Coverage Target:** 80%+

**Test Files:**
- `lib/api/client.test.ts` - API client methods
- `lib/ble/parser.test.ts` - SFF-8472 parser edge cases
- `lib/ble/manager.test.ts` - BLE manager logic (mocked Web Bluetooth)
- `components/ble/ConnectionStatus.test.tsx` - Component rendering
- `components/modules/ModuleTable.test.tsx` - Table interactions
- `hooks/useBle.test.ts` - Custom hooks

**Setup:**
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event
```

### Integration Tests (Playwright Component Testing)

**Test Scenarios:**
- BLE connection flow (mocked Web Bluetooth API)
- Module save flow (with mocked API)
- Module delete flow with confirmation
- Search and filter in DataTable
- Theme toggle persistence

### E2E Tests (Playwright)

**Critical Paths:**
1. User navigates to app → sees connection UI
2. User selects proxy mode → sees adapter selector
3. User connects to device (mocked) → status updates
4. User reads SFP → live data displays
5. User saves module → module appears in library
6. User writes module → safety warning → progress bar
7. User deletes module → confirmation → module removed

**Test Environments:**
- Standalone Docker stack (docker-compose up)
- Appwrite deployment (against staging environment)

### Manual Testing Checklist

- [ ] Test on Chrome/Edge (Web Bluetooth direct)
- [ ] Test on Safari (BLE proxy fallback)
- [ ] Test on iOS with Bluefy browser
- [ ] Test all BLE operations with real SFP Wizard device
- [ ] Test disconnection scenarios
- [ ] Test network errors (offline mode)
- [ ] Test with various EEPROM sizes
- [ ] Test accessibility with screen reader
- [ ] Test keyboard navigation
- [ ] Test on mobile (responsive design)

---

## CI/CD Workflows

### Standalone Workflow (`.github/workflows/ci-standalone.yml`)

```yaml
name: CI - Standalone

on:
  push:
    branches: [feature/nextjs-standalone, main]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend-nextjs/package-lock.json
      - name: Install dependencies
        working-directory: frontend-nextjs
        run: npm ci
      - name: Lint
        working-directory: frontend-nextjs
        run: npm run lint
      - name: Type check
        working-directory: frontend-nextjs
        run: npm run type-check
      - name: Unit tests
        working-directory: frontend-nextjs
        run: npm run test -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./frontend-nextjs/coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and start Docker stack
        run: docker-compose up --build -d
      - name: Wait for services
        run: docker-compose exec -T backend python -c "import time; time.sleep(10)"
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install Playwright
        working-directory: frontend-nextjs
        run: npx playwright install --with-deps
      - name: Run E2E tests
        working-directory: frontend-nextjs
        run: npx playwright test
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend-nextjs/playwright-report/

  build-docker:
    runs-on: ubuntu-latest
    needs: [lint-test, e2e]
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t sfpliberate-frontend:${{ github.sha }} ./frontend-nextjs
      - name: Push to registry (optional)
        if: github.ref == 'refs/heads/main'
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker tag sfpliberate-frontend:${{ github.sha }} ghcr.io/${{ github.repository }}/frontend:latest
          docker push ghcr.io/${{ github.repository }}/frontend:latest
```

### Appwrite Workflow (`.github/workflows/deploy-appwrite.yml`)

```yaml
name: Deploy to Appwrite

on:
  push:
    branches: [feature/nextjs-appwrite]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend-nextjs/package-lock.json
      - name: Install dependencies
        working-directory: frontend-nextjs
        run: npm ci
      - name: Build static export
        working-directory: frontend-nextjs
        env:
          DEPLOYMENT_MODE: appwrite
          NEXT_PUBLIC_APPWRITE_ENDPOINT: ${{ secrets.APPWRITE_ENDPOINT }}
          NEXT_PUBLIC_APPWRITE_PROJECT_ID: ${{ secrets.APPWRITE_PROJECT_ID }}
          NEXT_PUBLIC_API_URL: ${{ secrets.PUBLIC_API_URL }}
        run: npm run build
      - name: Install Appwrite CLI
        run: npm install -g appwrite-cli
      - name: Deploy to Appwrite
        working-directory: frontend-nextjs
        env:
          APPWRITE_ENDPOINT: ${{ secrets.APPWRITE_ENDPOINT }}
          APPWRITE_PROJECT_ID: ${{ secrets.APPWRITE_PROJECT_ID }}
          APPWRITE_API_KEY: ${{ secrets.APPWRITE_API_KEY }}
        run: appwrite deploy
```

---

## Risk Assessment

### High Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Web Bluetooth API incompatibility** | High | Medium | Maintain BLE proxy mode; test on all browsers early |
| **Performance issues with large module libraries** | Medium | Low | Implement pagination, virtualization (TanStack Table) |
| **Appwrite static export limitations** | High | Medium | Test static export early; avoid server-side features |
| **CORS issues with Appwrite + external backend** | Medium | Medium | Configure CORS properly; test early in Phase 6 |
| **Docker build failures** | Medium | Low | Multi-stage builds; test locally before CI |
| **E2E test flakiness** | Low | High | Use Playwright auto-wait; retry flaky tests |

### Medium Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Scope creep (new features during rewrite)** | Medium | High | Freeze scope after Phase 4; park new features in backlog |
| **Timeline delays** | Medium | Medium | Break stories into smaller tasks; track velocity |
| **TypeScript learning curve** | Low | Medium | Pair programming; code reviews; use strict mode from start |
| **shadcn/ui component customization** | Low | Low | Follow shadcn docs; ask in Discord if stuck |

### Low Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Next.js 16 breaking changes** | Low | Low | Pin Next.js version; follow upgrade guides |
| **Dependency conflicts** | Low | Low | Use lockfile; Dependabot for updates |
| **GitHub Actions quota** | Low | Low | Optimize workflows; cache dependencies |

---

## Success Criteria

### Must-Have (P0)

- [ ] **100% BLE feature parity**
  - Direct Web Bluetooth mode works (Chrome/Edge)
  - BLE proxy mode works (Safari/iOS)
  - All EEPROM read/write operations functional
- [ ] **Standalone deployment works**
  - Docker Compose stack builds and runs
  - All features accessible on http://localhost:8080
  - No authentication required
- [ ] **Appwrite deployment works**
  - Static export deploys to Appwrite Cloud
  - Authentication flow functional
  - API calls to external backend work
- [ ] **Type safety**
  - No TypeScript errors in strict mode
  - All API responses typed
- [ ] **E2E tests passing**
  - All critical paths covered
  - Tests pass in CI

### Should-Have (P1)

- [ ] **Modern UX**
  - DataTable with search/sort/pagination
  - Toast notifications
  - Command palette
  - Loading states and spinners
- [ ] **Accessibility**
  - Lighthouse score ≥ 90
  - Keyboard navigation works
  - Screen reader compatible
- [ ] **Responsive design**
  - Works on mobile, tablet, desktop
  - Touch-friendly on mobile
- [ ] **Documentation**
  - README complete
  - Migration guide written
  - Deployment guides for both modes

### Nice-to-Have (P2)

- [ ] **Community features working**
  - Upload to community functional
  - Browse community modules functional
- [ ] **Import/export working**
  - Import from .bin/.json
  - Export to CSV/ZIP
- [ ] **80%+ test coverage**
- [ ] **Video walkthrough recorded**

---

## Next Steps

1. **Review this epic plan** with stakeholders
2. **Refine story estimates** based on team capacity
3. **Create GitHub Project board** with all stories
4. **Set up branch strategy** (feature/nextjs-standalone, feature/nextjs-appwrite)
5. **Kick off Phase 1** (Foundation)
6. **Weekly sync meetings** to track progress
7. **Adjust timeline** as needed based on velocity

---

**Epic Owner:** TBD
**Last Updated:** 2025-11-02
**Version:** 1.0
