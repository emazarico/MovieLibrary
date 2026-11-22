import { describe, expect, it } from 'vitest';
import type { MovieItem, WatchLog } from '../types/movie';
import { computeWatchBadges } from '../utils/badges';

const now = '2026-03-01T00:00:00.000Z';

describe('cinema milestones / badges', () => {
  it('evaluates unlocked milestones and preserves parent reward notes', () => {
    const movies: MovieItem[] = [
      {
        id: 'm1',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'movie',
        title: 'Into the Spider-Verse',
        director: 'Bob Persichetti',
        runtimeMinutes: 117,
        genres: ['Animation', 'Action', 'Sci-Fi', 'Adventure'],
        franchise: 'Spider-Verse',
        medium: 'theater',
        status: 'watched',
        rating: 5,
        review: 'Awesome film!',
        watchedWithProfileIds: ['p2'],
        dateWatched: '2026-01-10',
        notes: '',
        tags: [],
        addedAt: now,
        updatedAt: now,
      },
      {
        id: 'm2',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'movie',
        title: 'Across the Spider-Verse',
        director: 'Joaquim Dos Santos',
        runtimeMinutes: 140,
        genres: ['Animation', 'Family'],
        franchise: 'Spider-Verse',
        medium: 'streaming',
        status: 'watched',
        rating: 5,
        review: 'Best animated sequel.',
        watchedWithProfileIds: ['p2'],
        dateWatched: '2026-02-14',
        notes: '',
        tags: [],
        addedAt: now,
        updatedAt: now,
      },
    ];

    const logs: WatchLog[] = [
      {
        id: 'l1',
        profileId: 'p1',
        movieId: 'm1',
        date: '2026-01-10',
        minutesWatched: 117,
        medium: 'theater',
        watchedWithProfileIds: ['p2'],
        createdAt: now,
        updatedAt: now,
      },
    ];

    const badges = computeWatchBadges(movies, logs, {
      'first-watch': 'Pick dessert!',
      'franchise-fan': 'Cinema posters',
    });

    const firstWatch = badges.find((b) => b.id === 'first-watch')!;
    const bigScreen = badges.find((b) => b.id === 'big-screen')!;
    const genreExplorer = badges.find((b) => b.id === 'genre-explorer')!;
    const franchiseFan = badges.find((b) => b.id === 'franchise-fan')!;
    const critic = badges.find((b) => b.id === 'critic-3')!;

    expect(firstWatch.unlocked).toBe(true);
    expect(firstWatch.rewardNote).toBe('Pick dessert!');
    expect(bigScreen.unlocked).toBe(true);
    expect(genreExplorer.unlocked).toBe(true);
    expect(franchiseFan.unlocked).toBe(true);
    expect(critic.unlocked).toBe(false);
    expect(critic.current).toBe(2);
  });
});
