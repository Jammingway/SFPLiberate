"use client";
import { useEffect, useState } from 'react';
import { discoverProxyDevices, fetchProxyAdapters, connectViaProxyAddress } from '@/lib/ble/manager';

export function ProxyDiscovery() {
  const [adapters, setAdapters] = useState<{ name: string; address?: string; powered?: boolean }[]>([]);
  const [selectedAdapter, setSelectedAdapter] = useState<string>('');
  const [devices, setDevices] = useState<{ name?: string; address?: string; rssi?: number }[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchProxyAdapters()
      .then((list) => setAdapters(list || []))
      .catch(() => setAdapters([]));
    const saved = localStorage.getItem('proxyAdapter') || '';
    setSelectedAdapter(saved);
  }, []);

  async function scan() {
    setScanning(true);
    try {
      const results = await discoverProxyDevices({ timeout: 5, adapter: selectedAdapter || undefined });
      const filtered = (results || []).filter((d) => (d.name || '').toLowerCase().includes('sfp'));
      setDevices(filtered);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setScanning(false);
    }
  }

  async function connect(addr?: string) {
    if (!addr) return;
    try {
      await connectViaProxyAddress(addr, selectedAdapter || undefined);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center gap-2">
        <label>Adapter:</label>
        <select
          value={selectedAdapter}
          onChange={(e) => {
            setSelectedAdapter(e.target.value);
            localStorage.setItem('proxyAdapter', e.target.value);
          }}
        >
          <option value="">(default)</option>
          {adapters.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name} {a.address ? ` ${a.address}` : ''} {a.powered === false ? '(off)' : ''}
            </option>
          ))}
        </select>
        <button onClick={scan} disabled={scanning} id="proxyScanButton">
          {scanning ? 'Scanning…' : 'Scan via Proxy'}
        </button>
      </div>
      <div>
        <ul id="proxyDiscoveryList" className="grid gap-2">
          {devices.length === 0 && <li>No devices found.</li>}
          {devices.map((d, i) => (
            <li key={i} className="flex items-center justify-between">
              <div className="text-sm">
                <strong>{d.name || 'Unknown'}</strong>{' '}
                <span className="text-neutral-500">{d.address || ''} {typeof d.rssi === 'number' ? `(RSSI ${d.rssi})` : ''}</span>
              </div>
              <button onClick={() => connect(d.address)} className="ml-3">
                Connect via Proxy
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

