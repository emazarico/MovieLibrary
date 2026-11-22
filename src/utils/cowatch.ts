import type {
  MovieItem,
  MovieLibraryDatabase,
  WatchLog,
  WatchMedium,
  WatchSessionSpan,
  WatchStatus,
} from '../types/movie';
import { generateId } from './crypto';
import { findMovieDuplicates } from './duplicates';

export interface LogWatchEventInput {
  movieId: string;
  date: string;
  minutesWatched: number;
  episodesCount?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  medium?: WatchMedium;
  serviceName?: string;
  note?: string;
  markWatched?: boolean;
  finalRating?: number;
  finalReview?: string;
  coWatcherProfileIds?: string[];
  watchedWithGuests?: string;
}

export interface AddCoWatchersInput {
  movieId: string;
  logId?: string;
  date: string;
  coWatcherProfileIds: string[];
  guestNames?: string;
}

export interface WatchEventResult {
  db: MovieLibraryDatabase;
  primaryLog: WatchLog | null;
  syncedProfilesCount: number;
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function mergeCoWatcherIds(existing: string[] | undefined, toAdd: string[], ownerId: string): string[] | undefined {
  const merged = uniqueIds([...(existing || []), ...toAdd]).filter((id) => id !== ownerId);
  return merged.length > 0 ? merged : undefined;
}

function mergeGuestText(existing?: string, added?: string): string | undefined {
  const parts = new Set(
    [existing || '', added || '']
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return parts.size > 0 ? Array.from(parts).join(', ') : undefined;
}

function clampRating(rating?: number): number {
  if (!rating || !Number.isFinite(rating) || rating <= 0) return 0;
  return Math.min(5, Math.max(0, Math.round(rating * 2) / 2));
}

function stripQueueTags(tags: string[]): string[] {
  return tags.filter((t) => {
    const lower = t.toLowerCase();
    return lower !== 'wishlist' && lower !== 'watchlist';
  });
}

function computeNextMovieState(
  movie: MovieItem,
  input: {
    date: string;
    minutesWatched: number;
    episodesCount?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    medium?: WatchMedium;
    serviceName?: string;
    markWatched: boolean;
    ratingUpdate?: number;
    reviewUpdate?: string;
    otherParticipantIds: string[];
    guestNames?: string;
    watchGroupId?: string;
    now: string;
  },
): { updatedMovie: MovieItem; cycleIndex: number } {
  const isRewatchOnAlreadyWatchedMovie =
    movie.mediaType === 'movie' &&
    movie.status === 'watched' &&
    input.markWatched &&
    movie.dateWatched &&
    movie.dateWatched !== input.date;

  let nextWatchHistory: WatchSessionSpan[] | undefined = movie.watchHistory
    ? [...movie.watchHistory]
    : undefined;

  if (isRewatchOnAlreadyWatchedMovie) {
    const existing = nextWatchHistory || [];
    const alreadyRecorded = existing.some(
      (span) => span.watchedAt === movie.dateWatched && span.startedAt === movie.dateStarted,
    );
    if (!alreadyRecorded) {
      existing.push({
        id: generateId('watch'),
        startedAt: movie.dateStarted,
        watchedAt: movie.dateWatched,
        rating: movie.rating > 0 ? movie.rating : undefined,
        notes: movie.review?.trim() || undefined,
        medium: movie.medium,
        serviceName: movie.serviceName,
        watchedWithProfileIds: movie.watchedWithProfileIds,
        watchedWithGuests: movie.watchedWithGuests,
      });
    }
    nextWatchHistory = existing;
  }

  const cycleIndex = (nextWatchHistory?.length ?? 0) + 1;
  const nextStatus: WatchStatus = input.markWatched
    ? 'watched'
    : movie.status === 'want-to-watch'
      ? 'watching'
      : movie.status;

  const addedMins = Math.max(0, Math.round(input.minutesWatched || 0));
  const nextWatchedMins =
    input.markWatched && movie.mediaType === 'movie' && movie.runtimeMinutes > 0
      ? Math.max(movie.runtimeMinutes, (movie.watchedMinutes ?? 0) + addedMins)
      : Math.max(0, (movie.watchedMinutes ?? 0) + addedMins);

  const addedEps = Math.max(0, Math.round(input.episodesCount || 0));
  const nextEpisodesWatched =
    movie.mediaType === 'series'
      ? input.markWatched && (movie.totalEpisodes ?? 0) > 0
        ? Math.max((movie.episodesWatched ?? 0) + addedEps, movie.totalEpisodes ?? 0)
        : (movie.episodesWatched ?? 0) + addedEps
      : movie.episodesWatched;

  const nextSeason =
    movie.mediaType === 'series'
      ? input.seasonNumber ?? movie.currentSeason ?? 1
      : movie.currentSeason;
  const nextEpisode =
    movie.mediaType === 'series'
      ? input.episodeNumber ?? (addedEps > 0 ? (movie.currentEpisode ?? 0) + addedEps : movie.currentEpisode)
      : movie.currentEpisode;

  const nextRating =
    input.ratingUpdate !== undefined && input.ratingUpdate > 0
      ? clampRating(input.ratingUpdate)
      : movie.rating;
  const nextReview =
    input.reviewUpdate && input.reviewUpdate.trim() ? input.reviewUpdate.trim() : movie.review;

  const nextDateWatched = input.markWatched
    ? isRewatchOnAlreadyWatchedMovie
      ? input.date
      : movie.dateWatched || input.date
    : movie.dateWatched;

  const nextWatchedWith = mergeCoWatcherIds(
    movie.watchedWithProfileIds,
    input.otherParticipantIds,
    movie.profileId,
  );
  const nextGuests = mergeGuestText(movie.watchedWithGuests, input.guestNames);

  return {
    cycleIndex,
    updatedMovie: {
      ...movie,
      status: nextStatus,
      medium: input.medium || movie.medium,
      serviceName: input.serviceName?.trim() || movie.serviceName,
      watchedMinutes: nextWatchedMins > 0 ? nextWatchedMins : movie.watchedMinutes,
      episodesWatched: nextEpisodesWatched,
      currentSeason: nextSeason,
      currentEpisode: nextEpisode,
      rating: nextRating,
      review: nextReview,
      dateStarted: movie.dateStarted || input.date,
      dateWatched: nextDateWatched,
      watchHistory: nextWatchHistory,
      watchedWithProfileIds: nextWatchedWith,
      watchedWithGuests: nextGuests,
      updatedAt: input.now,
    },
  };
}

/**
 * Applies a watch event (solo or family co-watch) cleanly across all participating household profiles.
 * - Never overwrites another family member's existing rating or review.
 * - Auto-adds the movie/series to a co-watcher's library if they don't already have it.
 * - Links all generated WatchLogs via a shared `watchGroupId`.
 */
export function applyWatchEventToDatabase(
  db: MovieLibraryDatabase,
  activeProfileId: string,
  input: LogWatchEventInput,
): WatchEventResult {
  const sourceMovie = db.movies.find((m) => m.id === input.movieId && !m.deletedAt);
  if (!sourceMovie) {
    return { db, primaryLog: null, syncedProfilesCount: 0 };
  }

  const now = new Date().toISOString();
  const activeProfileIdsSet = new Set(
    db.profiles.filter((p) => !p.deletedAt).map((p) => p.id),
  );
  const coWatcherIds = uniqueIds(input.coWatcherProfileIds || []).filter(
    (id) => id !== activeProfileId && activeProfileIdsSet.has(id),
  );
  const allParticipantIds = [activeProfileId, ...coWatcherIds];
  const watchGroupId = coWatcherIds.length > 0 ? generateId('wgrp') : undefined;
  const cleanGuests = mergeGuestText(undefined, input.watchedWithGuests);
  const shouldMarkWatched = Boolean(input.markWatched);
  const cleanMedium = input.medium || sourceMovie.medium;
  const cleanService = input.serviceName?.trim() || sourceMovie.serviceName;

  const primaryOtherIds = allParticipantIds.filter((id) => id !== activeProfileId);
  const primaryState = computeNextMovieState(sourceMovie, {
    date: input.date,
    minutesWatched: input.minutesWatched,
    episodesCount: input.episodesCount,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    medium: cleanMedium,
    serviceName: cleanService,
    markWatched: shouldMarkWatched,
    ratingUpdate: shouldMarkWatched ? input.finalRating : undefined,
    reviewUpdate: shouldMarkWatched ? input.finalReview : undefined,
    otherParticipantIds: primaryOtherIds,
    guestNames: cleanGuests,
    watchGroupId,
    now,
  });

  const primaryLog: WatchLog = {
    id: generateId('wlog'),
    profileId: activeProfileId,
    movieId: sourceMovie.id,
    date: input.date,
    minutesWatched: Math.max(0, Math.round(input.minutesWatched || 0)),
    episodesCount:
      input.episodesCount !== undefined && input.episodesCount > 0
        ? Math.round(input.episodesCount)
        : undefined,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    medium: cleanMedium,
    serviceName: cleanService,
    watchCycle: primaryState.cycleIndex,
    watchGroupId,
    watchedWithProfileIds: primaryOtherIds.length > 0 ? primaryOtherIds : undefined,
    watchedWithGuests: cleanGuests,
    note: input.note?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  let nextMovies = db.movies.map((m) =>
    m.id === sourceMovie.id ? primaryState.updatedMovie : m,
  );
  const newLogs: WatchLog[] = [primaryLog];
  const addedMovies: MovieItem[] = [];
  let syncedProfilesCount = 0;

  for (const coWatcherId of coWatcherIds) {
    const otherIdsForCoWatcher = allParticipantIds.filter((id) => id !== coWatcherId);
    const dup = findMovieDuplicates(
      {
        title: sourceMovie.title,
        director: sourceMovie.director,
        releaseYear: sourceMovie.releaseYear,
        mediaType: sourceMovie.mediaType,
        tmdbId: sourceMovie.tmdbId,
        imdbId: sourceMovie.imdbId,
      },
      nextMovies,
      db.profiles,
      coWatcherId,
    );

    const existingMatch = dup.ownMatches[0];
    let targetMovieId: string;
    let targetCycle = 1;

    if (existingMatch) {
      // Never overwrite co-watcher's personal rating or review!
      const coState = computeNextMovieState(existingMatch, {
        date: input.date,
        minutesWatched: input.minutesWatched,
        episodesCount: input.episodesCount,
        seasonNumber: input.seasonNumber,
        episodeNumber: input.episodeNumber,
        medium: cleanMedium,
        serviceName: cleanService,
        markWatched: shouldMarkWatched,
        otherParticipantIds: otherIdsForCoWatcher,
        guestNames: cleanGuests,
        watchGroupId,
        now,
      });
      targetMovieId = existingMatch.id;
      targetCycle = coState.cycleIndex;
      nextMovies = nextMovies.map((m) =>
        m.id === existingMatch.id ? coState.updatedMovie : m,
      );
    } else {
      const targetShelves = db.shelves
        .filter((s) => s.profileId === coWatcherId && !s.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      targetMovieId = generateId('movie');
      const createdMovie: MovieItem = {
        id: targetMovieId,
        profileId: coWatcherId,
        shelfIds: targetShelves[0] ? [targetShelves[0].id] : [],
        mediaType: sourceMovie.mediaType,
        title: sourceMovie.title,
        originalTitle: sourceMovie.originalTitle,
        director: sourceMovie.director,
        cast: sourceMovie.cast ? [...sourceMovie.cast] : undefined,
        releaseYear: sourceMovie.releaseYear,
        endYear: sourceMovie.endYear,
        runtimeMinutes: sourceMovie.runtimeMinutes,
        totalSeasons: sourceMovie.totalSeasons,
        totalEpisodes: sourceMovie.totalEpisodes,
        currentSeason:
          sourceMovie.mediaType === 'series'
            ? input.seasonNumber ?? 1
            : undefined,
        currentEpisode:
          sourceMovie.mediaType === 'series'
            ? input.episodeNumber ?? (input.episodesCount || undefined)
            : undefined,
        episodesWatched:
          sourceMovie.mediaType === 'series'
            ? shouldMarkWatched && (sourceMovie.totalEpisodes ?? 0) > 0
              ? sourceMovie.totalEpisodes
              : input.episodesCount || undefined
            : undefined,
        watchedMinutes:
          shouldMarkWatched && sourceMovie.mediaType === 'movie' && sourceMovie.runtimeMinutes > 0
            ? Math.max(sourceMovie.runtimeMinutes, Math.round(input.minutesWatched || 0))
            : Math.round(input.minutesWatched || 0) || undefined,
        certification: sourceMovie.certification,
        genres: [...sourceMovie.genres],
        language: sourceMovie.language || 'English',
        posterUrl: sourceMovie.posterUrl,
        backdropUrl: sourceMovie.backdropUrl,
        trailerUrl: sourceMovie.trailerUrl,
        franchise: sourceMovie.franchise,
        franchiseIndex: sourceMovie.franchiseIndex,
        tmdbId: sourceMovie.tmdbId,
        imdbId: sourceMovie.imdbId,
        tvmazeId: sourceMovie.tvmazeId,
        externalRatings: sourceMovie.externalRatings,
        watchProviders: sourceMovie.watchProviders,
        medium: cleanMedium,
        serviceName: cleanService,
        ownership: sourceMovie.ownership,
        ownershipNote: sourceMovie.ownershipNote,
        status: shouldMarkWatched ? 'watched' : 'watching',
        rating: 0, // Personal rating belongs to each viewer
        dateStarted: input.date,
        dateWatched: shouldMarkWatched ? input.date : undefined,
        watchedWithProfileIds: otherIdsForCoWatcher,
        watchedWithGuests: cleanGuests,
        synopsis: sourceMovie.synopsis,
        notes: '',
        tags: stripQueueTags(sourceMovie.tags),
        addedAt: now,
        updatedAt: now,
      };
      addedMovies.push(createdMovie);
    }

    const coLog: WatchLog = {
      id: generateId('wlog'),
      profileId: coWatcherId,
      movieId: targetMovieId,
      date: input.date,
      minutesWatched: Math.max(0, Math.round(input.minutesWatched || 0)),
      episodesCount:
        input.episodesCount !== undefined && input.episodesCount > 0
          ? Math.round(input.episodesCount)
          : undefined,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      medium: cleanMedium,
      serviceName: cleanService,
      watchCycle: targetCycle,
      watchGroupId,
      watchedWithProfileIds: otherIdsForCoWatcher,
      watchedWithGuests: cleanGuests,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    newLogs.push(coLog);
    syncedProfilesCount += 1;
  }

  return {
    db: {
      ...db,
      movies: [...addedMovies, ...nextMovies],
      watchLogs: [...newLogs, ...db.watchLogs],
    },
    primaryLog,
    syncedProfilesCount,
  };
}

/**
 * Retroactively adds family co-watchers to an existing watch (or movie marked watched),
 * creating/updating matching entries on the added family members' shelves and linking everyone.
 */
export function addCoWatchersToExistingWatch(
  db: MovieLibraryDatabase,
  activeProfileId: string,
  input: AddCoWatchersInput,
): { db: MovieLibraryDatabase; addedCount: number } {
  const sourceMovie = db.movies.find((m) => m.id === input.movieId && !m.deletedAt);
  if (!sourceMovie) return { db, addedCount: 0 };

  const activeProfileIdsSet = new Set(
    db.profiles.filter((p) => !p.deletedAt).map((p) => p.id),
  );
  const newCoWatcherIds = uniqueIds(input.coWatcherProfileIds).filter(
    (id) => id !== activeProfileId && activeProfileIdsSet.has(id),
  );
  if (newCoWatcherIds.length === 0 && !input.guestNames?.trim()) {
    return { db, addedCount: 0 };
  }

  const now = new Date().toISOString();
  const targetLog = input.logId
    ? db.watchLogs.find((l) => l.id === input.logId && !l.deletedAt)
    : db.watchLogs.find(
        (l) => l.movieId === sourceMovie.id && l.profileId === activeProfileId && !l.deletedAt,
      );

  const watchGroupId = targetLog?.watchGroupId || generateId('wgrp');
  const existingGroupParticipants = targetLog
    ? [targetLog.profileId, ...(targetLog.watchedWithProfileIds || [])]
    : [activeProfileId, ...(sourceMovie.watchedWithProfileIds || [])];
  const allParticipants = uniqueIds([...existingGroupParticipants, ...newCoWatcherIds]);
  const mergedGuests = mergeGuestText(
    targetLog?.watchedWithGuests || sourceMovie.watchedWithGuests,
    input.guestNames,
  );

  // Update active movie and existing logs in group
  let nextMovies = db.movies.map((m) => {
    if (m.id !== sourceMovie.id) return m;
    return {
      ...m,
      watchedWithProfileIds: allParticipants.filter((id) => id !== m.profileId),
      watchedWithGuests: mergedGuests,
      updatedAt: now,
    };
  });

  const nextLogs = db.watchLogs.map((l) => {
    const matchesTarget =
      (targetLog && l.id === targetLog.id) ||
      (targetLog?.watchGroupId && l.watchGroupId === targetLog.watchGroupId);
    if (!matchesTarget) return l;
    return {
      ...l,
      watchGroupId,
      watchedWithProfileIds: allParticipants.filter((id) => id !== l.profileId),
      watchedWithGuests: mergedGuests,
      updatedAt: now,
    };
  });

  const addedMovies: MovieItem[] = [];
  const addedLogs: WatchLog[] = [];
  let addedCount = 0;

  // Ensure primary has a log if none existed yet
  if (!targetLog) {
    addedLogs.push({
      id: generateId('wlog'),
      profileId: activeProfileId,
      movieId: sourceMovie.id,
      date: input.date || sourceMovie.dateWatched || now.split('T')[0],
      minutesWatched: sourceMovie.runtimeMinutes || 0,
      medium: sourceMovie.medium,
      serviceName: sourceMovie.serviceName,
      watchCycle: (sourceMovie.watchHistory?.length ?? 0) + 1,
      watchGroupId,
      watchedWithProfileIds: allParticipants.filter((id) => id !== activeProfileId),
      watchedWithGuests: mergedGuests,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const coId of newCoWatcherIds) {
    const alreadyHasGroupLog = nextLogs.some(
      (l) => !l.deletedAt && l.watchGroupId === watchGroupId && l.profileId === coId,
    );
    const otherIds = allParticipants.filter((id) => id !== coId);
    const dup = findMovieDuplicates(
      {
        title: sourceMovie.title,
        director: sourceMovie.director,
        releaseYear: sourceMovie.releaseYear,
        mediaType: sourceMovie.mediaType,
        tmdbId: sourceMovie.tmdbId,
        imdbId: sourceMovie.imdbId,
      },
      nextMovies,
      db.profiles,
      coId,
    );

    const match = dup.ownMatches[0];
    let targetMovieId: string;

    if (match) {
      targetMovieId = match.id;
      const shouldSetWatched = sourceMovie.status === 'watched' && match.status !== 'watched';
      nextMovies = nextMovies.map((m) =>
        m.id === match.id
          ? {
              ...m,
              status: shouldSetWatched ? 'watched' : m.status,
              dateWatched: shouldSetWatched ? m.dateWatched || input.date : m.dateWatched,
              dateStarted: m.dateStarted || input.date,
              watchedWithProfileIds: mergeCoWatcherIds(m.watchedWithProfileIds, otherIds, coId),
              watchedWithGuests: mergeGuestText(m.watchedWithGuests, mergedGuests),
              updatedAt: now,
            }
          : m,
      );
    } else {
      const targetShelves = db.shelves
        .filter((s) => s.profileId === coId && !s.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      targetMovieId = generateId('movie');
      addedMovies.push({
        id: targetMovieId,
        profileId: coId,
        shelfIds: targetShelves[0] ? [targetShelves[0].id] : [],
        mediaType: sourceMovie.mediaType,
        title: sourceMovie.title,
        originalTitle: sourceMovie.originalTitle,
        director: sourceMovie.director,
        cast: sourceMovie.cast ? [...sourceMovie.cast] : undefined,
        releaseYear: sourceMovie.releaseYear,
        endYear: sourceMovie.endYear,
        runtimeMinutes: sourceMovie.runtimeMinutes,
        totalSeasons: sourceMovie.totalSeasons,
        totalEpisodes: sourceMovie.totalEpisodes,
        currentSeason: sourceMovie.currentSeason,
        currentEpisode: sourceMovie.currentEpisode,
        episodesWatched: sourceMovie.episodesWatched,
        watchedMinutes: sourceMovie.watchedMinutes,
        certification: sourceMovie.certification,
        genres: [...sourceMovie.genres],
        language: sourceMovie.language || 'English',
        posterUrl: sourceMovie.posterUrl,
        backdropUrl: sourceMovie.backdropUrl,
        trailerUrl: sourceMovie.trailerUrl,
        franchise: sourceMovie.franchise,
        franchiseIndex: sourceMovie.franchiseIndex,
        tmdbId: sourceMovie.tmdbId,
        imdbId: sourceMovie.imdbId,
        tvmazeId: sourceMovie.tvmazeId,
        externalRatings: sourceMovie.externalRatings,
        watchProviders: sourceMovie.watchProviders,
        medium: sourceMovie.medium,
        serviceName: sourceMovie.serviceName,
        ownership: sourceMovie.ownership,
        ownershipNote: sourceMovie.ownershipNote,
        status: sourceMovie.status === 'watched' ? 'watched' : 'watching',
        rating: 0,
        dateStarted: input.date || sourceMovie.dateStarted,
        dateWatched: sourceMovie.status === 'watched' ? input.date || sourceMovie.dateWatched : undefined,
        watchedWithProfileIds: otherIds,
        watchedWithGuests: mergedGuests,
        synopsis: sourceMovie.synopsis,
        notes: '',
        tags: stripQueueTags(sourceMovie.tags),
        addedAt: now,
        updatedAt: now,
      });
    }

    if (!alreadyHasGroupLog) {
      addedLogs.push({
        id: generateId('wlog'),
        profileId: coId,
        movieId: targetMovieId,
        date: targetLog?.date || input.date || sourceMovie.dateWatched || now.split('T')[0],
        minutesWatched: targetLog?.minutesWatched ?? sourceMovie.runtimeMinutes ?? 0,
        episodesCount: targetLog?.episodesCount,
        seasonNumber: targetLog?.seasonNumber,
        episodeNumber: targetLog?.episodeNumber,
        medium: targetLog?.medium || sourceMovie.medium,
        serviceName: targetLog?.serviceName || sourceMovie.serviceName,
        watchCycle: 1,
        watchGroupId,
        watchedWithProfileIds: otherIds,
        watchedWithGuests: mergedGuests,
        note: targetLog?.note,
        createdAt: now,
        updatedAt: now,
      });
    }
    addedCount += 1;
  }

  return {
    db: {
      ...db,
      movies: [...addedMovies, ...nextMovies],
      watchLogs: [...addedLogs, ...nextLogs],
    },
    addedCount,
  };
}
