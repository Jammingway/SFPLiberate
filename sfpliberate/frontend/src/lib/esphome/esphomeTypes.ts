/**
 * TypeScript types for ESPHome Bluetooth Proxy integration
 */

export interface ESPHomeProxy {
  name: string;
  address: string;
  port: number;
  macAddress?: string;
  connected: boolean;
  lastSeen: string;
}

export interface DiscoveredDevice {
  macAddress: string;
  name: string;
  rssi: number;
  bestProxy: string;
  lastSeen: string;
}

export interface DeviceConnectionRequest {
  mac_address: string;
}

export interface DeviceConnectionResponse {
  serviceUuid: string;
  notifyCharUuid: string;
  writeCharUuid: string;
  deviceName?: string;
  proxyUsed: string;
}

export interface ESPHomeStatus {
  enabled: boolean;
  proxiesDiscovered: number;
  devicesDiscovered: number;
  mode: string;
}

/**
 * Signal strength indicator based on RSSI
 */
export type SignalStrength = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Get signal strength indicator from RSSI value
 */
export function getSignalStrength(rssi: number): SignalStrength {
  if (rssi >= -50) return 'excellent';
  if (rssi >= -60) return 'good';
  if (rssi >= -70) return 'fair';
  return 'poor';
}

/**
 * Get signal strength color for UI
 */
export function getSignalColor(strength: SignalStrength): string {
  switch (strength) {
    case 'excellent':
      return 'text-green-600';
    case 'good':
      return 'text-blue-600';
    case 'fair':
      return 'text-yellow-600';
    case 'poor':
      return 'text-red-600';
  }
}
