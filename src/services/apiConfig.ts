import type { ApiConfig } from '../types/movie';

export const API_CONFIG_STORAGE_KEY = 'movielibrary_api_config';

export function getDefaultApiConfig(): ApiConfig {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  return {
    tmdbReadToken: (env?.VITE_TMDB_READ_TOKEN || '').trim(),
    tmdbApiKey: (env?.VITE_TMDB_API_KEY || '').trim(),
    omdbApiKey: (env?.VITE_OMDB_API_KEY || '').trim(),
  };
}

export function loadApiConfig(): ApiConfig {
  const defaults = getDefaultApiConfig();
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(API_CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ApiConfig>;
    return {
      tmdbReadToken: parsed.tmdbReadToken?.trim() || defaults.tmdbReadToken,
      tmdbApiKey: parsed.tmdbApiKey?.trim() || defaults.tmdbApiKey,
      omdbApiKey: parsed.omdbApiKey?.trim() || defaults.omdbApiKey,
    };
  } catch {
    return defaults;
  }
}

export function saveApiConfig(config: ApiConfig): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      API_CONFIG_STORAGE_KEY,
      JSON.stringify({
        tmdbReadToken: config.tmdbReadToken.trim(),
        tmdbApiKey: config.tmdbApiKey.trim(),
        omdbApiKey: config.omdbApiKey.trim(),
      }),
    );
  } catch {
    // ignore storage failures
  }
}

export function hasTmdbCredentials(config: ApiConfig): boolean {
  return Boolean(config.tmdbReadToken.trim() || config.tmdbApiKey.trim());
}
