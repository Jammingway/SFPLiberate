"use client";
import { useEffect, useSyncExternalStore, useState } from 'react';
import { ConnectionModeSelector } from './ConnectionModeSelector';
import type { ConnectionMode } from '@/lib/ble/types';
import { connect, requestSfpRead, saveCurrentModule, listModules, connectViaProxyAddress, writeSfpFromModuleId } from '@/lib/ble/manager';
import { getBleState, subscribe } from '@/lib/ble/store';
import { ProxyDiscovery } from '@/components/ble/ProxyDiscovery';
import { ConnectionStatus } from '@/components/ble/ConnectionStatus';
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

  const onWriteModule = async (id: number) => {
    const confirmed = window.confirm(
      'WARNING: Writing EEPROM data can permanently damage your SFP module if incorrect data is used.\n\n' +
        'Before proceeding:\n' +
        '✓ Ensure you have backed up the original module data\n' +
        '✓ Verify this is the correct module profile\n' +
        '✓ Use test/non-critical modules first\n\n' +
        'Do you want to continue?'
    );
    if (!confirmed) return;
    try {
      setBusy(true);
      await writeSfpFromModuleId(id);
      alert('Write flow completed. Consider reading back to verify.');
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
          <ConnectionStatus />
          <div className="mt-2 text-sm">
            <strong>EEPROM:</strong> {state.rawEepromData ? `${state.rawEepromData.byteLength} bytes` : '—'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <strong>Modules</strong>
          <ul className="grid gap-1">
            {modules?.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <div>
                  #{m.id} {m.vendor} {m.model} {m.serial}
                </div>
                <div className="ml-3">
                  <button onClick={() => onWriteModule(m.id)} disabled={busy || !state.connected}>
                    Write
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <strong>Proxy Discovery</strong>
        <ProxyDiscovery />
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
