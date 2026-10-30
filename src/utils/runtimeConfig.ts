/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let cachedApiKey = '';
let cachedLiveModel = 'gemini-2.0-flash-exp';
let fetchPromise: Promise<{ apiKey: string; liveModel: string }> | null = null;

export async function fetchRuntimeConfig(): Promise<{ apiKey: string; liveModel: string }> {
  if (cachedApiKey) {
    return { apiKey: cachedApiKey, liveModel: cachedLiveModel };
  }
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.apiKey) {
          cachedApiKey = data.apiKey;
          if (typeof window !== 'undefined') {
            (window as any).__GEMINI_API_KEY__ = data.apiKey;
          }
        }
        if (data.liveModel) {
          cachedLiveModel = data.liveModel;
        }
      }
    } catch (err) {
      console.warn('Failed to load runtime config from /api/config:', err);
    }
    return { apiKey: cachedApiKey, liveModel: cachedLiveModel };
  })();

  return fetchPromise;
}

export function getRuntimeApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  if (typeof window !== 'undefined' && (window as any).__GEMINI_API_KEY__) {
    return (window as any).__GEMINI_API_KEY__;
  }
  return '';
}

export function getRuntimeLiveModel(): string {
  return cachedLiveModel || 'gemini-2.0-flash-exp';
}

export function getApiHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const key = getRuntimeApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  if (key) {
    headers['x-gemini-api-key'] = key;
  }
  return headers;
}
