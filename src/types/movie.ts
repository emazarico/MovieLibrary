export type WatchStatus = 'want-to-watch' | 'watching' | 'watched' | 'dropped';

export type MediaType = 'movie' | 'series';

export type ProfileRole = 'admin' | 'member';

export type WatchMedium = 'streaming' | 'theater' | 'disc' | 'tv' | 'other';

export type MovieOwnership = 'streaming' | 'owned-digital' | 'owned-disc' | 'borrowed' | 'other';

export type AvatarTheme =
  | 'rose'
  | 'amber'
  | 'indigo'
  | 'emerald'
  | 'violet'
  | 'teal'
  | 'coral'
  | 'slate';

export interface StreamingProviderOption {
  providerId: number;
  providerName: string;
  logoUrl?: string;
}

export interface WatchProvidersSnapshot {
  region: string;
  link?: string;
  fetchedAt: string;
  stream: StreamingProviderOption[];
  free: StreamingProviderOption[];
  rent: StreamingProviderOption[];
  buy: StreamingProviderOption[];
}

export interface ExternalRatings {
  tmdbScore?: number;
  tmdbVotes?: number;
  imdbRating?: string;
  rottenTomatoes?: string;
  metascore?: string;
  awards?: string;
}

export interface WatchSessionSpan {
  id: string;
  startedAt?: string;
  watchedAt?: string;
  rating?: number;
  notes?: string;
  medium?: WatchMedium;
  serviceName?: string;
  watchedWithProfileIds?: string[];
  watchedWithGuests?: string;
  watchGroupId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarTheme: AvatarTheme;
  role?: ProfileRole;
  pinHash: string | null;
  yearlyMovieGoal: number;
  monthlyWatchHoursGoal: number;
  badgeRewards?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Shelf {
  id: string;
  profileId: string;
  name: string;
  color: string;
  icon: string;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface MovieItem {
  id: string;
  profileId: string;
  shelfIds: string[];
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  director: string;
  cast?: string[];
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
  /** 0 to 5 in 0.5 increments; 0 means unrated */
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
  addedAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface WatchLog {
  id: string;
  profileId: string;
  movieId: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  minutesWatched: number;
  episodesCount?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  medium?: WatchMedium;
  serviceName?: string;
  watchCycle?: number;
  watchGroupId?: string;
  watchedWithProfileIds?: string[];
  watchedWithGuests?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface HouseholdSettings {
  streamingRegion: string;
  subscribedServices: string[];
  updatedAt: string;
}

export interface MovieLibraryDatabase {
  schemaVersion: 1;
  dbId: string;
  updatedAt: string;
  householdSettings?: HouseholdSettings;
  profiles: UserProfile[];
  shelves: Shelf[];
  movies: MovieItem[];
  watchLogs: WatchLog[];
}

export type SyncStatus =
  | 'local'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'token_expired'
  | 'offline'
  | 'error';

export interface DriveConfig {
  clientId: string;
  fileId: string | null;
  fileName: string;
  userEmail: string | null;
  lastSyncedAt: string | null;
}

export interface ApiConfig {
  tmdbReadToken: string;
  tmdbApiKey: string;
  omdbApiKey: string;
}

export interface CatalogSearchResult {
  key: string;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  director: string;
  cast: string[];
  releaseYear?: number;
  endYear?: number;
  runtimeMinutes?: number;
  totalSeasons?: number;
  totalEpisodes?: number;
  certification?: string;
  genres: string[];
  language?: string;
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  synopsis?: string;
  franchise?: string;
  tmdbId?: number;
  imdbId?: string;
  tvmazeId?: number;
  externalRatings?: ExternalRatings;
  watchProviders?: WatchProvidersSnapshot;
  source: 'tmdb' | 'omdb' | 'itunes' | 'tvmaze' | 'merged';
}

export type AppTab = 'library' | 'search' | 'timeline' | 'management';
export type ThemeMode = 'light' | 'dark';
