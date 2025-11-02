import type { GattLikeCharacteristic, GattConnection, ProxyRequestOptions, UUID } from './types';

// Minimal base64 helpers
const b64decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64encode = (data: Uint8Array) => btoa(String.fromCharCode(...Array.from(data)));

export class BLEProxyClient {
  wsUrl: string;
  ws: WebSocket | null = null;
  connected = false;
  device: { name?: string; address?: string; services?: any[] } | null = null;
  private handlers = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private notificationCallbacks = new Map<string, (uuid: string, data: Uint8Array) => void>();

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  static isAvailable() {
    return typeof window !== 'undefined' && 'WebSocket' in window;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };
      this.ws.onerror = (err) => {
        reject(new Error('WebSocket connection failed'));
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.device = null;
      };
      this.ws.onmessage = (evt) => {
        try {
          this.handleMessage(JSON.parse(evt.data as string));
        } catch (e) {
          // ignore
        }
      };
    });
  }

  private handleMessage(message: any) {
    const { type } = message || {};
    switch (type) {
      case 'connected': {
        this.device = {
          name: message.device_name,
          address: message.device_address,
          services: message.services,
        };
        this.resolve('connect', message);
        break;
      }
      case 'disconnected': {
        this.device = null;
        this.resolve('disconnect', message);
        break;
      }
      case 'notification': {
        const cb = this.notificationCallbacks.get(message.characteristic_uuid as string);
        if (cb) {
          const data = b64decode(message.data as string);
          cb(message.characteristic_uuid as string, data);
        }
        break;
      }
      case 'error': {
        this.reject('error', new Error(message.error || 'proxy error'));
        break;
      }
      case 'discovered': {
        this.resolve('discover', message.devices);
        break;
      }
      case 'status': {
        this.resolve('status', message);
        break;
      }
      default:
        break;
    }
  }

  private sendAndWait(key: string, payload: any) {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) return reject(new Error('Not connected to proxy server'));
      this.handlers.set(key, { resolve, reject });
      this.ws!.send(JSON.stringify(payload));
    });
  }

  private resolve(key: string, value: any) {
    const h = this.handlers.get(key);
    if (h) {
      h.resolve(value);
      this.handlers.delete(key);
    }
  }
  private reject(key: string, error: any) {
    const h = this.handlers.get(key);
    if (h) {
      h.reject(error);
      this.handlers.delete(key);
    }
  }

  async discoverDevices(params: { serviceUuid?: UUID | null; timeout?: number; adapter?: string | null }) {
    return this.sendAndWait('discover', { type: 'discover', ...params }).then((r) => r as any[]);
  }

  async requestDevice(options: ProxyRequestOptions) {
    const serviceUuid = options.services?.[0];
    if (!serviceUuid) throw new Error('At least one service UUID required');
    await this.sendAndWait('connect', {
      type: 'connect',
      service_uuid: serviceUuid,
      device_address: options.deviceAddress || null,
      adapter: options.adapter || null,
    });

    const self = this;
    // Return a GATT-like shape expected by higher-level logic
    return {
      name: this.device?.name,
      gatt: {
        connect: async (): Promise<GattConnection> => ({
          getPrimaryService: async (_uuid: UUID) => ({
            getCharacteristic: async (charUuid: UUID): Promise<GattLikeCharacteristic> => ({
              uuid: charUuid,
              writeValue: async (data: ArrayBuffer | Uint8Array) => {
                await self.writeCharacteristic(charUuid, new Uint8Array(data as ArrayBuffer));
              },
              writeValueWithoutResponse: async (data: ArrayBuffer | Uint8Array) => {
                await self.writeCharacteristic(charUuid, new Uint8Array(data as ArrayBuffer), false);
              },
              startNotifications: async () => {
                await self.subscribe(charUuid);
                return {
                  addEventListener: (_ev: 'characteristicvaluechanged', cb: (ev: { target: { value: DataView } }) => void) => {
                    self.notificationCallbacks.set(charUuid, (_uuid, data) => {
                      cb({ target: { value: new DataView(data.buffer) } });
                    });
                  },
                } as any;
              },
              addEventListener: undefined,
            }),
          }),
        }),
      },
    } as const;
  }

  async subscribe(characteristicUuid: UUID) {
    return this.sendAndWait('subscribe', { type: 'subscribe', characteristic_uuid: characteristicUuid });
  }

  async writeCharacteristic(characteristicUuid: UUID, data: Uint8Array, withResponse = true): Promise<void> {
    const b64 = b64encode(data);
    await this.sendAndWait('write', { type: 'write', characteristic_uuid: characteristicUuid, data: b64, with_response: withResponse });
  }
}

export function buildDefaultProxyWsUrl(path = '/api/v1/ble/ws') {
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  return `${proto}//${host}${path}`;
}
