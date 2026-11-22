import type { MovieItem, WatchLog } from '../types/movie';
import { computeDailyStreak, computeWatchSummary } from './stats';

export interface WatchBadgeDefinition {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target: number;
  unitLabel: string;
}

export interface WatchBadge extends WatchBadgeDefinition {
  current: number;
  unlocked: boolean;
  progressPct: number;
  rewardNote?: string;
}

export const WATCH_BADGE_DEFINITIONS: WatchBadgeDefinition[] = [
  {
    id: 'first-watch',
    emoji: '🎬',
    title: 'Opening Night',
    description: 'Watch your very first movie or series.',
    target: 1,
    unitLabel: 'title',
  },
  {
    id: 'cinephile-10',
    emoji: '🍿',
    title: 'Cinephile',
    description: 'Finish watching 10 movies or series.',
    target: 10,
    unitLabel: 'titles',
  },
  {
    id: 'cinema-legend-25',
    emoji: '🏆',
    title: 'Cinema Legend',
    description: 'Finish watching 25 movies or series.',
    target: 25,
    unitLabel: 'titles',
  },
  {
    id: 'marathon-24h',
    emoji: '⏱️',
    title: '24-Hour Marathon',
    description: 'Log 24 hours (1,440 minutes) of total watch time.',
    target: 24,
    unitLabel: 'hours',
  },
  {
    id: 'family-night-5',
    emoji: '🛋️',
    title: 'Family Movie Night',
    description: 'Co-watch 5 titles or sessions with family members.',
    target: 5,
    unitLabel: 'family nights',
  },
  {
    id: 'big-screen',
    emoji: '🎟️',
    title: 'Big Screen Fan',
    description: 'Watch a movie in the theater.',
    target: 1,
    unitLabel: 'theater trip',
  },
  {
    id: 'critic-3',
    emoji: '✍️',
    title: 'Film Critic',
    description: 'Write 3 personal reviews.',
    target: 3,
    unitLabel: 'reviews',
  },
  {
    id: 'genre-explorer',
    emoji: '🧭',
    title: 'Genre Explorer',
    description: 'Watch titles across 4 distinct genres.',
    target: 4,
    unitLabel: 'genres',
  },
  {
    id: 'franchise-fan',
    emoji: '🌌',
    title: 'Franchise Binger',
    description: 'Watch 2 or more titles in the same franchise or series.',
    target: 2,
    unitLabel: 'in a franchise',
  },
];

function parseDayNumberUtc(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function computeBestLogStreak(logs: WatchLog[], referenceDate: Date): number {
  const dayNumbers = Array.from(
    new Set(
      logs
        .filter(
          (l) =>
            !l.deletedAt &&
            l.date &&
            ((l.minutesWatched || 0) > 0 || (l.episodesCount ?? 0) > 0),
        )
        .map((l) => parseDayNumberUtc(l.date))
        .filter((d): d is number => d !== null),
    ),
  ).sort((a, b) => a - b);

  let bestHistorical = 0;
  let run = 0;
  for (let i = 0; i < dayNumbers.length; i++) {
    if (i === 0 || dayNumbers[i] === dayNumbers[i - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestHistorical) bestHistorical = run;
  }

  return Math.max(bestHistorical, computeDailyStreak(logs, referenceDate));
}

/**
 * Evaluates all household-friendly cinema milestones & optional parent-configured rewards.
 */
export function computeWatchBadges(
  movies: MovieItem[],
  logs: WatchLog[],
  badgeRewards?: Record<string, string>,
  referenceDate: Date = new Date(),
): WatchBadge[] {
  const activeMovies = movies.filter((m) => !m.deletedAt);
  const activeLogs = logs.filter((l) => !l.deletedAt);

  const watchedMovies = activeMovies.filter((m) => m.status === 'watched');
  const summary = computeWatchSummary(activeMovies, activeLogs, 'all', true, referenceDate);
  const totalHours = Math.floor(summary.totalMinutes / 60);

  const coWatchMovieIds = new Set(
    activeMovies
      .filter(
        (m) =>
          (m.watchedWithProfileIds && m.watchedWithProfileIds.length > 0) ||
          Boolean(m.watchedWithGuests?.trim()),
      )
      .map((m) => m.id),
  );
  for (const log of activeLogs) {
    if (
      (log.watchedWithProfileIds && log.watchedWithProfileIds.length > 0) ||
      log.watchedWithGuests?.trim()
    ) {
      coWatchMovieIds.add(log.movieId);
    }
  }

  const theaterCount =
    activeMovies.filter((m) => m.medium === 'theater').length +
    activeLogs.filter((l) => l.medium === 'theater').length;

  const reviewsWritten = activeMovies.filter((m) => Boolean(m.review?.trim())).length;

  const distinctGenres = new Set<string>();
  for (const m of watchedMovies) {
    for (const g of m.genres) {
      const clean = g.trim().toLowerCase();
      if (clean) distinctGenres.add(clean);
    }
  }

  const franchiseCounts = new Map<string, number>();
  let maxFranchiseWatched = 0;
  for (const m of watchedMovies) {
    const key = m.franchise?.trim().toLowerCase();
    if (!key) continue;
    const next = (franchiseCounts.get(key) ?? 0) + 1;
    franchiseCounts.set(key, next);
    if (next > maxFranchiseWatched) maxFranchiseWatched = next;
  }

  // Keep helper used so unused warning doesn't fire if streak badge is added later
  void computeBestLogStreak;

  const metricById: Record<string, number> = {
    'first-watch': summary.titlesWatched,
    'cinephile-10': summary.titlesWatched,
    'cinema-legend-25': summary.titlesWatched,
    'marathon-24h': totalHours,
    'family-night-5': Math.max(coWatchMovieIds.size, summary.familyNightsCount),
    'big-screen': theaterCount,
    'critic-3': reviewsWritten,
    'genre-explorer': distinctGenres.size,
    'franchise-fan': maxFranchiseWatched,
  };

  return WATCH_BADGE_DEFINITIONS.map((def) => {
    const current = Math.max(0, metricById[def.id] ?? 0);
    const unlocked = current >= def.target;
    const progressPct = Math.min(
      100,
      Math.round((Math.min(current, def.target) / def.target) * 100),
    );
    const rewardNote = badgeRewards?.[def.id]?.trim() || undefined;

    return {
      ...def,
      current,
      unlocked,
      progressPct,
      rewardNote,
    };
  });
}
