import React, { useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Film, Layers } from 'lucide-react';
import type { ImportPreview } from '../../services/importExport';
import { useLibrary } from '../../store/LibraryContext';
import { Modal } from '../common/Modal';

interface ImportPreviewModalProps {
  preview: ImportPreview | null;
  onClose: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({ preview, onClose }) => {
  const { applyImportPreview, activeProfile } = useLibrary();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  if (!preview) return null;

  const isHousehold = preview.format === 'movielibrary-household-json';

  const handleConfirm = () => {
    applyImportPreview(preview, mode);
    onClose();
  };

  return (
    <Modal
      open={Boolean(preview)}
      onClose={onClose}
      title="Import Preview"
      subtitle={preview.filename}
      maxWidthClass="max-w-md"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
          <FileSpreadsheet className="w-5 h-5 text-rose-700 dark:text-rose-300 shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-300">
              Detected Format
            </p>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {preview.formatLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          {isHousehold && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/70 dark:border-stone-800">
              <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
                {preview.summaryCounts.profiles}
              </p>
              <p className="text-[11px] text-stone-500">Viewers</p>
            </div>
          )}
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/70 dark:border-stone-800">
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {preview.summaryCounts.shelves}
            </p>
            <p className="text-[11px] text-stone-500">Lists</p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/70 dark:border-stone-800">
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {preview.summaryCounts.movies}
            </p>
            <p className="text-[11px] text-stone-500">Titles</p>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200/70 dark:border-stone-800">
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {preview.summaryCounts.watchLogs}
            </p>
            <p className="text-[11px] text-stone-500">Watches</p>
          </div>
        </div>

        {preview.duplicateCount > 0 && (
          <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/80 px-3 py-2 rounded-xl">
            Detected <strong>{preview.duplicateCount}</strong> duplicate title(s) matching existing
            entries.
          </p>
        )}

        {preview.warnings.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
            {preview.warnings.map((w, i) => (
              <p
                key={i}
                className="text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{w}</span>
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            Import Strategy {activeProfile && !isHousehold ? `into ${activeProfile.name}` : ''}
          </p>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 cursor-pointer hover:border-rose-400 transition-colors">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
              className="mt-1 accent-rose-600"
            />
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Film className="w-4 h-4 text-emerald-600" /> Merge (Recommended)
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isHousehold
                  ? 'Safely combines household viewers, lists, movies, and watch logs without losing existing entries.'
                  : 'Adds new movies/series and lists while skipping duplicates already in your library.'}
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 cursor-pointer hover:border-rose-400 transition-colors">
            <input
              type="radio"
              name="import-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
              className="mt-1 accent-rose-600"
            />
            <div>
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-500" /> Replace{' '}
                {isHousehold ? 'Entire Household' : 'Current Viewer Library'}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isHousehold
                  ? 'Overwrites all local household viewers and data with this backup.'
                  : 'Replaces your current profile’s movies and lists with the imported file.'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={preview.summaryCounts.movies === 0 && preview.summaryCounts.profiles === 0}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
          >
            Run Import
          </button>
        </div>
      </div>
    </Modal>
  );
};
