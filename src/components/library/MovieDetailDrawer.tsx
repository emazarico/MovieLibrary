import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  Clock,
  Disc,
  ExternalLink,
  Film,
  HeartHandshake,
  History,
  ListChecks,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Tv,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { hasTmdbCredentials } from '../../services/apiConfig';
import { useResolvedPoster } from '../../services/posterStore';
import { useLibrary } from '../../store/LibraryContext';
import type { MovieItem, MovieOwnership, WatchMedium, WatchStatus } from '../../types/movie';
import { formatRuntimeHuman, getMovieProgressInfo } from '../../utils/progress';
import {
  AVATAR_THEME_MAP,
  MEDIA_TYPE_META,
  OWNERSHIP_META,
  STATUS_META,
  STREAMING_REGIONS,
  WATCH_MEDIUM_META,
  matchesSubscribedService,
} from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';

interface MovieDetailDrawerProps {
  movie: MovieItem | null;
  onClose: () => void;
  onEdit: (movie: MovieItem) => void;
  onQuickLog: (movie: MovieItem, markWatched?: boolean) => void;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const MovieDetailDrawer: React.FC<MovieDetailDrawerProps> = ({
  movie,
  onClose,
  onEdit,
  onQuickLog,
}) => {
  const {
    activeProfileId,
    activeProfiles,
    profileShelves,
    householdSettings,
    apiConfig,
    updateMovie,
    deleteMovie,
    startRewatch,
    addWatchHistorySpan,
    deleteWatchHistorySpan,
    recommendMovieToProfile,
    refreshMovieWatchProviders,
    logWatchSession,
    addCoWatchersToWatch,
    addToast,
  } = useLibrary();

  const [reviewDraft, setReviewDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Co-watch retroactive addition
  const [showAddCoWatch, setShowAddCoWatch] = useState(false);
  const [selectedNewCoIds, setSelectedNewCoIds] = useState<string[]>([]);
  const [coGuestsDraft, setCoGuestsDraft] = useState('');
  const [coWatchDate, setCoWatchDate] = useState(todayIso);

  // Streaming refresh
  const [regionPick, setRegionPick] = useState(householdSettings.streamingRegion || 'US');
  const [refreshingProviders, setRefreshingProviders] = useState(false);

  // Recommend to family member
  const [showRecommend, setShowRecommend] = useState(false);
  const [recommendTargetId, setRecommendTargetId] = useState('');
  const [recommendNote, setRecommendNote] = useState('');

  // Rewatch history span entry
  const [showAddPastWatch, setShowAddPastWatch] = useState(false);
  const [pastWatchDate, setPastWatchDate] = useState(todayIso);
  const [pastRating, setPastRating] = useState(0);
  const [pastNotes, setPastNotes] = useState('');

  // Lending editor
  const [showLendForm, setShowLendForm] = useState(false);
  const [lentToDraft, setLentToDraft] = useState('');
  const [lentDateDraft, setLentDateDraft] = useState(todayIso);
  const [dueDateDraft, setDueDateDraft] = useState('');

  const resolvedBackdrop = useResolvedPoster(movie?.backdropUrl || movie?.posterUrl);

  const otherProfiles = useMemo(
    () => activeProfiles.filter((p) => p.id !== activeProfileId),
    [activeProfiles, activeProfileId],
  );

  useEffect(() => {
    if (!movie) return;
    setReviewDraft(movie.review || '');
    setNotesDraft(movie.notes || '');
    setConfirmDelete(false);
    setShowAddCoWatch(false);
    setSelectedNewCoIds([]);
    setCoGuestsDraft('');
    setCoWatchDate(movie.dateWatched || movie.dateStarted || todayIso());
    setRegionPick(movie.watchProviders?.region || householdSettings.streamingRegion || 'US');
    setShowRecommend(false);
    setRecommendTargetId(otherProfiles[0]?.id || '');
    setRecommendNote('');
    setShowAddPastWatch(false);
    setShowLendForm(false);
    setLentToDraft(movie.lentTo || '');
    setLentDateDraft(movie.lentDate || todayIso());
    setDueDateDraft(movie.dueDate || '');
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!movie) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [movie, onClose]);

  if (!movie) return null;

  const progress = getMovieProgressInfo(movie);
  const statusMeta = STATUS_META[movie.status];
  const mediaMeta = MEDIA_TYPE_META[movie.mediaType];
  const existingCoIds = movie.watchedWithProfileIds || [];
  const coWatcherProfiles = existingCoIds
    .map((id) => activeProfiles.find((p) => p.id === id && !p.deletedAt))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const eligibleNewCoWatchers = otherProfiles.filter((p) => !existingCoIds.includes(p.id));

  const handleStatusChange = (status: WatchStatus) => {
    const today = todayIso();
    updateMovie(movie.id, {
      status,
      dateStarted:
        status === 'watching' && !movie.dateStarted ? today : movie.dateStarted,
      dateWatched:
        status === 'watched' && !movie.dateWatched ? today : movie.dateWatched,
      watchedMinutes:
        status === 'watched' && movie.mediaType === 'movie' && movie.runtimeMinutes > 0
          ? Math.max(movie.runtimeMinutes, movie.watchedMinutes ?? 0)
          : movie.watchedMinutes,
      episodesWatched:
        status === 'watched' && movie.mediaType === 'series' && (movie.totalEpisodes ?? 0) > 0
          ? movie.totalEpisodes
          : movie.episodesWatched,
    });
  };

  const handleQuickNextEpisode = () => {
    const nextEp = (movie.currentEpisode ?? 0) + 1;
    logWatchSession({
      movieId: movie.id,
      date: todayIso(),
      minutesWatched: movie.runtimeMinutes || 45,
      episodesCount: 1,
      seasonNumber: movie.currentSeason ?? 1,
      episodeNumber: nextEp,
      medium: movie.medium || 'streaming',
      serviceName: movie.serviceName,
      coWatcherProfileIds: movie.watchedWithProfileIds,
      watchedWithGuests: movie.watchedWithGuests,
    });
  };

  const handleRefreshProviders = async () => {
    setRefreshingProviders(true);
    await refreshMovieWatchProviders(movie.id, regionPick);
    setRefreshingProviders(false);
  };

  const handleAddCoWatchers = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addCoWatchersToWatch({
      movieId: movie.id,
      date: coWatchDate || movie.dateWatched || todayIso(),
      coWatcherProfileIds: selectedNewCoIds,
      guestNames: coGuestsDraft.trim() || undefined,
    });
    if (added > 0 || coGuestsDraft.trim()) {
      if (selectedNewCoIds.length === 0 && coGuestsDraft.trim()) {
        const merged = Array.from(
          new Set(
            [movie.watchedWithGuests || '', coGuestsDraft]
              .flatMap((s) => s.split(','))
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ).join(', ');
        updateMovie(movie.id, { watchedWithGuests: merged });
      }
      setShowAddCoWatch(false);
      setSelectedNewCoIds([]);
      setCoGuestsDraft('');
    }
  };

  const handleSaveNotesAndReview = () => {
    updateMovie(movie.id, {
      review: reviewDraft.trim() || undefined,
      notes: notesDraft,
    });
    addToast({ title: 'Saved review & notes', tone: 'success' });
  };

  const handleRecommendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendTargetId) return;
    const res = recommendMovieToProfile(movie.id, recommendTargetId, recommendNote);
    if (res.ok) {
      setShowRecommend(false);
      setRecommendNote('');
    }
  };

  const handleToggleShelf = (shelfId: string) => {
    const exists = movie.shelfIds.includes(shelfId);
    updateMovie(movie.id, {
      shelfIds: exists
        ? movie.shelfIds.filter((id) => id !== shelfId)
        : [...movie.shelfIds, shelfId],
    });
  };

  const handleSaveLending = (e: React.FormEvent) => {
    e.preventDefault();
    updateMovie(movie.id, {
      lentTo: lentToDraft.trim() || undefined,
      lentDate: lentToDraft.trim() ? lentDateDraft : undefined,
      dueDate: dueDateDraft || undefined,
    });
    setShowLendForm(false);
    addToast({ title: 'Updated disc lending info', tone: 'success' });
  };

  const providers = movie.watchProviders;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-sm animate-fade-slide">
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <aside className="relative w-full max-w-xl bg-[#FAF8F5] dark:bg-[#11141C] border-l border-stone-200 dark:border-stone-800 shadow-2xl overflow-y-auto custom-scrollbar flex flex-col">
        {/* Cinematic Backdrop Banner */}
        <div className="relative h-36 sm:h-44 shrink-0 overflow-hidden bg-gradient-to-br from-rose-950 via-stone-900 to-amber-950">
          {resolvedBackdrop && (
            <img
              src={resolvedBackdrop}
              alt=""
              className="w-full h-full object-cover opacity-50 scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] dark:from-[#11141C] via-stone-950/35 to-stone-950/50" />

          {/* Floating Header Buttons */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/90 dark:bg-stone-900/90 border ${statusMeta.badgeClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusMeta.dotClass}`} />
                {statusMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md bg-white/90 dark:bg-stone-900/90 text-stone-800 dark:text-stone-200">
                {movie.mediaType === 'series' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                {mediaMeta.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(movie)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-stone-900/90 text-stone-800 dark:text-stone-100 text-xs font-semibold shadow-sm hover:bg-white transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/90 dark:bg-stone-900/90 text-stone-700 dark:text-stone-200 hover:bg-white shadow-sm transition-colors"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-5 pb-10 -mt-14 relative z-10 space-y-5">
          {/* Hero Poster + Metadata */}
          <div className="flex gap-4 items-end">
            <MoviePoster
              title={movie.title}
              director={movie.director}
              posterUrl={movie.posterUrl}
              size="lg"
            />
            <div className="flex-1 min-w-0 pt-4">
              {movie.franchise && (
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  {movie.franchise}
                  {movie.franchiseIndex !== undefined ? ` #${movie.franchiseIndex}` : ''}
                </p>
              )}
              <h2 className="font-serif-display text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
                {movie.title}
              </h2>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="text-xs italic text-stone-500 dark:text-stone-400">
                  {movie.originalTitle}
                </p>
              )}
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-1">
                {movie.director}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500 dark:text-stone-400">
                {movie.releaseYear && (
                  <span>
                    {movie.releaseYear}
                    {movie.endYear ? `–${movie.endYear}` : ''}
                  </span>
                )}
                {movie.certification && (
                  <span className="px-1.5 py-0.5 rounded bg-stone-200/70 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-300">
                    {movie.certification}
                  </span>
                )}
                {movie.runtimeMinutes > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRuntimeHuman(movie.runtimeMinutes)}
                    {movie.mediaType === 'series' ? '/ep' : ''}
                  </span>
                )}
                {movie.language && <span>· {movie.language}</span>}
              </div>

              {/* External Quick Links */}
              <div className="flex flex-wrap gap-2 mt-2.5">
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-900 dark:text-amber-300 text-[11px] font-bold hover:bg-amber-400/30"
                  >
                    IMDb <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {movie.tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/${movie.mediaType === 'series' ? 'tv' : 'movie'}/${movie.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 text-[11px] font-bold hover:bg-cyan-500/25"
                  >
                    TMDB <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {movie.trailerUrl && (
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[11px] font-bold hover:bg-rose-500/25"
                  >
                    <Play className="w-2.5 h-2.5" /> Trailer
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Genres & Cast */}
          {(movie.genres.length > 0 || (movie.cast && movie.cast.length > 0)) && (
            <div className="space-y-1.5">
              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {movie.genres.map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {movie.cast && movie.cast.length > 0 && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  <strong className="text-stone-700 dark:text-stone-300">Cast:</strong>{' '}
                  {movie.cast.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Critic & Community Scores */}
          {movie.externalRatings &&
            (movie.externalRatings.tmdbScore ||
              movie.externalRatings.imdbRating ||
              movie.externalRatings.rottenTomatoes ||
              movie.externalRatings.metascore) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/80 dark:border-stone-800 text-center">
                {movie.externalRatings.tmdbScore ? (
                  <div>
                    <p className="text-xs font-semibold text-stone-400">TMDB</p>
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {movie.externalRatings.tmdbScore.toFixed(1)}/10
                    </p>
                  </div>
                ) : null}
                {movie.externalRatings.imdbRating ? (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">IMDb</p>
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {movie.externalRatings.imdbRating}/10
                    </p>
                  </div>
                ) : null}
                {movie.externalRatings.rottenTomatoes ? (
                  <div>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Rotten Tomatoes
                    </p>
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      🍅 {movie.externalRatings.rottenTomatoes}
                    </p>
                  </div>
                ) : null}
                {movie.externalRatings.metascore ? (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Metascore
                    </p>
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {movie.externalRatings.metascore}/100
                    </p>
                  </div>
                ) : null}
                {movie.externalRatings.awards && (
                  <p className="col-span-full text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1 pt-1 border-t border-stone-100 dark:border-stone-800">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    {movie.externalRatings.awards}
                  </p>
                )}
              </div>
            )}

          {/* Where to Watch Card (JustWatch via TMDB) */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Tv className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Where to Watch
                </h3>
                {providers?.fetchedAt && (
                  <p className="text-[11px] text-stone-400">
                    Region: {providers.region} · Updated{' '}
                    {new Date(providers.fetchedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {movie.tmdbId && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={regionPick}
                    onChange={(e) => setRegionPick(e.target.value)}
                    aria-label="Streaming country region"
                    className="px-2 py-1 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
                  >
                    {STREAMING_REGIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRefreshProviders()}
                    disabled={refreshingProviders}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${refreshingProviders ? 'animate-spin' : ''}`}
                    />
                    {providers ? 'Refresh' : 'Check Streaming'}
                  </button>
                </div>
              )}
            </div>

            {providers ? (
              <div className="space-y-2.5">
                {providers.stream.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                      Included with Subscription
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.stream.map((p) => {
                        const sub = matchesSubscribedService(
                          p.providerName,
                          householdSettings.subscribedServices,
                        );
                        return (
                          <span
                            key={`stream-${p.providerId}`}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                              sub
                                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35'
                                : 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/20'
                            }`}
                          >
                            {p.logoUrl && (
                              <img src={p.logoUrl} alt="" className="w-4 h-4 rounded" />
                            )}
                            {p.providerName}
                            {sub && <Check className="w-3 h-3" />}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {providers.free.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                      Free / Ad-Supported
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {providers.free.map((p) => (
                        <span
                          key={`free-${p.providerId}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                        >
                          {p.logoUrl && <img src={p.logoUrl} alt="" className="w-4 h-4 rounded" />}
                          {p.providerName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(providers.rent.length > 0 || providers.buy.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {providers.rent.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-400 mb-1">Rent</p>
                        <p className="text-stone-600 dark:text-stone-300">
                          {providers.rent.slice(0, 5).map((r) => r.providerName).join(', ')}
                        </p>
                      </div>
                    )}
                    {providers.buy.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-400 mb-1">Buy</p>
                        <p className="text-stone-600 dark:text-stone-300">
                          {providers.buy.slice(0, 5).map((b) => b.providerName).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {providers.stream.length === 0 &&
                  providers.free.length === 0 &&
                  providers.rent.length === 0 &&
                  providers.buy.length === 0 && (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      No streaming, rent, or buy offers listed for {providers.region} right now.
                    </p>
                  )}

                {providers.link && (
                  <a
                    href={providers.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Attribution: JustWatch via TMDB <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {movie.tmdbId
                  ? hasTmdbCredentials(apiConfig)
                    ? 'Click "Check Streaming" above to fetch live JustWatch streaming availability.'
                    : 'Add your free TMDB Read Access Token in API Settings to fetch live streaming providers.'
                  : 'Match this title via TMDB search to unlock live streaming availability.'}
              </p>
            )}
          </section>

          {/* Status & Progress Actions */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['want-to-watch', 'watching', 'watched', 'dropped'] as WatchStatus[]).map((st) => {
                const meta = STATUS_META[st];
                const active = movie.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      active
                        ? `${meta.badgeClass} shadow-sm`
                        : 'border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                  >
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>

            {(movie.mediaType === 'series' || movie.status === 'watching') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                  <span>{progress.label}</span>
                  {progress.percent !== null && (
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {progress.percent}%
                    </span>
                  )}
                </div>
                {progress.percent !== null && (
                  <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {movie.mediaType === 'series' && movie.status !== 'watched' && (
                <button
                  type="button"
                  onClick={handleQuickNextEpisode}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> +1 Episode
                </button>
              )}

              <button
                type="button"
                onClick={() => onQuickLog(movie, movie.status !== 'watched')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                {movie.status === 'watched' ? 'Log Watch / Rewatch' : 'Log Watch & Family'}
              </button>

              {movie.status !== 'watched' && (
                <button
                  type="button"
                  onClick={() => onQuickLog(movie, true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" /> Mark Watched
                </button>
              )}

              {movie.status === 'watched' && (
                <button
                  type="button"
                  onClick={() => startRewatch(movie.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Start Rewatch
                </button>
              )}
            </div>
          </section>

          {/* Watched With (Family Co-Watching) */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Watched With (Family & Guests)
              </h3>
              {otherProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddCoWatch((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Family Member
                </button>
              )}
            </div>

            {coWatcherProfiles.length > 0 || movie.watchedWithGuests ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {coWatcherProfiles.map((cw) => {
                  const theme = AVATAR_THEME_MAP[cw.avatarTheme] || AVATAR_THEME_MAP.rose;
                  return (
                    <span
                      key={cw.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${theme.softBg} ${theme.text}`}
                    >
                      <span>{cw.avatarEmoji}</span>
                      <span>{cw.name}</span>
                    </span>
                  );
                })}
                {movie.watchedWithGuests && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    Guests: {movie.watchedWithGuests}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Solo watch so far. Add family members to sync this watch to their timelines without overwriting their ratings.
              </p>
            )}

            {showAddCoWatch && (
              <form
                onSubmit={handleAddCoWatchers}
                className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 space-y-2.5"
              >
                {eligibleNewCoWatchers.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {eligibleNewCoWatchers.map((p) => {
                      const picked = selectedNewCoIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSelectedNewCoIds((prev) =>
                              picked ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                            picked
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200'
                          }`}
                        >
                          <span>{p.avatarEmoji}</span>
                          <span>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    All household profiles are already on this watch.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={coGuestsDraft}
                    onChange={(e) => setCoGuestsDraft(e.target.value)}
                    placeholder="Optional guests (e.g. Grandma)"
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                  <input
                    type="date"
                    value={coWatchDate}
                    onChange={(e) => setCoWatchDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCoWatch(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedNewCoIds.length === 0 && !coGuestsDraft.trim()}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    Sync to Watch
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Rating, Review & Notes */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Your Rating & Review
              </span>
              <StarRating
                value={movie.rating}
                onChange={(r) => updateMovie(movie.id, { rating: r })}
                size="md"
                showNumeric
              />
            </div>

            {movie.synopsis && (
              <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl">
                {movie.synopsis}
              </p>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                Personal Review
              </label>
              <textarea
                rows={2}
                value={reviewDraft}
                onChange={(e) => setReviewDraft(e.target.value)}
                placeholder="What did you think of this movie or series?"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-1">
                Private Notes
              </label>
              <textarea
                rows={2}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Where to pick up, favorite quotes, or watch notes..."
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {(reviewDraft !== (movie.review || '') || notesDraft !== (movie.notes || '')) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotesAndReview}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                >
                  Save Review & Notes
                </button>
              </div>
            )}
          </section>

          {/* Lists, Dates, Ownership & Lending */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Lists, Viewing & Disc Copy
              </h3>
              <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                {movie.dateStarted && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Started {movie.dateStarted}
                  </span>
                )}
                {movie.dateWatched && (
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Watched {movie.dateWatched}
                  </span>
                )}
              </div>
            </div>

            {/* Lists / Shelves */}
            {profileShelves.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profileShelves.map((shelf) => {
                  const active = movie.shelfIds.includes(shelf.id);
                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() => handleToggleShelf(shelf.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {shelf.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Medium & Ownership quick selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Watch Medium
                </label>
                <select
                  value={movie.medium || ''}
                  onChange={(e) =>
                    updateMovie(movie.id, {
                      medium: (e.target.value || undefined) as WatchMedium | undefined,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                >
                  <option value="">Unspecified</option>
                  {Object.entries(WATCH_MEDIUM_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-stone-400 mb-1">
                  Copy / Ownership
                </label>
                <select
                  value={movie.ownership || ''}
                  onChange={(e) =>
                    updateMovie(movie.id, {
                      ownership: (e.target.value || undefined) as MovieOwnership | undefined,
                    })
                  }
                  className="w-full px-2.5 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
                >
                  <option value="">Unspecified</option>
                  {Object.entries(OWNERSHIP_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Disc Lending */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
              {movie.lentTo ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-semibold">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Lent to {movie.lentTo}
                    {movie.lentDate ? ` (${movie.lentDate})` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateMovie(movie.id, { lentTo: undefined, lentDate: undefined })
                    }
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                  >
                    Mark Returned
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLendForm((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-rose-600"
                >
                  <Disc className="w-3.5 h-3.5" /> Lend physical disc / track return
                </button>
              )}

              {otherProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRecommend((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                >
                  <Send className="w-3.5 h-3.5" /> Recommend to Family
                </button>
              )}
            </div>

            {showLendForm && (
              <form
                onSubmit={handleSaveLending}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70"
              >
                <input
                  type="text"
                  value={lentToDraft}
                  onChange={(e) => setLentToDraft(e.target.value)}
                  placeholder="Lent to..."
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                />
                <input
                  type="date"
                  value={lentDateDraft}
                  onChange={(e) => setLentDateDraft(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  Save Loan
                </button>
              </form>
            )}

            {showRecommend && otherProfiles.length > 0 && (
              <form
                onSubmit={handleRecommendSubmit}
                className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/50 space-y-2"
              >
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Send to Family Member&apos;s Watchlist
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {otherProfiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRecommendTargetId(p.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                        recommendTargetId === p.id
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {p.avatarEmoji} {p.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recommendNote}
                    onChange={(e) => setRecommendNote(e.target.value)}
                    placeholder="Why they'll love it..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                  >
                    Send
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Past Watches / Rewatch History */}
          <section className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <History className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Watch History ({(movie.watchHistory?.length ?? 0) + (movie.status === 'watched' ? 1 : 0)})
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPastWatch((v) => !v)}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                + Add Past Watch
              </button>
            </div>

            {showAddPastWatch && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addWatchHistorySpan(movie.id, {
                    watchedAt: pastWatchDate || undefined,
                    rating: pastRating > 0 ? pastRating : undefined,
                    notes: pastNotes.trim() || undefined,
                  });
                  setShowAddPastWatch(false);
                  setPastRating(0);
                  setPastNotes('');
                }}
                className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="date"
                    value={pastWatchDate}
                    onChange={(e) => setPastWatchDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                  <StarRating value={pastRating} onChange={setPastRating} size="sm" />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pastNotes}
                    onChange={(e) => setPastNotes(e.target.value)}
                    placeholder="Memory from that watch..."
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}

            {(movie.watchHistory || []).length > 0 ? (
              <div className="space-y-1.5">
                {movie.watchHistory!.map((span, idx) => (
                  <div
                    key={span.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        Watch #{idx + 1}
                      </span>
                      {span.watchedAt && (
                        <span className="text-stone-500 ml-2">{span.watchedAt}</span>
                      )}
                      {span.notes && (
                        <p className="text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {span.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {span.rating ? <StarRating value={span.rating} size="sm" /> : null}
                      <button
                        type="button"
                        onClick={() => deleteWatchHistorySpan(movie.id, span.id)}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-stone-400 hover:text-rose-600"
                        aria-label="Remove past watch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">
                No archived prior watches yet. Use &ldquo;Start Rewatch&rdquo; after watching again!
              </p>
            )}
          </section>

          {/* Danger Zone */}
          <div className="pt-2 pb-4 flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Remove from library?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    deleteMovie(movie.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-stone-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Title
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
