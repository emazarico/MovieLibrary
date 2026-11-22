import type { DriveConfig, MovieLibraryDatabase, ThemeMode } from '../types/movie';
import { generateId } from '../utils/crypto';
import {
  clearDatabaseFromIdb,
  isIndexedDbAvailable,
  saveDatabaseToIdb,
} from './idbStorage';

export const STORAGE_KEYS = {
  DB: 'movielibrary_db',
  DRIVE_CONFIG: 'movielibrary_drive_config',
  THEME: 'movielibrary_theme',
  ACTIVE_PROFILE_PERSISTENT: 'movielibrary_active_profile',
  ACTIVE_PROFILE_SESSION: 'movielibrary_active_profile_session',
  LEGACY_CINEMA_TRACK: 'cinemaHistory',
} as const;

export const DEFAULT_DRIVE_FILE_NAME = 'movielibrary-db.json';
const LOCAL_STORAGE_MIRROR_LIMIT = 4_000_000;

export function createEmptyDatabase(): MovieLibraryDatabase {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    dbId: generateId('moviedb'),
    updatedAt: now,
    householdSettings: {
      streamingRegion: 'US',
      subscribedServices: [],
      updatedAt: now,
    },
    profiles: [],
    shelves: [],
    movies: [],
    watchLogs: [],
  };
}

export function loadLocalDatabase(): MovieLibraryDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DB);
    if (!raw) return createEmptyDatabase();
    const parsed = JSON.parse(raw) as Partial<MovieLibraryDatabase>;
    if (parsed && parsed.schemaVersion === 1) {
      return {
        schemaVersion: 1,
        dbId: parsed.dbId || generateId('moviedb'),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        householdSettings: parsed.householdSettings || {
          streamingRegion: 'US',
          subscribedServices: [],
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        },
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        shelves: Array.isArray(parsed.shelves) ? parsed.shelves : [],
        movies: Array.isArray(parsed.movies) ? parsed.movies : [],
        watchLogs: Array.isArray(parsed.watchLogs) ? parsed.watchLogs : [],
      };
    }
    return createEmptyDatabase();
  } catch {
    return createEmptyDatabase();
  }
}

export function saveLocalDatabase(db: MovieLibraryDatabase): { ok: boolean; error?: string } {
  try {
    localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(db));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage quota exceeded';
    return { ok: false, error: message };
  }
}

export interface SaveFallbackResult {
  ok: boolean;
  engine: 'indexeddb' | 'localstorage';
  localStorageOverflow?: boolean;
  error?: string;
}

export async function saveDatabaseWithFallback(
  db: MovieLibraryDatabase,
): Promise<SaveFallbackResult> {
  if (isIndexedDbAvailable()) {
    const idbRes = await saveDatabaseToIdb(db);
    if (idbRes.ok) {
      const serialized = JSON.stringify(db);
      if (serialized.length < LOCAL_STORAGE_MIRROR_LIMIT) {
        try {
          localStorage.setItem(STORAGE_KEYS.DB, serialized);
          return { ok: true, engine: 'indexeddb' };
        } catch {
          try {
            localStorage.removeItem(STORAGE_KEYS.DB);
          } catch {
            // ignore
          }
          return { ok: true, engine: 'indexeddb', localStorageOverflow: true };
        }
      } else {
        try {
          localStorage.removeItem(STORAGE_KEYS.DB);
        } catch {
          // ignore
        }
        return { ok: true, engine: 'indexeddb', localStorageOverflow: true };
      }
    }
  }

  const localRes = saveLocalDatabase(db);
  return {
    ok: localRes.ok,
    engine: 'localstorage',
    error: localRes.error,
  };
}

export function clearLocalDatabase(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.DB);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_PERSISTENT);
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_SESSION);
  } catch {
    // ignore
  }
  void clearDatabaseFromIdb();
}

export function detectLegacyCinemaTrackData(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEGACY_CINEMA_TRACK);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function loadSavedActiveProfileId(): string | null {
  try {
    const sessionId = sessionStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_SESSION);
    if (sessionId) return sessionId;
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_PERSISTENT);
  } catch {
    return null;
  }
}

export function persistActiveProfileSession(profileId: string | null, hasPin: boolean): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_PERSISTENT);
    sessionStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE_SESSION);
    if (!profileId) return;
    if (hasPin) {
      sessionStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_SESSION, profileId);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_PERSISTENT, profileId);
    }
  } catch {
    // ignore
  }
}

export function loadDriveConfig(): DriveConfig {
  const defaultClientId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || '';
  const fallback: DriveConfig = {
    clientId: defaultClientId,
    fileId: null,
    fileName: DEFAULT_DRIVE_FILE_NAME,
    userEmail: null,
    lastSyncedAt: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DRIVE_CONFIG);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DriveConfig>;
    return {
      clientId: parsed.clientId || defaultClientId,
      fileId: parsed.fileId ?? null,
      fileName: parsed.fileName || DEFAULT_DRIVE_FILE_NAME,
      userEmail: parsed.userEmail ?? null,
      lastSyncedAt: parsed.lastSyncedAt ?? null,
    };
  } catch {
    return fallback;
  }
}

export function saveDriveConfig(config: DriveConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DRIVE_CONFIG, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function loadInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // ignore
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // ignore
  }
}
