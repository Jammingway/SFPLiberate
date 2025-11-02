# Standalone BLE Proxy Service

**Epic:** Next.js Rewrite
**Related Story:** New Feature (not in original 25 stories)
**Priority:** P1 (High)
**Complexity:** Medium (5-8 story points)

---

## Overview

A **standalone BLE proxy microservice** that can be deployed on a user's local machine to enable iOS/Safari users to use the public Appwrite-hosted UI without needing Web Bluetooth support.

## Problem Statement

Current architecture requires users to either:
1. Use a browser with Web Bluetooth API support (Chrome/Edge on desktop)
2. Self-host the entire stack (backend + frontend) to use BLE proxy mode

**Gap:** iOS users who want to use the public Appwrite UI cannot connect to their local SFP Wizard device because:
- Safari/iOS lack Web Bluetooth API support
- The Appwrite-hosted frontend talks to a cloud backend, not their local machine
- They don't want to self-host the full stack just to read/write SFP modules

## Proposed Solution

Create a **lightweight Docker container** that:
- Runs only the BLE proxy service (extracted from main backend)
- Exposes a WebSocket endpoint on the user's local network
- Requires minimal configuration (just `docker run`)
- Works with the public Appwrite UI via configurable endpoint

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    User's iOS Device (Safari)                │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   Appwrite-Hosted Frontend (sfpliberate.cloud)        │  │
│  │   - Next.js static site                                │  │
│  │   - Appwrite auth                                      │  │
│  │   - ENV: BLE_PROXY_ENDPOINT (configurable)            │  │
│  └─────────────┬──────────────────────────────────────────┘  │
│                │                                              │
│                │ WS: ws://192.168.1.100:8081/ble/ws          │
│                │ (User's local network)                       │
└────────────────┼──────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│           User's Local Machine (Docker Container)            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   SFPLiberate BLE Proxy Service                        │  │
│  │   - Minimal FastAPI app (WebSocket only)              │  │
│  │   - Bleak library (BLE manager)                       │  │
│  │   - Port 8081 exposed                                  │  │
│  │   - USB/Bluetooth device access                        │  │
│  └─────────────┬──────────────────────────────────────────┘  │
│                │                                              │
│                │ BLE                                          │
│                ▼                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            SFP Wizard Device                           │  │
│  │            (via Bluetooth)                             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

Public API Backend (sfpliberate-api.cloud):
- Module library storage
- Community submissions
- No BLE proxy (delegates to user's local service)
```

## User Flow

### Initial Setup (One-Time)

1. **User installs Docker** on local machine (Mac/Windows/Linux)
2. **User runs BLE proxy container:**
   ```bash
   docker run -d \
     --name sfp-ble-proxy \
     -p 8081:8081 \
     --device /dev/bus/usb:/dev/bus/usb \
     --cap-add NET_ADMIN \
     ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest
   ```
3. **Container starts** and displays local WebSocket URL:
   ```
   ✅ BLE Proxy running at: ws://192.168.1.100:8081/ble/ws
   ✅ Configure this endpoint in the SFPLiberate app settings
   ```

### Using the App

1. **User opens** `https://sfpliberate.cloud` on iOS Safari
2. **User goes to Settings** → BLE Proxy Configuration
3. **User enters local endpoint:** `ws://192.168.1.100:8081/ble/ws`
4. **Frontend saves** endpoint to localStorage
5. **User connects** to SFP Wizard → frontend uses local proxy
6. **All BLE operations** go through local container
7. **All API calls** (save module, etc.) go to cloud backend

## Technical Specification

### Container Structure

```
ble-proxy-service/
├── Dockerfile                  # Minimal Python 3.11-slim
├── docker-compose.yml          # Optional standalone compose file
├── pyproject.toml              # Poetry config (minimal deps)
├── app/
│   ├── main.py                 # FastAPI app (WebSocket only)
│   ├── ble_manager.py          # Bleak BLE manager (copied from main backend)
│   ├── schemas.py              # BLE WebSocket message schemas
│   └── config.py               # Environment config
├── README.md                   # User-facing setup guide
└── .env.example                # Example configuration
```

### Dependencies (Minimal)

```toml
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.115.0"
uvicorn = {extras = ["standard"], version = "^0.32.0"}
bleak = "^0.22.0"
websockets = "^13.1"
pydantic = "^2.9.0"
```

**Size:** ~50MB Docker image (vs ~200MB full backend)

### API Endpoints

**WebSocket Only:**
- `WS /ble/ws` - BLE proxy WebSocket (same protocol as main backend)

**HTTP (Health Check):**
- `GET /health` - Health check endpoint
- `GET /` - Service info + local IP address

### Environment Variables

```bash
# Required
BLE_PROXY_PORT=8081

# Optional
BLE_PROXY_ADAPTER=hci0              # Bluetooth adapter to use
BLE_PROXY_CORS_ORIGINS=*            # Allow all origins (user's local network)
LOG_LEVEL=info
```

### CORS Configuration

Since this runs on the user's local network and the frontend is hosted on Appwrite Cloud, we need to:
- **Allow all origins** (`*`) for WebSocket connections
- **No authentication** (local network is trusted)
- **Optional:** Add basic auth token if user wants security

## Frontend Integration

### Settings UI (New Component)

```typescript
// components/settings/BleProxyConfig.tsx

export function BleProxyConfig() {
  const [endpoint, setEndpoint] = useState<string>(() => {
    return localStorage.getItem('bleProxyEndpoint') || '';
  });
  const [status, setStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  const testConnection = async () => {
    try {
      const ws = new WebSocket(endpoint);
      ws.onopen = () => {
        setStatus('connected');
        ws.close();
      };
      ws.onerror = () => setStatus('error');
    } catch (e) {
      setStatus('error');
    }
  };

  const saveEndpoint = () => {
    localStorage.setItem('bleProxyEndpoint', endpoint);
    toast.success('BLE Proxy endpoint saved');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>BLE Proxy Configuration</CardTitle>
        <CardDescription>
          Connect to a local BLE proxy service to use this app on iOS/Safari
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Input
            placeholder="ws://192.168.1.100:8081/ble/ws"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <Button onClick={testConnection}>Test</Button>
          <Button onClick={saveEndpoint} variant="default">Save</Button>
        </div>
        {status === 'connected' && (
          <Alert className="mt-2">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>Connected successfully!</AlertDescription>
          </Alert>
        )}
        {status === 'error' && (
          <Alert className="mt-2" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Failed to connect. Check endpoint and ensure container is running.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### Feature Flag Integration

```typescript
// lib/ble/manager.ts

function getBleProxyEndpoint(): string {
  // Priority:
  // 1. User-configured local endpoint (localStorage)
  // 2. Deployment default (Appwrite mode: none, Standalone: local backend)

  if (typeof window !== 'undefined') {
    const localEndpoint = localStorage.getItem('bleProxyEndpoint');
    if (localEndpoint) return localEndpoint;
  }

  // Feature flag check
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'appwrite') {
    return ''; // No default, user must configure
  }

  // Standalone mode uses local backend
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ble/ws`;
}
```

## User Documentation

### README for BLE Proxy Service

```markdown
# SFPLiberate BLE Proxy Service

Run this Docker container on your local machine to use the SFPLiberate app on iOS/Safari.

## Quick Start

### 1. Install Docker
- **Mac:** [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Windows:** [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- **Linux:** `curl -fsSL https://get.docker.com | sh`

### 2. Run the Container

**macOS/Linux:**
```bash
docker run -d \
  --name sfp-ble-proxy \
  -p 8081:8081 \
  --restart unless-stopped \
  -v /var/run/dbus:/var/run/dbus:ro \
  ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest
```

**Windows:**
```powershell
docker run -d `
  --name sfp-ble-proxy `
  -p 8081:8081 `
  --restart unless-stopped `
  ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest
```

### 3. Find Your Local IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```powershell
ipconfig | findstr IPv4
```

Example output: `192.168.1.100`

### 4. Configure the App

1. Open https://sfpliberate.cloud on your iOS device
2. Go to **Settings** → **BLE Proxy Configuration**
3. Enter: `ws://YOUR_LOCAL_IP:8081/ble/ws`
   - Example: `ws://192.168.1.100:8081/ble/ws`
4. Click **Test** to verify connection
5. Click **Save**

### 5. Connect to Your SFP Wizard

You can now use the app normally! All BLE operations will go through your local machine.

## Troubleshooting

### "Failed to connect" error
- ✅ Check that the container is running: `docker ps | grep sfp-ble-proxy`
- ✅ Check that your iOS device is on the same WiFi network as your computer
- ✅ Check firewall settings (port 8081 must be open)
- ✅ Try the local IP address shown when container starts

### macOS Bluetooth permission denied
```bash
# Give Docker Desktop Bluetooth permissions in System Preferences → Privacy
```

### View container logs
```bash
docker logs sfp-ble-proxy
```

### Stop the container
```bash
docker stop sfp-ble-proxy
docker rm sfp-ble-proxy
```

## Advanced

### Custom port
```bash
docker run -d \
  --name sfp-ble-proxy \
  -p 9000:8081 \
  -e BLE_PROXY_PORT=8081 \
  ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest
```
Then use: `ws://YOUR_IP:9000/ble/ws`

### Use docker-compose
```yaml
services:
  ble-proxy:
    image: ghcr.io/josiah-nelson/sfpliberate-ble-proxy:latest
    ports:
      - "8081:8081"
    volumes:
      - /var/run/dbus:/var/run/dbus:ro
    restart: unless-stopped
```

```bash
docker-compose up -d
```
```

## Implementation Tasks

1. **Extract BLE proxy code** from main backend into standalone service
2. **Create minimal Dockerfile** with only BLE dependencies
3. **Add local IP detection** and display on startup
4. **Create GitHub Actions workflow** to build and publish image
5. **Add Settings page** to Next.js frontend with endpoint configuration
6. **Update BLE manager** to support custom proxy endpoints
7. **Write user documentation** (README, troubleshooting guide)
8. **Test on iOS** with local proxy

## Success Criteria

- [ ] Docker image builds and runs on Mac/Windows/Linux
- [ ] Container displays local WebSocket URL on startup
- [ ] Frontend settings page allows custom endpoint configuration
- [ ] iOS Safari can connect to local proxy and perform BLE operations
- [ ] Image size < 100MB
- [ ] Startup time < 5 seconds
- [ ] Documentation is clear for non-technical users

## Related Stories

- Depends on: STORY-003 (BLE Service Layer)
- Blocks: None (nice-to-have feature)
- Related: STORY-007 (Device Discovery), STORY-020 (Appwrite Auth)

## Notes

- This enables a **hybrid deployment**: public frontend + local BLE proxy + cloud API
- Users get best of both worlds: maintained UI + local hardware access
- Optional feature - standalone and Appwrite modes work without it
- Could be expanded to support multiple devices/adapters in future

---

**Created:** 2025-11-02
**Status:** Proposed (New Feature)
**Estimated Points:** 5-8
