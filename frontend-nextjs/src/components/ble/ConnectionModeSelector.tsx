"use client";
import { useEffect, useMemo, useState } from 'react';
import type { ConnectionMode } from '@/src/lib/ble/types';
import { BLEProxyClient } from '@/src/lib/ble/proxyClient';
import { isWebBluetoothAvailable } from '@/src/lib/ble/webbluetooth';

export function ConnectionModeSelector(props: { value: ConnectionMode; onChange: (v: ConnectionMode) => void }) {
  const [proxyAvailable, setProxyAvailable] = useState(false);
  const webBluetooth = useMemo(() => isWebBluetoothAvailable(), []);

  useEffect(() => {
    setProxyAvailable(BLEProxyClient.isAvailable());
  }, []);

  function hint(value: ConnectionMode) {
    if (value === 'web-bluetooth') return webBluetooth ? 'Direct via Web Bluetooth' : 'Not supported in this browser';
    if (value === 'proxy') return 'Proxy via backend WebSocket';
    // auto
    if (webBluetooth) return 'Direct via Web Bluetooth';
    if (proxyAvailable) return 'Proxy via backend (Safari/iOS compatible)';
    return 'No supported BLE method available';
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label htmlFor="connectionMode">Connection Mode:</label>
      <select
        id="connectionMode"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as ConnectionMode)}
        style={{ padding: '4px 8px' }}
      >
        <option value="auto">Auto</option>
        <option value="web-bluetooth">Web Bluetooth</option>
        {proxyAvailable && <option value="proxy">Proxy</option>}
      </select>
      <span style={{ color: 'var(--muted-foreground)' }}>{hint(props.value)}</span>
    </div>
  );
}

