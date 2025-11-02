# [FEATURE] Standalone BLE Proxy Service

**Priority:** P1 (High)
**Story Points:** 5-8
**Labels:** `enhancement`, `ble-proxy`, `docker`, `p1`
**Related Epic:** #XXX (EPIC-001)

---

## 📋 Summary

Create a **standalone BLE proxy microservice** Docker container that runs on a user's local machine, enabling iOS/Safari users to use the public Appwrite-hosted UI with their local SFP Wizard device.

## 🎯 Problem Statement

**Current Gap:**
- iOS/Safari users cannot use the public Appwrite UI because:
  - Safari lacks Web Bluetooth API support
  - Appwrite-hosted frontend talks to cloud backend, not local hardware
  - Self-hosting the full stack is overkill just for BLE access

**Proposed Solution:**
- Lightweight Docker container (BLE proxy only, ~50MB)
- Runs on user's local machine with Bluetooth access
- Appwrite UI connects to local proxy via configurable WebSocket endpoint
- Hybrid architecture: public frontend + local BLE proxy + cloud API

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│      iOS Safari (User's Device)              │
│                                               │
│  Appwrite UI (sfpliberate.cloud)             │
│  └─ Settings: ws://192.168.1.100:8081/ble/ws│
└────────────────┬─────────────────────────────┘
                 │ WebSocket (local network)
                 ▼
┌──────────────────────────────────────────────┐
│      User's Local Machine (Docker)           │
│                                               │
│  sfp-ble-proxy container                     │
│  ├─ Port 8081 exposed                        │
│  ├─ USB/Bluetooth device access              │
│  └─ Minimal FastAPI + Bleak                  │
│      │                                        │
│      └─ BLE ──► SFP Wizard Device            │
└──────────────────────────────────────────────┘

Cloud API Backend (sfpliberate-api.cloud)
  ├─ Module library storage
  ├─ Community submissions
  └─ No BLE proxy (delegates to user's local)
```

## ✅ Acceptance Criteria

- [ ] Docker image builds for linux/amd64 and linux/arm64
- [ ] Image size < 100MB
- [ ] Container startup time < 5 seconds
- [ ] Displays local WebSocket URL on startup (auto-detect IP)
- [ ] Exposes WebSocket endpoint: `ws://<local-ip>:8081/ble/ws`
- [ ] Health check endpoint: `GET /health`
- [ ] Works with Appwrite-hosted frontend (configurable endpoint)
- [ ] CORS allows all origins (local network security model)
- [ ] Published to GitHub Container Registry (ghcr.io)
- [ ] User-friendly README with one-command setup
- [ ] Frontend settings page for endpoint configuration
- [ ] iOS Safari can connect and perform all BLE operations

## 🔧 Implementation Tasks

### 1. Extract BLE Proxy Service
- [ ] Create new directory: `ble-proxy-service/`
- [ ] Copy BLE manager from main backend (`app/services/ble_manager.py`)
- [ ] Copy BLE schemas (`app/schemas/ble.py`)
- [ ] Create minimal FastAPI app (WebSocket only, no database)
- [ ] Strip unnecessary dependencies (SQLAlchemy, Alembic, etc.)

### 2. Docker Configuration
- [ ] Create `Dockerfile` (Python 3.11-slim base)
- [ ] Multi-stage build for minimal image size
- [ ] Health check endpoint
- [ ] Auto-detect local IP and display on startup
- [ ] Optional `docker-compose.yml` for easy setup

### 3. Frontend Integration (Next.js)
- [ ] Create `components/settings/BleProxyConfig.tsx`:
  - Input field for WebSocket endpoint
  - "Test Connection" button
  - Status indicator (connected/error)
  - "Save" button → localStorage
- [ ] Update `lib/ble/manager.ts`:
  - Check localStorage for custom endpoint
  - Fall back to default (Appwrite: none, Standalone: local backend)
- [ ] Add Settings page route: `app/settings/page.tsx`
- [ ] Feature flag: `NEXT_PUBLIC_ENABLE_CUSTOM_BLE_PROXY=true`

### 4. Documentation
- [ ] User guide: `ble-proxy-service/README.md`
  - Docker installation instructions
  - One-command run (Mac/Windows/Linux)
  - Find local IP address
  - Configure in app
  - Troubleshooting
- [ ] Update main README with hybrid deployment option
- [ ] Add to [Standalone BLE Proxy Service doc](../../docs/STANDALONE_BLE_PROXY_SERVICE.md)

### 5. CI/CD
- [ ] GitHub Actions workflow: `.github/workflows/build-ble-proxy.yml`
  - Build on push to main
  - Build for multi-arch (amd64, arm64)
  - Push to GitHub Container Registry
  - Tag with version + `latest`
- [ ] Automated testing (health check, WebSocket connection)

### 6. Testing
- [ ] Unit tests for BLE manager (same as main backend)
- [ ] Integration test: start container, connect WebSocket, verify messages
- [ ] Manual testing on iOS Safari with real SFP Wizard
- [ ] Test on macOS, Windows (Docker Desktop), Linux

## 🔗 Dependencies

**Depends on:**
- #XXX STORY-003 (BLE Service Layer) - reuses same BLE logic
- Backend BLE proxy implementation (already complete)

**Blocks:** None (optional feature)

## 📦 Deliverables

1. **Docker Image:** `ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest`
2. **GitHub Repo:** New directory `ble-proxy-service/` in main repo
3. **Frontend Settings Page:** Custom endpoint configuration UI
4. **User Documentation:** README with setup guide
5. **CI/CD Workflow:** Automated builds and publishing

## 🧪 Testing Plan

1. **Local Development:**
   - Build image: `docker build -t sfp-ble-proxy .`
   - Run: `docker run -p 8081:8081 sfp-ble-proxy`
   - Verify WebSocket URL displayed
   - Test health endpoint: `curl http://localhost:8081/health`

2. **Integration with Frontend:**
   - Run Appwrite-hosted UI locally (dev mode)
   - Configure custom endpoint in settings
   - Connect to SFP Wizard via proxy
   - Perform read/write operations
   - Verify all BLE features work

3. **Cross-Platform:**
   - Test on macOS (Intel + Apple Silicon)
   - Test on Windows (Docker Desktop)
   - Test on Linux (Ubuntu 22.04+)

4. **iOS Testing:**
   - Deploy Appwrite UI to staging
   - Run proxy container on local machine
   - Connect from iOS Safari
   - Verify connection, discovery, read, write

## 📝 Notes

- **Size Budget:** Target < 100MB (vs ~200MB full backend)
- **Dependencies:** Minimal - only FastAPI, uvicorn, bleak, websockets
- **Security:** No auth required (local network trust model)
  - Optional: Add basic token auth if users want it
  - CORS: Allow all origins (user's local network)
- **Network:** User's iOS device and computer must be on same WiFi
- **Firewall:** Users may need to allow port 8081 (document this)

## 🎁 User Benefits

1. **iOS Users:** Can use public Appwrite UI without self-hosting
2. **Simplicity:** One Docker command vs full stack deployment
3. **Best of Both Worlds:** Maintained UI + local hardware access
4. **Flexibility:** Works with any deployment mode (standalone or Appwrite)

## 🔮 Future Enhancements

- Support multiple Bluetooth adapters
- GUI installer (Electron app) instead of Docker
- Mobile app (React Native) with embedded BLE proxy
- WebRTC instead of WebSocket for peer-to-peer connection

## 📚 Reference Documents

- [Standalone BLE Proxy Service Spec](../../docs/STANDALONE_BLE_PROXY_SERVICE.md)
- [BLE Proxy Status](../../docs/BLE_PROXY_STATUS.md)
- [Epic Plan](../../docs/NEXTJS_REWRITE_EPIC.md)

---

**Created:** 2025-11-02
**Status:** 📋 Proposed
**Assignee:** TBD
**Target Completion:** After STORY-020 (Appwrite Auth Setup)
