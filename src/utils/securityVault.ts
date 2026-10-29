/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const STORAGE_VAULT_CONFIG = 'maya_security_vault_v1';

export interface SecurityVaultConfig {
  enabled: boolean;
  pin: string; // 4-digit numeric cyber PIN
  useBiometricsIfAvailable: boolean;
}

const DEFAULT_CONFIG: SecurityVaultConfig = {
  enabled: false,
  pin: '1234',
  useBiometricsIfAvailable: true,
};

let sessionUnlockedUntil = 0;

export function getVaultConfig(): SecurityVaultConfig {
  try {
    const raw = localStorage.getItem(STORAGE_VAULT_CONFIG);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_CONFIG;
}

export function saveVaultConfig(config: Partial<SecurityVaultConfig>): SecurityVaultConfig {
  const current = getVaultConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(STORAGE_VAULT_CONFIG, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }
  return updated;
}

export function isVaultProtected(): boolean {
  return getVaultConfig().enabled;
}

export function isSessionUnlocked(): boolean {
  if (!isVaultProtected()) return true;
  return Date.now() < sessionUnlockedUntil;
}

export function unlockSession(minutes = 10): void {
  sessionUnlockedUntil = Date.now() + minutes * 60 * 1000;
}

export function lockVault(): void {
  sessionUnlockedUntil = 0;
}

export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Triggers native platform authenticator (Android Fingerprint / Face Unlock / Windows Hello / Touch ID)
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto || !window.PublicKeyCredential) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Prompt user verification via WebAuthn
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
      },
    });

    if (credential) {
      unlockSession();
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('Biometric WebAuthn challenge aborted or unsupported:', err?.message);
    return false;
  }
}

export function verifyPin(enteredPin: string): boolean {
  const config = getVaultConfig();
  if (enteredPin === config.pin) {
    unlockSession();
    return true;
  }
  return false;
}

export function updatePin(newPin: string): boolean {
  if (!/^\d{4}$/.test(newPin)) {
    return false;
  }
  saveVaultConfig({ pin: newPin });
  return true;
}
