import type { MediaType, MovieItem, UserProfile } from '../types/movie';

export interface DuplicateMatchItem {
  movie: MovieItem;
  ownerName: string;
  ownerEmoji: string;
}

export interface DuplicateCheckResult {
  ownMatches: MovieItem[];
  householdMatches: DuplicateMatchItem[];
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeImdbId(imdbId?: string): string {
  return imdbId ? imdbId.trim().toLowerCase() : '';
}

export function findMovieDuplicates(
  candidate: {
    title: string;
    director?: string;
    releaseYear?: number;
    mediaType?: MediaType;
    tmdbId?: number;
    imdbId?: string;
    excludeMovieId?: string;
  },
  allMovies: MovieItem[],
  profiles: UserProfile[],
  activeProfileId: string | null,
): DuplicateCheckResult {
  const cleanImdb = normalizeImdbId(candidate.imdbId);
  const cleanTitle = normalizeTitle(candidate.title || '');
  const cleanDirector = (candidate.director || '').trim().toLowerCase();

  if (!cleanImdb && !candidate.tmdbId && !cleanTitle) {
    return { ownMatches: [], householdMatches: [] };
  }

  const profileMap = new Map(
    profiles.filter((p) => !p.deletedAt).map((p) => [p.id, p]),
  );

  const ownMatches: MovieItem[] = [];
  const householdMatches: DuplicateMatchItem[] = [];

  for (const movie of allMovies) {
    if (movie.deletedAt) continue;
    if (candidate.excludeMovieId && movie.id === candidate.excludeMovieId) continue;

    const tmdbMatched = Boolean(
      candidate.tmdbId &&
        movie.tmdbId &&
        candidate.tmdbId === movie.tmdbId &&
        (!candidate.mediaType || candidate.mediaType === movie.mediaType),
    );
    const imdbMatched = Boolean(
      cleanImdb && movie.imdbId && normalizeImdbId(movie.imdbId) === cleanImdb,
    );

    let titleMatched = false;
    if (cleanTitle && normalizeTitle(movie.title) === cleanTitle) {
      if (candidate.mediaType && movie.mediaType !== candidate.mediaType) {
        titleMatched = false;
      } else if (candidate.releaseYear && movie.releaseYear) {
        titleMatched = Math.abs(candidate.releaseYear - movie.releaseYear) <= 1;
      } else if (cleanDirector && movie.director) {
        titleMatched = movie.director.trim().toLowerCase() === cleanDirector;
      } else {
        titleMatched = true;
      }
    }

    if (!tmdbMatched && !imdbMatched && !titleMatched) continue;

    if (activeProfileId && movie.profileId === activeProfileId) {
      ownMatches.push(movie);
    } else {
      const owner = profileMap.get(movie.profileId);
      if (owner) {
        householdMatches.push({
          movie,
          ownerName: owner.name,
          ownerEmoji: owner.avatarEmoji,
        });
      }
    }
  }

  return { ownMatches, householdMatches };
}
