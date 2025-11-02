"use client";
import { useEffect, useMemo, useState } from 'react';
import type { ConnectionMode } from '@/lib/ble/types';
import { BLEProxyClient } from '@/lib/ble/proxyClient';
import { isWebBluetoothAvailable } from '@/lib/ble/webbluetooth';
import { Label } from '@/registry/new-york-v4/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/registry/new-york-v4/ui/select';

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
    <div className="flex items-center gap-3">
      <Label htmlFor="connectionMode">Connection Mode</Label>
      <Select value={props.value} onValueChange={(v) => props.onChange(v as ConnectionMode)}>
        <SelectTrigger id="connectionMode" className="w-[200px]">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          <SelectItem value="web-bluetooth">Web Bluetooth</SelectItem>
          {proxyAvailable && <SelectItem value="proxy">Proxy</SelectItem>}
        </SelectContent>
      </Select>
      <span className="text-sm text-neutral-500">{hint(props.value)}</span>
    </div>
  );
}
