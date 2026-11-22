import type { MovieItem, WatchLog, WatchMedium } from '../types/movie';
import { getMovieWatchedOccurrences, parseYearMonth } from './stats';

export interface HeatmapDay {
  date: string;
  inRange: boolean;
  minutes: number;
  episodes: number;
  sessions: number;
  watchedTitles: number;
  familyNights: number;
  score: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapMonthLabel {
  weekIndex: number;
  label: string;
}

export interface HeatmapData {
  startDate: string;
  endDate: string;
  weeks: HeatmapDay[][];
  monthLabels: HeatmapMonthLabel[];
  totalActiveDays: number;
  longestStreak: number;
  totalSessions: number;
  maxDailyScore: number;
}

export interface MediumSlice {
  medium: WatchMedium;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface GenreTagBreakdownItem {
  label: string;
  count: number;
  percent: number;
}

export interface RatingBucket {
  stars: 1 | 2 | 3 | 4 | 5;
  label: string;
  count: number;
  percent: number;
}

export interface WatchPaceStats {
  titlesPerMonth: number;
  totalHours: number;
  movieCount: number;
  seriesCount: number;
  coWatchPercent: number;
}

export interface WatchAnalyticsBreakdown {
  scopeLabel: 'watched titles' | 'all titles';
  totalTitlesEvaluated: number;
  mediumBreakdown: MediumSlice[];
  topGenresAndTags: GenreTagBreakdownItem[];
  ratingDistribution: RatingBucket[];
  pace: WatchPaceStats;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const IGNORED_TAGS = new Set(['watchlist', 'favorite', 'favorites', 'rewatch']);

function parseIsoDayUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function formatUtcDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalDayAsIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86_400_000;

export function buildDailyWatchHeatmap(
  movies: MovieItem[],
  logs: WatchLog[],
  yearFilter: number | 'all',
  referenceDate: Date = new Date(),
): HeatmapData {
  const startDate =
    typeof yearFilter === 'number'
      ? `${yearFilter}-01-01`
      : formatUtcDay(
          (parseIsoDayUtc(formatLocalDayAsIso(referenceDate)) ?? Date.UTC(2026, 0, 1)) -
            364 * DAY_MS,
        );
  const endDate =
    typeof yearFilter === 'number'
      ? `${yearFilter}-12-31`
      : formatLocalDayAsIso(referenceDate);

  const startMs = parseIsoDayUtc(startDate) ?? Date.UTC(2026, 0, 1);
  const endMs = parseIsoDayUtc(endDate) ?? startMs + 364 * DAY_MS;

  const dailyMap = new Map<
    string,
    {
      minutes: number;
      episodes: number;
      sessions: number;
      watchedTitles: number;
      familyNights: number;
    }
  >();

  const ensureDay = (iso: string) => {
    let entry = dailyMap.get(iso);
    if (!entry) {
      entry = {
        minutes: 0,
        episodes: 0,
        sessions: 0,
        watchedTitles: 0,
        familyNights: 0,
      };
      dailyMap.set(iso, entry);
    }
    return entry;
  };

  let totalSessions = 0;
  for (const log of logs) {
    if (log.deletedAt || !log.date) continue;
    const dayIso = log.date.slice(0, 10);
    if (dayIso < startDate || dayIso > endDate) continue;
    const entry = ensureDay(dayIso);
    entry.minutes += Math.max(0, log.minutesWatched || 0);
    entry.episodes += Math.max(0, log.episodesCount || 0);
    entry.sessions += 1;
    if ((log.watchedWithProfileIds && log.watchedWithProfileIds.length > 0) || log.watchedWithGuests) {
      entry.familyNights += 1;
    }
    totalSessions += 1;
  }

  for (const movie of movies) {
    if (movie.deletedAt) continue;
    for (const occ of getMovieWatchedOccurrences(movie)) {
      const finIso = occ.dateWatched?.slice(0, 10);
      if (!finIso || finIso < startDate || finIso > endDate) continue;
      ensureDay(finIso).watchedTitles += 1;
    }
  }

  let maxDailyScore = 0;
  let totalActiveDays = 0;
  let longestStreak = 0;
  let currentRun = 0;

  const scoreByDay = new Map<string, number>();
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const iso = formatUtcDay(ms);
    const rec = dailyMap.get(iso);
    const score = rec
      ? rec.minutes + rec.episodes * 25 + rec.watchedTitles * 40
      : 0;
    if (score > 0) {
      scoreByDay.set(iso, score);
      totalActiveDays += 1;
      currentRun += 1;
      if (currentRun > longestStreak) longestStreak = currentRun;
      if (score > maxDailyScore) maxDailyScore = score;
    } else {
      currentRun = 0;
    }
  }

  const startDow = new Date(startMs).getUTCDay();
  const endDow = new Date(endMs).getUTCDay();
  const gridStartMs = startMs - startDow * DAY_MS;
  const gridEndMs = endMs + (6 - endDow) * DAY_MS;

  const weeks: HeatmapDay[][] = [];
  const monthLabels: HeatmapMonthLabel[] = [];
  let lastLabeledMonth = -1;
  let lastLabeledWeek = -10;

  let currentWeek: HeatmapDay[] = [];
  for (let ms = gridStartMs; ms <= gridEndMs; ms += DAY_MS) {
    const d = new Date(ms);
    const iso = formatUtcDay(ms);
    const inRange = ms >= startMs && ms <= endMs;
    const rec = inRange ? dailyMap.get(iso) : undefined;
    const score = inRange ? scoreByDay.get(iso) ?? 0 : 0;

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (score > 0 && maxDailyScore > 0) {
      const ratio = score / maxDailyScore;
      if (ratio >= 0.75) level = 4;
      else if (ratio >= 0.45) level = 3;
      else if (ratio >= 0.2) level = 2;
      else level = 1;
    }

    if (inRange) {
      const month = d.getUTCMonth();
      const dayOfMonth = d.getUTCDate();
      const weekIndex = weeks.length;
      if (month !== lastLabeledMonth && (dayOfMonth <= 7 || weekIndex === 0)) {
        if (weekIndex - lastLabeledWeek >= 2) {
          monthLabels.push({ weekIndex, label: MONTH_SHORT[month] });
          lastLabeledMonth = month;
          lastLabeledWeek = weekIndex;
        }
      }
    }

    currentWeek.push({
      date: iso,
      inRange,
      minutes: rec?.minutes ?? 0,
      episodes: rec?.episodes ?? 0,
      sessions: rec?.sessions ?? 0,
      watchedTitles: rec?.watchedTitles ?? 0,
      familyNights: rec?.familyNights ?? 0,
      score,
      level,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return {
    startDate,
    endDate,
    weeks,
    monthLabels,
    totalActiveDays,
    longestStreak,
    totalSessions,
    maxDailyScore,
  };
}

export function computeWatchAnalyticsBreakdown(
  movies: MovieItem[],
  logs: WatchLog[],
  yearFilter: number | 'all',
  referenceDate: Date = new Date(),
): WatchAnalyticsBreakdown {
  const activeMovies = movies.filter((m) => !m.deletedAt);
  const activeLogs = logs.filter((l) => !l.deletedAt);

  const occurrencesInScope: Array<{
    movie: MovieItem;
    dateWatched?: string;
    rating?: number;
  }> = [];

  for (const movie of activeMovies) {
    for (const occ of getMovieWatchedOccurrences(movie)) {
      if (yearFilter !== 'all') {
        const fin = parseYearMonth(occ.dateWatched);
        if (!fin || fin.year !== yearFilter) continue;
      }
      occurrencesInScope.push({
        movie,
        dateWatched: occ.dateWatched,
        rating: occ.rating,
      });
    }
  }

  const hasWatches = occurrencesInScope.length > 0;
  const scopeLabel: 'watched titles' | 'all titles' = hasWatches
    ? 'watched titles'
    : 'all titles';

  const evaluatedItems = hasWatches
    ? occurrencesInScope.map((o) => ({
        movie: o.movie,
        rating: o.rating ?? (o.movie.rating > 0 ? o.movie.rating : 0),
      }))
    : activeMovies.map((movie) => ({
        movie,
        rating: movie.rating > 0 ? movie.rating : 0,
      }));

  const totalEvaluated = evaluatedItems.length;

  // Watch Medium Breakdown
  const mediumCounts: Record<WatchMedium, number> = {
    streaming: 0,
    theater: 0,
    disc: 0,
    tv: 0,
    other: 0,
  };
  for (const { movie } of evaluatedItems) {
    const med: WatchMedium = movie.medium || 'streaming';
    mediumCounts[med] = (mediumCounts[med] ?? 0) + 1;
  }

  const mediumBreakdown: MediumSlice[] = (
    [
      { medium: 'streaming', label: 'Streaming', color: '#0891b2' },
      { medium: 'theater', label: 'Theater', color: '#e11d48' },
      { medium: 'disc', label: 'Disc', color: '#d97706' },
      { medium: 'tv', label: 'TV', color: '#4f46e5' },
      { medium: 'other', label: 'Other', color: '#64748b' },
    ] as const
  )
    .map((item) => {
      const count = mediumCounts[item.medium];
      return {
        ...item,
        count,
        percent: totalEvaluated > 0 ? Math.round((count / totalEvaluated) * 100) : 0,
      };
    })
    .filter((s) => s.count > 0 || s.medium === 'streaming' || s.medium === 'theater');

  // Top Genres & Tags
  const labelCounts = new Map<string, number>();
  for (const { movie } of evaluatedItems) {
    const seen = new Set<string>();
    for (const genre of movie.genres) {
      const clean = genre.trim();
      const key = clean.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      labelCounts.set(clean, (labelCounts.get(clean) ?? 0) + 1);
    }
    for (const rawTag of movie.tags) {
      const clean = rawTag.trim().toLowerCase();
      if (!clean || IGNORED_TAGS.has(clean) || seen.has(clean)) continue;
      seen.add(clean);
      labelCounts.set(`#${clean}`, (labelCounts.get(`#${clean}`) ?? 0) + 1);
    }
  }

  const topGenresAndTags: GenreTagBreakdownItem[] = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([label, count]) => ({
      label,
      count,
      percent: totalEvaluated > 0 ? Math.round((count / totalEvaluated) * 100) : 0,
    }));

  // Rating Distribution
  const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };
  let ratedTotal = 0;
  for (const item of evaluatedItems) {
    const r = item.rating;
    if (!r || r <= 0) continue;
    ratedTotal += 1;
    if (r >= 4.5) ratingCounts[5] += 1;
    else if (r >= 3.5) ratingCounts[4] += 1;
    else if (r >= 2.5) ratingCounts[3] += 1;
    else if (r >= 1.5) ratingCounts[2] += 1;
    else ratingCounts[1] += 1;
  }

  const ratingDistribution: RatingBucket[] = ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    label: `${stars}★`,
    count: ratingCounts[stars],
    percent: ratedTotal > 0 ? Math.round((ratingCounts[stars] / ratedTotal) * 100) : 0,
  }));

  // Pace Metrics
  const logsInScope = activeLogs.filter((l) => {
    if (yearFilter === 'all') return true;
    const ym = parseYearMonth(l.date);
    return ym !== null && ym.year === yearFilter;
  });

  let monthsInScope = 1;
  if (typeof yearFilter === 'number') {
    monthsInScope =
      yearFilter === referenceDate.getFullYear() ? referenceDate.getMonth() + 1 : 12;
  } else {
    const monthKeys = new Set<string>();
    for (const o of occurrencesInScope) {
      const ym = parseYearMonth(o.dateWatched);
      if (ym) monthKeys.add(`${ym.year}-${String(ym.month + 1).padStart(2, '0')}`);
    }
    for (const l of logsInScope) {
      const ym = parseYearMonth(l.date);
      if (ym) monthKeys.add(`${ym.year}-${String(ym.month + 1).padStart(2, '0')}`);
    }
    if (monthKeys.size > 0) {
      const sorted = Array.from(monthKeys).sort();
      const first = parseYearMonth(`${sorted[0]}-01`);
      const last = parseYearMonth(`${sorted[sorted.length - 1]}-01`);
      if (first && last) {
        monthsInScope = Math.max(
          1,
          (last.year - first.year) * 12 + (last.month - first.month) + 1,
        );
      }
    }
  }

  const titlesPerMonth = Number(
    (occurrencesInScope.length / Math.max(1, monthsInScope)).toFixed(1),
  );

  let totalMinutes = 0;
  const loggedMovieIds = new Set<string>();
  for (const log of logsInScope) {
    totalMinutes += Math.max(0, log.minutesWatched || 0);
    loggedMovieIds.add(log.movieId);
  }
  for (const occ of occurrencesInScope) {
    if (!loggedMovieIds.has(occ.movie.id) && occ.movie.runtimeMinutes > 0) {
      totalMinutes += occ.movie.runtimeMinutes;
    }
  }
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  let movieCount = 0;
  let seriesCount = 0;
  let coWatchedCount = 0;
  for (const { movie } of evaluatedItems) {
    if (movie.mediaType === 'series') seriesCount += 1;
    else movieCount += 1;
    if (
      (movie.watchedWithProfileIds && movie.watchedWithProfileIds.length > 0) ||
      movie.watchedWithGuests?.trim()
    ) {
      coWatchedCount += 1;
    }
  }

  const coWatchPercent =
    totalEvaluated > 0 ? Math.round((coWatchedCount / totalEvaluated) * 100) : 0;

  return {
    scopeLabel,
    totalTitlesEvaluated: totalEvaluated,
    mediumBreakdown,
    topGenresAndTags,
    ratingDistribution,
    pace: {
      titlesPerMonth,
      totalHours,
      movieCount,
      seriesCount,
      coWatchPercent,
    },
  };
}
