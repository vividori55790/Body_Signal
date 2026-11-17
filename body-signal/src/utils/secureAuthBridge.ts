import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SecureAuthPlugin {
  isBiometricAvailable(): Promise<{
    available: boolean;
    strongBiometric?: boolean;
    deviceCredential?: boolean;
    status?: number;
  }>;
  isBiometricEnrolled(): Promise<{ enrolled: boolean; enrolledAt?: string; mode?: string }>;
  enrollBiometricPin(options: {
    pin: string;
    title?: string;
    subtitle?: string;
    negativeButtonText?: string;
  }): Promise<{ success: boolean; errorCode?: number }>;
  authenticateBiometricPin(options?: {
    title?: string;
    subtitle?: string;
    negativeButtonText?: string;
  }): Promise<{ success: boolean; pin?: string; invalidated?: boolean; errorCode?: number }>;
  clearBiometricPin(): Promise<{ success: boolean }>;
  getOrCreateDeviceMasterKeyHex(options?: {
    migrateHexKey?: string;
  }): Promise<{ hexKey: string }>;
  clearAllHardwareSecrets(): Promise<{ success: boolean }>;
  checkDeviceIntegrity(): Promise<{
    secure: boolean;
    rooted: boolean;
    hooked: boolean;
    debuggerAttached: boolean;
    reason: string;
  }>;
  clearWebViewMemory(): Promise<{ success: boolean }>;
}

const SecureAuth = registerPlugin<SecureAuthPlugin>('SecureAuth');

export function isNativeAndroidSecureAuth(): boolean {
  try {
    return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export default SecureAuth;
