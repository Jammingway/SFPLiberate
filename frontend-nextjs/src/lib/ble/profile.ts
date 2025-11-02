import type { SfpProfile } from './types';

const PROFILE_STORAGE_KEY = 'sfpActiveProfile';

export function loadActiveProfile(): SfpProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SfpProfile) : null;
  } catch {
    return null;
  }
}

export function saveActiveProfile(profile: SfpProfile) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function clearActiveProfile() {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

export function requireProfile(): SfpProfile {
  const p = loadActiveProfile();
  if (!p || !p.serviceUuid || !p.writeCharUuid || !p.notifyCharUuid) {
    throw new Error('SFP profile not configured. Run discovery or manual configure to populate UUIDs.');
  }
  return p;
}

