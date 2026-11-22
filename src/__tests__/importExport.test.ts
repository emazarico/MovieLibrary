import { describe, expect, it } from 'vitest';
import { applyImport, inspectImportFile } from '../services/importExport';
import type { MovieLibraryDatabase } from '../types/movie';

const baseDb: MovieLibraryDatabase = {
  schemaVersion: 1,
  dbId: 'db-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
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
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  shelves: [],
  movies: [],
  watchLogs: [],
};

describe('importExport parsers', () => {
  it('detects and imports Letterboxd CSV rows cleanly', () => {
    const csv = [
      'Date,Name,Year,Letterboxd URI,Rating,Watched Date,Tags,Review',
      '2026-02-10,"Spirited Away",2001,https://letterboxd.com/film/spirited-away/,5,2026-02-10,"animation, classic","Masterpiece"',
    ].join('\n');

    const preview = inspectImportFile('ratings.csv', csv, baseDb, 'p1');
    expect(preview.format).toBe('letterboxd-csv');
    expect(preview.summaryCounts.movies).toBe(1);

    const updated = applyImport(baseDb, 'p1', preview, 'merge');
    expect(updated.movies).toHaveLength(1);
    expect(updated.movies[0].title).toBe('Spirited Away');
    expect(updated.movies[0].rating).toBe(5);
    expect(updated.movies[0].status).toBe('watched');
    expect(updated.movies[0].tags).toEqual(['animation', 'classic']);
  });

  it('detects and scales CinemaTrack CSV 10-point scores to 5 stars', () => {
    const csv = [
      'ID,Title,Year,Status,Personal Score',
      '569094,"Spider-Man: Across the Spider-Verse",2023,Liked,9',
      '823219,"Flow",2024,Watchlist,',
    ].join('\n');

    const preview = inspectImportFile('cinematrack.csv', csv, baseDb, 'p1');
    expect(preview.format).toBe('cinematrack-csv');
    expect(preview.summaryCounts.movies).toBe(2);

    const updated = applyImport(baseDb, 'p1', preview, 'merge');
    const spider = updated.movies.find((m) => m.tmdbId === 569094)!;
    const flow = updated.movies.find((m) => m.tmdbId === 823219)!;

    expect(spider.status).toBe('watched');
    expect(spider.rating).toBe(4.5);
    expect(flow.status).toBe('want-to-watch');
    expect(flow.tags).toContain('watchlist');
  });

  it('detects IMDb CSV and OmniLibrary v3 JSON movie libraries', () => {
    const imdbCsv = [
      'Const,Your Rating,Date Rated,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors',
      'tt15239678,10,2024-03-02,Dune: Part Two,https://www.imdb.com/title/tt15239678/,movie,8.6,166,2024,"Action, Adventure, Sci-Fi",400000,2024-03-01,Denis Villeneuve',
    ].join('\n');

    const imdbPreview = inspectImportFile('ratings.csv', imdbCsv, baseDb, 'p1');
    expect(imdbPreview.format).toBe('imdb-csv');
    expect(imdbPreview.profileBundle?.movies[0].imdbId).toBe('tt15239678');
    expect(imdbPreview.profileBundle?.movies[0].runtimeMinutes).toBe(166);

    const v3Json = JSON.stringify({
      libraries: [
        {
          name: 'Classic Movies',
          type: 'movie',
          items: [{ title: 'Arrival', author: 'Denis Villeneuve', year: 2016, status: 'finished', rating: 5 }],
        },
        {
          name: 'Books Only',
          type: 'book',
          items: [{ title: 'Dune Novel', author: 'Frank Herbert' }],
        },
      ],
    });

    const v3Preview = inspectImportFile('v3-backup.json', v3Json, baseDb, 'p1');
    expect(v3Preview.format).toBe('v3-legacy-json');
    expect(v3Preview.summaryCounts.movies).toBe(1);
    expect(v3Preview.profileBundle?.movies[0].title).toBe('Arrival');
  });
});
