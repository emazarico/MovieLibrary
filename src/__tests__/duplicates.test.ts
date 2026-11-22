import { describe, expect, it } from 'vitest';
import type { MovieItem, UserProfile } from '../types/movie';
import { findMovieDuplicates } from '../utils/duplicates';

const now = '2026-01-10T00:00:00.000Z';

const profiles: UserProfile[] = [
  {
    id: 'p-alex',
    name: 'Alex',
    avatarEmoji: '🦉',
    avatarTheme: 'rose',
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
    pinHash: null,
    yearlyMovieGoal: 40,
    monthlyWatchHoursGoal: 15,
    createdAt: now,
    updatedAt: now,
  },
];

function makeMovie(overrides: Partial<MovieItem>): MovieItem {
  return {
    id: 'm1',
    profileId: 'p-alex',
    shelfIds: [],
    mediaType: 'movie',
    title: 'Spirited Away',
    director: 'Hayao Miyazaki',
    releaseYear: 2001,
    runtimeMinutes: 125,
    genres: ['Animation'],
    tmdbId: 129,
    imdbId: 'tt0245429',
    status: 'watched',
    rating: 5,
    notes: '',
    tags: [],
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('findMovieDuplicates', () => {
  it('detects own and household matches by TMDB ID and IMDb ID', () => {
    const movies = [
      makeMovie({ id: 'm1', profileId: 'p-alex', tmdbId: 129, imdbId: 'tt0245429' }),
      makeMovie({ id: 'm2', profileId: 'p-maya', tmdbId: 129, imdbId: 'tt0245429' }),
    ];

    const res = findMovieDuplicates(
      { title: 'Sen to Chihiro', tmdbId: 129, mediaType: 'movie' },
      movies,
      profiles,
      'p-alex',
    );
    expect(res.ownMatches.map((m) => m.id)).toEqual(['m1']);
    expect(res.householdMatches).toHaveLength(1);
    expect(res.householdMatches[0].ownerName).toBe('Maya');
  });

  it('isolates TMDB ID checks across movie vs TV series mediaType', () => {
    const movies = [
      makeMovie({ id: 'm-tv', profileId: 'p-alex', mediaType: 'series', title: 'Show 129', tmdbId: 129, imdbId: undefined }),
    ];

    const res = findMovieDuplicates(
      { title: 'Film 129', mediaType: 'movie', tmdbId: 129 },
      movies,
      profiles,
      'p-alex',
    );
    expect(res.ownMatches).toHaveLength(0);
  });

  it('respects excludeMovieId and soft-deleted entries', () => {
    const movies = [
      makeMovie({ id: 'm1', profileId: 'p-alex' }),
      makeMovie({ id: 'm2', profileId: 'p-maya', deletedAt: now }),
    ];

    const res = findMovieDuplicates(
      { title: 'Spirited Away', releaseYear: 2001, mediaType: 'movie', excludeMovieId: 'm1' },
      movies,
      profiles,
      'p-alex',
    );
    expect(res.ownMatches).toHaveLength(0);
    expect(res.householdMatches).toHaveLength(0);
  });
});
