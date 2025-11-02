import { buildDefaultProxyWsUrl, BLEProxyClient } from './proxyClient';
import { connectDirect, isWebBluetoothAvailable, startNotifications, writeText, writeChunks } from './webbluetooth';
import type { ConnectionMode, ResolvedMode, SfpProfile } from './types';
import { requireProfile, saveActiveProfile } from './profile';
import {
  getBleState,
  log as logLine,
  setBattery,
  setConnected,
  setConnectionType,
  setDeviceVersion,
  setRawEeprom,
  setResolvedMode,
  setSfpPresent,
} from './store';
import { features } from '@/lib/features';

const TESTED_FIRMWARE_VERSION = '1.0.10';

export function resolveConnectionMode(selected: ConnectionMode): ResolvedMode {
  if (selected === 'web-bluetooth') return 'direct';
  if (selected === 'proxy') return 'proxy';
  // Auto
  if (isWebBluetoothAvailable()) return 'direct';
  if (BLEProxyClient.isAvailable()) return 'proxy';
  return 'none';
}

export type ActiveConnection = {
  mode: ResolvedMode;
  write?: any;
  notify?: any;
  proxy?: BLEProxyClient | null;
};

let active: ActiveConnection | null = null;

export async function connect(selected: ConnectionMode) {
  const mode = resolveConnectionMode(selected);
  setResolvedMode(mode);
  if (mode === 'none') {
    logLine('No supported BLE connection mode available in this environment.');
    throw new Error('No BLE connection method available');
  }

  return mode === 'proxy' ? connectViaProxy() : connectDirectMode();
}

async function connectDirectMode() {
  logLine('Requesting BLE device...');
  const profile = requireProfile();
  const { device, server, service, writeCharacteristic, notifyCharacteristic } = await connectDirect(profile);
  active = { mode: 'direct', write: writeCharacteristic, notify: notifyCharacteristic, proxy: null };
  await startNotifications(notifyCharacteristic, handleNotifications);
  setConnected(true);
  setConnectionType('Direct (Web Bluetooth)');
  await getDeviceVersion();
  scheduleStatusMonitoring();
  return device;
}

async function connectViaProxy() {
  const wsUrl = buildDefaultProxyWsUrl('/api/v1/ble/ws');
  logLine(`Connecting via BLE Proxy (${wsUrl})...`);
  const proxy = new BLEProxyClient(wsUrl);
  await proxy.connect();
  const profile = requireProfile();
  const device = await proxy.requestDevice({ services: [profile.serviceUuid], adapter: null, deviceAddress: profile.deviceAddress || null });
  const gatt = await device.gatt.connect();
  const svc = await gatt.getPrimaryService(profile.serviceUuid);
  const writeCharacteristic = await svc.getCharacteristic(profile.writeCharUuid);
  const notifyCharacteristic = await svc.getCharacteristic(profile.notifyCharUuid);
  active = { mode: 'proxy', write: writeCharacteristic, notify: notifyCharacteristic, proxy };
  await startNotifications(notifyCharacteristic, handleNotifications);
  setConnected(true);
  setConnectionType('Proxy (via Backend)');
  await getDeviceVersion();
  scheduleStatusMonitoring();
  return device;
}

function scheduleStatusMonitoring() {
  // Poll status every 5 seconds
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

async function getDeviceVersion() {
  try {
    await sendBleCommand('/api/1.0/version');
  } catch (e) {
    logLine(`Failed to get device version: ${String(e)}`);
  }
}

async function requestDeviceStatus() {
  try {
    await sendBleCommand('[GET] /stats');
  } catch (e) {
    logLine(`Failed to get device status: ${String(e)}`);
  }
}

export async function requestSfpRead() {
  await sendBleCommand('[POST] /sif/start');
}

export async function writeSfpFromBuffer(buf: ArrayBuffer) {
  // Device protocol expects a write start command and then data (per legacy code)
  await sendBleCommand('[POST] /sif/write');
  const data = new Uint8Array(buf);
  if (!active) throw new Error('Not connected');
  await writeChunks(active.write, data, 20, 10, false);
}

export async function sendBleCommand(command: string) {
  if (!active) throw new Error('Not connected');
  await writeText(active.write, command);
  logLine(`Sent Command: ${command}`);
}

// Notification handler: replicates legacy heuristic for text vs binary
const textDecoder = new TextDecoder('utf-8');
function handleNotifications(event: { target: { value: DataView } }) {
  const { value } = event.target;
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

  let isLikelyText = true;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (!(b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126))) {
      isLikelyText = false;
      break;
    }
  }

  if (isLikelyText) {
    let text: string | null = null;
    try {
      text = textDecoder.decode(bytes);
    } catch {
      text = null;
    }
    if (text) onText(text);
  } else {
    onBinary(value.buffer);
  }
}

function onText(text: string) {
  logLine(`Received Text: ${text.trim()}`);

  // Version
  if (text.includes('Version:')) {
    const m = text.match(/Version:\s*([0-9.]+)/i);
    if (m) {
      const v = m[1];
      setDeviceVersion(v);
      if (v !== TESTED_FIRMWARE_VERSION) {
        logLine(`Warning: App developed for firmware v${TESTED_FIRMWARE_VERSION}; device is v${v}.`);
      }
    }
  }

  // sysmon status: battery + SFP presence
  if (text.includes('sysmon:')) {
    if (text.includes('sfp:[x]')) setSfpPresent(true);
    else if (text.includes('sfp:[ ]')) setSfpPresent(false);
    const bat = text.match(/bat:\[.\]\|\^?\|(\d+)%/);
    if (bat) setBattery(parseInt(bat[1], 10));
  }

  // Ack messages: surface as logs
  const ack: Record<string, string> = {
    'SIF start': 'Device acknowledged read operation - waiting for EEPROM data...',
    'SIF write start': 'Device acknowledged write operation - ready to receive data',
    'SIF write stop': 'Device confirmed write operation completed',
    'SIF write complete': 'Device confirmed write operation completed',
    'SIF erase start': 'Device started erase operation',
    'SIF erase stop': 'Device completed erase operation',
    'SIF stop': 'Device stopped SIF operation',
  };
  for (const [k, v] of Object.entries(ack)) {
    if (text.includes(k)) {
      logLine(v);
      break;
    }
  }
}

function onBinary(buf: ArrayBuffer) {
  logLine(`Received ${buf.byteLength} bytes of binary SFP data.`);
  setRawEeprom(buf);
}

// Backend helpers
export async function listModules() {
  const base = features.api.baseUrl;
  const res = await fetch(`${base}/v1/modules`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveCurrentModule(metadata?: Record<string, any>) {
  const buf = getBleState().rawEepromData;
  if (!buf) throw new Error('No EEPROM captured in memory');
  const base = features.api.baseUrl;
  // Base64 encode
  const bytes = new Uint8Array(buf);
  const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
  const res = await fetch(`${base}/v1/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eeprom_base64: b64, ...metadata }),
  });
  const out = await res.json();
  if (!res.ok || (out && out.error)) {
    throw new Error(out?.error || `HTTP ${res.status}`);
  }
  return out;
}

// Proxy discovery helpers (optional)
export async function fetchProxyAdapters(): Promise<{ name: string; address?: string; powered?: boolean }[]> {
  const base = features.api.baseUrl;
  const res = await fetch(`${base}/v1/ble/adapters`);
  if (!res.ok) throw new Error('Adapter list unavailable');
  return res.json();
}

export async function inspectDeviceViaProxy(deviceAddress: string) {
  const base = features.api.baseUrl;
  const res = await fetch(`${base}/v1/ble/inspect?${new URLSearchParams({ device_address: deviceAddress }).toString()}`);
  if (!res.ok) throw new Error('Inspection failed');
  return res.json();
}

export function selectProfileFromGatt(gatt: { services?: { uuid: string; characteristics?: { uuid: string; properties?: string[] }[] }[] }) {
  if (!gatt || !gatt.services) throw new Error('Invalid GATT data');
  let best: SfpProfile | null = null;
  for (const svc of gatt.services) {
    const chars = svc.characteristics || [];
    const notifyChar = chars.find((c) => (c.properties || []).includes('notify'));
    const writeNoRsp = chars.find((c) => (c.properties || []).includes('write-without-response'));
    const write = chars.find((c) => (c.properties || []).includes('write'));
    const writeChar = (writeNoRsp || write) as any;
    if (notifyChar && writeChar) {
      best = { serviceUuid: svc.uuid, notifyCharUuid: notifyChar.uuid, writeCharUuid: writeChar.uuid };
      break;
    }
  }
  if (!best) {
    let notifySvc: any = null,
      notifyChar: any = null;
    for (const svc of gatt.services) {
      const c = (svc.characteristics || []).find((x) => (x.properties || []).includes('notify'));
      if (c) {
        notifySvc = svc;
        notifyChar = c;
        break;
      }
    }
    let writeChar: any = null;
    for (const svc of gatt.services) {
      const c = (svc.characteristics || []).find((x) => (x.properties || []).includes('write-without-response') || (x.properties || []).includes('write'));
      if (c) {
        writeChar = c;
        break;
      }
    }
    if (!notifyChar || !writeChar) throw new Error('Could not infer SFP profile from proxy GATT');
    best = { serviceUuid: notifySvc.uuid, notifyCharUuid: notifyChar.uuid, writeCharUuid: writeChar.uuid };
  }
  return best;
}

export async function connectViaProxyAddress(address: string, adapter?: string) {
  const proxy = new BLEProxyClient(buildDefaultProxyWsUrl('/api/v1/ble/ws'));
  await proxy.connect();
  const insp = await inspectDeviceViaProxy(address);
  const profile = selectProfileFromGatt(insp.gatt);
  const full: SfpProfile = { ...profile, deviceAddress: address, deviceName: insp?.device?.name || 'Unknown' };
  saveActiveProfile(full);
  const device = await proxy.requestDevice({ services: [profile.serviceUuid], deviceAddress: address, adapter: adapter || null });
  const gatt = await device.gatt.connect();
  const svc = await gatt.getPrimaryService(profile.serviceUuid);
  const writeCharacteristic = await svc.getCharacteristic(profile.writeCharUuid);
  const notifyCharacteristic = await svc.getCharacteristic(profile.notifyCharUuid);
  active = { mode: 'proxy', write: writeCharacteristic, notify: notifyCharacteristic, proxy };
  await startNotifications(notifyCharacteristic, handleNotifications);
  setConnected(true);
  setConnectionType('Proxy (via Backend)');
  await getDeviceVersion();
  scheduleStatusMonitoring();
}
