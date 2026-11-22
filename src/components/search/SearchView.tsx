import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Film,
  Flame,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tv,
  X,
} from 'lucide-react';
import { hasTmdbCredentials } from '../../services/apiConfig';
import { enrichCatalogItem, searchCatalogCombined } from '../../services/fallbackCatalog';
import {
  TMDB_MOVIE_GENRES,
  TMDB_TV_GENRES,
  discoverTmdb,
  type TmdbDiscoverPreset,
} from '../../services/tmdb';
import { useLibrary } from '../../store/LibraryContext';
import type { CatalogSearchResult, MediaType } from '../../types/movie';
import { findMovieDuplicates } from '../../utils/duplicates';
import { formatRuntimeHuman } from '../../utils/progress';
import { MoviePoster } from '../common/MoviePoster';
import { StreamingBadges } from '../common/StreamingBadges';
import { ApiSettingsModal } from './ApiSettingsModal';

interface SearchViewProps {
  onOpenManualForm: (prefill?: CatalogSearchResult | null) => void;
  onSelectMovieId?: (movieId: string) => void;
}

const DISCOVER_PRESETS: Array<{ id: TmdbDiscoverPreset; label: string }> = [
  { id: 'trending', label: 'Trending This Week' },
  { id: 'popular-movies', label: 'Popular Movies' },
  { id: 'top-rated-movies', label: 'Top Rated Movies' },
  { id: 'now-playing', label: 'In Theaters' },
  { id: 'popular-series', label: 'Popular TV' },
  { id: 'top-rated-series', label: 'Top Rated TV' },
];

export const SearchView: React.FC<SearchViewProps> = ({
  onOpenManualForm,
  onSelectMovieId,
}) => {
  const {
    db,
    activeProfiles,
    activeProfileId,
    profileShelves,
    apiConfig,
    householdSettings,
    addMovie,
    addToast,
  } = useLibrary();

  const [query, setQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | MediaType>('all');
  const [yearFilter, setYearFilter] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Discover browse state
  const [discoverPreset, setDiscoverPreset] = useState<TmdbDiscoverPreset>('trending');
  const [discoverGenreId, setDiscoverGenreId] = useState<number | undefined>(undefined);
  const [discoverItems, setDiscoverItems] = useState<CatalogSearchResult[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);

  // Enrichment cache keyed by CatalogSearchResult.key
  const [enrichedMap, setEnrichedMap] = useState<Record<string, CatalogSearchResult>>({});
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const searchAbortRef = useRef<AbortController | null>(null);
  const tmdbReady = hasTmdbCredentials(apiConfig);
  const omdbReady = Boolean(apiConfig.omdbApiKey.trim());

  // Fetch TMDB Discover strip when query is empty
  useEffect(() => {
    if (!tmdbReady || query.trim() !== '') {
      return;
    }

    const controller = new AbortController();
    setLoadingDiscover(true);
    void discoverTmdb(
      {
        preset: discoverPreset,
        genreId: discoverGenreId,
        region: householdSettings.streamingRegion || 'US',
        signal: controller.signal,
      },
      apiConfig,
    )
      .then((items) => {
        if (!controller.signal.aborted) {
          setDiscoverItems(items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDiscoverItems([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingDiscover(false);
        }
      });

    return () => controller.abort();
  }, [
    tmdbReady,
    query,
    discoverPreset,
    discoverGenreId,
    householdSettings.streamingRegion,
    apiConfig,
  ]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const parsedYear = yearFilter.trim() ? Number(yearFilter.trim()) : undefined;
      const items = await searchCatalogCombined({
        query: clean,
        mediaType: mediaTypeFilter,
        year: parsedYear && Number.isFinite(parsedYear) ? parsedYear : undefined,
        region: householdSettings.streamingRegion || 'US',
        apiConfig,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setResults(items);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setSearchError(err instanceof Error ? err.message : 'Search failed.');
        setResults([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  };

  const ensureEnriched = async (item: CatalogSearchResult): Promise<CatalogSearchResult> => {
    const cached = enrichedMap[item.key];
    if (cached && (cached.watchProviders || !item.tmdbId)) {
      return cached;
    }
    setLoadingKey(item.key);
    try {
      const full = await enrichCatalogItem(
        item,
        householdSettings.streamingRegion || 'US',
        apiConfig,
      );
      setEnrichedMap((prev) => ({ ...prev, [item.key]: full }));
      return full;
    } finally {
      setLoadingKey((cur) => (cur === item.key ? null : cur));
    }
  };

  const handleToggleDetails = async (item: CatalogSearchResult) => {
    const nextOpen = !expandedKeys[item.key];
    setExpandedKeys((prev) => ({ ...prev, [item.key]: nextOpen }));
    if (nextOpen) {
      await ensureEnriched(item);
    }
  };

  const handleQuickAddWatchlist = async (item: CatalogSearchResult) => {
    const enriched = await ensureEnriched(item);
    const added = addMovie(
      {
        mediaType: enriched.mediaType,
        title: enriched.title,
        originalTitle: enriched.originalTitle,
        director: enriched.director,
        cast: enriched.cast,
        shelfIds: profileShelves[0] ? [profileShelves[0].id] : [],
        releaseYear: enriched.releaseYear,
        endYear: enriched.endYear,
        runtimeMinutes:
          enriched.runtimeMinutes ?? (enriched.mediaType === 'series' ? 45 : 110),
        totalSeasons: enriched.totalSeasons,
        totalEpisodes: enriched.totalEpisodes,
        certification: enriched.certification,
        genres: enriched.genres,
        language: enriched.language || 'English',
        posterUrl: enriched.posterUrl,
        backdropUrl: enriched.backdropUrl,
        trailerUrl: enriched.trailerUrl,
        franchise: enriched.franchise,
        tmdbId: enriched.tmdbId,
        imdbId: enriched.imdbId,
        tvmazeId: enriched.tvmazeId,
        externalRatings: enriched.externalRatings,
        watchProviders: enriched.watchProviders,
        ownership: 'streaming',
        status: 'want-to-watch',
        rating: 0,
        synopsis: enriched.synopsis,
        notes: '',
        tags: ['watchlist'],
      },
      false,
    );
    if (!added) {
      addToast({ title: 'Could not add title', tone: 'error' });
    }
  };

  const handleLogWatchedFromCatalog = async (item: CatalogSearchResult) => {
    const enriched = await ensureEnriched(item);
    onOpenManualForm(enriched);
  };

  const activeGenreDict = useMemo(() => {
    const isSeriesPreset =
      discoverPreset === 'popular-series' || discoverPreset === 'top-rated-series';
    return isSeriesPreset ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES;
  }, [discoverPreset]);

  const displayedItems = hasSearched && query.trim() ? results : discoverItems;

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Header + API Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            Discover &amp; Add Movies &amp; TV
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Search by title or IMDb ID (<code>tt...</code>), check streaming availability, or add manually.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#171A23] hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>API &amp; Streaming ({householdSettings.streamingRegion})</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenManualForm(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manually</span>
          </button>
        </div>
      </div>

      {/* Mode Banner */}
      <div
        className={`px-4 py-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
          tmdbReady
            ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          {tmdbReady ? (
            <span>
              <strong>TMDB v3 + JustWatch streaming</strong> active for{' '}
              <strong>{householdSettings.streamingRegion}</strong>
              {omdbReady ? ' · OMDb ratings enrichment enabled' : ''}
              {householdSettings.subscribedServices.length > 0
                ? ` · ${householdSettings.subscribedServices.length} subscribed service(s)`
                : ''}
            </span>
          ) : (
            <span>
              <strong>Zero-key catalog active</strong> (Apple iTunes for Movies + TVMaze for TV Series).
              Configure a free TMDB Read Token in Settings to unlock JustWatch streaming availability &amp; Trending discovery.
            </span>
          )}
        </div>
        {!tmdbReady && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
          >
            Configure TMDB
          </button>
        )}
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 shadow-sm space-y-3"
      >
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setHasSearched(false);
                  setResults([]);
                }
              }}
              placeholder="Search movie or TV series title, or IMDb ID (e.g. tt9362722)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setHasSearched(false);
                  setResults([]);
                  setSearchError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-stone-400 hover:text-stone-600"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={mediaTypeFilter}
            onChange={(e) => setMediaTypeFilter(e.target.value as 'all' | MediaType)}
            aria-label="Filter media type"
            className="px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-medium"
          >
            <option value="all">Movies &amp; TV</option>
            <option value="movie">Movies Only</option>
            <option value="series">TV Series Only</option>
          </select>

          <input
            type="number"
            min={1888}
            max={2100}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            placeholder="Year"
            aria-label="Release year filter"
            className="w-full sm:w-24 px-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
          />

          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm shrink-0"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </div>
      </form>

      {/* Discover Browse Controls (when query is empty and TMDB is configured) */}
      {!query.trim() && tmdbReady && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {DISCOVER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setDiscoverPreset(preset.id);
                    setDiscoverGenreId(undefined);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    discoverPreset === preset.id && !discoverGenreId
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white dark:bg-[#171A23] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {preset.id === 'trending' && <Flame className="w-3.5 h-3.5" />}
                  {preset.label}
                </button>
              ))}
            </div>

            <select
              value={discoverGenreId ?? ''}
              onChange={(e) =>
                setDiscoverGenreId(e.target.value ? Number(e.target.value) : undefined)
              }
              aria-label="Discover genre filter"
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 text-xs font-medium"
            >
              <option value="">All Genres</option>
              {Object.entries(activeGenreDict).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Errors */}
      {searchError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-700 dark:text-rose-300">
          {searchError}
        </div>
      )}

      {/* Results / Discover Grid */}
      {(searching || loadingDiscover) && displayedItems.length === 0 ? (
        <div className="py-14 text-center space-y-2 text-stone-500">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-rose-600" />
          <p className="text-sm font-medium">Searching catalog...</p>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white dark:bg-[#171A23] border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-3">
          <Film className="w-10 h-10 text-stone-400 mx-auto" />
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {hasSearched
              ? 'No matching movies or series found. Try another search or add manually.'
              : 'Type a movie or TV series title above to search.'}
          </p>
          <button
            type="button"
            onClick={() => onOpenManualForm(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add Title Manually
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedItems.map((rawItem) => {
            const item = enrichedMap[rawItem.key] || rawItem;
            const expanded = Boolean(expandedKeys[item.key]);
            const isLoadingThis = loadingKey === item.key;

            const dupCheck = findMovieDuplicates(
              {
                title: item.title,
                director: item.director,
                releaseYear: item.releaseYear,
                mediaType: item.mediaType,
                tmdbId: item.tmdbId,
                imdbId: item.imdbId,
              },
              db.movies,
              activeProfiles,
              activeProfileId,
            );

            const ownMatch = dupCheck.ownMatches[0];

            return (
              <div
                key={item.key}
                className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 shadow-sm flex flex-col gap-3"
              >
                <div className="flex gap-3.5">
                  <MoviePoster
                    title={item.title}
                    director={item.director}
                    posterUrl={item.posterUrl}
                    size="md"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            item.mediaType === 'series'
                              ? 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                          }`}
                        >
                          {item.mediaType === 'series' ? (
                            <Tv className="w-2.5 h-2.5" />
                          ) : (
                            <Film className="w-2.5 h-2.5" />
                          )}
                          {item.mediaType === 'series' ? 'TV Series' : 'Movie'}
                        </span>

                        {item.releaseYear && (
                          <span className="text-[11px] font-medium text-stone-500">
                            {item.releaseYear}
                          </span>
                        )}

                        {item.externalRatings?.tmdbScore && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                            ★ {item.externalRatings.tmdbScore.toFixed(1)}
                          </span>
                        )}

                        <span className="text-[10px] uppercase font-semibold text-stone-400 ml-auto">
                          {item.source}
                        </span>
                      </div>

                      <h3 className="font-serif-display text-base font-bold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {item.director}
                        {item.runtimeMinutes ? ` · ${formatRuntimeHuman(item.runtimeMinutes)}` : ''}
                      </p>

                      {item.genres.length > 0 && (
                        <p className="text-[11px] text-stone-400 truncate mt-1">
                          {item.genres.slice(0, 3).join(' · ')}
                        </p>
                      )}

                      {/* Duplicate Indicators */}
                      {(ownMatch || dupCheck.householdMatches.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ownMatch && (
                            <button
                              type="button"
                              onClick={() => onSelectMovieId?.(ownMatch.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 text-[10px] font-semibold"
                            >
                              <Check className="w-3 h-3" /> In Your Library
                            </button>
                          )}
                          {dupCheck.householdMatches.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                              In{' '}
                              {dupCheck.householdMatches
                                .map((m) => `${m.ownerEmoji} ${m.ownerName}`)
                                .join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {item.watchProviders && (
                      <div className="mt-2">
                        <StreamingBadges
                          providers={item.watchProviders}
                          subscribedServices={householdSettings.subscribedServices}
                          compact
                          maxItems={3}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {item.synopsis && (
                  <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2">
                    {item.synopsis}
                  </p>
                )}

                {/* Expanded Where to Watch & Credits */}
                {expanded && (
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800 space-y-2 text-xs">
                    {isLoadingThis ? (
                      <div className="flex items-center gap-2 text-stone-500 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading streaming availability &amp; cast...
                      </div>
                    ) : (
                      <>
                        {item.cast.length > 0 && (
                          <p className="text-stone-600 dark:text-stone-300">
                            <strong>Cast:</strong> {item.cast.join(', ')}
                          </p>
                        )}
                        {item.certification && (
                          <p className="text-stone-500">
                            <strong>Rated:</strong> {item.certification}
                            {item.totalSeasons ? ` · ${item.totalSeasons} Season(s)` : ''}
                            {item.totalEpisodes ? ` · ${item.totalEpisodes} Episodes` : ''}
                          </p>
                        )}
                        {item.externalRatings &&
                          (item.externalRatings.imdbRating ||
                            item.externalRatings.rottenTomatoes ||
                            item.externalRatings.metascore) && (
                            <p className="flex flex-wrap items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              {item.externalRatings.imdbRating && (
                                <span>IMDb {item.externalRatings.imdbRating}</span>
                              )}
                              {item.externalRatings.rottenTomatoes && (
                                <span>🍅 {item.externalRatings.rottenTomatoes}</span>
                              )}
                              {item.externalRatings.metascore && (
                                <span>MC {item.externalRatings.metascore}</span>
                              )}
                            </p>
                          )}
                        {item.watchProviders ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Streaming ({item.watchProviders.region}):
                            </p>
                            {item.watchProviders.stream.length > 0 ||
                            item.watchProviders.free.length > 0 ? (
                              <StreamingBadges
                                providers={item.watchProviders}
                                subscribedServices={householdSettings.subscribedServices}
                                compact={false}
                                maxItems={6}
                              />
                            ) : (
                              <p className="text-stone-500">
                                {item.watchProviders.rent.length > 0
                                  ? `Rent on: ${item.watchProviders.rent
                                      .slice(0, 4)
                                      .map((r) => r.providerName)
                                      .join(', ')}`
                                  : 'No subscription stream currently listed for your region.'}
                              </p>
                            )}
                            {item.watchProviders.link && (
                              <a
                                href={item.watchProviders.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                              >
                                JustWatch Options <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-stone-400">
                            {tmdbReady
                              ? 'No streaming data returned for this region.'
                              : 'Configure a free TMDB Read Access Token in Settings to see live streaming services.'}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => void handleToggleDetails(item)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-rose-600"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Hide Where to Watch
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" /> Where to Watch &amp; Cast
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={Boolean(ownMatch) || isLoadingThis}
                      onClick={() => void handleQuickAddWatchlist(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-40 text-xs font-semibold text-stone-800 dark:text-stone-200"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {ownMatch ? 'Added' : 'Want to Watch'}
                    </button>

                    <button
                      type="button"
                      disabled={isLoadingThis}
                      onClick={() => void handleLogWatchedFromCatalog(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Log Watched
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ApiSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};
