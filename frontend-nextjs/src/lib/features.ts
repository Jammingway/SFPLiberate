/**
 * Feature Flags for Dual Deployment Strategy
 *
 * This module provides a centralized feature flag system to support both:
 * 1. Standalone deployment (Docker, no auth)
 * 2. Appwrite cloud deployment (with authentication)
 */

export type DeploymentMode = 'standalone' | 'appwrite';

/**
 * Get the current deployment mode from environment variables
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;
  if (mode === 'appwrite') return 'appwrite';
  return 'standalone'; // Default to standalone
}

/**
 * Check if running in standalone mode (Docker)
 */
export function isStandalone(): boolean {
  return getDeploymentMode() === 'standalone';
}

/**
 * Check if running in Appwrite cloud mode
 */
export function isAppwrite(): boolean {
  return getDeploymentMode() === 'appwrite';
}

/**
 * Check if authentication is enabled
 * (Only enabled for Appwrite deployment)
 */
export function isAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AUTH === 'true';
}

/**
 * Check if Web Bluetooth is enabled
 */
export function isWebBluetoothEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_WEB_BLUETOOTH !== 'false';
}

/**
 * Check if BLE Proxy mode is enabled
 */
export function isBLEProxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BLE_PROXY !== 'false';
}

/**
 * Check if community features are enabled
 */
export function isCommunityFeaturesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COMMUNITY_FEATURES === 'true';
}

/**
 * Get API base URL based on deployment mode
 */
export function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || '/api';
}

/**
 * Get Appwrite endpoint (cloud only)
 */
export function getAppwriteEndpoint(): string | undefined {
  return process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
}

/**
 * Get Appwrite project ID (cloud only)
 */
export function getAppwriteProjectId(): string | undefined {
  return process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
}

/**
 * Feature flag configuration object
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

  // Validate Appwrite configuration
  if (mode === 'appwrite') {
    if (!getAppwriteEndpoint()) {
      errors.push('NEXT_PUBLIC_APPWRITE_ENDPOINT is required for Appwrite deployment');
    }
    if (!getAppwriteProjectId()) {
      errors.push('NEXT_PUBLIC_APPWRITE_PROJECT_ID is required for Appwrite deployment');
    }
  }

  // Validate API URL
  if (!getApiUrl()) {
    errors.push('NEXT_PUBLIC_API_URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
