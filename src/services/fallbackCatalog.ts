import type { ApiConfig, CatalogSearchResult, MediaType } from '../types/movie';
import { sanitizePosterUrl } from '../utils/poster';
import { hasTmdbCredentials } from './apiConfig';
import { fetchOmdbByImdbId, searchOmdb } from './omdb';
import { fetchTmdbDetails, lookupTmdbByImdbId, searchTmdb } from './tmdb';

interface ItunesMovieItem {
  trackId: number;
  trackName?: string;
  artistName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
  artworkUrl100?: string;
  longDescription?: string;
  shortDescription?: string;
  contentAdvisoryRating?: string;
}

interface TvMazeSearchEntry {
  show: {
    id: number;
    name: string;
    language?: string;
    genres?: string[];
    premiered?: string;
    ended?: string | null;
    averageRuntime?: number | null;
    runtime?: number | null;
    rating?: { average?: number | null };
    externals?: { imdb?: string | null };
    image?: { medium?: string; original?: string } | null;
    summary?: string | null;
    network?: { name?: string } | null;
    webChannel?: { name?: string } | null;
  };
}

function stripHtmlTags(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const clean = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

function parseYear(dateStr?: string | null): number | undefined {
  if (!dateStr) return undefined;
  const m = /^(\d{4})/.exec(dateStr);
  return m ? Number(m[1]) : undefined;
}

/**
 * Zero-key fallback movie search via Apple iTunes Search API.
 */
export async function searchItunesMovies(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=movie&entity=movie&limit=12`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: ItunesMovieItem[] };
  return (data.results || [])
    .filter((item) => item.trackName)
    .map((item) => ({
      key: `itunes:movie:${item.trackId}`,
      mediaType: 'movie' as const,
      title: item.trackName!,
      director: item.artistName?.trim() || 'Unknown Director',
      cast: [],
      releaseYear: parseYear(item.releaseDate),
      runtimeMinutes: item.trackTimeMillis
        ? Math.max(1, Math.round(item.trackTimeMillis / 60000))
        : undefined,
      certification: item.contentAdvisoryRating || undefined,
      genres: item.primaryGenreName ? [item.primaryGenreName] : [],
      language: 'English',
      posterUrl: sanitizePosterUrl(
        item.artworkUrl100?.replace('100x100bb', '600x900bb') || item.artworkUrl100,
      ),
      synopsis: item.longDescription || item.shortDescription || undefined,
      source: 'itunes' as const,
    }));
}

/**
 * Zero-key fallback TV series search via TVMaze API.
 */
export async function searchTvMazeShows(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as TvMazeSearchEntry[];

  return (data || []).slice(0, 12).map(({ show }) => {
    const channel = show.webChannel?.name || show.network?.name;
    return {
      key: `tvmaze:series:${show.id}`,
      mediaType: 'series' as const,
      title: show.name,
      director: channel ? `${channel} Series` : 'TV Series',
      cast: [],
      releaseYear: parseYear(show.premiered),
      endYear: parseYear(show.ended),
      runtimeMinutes: show.averageRuntime || show.runtime || 45,
      genres: Array.isArray(show.genres) ? show.genres : [],
      language: show.language || 'English',
      posterUrl: sanitizePosterUrl(show.image?.original || show.image?.medium),
      synopsis: stripHtmlTags(show.summary),
      imdbId: show.externals?.imdb || undefined,
      tvmazeId: show.id,
      externalRatings:
        show.rating?.average && show.rating.average > 0
          ? { tmdbScore: Number(show.rating.average.toFixed(1)) }
          : undefined,
      source: 'tvmaze' as const,
    };
  });
}

/**
 * Unified catalog search orchestrator:
 * - Recognizes IMDb IDs (`tt1234567`) directly via TMDB /find or OMDb.
 * - Uses TMDB v3 primary when credentials exist.
 * - Falls back gracefully to OMDb, or zero-key iTunes + TVMaze if no API keys are configured.
 */
export async function searchCatalogCombined(params: {
  query: string;
  mediaType?: 'all' | MediaType;
  year?: number;
  region?: string;
  apiConfig: ApiConfig;
  signal?: AbortSignal;
}): Promise<CatalogSearchResult[]> {
  const q = params.query.trim();
  if (!q) return [];
  const mediaType = params.mediaType || 'all';
  const region = params.region || 'US';
  const hasTmdb = hasTmdbCredentials(params.apiConfig);
  const hasOmdb = Boolean(params.apiConfig.omdbApiKey.trim());

  // Direct IMDb tt-id lookup
  if (/^tt\d{5,}$/i.test(q)) {
    if (hasTmdb) {
      const hit = await lookupTmdbByImdbId(q, region, params.apiConfig, params.signal);
      if (hit) {
        if (hasOmdb && hit.imdbId) {
          const omdb = await fetchOmdbByImdbId(hit.imdbId, params.apiConfig.omdbApiKey, params.signal).catch(
            () => null,
          );
          if (omdb) {
            return [
              {
                ...hit,
                externalRatings: { ...hit.externalRatings, ...omdb.ratings },
                source: 'merged',
              },
            ];
          }
        }
        return [hit];
      }
    }
    if (hasOmdb) {
      const omdbHit = await fetchOmdbByImdbId(q, params.apiConfig.omdbApiKey, params.signal);
      if (omdbHit?.item) return [omdbHit.item];
    }
    return [];
  }

  if (hasTmdb) {
    return searchTmdb(
      {
        query: q,
        mediaType,
        year: params.year,
        signal: params.signal,
      },
      params.apiConfig,
    );
  }

  if (hasOmdb) {
    const omdbResults = await searchOmdb(
      q,
      params.apiConfig.omdbApiKey,
      mediaType,
      params.year,
      params.signal,
    );
    if (omdbResults.length > 0) return omdbResults;
  }

  // Zero-key fallback (Apple iTunes for Movies + TVMaze for TV Series)
  const [movieHits, tvHits] = await Promise.all([
    mediaType === 'series'
      ? Promise.resolve([])
      : searchItunesMovies(q, params.signal).catch(() => []),
    mediaType === 'movie'
      ? Promise.resolve([])
      : searchTvMazeShows(q, params.signal).catch(() => []),
  ]);

  let combined = [...movieHits, ...tvHits];
  if (params.year) {
    combined = combined.filter((item) => !item.releaseYear || item.releaseYear === params.year);
  }
  return combined.slice(0, 24);
}

/**
 * Fetches rich details (director, cast, runtime, seasons, JustWatch streaming providers, OMDb ratings)
 * for a search result prior to previewing or adding.
 */
export async function enrichCatalogItem(
  item: CatalogSearchResult,
  region: string,
  apiConfig: ApiConfig,
  signal?: AbortSignal,
): Promise<CatalogSearchResult> {
  let enriched = item;

  if (item.tmdbId && hasTmdbCredentials(apiConfig)) {
    try {
      const full = await fetchTmdbDetails(
        item.tmdbId,
        item.mediaType,
        region,
        apiConfig,
        signal,
      );
      enriched = {
        ...item,
        ...full,
        cast: full.cast.length > 0 ? full.cast : item.cast,
        genres: full.genres.length > 0 ? full.genres : item.genres,
        posterUrl: full.posterUrl || item.posterUrl,
        backdropUrl: full.backdropUrl || item.backdropUrl,
        synopsis: full.synopsis || item.synopsis,
      };
    } catch {
      // Keep original metadata if detail fetch fails
    }
  }

  if (apiConfig.omdbApiKey.trim() && enriched.imdbId) {
    try {
      const omdb = await fetchOmdbByImdbId(enriched.imdbId, apiConfig.omdbApiKey, signal);
      if (omdb) {
        enriched = {
          ...enriched,
          certification: enriched.certification || omdb.item?.certification,
          director:
            enriched.director === 'Unknown Director' && omdb.item?.director
              ? omdb.item.director
              : enriched.director,
          externalRatings: {
            ...enriched.externalRatings,
            ...omdb.ratings,
          },
          source: enriched.source === 'tmdb' ? 'merged' : enriched.source,
        };
      }
    } catch {
      // Ignore OMDb enrichment failures
    }
  }

  return enriched;
}
