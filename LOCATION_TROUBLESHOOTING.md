# Location Feature Troubleshooting Guide

## Overview
The location feature allows wholesalers/retailers to set their shop location during signup and customers to update their location in the dashboard. This guide helps resolve common issues.

## Common Issues and Solutions

### 1. **Location Permission Denied**

**Symptoms:**
- Error message: "Please enable location permissions in your browser settings"
- Location capture button doesn't work

**Solutions:**

#### Chrome/Edge:
1. Click the lock icon (🔒) or info icon (ⓘ) in the address bar
2. Find "Location" in the permissions list
3. Change to "Allow"
4. Refresh the page

#### Firefox:
1. Click the lock icon in the address bar
2. Click "Connection secure" → "More information"
3. Go to "Permissions" tab
4. Find "Access Your Location" and click "Allow"
5. Refresh the page

#### Safari:
1. Safari menu → Preferences → Websites
2. Select "Location" from the left sidebar
3. Find your site and change to "Allow"
4. Refresh the page

### 2. **Location Request Timed Out**

**Symptoms:**
- Error: "Location request timed out. Please try again"
- Takes too long and then fails

**Causes:**
- Weak GPS signal
- Device location services disabled
- Browser location settings not configured

**Solutions:**
1. **Enable Device Location Services:**
   - **Mac:** System Preferences → Security & Privacy → Privacy → Location Services (enable)
   - **Windows:** Settings → Privacy → Location (enable)
   - **Linux:** Check system location settings

2. **Try again near a window** for better GPS signal
3. **Use Wi-Fi** instead of mobile data (better location accuracy)
4. **Manually enter address** if automatic detection fails, then use "Convert Address to Coordinates"

### 3. **HTTPS Required**

**Symptoms:**
- Geolocation not working on local development
- Permission prompt doesn't appear

**Solution:**
Modern browsers require HTTPS for geolocation API (except for localhost). Make sure:
- Development: Use `http://localhost` (allowed exception)
- Production: Always use HTTPS

### 4. **Location Not Accurate**

**Symptoms:**
- Wrong coordinates captured
- Address is far from actual location

**Solutions:**
1. Enable "High Accuracy" mode (already enabled in the code)
2. Ensure device GPS is enabled
3. Move to an open area for better satellite visibility
4. Manually enter the correct address and use "Convert Address to Coordinates" button

### 5. **No Address Displayed**

**Symptoms:**
- Coordinates captured but no readable address
- Only shows lat/lng numbers

**Causes:**
- Ola Maps API key missing or invalid
- API rate limit exceeded
- Network connectivity issues

**Solutions:**
1. **Check API Key:** Ensure `VITE_OLA_MAPS_API_KEY` is set in `.env`
2. **Check Console:** Open browser DevTools (F12) and check Console for errors
3. **Fallback:** The system will still save coordinates even without reverse geocoding

### 6. **Location Not Saved**

**Symptoms:**
- Location captured but not saved to profile
- Location resets after page refresh

**Solutions:**
1. **Complete the form:** Make sure to click "Sign Up" button after capturing location
2. **Check network:** Ensure stable internet connection
3. **Check Console:** Open DevTools (F12) to see if there are API errors
4. **Try again:** Click the location button again

## Feature Capabilities

### During Signup (Wholesalers/Retailers):
- ✅ Click navigation icon button to capture current location
- ✅ Manually enter shop address
- ✅ Convert address to coordinates using "Convert Address to Coordinates" button
- ✅ Both latitude/longitude and address are saved

### In Customer Dashboard:
- ✅ Update location in Account settings
- ✅ Same capabilities as signup
- ✅ Location persists across sessions

## Technical Details

### Geolocation Options:
```javascript
{
  enableHighAccuracy: true,  // Use GPS if available
  timeout: 10000,            // Wait max 10 seconds
  maximumAge: 0              // Don't use cached position
}
```

### Error Codes:
- `PERMISSION_DENIED (1)`: User denied location access
- `POSITION_UNAVAILABLE (2)`: Location information unavailable
- `TIMEOUT (3)`: Request took too long

## Testing Location Feature

### Test Checklist:
1. ✅ Click location button - should show loading spinner
2. ✅ Grant permission when browser prompts
3. ✅ Should capture coordinates within 10 seconds
4. ✅ Should display readable address (if API key configured)
5. ✅ Coordinates should appear below the form
6. ✅ Complete signup/update - location should be saved
7. ✅ Refresh page - location should persist

### Manual Testing:
```bash
# Check if location is saved in database
# In Supabase Dashboard SQL Editor:
SELECT id, full_name, location_address, location_lat, location_lng 
FROM profiles 
WHERE location_lat IS NOT NULL;
```

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome  | 50+     | ✅ Full |
| Firefox | 55+     | ✅ Full |
| Safari  | 10+     | ✅ Full |
| Edge    | 79+     | ✅ Full |
| Opera   | 37+     | ✅ Full |

## Additional Help

### Enable Browser Developer Tools:
- Windows/Linux: Press `F12` or `Ctrl+Shift+I`
- Mac: Press `Cmd+Option+I`

### Check Console for Errors:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for errors starting with "Geolocation error:"
4. Share the error message for support

### Still Having Issues?
1. Check browser console for specific error messages
2. Verify HTTPS is being used (production)
3. Ensure device location services are enabled
4. Try a different browser
5. Clear browser cache and cookies
6. Contact support with:
   - Browser name and version
   - Operating system
   - Error message from console
   - Screenshots of the issue
