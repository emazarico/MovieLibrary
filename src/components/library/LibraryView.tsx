import React, { useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Film,
  Gift,
  LayoutGrid,
  List,
  Plus,
  Printer,
  Search,
  Sparkles,
  Tv,
  Upload,
  Users,
} from 'lucide-react';
import { inspectImportFile, type ImportPreview } from '../../services/importExport';
import { useLibrary } from '../../store/LibraryContext';
import type {
  MediaType,
  MovieItem,
  MovieOwnership,
  WatchStatus,
} from '../../types/movie';
import { getMovieProgressInfo } from '../../utils/progress';
import {
  MOVIE_LANGUAGES,
  OWNERSHIP_META,
  POPULAR_STREAMING_SERVICES,
  matchesSubscribedService,
} from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { ImportPreviewModal } from '../management/ImportPreviewModal';
import { FamilyWatchlistModal } from './FamilyWatchlistModal';
import { MovieCard } from './MovieCard';
import { MovieDetailDrawer } from './MovieDetailDrawer';
import { MovieListRow } from './MovieListRow';

interface LibraryViewProps {
  selectedMovieId: string | null;
  onSelectMovie: (movie: MovieItem | null) => void;
  onQuickLog: (movie: MovieItem, markWatched?: boolean) => void;
  onOpenForm: (movie?: MovieItem | null) => void;
  onOpenSearch: () => void;
  onOpenPdfExport: () => void;
}

type StatusTab =
  | 'all'
  | WatchStatus
  | 'family-nights'
  | 'reviews';

type SortOption =
  | 'updated'
  | 'date-watched'
  | 'rating'
  | 'tmdb-rating'
  | 'title'
  | 'director'
  | 'year'
  | 'runtime';

type GroupMode = 'none' | 'shelf' | 'franchise';

export const LibraryView: React.FC<LibraryViewProps> = ({
  selectedMovieId,
  onSelectMovie,
  onQuickLog,
  onOpenForm,
  onOpenSearch,
  onOpenPdfExport,
}) => {
  const {
    db,
    activeProfile,
    activeProfiles,
    activeProfileId,
    profileMovies,
    profileShelves,
    householdSettings,
    logWatchSession,
    addToast,
  } = useLibrary();

  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | MediaType>('all');
  const [shelfFilter, setShelfFilter] = useState<string>('all');
  const [streamingFilter, setStreamingFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
  const [familyWatchlistOpen, setFamilyWatchlistOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  const selectedMovie = useMemo(
    () => profileMovies.find((m) => m.id === selectedMovieId) || null,
    [profileMovies, selectedMovieId],
  );

  const currentlyWatching = useMemo(
    () =>
      profileMovies
        .filter((m) => m.status === 'watching')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [profileMovies],
  );

  const counts = useMemo(() => {
    const familyNights = profileMovies.filter(
      (m) =>
        (m.watchedWithProfileIds && m.watchedWithProfileIds.length > 0) ||
        Boolean(m.watchedWithGuests?.trim()),
    ).length;
    const reviews = profileMovies.filter((m) => Boolean(m.review?.trim())).length;
    return {
      all: profileMovies.length,
      watching: profileMovies.filter((m) => m.status === 'watching').length,
      watched: profileMovies.filter((m) => m.status === 'watched').length,
      'want-to-watch': profileMovies.filter((m) => m.status === 'want-to-watch').length,
      dropped: profileMovies.filter((m) => m.status === 'dropped').length,
      'family-nights': familyNights,
      reviews,
    };
  }, [profileMovies]);

  const availableLanguages = useMemo(() => {
    const set = new Set<string>(MOVIE_LANGUAGES);
    for (const m of profileMovies) {
      if (m.language?.trim()) set.add(m.language.trim());
    }
    return Array.from(set);
  }, [profileMovies]);

  const availableProviders = useMemo(() => {
    const set = new Set<string>(POPULAR_STREAMING_SERVICES);
    for (const m of profileMovies) {
      for (const p of m.watchProviders?.stream || []) set.add(p.providerName);
      for (const p of m.watchProviders?.free || []) set.add(p.providerName);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [profileMovies]);

  const filteredMovies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = profileMovies.filter((m) => {
      if (statusTab === 'family-nights') {
        const isCo =
          (m.watchedWithProfileIds && m.watchedWithProfileIds.length > 0) ||
          Boolean(m.watchedWithGuests?.trim());
        if (!isCo) return false;
      } else if (statusTab === 'reviews') {
        if (!m.review?.trim()) return false;
      } else if (statusTab !== 'all' && m.status !== statusTab) {
        return false;
      }

      if (mediaTypeFilter !== 'all' && m.mediaType !== mediaTypeFilter) return false;

      if (shelfFilter === '__unsorted__') {
        if (m.shelfIds.length > 0) return false;
      } else if (shelfFilter !== 'all' && !m.shelfIds.includes(shelfFilter)) {
        return false;
      }

      if (streamingFilter === '__subscribed__') {
        const providers = [
          ...(m.watchProviders?.stream || []),
          ...(m.watchProviders?.free || []),
        ];
        const ok =
          providers.some((p) =>
            matchesSubscribedService(p.providerName, householdSettings.subscribedServices),
          ) || (m.watchProviders?.free.length ?? 0) > 0;
        if (!ok) return false;
      } else if (streamingFilter === '__free__') {
        if ((m.watchProviders?.free.length ?? 0) === 0) return false;
      } else if (streamingFilter !== 'all') {
        const providers = [
          ...(m.watchProviders?.stream || []),
          ...(m.watchProviders?.free || []),
        ];
        const ok = providers.some(
          (p) =>
            p.providerName.toLowerCase() === streamingFilter.toLowerCase() ||
            matchesSubscribedService(p.providerName, [streamingFilter]),
        );
        if (!ok) return false;
      }

      if (languageFilter !== 'all' && (m.language || 'English') !== languageFilter) {
        return false;
      }

      if (ownershipFilter === '__lent__') {
        if (!m.lentTo?.trim()) return false;
      } else if (ownershipFilter !== 'all' && m.ownership !== (ownershipFilter as MovieOwnership)) {
        return false;
      }

      if (q) {
        const hay = [
          m.title,
          m.originalTitle || '',
          m.director,
          ...(m.cast || []),
          m.franchise || '',
          ...m.genres,
          ...m.tags,
          m.serviceName || '',
          m.notes,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'date-watched':
          return (b.dateWatched || b.updatedAt).localeCompare(a.dateWatched || a.updatedAt);
        case 'rating':
          return b.rating - a.rating || b.updatedAt.localeCompare(a.updatedAt);
        case 'tmdb-rating':
          return (
            (b.externalRatings?.tmdbScore ?? 0) - (a.externalRatings?.tmdbScore ?? 0) ||
            a.title.localeCompare(b.title)
          );
        case 'title':
          return a.title.localeCompare(b.title);
        case 'director':
          return a.director.localeCompare(b.director) || a.title.localeCompare(b.title);
        case 'year':
          return (b.releaseYear ?? 0) - (a.releaseYear ?? 0) || a.title.localeCompare(b.title);
        case 'runtime':
          return (b.runtimeMinutes || 0) - (a.runtimeMinutes || 0);
        case 'updated':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

    return list;
  }, [
    profileMovies,
    statusTab,
    mediaTypeFilter,
    shelfFilter,
    streamingFilter,
    householdSettings.subscribedServices,
    languageFilter,
    ownershipFilter,
    searchQuery,
    sortBy,
  ]);

  const groupedSections = useMemo(() => {
    if (groupMode === 'none') {
      return [{ id: 'all', title: '', movies: filteredMovies }];
    }

    if (groupMode === 'shelf') {
      const sections = profileShelves.map((shelf) => ({
        id: shelf.id,
        title: shelf.name,
        movies: filteredMovies.filter((m) => m.shelfIds.includes(shelf.id)),
      }));
      const unsorted = filteredMovies.filter((m) => m.shelfIds.length === 0);
      if (unsorted.length > 0) {
        sections.push({ id: '__unsorted__', title: 'Unassigned', movies: unsorted });
      }
      return sections.filter((s) => s.movies.length > 0);
    }

    const franchiseMap = new Map<string, MovieItem[]>();
    const standalone: MovieItem[] = [];
    for (const m of filteredMovies) {
      const f = m.franchise?.trim();
      if (f) {
        const list = franchiseMap.get(f) || [];
        list.push(m);
        franchiseMap.set(f, list);
      } else {
        standalone.push(m);
      }
    }

    const out = Array.from(franchiseMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => ({
        id: `fr-${name}`,
        title: name,
        movies: [...items].sort(
          (a, b) => (a.franchiseIndex ?? 999) - (b.franchiseIndex ?? 999),
        ),
      }));

    if (standalone.length > 0) {
      out.push({ id: 'fr-standalone', title: 'Standalone Titles', movies: standalone });
    }
    return out;
  }, [groupMode, filteredMovies, profileShelves]);

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const preview = inspectImportFile(file.name, text, db, activeProfileId);
      if (preview.format === 'unknown') {
        addToast({
          title: 'Unsupported import file',
          description:
            preview.warnings[0] ||
            'Expected MovieLibrary JSON, Letterboxd CSV, IMDb CSV, or CinemaTrack CSV/JSON.',
          tone: 'error',
        });
        return;
      }
      setImportPreview(preview);
    } catch (err) {
      addToast({
        title: 'Import inspection failed',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      });
    }
  };

  const renderMovieCollection = (items: MovieItem[]) => {
    if (layoutMode === 'list') {
      return (
        <div className="space-y-2.5">
          {items.map((movie) => (
            <MovieListRow
              key={movie.id}
              movie={movie}
              onSelect={(m) => onSelectMovie(m)}
              onQuickLog={(m) => onQuickLog(m)}
              onEdit={(m) => onOpenForm(m)}
              profiles={activeProfiles}
              subscribedServices={householdSettings.subscribedServices}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            onSelect={(m) => onSelectMovie(m)}
            onQuickLog={(m) => onQuickLog(m)}
            profiles={activeProfiles}
            subscribedServices={householdSettings.subscribedServices}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Page Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>{activeProfile?.avatarEmoji}</span>
            <span>{activeProfile?.name}&apos;s Cinema Library</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {counts.all} title(s) · {counts.watched} watched · {counts.watching} currently watching
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFamilyWatchlistOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold border border-amber-500/25 transition-colors"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Family Watchlist</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept=".json,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            type="button"
            onClick={onOpenPdfExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenForm(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] hover:bg-stone-50 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manually</span>
          </button>

          <button
            type="button"
            onClick={onOpenSearch}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Discover &amp; Add</span>
          </button>
        </div>
      </div>

      {/* Currently Watching Spotlight Strip */}
      {currentlyWatching.length > 0 && statusTab === 'all' && !searchQuery && (
        <section className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-rose-500/10 via-amber-500/6 to-white dark:to-[#171A23] border border-rose-300/60 dark:border-rose-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif-display text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Currently Watching ({currentlyWatching.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentlyWatching.slice(0, 3).map((movie) => {
              const prog = getMovieProgressInfo(movie);
              return (
                <div
                  key={movie.id}
                  onClick={() => onSelectMovie(movie)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMovie(movie);
                    }
                  }}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/95 dark:bg-[#171A23]/95 border border-stone-200/80 dark:border-stone-800 hover:border-rose-400 transition-all cursor-pointer shadow-sm"
                >
                  <MoviePoster
                    title={movie.title}
                    director={movie.director}
                    posterUrl={movie.posterUrl}
                    size="sm"
                    interactive={false}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {movie.mediaType === 'series' ? 'TV Series' : 'Movie'}
                      </span>
                      {movie.serviceName && (
                        <span className="text-[10px] text-stone-400 truncate">
                          · {movie.serviceName}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif-display text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {movie.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                      {prog.label}
                    </p>
                    {prog.percent !== null && (
                      <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden mt-1.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500"
                          style={{ width: `${prog.percent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 shrink-0">
                    {movie.mediaType === 'series' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          logWatchSession({
                            movieId: movie.id,
                            date: new Date().toISOString().split('T')[0],
                            minutesWatched: movie.runtimeMinutes || 45,
                            episodesCount: 1,
                            seasonNumber: movie.currentSeason ?? 1,
                            episodeNumber: (movie.currentEpisode ?? 0) + 1,
                            medium: movie.medium || 'streaming',
                            serviceName: movie.serviceName,
                            coWatcherProfileIds: movie.watchedWithProfileIds,
                            watchedWithGuests: movie.watchedWithGuests,
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                        title="Log +1 episode"
                      >
                        +1 Ep
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickLog(movie, true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-semibold"
                    >
                      Log
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {(
          [
            { id: 'all', label: `All (${counts.all})` },
            { id: 'watching', label: `Watching (${counts.watching})` },
            { id: 'watched', label: `Watched (${counts.watched})` },
            { id: 'want-to-watch', label: `Want to Watch (${counts['want-to-watch']})` },
            { id: 'family-nights', label: `Family Nights (${counts['family-nights']})`, icon: Users },
            { id: 'reviews', label: `Reviews (${counts.reviews})` },
            { id: 'dropped', label: `Dropped (${counts.dropped})` },
          ] as Array<{ id: StatusTab; label: string; icon?: React.ComponentType<{ className?: string }> }>
        ).map((tab) => {
          const active = statusTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                active
                  ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : 'bg-white dark:bg-[#171A23] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:border-stone-300'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters, Grouping & Sort Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, director, cast, genre, franchise, or tag..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Media Type Pills */}
            <div className="inline-flex rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'movie', label: 'Movies', icon: Film },
                  { id: 'series', label: 'Series', icon: Tv },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMediaTypeFilter(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    mediaTypeFilter === item.id
                      ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-500'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Grouping */}
            <select
              value={groupMode}
              onChange={(e) => setGroupMode(e.target.value as GroupMode)}
              aria-label="Group titles"
              className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium"
            >
              <option value="none">Flat View</option>
              <option value="shelf">By List</option>
              <option value="franchise">By Franchise</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort titles"
              className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium"
            >
              <option value="updated">Sort: Recently Updated</option>
              <option value="date-watched">Sort: Date Watched</option>
              <option value="rating">Sort: Your Rating</option>
              <option value="tmdb-rating">Sort: TMDB Rating</option>
              <option value="title">Sort: Title (A–Z)</option>
              <option value="director">Sort: Director / Creator</option>
              <option value="year">Sort: Release Year</option>
              <option value="runtime">Sort: Runtime</option>
            </select>

            {/* Grid / List */}
            <div className="inline-flex rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`p-1.5 rounded-lg ${
                  layoutMode === 'grid'
                    ? 'bg-white dark:bg-stone-800 text-rose-600 shadow-xs'
                    : 'text-stone-400'
                }`}
                aria-label="Grid layout"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('list')}
                className={`p-1.5 rounded-lg ${
                  layoutMode === 'list'
                    ? 'bg-white dark:bg-stone-800 text-rose-600 shadow-xs'
                    : 'text-stone-400'
                }`}
                aria-label="List layout"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Facet Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={shelfFilter}
            onChange={(e) => setShelfFilter(e.target.value)}
            aria-label="Filter by list"
            className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <option value="all">All Lists</option>
            {profileShelves.map((s) => (
              <option key={s.id} value={s.id}>
                List: {s.name}
              </option>
            ))}
            <option value="__unsorted__">Unassigned</option>
          </select>

          <select
            value={streamingFilter}
            onChange={(e) => setStreamingFilter(e.target.value)}
            aria-label="Filter by streaming service"
            className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <option value="all">Streaming: Any</option>
            {householdSettings.subscribedServices.length > 0 && (
              <option value="__subscribed__">On My Subscriptions</option>
            )}
            <option value="__free__">Free / Ad-Supported</option>
            {availableProviders.map((prov) => (
              <option key={prov} value={prov}>
                Stream: {prov}
              </option>
            ))}
          </select>

          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            aria-label="Filter by language"
            className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <option value="all">All Languages</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            aria-label="Filter by ownership"
            className="px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <option value="all">All Copies</option>
            {Object.entries(OWNERSHIP_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
            <option value="__lent__">Lent Out Discs</option>
          </select>
        </div>
      </div>

      {/* Movie Grid / List or Empty State */}
      {filteredMovies.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white dark:bg-[#171A23] border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-3">
          <Clapperboard className="w-10 h-10 text-rose-500/70 mx-auto" />
          <h3 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
            {profileMovies.length === 0
              ? 'Your cinema library is ready for its opening feature'
              : 'No titles match your current filters'}
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            {profileMovies.length === 0
              ? 'Search TMDB, OMDb, or iTunes/TVMaze to add movies and series with posters, cast, and streaming availability.'
              : 'Try clearing the search query or switching to All Lists / Streaming: Any.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
            >
              <Search className="w-4 h-4" /> Discover &amp; Add
            </button>
            <button
              type="button"
              onClick={() => setFamilyWatchlistOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-semibold"
            >
              <Gift className="w-4 h-4" /> Browse Family Watchlist
            </button>
          </div>
        </div>
      ) : groupMode === 'none' ? (
        renderMovieCollection(filteredMovies)
      ) : (
        <div className="space-y-6">
          {groupedSections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800 pb-2">
                <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
                  {section.title}
                </h2>
                <span className="text-xs font-semibold text-stone-400">
                  {section.movies.length} title(s)
                </span>
              </div>
              {renderMovieCollection(section.movies)}
            </section>
          ))}
        </div>
      )}

      {/* Drawers & Modals */}
      <MovieDetailDrawer
        movie={selectedMovie}
        onClose={() => onSelectMovie(null)}
        onEdit={(m) => onOpenForm(m)}
        onQuickLog={(m, mark) => onQuickLog(m, mark)}
      />

      <FamilyWatchlistModal
        open={familyWatchlistOpen}
        onClose={() => setFamilyWatchlistOpen(false)}
        onOpenMovie={(m) => onSelectMovie(m)}
      />

      <ImportPreviewModal
        preview={importPreview}
        onClose={() => setImportPreview(null)}
      />
    </div>
  );
};
