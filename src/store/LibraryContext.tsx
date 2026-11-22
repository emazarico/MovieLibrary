import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { hasTmdbCredentials, loadApiConfig, saveApiConfig } from '../services/apiConfig';
import {
  DriveAuthExpiredError,
  fetchUserEmail,
  requestDriveAccessToken,
  syncWithDrive,
} from '../services/googleDriveSync';
import {
  isIndexedDbAvailable,
  loadDatabaseFromIdb,
  saveDatabaseToIdb,
} from '../services/idbStorage';
import { applyImport, type ImportPreview } from '../services/importExport';
import {
  clearLocalDatabase,
  detectLegacyCinemaTrackData,
  loadDriveConfig,
  loadInitialTheme,
  loadLocalDatabase,
  loadSavedActiveProfileId,
  persistActiveProfileSession,
  saveDatabaseWithFallback,
  saveDriveConfig,
  saveTheme,
} from '../services/storage';
import { fetchWatchProvidersOnly } from '../services/tmdb';
import type {
  ApiConfig,
  AppTab,
  AvatarTheme,
  DriveConfig,
  ExternalRatings,
  HouseholdSettings,
  MediaType,
  MovieItem,
  MovieLibraryDatabase,
  MovieOwnership,
  ProfileRole,
  Shelf,
  SyncStatus,
  ThemeMode,
  UserProfile,
  WatchLog,
  WatchMedium,
  WatchProvidersSnapshot,
  WatchSessionSpan,
  WatchStatus,
} from '../types/movie';
import { getHouseholdAdmins, isProfileAdmin } from '../utils/admin';
import {
  addCoWatchersToExistingWatch,
  applyWatchEventToDatabase,
  type AddCoWatchersInput,
  type LogWatchEventInput,
} from '../utils/cowatch';
import { generateId, hashPin, verifyPin } from '../utils/crypto';
import { createDemoHousehold } from '../utils/demoData';
import { findMovieDuplicates } from '../utils/duplicates';
import { sanitizePosterUrl } from '../utils/poster';
import { formatRuntimeHuman } from '../utils/progress';

export type { AppTab };

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: 'info' | 'success' | 'error';
  undoAction?: () => void;
}

export interface CreateProfileInput {
  name: string;
  avatarEmoji: string;
  avatarTheme: AvatarTheme;
  role?: ProfileRole;
  pin?: string;
  yearlyMovieGoal: number;
  monthlyWatchHoursGoal: number;
}

export interface UpdateProfileInput {
  name?: string;
  avatarEmoji?: string;
  avatarTheme?: AvatarTheme;
  role?: ProfileRole;
  /** undefined = unchanged, null = remove PIN, string = set new PIN */
  newPin?: string | null;
  yearlyMovieGoal?: number;
  monthlyWatchHoursGoal?: number;
  badgeRewards?: Record<string, string>;
}

export interface MovieInput {
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  director: string;
  cast?: string[];
  shelfIds: string[];
  releaseYear?: number;
  endYear?: number;
  runtimeMinutes: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  currentSeason?: number;
  currentEpisode?: number;
  episodesWatched?: number;
  watchedMinutes?: number;
  certification?: string;
  genres: string[];
  language?: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  franchise?: string;
  franchiseIndex?: number;
  tmdbId?: number;
  imdbId?: string;
  tvmazeId?: number;
  externalRatings?: ExternalRatings;
  watchProviders?: WatchProvidersSnapshot;
  medium?: WatchMedium;
  serviceName?: string;
  ownership?: MovieOwnership;
  ownershipNote?: string;
  dueDate?: string;
  lentTo?: string;
  lentDate?: string;
  status: WatchStatus;
  rating: number;
  dateStarted?: string;
  dateWatched?: string;
  watchHistory?: WatchSessionSpan[];
  watchedWithProfileIds?: string[];
  watchedWithGuests?: string;
  recommendedBy?: string;
  wantToWatchNote?: string;
  review?: string;
  synopsis?: string;
  notes: string;
  tags: string[];
}

interface LibraryContextValue {
  db: MovieLibraryDatabase;
  storageEngine: 'indexeddb' | 'localstorage';
  activeProfiles: UserProfile[];
  adminProfiles: UserProfile[];
  activeProfile: UserProfile | null;
  activeProfileId: string | null;
  isActiveProfileAdmin: boolean;
  pendingPinProfile: UserProfile | null;
  profileShelves: Shelf[];
  profileMovies: MovieItem[];
  profileLogs: WatchLog[];
  householdSettings: HouseholdSettings;
  apiConfig: ApiConfig;
  updateApiConfig: (partial: Partial<ApiConfig>) => void;
  updateHouseholdSettings: (partial: Partial<Omit<HouseholdSettings, 'updatedAt'>>) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  driveConfig: DriveConfig;
  isDriveConnected: boolean;
  hasUnsyncedChanges: boolean;
  legacyCinemaTrackRaw: string | null;
  dismissLegacyCinemaTrackBanner: () => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;

  // Profile, Admin, & PIN auth
  beginSwitchToProfile: (profileId: string) => void;
  verifyPendingPin: (pin: string) => Promise<boolean>;
  cancelPendingPin: () => void;
  logoutProfile: () => void;
  createProfile: (input: CreateProfileInput, autoLogin?: boolean) => Promise<UserProfile>;
  updateProfile: (profileId: string, input: UpdateProfileInput) => Promise<void>;
  deleteProfile: (profileId: string) => void;
  adminResetUserPin: (
    adminProfileId: string,
    adminPin: string | null,
    targetProfileId: string,
    newPin: string | null,
    unlockOnClear?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  setProfileRole: (
    targetProfileId: string,
    role: ProfileRole,
  ) => { ok: boolean; error?: string };

  // Lists / Shelves
  addShelf: (name: string, color?: string, icon?: string) => Shelf | null;
  updateShelf: (
    shelfId: string,
    updates: Partial<Pick<Shelf, 'name' | 'color' | 'icon' | 'visible' | 'sortOrder'>>,
  ) => void;
  deleteShelf: (shelfId: string) => void;

  // Movies & Series
  addMovie: (input: MovieInput, syncCoWatchers?: boolean) => MovieItem | null;
  updateMovie: (movieId: string, updates: Partial<MovieInput>) => void;
  deleteMovie: (movieId: string) => void;
  startRewatch: (movieId: string, startDate?: string) => void;
  addWatchHistorySpan: (movieId: string, span: Omit<WatchSessionSpan, 'id'>) => void;
  deleteWatchHistorySpan: (movieId: string, spanId: string) => void;
  recommendMovieToProfile: (
    movieId: string,
    targetProfileId: string,
    note: string,
  ) => { ok: boolean; error?: string };
  refreshMovieWatchProviders: (movieId: string, regionOverride?: string) => Promise<boolean>;

  // Watch Logs & Co-Watching
  logWatchSession: (input: LogWatchEventInput) => WatchLog | null;
  addCoWatchersToWatch: (input: AddCoWatchersInput) => number;
  updateWatchLog: (
    logId: string,
    updates: Partial<Pick<WatchLog, 'date' | 'minutesWatched' | 'episodesCount' | 'medium' | 'serviceName' | 'note'>>,
  ) => void;
  deleteWatchLog: (logId: string) => void;

  // Data, Demo, & Drive Sync
  applyImportPreview: (preview: ImportPreview, mode: 'merge' | 'replace') => void;
  loadSampleHousehold: () => Promise<void>;
  resetAllLocalData: () => void;
  updateDriveConfig: (partial: Partial<DriveConfig>) => void;
  connectGoogleDrive: (promptMode?: '' | 'consent' | 'select_account') => Promise<boolean>;
  syncNow: () => Promise<void>;
  disconnectGoogleDrive: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function sanitizeOptionalCount(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function sanitizeFranchiseIndex(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value * 100) / 100;
}

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<MovieLibraryDatabase>(() => loadLocalDatabase());
  const [storageEngine, setStorageEngine] = useState<'indexeddb' | 'localstorage'>(() =>
    isIndexedDbAvailable() ? 'indexeddb' : 'localstorage',
  );
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    const initialDb = loadLocalDatabase();
    const savedId = loadSavedActiveProfileId();
    if (!savedId) return null;
    const found = initialDb.profiles.find((p) => p.id === savedId && !p.deletedAt);
    return found ? found.id : null;
  });
  const [pendingPinProfileId, setPendingPinProfileId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => loadInitialTheme());
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => loadApiConfig());
  const [driveConfig, setDriveConfig] = useState<DriveConfig>(() => loadDriveConfig());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'local',
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false);
  const [legacyCinemaTrackRaw, setLegacyCinemaTrackRaw] = useState<string | null>(() =>
    detectLegacyCinemaTrackData(),
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dbRef = useRef(db);
  dbRef.current = db;
  const activeProfileIdRef = useRef(activeProfileId);
  activeProfileIdRef.current = activeProfileId;
  const driveConfigRef = useRef(driveConfig);
  driveConfigRef.current = driveConfig;
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const apiConfigRef = useRef(apiConfig);
  apiConfigRef.current = apiConfig;
  const syncTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = generateId('toast');
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, toast.undoAction ? 6500 : 4000);
    },
    [dismissToast],
  );

  // Hydrate / migrate database from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    if (!isIndexedDbAvailable()) {
      setStorageEngine('localstorage');
      return;
    }
    setStorageEngine('indexeddb');

    void (async () => {
      const idbDb = await loadDatabaseFromIdb();
      if (cancelled) return;

      const current = dbRef.current;
      if (idbDb) {
        const currentEmpty = current.profiles.length === 0 && current.movies.length === 0;
        const idbNewer = Date.parse(idbDb.updatedAt) > Date.parse(current.updatedAt);
        if (currentEmpty || idbNewer) {
          setDb(idbDb);
          const currentActiveId = activeProfileIdRef.current;
          const savedId = loadSavedActiveProfileId();
          const candidateId = currentActiveId || savedId;
          if (candidateId && idbDb.profiles.some((p) => p.id === candidateId && !p.deletedAt)) {
            setActiveProfileId(candidateId);
          } else if (currentActiveId) {
            setActiveProfileId(null);
          }
        }
      } else if (current.profiles.length > 0 || current.movies.length > 0) {
        await saveDatabaseToIdb(current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync HTML .dark class + localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  // Online / Offline listeners
  useEffect(() => {
    const handleOffline = () => setSyncStatus('offline');
    const handleOnline = () => {
      setSyncStatus((prev) => {
        if (prev === 'offline') {
          return accessTokenRef.current ? 'synced' : 'local';
        }
        return prev;
      });
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Register PWA service worker in production
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    }
  }, []);

  const persistSnapshot = useCallback(
    (stamped: MovieLibraryDatabase) => {
      void saveDatabaseWithFallback(stamped).then((res) => {
        setStorageEngine(res.engine);
        if (!res.ok) {
          addToast({
            title: 'Local save failed',
            description: res.error,
            tone: 'error',
          });
        }
      });
    },
    [addToast],
  );

  const runSyncWithToken = useCallback(
    async (token: string, silent = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const result = await syncWithDrive(dbRef.current, driveConfigRef.current, token);
        setDb(result.mergedDb);
        persistSnapshot(result.mergedDb);
        const updatedConfig: DriveConfig = {
          ...driveConfigRef.current,
          fileId: result.fileId,
          lastSyncedAt: result.syncedAt,
        };
        setDriveConfig(updatedConfig);
        saveDriveConfig(updatedConfig);
        setHasUnsyncedChanges(false);
        setSyncStatus('synced');
        if (!silent) {
          addToast({ title: 'Synced with Google Drive', tone: 'success' });
        }
      } catch (err) {
        if (err instanceof DriveAuthExpiredError) {
          setAccessToken(null);
          setSyncStatus('token_expired');
          setSyncError(err.message);
          if (!silent) {
            addToast({
              title: 'Google Drive token expired',
              description: 'Reconnect in Cloud Sync to upload pending changes.',
              tone: 'error',
            });
          }
        } else {
          const msg = err instanceof Error ? err.message : 'Google Drive sync failed';
          setSyncStatus('error');
          setSyncError(msg);
          if (!silent) {
            addToast({ title: 'Drive Sync Error', description: msg, tone: 'error' });
          }
        }
      }
    },
    [addToast, persistSnapshot],
  );

  const scheduleAutoSync = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    if (!accessTokenRef.current) return;
    syncTimerRef.current = window.setTimeout(() => {
      if (accessTokenRef.current) {
        void runSyncWithToken(accessTokenRef.current, true);
      }
    }, 2500);
  }, [runSyncWithToken]);

  const commitDatabase = useCallback(
    (updater: (prev: MovieLibraryDatabase) => MovieLibraryDatabase) => {
      setDb((prev) => {
        const next = updater(prev);
        const stamped: MovieLibraryDatabase = {
          ...next,
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
        };
        dbRef.current = stamped;
        persistSnapshot(stamped);
        return stamped;
      });
      setHasUnsyncedChanges(true);
      scheduleAutoSync();
    },
    [persistSnapshot, scheduleAutoSync],
  );

  const updateApiConfig = useCallback((partial: Partial<ApiConfig>) => {
    setApiConfig((prev) => {
      const next = { ...prev, ...partial };
      saveApiConfig(next);
      return next;
    });
  }, []);

  const householdSettings = useMemo<HouseholdSettings>(
    () =>
      db.householdSettings || {
        streamingRegion: 'US',
        subscribedServices: [],
        updatedAt: db.updatedAt,
      },
    [db.householdSettings, db.updatedAt],
  );

  const updateHouseholdSettings = useCallback(
    (partial: Partial<Omit<HouseholdSettings, 'updatedAt'>>) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => {
        const cur = prev.householdSettings || {
          streamingRegion: 'US',
          subscribedServices: [],
          updatedAt: now,
        };
        return {
          ...prev,
          householdSettings: {
            streamingRegion: partial.streamingRegion ?? cur.streamingRegion,
            subscribedServices: partial.subscribedServices ?? cur.subscribedServices,
            updatedAt: now,
          },
        };
      });
    },
    [commitDatabase],
  );

  const activeProfiles = useMemo(
    () => db.profiles.filter((p) => !p.deletedAt),
    [db.profiles],
  );

  const adminProfiles = useMemo(
    () => getHouseholdAdmins(activeProfiles),
    [activeProfiles],
  );

  const activeProfile = useMemo(
    () => activeProfiles.find((p) => p.id === activeProfileId) || null,
    [activeProfiles, activeProfileId],
  );

  const isActiveProfileAdmin = useMemo(
    () => (activeProfile ? isProfileAdmin(activeProfile, activeProfiles) : false),
    [activeProfile, activeProfiles],
  );

  const pendingPinProfile = useMemo(
    () => activeProfiles.find((p) => p.id === pendingPinProfileId) || null,
    [activeProfiles, pendingPinProfileId],
  );

  useEffect(() => {
    if (activeProfileId && !activeProfile) {
      setActiveProfileId(null);
      persistActiveProfileSession(null, false);
    }
  }, [activeProfileId, activeProfile]);

  const profileShelves = useMemo(() => {
    if (!activeProfileId) return [];
    return db.shelves
      .filter((s) => s.profileId === activeProfileId && !s.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [db.shelves, activeProfileId]);

  const profileMovies = useMemo(() => {
    if (!activeProfileId) return [];
    return db.movies.filter((m) => m.profileId === activeProfileId && !m.deletedAt);
  }, [db.movies, activeProfileId]);

  const profileLogs = useMemo(() => {
    if (!activeProfileId) return [];
    return db.watchLogs
      .filter((l) => l.profileId === activeProfileId && !l.deletedAt)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [db.watchLogs, activeProfileId]);

  // --- Profile Auth & Switching ---
  const logoutProfile = useCallback(() => {
    setActiveProfileId(null);
    setPendingPinProfileId(null);
    persistActiveProfileSession(null, false);
  }, []);

  const beginSwitchToProfile = useCallback((targetProfileId: string) => {
    setActiveProfileId(null);
    persistActiveProfileSession(null, false);

    const target = dbRef.current.profiles.find(
      (p) => p.id === targetProfileId && !p.deletedAt,
    );
    if (!target) {
      setPendingPinProfileId(null);
      return;
    }

    if (target.pinHash) {
      setPendingPinProfileId(target.id);
    } else {
      setPendingPinProfileId(null);
      setActiveProfileId(target.id);
      persistActiveProfileSession(target.id, false);
    }
  }, []);

  const verifyPendingPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!pendingPinProfileId) return false;
      const target = dbRef.current.profiles.find(
        (p) => p.id === pendingPinProfileId && !p.deletedAt,
      );
      if (!target) return false;
      if (!target.pinHash) {
        setPendingPinProfileId(null);
        setActiveProfileId(target.id);
        persistActiveProfileSession(target.id, false);
        return true;
      }
      const ok = await verifyPin(target.id, pin, target.pinHash);
      if (ok) {
        setPendingPinProfileId(null);
        setActiveProfileId(target.id);
        persistActiveProfileSession(target.id, true);
        return true;
      }
      return false;
    },
    [pendingPinProfileId],
  );

  const cancelPendingPin = useCallback(() => {
    setPendingPinProfileId(null);
  }, []);

  const createProfile = useCallback(
    async (input: CreateProfileInput, autoLogin = true): Promise<UserProfile> => {
      const now = new Date().toISOString();
      const id = generateId('profile');
      const trimmedPin = input.pin?.trim();
      const pinHash = trimmedPin ? await hashPin(id, trimmedPin) : null;
      const existingActive = dbRef.current.profiles.filter((p) => !p.deletedAt);
      const role: ProfileRole =
        existingActive.length === 0 ? 'admin' : input.role ?? 'member';

      const profile: UserProfile = {
        id,
        name: input.name.trim() || 'Viewer',
        avatarEmoji: input.avatarEmoji || '🎬',
        avatarTheme: input.avatarTheme || 'rose',
        role,
        pinHash,
        yearlyMovieGoal: Math.max(1, Number(input.yearlyMovieGoal) || 40),
        monthlyWatchHoursGoal: Math.max(1, Number(input.monthlyWatchHoursGoal) || 15),
        createdAt: now,
        updatedAt: now,
      };

      const defaultShelf: Shelf = {
        id: generateId('shelf'),
        profileId: id,
        name: 'Watchlist & Seen',
        color: input.avatarTheme === 'indigo' ? 'indigo' : 'rose',
        icon: 'film',
        visible: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };

      commitDatabase((prev) => ({
        ...prev,
        profiles: [...prev.profiles, profile],
        shelves: [...prev.shelves, defaultShelf],
      }));

      if (autoLogin) {
        setPendingPinProfileId(null);
        setActiveProfileId(id);
        persistActiveProfileSession(id, Boolean(pinHash));
      }

      addToast({ title: `Welcome, ${profile.name}!`, tone: 'success' });
      return profile;
    },
    [addToast, commitDatabase],
  );

  const updateProfile = useCallback(
    async (profileId: string, input: UpdateProfileInput): Promise<void> => {
      const now = new Date().toISOString();
      const currentActive = dbRef.current.profiles.filter((p) => !p.deletedAt);
      const currentAdmins = getHouseholdAdmins(currentActive);

      if (
        input.role === 'member' &&
        currentAdmins.length <= 1 &&
        currentAdmins.some((a) => a.id === profileId)
      ) {
        addToast({
          title: 'Cannot remove last Admin',
          description: 'At least one Parent / Admin profile is required.',
          tone: 'error',
        });
        return;
      }

      let updatedPinHash: string | null | undefined = undefined;
      if (input.newPin === null) {
        updatedPinHash = null;
      } else if (typeof input.newPin === 'string' && input.newPin.trim().length > 0) {
        updatedPinHash = await hashPin(profileId, input.newPin.trim());
      }

      commitDatabase((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => {
          if (p.id !== profileId) return p;
          return {
            ...p,
            name: input.name !== undefined ? input.name.trim() || p.name : p.name,
            avatarEmoji: input.avatarEmoji ?? p.avatarEmoji,
            avatarTheme: input.avatarTheme ?? p.avatarTheme,
            role: input.role ?? p.role,
            pinHash: updatedPinHash !== undefined ? updatedPinHash : p.pinHash,
            yearlyMovieGoal: input.yearlyMovieGoal ?? p.yearlyMovieGoal,
            monthlyWatchHoursGoal: input.monthlyWatchHoursGoal ?? p.monthlyWatchHoursGoal,
            badgeRewards:
              input.badgeRewards !== undefined ? input.badgeRewards : p.badgeRewards,
            updatedAt: now,
          };
        }),
      }));

      if (activeProfileId === profileId && updatedPinHash !== undefined) {
        persistActiveProfileSession(profileId, Boolean(updatedPinHash));
      }

      addToast({ title: 'Profile updated', tone: 'success' });
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const deleteProfile = useCallback(
    (profileId: string) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === profileId ? { ...p, deletedAt: now, updatedAt: now } : p,
        ),
        shelves: prev.shelves.map((s) =>
          s.profileId === profileId ? { ...s, deletedAt: now, updatedAt: now } : s,
        ),
        movies: prev.movies.map((m) =>
          m.profileId === profileId ? { ...m, deletedAt: now, updatedAt: now } : m,
        ),
        watchLogs: prev.watchLogs.map((l) =>
          l.profileId === profileId ? { ...l, deletedAt: now, updatedAt: now } : l,
        ),
      }));
      if (activeProfileId === profileId) {
        logoutProfile();
      }
      addToast({ title: 'Profile removed', tone: 'info' });
    },
    [activeProfileId, addToast, commitDatabase, logoutProfile],
  );

  const adminResetUserPin = useCallback(
    async (
      adminProfileId: string,
      adminPin: string | null,
      targetProfileId: string,
      newPin: string | null,
      unlockOnClear = false,
    ): Promise<{ ok: boolean; error?: string }> => {
      const currentActive = dbRef.current.profiles.filter((p) => !p.deletedAt);
      const admin = currentActive.find((p) => p.id === adminProfileId);
      if (!admin || !isProfileAdmin(admin, currentActive)) {
        return { ok: false, error: 'Selected profile does not have Parent / Admin privileges.' };
      }

      if (admin.pinHash) {
        const valid = await verifyPin(admin.id, adminPin || '', admin.pinHash);
        if (!valid) {
          return { ok: false, error: 'Admin PIN is incorrect.' };
        }
      }

      const target = currentActive.find((p) => p.id === targetProfileId);
      if (!target) {
        return { ok: false, error: 'Target profile not found.' };
      }

      const trimmedNewPin = newPin === null ? null : newPin.trim();
      if (trimmedNewPin !== null && !/^\d{4,6}$/.test(trimmedNewPin)) {
        return { ok: false, error: 'New PIN must be 4 to 6 digits.' };
      }

      const nextHash =
        trimmedNewPin === null ? null : await hashPin(target.id, trimmedNewPin);
      const now = new Date().toISOString();

      commitDatabase((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === target.id ? { ...p, pinHash: nextHash, updatedAt: now } : p,
        ),
      }));

      if (trimmedNewPin === null && unlockOnClear) {
        setPendingPinProfileId(null);
        setActiveProfileId(target.id);
        persistActiveProfileSession(target.id, false);
      } else if (activeProfileId === target.id) {
        persistActiveProfileSession(target.id, Boolean(nextHash));
      }

      addToast({
        title:
          trimmedNewPin === null
            ? `Removed PIN for ${target.name}`
            : `Updated PIN for ${target.name}`,
        tone: 'success',
      });

      return { ok: true };
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const setProfileRole = useCallback(
    (targetProfileId: string, role: ProfileRole): { ok: boolean; error?: string } => {
      const currentActive = dbRef.current.profiles.filter((p) => !p.deletedAt);
      const currentAdmins = getHouseholdAdmins(currentActive);

      if (
        role === 'member' &&
        currentAdmins.length <= 1 &&
        currentAdmins.some((a) => a.id === targetProfileId)
      ) {
        const error = 'At least one Parent / Admin profile is required.';
        addToast({ title: 'Cannot demote last Admin', description: error, tone: 'error' });
        return { ok: false, error };
      }

      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) =>
          p.id === targetProfileId ? { ...p, role, updatedAt: now } : p,
        ),
      }));

      addToast({
        title: role === 'admin' ? 'Promoted to Parent / Admin' : 'Changed role to Viewer',
        tone: 'success',
      });
      return { ok: true };
    },
    [addToast, commitDatabase],
  );

  // --- Lists / Shelves ---
  const addShelf = useCallback(
    (name: string, color = 'rose', icon = 'film'): Shelf | null => {
      if (!activeProfileId || !name.trim()) return null;
      const now = new Date().toISOString();
      const maxOrder = dbRef.current.shelves
        .filter((s) => s.profileId === activeProfileId && !s.deletedAt)
        .reduce((max, s) => Math.max(max, s.sortOrder), -1);

      const shelf: Shelf = {
        id: generateId('shelf'),
        profileId: activeProfileId,
        name: name.trim(),
        color,
        icon,
        visible: true,
        sortOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };
      commitDatabase((prev) => ({ ...prev, shelves: [...prev.shelves, shelf] }));
      addToast({ title: `Created list "${shelf.name}"`, tone: 'success' });
      return shelf;
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const updateShelf = useCallback(
    (
      shelfId: string,
      updates: Partial<Pick<Shelf, 'name' | 'color' | 'icon' | 'visible' | 'sortOrder'>>,
    ) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        shelves: prev.shelves.map((s) =>
          s.id === shelfId ? { ...s, ...updates, updatedAt: now } : s,
        ),
      }));
    },
    [commitDatabase],
  );

  const deleteShelf = useCallback(
    (shelfId: string) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        shelves: prev.shelves.map((s) =>
          s.id === shelfId ? { ...s, deletedAt: now, updatedAt: now } : s,
        ),
        movies: prev.movies.map((m) =>
          m.shelfIds.includes(shelfId)
            ? { ...m, shelfIds: m.shelfIds.filter((id) => id !== shelfId), updatedAt: now }
            : m,
        ),
      }));
      addToast({ title: 'List deleted', tone: 'info' });
    },
    [addToast, commitDatabase],
  );

  // --- Movies & Series ---
  const addMovie = useCallback(
    (input: MovieInput, syncCoWatchers = true): MovieItem | null => {
      if (!activeProfileId) return null;
      const now = new Date().toISOString();
      const movieId = generateId('movie');
      const cleanCoWatchers =
        input.watchedWithProfileIds?.filter((id) => id !== activeProfileId) || [];

      const movie: MovieItem = {
        id: movieId,
        profileId: activeProfileId,
        shelfIds: input.shelfIds,
        mediaType: input.mediaType || 'movie',
        title: input.title.trim() || 'Untitled Title',
        originalTitle: input.originalTitle?.trim() || undefined,
        director:
          input.director.trim() ||
          (input.mediaType === 'series' ? 'TV Series' : 'Unknown Director'),
        cast: input.cast?.map((c) => c.trim()).filter(Boolean),
        releaseYear: sanitizeOptionalCount(input.releaseYear),
        endYear: sanitizeOptionalCount(input.endYear),
        runtimeMinutes: Math.max(0, Math.round(input.runtimeMinutes || 0)),
        totalSeasons: sanitizeOptionalCount(input.totalSeasons),
        totalEpisodes: sanitizeOptionalCount(input.totalEpisodes),
        currentSeason: sanitizeOptionalCount(input.currentSeason),
        currentEpisode: sanitizeOptionalCount(input.currentEpisode),
        episodesWatched: sanitizeOptionalCount(input.episodesWatched),
        watchedMinutes: sanitizeOptionalCount(input.watchedMinutes),
        certification: input.certification?.trim() || undefined,
        genres: input.genres.map((g) => g.trim()).filter(Boolean),
        language: input.language?.trim() || 'English',
        posterUrl: sanitizePosterUrl(input.posterUrl),
        backdropUrl: sanitizePosterUrl(input.backdropUrl),
        trailerUrl: input.trailerUrl?.trim() || undefined,
        franchise: input.franchise?.trim() || undefined,
        franchiseIndex: sanitizeFranchiseIndex(input.franchiseIndex),
        tmdbId: input.tmdbId,
        imdbId: input.imdbId?.trim() || undefined,
        tvmazeId: input.tvmazeId,
        externalRatings: input.externalRatings,
        watchProviders: input.watchProviders,
        medium: input.medium,
        serviceName: input.serviceName?.trim() || undefined,
        ownership: input.ownership,
        ownershipNote: input.ownershipNote?.trim() || undefined,
        dueDate: input.dueDate || undefined,
        lentTo: input.lentTo?.trim() || undefined,
        lentDate: input.lentDate || undefined,
        status: input.status,
        rating: Math.min(5, Math.max(0, Math.round((input.rating || 0) * 2) / 2)),
        dateStarted: input.dateStarted || undefined,
        dateWatched: input.dateWatched || undefined,
        watchHistory: input.watchHistory,
        watchedWithProfileIds: cleanCoWatchers.length > 0 ? cleanCoWatchers : undefined,
        watchedWithGuests: input.watchedWithGuests?.trim() || undefined,
        recommendedBy: input.recommendedBy?.trim() || undefined,
        wantToWatchNote: input.wantToWatchNote?.trim() || undefined,
        review: input.review?.trim() || undefined,
        synopsis: input.synopsis?.trim() || undefined,
        notes: input.notes || '',
        tags: input.tags.map((t) => t.trim()).filter(Boolean),
        addedAt: now,
        updatedAt: now,
      };

      let syncedCoCount = 0;
      commitDatabase((prev) => {
        const withMovie: MovieLibraryDatabase = {
          ...prev,
          movies: [movie, ...prev.movies],
        };
        if (
          syncCoWatchers &&
          cleanCoWatchers.length > 0 &&
          (movie.status === 'watched' || movie.status === 'watching')
        ) {
          const res = addCoWatchersToExistingWatch(withMovie, activeProfileId, {
            movieId: movie.id,
            date: movie.dateWatched || movie.dateStarted || now.split('T')[0],
            coWatcherProfileIds: cleanCoWatchers,
            guestNames: movie.watchedWithGuests,
          });
          syncedCoCount = res.addedCount;
          return res.db;
        }
        return withMovie;
      });

      addToast({
        title: `Added "${movie.title}"`,
        description:
          syncedCoCount > 0
            ? `Synced watch with ${syncedCoCount} family ${syncedCoCount === 1 ? 'member' : 'members'}`
            : undefined,
        tone: 'success',
      });
      return movie;
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const updateMovie = useCallback(
    (movieId: string, updates: Partial<MovieInput>) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        movies: prev.movies.map((m) => {
          if (m.id !== movieId) return m;
          return {
            ...m,
            ...updates,
            title: updates.title !== undefined ? updates.title.trim() || m.title : m.title,
            director:
              updates.director !== undefined ? updates.director.trim() || m.director : m.director,
            language:
              updates.language !== undefined
                ? updates.language.trim() || 'English'
                : m.language,
            posterUrl:
              updates.posterUrl !== undefined ? sanitizePosterUrl(updates.posterUrl) : m.posterUrl,
            backdropUrl:
              updates.backdropUrl !== undefined
                ? sanitizePosterUrl(updates.backdropUrl)
                : m.backdropUrl,
            ownership: 'ownership' in updates ? updates.ownership : m.ownership,
            ownershipNote:
              'ownershipNote' in updates
                ? updates.ownershipNote?.trim() || undefined
                : m.ownershipNote,
            dueDate: 'dueDate' in updates ? updates.dueDate || undefined : m.dueDate,
            lentTo: 'lentTo' in updates ? updates.lentTo?.trim() || undefined : m.lentTo,
            lentDate: 'lentDate' in updates ? updates.lentDate || undefined : m.lentDate,
            watchHistory: 'watchHistory' in updates ? updates.watchHistory : m.watchHistory,
            recommendedBy:
              'recommendedBy' in updates
                ? updates.recommendedBy?.trim() || undefined
                : m.recommendedBy,
            wantToWatchNote:
              'wantToWatchNote' in updates
                ? updates.wantToWatchNote?.trim() || undefined
                : m.wantToWatchNote,
            review: 'review' in updates ? updates.review?.trim() || undefined : m.review,
            synopsis: 'synopsis' in updates ? updates.synopsis?.trim() || undefined : m.synopsis,
            franchise:
              'franchise' in updates ? updates.franchise?.trim() || undefined : m.franchise,
            franchiseIndex:
              'franchiseIndex' in updates
                ? sanitizeFranchiseIndex(updates.franchiseIndex)
                : m.franchiseIndex,
            rating:
              updates.rating !== undefined
                ? Math.min(5, Math.max(0, Math.round(updates.rating * 2) / 2))
                : m.rating,
            tags:
              updates.tags !== undefined
                ? updates.tags.map((t) => t.trim()).filter(Boolean)
                : m.tags,
            updatedAt: now,
          };
        }),
      }));
    },
    [commitDatabase],
  );

  const startRewatch = useCallback(
    (movieId: string, startDate?: string) => {
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const target = dbRef.current.movies.find((m) => m.id === movieId && !m.deletedAt);
      if (!target) return;

      const history = Array.isArray(target.watchHistory) ? [...target.watchHistory] : [];
      const alreadyRecorded = history.some(
        (span) => span.watchedAt === target.dateWatched && span.startedAt === target.dateStarted,
      );

      if (
        !alreadyRecorded &&
        (target.status === 'watched' || target.dateWatched || target.dateStarted)
      ) {
        history.push({
          id: generateId('watch'),
          startedAt: target.dateStarted,
          watchedAt:
            target.dateWatched || (target.status === 'watched' ? today : undefined),
          rating: target.rating > 0 ? target.rating : undefined,
          notes: target.review?.trim() || undefined,
          medium: target.medium,
          serviceName: target.serviceName,
          watchedWithProfileIds: target.watchedWithProfileIds,
          watchedWithGuests: target.watchedWithGuests,
        });
      }

      const nextWatchNumber = history.length + 1;
      commitDatabase((prev) => ({
        ...prev,
        movies: prev.movies.map((m) =>
          m.id === movieId
            ? {
                ...m,
                status: 'watching',
                dateStarted: startDate || today,
                dateWatched: undefined,
                watchedMinutes: 0,
                episodesWatched: m.mediaType === 'series' ? 0 : undefined,
                currentSeason: m.mediaType === 'series' ? 1 : undefined,
                currentEpisode: m.mediaType === 'series' ? 0 : undefined,
                watchHistory: history,
                updatedAt: now,
              }
            : m,
        ),
      }));

      addToast({
        title: `Started rewatch #${nextWatchNumber} of "${target.title}"`,
        tone: 'success',
      });
    },
    [addToast, commitDatabase],
  );

  const addWatchHistorySpan = useCallback(
    (movieId: string, span: Omit<WatchSessionSpan, 'id'>) => {
      const now = new Date().toISOString();
      const entry: WatchSessionSpan = {
        ...span,
        id: generateId('watch'),
        notes: span.notes?.trim() || undefined,
      };
      commitDatabase((prev) => ({
        ...prev,
        movies: prev.movies.map((m) =>
          m.id === movieId
            ? {
                ...m,
                watchHistory: [...(m.watchHistory || []), entry],
                updatedAt: now,
              }
            : m,
        ),
      }));
      addToast({ title: 'Added past watch entry', tone: 'success' });
    },
    [addToast, commitDatabase],
  );

  const deleteWatchHistorySpan = useCallback(
    (movieId: string, spanId: string) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        movies: prev.movies.map((m) => {
          if (m.id !== movieId) return m;
          const remaining = (m.watchHistory || []).filter((s) => s.id !== spanId);
          return {
            ...m,
            watchHistory: remaining.length > 0 ? remaining : undefined,
            updatedAt: now,
          };
        }),
      }));
      addToast({ title: 'Removed past watch entry', tone: 'info' });
    },
    [addToast, commitDatabase],
  );

  const deleteMovie = useCallback(
    (movieId: string) => {
      const now = new Date().toISOString();
      const target = dbRef.current.movies.find((m) => m.id === movieId);
      commitDatabase((prev) => ({
        ...prev,
        movies: prev.movies.map((m) =>
          m.id === movieId ? { ...m, deletedAt: now, updatedAt: now } : m,
        ),
      }));
      addToast({
        title: `Removed "${target?.title || 'Title'}"`,
        tone: 'info',
        undoAction: () => {
          const restoreNow = new Date().toISOString();
          commitDatabase((prev) => ({
            ...prev,
            movies: prev.movies.map((m) =>
              m.id === movieId ? { ...m, deletedAt: null, updatedAt: restoreNow } : m,
            ),
          }));
        },
      });
    },
    [addToast, commitDatabase],
  );

  const recommendMovieToProfile = useCallback(
    (movieId: string, targetProfileId: string, note: string): { ok: boolean; error?: string } => {
      const currentDb = dbRef.current;
      const source = currentDb.movies.find((m) => m.id === movieId && !m.deletedAt);
      const targetProfile = currentDb.profiles.find(
        (p) => p.id === targetProfileId && !p.deletedAt,
      );
      const sender = currentDb.profiles.find((p) => p.id === activeProfileId && !p.deletedAt);

      if (!source || !targetProfile) {
        return { ok: false, error: 'Movie or recipient profile not found.' };
      }

      const dupCheck = findMovieDuplicates(
        {
          title: source.title,
          director: source.director,
          releaseYear: source.releaseYear,
          mediaType: source.mediaType,
          tmdbId: source.tmdbId,
          imdbId: source.imdbId,
        },
        currentDb.movies,
        currentDb.profiles,
        targetProfileId,
      );

      if (dupCheck.ownMatches.length > 0) {
        const msg = `${targetProfile.name} already has "${source.title}" in their library.`;
        addToast({ title: msg, tone: 'info' });
        return { ok: false, error: msg };
      }

      const targetShelves = currentDb.shelves
        .filter((s) => s.profileId === targetProfileId && !s.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const now = new Date().toISOString();
      const cleanTags = Array.from(
        new Set([
          ...source.tags.filter((t) => t.toLowerCase() !== 'watchlist'),
          'watchlist',
        ]),
      );

      const recommendedMovie: MovieItem = {
        id: generateId('movie'),
        profileId: targetProfileId,
        shelfIds: targetShelves[0] ? [targetShelves[0].id] : [],
        mediaType: source.mediaType,
        title: source.title,
        originalTitle: source.originalTitle,
        director: source.director,
        cast: source.cast,
        releaseYear: source.releaseYear,
        endYear: source.endYear,
        runtimeMinutes: source.runtimeMinutes,
        totalSeasons: source.totalSeasons,
        totalEpisodes: source.totalEpisodes,
        certification: source.certification,
        genres: source.genres,
        language: source.language || 'English',
        posterUrl: source.posterUrl,
        backdropUrl: source.backdropUrl,
        trailerUrl: source.trailerUrl,
        franchise: source.franchise,
        franchiseIndex: source.franchiseIndex,
        tmdbId: source.tmdbId,
        imdbId: source.imdbId,
        tvmazeId: source.tvmazeId,
        externalRatings: source.externalRatings,
        watchProviders: source.watchProviders,
        status: 'want-to-watch',
        rating: 0,
        recommendedBy: sender?.name || 'Household Member',
        wantToWatchNote: note.trim() || undefined,
        synopsis: source.synopsis,
        notes: '',
        tags: cleanTags,
        addedAt: now,
        updatedAt: now,
      };

      commitDatabase((prev) => ({
        ...prev,
        movies: [recommendedMovie, ...prev.movies],
      }));

      addToast({
        title: `Recommended to ${targetProfile.name}`,
        description: `Added "${source.title}" to ${targetProfile.name}'s Want to Watch list.`,
        tone: 'success',
      });

      return { ok: true };
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const refreshMovieWatchProviders = useCallback(
    async (movieId: string, regionOverride?: string): Promise<boolean> => {
      const movie = dbRef.current.movies.find((m) => m.id === movieId && !m.deletedAt);
      if (!movie?.tmdbId) {
        addToast({
          title: 'TMDB ID required',
          description: 'Match this title via TMDB search to fetch streaming providers.',
          tone: 'info',
        });
        return false;
      }
      if (!hasTmdbCredentials(apiConfigRef.current)) {
        addToast({
          title: 'TMDB token not configured',
          description: 'Add a free TMDB Read Access Token in API & Streaming Settings.',
          tone: 'info',
        });
        return false;
      }

      const region =
        regionOverride ||
        dbRef.current.householdSettings?.streamingRegion ||
        'US';

      try {
        const snapshot = await fetchWatchProvidersOnly(
          movie.tmdbId,
          movie.mediaType,
          region,
          apiConfigRef.current,
        );
        if (!snapshot) {
          addToast({
            title: `No streaming data returned for ${region}`,
            tone: 'info',
          });
          return false;
        }
        const now = new Date().toISOString();
        commitDatabase((prev) => ({
          ...prev,
          movies: prev.movies.map((m) =>
            m.id === movieId ? { ...m, watchProviders: snapshot, updatedAt: now } : m,
          ),
        }));
        addToast({
          title: `Updated ${region} streaming providers`,
          description:
            snapshot.stream.length > 0
              ? `Streaming on: ${snapshot.stream.map((s) => s.providerName).join(', ')}`
              : 'Not currently on flatrate subscription; check Rent/Buy.',
          tone: 'success',
        });
        return true;
      } catch (err) {
        addToast({
          title: 'Could not refresh streaming data',
          description: err instanceof Error ? err.message : undefined,
          tone: 'error',
        });
        return false;
      }
    },
    [addToast, commitDatabase],
  );

  // --- Watch Logs & Co-Watching ---
  const logWatchSession = useCallback(
    (input: LogWatchEventInput): WatchLog | null => {
      if (!activeProfileId) return null;
      const sourceMovie = dbRef.current.movies.find((m) => m.id === input.movieId && !m.deletedAt);
      if (!sourceMovie) return null;

      let resultLog: WatchLog | null = null;
      let syncedCount = 0;

      commitDatabase((prev) => {
        const res = applyWatchEventToDatabase(prev, activeProfileId, input);
        resultLog = res.primaryLog;
        syncedCount = res.syncedProfilesCount;
        return res.db;
      });

      const toastTitle =
        input.episodesCount && input.episodesCount > 0
          ? `Logged +${input.episodesCount} ${input.episodesCount === 1 ? 'ep' : 'eps'}`
          : input.markWatched
            ? `Marked Watched`
            : `Logged ${formatRuntimeHuman(input.minutesWatched)}`;

      const desc =
        syncedCount > 0
          ? `${sourceMovie.title} · Synced to ${syncedCount} family ${syncedCount === 1 ? 'member' : 'members'}`
          : sourceMovie.title;

      addToast({ title: toastTitle, description: desc, tone: 'success' });
      return resultLog;
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const addCoWatchersToWatch = useCallback(
    (input: AddCoWatchersInput): number => {
      if (!activeProfileId) return 0;
      let addedCount = 0;
      commitDatabase((prev) => {
        const res = addCoWatchersToExistingWatch(prev, activeProfileId, input);
        addedCount = res.addedCount;
        return res.db;
      });
      if (addedCount > 0) {
        addToast({
          title: `Added ${addedCount} family ${addedCount === 1 ? 'member' : 'members'} to watch`,
          tone: 'success',
        });
      }
      return addedCount;
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const updateWatchLog = useCallback(
    (
      logId: string,
      updates: Partial<Pick<WatchLog, 'date' | 'minutesWatched' | 'episodesCount' | 'medium' | 'serviceName' | 'note'>>,
    ) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        watchLogs: prev.watchLogs.map((l) =>
          l.id === logId ? { ...l, ...updates, updatedAt: now } : l,
        ),
      }));
    },
    [commitDatabase],
  );

  const deleteWatchLog = useCallback(
    (logId: string) => {
      const now = new Date().toISOString();
      commitDatabase((prev) => ({
        ...prev,
        watchLogs: prev.watchLogs.map((l) =>
          l.id === logId ? { ...l, deletedAt: now, updatedAt: now } : l,
        ),
      }));
      addToast({
        title: 'Watch log deleted',
        tone: 'info',
        undoAction: () => {
          const restoreNow = new Date().toISOString();
          commitDatabase((prev) => ({
            ...prev,
            watchLogs: prev.watchLogs.map((l) =>
              l.id === logId ? { ...l, deletedAt: null, updatedAt: restoreNow } : l,
            ),
          }));
        },
      });
    },
    [addToast, commitDatabase],
  );

  // --- Import / Demo / Reset ---
  const applyImportPreview = useCallback(
    (preview: ImportPreview, mode: 'merge' | 'replace') => {
      commitDatabase((prev) => applyImport(prev, activeProfileId, preview, mode));
      if (!activeProfileId && preview.format === 'movielibrary-household-json') {
        const importedActive = preview.householdDb?.profiles.find((p) => !p.deletedAt);
        if (importedActive && !importedActive.pinHash) {
          setActiveProfileId(importedActive.id);
          persistActiveProfileSession(importedActive.id, false);
        }
      }
      addToast({
        title: `Imported ${preview.summaryCounts.movies} title(s)`,
        description: `Format: ${preview.formatLabel}`,
        tone: 'success',
      });
    },
    [activeProfileId, addToast, commitDatabase],
  );

  const loadSampleHousehold = useCallback(async () => {
    const demo = await createDemoHousehold();
    await saveDatabaseWithFallback(demo);
    setDb(demo);
    setActiveProfileId(null);
    setPendingPinProfileId(null);
    persistActiveProfileSession(null, false);
    setHasUnsyncedChanges(true);
    scheduleAutoSync();
    addToast({
      title: 'Sample household loaded',
      description: 'Alex (Admin), Maya (PIN: 1234), and Sam are ready.',
      tone: 'success',
    });
  }, [addToast, scheduleAutoSync]);

  const resetAllLocalData = useCallback(() => {
    clearLocalDatabase();
    const now = new Date().toISOString();
    const empty: MovieLibraryDatabase = {
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
    setDb(empty);
    setActiveProfileId(null);
    setPendingPinProfileId(null);
    setHasUnsyncedChanges(false);
    addToast({ title: 'All local data cleared', tone: 'info' });
  }, [addToast]);

  const dismissLegacyCinemaTrackBanner = useCallback(() => {
    setLegacyCinemaTrackRaw(null);
  }, []);

  // --- Google Drive Sync ---
  const updateDriveConfig = useCallback((partial: Partial<DriveConfig>) => {
    setDriveConfig((prev) => {
      const next = { ...prev, ...partial };
      saveDriveConfig(next);
      return next;
    });
  }, []);

  const connectGoogleDrive = useCallback(
    async (promptMode: '' | 'consent' | 'select_account' = ''): Promise<boolean> => {
      const clientId = driveConfigRef.current.clientId.trim();
      if (!clientId) {
        addToast({
          title: 'Google OAuth Client ID required',
          description: 'Paste your Web Client ID in Cloud Sync settings.',
          tone: 'error',
        });
        return false;
      }

      setSyncStatus('connecting');
      setSyncError(null);
      try {
        const { accessToken: token } = await requestDriveAccessToken(clientId, promptMode);
        setAccessToken(token);
        accessTokenRef.current = token;

        const email = await fetchUserEmail(token);
        if (email) {
          updateDriveConfig({ userEmail: email });
        }

        await runSyncWithToken(token, false);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google Sign-In failed';
        setSyncStatus('error');
        setSyncError(msg);
        addToast({ title: 'Google Drive Connection Failed', description: msg, tone: 'error' });
        return false;
      }
    },
    [addToast, runSyncWithToken, updateDriveConfig],
  );

  const syncNow = useCallback(async () => {
    if (accessTokenRef.current) {
      await runSyncWithToken(accessTokenRef.current, false);
    } else {
      await connectGoogleDrive('');
    }
  }, [connectGoogleDrive, runSyncWithToken]);

  const disconnectGoogleDrive = useCallback(() => {
    setAccessToken(null);
    accessTokenRef.current = null;
    updateDriveConfig({ fileId: null, userEmail: null, lastSyncedAt: null });
    setSyncStatus('local');
    setSyncError(null);
    setHasUnsyncedChanges(false);
    addToast({ title: 'Disconnected from Google Drive', tone: 'info' });
  }, [addToast, updateDriveConfig]);

  const value: LibraryContextValue = {
    db,
    storageEngine,
    activeProfiles,
    adminProfiles,
    activeProfile,
    activeProfileId,
    isActiveProfileAdmin,
    pendingPinProfile,
    profileShelves,
    profileMovies,
    profileLogs,
    householdSettings,
    apiConfig,
    updateApiConfig,
    updateHouseholdSettings,
    theme,
    toggleTheme,
    syncStatus,
    syncError,
    driveConfig,
    isDriveConnected: Boolean(accessToken),
    hasUnsyncedChanges,
    legacyCinemaTrackRaw,
    dismissLegacyCinemaTrackBanner,
    toasts,
    dismissToast,
    addToast,
    beginSwitchToProfile,
    verifyPendingPin,
    cancelPendingPin,
    logoutProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    adminResetUserPin,
    setProfileRole,
    addShelf,
    updateShelf,
    deleteShelf,
    addMovie,
    updateMovie,
    deleteMovie,
    startRewatch,
    addWatchHistorySpan,
    deleteWatchHistorySpan,
    recommendMovieToProfile,
    refreshMovieWatchProviders,
    logWatchSession,
    addCoWatchersToWatch,
    updateWatchLog,
    deleteWatchLog,
    applyImportPreview,
    loadSampleHousehold,
    resetAllLocalData,
    updateDriveConfig,
    connectGoogleDrive,
    syncNow,
    disconnectGoogleDrive,
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return ctx;
}
