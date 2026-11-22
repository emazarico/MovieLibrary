import type { CatalogSearchResult, ExternalRatings, MediaType } from '../types/movie';
import { sanitizePosterUrl } from '../utils/poster';

const OMDB_BASE = 'https://www.omdbapi.com/';

interface OmdbMovieResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
  Metascore?: string;
  imdbRating?: string;
  imdbID?: string;
  Type?: 'movie' | 'series' | 'episode';
  totalSeasons?: string;
}

interface OmdbSearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: 'movie' | 'series' | 'episode';
  Poster: string;
}

function cleanField(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  return !trimmed || trimmed.toUpperCase() === 'N/A' ? undefined : trimmed;
}

function parseRuntimeMins(raw?: string): number | undefined {
  const clean = cleanField(raw);
  if (!clean) return undefined;
  const m = /(\d+)/.exec(clean);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseYearRange(raw?: string): { start?: number; end?: number } {
  const clean = cleanField(raw);
  if (!clean) return {};
  const match = /^(\d{4})(?:[–-](\d{4}))?/.exec(clean);
  if (!match) return {};
  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : undefined,
  };
}

export function extractOmdbRatings(data: OmdbMovieResponse): ExternalRatings {
  const rt = data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value;
  return {
    imdbRating: cleanField(data.imdbRating),
    rottenTomatoes: cleanField(rt),
    metascore: cleanField(data.Metascore),
    awards: cleanField(data.Awards),
  };
}

export async function fetchOmdbByImdbId(
  imdbId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ ratings: ExternalRatings; item: CatalogSearchResult | null } | null> {
  const cleanKey = apiKey.trim();
  const cleanId = imdbId.trim();
  if (!cleanKey || !cleanId) return null;

  const url = `${OMDB_BASE}?i=${encodeURIComponent(cleanId)}&plot=short&apikey=${encodeURIComponent(cleanKey)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as OmdbMovieResponse;
  if (data.Response !== 'True' || !data.Title) return null;

  const ratings = extractOmdbRatings(data);
  const mediaType: MediaType = data.Type === 'series' ? 'series' : 'movie';
  const years = parseYearRange(data.Year);

  const item: CatalogSearchResult = {
    key: `omdb:${data.imdbID || data.Title}`,
    mediaType,
    title: data.Title,
    director:
      cleanField(data.Director) ||
      cleanField(data.Writer) ||
      (mediaType === 'series' ? 'TV Series' : 'Unknown Director'),
    cast: (cleanField(data.Actors) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5),
    releaseYear: years.start,
    endYear: years.end,
    runtimeMinutes: parseRuntimeMins(data.Runtime),
    totalSeasons: cleanField(data.totalSeasons) ? Number(data.totalSeasons) : undefined,
    certification: cleanField(data.Rated),
    genres: (cleanField(data.Genre) || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    language: (cleanField(data.Language) || 'English').split(',')[0].trim(),
    posterUrl: sanitizePosterUrl(data.Poster),
    synopsis: cleanField(data.Plot),
    imdbId: cleanField(data.imdbID),
    externalRatings: ratings,
    source: 'omdb',
  };

  return { ratings, item };
}

export async function searchOmdb(
  query: string,
  apiKey: string,
  mediaType: 'all' | MediaType = 'all',
  year?: number,
  signal?: AbortSignal,
): Promise<CatalogSearchResult[]> {
  const cleanKey = apiKey.trim();
  const cleanQuery = query.trim();
  if (!cleanKey || !cleanQuery) return [];

  const params = new URLSearchParams({
    s: cleanQuery,
    apikey: cleanKey,
  });
  if (mediaType === 'movie') params.set('type', 'movie');
  if (mediaType === 'series') params.set('type', 'series');
  if (year) params.set('y', String(year));

  const res = await fetch(`${OMDB_BASE}?${params.toString()}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    Response: 'True' | 'False';
    Search?: OmdbSearchItem[];
  };
  if (data.Response !== 'True' || !Array.isArray(data.Search)) return [];

  return data.Search.slice(0, 10).map((hit) => {
    const years = parseYearRange(hit.Year);
    const type: MediaType = hit.Type === 'series' ? 'series' : 'movie';
    return {
      key: `omdb:${hit.imdbID}`,
      mediaType: type,
      title: hit.Title,
      director: type === 'series' ? 'TV Series' : 'Unknown Director',
      cast: [],
      releaseYear: years.start,
      endYear: years.end,
      genres: [],
      posterUrl: sanitizePosterUrl(hit.Poster),
      imdbId: hit.imdbID,
      source: 'omdb',
    };
  });
}
