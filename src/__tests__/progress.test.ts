import { describe, expect, it } from 'vitest';
import type { MovieItem, WatchLog } from '../types/movie';
import {
  formatRuntimeHuman,
  formatWatchHours,
  formatWatchLogBadge,
  getMovieProgressInfo,
} from '../utils/progress';

const now = '2026-03-01T00:00:00.000Z';

describe('progress formatters', () => {
  it('formats runtimes and hours cleanly', () => {
    expect(formatRuntimeHuman(140)).toBe('2h 20m');
    expect(formatRuntimeHuman(120)).toBe('2h');
    expect(formatRuntimeHuman(45)).toBe('45m');
    expect(formatWatchHours(90)).toBe('1.5h');
    expect(formatWatchHours(660)).toBe('11h');
  });

  it('computes movie and TV series progress percentages', () => {
    const movie: MovieItem = {
      id: 'm1',
      profileId: 'p1',
      shelfIds: [],
      mediaType: 'movie',
      title: 'Dune',
      director: 'Denis Villeneuve',
      runtimeMinutes: 150,
      watchedMinutes: 75,
      genres: [],
      status: 'watching',
      rating: 0,
      notes: '',
      tags: [],
      addedAt: now,
      updatedAt: now,
    };

    expect(getMovieProgressInfo(movie)).toMatchObject({
      percent: 50,
      label: '1h 15m / 2h 30m',
    });

    const series: MovieItem = {
      id: 's1',
      profileId: 'p1',
      shelfIds: [],
      mediaType: 'series',
      title: 'Severance',
      director: 'Ben Stiller',
      runtimeMinutes: 50,
      totalSeasons: 2,
      totalEpisodes: 20,
      currentSeason: 2,
      currentEpisode: 2,
      episodesWatched: 11,
      genres: [],
      status: 'watching',
      rating: 0,
      notes: '',
      tags: [],
      addedAt: now,
      updatedAt: now,
    };

    expect(getMovieProgressInfo(series)).toMatchObject({
      percent: 55,
      label: 'S2 · E2 (11 / 20 eps)',
      shortLabel: '11/20 eps',
    });
  });

  it('formats watch log badges for episode and minute logs', () => {
    const epLog: WatchLog = {
      id: 'l1',
      profileId: 'p1',
      movieId: 's1',
      date: '2026-03-01',
      minutesWatched: 50,
      episodesCount: 1,
      seasonNumber: 2,
      episodeNumber: 3,
      createdAt: now,
      updatedAt: now,
    };
    expect(formatWatchLogBadge(epLog)).toBe('+1 ep (S2E3) · +50m');
  });
});
