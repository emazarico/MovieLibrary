import React, { useMemo, useState } from 'react';
import { Check, Dices, Plus, Search, Sparkles, Tv } from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { MediaType, MovieItem, UserProfile } from '../../types/movie';
import { findMovieDuplicates } from '../../utils/duplicates';
import { formatRuntimeHuman } from '../../utils/progress';
import { AVATAR_THEME_MAP, matchesSubscribedService } from '../../utils/themes';
import { Modal } from '../common/Modal';
import { MoviePoster } from '../common/MoviePoster';
import { StreamingBadges } from '../common/StreamingBadges';

interface FamilyWatchlistModalProps {
  open: boolean;
  onClose: () => void;
  onOpenMovie?: (movie: MovieItem) => void;
}

interface WatchlistEntry {
  movie: MovieItem;
  owner: UserProfile;
}

export const FamilyWatchlistModal: React.FC<FamilyWatchlistModalProps> = ({
  open,
  onClose,
  onOpenMovie,
}) => {
  const {
    db,
    activeProfiles,
    activeProfileId,
    profileShelves,
    householdSettings,
    addMovie,
  } = useLibrary();

  const [selectedProfileFilter, setSelectedProfileFilter] = useState<'all' | string>('all');
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all');
  const [onlyMySubscriptions, setOnlyMySubscriptions] = useState(false);
  const [query, setQuery] = useState('');
  const [spotlightPick, setSpotlightPick] = useState<WatchlistEntry | null>(null);

  const profileMap = useMemo(
    () => new Map(activeProfiles.map((p) => [p.id, p])),
    [activeProfiles],
  );

  const allWatchlistEntries = useMemo<WatchlistEntry[]>(() => {
    const out: WatchlistEntry[] = [];
    for (const movie of db.movies) {
      if (movie.deletedAt) continue;
      const isQueued =
        movie.status === 'want-to-watch' ||
        movie.tags.some((t) => ['watchlist', 'wishlist'].includes(t.toLowerCase()));
      if (!isQueued) continue;
      const owner = profileMap.get(movie.profileId);
      if (!owner) continue;
      out.push({ movie, owner });
    }
    return out.sort((a, b) => b.movie.updatedAt.localeCompare(a.movie.updatedAt));
  }, [db.movies, profileMap]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allWatchlistEntries.filter(({ movie }) => {
      if (selectedProfileFilter !== 'all' && movie.profileId !== selectedProfileFilter) {
        return false;
      }
      if (mediaFilter !== 'all' && movie.mediaType !== mediaFilter) {
        return false;
      }
      if (onlyMySubscriptions) {
        const subNames = householdSettings.subscribedServices;
        const providers = [
          ...(movie.watchProviders?.stream || []),
          ...(movie.watchProviders?.free || []),
        ];
        const hasMatch =
          providers.some((p) => matchesSubscribedService(p.providerName, subNames)) ||
          (movie.watchProviders?.free.length ?? 0) > 0;
        if (!hasMatch) return false;
      }
      if (q) {
        const hay = `${movie.title} ${movie.director} ${movie.franchise || ''} ${movie.wantToWatchNote || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allWatchlistEntries,
    selectedProfileFilter,
    mediaFilter,
    onlyMySubscriptions,
    householdSettings.subscribedServices,
    query,
  ]);

  const handleSpinMovieNight = () => {
    if (filteredEntries.length === 0) return;
    const pool =
      filteredEntries.length > 1 && spotlightPick
        ? filteredEntries.filter((e) => e.movie.id !== spotlightPick.movie.id)
        : filteredEntries;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setSpotlightPick(picked);
  };

  const isInMyLibrary = (movie: MovieItem): MovieItem | undefined => {
    if (!activeProfileId) return undefined;
    const dup = findMovieDuplicates(
      {
        title: movie.title,
        director: movie.director,
        releaseYear: movie.releaseYear,
        mediaType: movie.mediaType,
        tmdbId: movie.tmdbId,
        imdbId: movie.imdbId,
      },
      db.movies,
      activeProfiles,
      activeProfileId,
    );
    return dup.ownMatches[0];
  };

  const handleCopyToMyWatchlist = (source: MovieItem, ownerName: string) => {
    addMovie(
      {
        mediaType: source.mediaType,
        title: source.title,
        originalTitle: source.originalTitle,
        director: source.director,
        cast: source.cast,
        shelfIds: profileShelves[0] ? [profileShelves[0].id] : [],
        releaseYear: source.releaseYear,
        endYear: source.endYear,
        runtimeMinutes: source.runtimeMinutes,
        totalSeasons: source.totalSeasons,
        totalEpisodes: source.totalEpisodes,
        certification: source.certification,
        genres: source.genres,
        language: source.language,
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
        recommendedBy: source.recommendedBy || ownerName,
        wantToWatchNote: source.wantToWatchNote,
        synopsis: source.synopsis,
        notes: '',
        tags: Array.from(new Set([...source.tags, 'watchlist'])),
      },
      false,
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Family Watchlist & Movie Night Picker"
      subtitle={`${allWatchlistEntries.length} queued title(s) across your household`}
      maxWidthClass="max-w-3xl"
    >
      <div className="p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">
        {/* Controls & Spin Button */}
        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter household queue by title or director..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={handleSpinMovieNight}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-700 hover:to-amber-600 disabled:opacity-40 text-white text-sm font-semibold shadow-sm shrink-0"
          >
            <Dices className="w-4 h-4" />
            Spin for Movie Night
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedProfileFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              selectedProfileFilter === 'all'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            Everyone
          </button>
          {activeProfiles.map((p) => {
            const active = selectedProfileFilter === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProfileFilter(p.id)}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                  active
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                <span>{p.avatarEmoji}</span>
                <span>{p.name}</span>
              </button>
            );
          })}

          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value as 'all' | MediaType)}
            className="px-2.5 py-1 rounded-full bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium"
          >
            <option value="all">Movies &amp; Series</option>
            <option value="movie">Movies Only</option>
            <option value="series">TV Series Only</option>
          </select>

          {householdSettings.subscribedServices.length > 0 && (
            <button
              type="button"
              onClick={() => setOnlyMySubscriptions((v) => !v)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                onlyMySubscriptions
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Tv className="w-3 h-3" /> On My Subscriptions
            </button>
          )}
        </div>

        {/* Random Spotlight Result */}
        {spotlightPick && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/12 via-amber-500/10 to-transparent border-2 border-rose-400/50 dark:border-rose-600/60 flex items-center gap-4">
            <MoviePoster
              title={spotlightPick.movie.title}
              director={spotlightPick.movie.director}
              posterUrl={spotlightPick.movie.posterUrl}
              size="md"
              interactive={false}
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Tonight&apos;s Pick
              </p>
              <h3 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
                {spotlightPick.movie.title}
              </h3>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Queued by {spotlightPick.owner.avatarEmoji} {spotlightPick.owner.name}
                {spotlightPick.movie.runtimeMinutes > 0 &&
                  ` · ${formatRuntimeHuman(spotlightPick.movie.runtimeMinutes)}`}
              </p>
              <StreamingBadges
                providers={spotlightPick.movie.watchProviders}
                subscribedServices={householdSettings.subscribedServices}
                compact
                maxItems={3}
              />
            </div>
          </div>
        )}

        {/* List */}
        {filteredEntries.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-500">
            No matching titles in the household watchlist.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
            {filteredEntries.map(({ movie, owner }) => {
              const ownerTheme = AVATAR_THEME_MAP[owner.avatarTheme] || AVATAR_THEME_MAP.rose;
              const myMatch = isInMyLibrary(movie);
              return (
                <div
                  key={movie.id}
                  className="flex gap-3 p-3 rounded-2xl bg-stone-50/90 dark:bg-stone-900/70 border border-stone-200/80 dark:border-stone-800"
                >
                  <MoviePoster
                    title={movie.title}
                    director={movie.director}
                    posterUrl={movie.posterUrl}
                    size="sm"
                    interactive={false}
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ownerTheme.softBg} ${ownerTheme.text}`}
                        >
                          {owner.avatarEmoji} {owner.name}
                        </span>
                        {movie.releaseYear && (
                          <span className="text-[11px] text-stone-400">{movie.releaseYear}</span>
                        )}
                      </div>
                      <h4 className="font-serif-display text-sm font-bold text-stone-900 dark:text-stone-100 line-clamp-1 mt-1">
                        {movie.title}
                      </h4>
                      <p className="text-[11px] text-stone-500 truncate">{movie.director}</p>

                      {movie.wantToWatchNote && (
                        <p className="text-[11px] italic text-amber-800 dark:text-amber-300 line-clamp-2 mt-1">
                          &ldquo;{movie.wantToWatchNote}&rdquo;
                        </p>
                      )}

                      <div className="mt-1.5">
                        <StreamingBadges
                          providers={movie.watchProviders}
                          subscribedServices={householdSettings.subscribedServices}
                          compact
                          maxItems={2}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-800">
                      {myMatch ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenMovie) {
                              onOpenMovie(myMatch);
                              onClose();
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                        >
                          <Check className="w-3 h-3" /> In Your Library
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCopyToMyWatchlist(movie, owner.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold"
                        >
                          <Plus className="w-3 h-3" /> Add to My Watchlist
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
