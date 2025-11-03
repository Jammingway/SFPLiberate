/**
 * Feature Flags and Environment Detection
 *
 * This module provides automatic deployment mode detection:
 * 1. Standalone deployment (Docker, self-hosted) - Default, no Appwrite variables
 * 2. Appwrite cloud deployment (Public instance) - Auto-detected by presence of APPWRITE_SITE_* variables
 *
 * Deployment mode is AUTOMATICALLY DETECTED - no manual configuration needed.
 */

export type DeploymentMode = 'standalone' | 'appwrite';

/**
 * Get Appwrite endpoint (cloud only)
 * Auto-injected by Appwrite Sites at build time
 */
export function getAppwriteEndpoint(): string | undefined {
  return process.env.APPWRITE_SITE_API_ENDPOINT;
}

/**
 * Get Appwrite project ID (cloud only)
 * Auto-injected by Appwrite Sites at build time
 */
export function getAppwriteProjectId(): string | undefined {
  return process.env.APPWRITE_SITE_PROJECT_ID;
}

/**
 * Get the current deployment mode
 * Auto-detected based on presence of Appwrite environment variables
 */
export function getDeploymentMode(): DeploymentMode {
  // If Appwrite variables are present, we're in Appwrite cloud deployment
  if (getAppwriteEndpoint() && getAppwriteProjectId()) {
    return 'appwrite';
  }
  // Otherwise, standalone (Docker) deployment
  return 'standalone';
}

/**
 * Check if running in standalone mode (Docker, self-hosted)
 */
export function isStandalone(): boolean {
  return getDeploymentMode() === 'standalone';
}

/**
 * Check if running in Appwrite cloud mode (public instance)
 */
export function isAppwrite(): boolean {
  return getDeploymentMode() === 'appwrite';
}

/**
 * Check if authentication is enabled
 * Auto-enabled for Appwrite deployment, disabled for standalone
 */
export function isAuthEnabled(): boolean {
  // In Appwrite mode, check the feature flag (default true)
  if (isAppwrite()) {
    return process.env.APPWRITE_SITE_ENABLE_AUTH !== 'false';
  }
  // Standalone mode never has auth
  return false;
}

/**
 * Check if Web Bluetooth is enabled
 */
export function isWebBluetoothEnabled(): boolean {
  const envVar = isAppwrite() 
    ? process.env.APPWRITE_SITE_ENABLE_WEB_BLUETOOTH 
    : process.env.ENABLE_WEB_BLUETOOTH;
  return envVar !== 'false'; // Default true
}

/**
 * Check if BLE Proxy mode is enabled
 */
export function isBLEProxyEnabled(): boolean {
  const envVar = isAppwrite() 
    ? process.env.APPWRITE_SITE_ENABLE_BLE_PROXY 
    : process.env.ENABLE_BLE_PROXY;
  return envVar !== 'false'; // Default true
}

/**
 * Check if community features are enabled
 */
export function isCommunityFeaturesEnabled(): boolean {
  const envVar = isAppwrite() 
    ? process.env.APPWRITE_SITE_ENABLE_COMMUNITY_FEATURES 
    : process.env.ENABLE_COMMUNITY_FEATURES;
  return envVar === 'true'; // Default false
}

/**
 * Get API base URL based on deployment mode
 */
export function getApiUrl(): string {
  if (isAppwrite()) {
    // Appwrite deployment uses backend Function URL
    return process.env.APPWRITE_SITE_API_URL || '';
  }
  // Standalone uses proxied API
  return '/api';
}

/**
 * Feature flag configuration object
 * Values are computed at runtime based on deployment mode
 */
export const features = {
  deployment: {
    mode: getDeploymentMode(),
    isStandalone: isStandalone(),
    isAppwrite: isAppwrite(),
  },
  auth: {
    enabled: isAuthEnabled(),
  },
  ble: {
    webBluetooth: isWebBluetoothEnabled(),
    proxy: isBLEProxyEnabled(),
  },
  community: {
    enabled: isCommunityFeaturesEnabled(),
  },
  api: {
    baseUrl: getApiUrl(),
  },
  appwrite: {
    endpoint: getAppwriteEndpoint(),
    projectId: getAppwriteProjectId(),
  },
} as const;

/**
 * Validate required environment variables for the current deployment mode
 */
export function validateEnvironment(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const mode = getDeploymentMode();

  // Validate Appwrite configuration (only if in Appwrite mode)
  if (mode === 'appwrite') {
    if (!getAppwriteEndpoint()) {
      errors.push('APPWRITE_SITE_API_ENDPOINT is missing (should be auto-injected by Appwrite Sites)');
    }
    if (!getAppwriteProjectId()) {
      errors.push('APPWRITE_SITE_PROJECT_ID is missing (should be auto-injected by Appwrite Sites)');
    }
    if (!getApiUrl()) {
      errors.push('APPWRITE_SITE_API_URL is required for backend Function URL');
    }
  }

  // Standalone mode always valid (uses defaults)

  return {
    valid: errors.length === 0,
    errors,
  };
}
