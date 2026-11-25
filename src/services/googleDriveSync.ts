import type { DriveConfig, MovieLibraryDatabase } from '../types/movie';
import { mergeDatabases } from '../utils/merge';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
export const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
export const DEFAULT_DRIVE_FILENAME = 'movielibrary-db.json';

export class DriveAuthExpiredError extends Error {
  constructor(message = 'Google Drive session expired. Please reconnect.') {
    super(message);
    this.name = 'DriveAuthExpiredError';
  }
}

export class DriveApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string; hint?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            hint?: string;
            callback: (resp: GoogleTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function currentOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
}

export function formatGoogleAuthError(codeOrMessage: string): string {
  const lower = codeOrMessage.toLowerCase();
  const origin = currentOrigin();

  if (lower.includes('invalid_scope')) {
    return `Invalid OAuth scope requested. Reload the app so it uses the latest Google Drive scopes, then try again.`;
  }
  if (lower.includes('access_denied')) {
    return `Access denied. In Google Cloud Console → Google Auth Platform → Audience → Test users, make sure your Gmail address is listed, then retry.`;
  }
  if (lower.includes('redirect_uri_mismatch') || lower.includes('origin_mismatch')) {
    return `Origin mismatch. Add ${origin} (exact URL, no trailing slash) under Google Auth Platform → Clients → Authorized JavaScript origins.`;
  }
  if (lower.includes('popup_closed')) {
    return `Sign-in popup was closed before completing authorization. If Google showed an error inside the popup, check that ${origin} is in Authorized JavaScript origins and your email is added under Audience → Test users.`;
  }
  if (lower.includes('popup_failed_to_open')) {
    return `Browser blocked the Google sign-in popup. Allow popups for ${origin} and try again.`;
  }
  return codeOrMessage;
}

async function parseDriveError(res: Response, fallbackPrefix: string): Promise<DriveApiError> {
  try {
    const data = (await res.json()) as {
      error?: {
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
    const reason = data.error?.errors?.[0]?.reason || '';
    const msg = data.error?.message || '';
    if (
      res.status === 403 &&
      (reason === 'accessNotConfigured' || msg.toLowerCase().includes('drive api has not been used'))
    ) {
      return new DriveApiError(
        res.status,
        "Google Drive API is not enabled in your Google Cloud project. Enable 'Google Drive API' in APIs & Services → Library, wait 1 minute, and retry.",
      );
    }
    if (msg) {
      return new DriveApiError(res.status, `${fallbackPrefix} (${res.status}): ${msg}`);
    }
  } catch {
    // fallback below
  }
  return new DriveApiError(res.status, `${fallbackPrefix} (${res.status}).`);
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser environment.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GSI_SCRIPT_URL}"]`,
    );
    if (existing && window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;

    const timer = window.setTimeout(() => {
      scriptPromise = null;
      reject(new Error('Timed out loading Google Sign-In script. Check your internet connection.'));
    }, 12000);

    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.accounts?.oauth2) {
        resolve();
      } else {
        scriptPromise = null;
        reject(new Error('Google Identity script loaded without OAuth2 client.'));
      }
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      scriptPromise = null;
      reject(new Error('Failed to load Google Sign-In script.'));
    };

    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function requestDriveAccessToken(
  clientId: string,
  prompt: '' | 'none' | 'consent' | 'select_account' = '',
  hint?: string | null,
): Promise<{ accessToken: string; expiresIn: number }> {
  const trimmedId = clientId.trim();
  if (!trimmedId) {
    throw new Error('Please enter your Google OAuth Client ID first.');
  }
  if (!trimmedId.endsWith('.apps.googleusercontent.com')) {
    throw new Error(
      'Client ID should end with .apps.googleusercontent.com (make sure you pasted the Client ID, not the Client Secret).',
    );
  }

  await loadGoogleIdentityScript();

  const normalizedHint =
    prompt !== 'select_account' && typeof hint === 'string' && hint.trim()
      ? hint.trim()
      : undefined;

  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google OAuth2 client unavailable.'));
      return;
    }

    const client = oauth2.initTokenClient({
      client_id: trimmedId,
      scope: DRIVE_SCOPES,
      ...(normalizedHint ? { hint: normalizedHint } : {}),
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          const raw = resp.error_description || resp.error || 'Google authorization failed.';
          reject(new Error(formatGoogleAuthError(raw)));
          return;
        }
        resolve({
          accessToken: resp.access_token,
          expiresIn: resp.expires_in ?? 3600,
        });
      },
      error_callback: (err) => {
        const raw = err.type || err.message || 'popup_closed';
        reject(new Error(formatGoogleAuthError(raw)));
      },
    });

    client.requestAccessToken({
      prompt,
      ...(normalizedHint ? { hint: normalizedHint } : {}),
    });
  });
}

async function driveFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    throw new DriveAuthExpiredError();
  }
  return res;
}

export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await driveFetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      accessToken,
    );
    if (res.ok) {
      const data = (await res.json()) as { email?: string };
      if (data.email) return data.email;
    }

    const aboutRes = await driveFetch(
      'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',
      accessToken,
    );
    if (!aboutRes.ok) return null;
    const aboutData = (await aboutRes.json()) as { user?: { emailAddress?: string } };
    return aboutData.user?.emailAddress || null;
  } catch {
    return null;
  }
}

async function downloadFileJson(
  accessToken: string,
  fileId: string,
): Promise<MovieLibraryDatabase | null> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    accessToken,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw await parseDriveError(res, 'Failed to read Drive database');
  }
  const text = await res.text();
  if (!text.trim()) return null;
  const parsed = JSON.parse(text) as MovieLibraryDatabase;
  if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.movies)) {
    return parsed;
  }
  return null;
}

async function searchDriveFileByName(
  accessToken: string,
  name: string,
): Promise<string | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=5`;
  const searchRes = await driveFetch(searchUrl, accessToken);
  if (!searchRes.ok) {
    throw await parseDriveError(searchRes, 'Drive search failed');
  }
  const searchJson = (await searchRes.json()) as { files?: Array<{ id: string }> };
  return searchJson.files?.[0]?.id || null;
}

async function createDatabaseFile(
  accessToken: string,
  fileName: string,
  db: MovieLibraryDatabase,
): Promise<string> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };
  const boundary = 'movielibrary_multipart_' + Date.now();
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(db)}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    accessToken,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    throw await parseDriveError(res, 'Failed to create Drive file');
  }

  const created = (await res.json()) as { id: string };
  return created.id;
}

async function updateDatabaseFile(
  accessToken: string,
  fileId: string,
  db: MovieLibraryDatabase,
): Promise<void> {
  const res = await driveFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
    accessToken,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(db),
    },
  );
  if (!res.ok) {
    throw await parseDriveError(res, 'Failed to update Drive file');
  }
}

export async function findOrCreateDatabaseFile(
  accessToken: string,
  preferredFileId: string | null,
  fileName: string,
  initialDb: MovieLibraryDatabase,
): Promise<{ fileId: string; remoteDb: MovieLibraryDatabase | null; created: boolean }> {
  if (preferredFileId) {
    const metaRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(preferredFileId)}?fields=id,trashed`,
      accessToken,
    );
    if (metaRes.ok) {
      const meta = (await metaRes.json()) as { id?: string; trashed?: boolean };
      if (meta.id && !meta.trashed) {
        const remoteDb = await downloadFileJson(accessToken, meta.id);
        return { fileId: meta.id, remoteDb, created: false };
      }
    } else if (metaRes.status !== 404) {
      throw await parseDriveError(metaRes, 'Could not inspect Drive file');
    }
  }

  const matchId = await searchDriveFileByName(accessToken, fileName);
  if (matchId) {
    const remoteDb = await downloadFileJson(accessToken, matchId);
    return { fileId: matchId, remoteDb, created: false };
  }

  const newId = await createDatabaseFile(accessToken, fileName, initialDb);
  return { fileId: newId, remoteDb: null, created: true };
}

export async function syncWithDrive(
  localDb: MovieLibraryDatabase,
  config: DriveConfig,
  accessToken: string,
): Promise<{ mergedDb: MovieLibraryDatabase; fileId: string; syncedAt: string }> {
  const fileName = config.fileName || DEFAULT_DRIVE_FILENAME;
  const { fileId, remoteDb, created } = await findOrCreateDatabaseFile(
    accessToken,
    config.fileId,
    fileName,
    localDb,
  );

  let mergedDb = localDb;
  if (!created && remoteDb) {
    mergedDb = mergeDatabases(localDb, remoteDb);
    const remoteSerialized = JSON.stringify(remoteDb);
    const mergedSerialized = JSON.stringify(mergedDb);
    if (remoteSerialized !== mergedSerialized) {
      await updateDatabaseFile(accessToken, fileId, mergedDb);
    }
  } else if (!created && !remoteDb) {
    await updateDatabaseFile(accessToken, fileId, localDb);
  }

  return {
    mergedDb,
    fileId,
    syncedAt: new Date().toISOString(),
  };
}
