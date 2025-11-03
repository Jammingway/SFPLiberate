# Bluetooth Discovery API - Migration Guide

## For Developers Using the Old API

If you have code that used the old discovery functions, here's how to migrate to the new simplified API.

## Old API → New API

### Discovering and Connecting

**OLD (Broken):**
```typescript
import { scanForSfp, connectAndInferProfileFromServices } from '@/lib/ble/discovery';

// Step 1: Scan for advertisements
const adv = await scanForSfp(7000);
if (!adv || !adv.uuids || adv.uuids.length === 0) {
  throw new Error('No SFP devices found');
}

// Step 2: Request device with discovered UUIDs
const device = await navigator.bluetooth.requestDevice({ 
  filters: [{ namePrefix: 'SFP' }], 
  optionalServices: adv.uuids 
});

// Step 3: Connect and infer profile
const ok = await connectAndInferProfileFromServices(device, adv.uuids);
if (!ok) {
  throw new Error('Could not infer profile');
}

// Step 4: Connect via manager
await connect('web-bluetooth');
```

**NEW (Simple):**
```typescript
import { discoverAndConnectSfpDevice } from '@/lib/ble/discovery';
import { connect } from '@/lib/ble/manager';

// One call does everything
const { device, profile } = await discoverAndConnectSfpDevice();

// Profile is automatically saved, just connect
await connect('web-bluetooth');
```

### Error Handling

**OLD:**
```typescript
try {
  const adv = await scanForSfp(7000);
  // ... complex logic
} catch (error) {
  // Generic error handling
  console.error(error);
  alert('Connection failed');
}
```

**NEW:**
```typescript
import type { DiscoveryError } from '@/lib/ble/discovery';

try {
  const { device, profile } = await discoverAndConnectSfpDevice();
} catch (error: any) {
  const err = error as DiscoveryError;
  
  switch (err.code) {
    case 'user-cancelled':
      // User closed chooser - don't show error
      break;
      
    case 'not-supported':
      toast.error('Web Bluetooth not supported');
      break;
      
    case 'no-device-found':
      toast.error(err.message);
      break;
      
    case 'no-services-found':
      toast.error('Device incompatible', {
        description: err.message
      });
      break;
      
    case 'connection-failed':
      toast.error('Connection failed', {
        description: 'Check device is on and in range'
      });
      break;
      
    default:
      toast.error(err.message);
  }
}
```

### Reconnecting

**OLD:**
```typescript
// Had to manually handle profile loading
const profile = loadActiveProfile();
if (!profile) {
  // Rediscover...
}
await connect('web-bluetooth');
```

**NEW:**
```typescript
import { connect } from '@/lib/ble/manager';

// Just connect - manager handles profile loading
await connect('web-bluetooth');
```

## Removed Functions

These functions are no longer available:

### ❌ `scanForSfp()`
**Reason:** Used unreliable `requestLEScan` API  
**Alternative:** Use `discoverAndConnectSfpDevice()` which is more reliable

### ❌ `connectAndInferProfileFromServices()`
**Reason:** Merged into main discovery flow  
**Alternative:** Use `discoverAndConnectSfpDevice()` which handles this automatically

### ❌ `canScan()`
**Status:** Still exported but deprecated  
**Reason:** Scanning API is no longer used  
**Alternative:** Use `isWebBluetoothAvailable()` to check browser support

## New API Reference

### Main Function

```typescript
async function discoverAndConnectSfpDevice(): Promise<DiscoveryResult>
```

**Returns:**
```typescript
interface DiscoveryResult {
  device: any;  // BluetoothDevice
  profile: SfpProfile;  // Saved to localStorage automatically
}
```

**Throws:**
```typescript
interface DiscoveryError {
  code: 'user-cancelled' | 'not-supported' | 'no-device-found' 
      | 'no-services-found' | 'connection-failed' | 'unknown';
  message: string;
  originalError?: any;
}
```

**Flow:**
1. Opens browser device chooser with SFP name filter
2. User selects device
3. Connects and enumerates all services/characteristics
4. Finds notify + write characteristic pair
5. Saves profile to localStorage
6. Disconnects (caller reconnects via manager)
7. Returns device + profile

### Alternative Function (For Known Profiles)

```typescript
async function requestDeviceWithProfile(profile: SfpProfile): Promise<any>
```

Use this when you already have a profile and just need to request the device:

```typescript
const profile = loadActiveProfile();
const device = await requestDeviceWithProfile(profile);
```

## Component Migration

### Old DirectDiscovery Component

**OLD:**
- 4 buttons: "Discover and Connect", "Scan", "Connect Now", "Quick SFP Connect"
- Complex state management
- Unclear user flow

**NEW:**
- 2 buttons: "Discover and Connect", "Reconnect"
- Simple state: `deviceName`, `profileConfigured`, `busy`, `status`
- Clear user flow

### Example Migration

**OLD:**
```typescript
const [selected, setSelected] = useState<{ name?: string } | null>(null);

const onScan = async () => {
  const device = await requestAnyDeviceChooser();
  setSelected({ name: device?.name });
};

const onConnect = async () => {
  if (!selected) return;
  await connect('web-bluetooth');
};
```

**NEW:**
```typescript
const [deviceName, setDeviceName] = useState<string | null>(null);
const [profileConfigured, setProfileConfigured] = useState(false);

const onDiscoverAndConnect = async () => {
  const { device, profile } = await discoverAndConnectSfpDevice();
  setDeviceName(device.name);
  setProfileConfigured(true);
  await connect('web-bluetooth');
};
```

## Profile Storage

Profile storage format is **unchanged**:

```typescript
interface SfpProfile {
  serviceUuid: string;
  writeCharUuid: string;
  notifyCharUuid: string;
  deviceAddress?: string;
  deviceName?: string;
}

// Still stored in localStorage under 'sfpActiveProfile'
```

Functions still available:
- `loadActiveProfile()` - Load saved profile
- `saveActiveProfile(profile)` - Save profile
- `clearActiveProfile()` - Clear profile
- `requireProfile()` - Load or throw error

## Testing Checklist

After migrating your code, test:

- [ ] Device discovery works
- [ ] Profile is saved automatically
- [ ] Can reconnect without re-discovering
- [ ] Error handling shows helpful messages
- [ ] User cancellation doesn't show errors
- [ ] Works on Chrome/Edge
- [ ] Shows warning on Safari/iOS

## Breaking Changes

### None! 🎉

The new API is completely separate from the old one. Old code will continue to work (though it's broken and should be migrated).

## Deprecation Timeline

- **Now:** New API available, old functions still exported
- **Next release:** Old functions marked @deprecated
- **Future release:** Old functions may be removed

## Questions?

### "Do I need to migrate immediately?"

Yes, if you're using `scanForSfp()` or `connectAndInferProfileFromServices()` - these were broken.

### "Will my saved profiles still work?"

Yes! Profile storage format is unchanged.

### "What about Proxy mode?"

No changes to Proxy mode. This refactor only affects direct Web Bluetooth.

### "Can I use the new API in my custom component?"

Absolutely! Just import from `@/lib/ble/discovery`:

```typescript
import { discoverAndConnectSfpDevice } from '@/lib/ble/discovery';
```

### "What if I need more control?"

You can still access the lower-level functions:
- `requestDeviceWithProfile()` - Request device with known UUIDs
- `loadActiveProfile()` - Get saved profile
- Functions in `webbluetooth.ts` - Low-level GATT operations

## Need Help?

1. Check the testing guide: `docs/BLUETOOTH_TESTING_GUIDE.md`
2. Review the refactor summary: `docs/BLUETOOTH_DISCOVERY_REFACTOR.md`
3. See example usage in: `frontend/src/components/ble/DirectDiscovery.tsx`
4. Check copilot instructions: `.github/copilot-instructions.md`
