import { describe, expect, it } from 'vitest';
import type { MovieItem, WatchLog } from '../types/movie';
import { buildDailyWatchHeatmap, computeWatchAnalyticsBreakdown } from '../utils/analytics';

const now = '2026-03-10T00:00:00.000Z';

describe('analytics utilities', () => {
  it('computes heatmap intensity, longest streak, and co-watch counts', () => {
    const movies: MovieItem[] = [
      {
        id: 'm1',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'movie',
        title: 'Spider-Verse',
        director: 'Joaquim Dos Santos',
        runtimeMinutes: 140,
        genres: ['Animation', 'Sci-Fi'],
        medium: 'streaming',
        status: 'watched',
        rating: 5,
        dateWatched: '2026-01-05',
        watchedWithProfileIds: ['p2'],
        notes: '',
        tags: ['watchlist', 'animation'],
        addedAt: now,
        updatedAt: now,
      },
      {
        id: 'm2',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'series',
        title: 'Severance',
        director: 'Ben Stiller',
        runtimeMinutes: 50,
        genres: ['Drama'],
        medium: 'theater',
        status: 'watched',
        rating: 4,
        dateWatched: '2026-01-06',
        notes: '',
        tags: ['mystery'],
        addedAt: now,
        updatedAt: now,
      },
    ];

    const logs: WatchLog[] = [
      {
        id: 'l1',
        profileId: 'p1',
        movieId: 'm1',
        date: '2026-01-05',
        minutesWatched: 140,
        watchedWithProfileIds: ['p2'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'l2',
        profileId: 'p1',
        movieId: 'm2',
        date: '2026-01-06',
        minutesWatched: 50,
        episodesCount: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const heatmap = buildDailyWatchHeatmap(movies, logs, 2026);
    expect(heatmap.totalActiveDays).toBe(2);
    expect(heatmap.longestStreak).toBe(2);
    expect(heatmap.totalSessions).toBe(2);

    const breakdown = computeWatchAnalyticsBreakdown(movies, logs, 2026);
    expect(breakdown.scopeLabel).toBe('watched titles');
    expect(breakdown.pace.movieCount).toBe(1);
    expect(breakdown.pace.seriesCount).toBe(1);
    expect(breakdown.pace.coWatchPercent).toBe(50);
    expect(breakdown.topGenresAndTags.some((g) => g.label === '#watchlist')).toBe(false);
    expect(breakdown.ratingDistribution.find((r) => r.stars === 5)?.count).toBe(1);
  });
});
