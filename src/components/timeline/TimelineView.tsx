import React, { useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  Check,
  Clock,
  Film,
  Flame,
  Pencil,
  Plus,
  Printer,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { MovieItem } from '../../types/movie';
import {
  buildDailyWatchHeatmap,
  computeWatchAnalyticsBreakdown,
} from '../../utils/analytics';
import { computeWatchBadges } from '../../utils/badges';
import { formatWatchHours, formatWatchLogBadge } from '../../utils/progress';
import {
  buildTimelineGroups,
  computeMonthlyStats,
  computeWatchSummary,
  getAvailableYears,
  parseYearMonth,
} from '../../utils/stats';
import { AVATAR_THEME_MAP, WATCH_MEDIUM_META } from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { MovieCard } from '../library/MovieCard';
import { BreakdownCharts } from './BreakdownCharts';
import { MonthlyChart } from './MonthlyChart';
import { WatchHeatmap } from './WatchHeatmap';

interface TimelineViewProps {
  onSelectMovie: (movie: MovieItem) => void;
  onQuickLog: (movie?: MovieItem, markWatched?: boolean) => void;
  onOpenPdfExport: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onSelectMovie,
  onQuickLog,
  onOpenPdfExport,
}) => {
  const {
    activeProfile,
    activeProfiles,
    profileMovies,
    profileLogs,
    householdSettings,
    updateProfile,
    deleteWatchLog,
  } = useLibrary();

  const availableYears = useMemo(
    () => getAvailableYears(profileMovies, profileLogs),
    [profileMovies, profileLogs],
  );

  const [yearFilter, setYearFilter] = useState<number | 'all'>(() => new Date().getFullYear());
  const [familyOnly, setFamilyOnly] = useState(false);
  const [chartMetric, setChartMetric] = useState<'hours' | 'titles'>('hours');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [feedTab, setFeedTab] = useState<'watched' | 'logs'>('watched');

  // Inline Yearly Goal edit
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState('40');

  // Inline Badge Reward edit
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [rewardDraft, setRewardDraft] = useState('');

  const scopedMovies = useMemo(() => {
    if (!familyOnly) return profileMovies;
    return profileMovies.filter(
      (m) =>
        (m.watchedWithProfileIds && m.watchedWithProfileIds.length > 0) ||
        Boolean(m.watchedWithGuests?.trim()),
    );
  }, [profileMovies, familyOnly]);

  const scopedLogs = useMemo(() => {
    if (!familyOnly) return profileLogs;
    return profileLogs.filter(
      (l) =>
        (l.watchedWithProfileIds && l.watchedWithProfileIds.length > 0) ||
        Boolean(l.watchedWithGuests?.trim()),
    );
  }, [profileLogs, familyOnly]);

  const chartYear = yearFilter === 'all' ? new Date().getFullYear() : yearFilter;
  const summary = useMemo(
    () => computeWatchSummary(scopedMovies, scopedLogs, yearFilter, true),
    [scopedMovies, scopedLogs, yearFilter],
  );
  const monthlyBuckets = useMemo(
    () => computeMonthlyStats(scopedMovies, scopedLogs, chartYear, true),
    [scopedMovies, scopedLogs, chartYear],
  );
  const heatmapData = useMemo(
    () => buildDailyWatchHeatmap(scopedMovies, scopedLogs, yearFilter),
    [scopedMovies, scopedLogs, yearFilter],
  );
  const breakdown = useMemo(
    () => computeWatchAnalyticsBreakdown(scopedMovies, scopedLogs, yearFilter),
    [scopedMovies, scopedLogs, yearFilter],
  );
  const badges = useMemo(
    () => computeWatchBadges(profileMovies, profileLogs, activeProfile?.badgeRewards),
    [profileMovies, profileLogs, activeProfile?.badgeRewards],
  );

  const timelineGroups = useMemo(() => {
    const groups = buildTimelineGroups(scopedMovies, yearFilter);
    if (selectedMonth === null) return groups;
    return groups.filter((g) => g.month === selectedMonth);
  }, [scopedMovies, yearFilter, selectedMonth]);

  const filteredLogs = useMemo(() => {
    return scopedLogs.filter((l) => {
      const ym = parseYearMonth(l.date);
      if (yearFilter !== 'all' && (!ym || ym.year !== yearFilter)) return false;
      if (selectedMonth !== null && (!ym || ym.month !== selectedMonth)) return false;
      return true;
    });
  }, [scopedLogs, yearFilter, selectedMonth]);

  const movieMap = useMemo(
    () => new Map(profileMovies.map((m) => [m.id, m])),
    [profileMovies],
  );
  const profileMap = useMemo(
    () => new Map(activeProfiles.map((p) => [p.id, p])),
    [activeProfiles],
  );

  const yearlyGoal = Math.max(1, activeProfile?.yearlyMovieGoal || 40);
  const goalPct = Math.min(100, Math.round((summary.titlesWatched / yearlyGoal) * 100));
  const goalCircumference = 2 * Math.PI * 18;
  const goalDashOffset = goalCircumference * (1 - goalPct / 100);

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    const parsed = Math.max(1, Math.round(Number(goalDraft) || 40));
    void updateProfile(activeProfile.id, { yearlyMovieGoal: parsed });
    setEditingGoal(false);
  };

  const handleSaveReward = (badgeId: string) => {
    if (!activeProfile) return;
    const nextRewards = { ...(activeProfile.badgeRewards || {}) };
    if (rewardDraft.trim()) {
      nextRewards[badgeId] = rewardDraft.trim();
    } else {
      delete nextRewards[badgeId];
    }
    void updateProfile(activeProfile.id, { badgeRewards: nextRewards });
    setEditingBadgeId(null);
    setRewardDraft('');
  };

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100">
            Watch Timeline &amp; Stats
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Track watch history, family movie nights, milestones, and viewing habits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={yearFilter}
            onChange={(e) => {
              const v = e.target.value;
              setYearFilter(v === 'all' ? 'all' : Number(v));
              setSelectedMonth(null);
            }}
            aria-label="Filter year"
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 text-xs font-semibold"
          >
            <option value="all">All Time</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFamilyOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              familyOnly
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white dark:bg-[#171A23] border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Family Nights Only</span>
          </button>

          <button
            type="button"
            onClick={onOpenPdfExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickLog()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Watch</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Titles Watched + Yearly Goal Ring */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Titles Watched
            </p>
            <p className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
              {summary.titlesWatched}
            </p>
            {editingGoal ? (
              <form onSubmit={handleSaveGoal} className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  min={1}
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  className="w-16 px-2 py-0.5 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-xs"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-rose-600 text-white"
                  aria-label="Save yearly goal"
                >
                  <Check className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setGoalDraft(String(yearlyGoal));
                  setEditingGoal(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline mt-0.5"
              >
                Goal: {yearlyGoal}/yr <Pencil className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 44 44" className="w-12 h-12 -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                strokeWidth="4"
                className="stroke-stone-100 dark:stroke-stone-800"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={goalCircumference}
                strokeDashoffset={goalDashOffset}
                className="stroke-rose-600 dark:stroke-rose-400 transition-all duration-500"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-stone-700 dark:text-stone-200">
              {goalPct}%
            </span>
          </div>
        </div>

        {/* KPI 2: Watch Time */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Watch Time
            </p>
            <p className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
              {formatWatchHours(summary.totalMinutes)}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              {summary.episodesWatched > 0
                ? `${summary.episodesWatched} eps · `
                : ''}
              This month: {formatWatchHours(summary.currentMonthMinutes)}
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-amber-500/12 text-amber-700 dark:text-amber-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Streak & Active Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Daily Watch Streak
            </p>
            <p className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
              {summary.currentDailyStreak}d
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
              {summary.activeWatchDays} active day(s) · Best {heatmapData.longestStreak}d
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-rose-500/12 text-rose-600 dark:text-rose-400">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Family Nights & Avg Rating */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Family Co-Watches
            </p>
            <p className="font-serif-display text-2xl font-bold text-stone-900 dark:text-stone-100 mt-0.5">
              {summary.familyNightsCount}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              {summary.averageRating > 0
                ? `${summary.averageRating} avg rating (${summary.ratedTitlesCount})`
                : `${summary.currentlyWatchingCount} in progress`}
            </p>
          </div>
          <div className="p-2.5 rounded-2xl bg-indigo-500/12 text-indigo-700 dark:text-indigo-300">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* Monthly Chart */}
      <section className="p-5 rounded-3xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
              Monthly Activity ({chartYear})
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Click any bar to filter the timeline &amp; watch logs below by month.
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
            <button
              type="button"
              onClick={() => setChartMetric('hours')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                chartMetric === 'hours'
                  ? 'bg-white dark:bg-stone-800 text-rose-700 dark:text-rose-300 shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              Hours
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('titles')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                chartMetric === 'titles'
                  ? 'bg-white dark:bg-stone-800 text-rose-700 dark:text-rose-300 shadow-xs'
                  : 'text-stone-500'
              }`}
            >
              Titles
            </button>
          </div>
        </div>

        <MonthlyChart
          buckets={monthlyBuckets}
          year={chartYear}
          metric={chartMetric}
          monthlyHoursGoal={activeProfile?.monthlyWatchHoursGoal || 15}
          yearlyMovieGoal={yearlyGoal}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
        />
      </section>

      {/* Daily Watch Heatmap */}
      <WatchHeatmap data={heatmapData} yearFilter={yearFilter} />

      {/* Breakdown Analytics */}
      <BreakdownCharts breakdown={breakdown} />

      {/* Cinema Milestones (9 Badges) */}
      <section className="p-5 rounded-3xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Cinema Milestones
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {badges.filter((b) => b.unlocked).length} of {badges.length} unlocked
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                badge.unlocked
                  ? 'bg-gradient-to-br from-amber-500/12 via-rose-500/6 to-transparent border-amber-400/50 dark:border-amber-500/40'
                  : 'bg-stone-50/70 dark:bg-stone-900/50 border-stone-200/70 dark:border-stone-800 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl leading-none">{badge.emoji}</span>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {badge.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {badge.description}
                    </p>
                  </div>
                </div>
                {badge.unlocked && (
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-stone-500">
                  <span>
                    {badge.current} / {badge.target} {badge.unitLabel}
                  </span>
                  <span>{badge.progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      badge.unlocked
                        ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                        : 'bg-stone-400 dark:bg-stone-600'
                    }`}
                    style={{ width: `${badge.progressPct}%` }}
                  />
                </div>
              </div>

              {badge.rewardNote && editingBadgeId !== badge.id && (
                <p className="mt-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                  🎁 Reward: {badge.rewardNote}
                </p>
              )}

              {activeProfile && editingBadgeId === badge.id ? (
                <div className="mt-2 flex gap-1.5">
                  <input
                    type="text"
                    value={rewardDraft}
                    onChange={(e) => setRewardDraft(e.target.value)}
                    placeholder="e.g. Pick Friday movie & popcorn"
                    className="flex-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveReward(badge.id)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold"
                  >
                    Save
                  </button>
                </div>
              ) : activeProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBadgeId(badge.id);
                    setRewardDraft(badge.rewardNote || '');
                  }}
                  className="mt-2 text-[11px] font-medium text-stone-400 hover:text-rose-600"
                >
                  {badge.rewardNote ? 'Edit reward' : '+ Set milestone reward'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Timeline & Watch Log Tabs */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFeedTab('watched')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                feedTab === 'watched'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-[#171A23] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Watched Timeline ({timelineGroups.reduce((s, g) => s + g.movies.length, 0)})
            </button>
            <button
              type="button"
              onClick={() => setFeedTab('logs')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                feedTab === 'logs'
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-[#171A23] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Watch Log History ({filteredLogs.length})
            </button>
          </div>

          {selectedMonth !== null && (
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
            >
              Clear Month Filter
            </button>
          )}
        </div>

        {feedTab === 'watched' ? (
          timelineGroups.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#171A23] border border-dashed border-stone-300 dark:border-stone-700 text-center text-sm text-stone-500">
              No completed watches recorded in this period yet.
            </div>
          ) : (
            <div className="space-y-6">
              {timelineGroups.map((group) => (
                <div key={group.monthKey} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
                      {group.label}
                    </h3>
                    <span className="text-xs font-semibold text-stone-500">
                      {group.movies.length} title(s) · {formatWatchHours(group.totalMinutes)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.movies.map((m) => (
                      <MovieCard
                        key={`${group.monthKey}-${m.id}`}
                        movie={m}
                        onSelect={onSelectMovie}
                        onQuickLog={(movie) => onQuickLog(movie)}
                        profiles={activeProfiles}
                        subscribedServices={householdSettings.subscribedServices}
                        badgeContext="rewatch"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#171A23] border border-dashed border-stone-300 dark:border-stone-700 text-center text-sm text-stone-500">
            No watch sessions logged in this period yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLogs.map((log) => {
              const movie = movieMap.get(log.movieId);
              const medMeta = log.medium ? WATCH_MEDIUM_META[log.medium] : null;
              const coWatchers = (log.watchedWithProfileIds || [])
                .map((id) => profileMap.get(id))
                .filter((p): p is NonNullable<typeof p> => Boolean(p));

              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800"
                >
                  {movie ? (
                    <button
                      type="button"
                      onClick={() => onSelectMovie(movie)}
                      className="shrink-0"
                    >
                      <MoviePoster
                        title={movie.title}
                        director={movie.director}
                        posterUrl={movie.posterUrl}
                        size="xs"
                        interactive={false}
                      />
                    </button>
                  ) : (
                    <div className="w-9 h-13 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center shrink-0">
                      <Film className="w-4 h-4 text-stone-400" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-800 dark:text-stone-100">
                        {log.date}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/12 text-rose-700 dark:text-rose-300">
                        {formatWatchLogBadge(log)}
                      </span>
                      {medMeta && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${medMeta.badgeClass}`}
                        >
                          {log.serviceName || medMeta.shortLabel}
                        </span>
                      )}
                    </div>

                    <p className="font-serif-display text-sm font-bold text-stone-900 dark:text-stone-100 truncate mt-0.5">
                      {movie ? (
                        <button
                          type="button"
                          onClick={() => onSelectMovie(movie)}
                          className="hover:text-rose-600 text-left"
                        >
                          {movie.title}
                        </button>
                      ) : (
                        'Removed Title'
                      )}
                    </p>

                    {(coWatchers.length > 0 || log.watchedWithGuests) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Users className="w-3 h-3 text-rose-500" />
                        {coWatchers.map((cw) => {
                          const theme =
                            AVATAR_THEME_MAP[cw.avatarTheme] || AVATAR_THEME_MAP.rose;
                          return (
                            <span
                              key={cw.id}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${theme.softBg} ${theme.text}`}
                            >
                              {cw.avatarEmoji} {cw.name}
                            </span>
                          );
                        })}
                        {log.watchedWithGuests && (
                          <span className="text-[11px] text-stone-500">
                            + {log.watchedWithGuests}
                          </span>
                        )}
                      </div>
                    )}

                    {log.note && (
                      <p className="text-xs italic text-stone-500 dark:text-stone-400 mt-1">
                        {log.note}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteWatchLog(log.id)}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-stone-400 hover:text-rose-600 shrink-0"
                    aria-label="Delete watch log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
