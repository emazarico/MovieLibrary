import { describe, expect, it } from 'vitest';
import type { MovieLibraryDatabase } from '../types/movie';
import {
  buildPdfReportData,
  buildStandaloneReportHtml,
  type PdfReportOptions,
} from '../utils/pdfReport';

const now = '2026-03-01T00:00:00.000Z';

const testDb: MovieLibraryDatabase = {
  schemaVersion: 1,
  dbId: 'db-pdf',
  updatedAt: now,
  profiles: [
    {
      id: 'p1',
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
  ],
  shelves: [],
  movies: [
    {
      id: 'm1',
      profileId: 'p1',
      shelfIds: [],
      mediaType: 'movie',
      title: 'Dune: Part Two',
      director: 'Denis Villeneuve',
      releaseYear: 2024,
      runtimeMinutes: 166,
      genres: ['Sci-Fi'],
      posterUrl: 'https://image.tmdb.org/t/p/w500/dune.jpg',
      status: 'watched',
      rating: 5,
      dateWatched: '2026-02-15',
      review: 'Monolithic sci-fi.',
      notes: '',
      tags: ['imax'],
      addedAt: now,
      updatedAt: now,
    },
    {
      id: 'm2',
      profileId: 'p1',
      shelfIds: [],
      mediaType: 'movie',
      title: 'Custom Local Film',
      director: 'Local Director',
      runtimeMinutes: 90,
      genres: ['Drama'],
      posterUrl: 'idb-poster:abc-123',
      status: 'watched',
      rating: 4,
      dateWatched: '2026-02-18',
      notes: '',
      tags: [],
      addedAt: now,
      updatedAt: now,
    },
  ],
  watchLogs: [],
};

describe('pdfReport builders', () => {
  it('filters movies, omits idb-poster URLs in standalone HTML, and supports handout layout', () => {
    const baseOpts: PdfReportOptions = {
      profileIds: ['p1'],
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
      statuses: ['watched'],
      mediaTypeFilter: 'movie',
      tagFilter: '',
      layout: 'cards',
      theme: 'classic',
      orientation: 'portrait',
      includeSummaryAndChart: true,
      includeTimeline: true,
      includeNotes: true,
      includeWatchLogs: false,
      title: 'February Watch Report',
    };

    const report = buildPdfReportData(testDb, baseOpts);
    expect(report.totalTitles).toBe(2);
    expect(report.totalMinutesWatched).toBe(256);
    expect(report.averageRating).toBe(4.5);

    const html = buildStandaloneReportHtml(report, baseOpts);
    expect(html).toContain('Dune: Part Two');
    expect(html).toContain('https://image.tmdb.org/t/p/w500/dune.jpg');
    expect(html).not.toContain('idb-poster:abc-123');

    const handoutHtml = buildStandaloneReportHtml(report, {
      ...baseOpts,
      layout: 'handout',
      handoutMovieId: 'm1',
      theme: 'modern',
    });
    expect(handoutHtml).toContain('Movie Night Discussion Guide');
    expect(handoutHtml).toContain('Dune: Part Two');
  });
});
