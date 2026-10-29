import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
];

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
CALENDAR_SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
  status?: string;
}

/**
 * Initializes Google Workspace Auth state listener.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Initiates popup sign in with Google Workspace scopes.
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth Provider');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Workspace sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves the currently active cached Google access token.
 */
export const getGoogleAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Signs out and clears cached tokens in memory.
 */
export const signOutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Fetches real upcoming events from the user's primary Google Calendar.
 */
export async function fetchUpcomingCalendarEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('GOOGLE_AUTH_REQUIRED: Please sign in with Google to access Google Calendar.');
  }

  const nowISO = new Date().toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    nowISO
  )}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error('GOOGLE_AUTH_EXPIRED: Access token expired. Please re-authenticate.');
    }
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Google Calendar API error (${response.status})`);
  }

  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || '(Untitled Event)',
    description: item.description,
    start: item.start || {},
    end: item.end || {},
    htmlLink: item.htmlLink,
    status: item.status,
  }));
}

/**
 * Creates a real event on the user's primary Google Calendar with explicit parameters.
 */
export async function createGoogleCalendarEvent(
  summary: string,
  startTimeISO: string,
  endTimeISO: string,
  description?: string
): Promise<CalendarEvent> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('GOOGLE_AUTH_REQUIRED: Please sign in with Google to create calendar events.');
  }

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const eventPayload = {
    summary: summary.trim(),
    description: description?.trim() || 'Created via Maya AI Jarvis Holographic Assistant',
    start: {
      dateTime: startTimeISO,
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endTimeISO,
      timeZone: 'Asia/Kolkata',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      throw new Error('GOOGLE_AUTH_EXPIRED: Access token expired. Please re-authenticate.');
    }
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to create Google Calendar event (${response.status})`);
  }

  return await response.json();
}

/**
 * Deletes an event from Google Calendar with safety.
 */
export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error('GOOGLE_AUTH_REQUIRED: Please sign in with Google to delete calendar events.');
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 204 && response.status !== 410) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to delete Google Calendar event (${response.status})`);
  }

  return true;
}
