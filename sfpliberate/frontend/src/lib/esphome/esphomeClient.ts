/**
 * ESPHome Bluetooth Proxy API client
 */

import type {
  ESPHomeStatus,
  ESPHomeProxy,
  DiscoveredDevice,
  DeviceConnectionRequest,
  DeviceConnectionResponse,
} from './esphomeTypes';

export class ESPHomeClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/v1/esphome') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if ESPHome proxy mode is enabled
   */
  async getStatus(): Promise<ESPHomeStatus> {
    const res = await fetch(`${this.baseUrl}/status`);
    if (!res.ok) {
      throw new Error(`Failed to get ESPHome status: ${res.statusText}`);
    }
    const data = await res.json();
    return {
      enabled: data.enabled,
      proxiesDiscovered: data.proxies_discovered,
      devicesDiscovered: data.devices_discovered,
      mode: data.mode,
    };
  }

  /**
   * Quick check if feature is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.enabled;
    } catch (e) {
      console.error('Failed to check ESPHome status:', e);
      return false;
    }
  }

  /**
   * Subscribe to device discovery stream (SSE)
   *
   * @param callback Function called with updated device list
   * @returns Cleanup function to close the stream
   */
  subscribeToDevices(callback: (devices: DiscoveredDevice[]) => void): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/devices`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle error messages
        if (data.error) {
          console.error('ESPHome device stream error:', data.error);
          return;
        }

        // Convert snake_case to camelCase
        const devices: DiscoveredDevice[] = data.map((d: any) => ({
          macAddress: d.mac_address,
          name: d.name,
          rssi: d.rssi,
          bestProxy: d.best_proxy,
          lastSeen: d.last_seen,
        }));

        callback(devices);
      } catch (e) {
        console.error('Failed to parse ESPHome device data:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('ESPHome SSE error:', err);
      // EventSource will auto-reconnect
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Connect to a device via ESPHome proxy and retrieve UUIDs
   *
   * @param macAddress Device MAC address (format: AA:BB:CC:DD:EE:FF)
   * @returns Device connection response with UUIDs
   */
  async connectToDevice(macAddress: string): Promise<DeviceConnectionResponse> {
    const request: DeviceConnectionRequest = {
      mac_address: macAddress,
    };

    const res = await fetch(`${this.baseUrl}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Connection failed: ${error}`);
    }

    const data = await res.json();

    // Convert snake_case to camelCase
    return {
      serviceUuid: data.service_uuid,
      notifyCharUuid: data.notify_char_uuid,
      writeCharUuid: data.write_char_uuid,
      deviceName: data.device_name,
      proxyUsed: data.proxy_used,
    };
  }
}

/**
 * Default singleton instance
 */
let defaultClient: ESPHomeClient | null = null;

export function getESPHomeClient(): ESPHomeClient {
  if (!defaultClient) {
    defaultClient = new ESPHomeClient();
  }
  return defaultClient;
}
