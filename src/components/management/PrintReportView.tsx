import React, { useMemo } from 'react';
import { useLibrary } from '../../store/LibraryContext';
import {
  buildPdfReportData,
  MOVIE_NIGHT_QUESTIONS,
  type PdfReportOptions,
  type PdfReportTheme,
} from '../../utils/pdfReport';
import { formatRuntimeHuman, formatWatchHours, formatWatchLogBadge } from '../../utils/progress';
import { STATUS_META } from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';
import { MonthlyChart } from '../timeline/MonthlyChart';

interface PrintReportViewProps {
  options: PdfReportOptions;
}

const PRINT_THEME_STYLES: Record<
  PdfReportTheme,
  {
    rootText: string;
    headingFont: string;
    borderClass: string;
    cardSurface: string;
    accentText: string;
    pillClass: string;
  }
> = {
  classic: {
    rootText: 'text-stone-900',
    headingFont: 'font-serif-display',
    borderClass: 'border-rose-200',
    cardSurface: 'bg-rose-50/40',
    accentText: 'text-rose-800',
    pillClass: 'bg-stone-100 text-stone-700',
  },
  modern: {
    rootText: 'text-slate-900',
    headingFont: 'font-sans',
    borderClass: 'border-indigo-200',
    cardSurface: 'bg-indigo-50/50',
    accentText: 'text-indigo-700',
    pillClass: 'bg-indigo-100 text-indigo-800',
  },
  minimal: {
    rootText: 'text-zinc-900',
    headingFont: 'font-sans',
    borderClass: 'border-zinc-300',
    cardSurface: 'bg-white',
    accentText: 'text-zinc-900',
    pillClass: 'bg-zinc-100 text-zinc-800',
  },
};

export const PrintReportView: React.FC<PrintReportViewProps> = ({ options }) => {
  const { db } = useLibrary();

  const report = useMemo(() => buildPdfReportData(db, options), [db, options]);
  const allProfileMap = useMemo(
    () => new Map(report.allProfiles.map((p) => [p.id, p])),
    [report.allProfiles],
  );
  const movieMap = useMemo(
    () => new Map(report.movies.map((m) => [m.id, m])),
    [report.movies],
  );

  const themeKey: PdfReportTheme = options.theme ?? 'classic';
  const styles = PRINT_THEME_STYLES[themeKey];

  const viewerLabel =
    report.profiles.map((p) => `${p.avatarEmoji} ${p.name}`).join(', ') || 'All Viewers';
  const dateRangeLabel =
    options.dateFrom || options.dateTo
      ? `${options.dateFrom || 'Beginning'} → ${options.dateTo || 'Present'}`
      : 'All Dates';

  const sumMonthlyHoursGoal =
    report.profiles.reduce((sum, p) => sum + (p.monthlyWatchHoursGoal || 15), 0) || 15;
  const sumYearlyMovieGoal =
    report.profiles.reduce((sum, p) => sum + (p.yearlyMovieGoal || 40), 0) || 40;

  const featuredMovie =
    options.layout === 'handout'
      ? (options.handoutMovieId ? movieMap.get(options.handoutMovieId) : undefined) ??
        report.movies[0]
      : undefined;

  const scopedLogs =
    options.layout === 'handout' && featuredMovie
      ? report.logs.filter((l) => l.movieId === featuredMovie.id)
      : report.logs;

  return (
    <div id="print-report-root" className={`hidden print:block bg-white p-2 ${styles.rootText}`}>
      <style>{`@page { size: ${options.orientation}; margin: 12mm; }`}</style>

      <header className={`border-b-2 ${styles.borderClass} pb-4 mb-5`}>
        <h1 className={`${styles.headingFont} text-2xl font-bold`}>
          {options.title || 'MovieLibrary Watch Report'}
        </h1>
        <p className="text-xs opacity-75 mt-1">
          Viewers: <strong>{viewerLabel}</strong> · Dates: <strong>{dateRangeLabel}</strong>
          {options.mediaTypeFilter !== 'all' ? ` · Type: ${options.mediaTypeFilter}` : ''}
          {options.tagFilter ? ` · Tag: #${options.tagFilter}` : ''} · Theme: {themeKey} · Generated{' '}
          {report.generatedAt.split('T')[0]}
        </p>
      </header>

      {options.layout !== 'handout' && options.includeSummaryAndChart && (
        <section className="mb-6 space-y-4 print-avoid-break">
          <div className="grid grid-cols-4 gap-3">
            <div className={`p-3 rounded-xl border ${styles.borderClass} ${styles.cardSurface}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Titles Matched
              </p>
              <p className={`text-xl font-bold mt-0.5 ${styles.accentText}`}>
                {report.totalTitles}
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${styles.borderClass} ${styles.cardSurface}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Watched
              </p>
              <p className={`text-xl font-bold mt-0.5 ${styles.accentText}`}>
                {report.watchedCount}
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${styles.borderClass} ${styles.cardSurface}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Watch Time
              </p>
              <p className={`text-xl font-bold mt-0.5 ${styles.accentText}`}>
                {formatWatchHours(report.totalMinutesWatched)}
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${styles.borderClass} ${styles.cardSurface}`}>
              <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
                Avg Rating
              </p>
              <p className={`text-xl font-bold mt-0.5 ${styles.accentText}`}>
                {report.averageRating > 0 ? `${report.averageRating} ★` : '—'}
              </p>
            </div>
          </div>

          <div className={`p-3 rounded-xl border ${styles.borderClass}`}>
            <MonthlyChart
              buckets={report.monthlyBuckets}
              year={report.chartYear}
              metric="hours"
              monthlyHoursGoal={sumMonthlyHoursGoal}
              yearlyMovieGoal={sumYearlyMovieGoal}
              selectedMonth={null}
              onSelectMonth={() => undefined}
            />
          </div>
        </section>
      )}

      <section className="mb-6">
        {options.layout !== 'handout' && (
          <h2 className={`${styles.headingFont} text-lg font-bold border-b ${styles.borderClass} pb-1.5 mb-3`}>
            Movie &amp; Series Catalog ({report.movies.length})
          </h2>
        )}

        {options.layout === 'handout' ? (
          featuredMovie ? (
            <div className={`p-5 rounded-2xl border-2 ${styles.borderClass} ${styles.cardSurface} space-y-4`}>
              <div className={`text-[11px] font-bold uppercase tracking-widest ${styles.accentText}`}>
                Movie Night Discussion Guide
              </div>

              <div className="flex gap-4 items-start">
                <MoviePoster
                  title={featuredMovie.title}
                  director={featuredMovie.director}
                  posterUrl={featuredMovie.posterUrl}
                  size="lg"
                  interactive={false}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h2 className={`${styles.headingFont} text-xl font-bold`}>
                    {featuredMovie.title}
                  </h2>
                  <p className="text-sm font-semibold opacity-80">
                    {featuredMovie.director}
                    {featuredMovie.cast && featuredMovie.cast.length > 0
                      ? ` · ${featuredMovie.cast.slice(0, 3).join(', ')}`
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${styles.pillClass}`}>
                      {STATUS_META[featuredMovie.status].shortLabel}
                    </span>
                    {featuredMovie.tags.map((t) => (
                      <span key={t} className={`px-2 py-0.5 rounded-full font-semibold ${styles.pillClass}`}>
                        #{t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs opacity-75">
                    {[
                      featuredMovie.releaseYear,
                      featuredMovie.certification,
                      featuredMovie.runtimeMinutes > 0
                        ? formatRuntimeHuman(featuredMovie.runtimeMinutes)
                        : null,
                      featuredMovie.language,
                      featuredMovie.genres.slice(0, 3).join(', '),
                      featuredMovie.rating > 0 ? `${featuredMovie.rating} ★` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>

              {featuredMovie.synopsis && (
                <div className={`p-3 rounded-xl bg-white border ${styles.borderClass} print-avoid-break`}>
                  <h3 className={`${styles.headingFont} text-xs font-bold uppercase tracking-wider ${styles.accentText} mb-1`}>
                    Synopsis
                  </h3>
                  <p className="text-xs leading-relaxed">{featuredMovie.synopsis}</p>
                </div>
              )}

              {options.includeNotes &&
                (featuredMovie.review || featuredMovie.notes || featuredMovie.wantToWatchNote) && (
                  <div className={`p-3 rounded-xl bg-white border ${styles.borderClass} print-avoid-break space-y-1`}>
                    <h3 className={`${styles.headingFont} text-xs font-bold uppercase tracking-wider ${styles.accentText}`}>
                      Viewer Review &amp; Notes
                    </h3>
                    {featuredMovie.review && (
                      <p className="text-xs">
                        <strong>Review:</strong> {featuredMovie.review}
                      </p>
                    )}
                    {featuredMovie.wantToWatchNote && (
                      <p className="text-xs">
                        <strong>Why Watch:</strong> {featuredMovie.wantToWatchNote}
                      </p>
                    )}
                    {featuredMovie.notes && (
                      <p className="text-xs">
                        <strong>Notes:</strong> {featuredMovie.notes}
                      </p>
                    )}
                  </div>
                )}

              <div className={`p-3 rounded-xl bg-white border ${styles.borderClass} print-avoid-break`}>
                <h3 className={`${styles.headingFont} text-xs font-bold uppercase tracking-wider ${styles.accentText} mb-2`}>
                  Movie Night Discussion Prompts
                </h3>
                <ol className="list-decimal pl-5 text-xs space-y-1.5">
                  {MOVIE_NIGHT_QUESTIONS.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-70">No matching title available.</p>
          )
        ) : options.layout === 'poster' ? (
          <div
            className={`grid gap-3 ${
              options.orientation === 'landscape' ? 'grid-cols-5' : 'grid-cols-4'
            }`}
          >
            {report.movies.map((m) => (
              <div
                key={m.id}
                className={`p-2 rounded-xl border ${styles.borderClass} ${styles.cardSurface} flex flex-col items-center text-center print-avoid-break`}
              >
                <MoviePoster
                  title={m.title}
                  director={m.director}
                  posterUrl={m.posterUrl}
                  size="lg"
                  interactive={false}
                />
                <h3 className={`${styles.headingFont} font-bold text-xs leading-snug mt-2 line-clamp-2`}>
                  {m.title}
                </h3>
                <p className="text-[10px] opacity-75 truncate w-full">
                  {m.director}
                  {m.releaseYear ? ` · ${m.releaseYear}` : ''}
                </p>
                <div className="mt-1">
                  {m.rating > 0 ? (
                    <StarRating value={m.rating} size="sm" />
                  ) : (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${styles.pillClass}`}>
                      {STATUS_META[m.status].shortLabel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : options.layout === 'table' || options.layout === 'checklist' ? (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${styles.borderClass} opacity-75 uppercase text-[10px]`}>
                {options.layout === 'checklist' && <th className="py-1.5 pr-2 w-8">Seen</th>}
                <th className="py-1.5 pr-2">Title</th>
                <th className="py-1.5 pr-2">Director</th>
                <th className="py-1.5 pr-2">Type</th>
                <th className="py-1.5 pr-2">Status</th>
                <th className="py-1.5 pr-2">Runtime</th>
                <th className="py-1.5 pr-2">Rating</th>
                <th className="py-1.5">Watched With / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {report.movies.map((m) => {
                const coNames = (m.watchedWithProfileIds || [])
                  .map((id) => allProfileMap.get(id)?.name)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <tr key={m.id} className="print-avoid-break">
                    {options.layout === 'checklist' && (
                      <td className="py-1.5 pr-2 text-center">☐</td>
                    )}
                    <td className="py-1.5 pr-2 font-semibold">
                      {m.title}
                      {m.releaseYear ? ` (${m.releaseYear})` : ''}
                    </td>
                    <td className="py-1.5 pr-2 opacity-85">{m.director}</td>
                    <td className="py-1.5 pr-2">{m.mediaType}</td>
                    <td className="py-1.5 pr-2">{STATUS_META[m.status].shortLabel}</td>
                    <td className="py-1.5 pr-2">
                      {m.runtimeMinutes > 0 ? formatRuntimeHuman(m.runtimeMinutes) : '—'}
                    </td>
                    <td className="py-1.5 pr-2">{m.rating > 0 ? `${m.rating} ★` : '—'}</td>
                    <td className="py-1.5 opacity-80">{coNames || m.serviceName || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div
            className={`grid gap-3 ${
              options.orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {report.movies.map((m) => {
              const owner = allProfileMap.get(m.profileId);
              const coNames = (m.watchedWithProfileIds || [])
                .map((id) => allProfileMap.get(id)?.name)
                .filter(Boolean)
                .join(', ');
              return (
                <article
                  key={m.id}
                  className={`p-3 rounded-xl border ${styles.borderClass} ${styles.cardSurface} flex gap-3 print-avoid-break`}
                >
                  <MoviePoster
                    title={m.title}
                    director={m.director}
                    posterUrl={m.posterUrl}
                    size="sm"
                    interactive={false}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] mb-1">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${styles.pillClass}`}>
                        {STATUS_META[m.status].shortLabel}
                      </span>
                      {report.profiles.length > 1 && owner && (
                        <span className="opacity-70 ml-auto">
                          {owner.avatarEmoji} {owner.name}
                        </span>
                      )}
                    </div>
                    <h3 className={`${styles.headingFont} font-bold text-sm leading-snug`}>
                      {m.title}
                      {m.releaseYear ? ` (${m.releaseYear})` : ''}
                    </h3>
                    <p className="text-xs opacity-75">{m.director}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] opacity-75">
                      {m.rating > 0 && <StarRating value={m.rating} size="sm" />}
                      {m.runtimeMinutes > 0 && <span>{formatRuntimeHuman(m.runtimeMinutes)}</span>}
                      {m.dateWatched && <span>· {m.dateWatched}</span>}
                    </div>
                    {coNames && <p className="text-[10px] opacity-80 mt-0.5">With: {coNames}</p>}
                    {options.includeNotes && m.review && (
                      <p className="text-[11px] italic opacity-85 mt-1 line-clamp-2">
                        &ldquo;{m.review}&rdquo;
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {options.layout !== 'handout' &&
        options.includeTimeline &&
        report.timelineGroups.length > 0 && (
          <section className="mb-6">
            <h2 className={`${styles.headingFont} text-lg font-bold border-b ${styles.borderClass} pb-1.5 mb-3`}>
              Watch Timeline
            </h2>
            <div className="space-y-3">
              {report.timelineGroups.map((group) => (
                <div key={group.monthKey} className="print-avoid-break">
                  <h3 className="font-semibold text-sm">
                    {group.label}{' '}
                    <span className="font-normal text-xs opacity-70">
                      ({group.movies.length} titles · {formatWatchHours(group.totalMinutes)})
                    </span>
                  </h3>
                  <ul className="list-disc pl-5 text-xs opacity-85 mt-1 space-y-0.5">
                    {group.movies.map((m) => (
                      <li key={m.id}>
                        <strong>{m.title}</strong> — {m.director}
                        {m.dateWatched ? ` (${m.dateWatched})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

      {options.includeWatchLogs && scopedLogs.length > 0 && (
        <section>
          <h2 className={`${styles.headingFont} text-lg font-bold border-b ${styles.borderClass} pb-1.5 mb-3`}>
            Watch Log Sessions ({scopedLogs.length})
          </h2>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${styles.borderClass} opacity-75 uppercase text-[10px]`}>
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Title</th>
                <th className="py-1 pr-2">Progress</th>
                <th className="py-1">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {scopedLogs.map((log) => (
                <tr key={log.id} className="print-avoid-break">
                  <td className="py-1.5 pr-2">{log.date}</td>
                  <td className="py-1.5 pr-2 font-medium">
                    {movieMap.get(log.movieId)?.title || 'Unknown'}
                  </td>
                  <td className="py-1.5 pr-2">{formatWatchLogBadge(log)}</td>
                  <td className="py-1.5 opacity-80">{log.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};
