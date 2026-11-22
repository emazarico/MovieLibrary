import { describe, expect, it } from 'vitest';
import type { MovieItem, WatchLog } from '../types/movie';
import {
  buildTimelineGroups,
  computeDailyStreak,
  computeMonthlyStats,
  computeWatchSummary,
  getAvailableYears,
} from '../utils/stats';

const now = '2026-03-10T00:00:00.000Z';

describe('stats utilities', () => {
  it('avoids double-counting backfill when WatchLogs cover partial or full runtime', () => {
    const movies: MovieItem[] = [
      {
        id: 'm1',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'movie',
        title: 'Dune',
        director: 'Denis Villeneuve',
        runtimeMinutes: 150,
        genres: ['Sci-Fi'],
        status: 'watched',
        rating: 5,
        dateWatched: '2026-02-20',
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
        date: '2026-02-19',
        minutesWatched: 60,
        watchCycle: 1,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const buckets = computeMonthlyStats(movies, logs, 2026, true);
    const feb = buckets[1];
    expect(feb.titlesWatched).toBe(1);
    expect(feb.loggedMinutes).toBe(60);
    expect(feb.backfillMinutes).toBe(90);
    expect(feb.minutesWatched).toBe(150);

    const summary = computeWatchSummary(movies, logs, 2026, true, new Date(2026, 1, 20));
    expect(summary.totalMinutes).toBe(150);
    expect(summary.titlesWatched).toBe(1);
  });

  it('tracks daily streaks accurately up to reference date or yesterday', () => {
    const logs: WatchLog[] = [
      { id: 'l1', profileId: 'p1', movieId: 'm1', date: '2026-03-08', minutesWatched: 45, createdAt: now, updatedAt: now },
      { id: 'l2', profileId: 'p1', movieId: 'm1', date: '2026-03-09', minutesWatched: 50, createdAt: now, updatedAt: now },
      { id: 'l3', profileId: 'p1', movieId: 'm1', date: '2026-03-10', minutesWatched: 30, createdAt: now, updatedAt: now },
    ];
    expect(computeDailyStreak(logs, new Date(2026, 2, 10))).toBe(3);
    expect(computeDailyStreak(logs, new Date(2026, 2, 11))).toBe(3);
    expect(computeDailyStreak(logs, new Date(2026, 2, 12))).toBe(0);
  });

  it('builds descending monthly timeline groups and extracts available years', () => {
    const movies: MovieItem[] = [
      {
        id: 'm1',
        profileId: 'p1',
        shelfIds: [],
        mediaType: 'movie',
        title: 'Old Classic',
        director: 'Dir',
        runtimeMinutes: 100,
        genres: [],
        status: 'watched',
        rating: 4,
        dateWatched: '2024-06-15',
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
        title: 'Recent Watch',
        director: 'Dir',
        runtimeMinutes: 120,
        genres: [],
        status: 'watched',
        rating: 5,
        dateWatched: '2026-01-12',
        notes: '',
        tags: [],
        addedAt: now,
        updatedAt: now,
      },
    ];
    const years = getAvailableYears(movies, []);
    expect(years).toContain(2024);
    expect(years).toContain(2026);

    const groups = buildTimelineGroups(movies, 'all');
    expect(groups[0].monthKey).toBe('2026-01');
    expect(groups[1].monthKey).toBe('2024-06');
  });
});
