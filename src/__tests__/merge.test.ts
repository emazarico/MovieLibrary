import { describe, expect, it } from 'vitest';
import type { MovieLibraryDatabase } from '../types/movie';
import { mergeDatabases } from '../utils/merge';

function baseDb(overrides: Partial<MovieLibraryDatabase> = {}): MovieLibraryDatabase {
  return {
    schemaVersion: 1,
    dbId: 'db-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    profiles: [],
    shelves: [],
    movies: [],
    watchLogs: [],
    ...overrides,
  };
}

describe('mergeDatabases', () => {
  it('resolves LWW conflicts by updatedAt and propagates deletedAt tombstones', () => {
    const local = baseDb({
      householdSettings: {
        streamingRegion: 'US',
        subscribedServices: ['Netflix'],
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      movies: [
        {
          id: 'm1',
          profileId: 'p1',
          shelfIds: [],
          mediaType: 'movie',
          title: 'Local Newer Title',
          director: 'Dir',
          runtimeMinutes: 100,
          genres: [],
          status: 'watched',
          rating: 5,
          notes: '',
          tags: [],
          addedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
        {
          id: 'm2',
          profileId: 'p1',
          shelfIds: [],
          mediaType: 'movie',
          title: 'Active Locally',
          director: 'Dir',
          runtimeMinutes: 90,
          genres: [],
          status: 'want-to-watch',
          rating: 0,
          notes: '',
          tags: [],
          addedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const remote = baseDb({
      householdSettings: {
        streamingRegion: 'CA',
        subscribedServices: ['Netflix', 'Disney+'],
        updatedAt: '2026-01-10T00:00:00.000Z',
      },
      movies: [
        {
          id: 'm1',
          profileId: 'p1',
          shelfIds: [],
          mediaType: 'movie',
          title: 'Remote Older Title',
          director: 'Dir',
          runtimeMinutes: 100,
          genres: [],
          status: 'watching',
          rating: 0,
          notes: '',
          tags: [],
          addedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
        {
          id: 'm2',
          profileId: 'p1',
          shelfIds: [],
          mediaType: 'movie',
          title: 'Active Locally',
          director: 'Dir',
          runtimeMinutes: 90,
          genres: [],
          status: 'want-to-watch',
          rating: 0,
          notes: '',
          tags: [],
          addedAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-06T00:00:00.000Z',
          deletedAt: '2026-01-06T00:00:00.000Z',
        },
      ],
    });

    const merged = mergeDatabases(local, remote);
    const m1 = merged.movies.find((m) => m.id === 'm1');
    const m2 = merged.movies.find((m) => m.id === 'm2');

    expect(m1?.title).toBe('Local Newer Title');
    expect(m2?.deletedAt).toBe('2026-01-06T00:00:00.000Z');
    expect(merged.householdSettings?.streamingRegion).toBe('CA');
    expect(merged.householdSettings?.subscribedServices).toEqual(['Netflix', 'Disney+']);
  });
});
