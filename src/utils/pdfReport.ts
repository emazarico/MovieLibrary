import type {
  MediaType,
  MovieItem,
  MovieLibraryDatabase,
  UserProfile,
  WatchLog,
  WatchStatus,
} from '../types/movie';
import { formatRuntimeHuman, formatWatchHours, formatWatchLogBadge } from './progress';
import {
  buildTimelineGroups,
  computeMonthlyStats,
  type MonthlyBucket,
  type TimelineMonthGroup,
} from './stats';

export type PdfReportLayout = 'cards' | 'table' | 'poster' | 'checklist' | 'handout';
export type PdfReportTheme = 'classic' | 'modern' | 'minimal';

export interface PdfReportOptions {
  profileIds: string[];
  dateFrom: string;
  dateTo: string;
  statuses: WatchStatus[];
  mediaTypeFilter: 'all' | MediaType;
  tagFilter: string;
  layout: PdfReportLayout;
  theme?: PdfReportTheme;
  handoutMovieId?: string;
  orientation: 'portrait' | 'landscape';
  includeSummaryAndChart: boolean;
  includeTimeline: boolean;
  includeNotes: boolean;
  includeWatchLogs: boolean;
  title: string;
}

export interface PdfReportData {
  generatedAt: string;
  profiles: UserProfile[];
  allProfiles: UserProfile[];
  movies: MovieItem[];
  logs: WatchLog[];
  totalTitles: number;
  watchedCount: number;
  watchingCount: number;
  seriesCount: number;
  totalMinutesWatched: number;
  averageRating: number;
  chartYear: number;
  monthlyBuckets: MonthlyBucket[];
  timelineGroups: TimelineMonthGroup[];
}

interface ThemeTokens {
  headingFont: string;
  bodyFont: string;
  surfaceTint: string;
  borderColor: string;
  accentColor: string;
  chartAccent: string;
  pillBg: string;
  pillColor: string;
  formatBg: string;
  formatColor: string;
  textColor: string;
  mutedColor: string;
}

const THEME_TOKENS: Record<PdfReportTheme, ThemeTokens> = {
  classic: {
    headingFont: 'Georgia, "Times New Roman", serif',
    bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    surfaceTint: '#fff7f8',
    borderColor: '#fecdd3',
    accentColor: '#be123c',
    chartAccent: '#e11d48',
    pillBg: '#f5f5f4',
    pillColor: '#44403c',
    formatBg: '#ffe4e6',
    formatColor: '#9f1239',
    textColor: '#1c1917',
    mutedColor: '#57534e',
  },
  modern: {
    headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    surfaceTint: '#f5f7ff',
    borderColor: '#dbeafe',
    accentColor: '#4f46e5',
    chartAccent: '#4f46e5',
    pillBg: '#eef2ff',
    pillColor: '#3730a3',
    formatBg: '#e0e7ff',
    formatColor: '#4338ca',
    textColor: '#0f172a',
    mutedColor: '#475569',
  },
  minimal: {
    headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    surfaceTint: '#ffffff',
    borderColor: '#d4d4d8',
    accentColor: '#18181b',
    chartAccent: '#3f3f46',
    pillBg: '#f4f4f5',
    pillColor: '#18181b',
    formatBg: '#f4f4f5',
    formatColor: '#27272a',
    textColor: '#111827',
    mutedColor: '#52525b',
  },
};

export const MOVIE_NIGHT_QUESTIONS: string[] = [
  'Which scene, shot, or musical cue stuck with you most after the credits rolled?',
  'How did the pacing, cinematography, or score shape the mood of the story?',
  'Did any character surprise you with a decision or turning point you did not see coming?',
  'How does this compare to other films or series in the same genre or by the same creator?',
  'Who else in the family or friend group would enjoy this, and is it worth a rewatch?',
];

function isDateInRange(dateStr: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const day = dateStr.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function buildPdfReportData(
  db: MovieLibraryDatabase,
  options: PdfReportOptions,
): PdfReportData {
  const allActiveProfiles = db.profiles.filter((p) => !p.deletedAt);
  const selectedProfiles =
    options.profileIds.length === 0
      ? allActiveProfiles
      : allActiveProfiles.filter((p) => options.profileIds.includes(p.id));

  const profileIdSet = new Set(selectedProfiles.map((p) => p.id));
  const statusSet = new Set(options.statuses);
  const tagNeedle = options.tagFilter.trim().toLowerCase();

  const logsInRange = db.watchLogs.filter(
    (l) =>
      !l.deletedAt &&
      profileIdSet.has(l.profileId) &&
      isDateInRange(l.date, options.dateFrom, options.dateTo),
  );
  const movieIdsWithLogsInRange = new Set(logsInRange.map((l) => l.movieId));

  const matchingMovies = db.movies
    .filter((m) => {
      if (m.deletedAt || !profileIdSet.has(m.profileId)) return false;
      if (!statusSet.has(m.status)) return false;
      if (options.mediaTypeFilter !== 'all' && m.mediaType !== options.mediaTypeFilter) {
        return false;
      }
      if (tagNeedle && !m.tags.some((t) => t.toLowerCase() === tagNeedle)) {
        return false;
      }

      if (options.dateFrom || options.dateTo) {
        const anchorDate = m.dateWatched || m.dateStarted || m.addedAt.slice(0, 10);
        const anchorMatches = isDateInRange(anchorDate, options.dateFrom, options.dateTo);
        if (!anchorMatches && !movieIdsWithLogsInRange.has(m.id)) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) =>
      (b.dateWatched || b.dateStarted || b.updatedAt).localeCompare(
        a.dateWatched || a.dateStarted || a.updatedAt,
      ),
    );

  const matchingMovieIds = new Set(matchingMovies.map((m) => m.id));
  const matchingLogs = logsInRange
    .filter((l) => matchingMovieIds.has(l.movieId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const allActiveLogsByMovie = new Map<string, number>();
  for (const log of db.watchLogs) {
    if (log.deletedAt || !matchingMovieIds.has(log.movieId)) continue;
    allActiveLogsByMovie.set(
      log.movieId,
      (allActiveLogsByMovie.get(log.movieId) ?? 0) + Math.max(0, log.minutesWatched || 0),
    );
  }

  let totalMinutesWatched = matchingLogs.reduce(
    (sum, l) => sum + Math.max(0, l.minutesWatched || 0),
    0,
  );
  for (const m of matchingMovies) {
    if (m.status !== 'watched' || m.runtimeMinutes <= 0) continue;
    const finMatches =
      !options.dateFrom && !options.dateTo
        ? true
        : isDateInRange(m.dateWatched, options.dateFrom, options.dateTo);
    if (finMatches) {
      const expected =
        m.mediaType === 'series' && (m.totalEpisodes ?? 0) > 0
          ? m.runtimeMinutes * (m.totalEpisodes ?? 1)
          : m.runtimeMinutes;
      const loggedAllTime = allActiveLogsByMovie.get(m.id) ?? 0;
      totalMinutesWatched += Math.max(0, expected - loggedAllTime);
    }
  }

  const ratedMovies = matchingMovies.filter((m) => m.rating > 0);
  const averageRating =
    ratedMovies.length > 0
      ? Number(
          (ratedMovies.reduce((sum, m) => sum + m.rating, 0) / ratedMovies.length).toFixed(2),
        )
      : 0;

  const chartYearCandidate = options.dateTo
    ? Number(options.dateTo.slice(0, 4))
    : options.dateFrom
      ? Number(options.dateFrom.slice(0, 4))
      : new Date().getFullYear();
  const chartYear =
    Number.isFinite(chartYearCandidate) && chartYearCandidate > 1900
      ? chartYearCandidate
      : new Date().getFullYear();

  const monthlyBuckets = computeMonthlyStats(matchingMovies, matchingLogs, chartYear, true);
  const timelineGroups = buildTimelineGroups(matchingMovies, 'all').filter(
    (g) =>
      (!options.dateFrom && !options.dateTo) ||
      g.movies.some((m) => isDateInRange(m.dateWatched, options.dateFrom, options.dateTo)),
  );

  return {
    generatedAt: new Date().toISOString(),
    profiles: selectedProfiles,
    allProfiles: allActiveProfiles,
    movies: matchingMovies,
    logs: matchingLogs,
    totalTitles: matchingMovies.length,
    watchedCount: matchingMovies.filter((m) => m.status === 'watched').length,
    watchingCount: matchingMovies.filter((m) => m.status === 'watching').length,
    seriesCount: matchingMovies.filter((m) => m.mediaType === 'series').length,
    totalMinutesWatched,
    averageRating,
    chartYear,
    monthlyBuckets,
    timelineGroups,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isPrintablePosterUrl(url?: string): url is string {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function renderPosterHtml(movie: MovieItem, className: string): string {
  if (isPrintablePosterUrl(movie.posterUrl)) {
    return `<img class="${className}" src="${escapeHtml(movie.posterUrl)}" alt="${escapeHtml(movie.title)}" />`;
  }
  return `
    <div class="${className} poster-fallback" aria-hidden="true">
      <div class="fallback-title">${escapeHtml(movie.title)}</div>
      <div class="fallback-author">${escapeHtml(movie.director)}</div>
    </div>
  `;
}

function renderInlineChartSvg(buckets: MonthlyBucket[], year: number, chartAccent: string): string {
  const maxVal = Math.max(60, ...buckets.map((b) => b.minutesWatched));
  const width = 680;
  const height = 160;
  const topPad = 14;
  const bottomPad = 24;
  const plotH = height - topPad - bottomPad;
  const leftPad = 42;
  const slotW = (width - leftPad - 10) / 12;
  const barW = Math.min(30, slotW * 0.62);

  const bars = buckets
    .map((b, i) => {
      const x = leftPad + i * slotW + (slotW - barW) / 2;
      const barH = Math.round((b.minutesWatched / maxVal) * plotH);
      const y = topPad + plotH - barH;
      return `
        <rect x="${x.toFixed(1)}" y="${y}" width="${barW.toFixed(1)}" height="${barH}" rx="4" fill="${escapeHtml(chartAccent)}" />
        <text x="${(x + barW / 2).toFixed(1)}" y="${height - 7}" text-anchor="middle" font-size="10" fill="#57534e">${escapeHtml(b.label)}</text>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-height:170px" role="img" aria-label="${year} monthly watch hours chart">
      <line x1="${leftPad}" x2="${width - 10}" y1="${topPad + plotH}" y2="${topPad + plotH}" stroke="#d6d3d1" stroke-width="1" />
      <text x="${leftPad - 5}" y="${topPad + 8}" text-anchor="end" font-size="9" fill="#78716c">${escapeHtml(formatWatchHours(maxVal))}</text>
      <text x="${leftPad - 5}" y="${topPad + plotH}" text-anchor="end" font-size="9" fill="#78716c">0h</text>
      ${bars}
    </svg>
  `;
}

function formatCoWatchersLabel(
  movie: MovieItem,
  profileMap: Map<string, UserProfile>,
): string {
  const names = (movie.watchedWithProfileIds || [])
    .map((id) => profileMap.get(id))
    .filter((p): p is UserProfile => Boolean(p))
    .map((p) => `${p.avatarEmoji} ${p.name}`);
  if (movie.watchedWithGuests?.trim()) {
    names.push(movie.watchedWithGuests.trim());
  }
  return names.join(', ');
}

export function buildStandaloneReportHtml(
  report: PdfReportData,
  options: PdfReportOptions,
): string {
  const themeKey: PdfReportTheme = options.theme ?? 'classic';
  const tokens = THEME_TOKENS[themeKey];
  const profileNames =
    report.profiles.map((p) => `${p.avatarEmoji} ${p.name}`).join(', ') || 'All Viewers';
  const allProfileMap = new Map(report.allProfiles.map((p) => [p.id, p]));
  const movieMap = new Map(report.movies.map((m) => [m.id, m]));
  const dateLabel =
    options.dateFrom || options.dateTo
      ? `${options.dateFrom || 'Start'} → ${options.dateTo || 'Present'}`
      : 'All Dates';

  const featuredMovie =
    options.layout === 'handout'
      ? (options.handoutMovieId ? movieMap.get(options.handoutMovieId) : undefined) ??
        report.movies[0]
      : undefined;

  let moviesHtml = '';
  if (options.layout === 'handout') {
    if (!featuredMovie) {
      moviesHtml = `<p class="sub">No matching movie or series available for a Movie Night Guide.</p>`;
    } else {
      const owner = allProfileMap.get(featuredMovie.profileId);
      const coWatchers = formatCoWatchersLabel(featuredMovie, allProfileMap);
      const specs = [
        featuredMovie.mediaType === 'series' ? 'TV Series' : 'Movie',
        featuredMovie.releaseYear ? String(featuredMovie.releaseYear) : '',
        featuredMovie.certification || '',
        featuredMovie.runtimeMinutes > 0 ? formatRuntimeHuman(featuredMovie.runtimeMinutes) : '',
        featuredMovie.language || '',
        featuredMovie.genres.slice(0, 3).join(', '),
        featuredMovie.rating > 0 ? `${featuredMovie.rating} ★` : '',
      ].filter(Boolean);

      moviesHtml = `
        <section class="handout-sheet">
          <div class="handout-kicker">Movie Night Discussion Guide${owner ? ` · ${escapeHtml(owner.avatarEmoji)} ${escapeHtml(owner.name)}` : ''}</div>
          <div class="handout-header">
            ${renderPosterHtml(featuredMovie, 'handout-cover')}
            <div class="handout-meta-col">
              <h2>${escapeHtml(featuredMovie.title)}</h2>
              <p class="handout-author">${escapeHtml(featuredMovie.director)}${featuredMovie.cast && featuredMovie.cast.length > 0 ? ` · Starring ${escapeHtml(featuredMovie.cast.slice(0, 3).join(', '))}` : ''}</p>
              <div class="handout-pills">
                <span class="pill">${escapeHtml(featuredMovie.status)}</span>
                ${featuredMovie.medium ? `<span class="pill format">${escapeHtml(featuredMovie.medium)}${featuredMovie.serviceName ? ` · ${escapeHtml(featuredMovie.serviceName)}` : ''}</span>` : ''}
                ${coWatchers ? `<span class="pill">With ${escapeHtml(coWatchers)}</span>` : ''}
                ${featuredMovie.tags.map((t) => `<span class="pill">#${escapeHtml(t)}</span>`).join('')}
              </div>
              ${specs.length > 0 ? `<p class="handout-specs">${escapeHtml(specs.join(' · '))}</p>` : ''}
            </div>
          </div>

          ${
            featuredMovie.synopsis
              ? `<div class="handout-box"><h3>Synopsis</h3><p>${escapeHtml(featuredMovie.synopsis)}</p></div>`
              : ''
          }

          ${
            options.includeNotes &&
            (featuredMovie.review || featuredMovie.notes || featuredMovie.wantToWatchNote)
              ? `<div class="handout-box"><h3>Viewer Review &amp; Notes</h3>${featuredMovie.review ? `<p><strong>Review:</strong> ${escapeHtml(featuredMovie.review)}</p>` : ''}${featuredMovie.wantToWatchNote ? `<p><strong>Why Watch:</strong> ${escapeHtml(featuredMovie.wantToWatchNote)}</p>` : ''}${featuredMovie.notes ? `<p><strong>Notes:</strong> ${escapeHtml(featuredMovie.notes)}</p>` : ''}</div>`
              : ''
          }

          <div class="handout-box">
            <h3>Movie Night Discussion Prompts</h3>
            <ol class="prompt-list">${MOVIE_NIGHT_QUESTIONS.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ol>
          </div>

          <div class="handout-box">
            <h3>Family Takeaways &amp; Quotes</h3>
            <div class="writing-lines">${Array.from({ length: 8 }).map(() => `<div class="writing-line"></div>`).join('')}</div>
          </div>
        </section>
      `;
    }
  } else if (options.layout === 'table') {
    moviesHtml = `
      <table>
        <thead>
          <tr><th>Title</th><th>Director / Creator</th><th>Type</th><th>Status</th><th>Runtime</th><th>Rating</th><th>Watched</th><th>With</th><th>Tags</th></tr>
        </thead>
        <tbody>
          ${report.movies
            .map((m) => {
              const co = formatCoWatchersLabel(m, allProfileMap);
              return `
                <tr>
                  <td><strong>${escapeHtml(m.title)}</strong>${m.releaseYear ? ` (${m.releaseYear})` : ''}${options.includeNotes && m.notes ? `<div class="note">${escapeHtml(m.notes)}</div>` : ''}</td>
                  <td>${escapeHtml(m.director)}</td>
                  <td>${escapeHtml(m.mediaType)}</td>
                  <td>${escapeHtml(m.status)}</td>
                  <td>${m.runtimeMinutes > 0 ? escapeHtml(formatRuntimeHuman(m.runtimeMinutes)) : '—'}</td>
                  <td>${m.rating > 0 ? `${m.rating} ★` : '—'}</td>
                  <td>${escapeHtml(m.dateWatched || '—')}</td>
                  <td>${escapeHtml(co || '—')}</td>
                  <td>${escapeHtml(m.tags.map((t) => `#${t}`).join(' '))}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  } else if (options.layout === 'poster') {
    moviesHtml = `
      <div class="poster-grid">
        ${report.movies
          .map(
            (m) => `
          <div class="poster-tile">
            ${renderPosterHtml(m, 'poster-cover')}
            <div class="poster-title">${escapeHtml(m.title)}</div>
            <div class="poster-author">${escapeHtml(m.director)}${m.releaseYear ? ` · ${m.releaseYear}` : ''}</div>
            <div class="poster-meta">${m.rating > 0 ? `<span class="pill">${m.rating} ★</span>` : `<span class="pill">${escapeHtml(m.status)}</span>`}</div>
          </div>`,
          )
          .join('')}
      </div>
    `;
  } else if (options.layout === 'checklist') {
    moviesHtml = `
      <table class="checklist">
        <thead>
          <tr><th style="width:28px">Seen</th><th>Title</th><th>Director / Creator</th><th>Where to Watch</th><th>Runtime</th><th>Status</th><th>Year</th></tr>
        </thead>
        <tbody>
          ${report.movies
            .map((m) => {
              const streamList = m.watchProviders?.stream.map((s) => s.providerName).slice(0, 2).join(', ');
              const where = streamList || m.serviceName || m.ownership || '—';
              return `
                <tr>
                  <td class="check-box">☐</td>
                  <td><strong>${escapeHtml(m.title)}</strong></td>
                  <td>${escapeHtml(m.director)}</td>
                  <td>${escapeHtml(where)}</td>
                  <td>${m.runtimeMinutes > 0 ? escapeHtml(formatRuntimeHuman(m.runtimeMinutes)) : '—'}</td>
                  <td>${escapeHtml(m.status)}</td>
                  <td class="mono">${m.releaseYear || '—'}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  } else {
    moviesHtml = `
      <div class="cards-grid">
        ${report.movies
          .map((m) => {
            const owner = allProfileMap.get(m.profileId);
            const co = formatCoWatchersLabel(m, allProfileMap);
            return `
            <div class="movie-card">
              <div class="card-row">
                ${isPrintablePosterUrl(m.posterUrl) ? renderPosterHtml(m, 'card-cover') : ''}
                <div class="card-body">
                  <div class="card-head">
                    <span class="pill">${escapeHtml(m.status)}</span>
                    <span class="pill format">${escapeHtml(m.mediaType === 'series' ? 'TV Series' : 'Movie')}</span>
                    ${report.profiles.length > 1 && owner ? `<span class="owner">${escapeHtml(owner.avatarEmoji)} ${escapeHtml(owner.name)}</span>` : ''}
                  </div>
                  <h3>${escapeHtml(m.title)}${m.releaseYear ? ` (${m.releaseYear})` : ''}</h3>
                  <p class="author">${escapeHtml(m.director)}</p>
                  <p class="meta">${m.rating > 0 ? `${m.rating} ★` : 'Unrated'}${m.runtimeMinutes > 0 ? ` · ${escapeHtml(formatRuntimeHuman(m.runtimeMinutes))}` : ''}${m.dateWatched ? ` · ${escapeHtml(m.dateWatched)}` : ''}</p>
                  ${co ? `<p class="meta">With: ${escapeHtml(co)}</p>` : ''}
                  ${options.includeNotes && m.review ? `<p class="note"><strong>Review:</strong> “${escapeHtml(m.review)}”</p>` : ''}
                  ${options.includeNotes && m.notes ? `<p class="note">“${escapeHtml(m.notes)}”</p>` : ''}
                  ${m.tags.length > 0 ? `<p class="tags">${escapeHtml(m.tags.map((t) => `#${t}`).join(' '))}</p>` : ''}
                </div>
              </div>
            </div>`;
          })
          .join('')}
      </div>
    `;
  }

  const timelineHtml =
    options.layout !== 'handout' && options.includeTimeline && report.timelineGroups.length > 0
      ? `
      <section>
        <h2>Watch Timeline</h2>
        ${report.timelineGroups
          .map(
            (g) => `
          <div class="timeline-group">
            <h4>${escapeHtml(g.label)} <span>(${g.movies.length} titles · ${escapeHtml(formatWatchHours(g.totalMinutes))})</span></h4>
            <ul>${g.movies.map((m) => `<li><strong>${escapeHtml(m.title)}</strong> — ${escapeHtml(m.director)} ${m.dateWatched ? `(${escapeHtml(m.dateWatched)})` : ''}</li>`).join('')}</ul>
          </div>`,
          )
          .join('')}
      </section>`
      : '';

  const scopedLogs =
    options.layout === 'handout' && featuredMovie
      ? report.logs.filter((l) => l.movieId === featuredMovie.id)
      : report.logs;

  const logsHtml =
    options.includeWatchLogs && scopedLogs.length > 0
      ? `
      <section>
        <h2>Watch Log Sessions (${scopedLogs.length})</h2>
        <table>
          <thead><tr><th>Date</th><th>Title</th><th>Progress</th><th>With</th><th>Note</th></tr></thead>
          <tbody>
            ${scopedLogs
              .map((l) => {
                const m = movieMap.get(l.movieId);
                const coNames = (l.watchedWithProfileIds || [])
                  .map((id) => allProfileMap.get(id)?.name)
                  .filter(Boolean)
                  .join(', ');
                return `<tr><td>${escapeHtml(l.date)}</td><td>${escapeHtml(m?.title || 'Unknown')}</td><td>${escapeHtml(formatWatchLogBadge(l))}</td><td>${escapeHtml(coNames || l.watchedWithGuests || '—')}</td><td>${escapeHtml(l.note || '')}</td></tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </section>`
      : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(options.title)}</title>
<style>
  @page { size: ${options.orientation}; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${tokens.bodyFont}; color: ${tokens.textColor}; background: #fff; margin: 0; padding: 24px; line-height: 1.45; }
  header { border-bottom: 2px solid ${tokens.borderColor}; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-family: ${tokens.headingFont}; margin: 0 0 6px; font-size: 24px; }
  h2 { font-family: ${tokens.headingFont}; margin: 22px 0 10px; font-size: 18px; border-bottom: 1px solid ${tokens.borderColor}; padding-bottom: 4px; }
  .sub { font-size: 12px; color: ${tokens.mutedColor}; margin: 0; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi { border: 1px solid ${tokens.borderColor}; border-radius: 10px; padding: 10px 12px; background: ${tokens.surfaceTint}; }
  .kpi .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: ${tokens.mutedColor}; }
  .kpi .val { font-size: 18px; font-weight: 700; margin-top: 2px; color: ${tokens.accentColor}; }
  .cards-grid { display: grid; grid-template-columns: repeat(${options.orientation === 'landscape' ? 3 : 2}, 1fr); gap: 12px; }
  .movie-card { border: 1px solid ${tokens.borderColor}; background: ${tokens.surfaceTint}; border-radius: 12px; padding: 12px; break-inside: avoid; }
  .card-row { display: flex; gap: 10px; align-items: flex-start; }
  .card-cover { width: 48px; height: 72px; object-fit: cover; border-radius: 4px; border: 1px solid ${tokens.borderColor}; flex-shrink: 0; }
  .card-body { min-width: 0; flex: 1; }
  .movie-card h3 { font-family: ${tokens.headingFont}; margin: 6px 0 2px; font-size: 14px; }
  .author, .meta { font-size: 11px; color: ${tokens.mutedColor}; margin: 0; }
  .note { font-size: 11px; font-style: italic; margin: 6px 0 0; }
  .tags { font-size: 10px; color: ${tokens.accentColor}; margin: 6px 0 0; font-weight: 600; }
  .card-head { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pill { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: ${tokens.pillBg}; color: ${tokens.pillColor}; }
  .pill.format { background: ${tokens.formatBg}; color: ${tokens.formatColor}; }
  .owner { font-size: 10px; color: ${tokens.mutedColor}; margin-left: auto; }
  .poster-grid { display: grid; grid-template-columns: repeat(${options.orientation === 'landscape' ? 5 : 4}, 1fr); gap: 14px; }
  .poster-tile { border: 1px solid ${tokens.borderColor}; background: ${tokens.surfaceTint}; border-radius: 10px; padding: 8px; text-align: center; break-inside: avoid; display: flex; flex-direction: column; align-items: center; }
  .poster-cover { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 6px; border: 1px solid ${tokens.borderColor}; margin-bottom: 6px; }
  .poster-fallback { width: 100%; aspect-ratio: 2 / 3; border-radius: 6px; border: 1px solid ${tokens.borderColor}; background: ${tokens.pillBg}; padding: 10px 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .fallback-title { font-family: ${tokens.headingFont}; font-weight: 700; font-size: 11px; line-height: 1.25; }
  .fallback-author { font-size: 10px; color: ${tokens.mutedColor}; margin-top: 4px; }
  .poster-title { font-family: ${tokens.headingFont}; font-weight: 700; font-size: 11px; line-height: 1.25; margin-top: 2px; }
  .poster-author { font-size: 10px; color: ${tokens.mutedColor}; margin: 2px 0 4px; }
  .poster-meta { margin-top: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border-bottom: 1px solid ${tokens.borderColor}; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; color: ${tokens.mutedColor}; background: ${tokens.surfaceTint}; }
  .check-box { text-align: center; font-size: 14px; line-height: 1; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
  .handout-sheet { border: 1.5px solid ${tokens.borderColor}; background: ${tokens.surfaceTint}; border-radius: 14px; padding: 18px; }
  .handout-kicker { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${tokens.accentColor}; margin-bottom: 10px; }
  .handout-header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
  .handout-cover { width: 96px; height: 144px; object-fit: cover; border-radius: 8px; border: 1px solid ${tokens.borderColor}; flex-shrink: 0; }
  .handout-meta-col { flex: 1; min-width: 0; }
  .handout-meta-col h2 { margin: 0 0 4px; border: none; padding: 0; font-size: 20px; }
  .handout-author { margin: 0 0 8px; font-size: 13px; color: ${tokens.mutedColor}; font-weight: 600; }
  .handout-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .handout-specs { font-size: 11px; color: ${tokens.mutedColor}; margin: 0; }
  .handout-box { background: #fff; border: 1px solid ${tokens.borderColor}; border-radius: 10px; padding: 12px 14px; margin-top: 12px; break-inside: avoid; }
  .handout-box h3 { font-family: ${tokens.headingFont}; font-size: 13px; margin: 0 0 6px; color: ${tokens.accentColor}; }
  .handout-box p { font-size: 11px; margin: 4px 0 0; }
  .prompt-list { margin: 4px 0 0; padding-left: 18px; font-size: 11px; }
  .prompt-list li { margin-bottom: 5px; }
  .writing-lines { margin-top: 6px; }
  .writing-line { height: 22px; border-bottom: 1px dashed ${tokens.borderColor}; }
  .timeline-group { margin-bottom: 10px; break-inside: avoid; }
  .timeline-group h4 { margin: 0 0 4px; font-size: 13px; }
  .timeline-group h4 span { font-weight: 400; color: ${tokens.mutedColor}; font-size: 11px; }
  .timeline-group ul { margin: 0; padding-left: 18px; font-size: 11px; }
</style>
</head>
<body data-theme="${escapeHtml(themeKey)}" data-layout="${escapeHtml(options.layout)}">
  <header>
    <h1>${escapeHtml(options.title)}</h1>
    <p class="sub">Viewers: ${escapeHtml(profileNames)} · Dates: ${escapeHtml(dateLabel)} · Type: ${escapeHtml(options.mediaTypeFilter)} ${options.tagFilter ? `· Tag: #${escapeHtml(options.tagFilter)}` : ''} · Theme: ${escapeHtml(themeKey)} · Generated ${escapeHtml(report.generatedAt.split('T')[0])}</p>
  </header>
  ${
    options.layout !== 'handout' && options.includeSummaryAndChart
      ? `
    <div class="kpis">
      <div class="kpi"><div class="lbl">Titles</div><div class="val">${report.totalTitles}</div></div>
      <div class="kpi"><div class="lbl">Watched</div><div class="val">${report.watchedCount}</div></div>
      <div class="kpi"><div class="lbl">Watch Time</div><div class="val">${escapeHtml(formatWatchHours(report.totalMinutesWatched))}</div></div>
      <div class="kpi"><div class="lbl">Avg Rating</div><div class="val">${report.averageRating > 0 ? `${report.averageRating} ★` : '—'}</div></div>
    </div>
    <h2>${report.chartYear} Monthly Watch Time</h2>
    ${renderInlineChartSvg(report.monthlyBuckets, report.chartYear, tokens.chartAccent)}
  `
      : ''
  }
  ${options.layout === 'handout' ? moviesHtml : `<section><h2>Movie &amp; Series Catalog (${report.movies.length})</h2>${moviesHtml}</section>`}
  ${timelineHtml}
  ${logsHtml}
</body>
</html>`;
}
