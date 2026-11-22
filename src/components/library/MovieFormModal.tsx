import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Film, ImagePlus, Plus, Tv, Users, X } from 'lucide-react';
import { saveCustomPoster } from '../../services/posterStore';
import { useLibrary } from '../../store/LibraryContext';
import type {
  CatalogSearchResult,
  MediaType,
  MovieItem,
  MovieOwnership,
  WatchMedium,
  WatchStatus,
} from '../../types/movie';
import { findMovieDuplicates } from '../../utils/duplicates';
import {
  AVATAR_THEME_MAP,
  MOVIE_LANGUAGES,
  OWNERSHIP_META,
  STATUS_META,
  SUGGESTED_TAGS,
  WATCH_MEDIUM_META,
} from '../../utils/themes';
import { Modal } from '../common/Modal';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';

interface MovieFormModalProps {
  open: boolean;
  onClose: () => void;
  editingMovie?: MovieItem | null;
  prefillCatalog?: CatalogSearchResult | null;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const MovieFormModal: React.FC<MovieFormModalProps> = ({
  open,
  onClose,
  editingMovie,
  prefillCatalog,
}) => {
  const {
    db,
    activeProfileId,
    activeProfiles,
    profileShelves,
    addMovie,
    updateMovie,
    addCoWatchersToWatch,
    addToast,
  } = useLibrary();

  const otherFamilyMembers = useMemo(
    () => activeProfiles.filter((p) => p.id !== activeProfileId),
    [activeProfiles, activeProfileId],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [title, setTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const [director, setDirector] = useState('');
  const [castStr, setCastStr] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [runtimeMinutes, setRuntimeMinutes] = useState('110');
  const [totalSeasons, setTotalSeasons] = useState('');
  const [totalEpisodes, setTotalEpisodes] = useState('');
  const [currentSeason, setCurrentSeason] = useState('1');
  const [currentEpisode, setCurrentEpisode] = useState('0');
  const [episodesWatched, setEpisodesWatched] = useState('0');
  const [certification, setCertification] = useState('');
  const [language, setLanguage] = useState('English');
  const [genresStr, setGenresStr] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');
  const [franchise, setFranchise] = useState('');
  const [franchiseIndex, setFranchiseIndex] = useState('');
  const [imdbId, setImdbId] = useState('');
  const [tmdbId, setTmdbId] = useState<number | undefined>(undefined);
  const [tvmazeId, setTvmazeId] = useState<number | undefined>(undefined);

  const [status, setStatus] = useState<WatchStatus>('want-to-watch');
  const [rating, setRating] = useState(0);
  const [medium, setMedium] = useState<WatchMedium>('streaming');
  const [serviceName, setServiceName] = useState('');
  const [ownership, setOwnership] = useState<MovieOwnership>('streaming');
  const [ownershipNote, setOwnershipNote] = useState('');
  const [lentTo, setLentTo] = useState('');
  const [dateStarted, setDateStarted] = useState('');
  const [dateWatched, setDateWatched] = useState('');
  const [shelfIds, setShelfIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [review, setReview] = useState('');
  const [notes, setNotes] = useState('');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [wantToWatchNote, setWantToWatchNote] = useState('');
  const [coWatcherIds, setCoWatcherIds] = useState<string[]>([]);
  const [guestsText, setGuestsText] = useState('');
  const [uploadingPoster, setUploadingPoster] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingMovie) {
      setMediaType(editingMovie.mediaType);
      setTitle(editingMovie.title);
      setOriginalTitle(editingMovie.originalTitle || '');
      setDirector(editingMovie.director);
      setCastStr((editingMovie.cast || []).join(', '));
      setReleaseYear(editingMovie.releaseYear ? String(editingMovie.releaseYear) : '');
      setEndYear(editingMovie.endYear ? String(editingMovie.endYear) : '');
      setRuntimeMinutes(String(editingMovie.runtimeMinutes || 0));
      setTotalSeasons(editingMovie.totalSeasons ? String(editingMovie.totalSeasons) : '');
      setTotalEpisodes(editingMovie.totalEpisodes ? String(editingMovie.totalEpisodes) : '');
      setCurrentSeason(String(editingMovie.currentSeason ?? 1));
      setCurrentEpisode(String(editingMovie.currentEpisode ?? 0));
      setEpisodesWatched(String(editingMovie.episodesWatched ?? 0));
      setCertification(editingMovie.certification || '');
      setLanguage(editingMovie.language || 'English');
      setGenresStr(editingMovie.genres.join(', '));
      setPosterUrl(editingMovie.posterUrl || '');
      setBackdropUrl(editingMovie.backdropUrl || '');
      setTrailerUrl(editingMovie.trailerUrl || '');
      setFranchise(editingMovie.franchise || '');
      setFranchiseIndex(
        editingMovie.franchiseIndex !== undefined ? String(editingMovie.franchiseIndex) : '',
      );
      setImdbId(editingMovie.imdbId || '');
      setTmdbId(editingMovie.tmdbId);
      setTvmazeId(editingMovie.tvmazeId);
      setStatus(editingMovie.status);
      setRating(editingMovie.rating);
      setMedium(editingMovie.medium || 'streaming');
      setServiceName(editingMovie.serviceName || '');
      setOwnership(editingMovie.ownership || 'streaming');
      setOwnershipNote(editingMovie.ownershipNote || '');
      setLentTo(editingMovie.lentTo || '');
      setDateStarted(editingMovie.dateStarted || '');
      setDateWatched(editingMovie.dateWatched || '');
      setShelfIds(editingMovie.shelfIds);
      setTags(editingMovie.tags);
      setSynopsis(editingMovie.synopsis || '');
      setReview(editingMovie.review || '');
      setNotes(editingMovie.notes || '');
      setRecommendedBy(editingMovie.recommendedBy || '');
      setWantToWatchNote(editingMovie.wantToWatchNote || '');
      setCoWatcherIds(editingMovie.watchedWithProfileIds || []);
      setGuestsText(editingMovie.watchedWithGuests || '');
      return;
    }

    if (prefillCatalog) {
      setMediaType(prefillCatalog.mediaType);
      setTitle(prefillCatalog.title);
      setOriginalTitle(prefillCatalog.originalTitle || '');
      setDirector(prefillCatalog.director || '');
      setCastStr((prefillCatalog.cast || []).join(', '));
      setReleaseYear(prefillCatalog.releaseYear ? String(prefillCatalog.releaseYear) : '');
      setEndYear(prefillCatalog.endYear ? String(prefillCatalog.endYear) : '');
      setRuntimeMinutes(
        String(
          prefillCatalog.runtimeMinutes ??
            (prefillCatalog.mediaType === 'series' ? 45 : 110),
        ),
      );
      setTotalSeasons(prefillCatalog.totalSeasons ? String(prefillCatalog.totalSeasons) : '');
      setTotalEpisodes(prefillCatalog.totalEpisodes ? String(prefillCatalog.totalEpisodes) : '');
      setCurrentSeason('1');
      setCurrentEpisode('0');
      setEpisodesWatched('0');
      setCertification(prefillCatalog.certification || '');
      setLanguage(prefillCatalog.language || 'English');
      setGenresStr((prefillCatalog.genres || []).join(', '));
      setPosterUrl(prefillCatalog.posterUrl || '');
      setBackdropUrl(prefillCatalog.backdropUrl || '');
      setTrailerUrl(prefillCatalog.trailerUrl || '');
      setFranchise(prefillCatalog.franchise || '');
      setFranchiseIndex('');
      setImdbId(prefillCatalog.imdbId || '');
      setTmdbId(prefillCatalog.tmdbId);
      setTvmazeId(prefillCatalog.tvmazeId);
      setStatus('watched');
      setRating(0);
      setMedium('streaming');
      setServiceName(prefillCatalog.watchProviders?.stream[0]?.providerName || '');
      setOwnership('streaming');
      setOwnershipNote('');
      setLentTo('');
      setDateStarted(todayIso());
      setDateWatched(todayIso());
      setShelfIds(profileShelves[0] ? [profileShelves[0].id] : []);
      setTags([]);
      setSynopsis(prefillCatalog.synopsis || '');
      setReview('');
      setNotes('');
      setRecommendedBy('');
      setWantToWatchNote('');
      setCoWatcherIds([]);
      setGuestsText('');
      return;
    }

    setMediaType('movie');
    setTitle('');
    setOriginalTitle('');
    setDirector('');
    setCastStr('');
    setReleaseYear('');
    setEndYear('');
    setRuntimeMinutes('110');
    setTotalSeasons('');
    setTotalEpisodes('');
    setCurrentSeason('1');
    setCurrentEpisode('0');
    setEpisodesWatched('0');
    setCertification('');
    setLanguage('English');
    setGenresStr('');
    setPosterUrl('');
    setBackdropUrl('');
    setTrailerUrl('');
    setFranchise('');
    setFranchiseIndex('');
    setImdbId('');
    setTmdbId(undefined);
    setTvmazeId(undefined);
    setStatus('want-to-watch');
    setRating(0);
    setMedium('streaming');
    setServiceName('');
    setOwnership('streaming');
    setOwnershipNote('');
    setLentTo('');
    setDateStarted('');
    setDateWatched('');
    setShelfIds(profileShelves[0] ? [profileShelves[0].id] : []);
    setTags([]);
    setSynopsis('');
    setReview('');
    setNotes('');
    setRecommendedBy('');
    setWantToWatchNote('');
    setCoWatcherIds([]);
    setGuestsText('');
  }, [open, editingMovie, prefillCatalog, profileShelves]);

  const duplicateCheck = useMemo(() => {
    if (!open || !title.trim()) return { ownMatches: [], householdMatches: [] };
    return findMovieDuplicates(
      {
        title,
        director,
        releaseYear: releaseYear ? Number(releaseYear) : undefined,
        mediaType,
        tmdbId,
        imdbId: imdbId || undefined,
        excludeMovieId: editingMovie?.id,
      },
      db.movies,
      activeProfiles,
      activeProfileId,
    );
  }, [
    open,
    title,
    director,
    releaseYear,
    mediaType,
    tmdbId,
    imdbId,
    editingMovie?.id,
    db.movies,
    activeProfiles,
    activeProfileId,
  ]);

  const handleUploadPosterFile = async (file: File) => {
    setUploadingPoster(true);
    try {
      const key = await saveCustomPoster(file);
      setPosterUrl(key);
      addToast({ title: 'Poster saved locally', tone: 'success' });
    } catch (err) {
      addToast({
        title: 'Could not process poster image',
        description: err instanceof Error ? err.message : undefined,
        tone: 'error',
      });
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleAddTag = () => {
    const clean = customTag.trim().toLowerCase();
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setCustomTag('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const genres = genresStr
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    const cast = castStr
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const parsedYear = releaseYear ? Number(releaseYear) : undefined;
    const parsedEndYear = endYear ? Number(endYear) : undefined;
    const parsedRuntime = Math.max(0, Math.round(Number(runtimeMinutes) || 0));

    const payload = {
      mediaType,
      title: title.trim(),
      originalTitle: originalTitle.trim() || undefined,
      director:
        director.trim() || (mediaType === 'series' ? 'TV Series' : 'Unknown Director'),
      cast: cast.length > 0 ? cast : undefined,
      shelfIds,
      releaseYear: Number.isFinite(parsedYear) ? parsedYear : undefined,
      endYear: Number.isFinite(parsedEndYear) ? parsedEndYear : undefined,
      runtimeMinutes: parsedRuntime,
      totalSeasons:
        mediaType === 'series' && totalSeasons ? Number(totalSeasons) : undefined,
      totalEpisodes:
        mediaType === 'series' && totalEpisodes ? Number(totalEpisodes) : undefined,
      currentSeason:
        mediaType === 'series' ? Number(currentSeason) || 1 : undefined,
      currentEpisode:
        mediaType === 'series' ? Number(currentEpisode) || 0 : undefined,
      episodesWatched:
        mediaType === 'series' ? Number(episodesWatched) || 0 : undefined,
      certification: certification.trim() || undefined,
      genres,
      language: language.trim() || 'English',
      posterUrl: posterUrl.trim() || undefined,
      backdropUrl: backdropUrl.trim() || undefined,
      trailerUrl: trailerUrl.trim() || undefined,
      franchise: franchise.trim() || undefined,
      franchiseIndex: franchiseIndex ? Number(franchiseIndex) : undefined,
      tmdbId,
      imdbId: imdbId.trim() || undefined,
      tvmazeId,
      externalRatings: prefillCatalog?.externalRatings ?? editingMovie?.externalRatings,
      watchProviders: prefillCatalog?.watchProviders ?? editingMovie?.watchProviders,
      medium,
      serviceName: serviceName.trim() || undefined,
      ownership,
      ownershipNote: ownershipNote.trim() || undefined,
      lentTo: lentTo.trim() || undefined,
      status,
      rating,
      dateStarted: dateStarted || undefined,
      dateWatched:
        dateWatched || (status === 'watched' ? todayIso() : undefined),
      watchedWithProfileIds: coWatcherIds.length > 0 ? coWatcherIds : undefined,
      watchedWithGuests: guestsText.trim() || undefined,
      recommendedBy: recommendedBy.trim() || undefined,
      wantToWatchNote: wantToWatchNote.trim() || undefined,
      review: review.trim() || undefined,
      synopsis: synopsis.trim() || undefined,
      notes,
      tags,
    };

    if (editingMovie) {
      const existingCo = new Set(editingMovie.watchedWithProfileIds || []);
      const newlyAddedCo = coWatcherIds.filter((id) => !existingCo.has(id));
      updateMovie(editingMovie.id, payload);
      if (newlyAddedCo.length > 0 && (status === 'watched' || status === 'watching')) {
        addCoWatchersToWatch({
          movieId: editingMovie.id,
          date: payload.dateWatched || payload.dateStarted || todayIso(),
          coWatcherProfileIds: newlyAddedCo,
          guestNames: payload.watchedWithGuests,
        });
      }
      addToast({ title: `Updated "${payload.title}"`, tone: 'success' });
    } else {
      addMovie(payload, true);
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingMovie ? `Edit "${editingMovie.title}"` : 'Add Movie or TV Series'}
      subtitle={
        prefillCatalog
          ? `Prefilled from ${prefillCatalog.source.toUpperCase()} catalog`
          : 'Enter details manually or paste a custom poster'
      }
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5">
        {/* Duplicate Alert */}
        {(duplicateCheck.ownMatches.length > 0 ||
          duplicateCheck.householdMatches.length > 0) && (
          <div className="p-3 rounded-2xl bg-amber-500/12 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-0.5">
              {duplicateCheck.ownMatches.length > 0 && (
                <p>
                  <strong>Already in your library:</strong>{' '}
                  {duplicateCheck.ownMatches[0].title} ({STATUS_META[duplicateCheck.ownMatches[0].status].label})
                </p>
              )}
              {duplicateCheck.householdMatches.length > 0 && (
                <p>
                  <strong>In household:</strong>{' '}
                  {duplicateCheck.householdMatches
                    .map((h) => `${h.ownerEmoji} ${h.ownerName}`)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Media Type Toggle & Poster Preview */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <MoviePoster
              title={title || 'Untitled'}
              director={director || 'MovieLibrary'}
              posterUrl={posterUrl || undefined}
              size="lg"
              interactive={false}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadPosterFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPoster}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-[11px] font-semibold text-stone-700 dark:text-stone-200"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {uploadingPoster ? 'Saving...' : 'Upload Poster'}
            </button>
          </div>

          <div className="flex-1 w-full space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(['movie', 'series'] as MediaType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setMediaType(type);
                    if (!editingMovie && !prefillCatalog) {
                      setRuntimeMinutes(type === 'series' ? '45' : '110');
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    mediaType === type
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {type === 'movie' ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                  {type === 'movie' ? 'Movie' : 'TV Series'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spirited Away"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  {mediaType === 'series' ? 'Creator / Showrunner' : 'Director'}
                </label>
                <input
                  type="text"
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  placeholder="Hayao Miyazaki"
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Poster URL (or idb-poster:)
                </label>
                <input
                  type="text"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://image.tmdb.org/..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Core Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Release Year
            </label>
            <input
              type="number"
              value={releaseYear}
              onChange={(e) => setReleaseYear(e.target.value)}
              placeholder="2024"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              {mediaType === 'series' ? 'Mins / Ep' : 'Runtime (min)'}
            </label>
            <input
              type="number"
              min={0}
              value={runtimeMinutes}
              onChange={(e) => setRuntimeMinutes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Rating / Cert
            </label>
            <input
              type="text"
              value={certification}
              onChange={(e) => setCertification(e.target.value)}
              placeholder="PG-13"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Language
            </label>
            <select
              value={
                MOVIE_LANGUAGES.includes(language as (typeof MOVIE_LANGUAGES)[number])
                  ? language
                  : 'Other'
              }
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            >
              {MOVIE_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Series Specific Fields */}
        {mediaType === 'series' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-3.5 rounded-2xl bg-violet-500/8 border border-violet-500/20">
            <div>
              <label className="block text-[11px] font-semibold text-violet-800 dark:text-violet-300 mb-1">
                Seasons
              </label>
              <input
                type="number"
                min={1}
                value={totalSeasons}
                onChange={(e) => setTotalSeasons(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-violet-800 dark:text-violet-300 mb-1">
                Total Eps
              </label>
              <input
                type="number"
                min={1}
                value={totalEpisodes}
                onChange={(e) => setTotalEpisodes(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-violet-800 dark:text-violet-300 mb-1">
                Cur Season
              </label>
              <input
                type="number"
                min={1}
                value={currentSeason}
                onChange={(e) => setCurrentSeason(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-violet-800 dark:text-violet-300 mb-1">
                Cur Ep
              </label>
              <input
                type="number"
                min={0}
                value={currentEpisode}
                onChange={(e) => setCurrentEpisode(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-violet-800 dark:text-violet-300 mb-1">
                Eps Seen
              </label>
              <input
                type="number"
                min={0}
                value={episodesWatched}
                onChange={(e) => setEpisodesWatched(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
              />
            </div>
          </div>
        )}

        {/* Cast, Genres, Franchise */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Genres (comma separated)
            </label>
            <input
              type="text"
              value={genresStr}
              onChange={(e) => setGenresStr(e.target.value)}
              placeholder="Animation, Adventure, Sci-Fi"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Cast (comma separated)
            </label>
            <input
              type="text"
              value={castStr}
              onChange={(e) => setCastStr(e.target.value)}
              placeholder="Shameik Moore, Hailee Steinfeld"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Franchise / Collection
            </label>
            <input
              type="text"
              value={franchise}
              onChange={(e) => setFranchise(e.target.value)}
              placeholder="Spider-Verse"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Entry # in Franchise
            </label>
            <input
              type="number"
              step="0.5"
              min={0}
              value={franchiseIndex}
              onChange={(e) => setFranchiseIndex(e.target.value)}
              placeholder="2"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
        </div>

        {/* Status, Rating, Dates, Viewing Medium */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['want-to-watch', 'watching', 'watched', 'dropped'] as WatchStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatus(st);
                  if (st === 'watched' && !dateWatched) setDateWatched(todayIso());
                  if ((st === 'watching' || st === 'watched') && !dateStarted) {
                    setDateStarted(todayIso());
                  }
                }}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                  status === st
                    ? `${STATUS_META[st].badgeClass} shadow-sm`
                    : 'bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                }`}
              >
                {STATUS_META[st].label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">
                Your Rating:
              </span>
              <StarRating value={rating} onChange={setRating} size="md" showNumeric />
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={dateStarted}
                onChange={(e) => setDateStarted(e.target.value)}
                aria-label="Date started"
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
              />
              {status === 'watched' && (
                <input
                  type="date"
                  value={dateWatched}
                  onChange={(e) => setDateWatched(e.target.value)}
                  aria-label="Date watched"
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                Medium
              </label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value as WatchMedium)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
              >
                {Object.entries(WATCH_MEDIUM_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                Service / Theater
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Netflix, IMAX, Blu-ray"
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-500 mb-1">
                Ownership
              </label>
              <select
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as MovieOwnership)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
              >
                {Object.entries(OWNERSHIP_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Watched With Family Members (Co-Watch Sync) */}
        {(status === 'watched' || status === 'watching') && otherFamilyMembers.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-500/8 border border-rose-500/20 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Watched With Family Members
              </label>
              <span className="text-[11px] text-stone-500">
                Syncs watch &amp; runtime to selected profiles
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {otherFamilyMembers.map((member) => {
                const picked = coWatcherIds.includes(member.id);
                const theme = AVATAR_THEME_MAP[member.avatarTheme] || AVATAR_THEME_MAP.rose;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() =>
                      setCoWatcherIds((prev) =>
                        picked ? prev.filter((id) => id !== member.id) : [...prev, member.id],
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      picked
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : `bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 ${theme.text}`
                    }`}
                  >
                    <span>{member.avatarEmoji}</span>
                    <span>{member.name}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={guestsText}
              onChange={(e) => setGuestsText(e.target.value)}
              placeholder="Other guests (optional, comma-separated)"
              className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs"
            />
          </div>
        )}

        {/* Lists & Tags */}
        <div className="space-y-3">
          {profileShelves.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
                Lists
              </label>
              <div className="flex flex-wrap gap-1.5">
                {profileShelves.map((shelf) => {
                  const selected = shelfIds.includes(shelf.id);
                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      onClick={() =>
                        setShelfIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== shelf.id)
                            : [...prev, shelf.id],
                        )
                      }
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        selected
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {shelf.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Array.from(new Set([...SUGGESTED_TAGS, ...tags])).map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setTags((prev) =>
                        active ? prev.filter((t) => t !== tag) : [...prev, tag],
                      )
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      active
                        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/40'
                        : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-700 text-stone-500'
                    }`}
                  >
                    #{tag}
                    {active && <X className="w-2.5 h-2.5" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add custom tag..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Recommendation Note / Review / Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Recommended By
            </label>
            <input
              type="text"
              value={recommendedBy}
              onChange={(e) => setRecommendedBy(e.target.value)}
              placeholder="e.g. Maya"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Watchlist Note
            </label>
            <input
              type="text"
              value={wantToWatchNote}
              onChange={(e) => setWantToWatchNote(e.target.value)}
              placeholder="Great Friday night pick"
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
            Review
          </label>
          <textarea
            rows={2}
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Your thoughts and review..."
            className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Synopsis
            </label>
            <textarea
              rows={2}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Personal Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs"
            />
          </div>
        </div>

        {/* Footer Submit */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/80 dark:border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm"
          >
            {editingMovie ? 'Save Changes' : 'Add to Library'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
