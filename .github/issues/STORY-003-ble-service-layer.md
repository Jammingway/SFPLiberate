# [STORY-003] BLE Service Layer (TypeScript Migration)

**Story ID:** STORY-003
**Parent Epic:** #XXX (EPIC-001)
**Priority:** P0 (Blocker)
**Story Points:** 8
**Phase:** Phase 1 - Foundation
**Labels:** `story`, `foundation`, `ble`, `typescript`, `p0`

---

## 📋 Description

**As a** developer,
**I want** a clean TypeScript service layer for BLE operations (Web Bluetooth + proxy),
**So that** I have a type-safe, testable foundation for all BLE functionality.

## ✅ Acceptance Criteria

- [ ] `lib/ble/types.ts` created with all BLE-related TypeScript types
- [ ] `lib/ble/direct.ts` implements Web Bluetooth API wrapper
- [ ] `lib/ble/proxy.ts` implements WebSocket proxy client (ported from `ble-proxy-client.js`)
- [ ] `lib/ble/manager.ts` provides unified interface for both modes
- [ ] `lib/ble/parser.ts` implements SFF-8472 EEPROM parser
- [ ] `lib/ble/statusMonitor.ts` handles periodic status polling
- [ ] EventEmitter pattern for notifications and status updates
- [ ] Chunked write support (BLE_WRITE_CHUNK_SIZE = 20 bytes)
- [ ] Auto-detect connection mode (Web Bluetooth → proxy fallback)
- [ ] All code in TypeScript strict mode (no `any` types)
- [ ] Unit tests for parser and manager (80%+ coverage)
- [ ] Integration tests with mocked Web Bluetooth API

## 🔧 Tasks

### 1. Type Definitions (`lib/ble/types.ts`)
- [ ] Define `BleProfile` interface:
  ```typescript
  interface BleProfile {
    serviceUuid: string;
    writeCharUuid: string;
    notifyCharUuid: string;
    deviceAddress?: string;
    deviceName?: string;
  }
  ```
- [ ] Define `ConnectionMode` type: `'direct' | 'proxy' | 'auto'`
- [ ] Define `BleConnectionStatus`, `SfpStatus`, `DeviceStatus` types
- [ ] Define `BleNotification`, `StatusUpdate` event types

### 2. Web Bluetooth Wrapper (`lib/ble/direct.ts`)
- [ ] Port `connectToDevice()` from `script.js` lines 415-470
- [ ] Implement `sendCommand(command: string): Promise<void>`
- [ ] Implement `disconnect(): Promise<void>`
- [ ] Handle GATT server connection lifecycle
- [ ] EventEmitter for notifications (`characteristicvaluechanged`)
- [ ] Handle disconnection events
- [ ] Type-safe characteristic access

### 3. BLE Proxy Client (`lib/ble/proxy.ts`)
- [ ] Port `ble-proxy-client.js` to TypeScript
- [ ] Implement `connectViaProxy(wsUrl: string, profile: BleProfile)`
- [ ] WebSocket message type definitions (match backend schemas)
- [ ] Base64 encoding/decoding for binary data
- [ ] EventEmitter for proxy notifications
- [ ] Reconnection logic on disconnect
- [ ] Timeout handling

### 4. Unified BLE Manager (`lib/ble/manager.ts`)
- [ ] Auto-detect connection mode based on browser capabilities
- [ ] Expose unified API:
  ```typescript
  class BleManager {
    connect(profile: BleProfile, mode: ConnectionMode): Promise<void>
    disconnect(): Promise<void>
    sendCommand(command: string): Promise<void>
    read(): Promise<ArrayBuffer>
    write(data: ArrayBuffer): Promise<void>
    on(event: string, handler: Function): void
    off(event: string, handler: Function): void
  }
  ```
- [ ] Switch between direct/proxy transparently
- [ ] Maintain connection state
- [ ] Event emitters for all notifications

### 5. SFF-8472 Parser (`lib/ble/parser.ts`)
- [ ] Port `parseAndDisplaySfpData()` from `script.js` lines 920-936
- [ ] Parse vendor (bytes 20-36), model (40-56), serial (68-84)
- [ ] Return typed `SfpData` object:
  ```typescript
  interface SfpData {
    vendor: string;
    model: string;
    serial: string;
    raw: ArrayBuffer;
  }
  ```
- [ ] Handle invalid/truncated EEPROM data
- [ ] Unit tests with various EEPROM fixtures

### 6. Status Monitor (`lib/ble/statusMonitor.ts`)
- [ ] Port periodic status polling from `script.js` lines 560-582
- [ ] Send `[GET] /stats` every 5 seconds (configurable)
- [ ] Parse `sysmon:` response (battery, SFP presence, firmware)
- [ ] Emit status update events
- [ ] Start/stop based on connection state
- [ ] Pause during read/write operations (optional)

### 7. Testing
- [ ] Unit tests for parser (`tests/unit/parser.test.ts`)
- [ ] Unit tests for manager logic (`tests/unit/manager.test.ts`)
- [ ] Mock Web Bluetooth API for tests
- [ ] Integration tests with test fixtures (`tests/fixtures/mock-eeprom.bin`)

## 🔗 Dependencies

**Depends on:**
- #XXX STORY-001 (project scaffolding)
- #XXX STORY-002 (API client for proxy endpoints)

**Blocks:**
- #XXX STORY-006 (device connection flow)
- #XXX STORY-008 (SFP read operation)
- #XXX STORY-009 (SFP write operation)

## 🧪 Testing Requirements

- [ ] **Unit Tests** (Jest + RTL):
  - Parser with valid/invalid EEPROM data
  - Manager mode detection logic
  - Event emitter patterns
- [ ] **Integration Tests**:
  - Mock Web Bluetooth API
  - Mock WebSocket server for proxy
  - End-to-end connection flow (mocked)
- [ ] **Coverage:** 80%+ for BLE service layer

## 📝 Notes

- This is the **most critical story** in Phase 1 - all BLE features depend on it
- Porting 400+ lines of vanilla JS to TypeScript with proper types
- EventEmitter pattern is key for React integration (hooks will listen to events)
- Keep Web Bluetooth and proxy logic separate but behind unified interface
- Use same constants from current code:
  - `BLE_WRITE_CHUNK_SIZE = 20`
  - `BLE_WRITE_CHUNK_DELAY_MS = 10`
  - `TESTED_FIRMWARE_VERSION = "1.0.10"`

## 🐛 Edge Cases to Handle

- [ ] Browser doesn't support Web Bluetooth → fall back to proxy
- [ ] Proxy WebSocket connection fails → show clear error
- [ ] Device disconnects mid-operation → clean up resources, emit event
- [ ] EEPROM data is truncated (< 96 bytes) → show error
- [ ] Binary vs text notification detection (heuristic from current code)
- [ ] Timeout waiting for message acknowledgment

## 📚 Reference Documents

- [Epic Plan](../../docs/NEXTJS_REWRITE_EPIC.md#story-003-ble-service-layer-typescript-migration)
- [Current Implementation](../../frontend/script.js) - lines 1-900
- [BLE Proxy Client](../../frontend/ble-proxy-client.js)
- [BLE API Spec](../../docs/BLE_API_SPECIFICATION.md)

---

**Assignee:** TBD
**Status:** 📋 To Do
**Created:** 2025-11-02
**Target Completion:** Week 2
**Estimated Hours:** 12-16 hours
