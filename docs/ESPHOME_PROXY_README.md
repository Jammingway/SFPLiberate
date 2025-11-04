# ESPHome Bluetooth Proxy

**Status:** In Development
**Purpose:** Enable BLE connectivity for browsers without Web Bluetooth API support (Safari, iOS)

---

## Overview

Replaces the Bleak-based BLE proxy with ESPHome integration. Leverages existing ESPHome Bluetooth proxies that Home Assistant users already have running on their networks.

### Why ESPHome?

- **Cross-platform:** No direct hardware access needed (works in Docker)
- **Existing infrastructure:** HA users already have ESP32 proxies
- **Multi-proxy support:** Better coverage via RSSI-based selection
- **Lightweight:** Proxy only does discovery + UUID extraction, not real-time streaming

---

## How It Works

1. **Backend discovers ESPHome proxies** via mDNS (`_esphomelib._tcp.local`)
2. **Backend subscribes to BLE advertisements** from all proxies
3. **Frontend shows list of SFP devices** (SSE stream from backend)
4. **User selects device** → Backend connects via best proxy (highest RSSI)
5. **Backend retrieves UUIDs** from GATT services
6. **Frontend caches UUIDs** for future connections

**Important:** This is a **fallback** method. Browser Bluetooth is always preferred when available.

---

## Architecture

```
Frontend                Backend                 ESPHome Proxies
   │                       │                           │
   │ GET /api/esphome/status                          │
   │─────────────────────>│                           │
   │                       │ mDNS discovery            │
   │                       │──────────────────────────>│
   │                       │ Subscribe to BLE ads      │
   │                       │<──────────────────────────│
   │                       │                           │
   │ SSE /api/esphome/devices                         │
   │<─────────────────────│ (SFP device list)        │
   │                       │                           │
   │ POST /api/esphome/connect {mac}                  │
   │─────────────────────>│                           │
   │                       │ Connect to device         │
   │                       │──────────────────────────>│
   │                       │ GATT services             │
   │                       │<──────────────────────────│
   │                       │ Disconnect                │
   │                       │──────────────────────────>│
   │ {service, notify, write UUIDs}                   │
   │<─────────────────────│                           │
   │                       │                           │
   │ Cache UUIDs (localStorage)                       │
   │                       │                           │
```

---

## Configuration

### Backend

```bash
# .env
ESPHOME_PROXY_MODE=true
ESPHOME_DISCOVERY_TIMEOUT=10    # mDNS discovery timeout (seconds)
ESPHOME_CONNECTION_TIMEOUT=30   # Proxy connection timeout (seconds)
```

### Docker

**Important:** Requires `network_mode: host` for mDNS to work.

```yaml
# docker-compose.yml
services:
  backend:
    network_mode: host  # Required when ESPHOME_PROXY_MODE=true
    environment:
      - ESPHOME_PROXY_MODE=true
```

**Security Note:** `host` network mode exposes all container ports. Only use on trusted local networks.

---

## API Reference

### `GET /api/esphome/status`

Check if ESPHome proxy mode is enabled.

**Response:**
```json
{
  "enabled": true,
  "proxies_discovered": 2,
  "devices_discovered": 1
}
```

### `GET /api/esphome/devices`

Server-Sent Events stream of discovered SFP devices.

**Response (SSE):**
```
data: [{"macAddress": "AA:BB:CC:DD:EE:FF", "name": "SFP-Wizard-1234", "rssi": -50, "bestProxy": "living-room-proxy", "lastSeen": "2025-01-03T12:00:00Z"}]

data: [{"macAddress": "AA:BB:CC:DD:EE:FF", "name": "SFP-Wizard-1234", "rssi": -48, "bestProxy": "bedroom-proxy", "lastSeen": "2025-01-03T12:00:01Z"}]
```

### `POST /api/esphome/connect`

Connect to device via ESPHome proxy and retrieve UUIDs.

**Request:**
```json
{
  "mac_address": "AA:BB:CC:DD:EE:FF"
}
```

**Response:**
```json
{
  "service_uuid": "8E60F02E-F699-4865-B83F-F40501752184",
  "notify_char_uuid": "DC272A22-43F2-416B-8FA5-63A071542FAC",
  "write_char_uuid": "9280F26C-A56F-43EA-B769-D5D732E1AC67",
  "proxy_used": "living-room-proxy"
}
```

---

## Frontend Integration

### Check if ESPHome is Enabled

```typescript
const client = new ESPHomeClient();
const enabled = await client.isEnabled();

if (enabled) {
  // Show "ESPHome Proxy" option in connection UI
}
```

### Subscribe to Device Discovery

```typescript
const unsubscribe = client.subscribeToDevices((devices) => {
  console.log('Discovered SFP devices:', devices);
  // Update UI with device list
});

// Later: unsubscribe()
```

### Connect to Device

```typescript
const result = await client.connectToDevice('AA:BB:CC:DD:EE:FF');

// Store UUIDs for later use
saveActiveProfile({
  serviceUuid: result.serviceUuid,
  notifyCharUuid: result.notifyCharUuid,
  writeCharUuid: result.writeCharUuid
});
```

---

## UUID Caching

| Deployment Mode | Storage Location | Implementation |
|-----------------|------------------|----------------|
| **Appwrite Cloud** | Frontend (localStorage) | `saveActiveProfile()` / `loadActiveProfile()` |
| **Standalone Docker** | Backend (database or .env) | TBD - could use existing .env approach |

**Why cache?**
- Avoids re-discovery on every connection
- Faster reconnects
- Reduces network traffic

---

## Design Decisions

### Why mDNS?
- Zero-config (no manual IP entry)
- Dynamic (handles IP changes)
- Standard (ESPHome advertises via mDNS by default)

### Why SSE over WebSocket?
- Simpler (one-way data flow: backend → frontend)
- Browser native (`EventSource` API)
- Auto-reconnect built-in

### Why No Authentication?
- ESPHome default password is ""
- Assumes local trusted network
- Can add password support later if needed

### Why Fail Fast?
- Conservative timeouts prevent network spam
- Clear error messages to user
- User can retry manually

### Why No Real-Time Streaming?
- ESPHome proxy only for **discovery + UUID extraction**
- Actual EEPROM read/write uses cached UUIDs via Web Bluetooth or other proxy
- Reduces complexity and network load

---

## Limitations

- **Requires host network mode** (mDNS limitation)
- **Local network only** (no remote/cloud access)
- **No ESPHome authentication** (assumes default password)
- **User must configure ESPHome proxy** (out of scope for this app)
- **Single device at a time** (no parallel connections)

---

## Troubleshooting

### No Proxies Discovered

1. Check `ESPHOME_PROXY_MODE=true` in backend
2. Verify `network_mode: host` in docker-compose.yml
3. Ensure ESPHome proxy is on same network
4. Check firewall isn't blocking mDNS (port 5353 UDP)

### No Devices Discovered

1. Verify ESPHome proxy can see BLE devices (check ESPHome logs)
2. Ensure SFP Wizard is powered on and advertising
3. Check device name contains "SFP" (case-insensitive)

### Connection Failed

1. Check RSSI (signal strength) - move closer to proxy
2. Verify proxy isn't already handling another connection
3. Check ESPHome logs for errors
4. Try different proxy if multiple available

---

## Implementation Status

- [x] Design complete
- [x] Architecture documented
- [ ] Backend implementation
  - [ ] ProxyManager (mDNS + ESPHome API)
  - [ ] DeviceManager (RSSI tracking)
  - [ ] ProxyService (coordination)
  - [ ] API endpoints
- [ ] Frontend implementation
  - [ ] ESPHomeClient
  - [ ] Discovery UI
  - [ ] Connection flow integration
- [ ] Old Bleak proxy removed
- [ ] Documentation updated
- [ ] Manual testing complete

---

## References

- **Implementation Guide:** [ESPHOME_IMPLEMENTATION.md](./ESPHOME_IMPLEMENTATION.md)
- **ESPHome Bluetooth Proxy:** https://esphome.io/components/bluetooth_proxy.html
- **aioesphomeapi:** https://github.com/esphome/aioesphomeapi
- **mDNS (Zeroconf):** https://python-zeroconf.readthedocs.io/

---

## Next Steps

1. Implement backend services (see [ESPHOME_IMPLEMENTATION.md](./ESPHOME_IMPLEMENTATION.md))
2. Create API endpoints
3. Build frontend UI
4. Remove old Bleak proxy code
5. Test on local network with real ESPHome proxy
6. Update README and CLAUDE.md
7. Ship it!
