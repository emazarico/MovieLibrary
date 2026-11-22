import { describe, expect, it } from 'vitest';
import type { MovieLibraryDatabase } from '../types/movie';
import { addCoWatchersToExistingWatch, applyWatchEventToDatabase } from '../utils/cowatch';

function makeHouseholdDb(): MovieLibraryDatabase {
  const now = '2026-02-01T00:00:00.000Z';
  return {
    schemaVersion: 1,
    dbId: 'db-test',
    updatedAt: now,
    profiles: [
      {
        id: 'p-alex',
        name: 'Alex',
        avatarEmoji: '🦉',
        avatarTheme: 'rose',
        role: 'admin',
        pinHash: null,
        yearlyMovieGoal: 40,
        monthlyWatchHoursGoal: 15,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'p-maya',
        name: 'Maya',
        avatarEmoji: '🦊',
        avatarTheme: 'indigo',
        role: 'member',
        pinHash: null,
        yearlyMovieGoal: 40,
        monthlyWatchHoursGoal: 15,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'p-sam',
        name: 'Sam',
        avatarEmoji: '🐻',
        avatarTheme: 'amber',
        role: 'member',
        pinHash: null,
        yearlyMovieGoal: 30,
        monthlyWatchHoursGoal: 12,
        createdAt: now,
        updatedAt: now,
      },
    ],
    shelves: [
      {
        id: 's-alex',
        profileId: 'p-alex',
        name: 'Watchlist',
        color: 'rose',
        icon: 'film',
        visible: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 's-maya',
        profileId: 'p-maya',
        name: 'Queue',
        color: 'indigo',
        icon: 'film',
        visible: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 's-sam',
        profileId: 'p-sam',
        name: 'Favorites',
        color: 'amber',
        icon: 'film',
        visible: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    movies: [
      {
        id: 'm-alex-flow',
        profileId: 'p-alex',
        shelfIds: ['s-alex'],
        mediaType: 'movie',
        title: 'Flow',
        director: 'Gints Zilbalodis',
        releaseYear: 2024,
        runtimeMinutes: 85,
        genres: ['Animation', 'Adventure'],
        tmdbId: 823219,
        status: 'want-to-watch',
        rating: 0,
        notes: '',
        tags: ['watchlist', 'family-night'],
        addedAt: now,
        updatedAt: now,
      },
      {
        id: 'm-maya-flow',
        profileId: 'p-maya',
        shelfIds: ['s-maya'],
        mediaType: 'movie',
        title: 'Flow',
        director: 'Gints Zilbalodis',
        releaseYear: 2024,
        runtimeMinutes: 85,
        genres: ['Animation', 'Adventure'],
        tmdbId: 823219,
        status: 'watched',
        rating: 4,
        review: 'Maya personal review stays untouched!',
        notes: '',
        tags: ['favorite'],
        addedAt: now,
        updatedAt: now,
      },
    ],
    watchLogs: [],
  };
}

describe('co-watching utilities', () => {
  it('syncs watch event to family members without overwriting existing personal rating/review', () => {
    const db = makeHouseholdDb();
    const res = applyWatchEventToDatabase(db, 'p-alex', {
      movieId: 'm-alex-flow',
      date: '2026-02-14',
      minutesWatched: 85,
      medium: 'streaming',
      serviceName: 'Max',
      markWatched: true,
      finalRating: 5,
      finalReview: 'Alex rated 5 stars!',
      coWatcherProfileIds: ['p-maya', 'p-sam'],
      watchedWithGuests: 'Grandma',
      note: 'Friday Family Movie Night',
    });

    expect(res.syncedProfilesCount).toBe(2);
    expect(res.primaryLog?.watchGroupId).toBeTruthy();

    const groupId = res.primaryLog!.watchGroupId!;
    const groupLogs = res.db.watchLogs.filter((l) => l.watchGroupId === groupId);
    expect(groupLogs).toHaveLength(3);

    // Maya already had Flow with 4★ & custom review: must NOT be overwritten
    const mayaMovie = res.db.movies.find((m) => m.id === 'm-maya-flow')!;
    expect(mayaMovie.rating).toBe(4);
    expect(mayaMovie.review).toBe('Maya personal review stays untouched!');
    expect(mayaMovie.watchedWithProfileIds).toEqual(expect.arrayContaining(['p-alex', 'p-sam']));

    // Sam did not have Flow yet: auto-created on Sam's shelf without watchlist/wishlist tags
    const samMovie = res.db.movies.find((m) => m.profileId === 'p-sam')!;
    expect(samMovie).toBeTruthy();
    expect(samMovie.status).toBe('watched');
    expect(samMovie.rating).toBe(0);
    expect(samMovie.tags).toEqual(['family-night']);
    expect(samMovie.watchedWithGuests).toBe('Grandma');
  });

  it('retroactively adds family members to an existing solo watch', () => {
    const db = makeHouseholdDb();
    const solo = applyWatchEventToDatabase(db, 'p-alex', {
      movieId: 'm-alex-flow',
      date: '2026-02-14',
      minutesWatched: 85,
      markWatched: true,
      finalRating: 5,
    });

    const retro = addCoWatchersToExistingWatch(solo.db, 'p-alex', {
      movieId: 'm-alex-flow',
      logId: solo.primaryLog!.id,
      date: '2026-02-14',
      coWatcherProfileIds: ['p-sam'],
    });

    expect(retro.addedCount).toBe(1);
    const samMovie = retro.db.movies.find((m) => m.profileId === 'p-sam');
    const samLogs = retro.db.watchLogs.filter((l) => l.profileId === 'p-sam');
    expect(samMovie?.status).toBe('watched');
    expect(samLogs).toHaveLength(1);
    expect(samLogs[0].watchedWithProfileIds).toContain('p-alex');
  });
});
