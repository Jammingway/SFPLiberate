# Code Review: Bluetooth & API Functionality

**Date:** November 2, 2024  
**Scope:** Comprehensive review of BLE and API code for brittle patterns, optimization opportunities, and potential bugs  
**Reviewed By:** AI Code Review Agent

## Executive Summary

This review identified **21 issues** across frontend and backend code, ranging from critical stability issues to optimization opportunities. The findings are categorized by severity:

- 🔴 **Critical (4)**: Issues that could cause data loss, crashes, or security vulnerabilities
- 🟡 **High (8)**: Issues that significantly impact reliability or user experience
- 🟠 **Medium (6)**: Issues that reduce code maintainability or performance
- 🟢 **Low (3)**: Minor optimization opportunities

## Table of Contents

1. [BLE Manager Issues](#ble-manager-issues)
2. [Web Bluetooth Helper Issues](#web-bluetooth-helper-issues)
3. [API Client Issues](#api-client-issues)
4. [Backend API Issues](#backend-api-issues)
5. [Database Issues](#database-issues)
6. [Proxy Client Issues](#proxy-client-issues)
7. [State Management Issues](#state-management-issues)
8. [Prioritized Action Plan](#prioritized-action-plan)

---

## BLE Manager Issues

### 🔴 CRITICAL: No Connection Cleanup on Disconnect

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 32-33 (active connection state)

**Issue:**
```typescript
let active: ActiveConnection | null = null;
```

The `active` connection is never properly cleaned up when a BLE disconnect occurs. The `gattserverdisconnected` event listener in `webbluetooth.ts` is a no-op:

```typescript
device.addEventListener('gattserverdisconnected', () => {
  // No-op; consumer can attach their own callbacks
});
```

**Impact:**
- Memory leaks from accumulated notification listeners
- Dangling references to disconnected devices
- Reconnection attempts may fail due to stale state
- Status monitoring interval continues running after disconnect

**Fix:**
```typescript
// In webbluetooth.ts
device.addEventListener('gattserverdisconnected', () => {
  handleDisconnection();
});

// In manager.ts
export function handleDisconnection() {
  if (active) {
    // Clear listeners
    listeners.length = 0;
    active = null;
  }
  setConnected(false);
  setConnectionType('Not Connected');
  logLine('Device disconnected');
}
```

---

### 🟡 HIGH: Polling Interval Never Cleared on Error

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 88-98

**Issue:**
```typescript
function scheduleStatusMonitoring() {
  requestDeviceStatus();
  const id = setInterval(() => {
    const st = getBleState();
    if (!st.connected) {
      clearInterval(id);
      return;
    }
    requestDeviceStatus();
  }, 5000);
}
```

If `requestDeviceStatus()` throws (e.g., device disconnected but state not updated), the interval continues running indefinitely.

**Impact:**
- Background errors every 5 seconds
- Console spam
- Wasted CPU cycles

**Fix:**
```typescript
let statusMonitoringId: ReturnType<typeof setInterval> | null = null;

function scheduleStatusMonitoring() {
  // Clear any existing monitor
  if (statusMonitoringId) {
    clearInterval(statusMonitoringId);
  }
  
  requestDeviceStatus().catch(() => {}); // Fire-and-forget
  
  statusMonitoringId = setInterval(() => {
    const st = getBleState();
    if (!st.connected) {
      clearInterval(statusMonitoringId!);
      statusMonitoringId = null;
      return;
    }
    requestDeviceStatus().catch((e) => {
      logLine(`Status check failed: ${String(e)}`);
      // Consider disconnecting after N failures
    });
  }, 5000);
}

export function stopStatusMonitoring() {
  if (statusMonitoringId) {
    clearInterval(statusMonitoringId);
    statusMonitoringId = null;
  }
}
```

---

### 🟡 HIGH: Message Listener Timeouts Never Cleaned Up

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 33, 365-375

**Issue:**
```typescript
const listeners: MsgListener[] = [];

export function waitForMessage(pattern: string | RegExp, timeoutMs = 5000) {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const idx = listeners.findIndex((x) => x.resolve === resolve);
      if (idx >= 0) listeners.splice(idx, 1);
      reject(new Error(`Timeout waiting for message: ${String(pattern)}`));
    }, timeoutMs);
    listeners.push({ pattern, resolve, reject, timeoutId });
  });
}
```

If the promise is never awaited or `.catch()` is not called, the timeout fires but the rejection is unhandled, causing warnings.

**Impact:**
- Unhandled promise rejection warnings in console
- Listener array can grow indefinitely if many fire-and-forget calls are made
- Potential memory leak

**Fix:**
```typescript
export function waitForMessage(pattern: string | RegExp, timeoutMs = 5000) {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const idx = listeners.findIndex((x) => x.resolve === resolve);
      if (idx >= 0) listeners.splice(idx, 1);
      reject(new Error(`Timeout waiting for message: ${String(pattern)}`));
    }, timeoutMs);
    
    const listener = { pattern, resolve, reject, timeoutId };
    listeners.push(listener);
    
    // Add cleanup on resolution
    const originalResolve = resolve;
    listener.resolve = (text: string) => {
      clearTimeout(timeoutId);
      originalResolve(text);
    };
  });
}

// Also add a cleanup function
export function clearAllMessageListeners() {
  listeners.forEach(l => clearTimeout(l.timeoutId));
  listeners.length = 0;
}
```

---

### 🟡 HIGH: Text Detection Heuristic Too Simplistic

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 141-153

**Issue:**
```typescript
let isLikelyText = true;
for (let i = 0; i < bytes.length; i++) {
  const b = bytes[i];
  if (!(b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126))) {
    isLikelyText = false;
    break;
  }
}
```

This heuristic:
- Fails for UTF-8 text (only checks ASCII)
- Classifies short binary sequences that happen to be ASCII as text
- No length threshold (a single byte `0x41` ('A') is "text")

**Impact:**
- Binary EEPROM data starting with ASCII characters might be misclassified
- UTF-8 device responses (e.g., emoji, localized text) treated as binary

**Fix:**
```typescript
function detectContentType(bytes: Uint8Array): 'text' | 'binary' {
  // Must be at least 4 bytes to be considered text
  if (bytes.length < 4) return 'binary';
  
  // Check for known binary signatures
  if (bytes[0] === 0x03 && bytes.length >= 256) {
    // SFF-8472 EEPROM marker (identifier byte 0x03 at start)
    return 'binary';
  }
  
  // Try UTF-8 decode (handles ASCII + UTF-8)
  try {
    const text = textDecoder.decode(bytes);
    
    // If decode succeeds, check if it's printable
    const printableRatio = [...text].filter(c => {
      const code = c.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126) || code > 127;
    }).length / text.length;
    
    // If >80% printable, consider it text
    return printableRatio > 0.8 ? 'text' : 'binary';
  } catch {
    return 'binary';
  }
}
```

---

### 🟠 MEDIUM: No Retry Logic for Failed Commands

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 132-136

**Issue:**
```typescript
export async function sendBleCommand(command: string) {
  if (!active) throw new Error('Not connected');
  await writeText(active.write, command);
  logLine(`Sent Command: ${command}`);
}
```

BLE write operations can fail due to:
- Temporary connection issues
- Buffer overflow on device
- Timing issues

No retry mechanism exists.

**Impact:**
- Critical commands like `[POST] /sif/start` may fail silently
- User must manually retry operations

**Fix:**
```typescript
export async function sendBleCommand(
  command: string, 
  options: { retries?: number; retryDelay?: number } = {}
) {
  const { retries = 2, retryDelay = 500 } = options;
  
  if (!active) throw new Error('Not connected');
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await writeText(active.write, command);
      logLine(`Sent Command: ${command}`);
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      
      logLine(`Command failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      await new Promise(r => setTimeout(r, retryDelay));
    }
  }
}
```

---

### 🟠 MEDIUM: Weak Firmware Version Warning

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 15, 171-174

**Issue:**
```typescript
const TESTED_FIRMWARE_VERSION = '1.0.10';
// ...
if (v !== TESTED_FIRMWARE_VERSION) {
  logLine(`Warning: App developed for firmware v${TESTED_FIRMWARE_VERSION}; device is v${v}.`);
}
```

Exact version match is too strict. Patch versions (`1.0.11`, `1.0.12`) likely compatible but trigger warnings.

**Impact:**
- Unnecessary user concern
- Support burden ("Why is app showing warnings?")

**Fix:**
```typescript
const TESTED_FIRMWARE_VERSION = '1.0.10';
const MIN_SUPPORTED_VERSION = '1.0.0';
const MAX_SUPPORTED_MAJOR = 1;

function checkFirmwareCompatibility(deviceVersion: string) {
  const [devMajor, devMinor] = deviceVersion.split('.').map(Number);
  const [minMajor, minMinor] = MIN_SUPPORTED_VERSION.split('.').map(Number);
  
  if (devMajor < minMajor || (devMajor === minMajor && devMinor < minMinor)) {
    return { compatible: false, reason: 'too old' };
  }
  
  if (devMajor > MAX_SUPPORTED_MAJOR) {
    return { compatible: false, reason: 'too new' };
  }
  
  return { compatible: true };
}

// Usage:
const compat = checkFirmwareCompatibility(v);
if (!compat.compatible) {
  logLine(`⚠️ Firmware v${v} may not be compatible (tested on v${TESTED_FIRMWARE_VERSION})`);
} else if (v !== TESTED_FIRMWARE_VERSION) {
  logLine(`ℹ️ Firmware v${v} detected (tested on v${TESTED_FIRMWARE_VERSION})`);
}
```

---

## Web Bluetooth Helper Issues

### 🟡 HIGH: No Timeout for GATT Operations

**File:** `frontend/src/lib/ble/webbluetooth.ts`  
**Lines:** 32-40

**Issue:**
```typescript
export async function connectDirect(profile: SfpProfile) {
  const device = await requestDeviceWithFallback(profile.serviceUuid);
  // ...
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(profile.serviceUuid);
  const writeCharacteristic = await service.getCharacteristic(profile.writeCharUuid);
  const notifyCharacteristic = await service.getCharacteristic(profile.notifyCharUuid);
  // ...
}
```

GATT operations can hang indefinitely if:
- Device is powered off mid-connection
- Radio interference
- Device firmware crashes

**Impact:**
- UI freezes
- User forced to reload page

**Fix:**
```typescript
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    )
  ]);
}

export async function connectDirect(profile: SfpProfile, timeout = 10000) {
  const device = await withTimeout(
    requestDeviceWithFallback(profile.serviceUuid),
    timeout,
    'Device selection'
  );
  
  const server = await withTimeout(
    device.gatt.connect(),
    timeout,
    'GATT connection'
  );
  
  const service = await withTimeout(
    server.getPrimaryService(profile.serviceUuid),
    timeout,
    'Service discovery'
  );
  
  const writeCharacteristic = await withTimeout(
    service.getCharacteristic(profile.writeCharUuid),
    timeout,
    'Write characteristic discovery'
  );
  
  const notifyCharacteristic = await withTimeout(
    service.getCharacteristic(profile.notifyCharUuid),
    timeout,
    'Notify characteristic discovery'
  );
  
  return { device, server, service, writeCharacteristic, notifyCharacteristic };
}
```

---

### 🟠 MEDIUM: writeChunks Progress Callback Inconsistent

**File:** `frontend/src/lib/ble/webbluetooth.ts`  
**Lines:** 62-82

**Issue:**
```typescript
const written = Math.ceil((i + chunk.length) / chunkSize);
if (onProgress) onProgress(written, totalChunks);
```

Progress is only called on successful writes. If a write fails mid-transfer, the last reported progress is stale.

**Impact:**
- UI shows incorrect progress after errors
- No way for caller to detect stalled writes

**Fix:**
```typescript
export async function writeChunks(
  writeCharacteristic: GattLikeCharacteristic,
  data: Uint8Array,
  chunkSize = 20,
  delayMs = 10,
  withResponse = false,
  onProgress?: (writtenChunks: number, totalChunks: number) => void,
) {
  const totalChunks = Math.ceil(data.length / chunkSize);
  
  try {
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, Math.min(i + chunkSize, data.length));
      
      if (withResponse) {
        await writeCharacteristic.writeValue(chunk);
      } else {
        await writeCharacteristic.writeValueWithoutResponse(chunk);
      }
      
      const written = Math.ceil((i + chunk.length) / chunkSize);
      if (onProgress) onProgress(written, totalChunks);
      
      if (delayMs > 0 && i + chunkSize < data.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  } catch (error) {
    // Report current position on error
    const written = Math.ceil(i / chunkSize);
    if (onProgress) onProgress(written, totalChunks);
    throw error;
  }
}
```

---

### 🟢 LOW: Safari/iOS Detection Could Be More Robust

**File:** `frontend/src/lib/ble/webbluetooth.ts`  
**Lines:** 90-100

**Issue:**
User agent sniffing is brittle as browsers can change UA strings.

**Fix:**
```typescript
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  // Feature detection first
  const hasSafariOnlyFeatures = 'safari' in window;
  
  // UA check as fallback
  const ua = navigator.userAgent;
  const isSafariUA = /Safari\//.test(ua) && 
                     !/Chrome\//.test(ua) && 
                     !/Chromium\//.test(ua) && 
                     !/Edg\//.test(ua);
  
  return hasSafariOnlyFeatures || isSafariUA;
}
```

---

## API Client Issues

### 🔴 CRITICAL: No Error Handling for Failed API Calls

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 231-233, 243-251, 356-358

**Issue:**
```typescript
export async function listModules() {
  const base = features.api.baseUrl;
  const res = await fetch(`${base}/v1/modules`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

Network errors (timeout, DNS failure, CORS) cause unhandled promise rejections. No retry logic for transient failures.

**Impact:**
- App crashes or shows generic errors
- Network blips cause permanent failures

**Fix:**
```typescript
class APIError extends Error {
  constructor(
    message: string, 
    public statusCode?: number, 
    public originalError?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchWithRetry(
  url: string, 
  options: RequestInit = {},
  retries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return res;
      
    } catch (error) {
      if (attempt === retries) {
        throw new APIError(
          'Network request failed after retries',
          undefined,
          error
        );
      }
      
      // Exponential backoff
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable');
}

export async function listModules() {
  try {
    const base = features.api.baseUrl;
    const res = await fetchWithRetry(`${base}/v1/modules`);
    
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new APIError(`Failed to fetch modules: ${body}`, res.status);
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError('Network error', undefined, error);
  }
}
```

---

### 🟡 HIGH: Base64 Encoding Can Crash on Large Files

**File:** `frontend/src/lib/ble/manager.ts`  
**Lines:** 241-242

**Issue:**
```typescript
const bytes = new Uint8Array(buf);
const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
```

`String.fromCharCode(...array)` uses spread operator, which can cause stack overflow for large arrays (>100KB).

**Impact:**
- Crashes when saving large EEPROM dumps (>256 bytes is fine, but this pattern is fragile)
- RangeError: Maximum call stack size exceeded

**Fix:**
```typescript
function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Or use modern API:
function base64EncodeModern(bytes: Uint8Array): string {
  // Using btoa with chunked processing
  const chunkSize = 8192;
  let binary = '';
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...Array.from(chunk));
  }
  
  return btoa(binary);
}

// Usage:
const b64 = base64EncodeModern(new Uint8Array(buf));
```

---

## Backend API Issues

### 🔴 CRITICAL: No Input Validation on Base64 Decode

**File:** `backend/main.py`  
**Lines:** 91-94, 138-141

**Issue:**
```python
try:
    eeprom_data = base64.b64decode(module.eeprom_data_base64)
except Exception:
    raise HTTPException(status_code=400, detail="Invalid Base64 data.")
```

This catches **all** exceptions including `KeyboardInterrupt`, `SystemExit`, etc. Also, no size validation.

**Impact:**
- Malicious payloads could cause memory exhaustion
- Overly broad exception catching masks real errors

**Fix:**
```python
MAX_EEPROM_SIZE = 1024 * 1024  # 1MB max

def decode_and_validate_eeprom(base64_data: str) -> bytes:
    """Safely decode and validate EEPROM data."""
    try:
        # Check encoded size first (rough estimate)
        if len(base64_data) > (MAX_EEPROM_SIZE * 4 / 3):  # Base64 expands by ~33%
            raise ValueError("EEPROM data too large")
        
        eeprom_data = base64.b64decode(base64_data, validate=True)
        
        # Validate decoded size
        if len(eeprom_data) > MAX_EEPROM_SIZE:
            raise ValueError("EEPROM data exceeds maximum size")
        
        # Validate minimum size (SFP EEPROM is typically 256 bytes minimum)
        if len(eeprom_data) < 128:
            raise ValueError("EEPROM data too small")
        
        return eeprom_data
        
    except (base64.binascii.Error, ValueError) as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid EEPROM data: {str(e)}"
        )

# Usage:
eeprom_data = decode_and_validate_eeprom(module.eeprom_data_base64)
```

---

### 🟡 HIGH: Submission Endpoint Has Directory Traversal Risk

**File:** `backend/main.py`  
**Lines:** 146-163

**Issue:**
```python
inbox_id = str(uuid.uuid4())
target_dir = os.path.join(inbox_root, inbox_id)
os.makedirs(target_dir, exist_ok=True)
```

If `inbox_root` comes from environment variable and contains path traversal characters, files could be written outside intended directory.

**Impact:**
- Potential arbitrary file write vulnerability
- Could overwrite system files if running as root

**Fix:**
```python
import pathlib

def safe_submission_path(inbox_root: str, inbox_id: str) -> pathlib.Path:
    """Safely construct submission directory path."""
    # Normalize and validate inbox root
    root = pathlib.Path(inbox_root).resolve()
    
    # Validate inbox_id is a valid UUID (no path characters)
    try:
        uuid.UUID(inbox_id)
    except ValueError:
        raise ValueError("Invalid inbox ID")
    
    # Construct target path
    target = (root / inbox_id).resolve()
    
    # Ensure target is within root
    if not str(target).startswith(str(root)):
        raise ValueError("Path traversal detected")
    
    return target

# Usage:
inbox_id = str(uuid.uuid4())
target_dir = safe_submission_path(inbox_root, inbox_id)
target_dir.mkdir(parents=True, exist_ok=True)
```

---

### 🟠 MEDIUM: No Rate Limiting on Submission Endpoint

**File:** `backend/main.py`  
**Lines:** 127-163

**Issue:**
Submission endpoint has no rate limiting. Attacker could flood disk with submissions.

**Impact:**
- Disk space exhaustion
- Denial of service

**Fix:**
```python
from fastapi import Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/submissions", response_model=CommunitySubmissionOut)
@limiter.limit("5/hour")  # 5 submissions per hour per IP
async def submit_to_community(request: Request, payload: CommunitySubmissionIn):
    # ... existing code
```

---

## Database Issues

### 🟡 HIGH: Connection Not Closed on Error

**File:** `backend/database_manager.py`  
**Lines:** 13-16

**Issue:**
```python
def get_db_connection():
    """Establishes a database connection."""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn
```

Connections are used in context managers (`with get_db_connection() as conn`), but if an exception occurs before the `with` block exits, connection may leak.

**Impact:**
- Connection leaks under error conditions
- "Database locked" errors under load

**Fix:**
```python
from contextlib import contextmanager

@contextmanager
def get_db_connection():
    """Establishes a database connection with guaranteed cleanup."""
    conn = sqlite3.connect(DATABASE_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

---

### 🟠 MEDIUM: No Connection Pooling

**File:** `backend/database_manager.py`  
**Lines:** 13-16

**Issue:**
Each request opens a new SQLite connection. Under load, this is slow.

**Impact:**
- Slower response times
- Connection overhead

**Fix:**
```python
from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker

# Create engine with pooling
engine = create_engine(
    f'sqlite:///{DATABASE_FILE}',
    poolclass=pool.StaticPool,  # For SQLite in-process
    connect_args={'check_same_thread': False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Get database session (use with FastAPI Depends)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

### 🟠 MEDIUM: Duplicate Detection Race Condition

**File:** `backend/database_manager.py`  
**Lines:** 44-60

**Issue:**
```python
try:
    cursor.execute(
        "INSERT INTO sfp_modules (name, vendor, model, serial, eeprom_data, sha256) VALUES (?, ?, ?, ?, ?, ?)",
        (name, vendor, model, serial, sqlite3.Binary(eeprom_data), digest)
    )
    conn.commit()
    return cursor.lastrowid, False
except sqlite3.IntegrityError:
    cursor.execute("SELECT id FROM sfp_modules WHERE sha256 = ? LIMIT 1", (digest,))
    row = cursor.fetchone()
    if row:
        return int(row[0]), True
    raise
```

Race condition: Two requests with same SHA256 could both get `IntegrityError`, but the second `SELECT` might find nothing if first transaction hasn't committed yet.

**Impact:**
- Duplicate rejection fails intermittently
- User gets cryptic error instead of "duplicate" message

**Fix:**
```python
def add_module(name: str, vendor: str, model: str, serial: str, eeprom_data: bytes) -> Tuple[int, bool]:
    """
    Adds a new SFP module's data to the database.
    Returns (id, is_duplicate) tuple.
    """
    digest = hashlib.sha256(eeprom_data).hexdigest()
    
    with get_db_connection() as conn:
        # Use IMMEDIATE transaction to prevent race
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.cursor()
        
        # Check for duplicate first
        cursor.execute("SELECT id FROM sfp_modules WHERE sha256 = ? LIMIT 1", (digest,))
        existing = cursor.fetchone()
        if existing:
            return int(existing[0]), True
        
        # Insert new
        cursor.execute(
            "INSERT INTO sfp_modules (name, vendor, model, serial, eeprom_data, sha256) VALUES (?, ?, ?, ?, ?, ?)",
            (name, vendor, model, serial, sqlite3.Binary(eeprom_data), digest)
        )
        conn.commit()
        return cursor.lastrowid, False
```

---

## Proxy Client Issues

### 🟡 HIGH: WebSocket Reconnection Not Implemented

**File:** `frontend/src/lib/ble/proxyClient.ts`  
**Lines:** 24-47

**Issue:**
```typescript
this.ws.onclose = () => {
  this.connected = false;
  this.device = null;
};
```

If WebSocket disconnects, no automatic reconnection happens.

**Impact:**
- User must reload page after network blip
- Poor UX for mobile users

**Fix:**
```typescript
private reconnectAttempts = 0;
private readonly MAX_RECONNECT_ATTEMPTS = 5;
private reconnectDelay = 1000;

async connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      resolve();
    };
    
    this.ws.onerror = (err) => {
      if (this.reconnectAttempts === 0) {
        reject(new Error('WebSocket connection failed'));
      }
    };
    
    this.ws.onclose = () => {
      this.connected = false;
      this.device = null;
      
      // Attempt reconnection
      if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        setTimeout(() => {
          console.log(`Reconnecting (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
          this.connect().catch(() => {});
        }, this.reconnectDelay);
        
        this.reconnectDelay *= 2; // Exponential backoff
      }
    };
    
    this.ws.onmessage = (evt) => {
      try {
        this.handleMessage(JSON.parse(evt.data as string));
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };
  });
}
```

---

### 🟠 MEDIUM: Message Handler Has No Error Recovery

**File:** `frontend/src/lib/ble/proxyClient.ts`  
**Lines:** 49-87

**Issue:**
```typescript
private handleMessage(message: any) {
  const { type } = message || {};
  switch (type) {
    case 'error': {
      this.reject('error', new Error(message.error || 'proxy error'));
      break;
    }
    // ...
  }
}
```

If message handler crashes, WebSocket keeps running but stops processing messages.

**Impact:**
- Silent failures
- Zombie connections

**Fix:**
```typescript
this.ws.onmessage = (evt) => {
  try {
    const message = JSON.parse(evt.data as string);
    this.handleMessage(message);
  } catch (e) {
    console.error('Message handler error:', e);
    // Optionally notify all pending handlers
    this.handlers.forEach(h => h.reject(new Error('Message processing failed')));
    this.handlers.clear();
  }
};
```

---

## State Management Issues

### 🟢 LOW: State Not Persisted Across Page Reloads

**File:** `frontend/src/lib/ble/store.ts`

**Issue:**
State is in-memory only. User reloads page and loses connection status, logs, EEPROM data.

**Impact:**
- Poor UX: user must re-read SFP after accidental reload
- Lost debugging logs

**Fix:**
```typescript
// Persist critical state to sessionStorage
export function setRawEeprom(buf: ArrayBuffer | null) {
  state.rawEepromData = buf;
  
  if (buf) {
    // Store to sessionStorage (survives page reload but not tab close)
    const bytes = new Uint8Array(buf);
    const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
    sessionStorage.setItem('rawEeprom', b64);
  } else {
    sessionStorage.removeItem('rawEeprom');
  }
  
  emit();
}

// On initialization, restore state
export function restoreState() {
  const b64 = sessionStorage.getItem('rawEeprom');
  if (b64) {
    try {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      state.rawEepromData = bytes.buffer;
    } catch {}
  }
}
```

---

## Prioritized Action Plan

### Phase 1: Critical Fixes (Do Immediately)

1. **Add connection cleanup on disconnect** (BLE Manager)
   - Prevent memory leaks
   - Estimated effort: 2 hours

2. **Implement API client error handling & retry** (API Client)
   - Prevent crashes
   - Estimated effort: 3 hours

3. **Add input validation to backend** (Backend API)
   - Prevent DoS
   - Estimated effort: 2 hours

4. **Fix directory traversal risk** (Backend API)
   - Security vulnerability
   - Estimated effort: 1 hour

### Phase 2: High Priority (Do This Week)

5. **Add GATT operation timeouts** (Web Bluetooth)
   - Prevent UI freezes
   - Estimated effort: 2 hours

6. **Fix polling interval cleanup** (BLE Manager)
   - Prevent resource leaks
   - Estimated effort: 1 hour

7. **Implement WebSocket reconnection** (Proxy Client)
   - Better mobile UX
   - Estimated effort: 3 hours

8. **Fix message listener cleanup** (BLE Manager)
   - Prevent memory leaks
   - Estimated effort: 2 hours

9. **Add rate limiting** (Backend API)
   - Prevent abuse
   - Estimated effort: 1 hour (with library)

### Phase 3: Medium Priority (Do This Month)

10. **Improve text/binary detection** (BLE Manager)
11. **Add retry logic for BLE commands** (BLE Manager)
12. **Fix base64 encoding for large files** (API Client)
13. **Add connection pooling** (Database)
14. **Fix duplicate detection race condition** (Database)
15. **Improve writeChunks progress reporting** (Web Bluetooth)

### Phase 4: Low Priority (Nice to Have)

16. **Improve firmware version checking** (BLE Manager)
17. **Make browser detection more robust** (Web Bluetooth)
18. **Add state persistence** (State Management)

---

## Testing Recommendations

### Unit Tests Needed

1. **Base64 encoding/decoding with large files**
2. **Text vs binary detection with edge cases**
3. **Timeout utilities**
4. **Safe path construction**

### Integration Tests Needed

1. **Connection cleanup on disconnect**
2. **API retry logic under network failures**
3. **Duplicate SHA256 handling with concurrent requests**
4. **WebSocket reconnection flow**

### Manual Testing Needed

1. **Disconnect device during write operation**
2. **Reload page during EEPROM transfer**
3. **Submit 100+ modules to check rate limiting**
4. **Test with firmware versions 1.0.9, 1.0.10, 1.0.11**

---

## Conclusion

The codebase has solid fundamentals but several critical issues around resource cleanup, error handling, and edge cases. The discovery refactor was excellent; applying similar rigor to connection management and API client code will greatly improve stability.

**Estimated Total Effort:** ~25-30 hours for all fixes  
**Recommended Approach:** Tackle Phase 1 immediately, then Phase 2 before next release

