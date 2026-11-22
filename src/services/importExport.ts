import type {
  MediaType,
  MovieItem,
  MovieLibraryDatabase,
  Shelf,
  UserProfile,
  WatchLog,
  WatchStatus,
} from '../types/movie';
import { generateId } from '../utils/crypto';
import { parseCsv, serializeCsv } from '../utils/csv';
import { mergeDatabases } from '../utils/merge';
import { sanitizePosterUrl } from '../utils/poster';

export type ImportFormat =
  | 'movielibrary-household-json'
  | 'movielibrary-profile-json'
  | 'cinematrack-json'
  | 'v3-legacy-json'
  | 'letterboxd-csv'
  | 'imdb-csv'
  | 'cinematrack-csv'
  | 'unknown';

export interface ProfileImportBundle {
  profile?: UserProfile;
  shelves: Shelf[];
  movies: MovieItem[];
  watchLogs: WatchLog[];
}

export interface ImportPreview {
  format: ImportFormat;
  formatLabel: string;
  filename: string;
  summaryCounts: {
    profiles: number;
    shelves: number;
    movies: number;
    watchLogs: number;
  };
  duplicateCount: number;
  warnings: string[];
  householdDb?: MovieLibraryDatabase;
  profileBundle?: ProfileImportBundle;
}

export interface ProfileExportEnvelope {
  kind: 'movielibrary-profile-v1';
  schemaVersion: 1;
  exportedAt: string;
  profile: UserProfile;
  shelves: Shelf[];
  movies: MovieItem[];
  watchLogs: WatchLog[];
}

function todaySlug(): string {
  return new Date().toISOString().split('T')[0];
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fromFlexibleDate(raw?: string | number | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString().split('T')[0];
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  const slashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(trimmed);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }
  return undefined;
}

function clampStarRating(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const clamped = Math.min(5, Math.max(0, num));
  return Math.round(clamped * 2) / 2;
}

function normalizeMovieKey(title: string, year?: number): string {
  return `${title.trim().toLowerCase()}::${year || ''}`;
}

function findDuplicateCount(candidateMovies: MovieItem[], existingMovies: MovieItem[]): number {
  const existingTmdb = new Set(
    existingMovies
      .filter((m) => !m.deletedAt && m.tmdbId)
      .map((m) => `${m.mediaType}:${m.tmdbId}`),
  );
  const existingImdb = new Set(
    existingMovies
      .filter((m) => !m.deletedAt && m.imdbId)
      .map((m) => m.imdbId!.trim().toLowerCase()),
  );
  const existingTitleKeys = new Set(
    existingMovies
      .filter((m) => !m.deletedAt)
      .map((m) => normalizeMovieKey(m.title, m.releaseYear)),
  );

  let dupes = 0;
  for (const m of candidateMovies) {
    const hasTmdb = m.tmdbId && existingTmdb.has(`${m.mediaType}:${m.tmdbId}`);
    const hasImdb = m.imdbId && existingImdb.has(m.imdbId.trim().toLowerCase());
    const hasTitle = existingTitleKeys.has(normalizeMovieKey(m.title, m.releaseYear));
    if (hasTmdb || hasImdb || hasTitle) dupes++;
  }
  return dupes;
}

// --- Exports ---

export function exportHouseholdJson(db: MovieLibraryDatabase): void {
  const payload = JSON.stringify(db, null, 2);
  triggerDownload(`movielibrary-household-${todaySlug()}.json`, payload, 'application/json');
}

export function exportProfileJson(db: MovieLibraryDatabase, profile: UserProfile): void {
  const envelope: ProfileExportEnvelope = {
    kind: 'movielibrary-profile-v1',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    shelves: db.shelves.filter((s) => s.profileId === profile.id && !s.deletedAt),
    movies: db.movies.filter((m) => m.profileId === profile.id && !m.deletedAt),
    watchLogs: db.watchLogs.filter((l) => l.profileId === profile.id && !l.deletedAt),
  };
  const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'viewer';
  triggerDownload(
    `movielibrary-${safeName}-${todaySlug()}.json`,
    JSON.stringify(envelope, null, 2),
    'application/json',
  );
}

export function exportLetterboxdCsv(movies: MovieItem[], profileName = 'viewer'): void {
  const headers = [
    'Title',
    'Year',
    'Directors',
    'Rating',
    'WatchedDate',
    'Rewatch',
    'Tags',
    'Review',
    'MediaType',
    'IMDbID',
  ];

  const active = movies.filter((m) => !m.deletedAt);
  const rows = active.map((m) => [
    m.title,
    m.releaseYear || '',
    m.director,
    m.rating > 0 ? m.rating : '',
    m.dateWatched || '',
    (m.watchHistory?.length ?? 0) > 0 ? 'Yes' : '',
    m.tags.join(', '),
    m.review || m.notes || '',
    m.mediaType,
    m.imdbId || '',
  ]);

  const csv = serializeCsv(headers, rows);
  const safeName = profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'viewer';
  triggerDownload(`movielibrary-letterboxd-${safeName}-${todaySlug()}.csv`, csv, 'text/csv;charset=utf-8');
}

export function exportWatchLogsCsv(
  logs: WatchLog[],
  movies: MovieItem[],
  profiles: UserProfile[],
  profileName = 'viewer',
): void {
  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const profileMap = new Map(profiles.map((p) => [p.id, p]));
  const headers = [
    'Date',
    'Title',
    'Director',
    'Media Type',
    'Minutes Watched',
    'Episodes',
    'Season',
    'Episode',
    'Medium',
    'Service',
    'Watched With',
    'Note',
  ];

  const activeLogs = logs
    .filter((l) => !l.deletedAt)
    .sort((a, b) => b.date.localeCompare(a.date));

  const rows = activeLogs.map((l) => {
    const m = movieMap.get(l.movieId);
    const withNames = [
      ...(l.watchedWithProfileIds || [])
        .map((id) => profileMap.get(id)?.name)
        .filter((n): n is string => Boolean(n)),
      ...(l.watchedWithGuests ? [l.watchedWithGuests] : []),
    ].join(', ');

    return [
      l.date,
      m?.title || 'Unknown Title',
      m?.director || '',
      m?.mediaType || 'movie',
      l.minutesWatched,
      l.episodesCount ?? '',
      l.seasonNumber ?? '',
      l.episodeNumber ?? '',
      l.medium || '',
      l.serviceName || '',
      withNames,
      l.note || '',
    ];
  });

  const csv = serializeCsv(headers, rows);
  const safeName = profileName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'viewer';
  triggerDownload(`movielibrary-watchlogs-${safeName}-${todaySlug()}.csv`, csv, 'text/csv;charset=utf-8');
}

// --- Parsing & Preview ---

function mapCinemaTrackStatus(raw?: string): WatchStatus {
  const lower = (raw || '').toLowerCase();
  if (lower === 'liked' || lower === 'seen' || lower === 'watched') return 'watched';
  if (lower === 'disliked' || lower === 'ignored' || lower === 'dropped') return 'dropped';
  if (lower === 'watching') return 'watching';
  return 'want-to-watch';
}

function scaleTenPointToFiveStars(raw?: string | number | null): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return clampStarRating(num / 2);
}

function buildLetterboxdBundle(
  rows: Record<string, string>[],
  filename: string,
  targetProfileId: string,
): ProfileImportBundle {
  const now = new Date().toISOString();
  const isWatchlistFile = filename.toLowerCase().includes('watchlist');
  const defaultShelf: Shelf = {
    id: generateId('shelf'),
    profileId: targetProfileId,
    name: isWatchlistFile ? 'Watchlist' : 'Letterboxd Import',
    color: 'rose',
    icon: 'film',
    visible: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const movies: MovieItem[] = [];
  for (const row of rows) {
    const title = (row.Name || row.Title || '').trim();
    if (!title) continue;
    const yearNum = Number(row.Year);
    const releaseYear = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined;
    const rating = clampStarRating(row.Rating);
    const watchedDate = fromFlexibleDate(row['Watched Date'] || row.WatchedDate || row.Date);
    const review = (row.Review || '').trim();
    const rawTags = (row.Tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (isWatchlistFile && !rawTags.some((t) => t.toLowerCase() === 'watchlist')) {
      rawTags.push('watchlist');
    }

    const status: WatchStatus = isWatchlistFile
      ? 'want-to-watch'
      : watchedDate || rating > 0 || review
        ? 'watched'
        : 'want-to-watch';

    const mediaType: MediaType =
      (row.MediaType || '').toLowerCase() === 'series' ? 'series' : 'movie';

    movies.push({
      id: generateId('movie'),
      profileId: targetProfileId,
      shelfIds: [defaultShelf.id],
      mediaType,
      title,
      director: (row.Directors || row.Director || 'Unknown Director').trim(),
      releaseYear,
      runtimeMinutes: 0,
      genres: [],
      language: 'English',
      imdbId: (row.IMDbID || '').trim() || undefined,
      status,
      rating,
      dateWatched: status === 'watched' ? watchedDate : undefined,
      review: review || undefined,
      notes: '',
      tags: rawTags,
      addedAt: now,
      updatedAt: now,
    });
  }

  return { shelves: movies.length > 0 ? [defaultShelf] : [], movies, watchLogs: [] };
}

function buildImdbBundle(
  rows: Record<string, string>[],
  targetProfileId: string,
): ProfileImportBundle {
  const now = new Date().toISOString();
  const defaultShelf: Shelf = {
    id: generateId('shelf'),
    profileId: targetProfileId,
    name: 'IMDb Import',
    color: 'amber',
    icon: 'film',
    visible: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const movies: MovieItem[] = [];
  for (const row of rows) {
    const title = (row.Title || row['Original Title'] || '').trim();
    if (!title) continue;
    const imdbId = (row.Const || '').trim() || undefined;
    const yearNum = Number(row.Year);
    const releaseYear = Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined;
    const runtimeNum = Number(row['Runtime (mins)']);
    const runtimeMinutes = Number.isFinite(runtimeNum) && runtimeNum > 0 ? Math.round(runtimeNum) : 0;
    const rawType = (row['Title Type'] || '').toLowerCase();
    const mediaType: MediaType =
      rawType.includes('tv') || rawType.includes('series') || rawType.includes('mini')
        ? 'series'
        : 'movie';
    const personalRating = scaleTenPointToFiveStars(row['Your Rating']);
    const dateRated = fromFlexibleDate(row['Date Rated']);
    const genres = (row.Genres || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    const director = (row.Directors || '').trim() || (mediaType === 'series' ? 'TV Series' : 'Unknown Director');
    const imdbPublic = (row['IMDb Rating'] || '').trim();

    movies.push({
      id: generateId('movie'),
      profileId: targetProfileId,
      shelfIds: [defaultShelf.id],
      mediaType,
      title,
      originalTitle: row['Original Title'] && row['Original Title'] !== title ? row['Original Title'] : undefined,
      director,
      releaseYear,
      runtimeMinutes,
      genres,
      language: 'English',
      imdbId,
      externalRatings: imdbPublic ? { imdbRating: imdbPublic } : undefined,
      status: personalRating > 0 || dateRated ? 'watched' : 'want-to-watch',
      rating: personalRating,
      dateWatched: dateRated,
      notes: '',
      tags: [],
      addedAt: now,
      updatedAt: now,
    });
  }

  return { shelves: movies.length > 0 ? [defaultShelf] : [], movies, watchLogs: [] };
}

function buildCinemaTrackCsvBundle(
  rows: Record<string, string>[],
  targetProfileId: string,
): ProfileImportBundle {
  const now = new Date().toISOString();
  const shelf: Shelf = {
    id: generateId('shelf'),
    profileId: targetProfileId,
    name: 'CinemaTrack Import',
    color: 'rose',
    icon: 'film',
    visible: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const movies: MovieItem[] = [];
  for (const row of rows) {
    const title = (row.Title || '').trim();
    if (!title) continue;
    const tmdbNum = Number(row.ID);
    const yearNum = Number(row.Year);
    const status = mapCinemaTrackStatus(row.Status);
    const rating = scaleTenPointToFiveStars(row['Personal Score']);
    const tags = status === 'want-to-watch' ? ['watchlist'] : [];

    movies.push({
      id: generateId('movie'),
      profileId: targetProfileId,
      shelfIds: [shelf.id],
      mediaType: 'movie',
      title,
      director: 'Unknown Director',
      releaseYear: Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined,
      runtimeMinutes: 0,
      genres: [],
      language: 'English',
      tmdbId: Number.isFinite(tmdbNum) && tmdbNum > 0 ? tmdbNum : undefined,
      status,
      rating,
      tags,
      notes: '',
      addedAt: now,
      updatedAt: now,
    });
  }

  return { shelves: movies.length > 0 ? [shelf] : [], movies, watchLogs: [] };
}

function buildCinemaTrackJsonBundle(
  entries: Array<{ id?: number; title?: string; year?: string | number; status?: string; score?: number | null; timestamp?: number }>,
  targetProfileId: string,
): ProfileImportBundle {
  const now = new Date().toISOString();
  const shelf: Shelf = {
    id: generateId('shelf'),
    profileId: targetProfileId,
    name: 'CinemaTrack Import',
    color: 'rose',
    icon: 'film',
    visible: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };

  const movies: MovieItem[] = [];
  for (const item of entries) {
    const title = (item.title || '').trim();
    if (!title) continue;
    const status = mapCinemaTrackStatus(item.status);
    const rating = scaleTenPointToFiveStars(item.score);
    const yearNum = Number(item.year);
    const addedDate = item.timestamp ? fromFlexibleDate(item.timestamp) : undefined;

    movies.push({
      id: generateId('movie'),
      profileId: targetProfileId,
      shelfIds: [shelf.id],
      mediaType: 'movie',
      title,
      director: 'Unknown Director',
      releaseYear: Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined,
      runtimeMinutes: 0,
      genres: [],
      language: 'English',
      tmdbId: item.id && item.id > 0 ? item.id : undefined,
      status,
      rating,
      dateWatched: status === 'watched' ? addedDate : undefined,
      tags: status === 'want-to-watch' ? ['watchlist'] : [],
      notes: '',
      addedAt: now,
      updatedAt: now,
    });
  }

  return { shelves: movies.length > 0 ? [shelf] : [], movies, watchLogs: [] };
}

function buildLegacyV3MovieBundle(
  legacyData: {
    libraries?: Array<{
      name?: string;
      type?: string;
      visible?: boolean;
      items?: Array<{
        title?: string;
        author?: string;
        cover?: string;
        year?: number | string;
        status?: string;
        rating?: number;
        notes?: string;
      }>;
    }>;
  },
  targetProfileId: string,
): ProfileImportBundle {
  const now = new Date().toISOString();
  const shelves: Shelf[] = [];
  const movies: MovieItem[] = [];

  (legacyData.libraries || []).forEach((lib, idx) => {
    if (lib.type && lib.type !== 'movie') return;
    const shelfId = generateId('shelf');
    shelves.push({
      id: shelfId,
      profileId: targetProfileId,
      name: lib.name?.trim() || `Imported List ${idx + 1}`,
      color: 'rose',
      icon: 'film',
      visible: lib.visible !== false,
      sortOrder: idx,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of lib.items || []) {
      const yearNum = Number(item.year);
      movies.push({
        id: generateId('movie'),
        profileId: targetProfileId,
        shelfIds: [shelfId],
        mediaType: 'movie',
        title: item.title?.trim() || 'Untitled Movie',
        director: item.author?.trim() || 'Unknown Director',
        releaseYear: Number.isFinite(yearNum) && yearNum > 1880 ? yearNum : undefined,
        runtimeMinutes: 0,
        genres: [],
        language: 'English',
        posterUrl: sanitizePosterUrl(item.cover),
        status: item.status === 'finished' || item.status === 'watched' ? 'watched' : 'want-to-watch',
        rating: clampStarRating(item.rating),
        notes: item.notes || '',
        tags: [],
        addedAt: now,
        updatedAt: now,
      });
    }
  });

  return { shelves, movies, watchLogs: [] };
}

export function inspectImportFile(
  filename: string,
  text: string,
  currentDb: MovieLibraryDatabase,
  activeProfileId: string | null,
): ImportPreview {
  const trimmed = text.trim();
  const warnings: string[] = [];
  const existingProfileMovies = activeProfileId
    ? currentDb.movies.filter((m) => m.profileId === activeProfileId && !m.deletedAt)
    : currentDb.movies.filter((m) => !m.deletedAt);

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;

      if (
        !Array.isArray(parsed) &&
        parsed.schemaVersion === 1 &&
        Array.isArray(parsed.profiles) &&
        Array.isArray(parsed.movies)
      ) {
        const db = parsed as unknown as MovieLibraryDatabase;
        const activeProfiles = db.profiles.filter((p) => !p.deletedAt);
        const activeShelves = (db.shelves || []).filter((s) => !s.deletedAt);
        const activeMovies = db.movies.filter((m) => !m.deletedAt);
        const activeLogs = (db.watchLogs || []).filter((l) => !l.deletedAt);

        return {
          format: 'movielibrary-household-json',
          formatLabel: 'MovieLibrary Household Backup (JSON)',
          filename,
          summaryCounts: {
            profiles: activeProfiles.length,
            shelves: activeShelves.length,
            movies: activeMovies.length,
            watchLogs: activeLogs.length,
          },
          duplicateCount: findDuplicateCount(activeMovies, currentDb.movies),
          warnings,
          householdDb: db,
        };
      }

      if (
        !Array.isArray(parsed) &&
        parsed.kind === 'movielibrary-profile-v1' &&
        parsed.profile &&
        Array.isArray(parsed.movies)
      ) {
        const env = parsed as unknown as ProfileExportEnvelope;
        const movies = env.movies.filter((m) => !m.deletedAt);
        const shelves = (env.shelves || []).filter((s) => !s.deletedAt);
        const watchLogs = (env.watchLogs || []).filter((l) => !l.deletedAt);
        return {
          format: 'movielibrary-profile-json',
          formatLabel: 'MovieLibrary Profile Export (JSON)',
          filename,
          summaryCounts: {
            profiles: 1,
            shelves: shelves.length,
            movies: movies.length,
            watchLogs: watchLogs.length,
          },
          duplicateCount: findDuplicateCount(movies, existingProfileMovies),
          warnings,
          profileBundle: {
            profile: env.profile,
            shelves,
            movies,
            watchLogs,
          },
        };
      }

      if (Array.isArray(parsed)) {
        const targetId = activeProfileId || generateId('profile');
        const bundle = buildCinemaTrackJsonBundle(parsed, targetId);
        return {
          format: 'cinematrack-json',
          formatLabel: 'CinemaTrack History (JSON)',
          filename,
          summaryCounts: {
            profiles: activeProfileId ? 0 : 1,
            shelves: bundle.shelves.length,
            movies: bundle.movies.length,
            watchLogs: 0,
          },
          duplicateCount: findDuplicateCount(bundle.movies, existingProfileMovies),
          warnings,
          profileBundle: bundle,
        };
      }

      if (Array.isArray(parsed.libraries)) {
        const targetId = activeProfileId || generateId('profile');
        const bundle = buildLegacyV3MovieBundle(
          parsed as Parameters<typeof buildLegacyV3MovieBundle>[0],
          targetId,
        );
        return {
          format: 'v3-legacy-json',
          formatLabel: 'Legacy OmniLibrary v3 Movies (JSON)',
          filename,
          summaryCounts: {
            profiles: activeProfileId ? 0 : 1,
            shelves: bundle.shelves.length,
            movies: bundle.movies.length,
            watchLogs: 0,
          },
          duplicateCount: findDuplicateCount(bundle.movies, existingProfileMovies),
          warnings,
          profileBundle: bundle,
        };
      }
    } catch {
      warnings.push('File looks like JSON but could not be parsed.');
    }
  }

  // CSV Detection
  const { headers, rows } = parseCsv(trimmed);
  const lowerHeaders = new Set(headers.map((h) => h.toLowerCase()));
  const targetId = activeProfileId || generateId('profile');

  if (lowerHeaders.has('const') && lowerHeaders.has('title')) {
    const bundle = buildImdbBundle(rows, targetId);
    return {
      format: 'imdb-csv',
      formatLabel: 'IMDb Export (CSV)',
      filename,
      summaryCounts: {
        profiles: activeProfileId ? 0 : 1,
        shelves: bundle.shelves.length,
        movies: bundle.movies.length,
        watchLogs: 0,
      },
      duplicateCount: findDuplicateCount(bundle.movies, existingProfileMovies),
      warnings,
      profileBundle: bundle,
    };
  }

  if (
    (lowerHeaders.has('name') || lowerHeaders.has('title')) &&
    (lowerHeaders.has('letterboxd uri') ||
      lowerHeaders.has('watched date') ||
      lowerHeaders.has('watcheddate') ||
      lowerHeaders.has('year'))
  ) {
    if (
      lowerHeaders.has('id') &&
      lowerHeaders.has('status') &&
      lowerHeaders.has('personal score')
    ) {
      const bundle = buildCinemaTrackCsvBundle(rows, targetId);
      return {
        format: 'cinematrack-csv',
        formatLabel: 'CinemaTrack Export (CSV)',
        filename,
        summaryCounts: {
          profiles: activeProfileId ? 0 : 1,
          shelves: bundle.shelves.length,
          movies: bundle.movies.length,
          watchLogs: 0,
        },
        duplicateCount: findDuplicateCount(bundle.movies, existingProfileMovies),
        warnings,
        profileBundle: bundle,
      };
    }

    const bundle = buildLetterboxdBundle(rows, filename, targetId);
    return {
      format: 'letterboxd-csv',
      formatLabel: 'Letterboxd Export (CSV)',
      filename,
      summaryCounts: {
        profiles: activeProfileId ? 0 : 1,
        shelves: bundle.shelves.length,
        movies: bundle.movies.length,
        watchLogs: 0,
      },
      duplicateCount: findDuplicateCount(bundle.movies, existingProfileMovies),
      warnings,
      profileBundle: bundle,
    };
  }

  return {
    format: 'unknown',
    formatLabel: 'Unrecognized File Format',
    filename,
    summaryCounts: { profiles: 0, shelves: 0, movies: 0, watchLogs: 0 },
    duplicateCount: 0,
    warnings: [
      ...warnings,
      'Could not recognize format. Supported: MovieLibrary JSON, Letterboxd CSV, IMDb CSV, or CinemaTrack CSV/JSON.',
    ],
  };
}

export function applyImport(
  currentDb: MovieLibraryDatabase,
  activeProfileId: string | null,
  preview: ImportPreview,
  mode: 'merge' | 'replace',
): MovieLibraryDatabase {
  const now = new Date().toISOString();

  if (preview.format === 'movielibrary-household-json' && preview.householdDb) {
    if (mode === 'replace') {
      return { ...preview.householdDb, updatedAt: now };
    }
    return mergeDatabases(currentDb, preview.householdDb);
  }

  if (!preview.profileBundle) return currentDb;
  const bundle = preview.profileBundle;

  let targetProfileId = activeProfileId;
  let nextProfiles = [...currentDb.profiles];
  let nextShelves = [...currentDb.shelves];
  let nextMovies = [...currentDb.movies];
  let nextLogs = [...currentDb.watchLogs];

  if (!targetProfileId) {
    const newId = bundle.profile?.id || generateId('profile');
    targetProfileId = newId;
    nextProfiles.push({
      id: newId,
      name: bundle.profile?.name || 'Imported Viewer',
      avatarEmoji: bundle.profile?.avatarEmoji || '🎬',
      avatarTheme: bundle.profile?.avatarTheme || 'rose',
      role: currentDb.profiles.filter((p) => !p.deletedAt).length === 0 ? 'admin' : 'member',
      pinHash: null,
      yearlyMovieGoal: bundle.profile?.yearlyMovieGoal || 40,
      monthlyWatchHoursGoal: bundle.profile?.monthlyWatchHoursGoal || 15,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (mode === 'replace') {
    nextShelves = nextShelves.map((s) =>
      s.profileId === targetProfileId ? { ...s, deletedAt: now, updatedAt: now } : s,
    );
    nextMovies = nextMovies.map((m) =>
      m.profileId === targetProfileId ? { ...m, deletedAt: now, updatedAt: now } : m,
    );
    nextLogs = nextLogs.map((l) =>
      l.profileId === targetProfileId ? { ...l, deletedAt: now, updatedAt: now } : l,
    );
  }

  const shelfIdMap = new Map<string, string>();
  const existingProfileShelves = nextShelves.filter(
    (s) => s.profileId === targetProfileId && !s.deletedAt,
  );
  const existingShelfByName = new Map(
    existingProfileShelves.map((s) => [s.name.trim().toLowerCase(), s]),
  );

  for (const s of bundle.shelves) {
    const existing = existingShelfByName.get(s.name.trim().toLowerCase());
    if (existing && mode === 'merge') {
      shelfIdMap.set(s.id, existing.id);
    } else {
      const freshId = generateId('shelf');
      shelfIdMap.set(s.id, freshId);
      nextShelves.push({
        ...s,
        id: freshId,
        profileId: targetProfileId,
        createdAt: s.createdAt || now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  const existingProfileMovies = nextMovies.filter(
    (m) => m.profileId === targetProfileId && !m.deletedAt,
  );
  const existingTmdb = new Set(
    existingProfileMovies.filter((m) => m.tmdbId).map((m) => `${m.mediaType}:${m.tmdbId}`),
  );
  const existingImdb = new Set(
    existingProfileMovies.filter((m) => m.imdbId).map((m) => m.imdbId!.trim().toLowerCase()),
  );
  const existingKeys = new Set(
    existingProfileMovies.map((m) => normalizeMovieKey(m.title, m.releaseYear)),
  );

  const movieIdMap = new Map<string, string>();
  for (const m of bundle.movies) {
    const tmdbMatch = m.tmdbId && existingTmdb.has(`${m.mediaType}:${m.tmdbId}`);
    const imdbMatch = m.imdbId && existingImdb.has(m.imdbId.trim().toLowerCase());
    const keyMatch = existingKeys.has(normalizeMovieKey(m.title, m.releaseYear));

    if (mode === 'merge' && (tmdbMatch || imdbMatch || keyMatch)) {
      continue;
    }

    const freshMovieId = generateId('movie');
    movieIdMap.set(m.id, freshMovieId);
    const mappedShelves = m.shelfIds
      .map((sid) => shelfIdMap.get(sid))
      .filter((sid): sid is string => Boolean(sid));

    nextMovies.unshift({
      ...m,
      id: freshMovieId,
      profileId: targetProfileId,
      shelfIds: mappedShelves,
      addedAt: m.addedAt || now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  for (const log of bundle.watchLogs) {
    const mappedMovieId = movieIdMap.get(log.movieId);
    if (!mappedMovieId) continue;
    nextLogs.unshift({
      ...log,
      id: generateId('wlog'),
      profileId: targetProfileId,
      movieId: mappedMovieId,
      createdAt: log.createdAt || now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  return {
    ...currentDb,
    updatedAt: now,
    profiles: nextProfiles,
    shelves: nextShelves,
    movies: nextMovies,
    watchLogs: nextLogs,
  };
}
