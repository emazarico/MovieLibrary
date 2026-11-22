import React, { useEffect, useMemo, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { MediaType, WatchStatus } from '../../types/movie';
import {
  buildPdfReportData,
  buildStandaloneReportHtml,
  type PdfReportLayout,
  type PdfReportOptions,
  type PdfReportTheme,
} from '../../utils/pdfReport';
import { formatWatchHours } from '../../utils/progress';
import { Modal } from '../common/Modal';

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  onTriggerPrint: (options: PdfReportOptions) => void;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  open,
  onClose,
  onTriggerPrint,
}) => {
  const { db, activeProfiles, activeProfile, addToast } = useLibrary();

  const [title, setTitle] = useState('MovieLibrary Watch Report');
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statuses, setStatuses] = useState<WatchStatus[]>([
    'watched',
    'watching',
    'want-to-watch',
    'dropped',
  ]);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | MediaType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [layout, setLayout] = useState<PdfReportLayout>('cards');
  const [theme, setTheme] = useState<PdfReportTheme>('classic');
  const [handoutMovieId, setHandoutMovieId] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeSummaryAndChart, setIncludeSummaryAndChart] = useState(true);
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeWatchLogs, setIncludeWatchLogs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedProfileIds(activeProfile ? [activeProfile.id] : []);
    setTitle(
      activeProfile
        ? `${activeProfile.name}'s Cinema Report`
        : 'Household Cinema Report',
    );
  }, [open, activeProfile]);

  const availableTags = useMemo(() => {
    const scopeIds =
      selectedProfileIds.length === 0
        ? new Set(activeProfiles.map((p) => p.id))
        : new Set(selectedProfileIds);
    const tags = new Set<string>();
    for (const m of db.movies) {
      if (m.deletedAt || !scopeIds.has(m.profileId)) continue;
      for (const t of m.tags) {
        if (t.trim()) tags.add(t.trim());
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [db.movies, activeProfiles, selectedProfileIds]);

  const baseFilterOptions: PdfReportOptions = useMemo(
    () => ({
      profileIds: selectedProfileIds,
      dateFrom,
      dateTo,
      statuses,
      mediaTypeFilter,
      tagFilter,
      layout,
      theme,
      orientation,
      includeSummaryAndChart,
      includeTimeline,
      includeNotes,
      includeWatchLogs,
      title,
    }),
    [
      selectedProfileIds,
      dateFrom,
      dateTo,
      statuses,
      mediaTypeFilter,
      tagFilter,
      layout,
      theme,
      orientation,
      includeSummaryAndChart,
      includeTimeline,
      includeNotes,
      includeWatchLogs,
      title,
    ],
  );

  const previewData = useMemo(
    () => buildPdfReportData(db, baseFilterOptions),
    [db, baseFilterOptions],
  );

  const effectiveHandoutMovieId = useMemo(() => {
    if (previewData.movies.length === 0) return '';
    return previewData.movies.some((m) => m.id === handoutMovieId)
      ? handoutMovieId
      : previewData.movies[0].id;
  }, [previewData.movies, handoutMovieId]);

  const options: PdfReportOptions = useMemo(
    () => ({
      ...baseFilterOptions,
      handoutMovieId: layout === 'handout' ? effectiveHandoutMovieId : undefined,
    }),
    [baseFilterOptions, layout, effectiveHandoutMovieId],
  );

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleStatus = (st: WatchStatus) => {
    setStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st],
    );
  };

  const applyPreset = (preset: 'all' | 'year' | '6m' | '30d') => {
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'year') {
      setDateFrom(`${new Date().getFullYear()}-01-01`);
      setDateTo(today);
    } else if (preset === '6m') {
      setDateFrom(isoDaysAgo(180));
      setDateTo(today);
    } else {
      setDateFrom(isoDaysAgo(30));
      setDateTo(today);
    }
  };

  const handleDownloadHtml = () => {
    const html = buildStandaloneReportHtml(previewData, options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movielibrary-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToast({
      title: 'Downloaded printable HTML report',
      description: 'Open in any browser to view or print/save as PDF offline.',
      tone: 'success',
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export MovieLibrary to PDF"
      subtitle="Choose viewers, date range, theme, layout, and sections to capture."
      maxWidthClass="max-w-2xl"
    >
      <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
            Report Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Who (Viewers) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
            Who (Viewers)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedProfileIds([])}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                selectedProfileIds.length === 0
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
              }`}
            >
              Entire Household ({activeProfiles.length})
            </button>
            {activeProfiles.map((p) => {
              const selected = selectedProfileIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProfile(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-stone-50 dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {p.avatarEmoji} {p.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Date Range
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'year', label: 'This Year' },
                  { id: '6m', label: 'Last 6 Mo' },
                  { id: '30d', label: 'Last 30 Days' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-rose-500/15 text-[11px] font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
              className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
              className="px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none"
            />
          </div>
        </div>

        {/* Statuses */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
            Include Statuses
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'watched', label: 'Watched' },
                { id: 'watching', label: 'Watching' },
                { id: 'want-to-watch', label: 'Want to Watch' },
                { id: 'dropped', label: 'Dropped' },
              ] as const
            ).map((item) => {
              const checked = statuses.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleStatus(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    checked
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-transparent'
                      : 'bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Type
            </label>
            <select
              value={mediaTypeFilter}
              onChange={(e) => setMediaTypeFilter(e.target.value as 'all' | MediaType)}
              className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
            >
              <option value="all">All Types</option>
              <option value="movie">Movies</option>
              <option value="series">TV Series</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Tag
            </label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
            >
              <option value="">All Tags</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Layout
            </label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as PdfReportLayout)}
              className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
            >
              <option value="cards">Visual Cards</option>
              <option value="table">Compact Table</option>
              <option value="poster">Poster Grid</option>
              <option value="checklist">Watchlist Check</option>
              <option value="handout">Movie Night Guide</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Theme
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as PdfReportTheme)}
              className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
            >
              <option value="classic">Cinema Crimson</option>
              <option value="modern">Modern Indigo</option>
              <option value="minimal">Minimal Ink-Saver</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
              Orientation
            </label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
              className="w-full px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold outline-none"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>

        {layout === 'handout' && previewData.movies.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Featured Title for Movie Night Guide
            </label>
            <select
              value={effectiveHandoutMovieId}
              onChange={(e) => setHandoutMovieId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-900 dark:text-stone-100 outline-none"
            >
              {previewData.movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} — {m.director}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <label
            className={`flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 ${
              layout === 'handout' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={includeSummaryAndChart}
              disabled={layout === 'handout'}
              onChange={(e) => setIncludeSummaryAndChart(e.target.checked)}
              className="accent-rose-600"
            />
            <span className="font-medium">Summary KPIs &amp; Chart</span>
          </label>
          <label
            className={`flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 ${
              layout === 'handout' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <input
              type="checkbox"
              checked={includeTimeline}
              disabled={layout === 'handout'}
              onChange={(e) => setIncludeTimeline(e.target.checked)}
              className="accent-rose-600"
            />
            <span className="font-medium">Watch Timeline</span>
          </label>
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="accent-rose-600"
            />
            <span className="font-medium">Reviews &amp; Notes</span>
          </label>
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWatchLogs}
              onChange={(e) => setIncludeWatchLogs(e.target.checked)}
              className="accent-rose-600"
            />
            <span className="font-medium">Watch Log Sessions</span>
          </label>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
          <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
            Report Preview: {previewData.totalTitles} titles ·{' '}
            {formatWatchHours(previewData.totalMinutesWatched)} watched · {previewData.logs.length}{' '}
            sessions
          </p>
          {previewData.movies.length > 0 ? (
            <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 truncate">
              Includes:{' '}
              {previewData.movies
                .slice(0, 4)
                .map((m) => m.title)
                .join(', ')}
              {previewData.movies.length > 4 ? ` +${previewData.movies.length - 4} more` : ''}
            </p>
          ) : (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">
              No titles match your current report filters.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={previewData.movies.length === 0}
            onClick={handleDownloadHtml}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-800 dark:text-stone-100 disabled:opacity-40 cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Download Printable HTML
          </button>

          <button
            type="button"
            disabled={previewData.movies.length === 0}
            onClick={() => onTriggerPrint(options)}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-md shadow-rose-600/20 disabled:opacity-40 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Export / Save as PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};
