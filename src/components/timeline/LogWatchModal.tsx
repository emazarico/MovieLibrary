import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clapperboard, Flame, Users } from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { WatchMedium } from '../../types/movie';
import { formatRuntimeHuman, getMovieProgressInfo } from '../../utils/progress';
import { AVATAR_THEME_MAP, WATCH_MEDIUM_META } from '../../utils/themes';
import { Modal } from '../common/Modal';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';

interface LogWatchModalProps {
  open: boolean;
  onClose: () => void;
  initialMovieId?: string;
  defaultMarkWatched?: boolean;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const LogWatchModal: React.FC<LogWatchModalProps> = ({
  open,
  onClose,
  initialMovieId,
  defaultMarkWatched = false,
}) => {
  const {
    activeProfileId,
    activeProfiles,
    profileMovies,
    householdSettings,
    logWatchSession,
  } = useLibrary();

  const sortedMovies = useMemo(() => {
    const rank = (status: string) =>
      status === 'watching' ? 0 : status === 'want-to-watch' ? 1 : status === 'watched' ? 2 : 3;
    return [...profileMovies].sort(
      (a, b) => rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [profileMovies]);

  const otherFamilyMembers = useMemo(
    () => activeProfiles.filter((p) => p.id !== activeProfileId),
    [activeProfiles, activeProfileId],
  );

  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [date, setDate] = useState(todayIso);
  const [minutesWatched, setMinutesWatched] = useState('90');
  const [episodesCount, setEpisodesCount] = useState('1');
  const [seasonNumber, setSeasonNumber] = useState('1');
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [medium, setMedium] = useState<WatchMedium>('streaming');
  const [serviceName, setServiceName] = useState('');
  const [coWatcherIds, setCoWatcherIds] = useState<string[]>([]);
  const [guestsText, setGuestsText] = useState('');
  const [note, setNote] = useState('');
  const [markWatched, setMarkWatched] = useState(false);
  const [finalRating, setFinalRating] = useState(0);
  const [finalReview, setFinalReview] = useState('');

  const selectedMovie = useMemo(
    () => sortedMovies.find((m) => m.id === selectedMovieId) || sortedMovies[0] || null,
    [sortedMovies, selectedMovieId],
  );

  useEffect(() => {
    if (!open) return;
    const defaultMovie =
      (initialMovieId && sortedMovies.find((m) => m.id === initialMovieId)) || sortedMovies[0];
    setSelectedMovieId(defaultMovie?.id || '');
    setDate(todayIso());
    setNote('');
    setGuestsText('');
  }, [open, initialMovieId, sortedMovies]);

  useEffect(() => {
    if (!selectedMovie || !open) return;
    const isSeries = selectedMovie.mediaType === 'series';
    const defaultMins =
      selectedMovie.runtimeMinutes > 0
        ? selectedMovie.runtimeMinutes
        : isSeries
          ? 45
          : 110;
    setMinutesWatched(String(defaultMins));
    setEpisodesCount('1');
    setSeasonNumber(String(selectedMovie.currentSeason ?? 1));
    setEpisodeNumber(String((selectedMovie.currentEpisode ?? 0) + 1));
    setMedium(selectedMovie.medium || 'streaming');
    setServiceName(
      selectedMovie.serviceName ||
        selectedMovie.watchProviders?.stream?.[0]?.providerName ||
        '',
    );
    setCoWatcherIds(selectedMovie.watchedWithProfileIds || []);
    setMarkWatched(
      defaultMarkWatched || (!isSeries && selectedMovie.status !== 'watched'),
    );
    setFinalRating(selectedMovie.rating || 0);
    setFinalReview(selectedMovie.review || '');
  }, [selectedMovie, open, defaultMarkWatched]);

  const toggleCoWatcher = (id: string) => {
    setCoWatcherIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectWholeFamily = () => {
    const allIds = otherFamilyMembers.map((m) => m.id);
    if (coWatcherIds.length === allIds.length) {
      setCoWatcherIds([]);
    } else {
      setCoWatcherIds(allIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovie) return;
    const isSeries = selectedMovie.mediaType === 'series';
    const mins = Math.max(0, Number(minutesWatched) || 0);
    const eps = isSeries ? Math.max(0, Number(episodesCount) || 0) : undefined;

    logWatchSession({
      movieId: selectedMovie.id,
      date: date || todayIso(),
      minutesWatched: mins,
      episodesCount: eps,
      seasonNumber: isSeries ? Math.max(1, Number(seasonNumber) || 1) : undefined,
      episodeNumber: isSeries ? Math.max(1, Number(episodeNumber) || 1) : undefined,
      medium,
      serviceName: serviceName.trim() || undefined,
      coWatcherProfileIds: coWatcherIds,
      watchedWithGuests: guestsText.trim() || undefined,
      note,
      markWatched,
      finalRating: markWatched && finalRating > 0 ? finalRating : undefined,
      finalReview: markWatched && finalReview.trim() ? finalReview.trim() : undefined,
    });
    onClose();
  };

  const serviceQuickPicks = useMemo(() => {
    const fromProviders =
      selectedMovie?.watchProviders?.stream.map((p) => p.providerName) || [];
    const fromSubs = householdSettings.subscribedServices || [];
    return Array.from(new Set([...fromProviders, ...fromSubs])).slice(0, 6);
  }, [selectedMovie, householdSettings.subscribedServices]);

  const currentProgressLabel = selectedMovie ? getMovieProgressInfo(selectedMovie).label : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log Watch & Family Co-Watch"
      subtitle="Record what you watched, how you watched it, and add family members who watched together."
      maxWidthClass="max-w-lg"
    >
      {sortedMovies.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-500">
          Add a movie or series to your library first before logging a watch.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
              Movie or Series
            </label>
            <select
              value={selectedMovie?.id || ''}
              onChange={(e) => setSelectedMovieId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            >
              {sortedMovies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.releaseYear ? ` (${m.releaseYear})` : ''} —{' '}
                  {m.mediaType === 'series' ? 'Series' : 'Movie'}
                </option>
              ))}
            </select>
          </div>

          {/* Preview Card */}
          {selectedMovie && (
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/70 dark:border-stone-800">
              <MoviePoster
                title={selectedMovie.title}
                director={selectedMovie.director}
                posterUrl={selectedMovie.posterUrl}
                size="sm"
                interactive={false}
              />
              <div className="min-w-0 flex-1">
                <p className="font-serif-display font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                  {selectedMovie.title}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                  {selectedMovie.director}
                  {selectedMovie.runtimeMinutes > 0
                    ? ` · ${formatRuntimeHuman(selectedMovie.runtimeMinutes)}`
                    : ''}
                </p>
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                  Status: {selectedMovie.status} · {currentProgressLabel}
                </p>
              </div>
            </div>
          )}

          {/* WHO WATCHED WITH YOU? (Family Co-Watching!) */}
          <div className="p-3.5 rounded-2xl bg-rose-500/8 border border-rose-500/20 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Who watched with you?
              </span>
              {otherFamilyMembers.length > 1 && (
                <button
                  type="button"
                  onClick={selectWholeFamily}
                  className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
                >
                  {coWatcherIds.length === otherFamilyMembers.length
                    ? 'Clear All'
                    : 'Whole Family'}
                </button>
              )}
            </div>

            {otherFamilyMembers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {otherFamilyMembers.map((member) => {
                  const selected = coWatcherIds.includes(member.id);
                  const meta = AVATAR_THEME_MAP[member.avatarTheme] || AVATAR_THEME_MAP.rose;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleCoWatcher(member.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        selected
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700 hover:border-rose-400'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-[10px]`}
                      >
                        {member.avatarEmoji}
                      </span>
                      <span>{member.name}</span>
                      {selected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Add another family member profile to tag co-watchers, or list guests below.
              </p>
            )}

            {coWatcherIds.length > 0 && (
              <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
                Automatically logs this watch for {coWatcherIds.length} selected family{' '}
                {coWatcherIds.length === 1 ? 'member' : 'members'} (keeps their own ratings private).
              </p>
            )}

            <input
              type="text"
              value={guestsText}
              onChange={(e) => setGuestsText(e.target.value)}
              placeholder="Other guests / friends (optional, e.g. Grandma, Leo)"
              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Series Episode Inputs OR Movie Runtime */}
          {selectedMovie?.mediaType === 'series' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Episodes
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={episodesCount}
                  onChange={(e) => setEpisodesCount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Season #
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={seasonNumber}
                  onChange={(e) => setSeasonNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Episode #
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={minutesWatched}
                  onChange={(e) => setMinutesWatched(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Minutes Watched
                </label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={minutesWatched}
                  onChange={(e) => setMinutesWatched(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-semibold text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Watch Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {selectedMovie?.mediaType === 'series' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                Watch Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          )}

          {/* How & Where Watched */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              How / Where Watched
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(WATCH_MEDIUM_META) as WatchMedium[]).map((medKey) => (
                <button
                  key={medKey}
                  type="button"
                  onClick={() => setMedium(medKey)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer ${
                    medium === medKey
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {WATCH_MEDIUM_META[medKey].shortLabel}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Service or venue (e.g. Netflix, Apple TV+, AMC IMAX)…"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
            {serviceQuickPicks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {serviceQuickPicks.map((svc) => (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => setServiceName(svc)}
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-rose-500/15 text-stone-600 dark:text-stone-300 cursor-pointer"
                  >
                    {svc}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Watch Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Theater reaction, favorite scene, snack notes…"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Mark Watched + Personal Rating & Review */}
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
              <input
                type="checkbox"
                checked={markWatched}
                onChange={(e) => setMarkWatched(e.target.checked)}
                className="accent-emerald-600 w-4 h-4"
              />
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Clapperboard className="w-4 h-4" />
                {selectedMovie?.status === 'watched'
                  ? 'Log as a Rewatch (archives previous watch)'
                  : `Mark ${selectedMovie?.mediaType === 'series' ? 'series' : 'movie'} as Watched`}
              </span>
            </label>

            {markWatched && (
              <div className="p-3.5 rounded-xl bg-emerald-500/6 border border-emerald-500/20 space-y-2.5 animate-fade-slide">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Your Rating &amp; Review (Optional)
                  </span>
                  <StarRating
                    value={finalRating}
                    onChange={setFinalRating}
                    size="sm"
                    showNumeric
                  />
                </div>
                <textarea
                  rows={2}
                  value={finalReview}
                  onChange={(e) => setFinalReview(e.target.value)}
                  placeholder="Write your thoughts for the Reviews tab…"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
            >
              <Flame className="w-4 h-4" /> Save Watch
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
