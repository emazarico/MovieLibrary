import type {
  ApiConfig,
  CatalogSearchResult,
  MediaType,
  StreamingProviderOption,
  WatchProvidersSnapshot,
} from '../types/movie';
import { buildTmdbImageUrl } from '../utils/poster';
import { isoLangToMovieLanguage } from '../utils/themes';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

export interface TmdbSearchParams {
  query: string;
  mediaType?: 'all' | MediaType;
  year?: number;
  language?: string;
  signal?: AbortSignal;
}

export type TmdbDiscoverPreset =
  | 'trending'
  | 'popular-movies'
  | 'top-rated-movies'
  | 'now-playing'
  | 'popular-series'
  | 'top-rated-series';

export interface TmdbDiscoverParams {
  preset: TmdbDiscoverPreset;
  genreId?: number;
  region?: string;
  providerId?: number;
  signal?: AbortSignal;
}

function buildAuthFetchOptions(
  urlPath: string,
  params: Record<string, string | number | undefined>,
  config: ApiConfig,
  signal?: AbortSignal,
): { url: string; init: RequestInit } {
  const token = config.tmdbReadToken.trim();
  const apiKey = config.tmdbApiKey.trim();

  if (!token && !apiKey) {
    throw new Error('TMDB credentials are not configured.');
  }

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && String(v).trim() !== '') {
      search.set(k, String(v));
    }
  }
  if (!token && apiKey) {
    search.set('api_key', apiKey);
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const queryStr = search.toString();
  return {
    url: `${TMDB_BASE}${urlPath}${queryStr ? `?${queryStr}` : ''}`,
    init: { headers, signal },
  };
}

async function tmdbFetchJson<T>(
  urlPath: string,
  params: Record<string, string | number | undefined>,
  config: ApiConfig,
  signal?: AbortSignal,
): Promise<T> {
  const { url, init } = buildAuthFetchOptions(urlPath, params, config, signal);
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `TMDB request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { status_message?: string };
      if (errBody?.status_message) {
        msg = `TMDB (${res.status}): ${errBody.status_message}`;
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

interface TmdbRawProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string | null;
}

interface TmdbRegionProviders {
  link?: string;
  flatrate?: TmdbRawProvider[];
  free?: TmdbRawProvider[];
  ads?: TmdbRawProvider[];
  rent?: TmdbRawProvider[];
  buy?: TmdbRawProvider[];
}

function mapProviders(list?: TmdbRawProvider[]): StreamingProviderOption[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<number>();
  const out: StreamingProviderOption[] = [];
  for (const p of list) {
    if (!p || !p.provider_id || seen.has(p.provider_id)) continue;
    seen.add(p.provider_id);
    out.push({
      providerId: p.provider_id,
      providerName: p.provider_name,
      logoUrl: buildTmdbImageUrl(p.logo_path, 'w92'),
    });
  }
  return out;
}

export function parseWatchProvidersResponse(
  results: Record<string, TmdbRegionProviders> | undefined,
  preferredRegion = 'US',
): WatchProvidersSnapshot | undefined {
  if (!results || typeof results !== 'object') return undefined;
  const regionCode = preferredRegion.trim().toUpperCase() || 'US';
  const regionData = results[regionCode] || results.US || Object.values(results)[0];
  if (!regionData) return undefined;

  const actualRegion = results[regionCode]
    ? regionCode
    : results.US
      ? 'US'
      : Object.keys(results)[0] || regionCode;

  const freeCombined = [...(regionData.free || []), ...(regionData.ads || [])];

  return {
    region: actualRegion,
    link: regionData.link,
    fetchedAt: new Date().toISOString(),
    stream: mapProviders(regionData.flatrate),
    free: mapProviders(freeCombined),
    rent: mapProviders(regionData.rent),
    buy: mapProviders(regionData.buy),
  };
}

interface TmdbSearchItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  original_language?: string;
  genre_ids?: number[];
  vote_average?: number;
  vote_count?: number;
}

function parseYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const match = /^(\d{4})/.exec(dateStr);
  if (!match) return undefined;
  const y = Number(match[1]);
  return Number.isFinite(y) && y > 1800 ? y : undefined;
}

function mapGenres(ids: number[] | undefined, mediaType: MediaType): string[] {
  if (!Array.isArray(ids)) return [];
  const dict = mediaType === 'series' ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES;
  return ids.map((id) => dict[id]).filter((g): g is string => Boolean(g));
}

function mapSearchItemToCatalog(
  item: TmdbSearchItem,
  forcedType?: MediaType,
): CatalogSearchResult | null {
  const rawType = forcedType || (item.media_type === 'tv' ? 'series' : item.media_type === 'movie' ? 'movie' : undefined);
  if (!rawType) return null;

  const title = (rawType === 'series' ? item.name : item.title) || item.title || item.name;
  if (!title) return null;

  const originalTitle =
    (rawType === 'series' ? item.original_name : item.original_title) || undefined;
  const releaseYear = parseYear(rawType === 'series' ? item.first_air_date : item.release_date);

  return {
    key: `tmdb:${rawType}:${item.id}`,
    mediaType: rawType,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    director: rawType === 'series' ? 'TV Series' : 'Unknown Director',
    cast: [],
    releaseYear,
    genres: mapGenres(item.genre_ids, rawType),
    language: isoLangToMovieLanguage(item.original_language),
    posterUrl: buildTmdbImageUrl(item.poster_path, 'w500'),
    backdropUrl: buildTmdbImageUrl(item.backdrop_path, 'w1280'),
    synopsis: item.overview?.trim() || undefined,
    tmdbId: item.id,
    externalRatings:
      item.vote_average && item.vote_average > 0
        ? {
            tmdbScore: Number(item.vote_average.toFixed(1)),
            tmdbVotes: item.vote_count,
          }
        : undefined,
    source: 'tmdb',
  };
}

export async function searchTmdb(
  params: TmdbSearchParams,
  config: ApiConfig,
): Promise<CatalogSearchResult[]> {
  const q = params.query.trim();
  if (!q) return [];
  const mediaType = params.mediaType || 'all';
  const endpoint =
    mediaType === 'movie'
      ? '/search/movie'
      : mediaType === 'series'
        ? '/search/tv'
        : '/search/multi';

  const queryParams: Record<string, string | number | undefined> = {
    query: q,
    include_adult: 'false',
    page: 1,
    language: params.language || 'en-US',
  };
  if (params.year && mediaType === 'movie') {
    queryParams.primary_release_year = params.year;
  } else if (params.year && mediaType === 'series') {
    queryParams.first_air_date_year = params.year;
  }

  const data = await tmdbFetchJson<{ results?: TmdbSearchItem[] }>(
    endpoint,
    queryParams,
    config,
    params.signal,
  );

  const forcedType: MediaType | undefined =
    mediaType === 'movie' ? 'movie' : mediaType === 'series' ? 'series' : undefined;

  return (data.results || [])
    .map((item) => mapSearchItemToCatalog(item, forcedType))
    .filter((item): item is CatalogSearchResult => Boolean(item))
    .slice(0, 24);
}

export async function discoverTmdb(
  params: TmdbDiscoverParams,
  config: ApiConfig,
): Promise<CatalogSearchResult[]> {
  const region = params.region || 'US';
  let endpoint = '/trending/all/week';
  let forcedType: MediaType | undefined = undefined;
  const queryParams: Record<string, string | number | undefined> = {
    page: 1,
    language: 'en-US',
    region,
  };

  if (params.providerId || params.genreId) {
    const isSeries =
      params.preset === 'popular-series' || params.preset === 'top-rated-series';
    endpoint = isSeries ? '/discover/tv' : '/discover/movie';
    forcedType = isSeries ? 'series' : 'movie';
    queryParams.sort_by =
      params.preset === 'top-rated-movies' || params.preset === 'top-rated-series'
        ? 'vote_average.desc'
        : 'popularity.desc';
    queryParams['vote_count.gte'] = 100;
    if (params.genreId) queryParams.with_genres = params.genreId;
    if (params.providerId) {
      queryParams.with_watch_providers = params.providerId;
      queryParams.watch_region = region;
    }
  } else {
    switch (params.preset) {
      case 'trending':
        endpoint = '/trending/all/week';
        break;
      case 'popular-movies':
        endpoint = '/movie/popular';
        forcedType = 'movie';
        break;
      case 'top-rated-movies':
        endpoint = '/movie/top_rated';
        forcedType = 'movie';
        break;
      case 'now-playing':
        endpoint = '/movie/now_playing';
        forcedType = 'movie';
        break;
      case 'popular-series':
        endpoint = '/tv/popular';
        forcedType = 'series';
        break;
      case 'top-rated-series':
        endpoint = '/tv/top_rated';
        forcedType = 'series';
        break;
    }
  }

  const data = await tmdbFetchJson<{ results?: TmdbSearchItem[] }>(
    endpoint,
    queryParams,
    config,
    params.signal,
  );

  return (data.results || [])
    .map((item) => mapSearchItemToCatalog(item, forcedType))
    .filter((item): item is CatalogSearchResult => Boolean(item))
    .slice(0, 20);
}

interface TmdbDetailResponse {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: Array<{ id: number; name: string }>;
  original_language?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  belongs_to_collection?: { id: number; name: string } | null;
  created_by?: Array<{ name: string }>;
  credits?: {
    cast?: Array<{ name: string }>;
    crew?: Array<{ name: string; job?: string }>;
  };
  external_ids?: {
    imdb_id?: string | null;
  };
  imdb_id?: string | null;
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates?: Array<{ certification?: string }>;
    }>;
  };
  content_ratings?: {
    results?: Array<{ iso_3166_1: string; rating?: string }>;
  };
  videos?: {
    results?: Array<{ site?: string; type?: string; key?: string; official?: boolean }>;
  };
  'watch/providers'?: {
    results?: Record<string, TmdbRegionProviders>;
  };
}

function extractCertification(data: TmdbDetailResponse, mediaType: MediaType, region: string): string | undefined {
  const upperRegion = region.toUpperCase() || 'US';
  if (mediaType === 'movie') {
    const entries = data.release_dates?.results || [];
    const regional = entries.find((r) => r.iso_3166_1 === upperRegion) || entries.find((r) => r.iso_3166_1 === 'US');
    const cert = regional?.release_dates?.find((rd) => rd.certification?.trim())?.certification?.trim();
    return cert || undefined;
  }
  const tvEntries = data.content_ratings?.results || [];
  const regionalTv = tvEntries.find((r) => r.iso_3166_1 === upperRegion) || tvEntries.find((r) => r.iso_3166_1 === 'US');
  return regionalTv?.rating?.trim() || undefined;
}

function extractTrailerUrl(data: TmdbDetailResponse): string | undefined {
  const videos = data.videos?.results || [];
  const youtube = videos.filter((v) => v.site === 'YouTube' && v.key);
  const preferred =
    youtube.find((v) => v.type === 'Trailer' && v.official) ||
    youtube.find((v) => v.type === 'Trailer') ||
    youtube[0];
  return preferred?.key ? `https://www.youtube.com/watch?v=${preferred.key}` : undefined;
}

export async function fetchTmdbDetails(
  tmdbId: number,
  mediaType: MediaType,
  region: string,
  config: ApiConfig,
  signal?: AbortSignal,
): Promise<CatalogSearchResult> {
  const path = mediaType === 'series' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  const data = await tmdbFetchJson<TmdbDetailResponse>(
    path,
    {
      append_to_response: 'credits,watch/providers,external_ids,release_dates,content_ratings,videos',
      language: 'en-US',
    },
    config,
    signal,
  );

  const title = (mediaType === 'series' ? data.name : data.title) || 'Untitled';
  const originalTitle =
    (mediaType === 'series' ? data.original_name : data.original_title) || undefined;
  const directorNames =
    mediaType === 'series'
      ? (data.created_by || []).map((c) => c.name).filter(Boolean)
      : (data.credits?.crew || [])
          .filter((c) => c.job === 'Director')
          .map((c) => c.name)
          .filter(Boolean);

  const director =
    directorNames.slice(0, 2).join(', ') ||
    (mediaType === 'series' ? 'TV Series' : 'Unknown Director');

  const runtimeMinutes =
    mediaType === 'series'
      ? data.episode_run_time?.[0] || 45
      : data.runtime || undefined;

  const franchise = data.belongs_to_collection?.name
    ? data.belongs_to_collection.name.replace(/\s+Collection$/i, '').trim()
    : undefined;

  return {
    key: `tmdb:${mediaType}:${data.id}`,
    mediaType,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : undefined,
    director,
    cast: (data.credits?.cast || []).slice(0, 5).map((a) => a.name).filter(Boolean),
    releaseYear: parseYear(mediaType === 'series' ? data.first_air_date : data.release_date),
    endYear: mediaType === 'series' ? parseYear(data.last_air_date) : undefined,
    runtimeMinutes,
    totalSeasons: data.number_of_seasons,
    totalEpisodes: data.number_of_episodes,
    certification: extractCertification(data, mediaType, region),
    genres: (data.genres || []).map((g) => g.name).filter(Boolean),
    language: isoLangToMovieLanguage(data.original_language),
    posterUrl: buildTmdbImageUrl(data.poster_path, 'w500'),
    backdropUrl: buildTmdbImageUrl(data.backdrop_path, 'w1280'),
    trailerUrl: extractTrailerUrl(data),
    synopsis: data.overview?.trim() || undefined,
    franchise,
    tmdbId: data.id,
    imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
    externalRatings:
      data.vote_average && data.vote_average > 0
        ? {
            tmdbScore: Number(data.vote_average.toFixed(1)),
            tmdbVotes: data.vote_count,
          }
        : undefined,
    watchProviders: parseWatchProvidersResponse(data['watch/providers']?.results, region),
    source: 'tmdb',
  };
}

export async function fetchWatchProvidersOnly(
  tmdbId: number,
  mediaType: MediaType,
  region: string,
  config: ApiConfig,
  signal?: AbortSignal,
): Promise<WatchProvidersSnapshot | undefined> {
  const path =
    mediaType === 'series'
      ? `/tv/${tmdbId}/watch/providers`
      : `/movie/${tmdbId}/watch/providers`;
  const data = await tmdbFetchJson<{ results?: Record<string, TmdbRegionProviders> }>(
    path,
    {},
    config,
    signal,
  );
  return parseWatchProvidersResponse(data.results, region);
}

export async function lookupTmdbByImdbId(
  imdbId: string,
  region: string,
  config: ApiConfig,
  signal?: AbortSignal,
): Promise<CatalogSearchResult | null> {
  const clean = imdbId.trim();
  if (!/^tt\d{5,}$/i.test(clean)) return null;
  const data = await tmdbFetchJson<{
    movie_results?: TmdbSearchItem[];
    tv_results?: TmdbSearchItem[];
  }>(`/find/${encodeURIComponent(clean)}`, { external_source: 'imdb_id' }, config, signal);

  const movieHit = data.movie_results?.[0];
  if (movieHit) {
    return fetchTmdbDetails(movieHit.id, 'movie', region, config, signal);
  }
  const tvHit = data.tv_results?.[0];
  if (tvHit) {
    return fetchTmdbDetails(tvHit.id, 'series', region, config, signal);
  }
  return null;
}

export async function testTmdbConnection(config: ApiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    await tmdbFetchJson<{ images?: unknown }>('/configuration', {}, config);
    return { ok: true, message: 'Connected to TMDB v3 API successfully.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'TMDB authentication failed.',
    };
  }
}
