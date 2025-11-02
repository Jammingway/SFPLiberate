"use client";
import { useEffect, useSyncExternalStore, useState } from 'react';
import { ConnectionModeSelector } from './ConnectionModeSelector';
import type { ConnectionMode } from '@/lib/ble/types';
import { connect, requestSfpRead, saveCurrentModule, listModules, connectViaProxyAddress } from '@/lib/ble/manager';
import { getBleState, subscribe } from '@/lib/ble/store';
import { loadActiveProfile, saveActiveProfile } from '@/lib/ble/profile';

export function ConnectPanel() {
  const [mode, setMode] = useState<ConnectionMode>('auto');
  const state = useSyncExternalStore(subscribe, getBleState, getBleState);
  const [busy, setBusy] = useState(false);
  const [modules, setModules] = useState<any[]>([]);
  const [svc, setSvc] = useState('');
  const [wrt, setWrt] = useState('');
  const [ntf, setNtf] = useState('');
  const [proxyAddr, setProxyAddr] = useState('');

  useEffect(() => {
    // Load module list initially (non-blocking)
    listModules().then(setModules).catch(() => {});
    const p = loadActiveProfile();
    if (p) {
      setSvc(p.serviceUuid);
      setWrt(p.writeCharUuid);
      setNtf(p.notifyCharUuid);
    }
  }, []);

  const onConnect = async () => {
    try {
      setBusy(true);
      await connect(mode);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onRead = async () => {
    try {
      setBusy(true);
      await requestSfpRead();
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    try {
      setBusy(true);
      await saveCurrentModule();
      const list = await listModules();
      setModules(list);
      alert('Saved');
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveProfile = () => {
    try {
      if (!svc || !wrt || !ntf) throw new Error('All UUIDs are required');
      saveActiveProfile({ serviceUuid: svc, writeCharUuid: wrt, notifyCharUuid: ntf });
      alert('Profile saved');
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  };

  const onLoadDefaultProfile = async () => {
    try {
      const res = await fetch('/api/v1/config');
      const cfg = await res.json();
      if (cfg?.default_profile) {
        saveActiveProfile(cfg.default_profile);
        setSvc(cfg.default_profile.serviceUuid);
        setWrt(cfg.default_profile.writeCharUuid);
        setNtf(cfg.default_profile.notifyCharUuid);
        alert('Default profile loaded');
      } else {
        alert('No default profile provided by backend');
      }
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  };

  const onProxyConnectAddress = async () => {
    try {
      setBusy(true);
      if (!proxyAddr) throw new Error('Enter device address');
      await connectViaProxyAddress(proxyAddr);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ConnectionModeSelector value={mode} onChange={setMode} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onConnect} disabled={busy} id="connectButton">
          {state.connected ? 'Reconnect' : 'Connect'}
        </button>
        <button onClick={onRead} disabled={!state.connected || busy} id="readSfpButton">
          Read SFP
        </button>
        <button onClick={onSave} disabled={!state.rawEepromData || busy} id="saveModuleButton">
          Save Module
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div>
            <strong>BLE:</strong> {state.connected ? 'Connected' : 'Disconnected'}
          </div>
          <div>
            <strong>Type:</strong> {state.connectionType}
          </div>
          <div>
            <strong>Firmware:</strong> {state.deviceVersion ?? '—'}
          </div>
          <div>
            <strong>SFP Present:</strong> {state.sfpPresent === undefined ? 'Unknown' : state.sfpPresent ? 'Yes' : 'No'}
          </div>
          <div>
            <strong>Battery:</strong> {state.batteryPct === undefined ? '—' : `${state.batteryPct}%`}
          </div>
          <div>
            <strong>EEPROM:</strong> {state.rawEepromData ? `${state.rawEepromData.byteLength} bytes` : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <strong>Modules</strong>
          <ul>
            {modules?.map((m) => (
              <li key={m.id}>
                #{m.id} {m.vendor} {m.model} {m.serial}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <strong>Profile</strong>
        <div className="mt-2 grid gap-2" style={{ maxWidth: 720 }}>
          <input placeholder="Service UUID" value={svc} onChange={(e) => setSvc(e.target.value)} />
          <input placeholder="Write Char UUID" value={wrt} onChange={(e) => setWrt(e.target.value)} />
          <input placeholder="Notify Char UUID" value={ntf} onChange={(e) => setNtf(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onSaveProfile}>Save Profile</button>
            <button onClick={onLoadDefaultProfile}>Load Default from Backend</button>
          </div>
        </div>
      </div>
      <div>
        <strong>Proxy</strong>
        <div className="mt-2" style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Device Address (optional)" value={proxyAddr} onChange={(e) => setProxyAddr(e.target.value)} />
          <button onClick={onProxyConnectAddress} disabled={busy}>Connect via Proxy (by address)</button>
        </div>
      </div>
      <div>
        <strong>Log</strong>
        <div style={{ border: '1px solid var(--border)', padding: 8, maxHeight: 200, overflow: 'auto' }} id="logConsole">
          {state.logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
