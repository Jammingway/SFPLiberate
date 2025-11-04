# ESPHome Proxy Implementation Guide

**Status:** Ready to implement
**Scope:** Replace Bleak BLE proxy with ESPHome proxy integration
**Timeline:** ~2 weeks (Stage 1: Make it work)

---

## Implementation Checklist

### Stage 1: Core Backend (Days 1-3)

#### Install Dependencies
```bash
cd backend
# Add to requirements.txt:
aioesphomeapi==21.0.0
zeroconf==0.131.0
```

#### Create Module Structure
```
backend/app/services/esphome/
├── __init__.py
├── proxy_service.py      # Main service (singleton)
├── proxy_manager.py      # mDNS discovery + connection
├── device_manager.py     # SFP device tracking + RSSI
└── schemas.py            # Pydantic models
```

#### Configuration (`backend/app/core/config.py`)
```python
# ESPHome Bluetooth Proxy
ESPHOME_PROXY_MODE: bool = Field(default=False, env="ESPHOME_PROXY_MODE")
ESPHOME_DISCOVERY_TIMEOUT: int = Field(default=10)
ESPHOME_CONNECTION_TIMEOUT: int = Field(default=30)
```

#### Core Components

**1. Schemas (`schemas.py`):**
```python
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DiscoveredDevice(BaseModel):
    mac_address: str
    name: str
    rssi: int
    best_proxy: str  # proxy name with highest RSSI
    last_seen: datetime = Field(default_factory=datetime.utcnow)

class DeviceConnectionRequest(BaseModel):
    mac_address: str  # Format: AA:BB:CC:DD:EE:FF

class DeviceConnectionResponse(BaseModel):
    service_uuid: str
    notify_char_uuid: str
    write_char_uuid: str
    proxy_used: str

class ESPHomeStatus(BaseModel):
    enabled: bool
    proxies_discovered: int
    devices_discovered: int
```

**2. ProxyManager (`proxy_manager.py`):**
- Use `zeroconf` to browse `_esphomelib._tcp.local.`
- On service added: create `aioesphomeapi.APIClient(host, port, password="")`
- Connect and `subscribe_bluetooth_le_advertisements(callback)`
- Track connected proxies in dict: `{proxy_name: APIClient}`

**3. DeviceManager (`device_manager.py`):**
- Receive advertisement callbacks from ProxyManager
- Filter: `if "sfp" in name.lower()`
- Track RSSI per proxy: `{mac: {proxy_name: rssi}}`
- Maintain list of discovered devices (expire after 30s of no updates)
- Provide `select_best_proxy(mac)` → returns proxy name with highest RSSI

**4. ProxyService (`proxy_service.py`):**
- Singleton that coordinates ProxyManager + DeviceManager
- `start()`: Begin mDNS discovery loop
- `stop()`: Disconnect all proxies
- `get_discovered_devices()`: Return current device list
- `connect_to_device(mac)`:
  - Get best proxy from DeviceManager
  - Get APIClient from ProxyManager
  - `client.bluetooth_device_connect(mac)`
  - `services = client.bluetooth_gatt_get_services(mac)`
  - Parse services for notify + write characteristics
  - `client.bluetooth_device_disconnect(mac)`
  - Return `DeviceConnectionResponse`

---

### Stage 2: API Endpoints (Days 4-5)

#### Create Routes (`backend/app/api/v1/esphome.py`)

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import json
import asyncio

router = APIRouter(prefix="/api/esphome", tags=["ESPHome"])

@router.get("/status")
async def get_status():
    """Check if ESPHome proxy mode is enabled."""
    if not settings.ESPHOME_PROXY_MODE:
        return {"enabled": False}

    service = ESPHomeProxyService()
    devices = service.get_discovered_devices()
    return ESPHomeStatus(
        enabled=True,
        proxies_discovered=len(service.proxy_manager.proxies),
        devices_discovered=len(devices)
    )

@router.get("/devices")
async def device_stream():
    """SSE stream of discovered SFP devices."""
    async def event_generator():
        service = ESPHomeProxyService()
        while True:
            devices = service.get_discovered_devices()
            data = json.dumps([d.dict() for d in devices])
            yield f"data: {data}\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/connect")
async def connect_device(request: DeviceConnectionRequest):
    """Connect to device and retrieve UUIDs."""
    service = ESPHomeProxyService()
    return await service.connect_to_device(request.mac_address)
```

#### Integrate with Main App (`backend/app/main.py`)

```python
@app.on_event("startup")
async def startup():
    if settings.ESPHOME_PROXY_MODE:
        service = ESPHomeProxyService()
        await service.start()

@app.on_event("shutdown")
async def shutdown():
    if settings.ESPHOME_PROXY_MODE:
        service = ESPHomeProxyService()
        await service.stop()

# Register routes
if settings.ESPHOME_PROXY_MODE:
    from app.api.v1.esphome import router as esphome_router
    app.include_router(esphome_router)
```

---

### Stage 3: Frontend Integration (Days 6-8)

#### Create ESPHome Client (`frontend/src/lib/esphome/esphomeClient.ts`)

```typescript
export interface DiscoveredDevice {
  macAddress: string;
  name: string;
  rssi: number;
  bestProxy: string;
  lastSeen: string;
}

export interface DeviceConnectionResponse {
  serviceUuid: string;
  notifyCharUuid: string;
  writeCharUuid: string;
  proxyUsed: string;
}

export class ESPHomeClient {
  async isEnabled(): Promise<boolean> {
    const res = await fetch('/api/esphome/status');
    const data = await res.json();
    return data.enabled;
  }

  subscribeToDevices(callback: (devices: DiscoveredDevice[]) => void): () => void {
    const eventSource = new EventSource('/api/esphome/devices');

    eventSource.onmessage = (event) => {
      const devices = JSON.parse(event.data);
      callback(devices);
    };

    return () => eventSource.close();
  }

  async connectToDevice(macAddress: string): Promise<DeviceConnectionResponse> {
    const res = await fetch('/api/esphome/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac_address: macAddress })
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}
```

#### Create Discovery Component (`frontend/src/components/esphome/ESPHomeDiscovery.tsx`)

```tsx
export function ESPHomeDiscovery() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [manualMac, setManualMac] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [scanTimeout, setScanTimeout] = useState(false);

  useEffect(() => {
    const client = new ESPHomeClient();
    const unsubscribe = client.subscribeToDevices(setDevices);

    // Show manual entry after 10s if no devices found
    const timeout = setTimeout(() => {
      if (devices.length === 0) {
        setScanTimeout(true);
        setShowManualEntry(true);
      }
    }, 10000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleConnect = async (mac: string) => {
    const client = new ESPHomeClient();
    const result = await client.connectToDevice(mac);

    // Store UUIDs in profile
    saveActiveProfile({
      serviceUuid: result.serviceUuid,
      notifyCharUuid: result.notifyCharUuid,
      writeCharUuid: result.writeCharUuid,
      deviceName: devices.find(d => d.macAddress === mac)?.name || 'SFP Device'
    });

    toast.success('UUIDs retrieved! You can now connect.');
  };

  return (
    <div>
      <h3>Discovered SFP Devices (via ESPHome)</h3>

      {/* Auto-discovery list */}
      {devices.length > 0 ? (
        <div>
          {devices.map(device => (
            <button
              key={device.macAddress}
              onClick={() => handleConnect(device.macAddress)}
              className="device-item"
            >
              {device.name} ({device.rssi} dBm)
              <span className="mac">{device.macAddress}</span>
            </button>
          ))}
        </div>
      ) : (
        <p>Scanning for SFP devices...</p>
      )}

      {/* Manual MAC entry fallback */}
      {showManualEntry && (
        <div className="manual-entry">
          <p>
            {scanTimeout ? 'No devices found automatically.' : ''}
            The SFP Wizard displays its MAC address on screen.
          </p>
          <input
            type="text"
            placeholder="AA:BB:CC:DD:EE:FF"
            value={manualMac}
            onChange={(e) => setManualMac(e.target.value)}
            pattern="[A-Fa-f0-9:]{17}"
          />
          <button
            onClick={() => handleConnect(manualMac)}
            disabled={!/^[A-Fa-f0-9:]{17}$/.test(manualMac)}
          >
            Connect by MAC
          </button>
        </div>
      )}

      {!showManualEntry && (
        <button onClick={() => setShowManualEntry(true)} className="link-button">
          Enter MAC address manually
        </button>
      )}
    </div>
  );
}
```

#### Integrate with Connection Panel (`frontend/src/components/ble/ConnectPanel.tsx`)

```tsx
export function ConnectPanel() {
  const [esphomeEnabled, setEsphomeEnabled] = useState(false);
  const [mode, setMode] = useState<'browser' | 'esphome'>('browser');

  useEffect(() => {
    const client = new ESPHomeClient();
    client.isEnabled().then(setEsphomeEnabled);
  }, []);

  return (
    <div>
      {esphomeEnabled && (
        <div>
          <label>
            <input type="radio" checked={mode === 'browser'} onChange={() => setMode('browser')} />
            Browser Bluetooth (Recommended)
          </label>
          <label>
            <input type="radio" checked={mode === 'esphome'} onChange={() => setMode('esphome')} />
            ESPHome Proxy
          </label>
        </div>
      )}

      {mode === 'browser' ? <DirectDiscovery /> : <ESPHomeDiscovery />}
    </div>
  );
}
```

---

### Stage 4: Remove Old Proxy Code (Days 9-10)

#### Files to Delete
```bash
rm -rf ble-proxy-service/
```

#### References to Clean Up

Search for and remove/update:
- `BLE_PROXY_ENABLED` env var references → replace with `ESPHOME_PROXY_MODE`
- Docker D-Bus volume mounts (in `docker-compose.yml`)
- USB device mappings (in `docker-compose.yml`)
- References to Bleak in docs

#### Docker Compose Updates

```yaml
# docker-compose.yml - backend service
environment:
  - ESPHOME_PROXY_MODE=${ESPHOME_PROXY_MODE:-false}

# REMOVE these (Bleak-specific):
# devices:
#   - /dev/bus/usb:/dev/bus/usb
# volumes:
#   - /var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket:ro

# ADD for ESPHome (ONLY if mode enabled):
network_mode: host  # Required for mDNS discovery
```

**Important:** `network_mode: host` should be documented as optional (only needed when `ESPHOME_PROXY_MODE=true`).

---

### Stage 5: Testing & Polish (Days 11-14)

#### Manual Testing Checklist

- [ ] Backend starts with `ESPHOME_PROXY_MODE=true`
- [ ] mDNS discovers ESPHome proxy on LAN
- [ ] BLE scan detects SFP Wizard device
- [ ] SSE stream shows device in frontend
- [ ] User can select device and retrieve UUIDs
- [ ] UUIDs are cached in localStorage (Appwrite) or backend (standalone)
- [ ] Subsequent connections use cached UUIDs without re-discovery
- [ ] Browser Bluetooth still works (not broken)
- [ ] Graceful degradation if no ESPHome proxies found

#### Known Limitations (Document, Don't Fix)

- Requires `network_mode: host` (mDNS limitation)
- Only works on local network (by design)
- No ESPHome authentication (assumes default password)
- User must have ESPHome proxy pre-configured

---

## Implementation Notes

### GATT Service Parsing

When connecting to device, iterate through services to find one with BOTH:
- A characteristic with `notify` property
- A characteristic with `write` or `writeWithoutResponse` property

Example:
```python
def parse_gatt_services(services):
    for service in services:
        notify_char = None
        write_char = None

        for char in service.characteristics:
            if char.properties.notify:
                notify_char = char.uuid
            if char.properties.write or char.properties.write_without_response:
                write_char = char.uuid

        if notify_char and write_char:
            return (service.uuid, notify_char, write_char)

    raise ValueError("No suitable service found")
```

### Advertisement Deduplication

Cache advertisements by `(mac, rssi)` for 2 seconds to reduce noise:

```python
cache: Dict[Tuple[str, int], float] = {}

def handle_ad(ad, proxy_name):
    key = (ad.address, ad.rssi)
    now = time.time()

    if key in cache and now - cache[key] < 2.0:
        return  # Duplicate, ignore

    cache[key] = now
    # Process advertisement...
```

### Fail Fast Strategy

- mDNS discovery timeout: 10s
- Proxy connection timeout: 30s
- GATT connection timeout: 30s
- Max retry attempts: 3
- If all fail → return clear error to frontend

### UUID Caching Logic

**All Modes - Frontend Cache (Always):**
```typescript
// frontend/src/lib/ble/profile.ts
export function saveActiveProfile(profile: Profile) {
  localStorage.setItem('ble_profile', JSON.stringify(profile));
}

export function loadActiveProfile(): Profile | null {
  const data = localStorage.getItem('ble_profile');
  return data ? JSON.parse(data) : null;
}
```

**Standalone Mode - Backend Database:**
```python
# New SQLite table: ble_device_profiles
# Columns: id, mac_address (unique), service_uuid, notify_char_uuid, write_char_uuid, device_name, created_at, updated_at

# API endpoints to add:
# GET /api/v1/profiles - list all saved profiles
# GET /api/v1/profiles/{mac} - get profile by MAC
# POST /api/v1/profiles - save/update profile
# DELETE /api/v1/profiles/{mac} - delete profile
```

**Appwrite Mode - Backend Database (Opt-In):**
```python
# Appwrite collection: device_profiles
# Attributes:
#   - userId (required, indexed) - ties to authenticated user
#   - macAddress (required)
#   - serviceUuid
#   - notifyCharUuid
#   - writeCharUuid
#   - deviceName
#   - createdAt
#   - updatedAt
# Permissions: User can only read/write their own profiles

# Frontend flow:
# 1. After UUID discovery, show checkbox:
#    □ "Save UUIDs to your account for faster reconnection across devices?"
# 2. If checked → POST to backend → stores in Appwrite (with user ID)
# 3. On future visits → GET from backend → populate localStorage
```

**Frontend Backend Sync (Optional - both modes):**
```typescript
// frontend/src/lib/ble/profile.ts
export async function saveProfileToBackend(profile: Profile, optIn: boolean = false) {
  if (!optIn) return;

  try {
    await fetch('/api/v1/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
  } catch (e) {
    console.error('Failed to save profile to backend:', e);
    // Non-fatal - localStorage still works
  }
}

export async function loadProfileFromBackend(mac: string): Promise<Profile | null> {
  try {
    const res = await fetch(`/api/v1/profiles/${mac}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('Failed to load profile from backend:', e);
    return null;
  }
}
```

---

## Quick Start Commands

```bash
# 1. Add dependencies
cd backend
echo "aioesphomeapi==21.0.0" >> requirements.txt
echo "zeroconf==0.131.0" >> requirements.txt

# 2. Create module structure
mkdir -p app/services/esphome
touch app/services/esphome/{__init__.py,proxy_service.py,proxy_manager.py,device_manager.py,schemas.py}

# 3. Enable in environment
echo "ESPHOME_PROXY_MODE=true" >> .env

# 4. Build and run
cd ..
docker-compose up --build

# 5. Test mDNS discovery
docker-compose logs backend | grep -i esphome

# 6. Test API
curl http://localhost:8080/api/esphome/status
```

---

## Success Criteria

**Stage 1 Complete:** Backend discovers ESPHome proxy, filters SFP devices, exposes API
**Stage 2 Complete:** Frontend can list devices and retrieve UUIDs
**Stage 3 Complete:** Old Bleak proxy removed, Docker config cleaned up
**Stage 4 Complete:** Works on your network with your ESP32 + SFP Wizard

**Ship It:** Push to main, update README, move on to next feature.

---

## Out of Scope (For Now)

- ❌ ESPHome device configuration guide (assume user has it)
- ❌ Home Assistant integration (nice-to-have for later)
- ❌ Multi-device parallel connections (one device at a time is fine)
- ❌ Extensive error recovery (fail fast, show error, user retries)
- ❌ Bridge network + Avahi workaround (host network required)
- ❌ Unit tests (manual testing sufficient for Stage 1)

---

**Next Step:** Start with `backend/app/services/esphome/schemas.py` and work through the checklist top-to-bottom.
