import type { MovieItem, WatchLog } from '../types/movie';

export interface MonthlyBucket {
  month: number; // 0..11
  label: string;
  monthKey: string; // YYYY-MM
  minutesWatched: number;
  loggedMinutes: number;
  backfillMinutes: number;
  titlesWatched: number;
  episodesWatched: number;
  familyNights: number;
  sessionCount: number;
}

export interface WatchSummary {
  titlesWatched: number;
  currentlyWatchingCount: number;
  totalMinutes: number;
  loggedMinutes: number;
  backfillMinutes: number;
  currentMonthMinutes: number;
  episodesWatched: number;
  familyNightsCount: number;
  averageRating: number;
  ratedTitlesCount: number;
  averageRuntimeMinutes: number;
  activeWatchDays: number;
  currentDailyStreak: number;
}

export interface TimelineMonthGroup {
  monthKey: string; // YYYY-MM
  label: string;
  year: number;
  month: number;
  movies: MovieItem[];
  totalMinutes: number;
}

export interface WatchedOccurrence {
  dateWatched?: string;
  startedAt?: string;
  rating?: number;
  cycleIndex: number;
  isHistorical: boolean;
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

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function parseYearMonth(dateStr?: string): { year: number; month: number } | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || month < 0 || month > 11) return null;
  return { year, month };
}

/**
 * Returns every completed watch for a movie/series (active watched state + historical rewatch spans),
 * deduplicating any historical span whose watchedAt matches the currently active dateWatched.
 */
export function getMovieWatchedOccurrences(movie: MovieItem): WatchedOccurrence[] {
  const history = Array.isArray(movie.watchHistory) ? movie.watchHistory : [];
  const occurrences: WatchedOccurrence[] = [];

  history.forEach((span, idx) => {
    if (!span.watchedAt) return;
    if (
      movie.status === 'watched' &&
      movie.dateWatched &&
      span.watchedAt === movie.dateWatched
    ) {
      return;
    }
    occurrences.push({
      dateWatched: span.watchedAt,
      startedAt: span.startedAt,
      rating: span.rating && span.rating > 0 ? span.rating : undefined,
      cycleIndex: idx + 1,
      isHistorical: true,
    });
  });

  if (movie.status === 'watched') {
    occurrences.push({
      dateWatched: movie.dateWatched,
      startedAt: movie.dateStarted,
      rating: movie.rating > 0 ? movie.rating : undefined,
      cycleIndex: history.length + 1,
      isHistorical: false,
    });
  }

  return occurrences;
}

export function getAvailableYears(movies: MovieItem[], logs: WatchLog[]): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const m of movies) {
    if (m.deletedAt) continue;
    const fin = parseYearMonth(m.dateWatched);
    if (fin) years.add(fin.year);
    const start = parseYearMonth(m.dateStarted);
    if (start) years.add(start.year);
    for (const span of m.watchHistory || []) {
      const hFin = parseYearMonth(span.watchedAt);
      if (hFin) years.add(hFin.year);
      const hStart = parseYearMonth(span.startedAt);
      if (hStart) years.add(hStart.year);
    }
  }
  for (const l of logs) {
    if (l.deletedAt) continue;
    const ym = parseYearMonth(l.date);
    if (ym) years.add(ym.year);
  }
  return Array.from(years).sort((a, b) => b - a);
}

function buildLoggedMinutesByMovieCycle(activeLogs: WatchLog[]): {
  totalByMovie: Map<string, number>;
  byMovieAndCycle: Map<string, number>;
} {
  const totalByMovie = new Map<string, number>();
  const byMovieAndCycle = new Map<string, number>();

  for (const log of activeLogs) {
    const mins = Math.max(0, log.minutesWatched || 0);
    totalByMovie.set(log.movieId, (totalByMovie.get(log.movieId) ?? 0) + mins);
    if (log.watchCycle && log.watchCycle > 0) {
      const key = `${log.movieId}::${log.watchCycle}`;
      byMovieAndCycle.set(key, (byMovieAndCycle.get(key) ?? 0) + mins);
    }
  }

  return { totalByMovie, byMovieAndCycle };
}

function getLoggedMinutesForOccurrence(
  movie: MovieItem,
  occ: WatchedOccurrence,
  totals: { totalByMovie: Map<string, number>; byMovieAndCycle: Map<string, number> },
): number {
  const cycleKey = `${movie.id}::${occ.cycleIndex}`;
  if (totals.byMovieAndCycle.has(cycleKey)) {
    return totals.byMovieAndCycle.get(cycleKey) ?? 0;
  }
  if (occ.isHistorical) {
    return 0;
  }
  const totalAll = totals.totalByMovie.get(movie.id) ?? 0;
  const historyLen = movie.watchHistory?.length ?? 0;
  if (historyLen === 0) return totalAll;
  let explicitOtherCycles = 0;
  for (let c = 1; c <= historyLen; c++) {
    explicitOtherCycles += totals.byMovieAndCycle.get(`${movie.id}::${c}`) ?? 0;
  }
  return Math.max(0, totalAll - explicitOtherCycles);
}

function isCoWatchLog(log: WatchLog): boolean {
  return Boolean(
    (log.watchedWithProfileIds && log.watchedWithProfileIds.length > 0) ||
      log.watchedWithGuests?.trim(),
  );
}

/**
 * Computes 12 monthly buckets for a given calendar year.
 * Guards against double-counting: active WatchLogs are summed across dates,
 * and watched-movie runtime backfill adds only `max(0, runtimeMinutes - totalLoggedForCycle)`
 * to `dateWatched`'s month.
 */
export function computeMonthlyStats(
  movies: MovieItem[],
  logs: WatchLog[],
  year: number,
  includeBackfill = true,
): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = MONTH_SHORT.map((label, month) => ({
    month,
    label,
    monthKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    minutesWatched: 0,
    loggedMinutes: 0,
    backfillMinutes: 0,
    titlesWatched: 0,
    episodesWatched: 0,
    familyNights: 0,
    sessionCount: 0,
  }));

  const activeLogs = logs.filter((l) => !l.deletedAt);
  const activeMovies = movies.filter((m) => !m.deletedAt);
  const logTotals = buildLoggedMinutesByMovieCycle(activeLogs);

  for (const log of activeLogs) {
    const mins = Math.max(0, log.minutesWatched || 0);
    const ym = parseYearMonth(log.date);
    if (ym && ym.year === year) {
      const bucket = buckets[ym.month];
      bucket.loggedMinutes += mins;
      bucket.minutesWatched += mins;
      bucket.episodesWatched += Math.max(0, log.episodesCount || 0);
      bucket.sessionCount += 1;
      if (isCoWatchLog(log)) {
        bucket.familyNights += 1;
      }
    }
  }

  for (const movie of activeMovies) {
    for (const occ of getMovieWatchedOccurrences(movie)) {
      const fin = parseYearMonth(occ.dateWatched);
      if (!fin || fin.year !== year) continue;

      const bucket = buckets[fin.month];
      bucket.titlesWatched += 1;

      if (includeBackfill && movie.runtimeMinutes > 0) {
        const expectedTotalMinutes =
          movie.mediaType === 'series' && (movie.totalEpisodes ?? 0) > 0
            ? movie.runtimeMinutes * (movie.totalEpisodes ?? 1)
            : movie.runtimeMinutes;
        const loggedForCycle = getLoggedMinutesForOccurrence(movie, occ, logTotals);
        const remaining = Math.max(0, expectedTotalMinutes - loggedForCycle);
        if (remaining > 0) {
          bucket.backfillMinutes += remaining;
          bucket.minutesWatched += remaining;
        }
      }
    }
  }

  return buckets;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeDailyStreak(logs: WatchLog[], referenceDate: Date = new Date()): number {
  const activeDates = new Set(
    logs
      .filter(
        (l) =>
          !l.deletedAt &&
          l.date &&
          ((l.minutesWatched || 0) > 0 || (l.episodesCount ?? 0) > 0),
      )
      .map((l) => l.date.slice(0, 10)),
  );
  if (activeDates.size === 0) return 0;

  const cursor = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const todayIso = toIsoDate(cursor);
  if (!activeDates.has(todayIso)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDates.has(toIsoDate(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (activeDates.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeWatchSummary(
  movies: MovieItem[],
  logs: WatchLog[],
  yearFilter: number | 'all',
  includeBackfill = true,
  referenceDate: Date = new Date(),
): WatchSummary {
  const activeMovies = movies.filter((m) => !m.deletedAt);
  const activeLogs = logs.filter((l) => !l.deletedAt);
  const logTotals = buildLoggedMinutesByMovieCycle(activeLogs);

  const occurrencesInScope: Array<{ movie: MovieItem; occ: WatchedOccurrence }> = [];
  for (const movie of activeMovies) {
    for (const occ of getMovieWatchedOccurrences(movie)) {
      if (yearFilter !== 'all') {
        const fin = parseYearMonth(occ.dateWatched);
        if (!fin || fin.year !== yearFilter) continue;
      }
      occurrencesInScope.push({ movie, occ });
    }
  }

  const logsInScope = activeLogs.filter((l) => {
    if (yearFilter === 'all') return true;
    const ym = parseYearMonth(l.date);
    return ym !== null && ym.year === yearFilter;
  });

  const loggedMinutes = logsInScope.reduce((sum, l) => sum + Math.max(0, l.minutesWatched || 0), 0);
  const episodesWatched = logsInScope.reduce((sum, l) => sum + Math.max(0, l.episodesCount || 0), 0);
  const familyNightsCount = logsInScope.filter(isCoWatchLog).length;

  let backfillMinutes = 0;
  if (includeBackfill) {
    for (const { movie, occ } of occurrencesInScope) {
      if (movie.runtimeMinutes > 0) {
        const expectedTotalMinutes =
          movie.mediaType === 'series' && (movie.totalEpisodes ?? 0) > 0
            ? movie.runtimeMinutes * (movie.totalEpisodes ?? 1)
            : movie.runtimeMinutes;
        const loggedForCycle = getLoggedMinutesForOccurrence(movie, occ, logTotals);
        backfillMinutes += Math.max(0, expectedTotalMinutes - loggedForCycle);
      }
    }
  }

  const ratedOccurrences = occurrencesInScope.filter(({ occ }) => (occ.rating ?? 0) > 0);
  const averageRating =
    ratedOccurrences.length > 0
      ? Number(
          (
            ratedOccurrences.reduce((s, { occ }) => s + (occ.rating ?? 0), 0) /
            ratedOccurrences.length
          ).toFixed(2),
        )
      : 0;

  const timedMovies = occurrencesInScope.filter(
    ({ movie }) => movie.mediaType === 'movie' && movie.runtimeMinutes > 0,
  );
  const averageRuntimeMinutes =
    timedMovies.length > 0
      ? Math.round(
          timedMovies.reduce((s, { movie }) => s + movie.runtimeMinutes, 0) / timedMovies.length,
        )
      : 0;

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();
  const currentYearBuckets = computeMonthlyStats(
    activeMovies,
    activeLogs,
    currentYear,
    includeBackfill,
  );
  const currentMonthMinutes = currentYearBuckets[currentMonth]?.minutesWatched ?? 0;

  const activeDaysSet = new Set(logsInScope.map((l) => l.date.slice(0, 10)).filter(Boolean));

  return {
    titlesWatched: occurrencesInScope.length,
    currentlyWatchingCount: activeMovies.filter((m) => m.status === 'watching').length,
    totalMinutes: loggedMinutes + backfillMinutes,
    loggedMinutes,
    backfillMinutes,
    currentMonthMinutes,
    episodesWatched,
    familyNightsCount,
    averageRating,
    ratedTitlesCount: ratedOccurrences.length,
    averageRuntimeMinutes,
    activeWatchDays: activeDaysSet.size,
    currentDailyStreak: computeDailyStreak(activeLogs, referenceDate),
  };
}

/**
 * Groups watched titles (including historical rewatch spans) chronologically by YYYY-MM descending.
 */
export function buildTimelineGroups(
  movies: MovieItem[],
  yearFilter: number | 'all',
): TimelineMonthGroup[] {
  const groupMap = new Map<string, TimelineMonthGroup>();

  for (const movie of movies) {
    if (movie.deletedAt) continue;
    for (const occ of getMovieWatchedOccurrences(movie)) {
      const fin = parseYearMonth(occ.dateWatched);
      if (yearFilter !== 'all' && (!fin || fin.year !== yearFilter)) continue;

      const monthKey = fin
        ? `${fin.year}-${String(fin.month + 1).padStart(2, '0')}`
        : '0000-00';

      let group = groupMap.get(monthKey);
      if (!group) {
        group = {
          monthKey,
          label: fin ? `${MONTH_LONG[fin.month]} ${fin.year}` : 'Date Unspecified',
          year: fin ? fin.year : 0,
          month: fin ? fin.month : -1,
          movies: [],
          totalMinutes: 0,
        };
        groupMap.set(monthKey, group);
      }

      if (!group.movies.some((existing) => existing.id === movie.id)) {
        group.movies.push(movie);
      }
      group.totalMinutes += Math.max(0, movie.runtimeMinutes || 0);
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    b.monthKey.localeCompare(a.monthKey),
  );
  for (const group of groups) {
    group.movies.sort((a, b) =>
      (b.dateWatched || b.updatedAt).localeCompare(a.dateWatched || a.updatedAt),
    );
  }
  return groups;
}
