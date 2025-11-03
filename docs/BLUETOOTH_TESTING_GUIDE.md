# Bluetooth Discovery - Quick Testing Guide

## What Changed?

The Bluetooth discovery has been completely refactored from a complex, unreliable scanning system to a simple, robust flow:

### Before (Broken)
- 4 confusing buttons
- Used experimental `requestLEScan` API
- Complex fallback logic
- Poor error messages
- Inconsistent behavior

### After (Fixed)
- 2 clear buttons: "Discover and Connect" + "Reconnect"
- Uses standard `requestDevice` with name filters
- Automatic service/characteristic enumeration
- Helpful error messages with recovery tips
- Linear, predictable flow

## Quick Start Testing

### Prerequisites
```bash
# Start the development server
cd frontend
npm run dev

# Or use Docker
docker-compose up --build

# Open in browser
# Chrome/Edge: http://localhost:3000 (or your port)
```

### Test Flow

**1. First Time Connection**
```
1. Go to the app homepage
2. Look for "Direct Browser Connection" section
3. Click "Discover and Connect" button
4. Browser will show device chooser
5. Select your SFP Wizard device (must have "SFP" in name)
6. Wait for automatic configuration (3-5 seconds)
7. Should see "Connected successfully!" message
8. Should see "Profile Configured" banner with device name
```

**2. Reconnection**
```
1. After first connection, you'll see "Reconnect" button
2. Click "Reconnect" (much faster than initial discovery)
3. Browser will show chooser again
4. Select same device
5. Should connect immediately
```

**3. Error Cases to Test**
```
# User Cancellation
- Click "Discover and Connect"
- Close the chooser without selecting
- Should not show error message

# Wrong Device
- Click "Discover and Connect"
- Select a device that doesn't have "SFP" in name
- Should show helpful error about device name

# Bluetooth Off
- Turn off Bluetooth adapter
- Click "Discover and Connect"
- Should show clear error about Bluetooth availability
```

## Browser Testing

### Chrome/Edge (Fully Supported)
✅ Should work perfectly
- All features supported
- Fast device discovery
- Reliable connections

### Safari Desktop (Limited)
⚠️ Experimental support
- May require enabling Web Bluetooth in Develop menu
- Some features may not work
- Should show compatibility warning

### Safari iOS
❌ Not supported
- Web Bluetooth not available
- Should show clear error message
- Recommends using Proxy mode

## What to Look For

### Success Indicators
- ✅ Single button for main action
- ✅ Clear status messages during discovery
- ✅ Profile configuration persists after refresh
- ✅ "Reconnect" appears after first connection
- ✅ Helpful error messages, not generic errors
- ✅ Device name shown in UI

### Red Flags
- ❌ Buttons disabled with no explanation
- ❌ Generic error messages like "Error: undefined"
- ❌ Multiple clicks required
- ❌ No progress indication during discovery
- ❌ Silent failures

## Console Output

### Expected Logs (Good)
```javascript
// During discovery
"Found 3 services, enumerating characteristics..."
"✓ Found compatible service: { serviceUuid: '...', ... }"

// During connection
"Requesting BLE device..."
"Connected successfully!"
"Device version: 1.0.10"
```

### Error Logs to Watch
```javascript
// User cancelled (normal, not an error)
"Device selection was cancelled."

// Configuration issue
"Could not find notify/write characteristics"
"No services found on device"

// Connection issue
"Failed to connect to device"
"Device connection failed"
```

## Troubleshooting

### Issue: Can't find device in chooser
**Check:**
- Device is powered on
- Device Bluetooth is enabled
- Device is not connected to another app
- You're using Chrome/Edge, not Safari iOS

### Issue: "No services found" error
**Check:**
- Device is SFP Wizard (has "SFP" in name)
- Device firmware is up to date
- Try restarting the device
- Try using Proxy mode instead

### Issue: Can't reconnect
**Check:**
- Profile was saved (should see "Profile Configured" banner)
- Device is in range
- Device is not connected elsewhere
- Try clearing localStorage and re-discovering

### Issue: Button disabled
**Check:**
- Web Bluetooth is supported (check browser)
- Page is HTTPS or localhost
- No other connection is active

## File Locations

**Main discovery logic:**
```
frontend/src/lib/ble/discovery.ts
```

**UI component:**
```
frontend/src/components/ble/DirectDiscovery.tsx
```

**Integration point:**
```
frontend/src/lib/ble/manager.ts
- connect() function uses saved profile
```

## Testing Checklist

### Functionality
- [ ] Can discover device on first try
- [ ] Profile is saved after discovery
- [ ] Can reconnect without re-discovering
- [ ] Error messages are helpful
- [ ] Status updates show during operation
- [ ] Works on Chrome/Edge
- [ ] Shows warning on Safari

### UX
- [ ] Only 1-2 buttons visible (not 4)
- [ ] Button labels are clear
- [ ] Progress indication during discovery
- [ ] Success messages are encouraging
- [ ] Error messages suggest solutions
- [ ] Help text is visible and useful

### Edge Cases
- [ ] User cancels chooser (no error shown)
- [ ] Select non-SFP device (helpful error)
- [ ] Bluetooth disabled (clear error)
- [ ] Device out of range (timeout with message)
- [ ] Device already connected (clear error)
- [ ] Page refresh (profile persists)

## Success Criteria

The refactor is successful if:
1. ✅ Discovery works on first try (no retries needed)
2. ✅ Users understand what to click
3. ✅ Error messages help users fix issues
4. ✅ Reconnection is fast (< 5 seconds)
5. ✅ Code is simpler and maintainable

## Next Steps After Testing

1. **If all tests pass:**
   - Commit changes
   - Update CONTRIBUTING.md
   - Update copilot-instructions.md
   - Deploy to staging

2. **If issues found:**
   - Document specific failures
   - Check browser console for errors
   - Review error handling logic
   - Add fixes and retest

## Questions?

Common questions about the refactor:

**Q: Why remove the scanning API?**
A: It's not widely supported and was causing more problems than it solved.

**Q: How does it find the right service now?**
A: It enumerates ALL services after device selection and auto-detects the notify/write pair.

**Q: What if the device has multiple services?**
A: It picks the first one with both notify and write characteristics.

**Q: Does this work with other devices?**
A: Yes, any BLE device with notify/write characteristics can be discovered.

**Q: What about Proxy mode?**
A: Unchanged - this refactor only affects direct browser connection.
