import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileSpreadsheet,
  FolderPlus,
  Pencil,
  Printer,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { hasTmdbCredentials } from '../../services/apiConfig';
import { getStorageEngineInfo, type StorageEngineInfo } from '../../services/idbStorage';
import {
  exportHouseholdJson,
  exportLetterboxdCsv,
  exportProfileJson,
  exportWatchLogsCsv,
  inspectImportFile,
  type ImportPreview,
} from '../../services/importExport';
import { useLibrary } from '../../store/LibraryContext';
import { SHELF_COLORS } from '../../utils/themes';
import { HouseholdAdminModal } from '../profiles/HouseholdAdminModal';
import { ApiSettingsModal } from '../search/ApiSettingsModal';
import { CloudSyncModal } from './CloudSyncModal';
import { ImportPreviewModal } from './ImportPreviewModal';

interface ShelvesDataViewProps {
  onOpenPdfExport: () => void;
}

function formatByteCount(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ShelvesDataView: React.FC<ShelvesDataViewProps> = ({ onOpenPdfExport }) => {
  const {
    db,
    activeProfile,
    activeProfiles,
    isActiveProfileAdmin,
    profileShelves,
    profileMovies,
    profileLogs,
    householdSettings,
    apiConfig,
    addShelf,
    updateShelf,
    deleteShelf,
    loadSampleHousehold,
    resetAllLocalData,
    legacyCinemaTrackRaw,
    storageEngine,
    syncStatus,
    driveConfig,
    addToast,
  } = useLibrary();

  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfColor, setNewShelfColor] = useState('rose');
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageEngineInfo | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void getStorageEngineInfo(db).then((info) => {
      if (active) setStorageInfo(info);
    });
    return () => {
      active = false;
    };
  }, [db]);

  const handleCreateShelf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName.trim()) return;
    addShelf(newShelfName.trim(), newShelfColor);
    setNewShelfName('');
  };

  const handleStartRename = (id: string, currentName: string) => {
    setEditingShelfId(id);
    setEditingShelfName(currentName);
  };

  const handleCommitRename = (id: string) => {
    if (editingShelfName.trim()) {
      updateShelf(id, { name: editingShelfName.trim() });
    }
    setEditingShelfId(null);
  };

  const handleReorder = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= profileShelves.length) return;
    const a = profileShelves[index];
    const b = profileShelves[targetIdx];
    updateShelf(a.id, { sortOrder: targetIdx });
    updateShelf(b.id, { sortOrder: index });
  };

  const processImportedFile = async (file: File) => {
    const text = await file.text();
    const preview = inspectImportFile(file.name, text, db, activeProfile?.id || null);
    if (preview.format === 'unknown') {
      addToast({
        title: 'Unsupported import file',
        description:
          preview.warnings[0] ||
          'Expected MovieLibrary JSON, Letterboxd CSV, IMDb CSV, or CinemaTrack CSV/JSON.',
        tone: 'error',
      });
      return;
    }
    setImportPreview(preview);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processImportedFile(file);
  };

  const effectiveEngine = storageInfo?.engine || storageEngine;
  const tmdbReady = hasTmdbCredentials(apiConfig);

  return (
    <div className="space-y-8 animate-fade-slide">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
            Lists, APIs &amp; Sync
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Organize {activeProfile?.name}&rsquo;s watchlists, configure TMDB &amp; streaming region,
            import from Letterboxd/IMDb/CinemaTrack, or sync via Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={() => setApiModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-100 shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            {tmdbReady ? `TMDB Active (${householdSettings.streamingRegion})` : 'Configure Movie APIs'}
          </button>

          <button
            type="button"
            onClick={() => setCloudModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-100 shadow-xs cursor-pointer"
          >
            <Cloud className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            {syncStatus === 'synced'
              ? `Synced (${driveConfig.userEmail || 'Drive'})`
              : 'Configure Google Drive'}
          </button>
        </div>
      </div>

      {/* Lists Management */}
      <section className="rounded-3xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
              My Lists
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Movies and series can belong to one or multiple lists at once.
            </p>
          </div>

          <form onSubmit={handleCreateShelf} className="flex items-center gap-2">
            <select
              value={newShelfColor}
              onChange={(e) => setNewShelfColor(e.target.value)}
              aria-label="New list color"
              className="px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 outline-none"
            >
              {Object.entries(SHELF_COLORS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newShelfName}
              onChange={(e) => setNewShelfName(e.target.value)}
              placeholder="New list name…"
              className="w-40 sm:w-52 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-sm text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer shrink-0"
            >
              <FolderPlus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>

        <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
          {profileShelves.length === 0 ? (
            <p className="p-6 text-sm text-stone-500 dark:text-stone-400 text-center">
              No lists yet. Create one above to organize your movies &amp; series.
            </p>
          ) : (
            profileShelves.map((shelf, index) => {
              const count = profileMovies.filter((m) => m.shelfIds.includes(shelf.id)).length;
              const colorMeta = SHELF_COLORS[shelf.color] || SHELF_COLORS.rose;

              return (
                <div
                  key={shelf.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 dark:hover:bg-stone-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`w-3 h-3 rounded-full shrink-0 ${colorMeta.dot}`} />
                    {editingShelfId === shelf.id ? (
                      <input
                        type="text"
                        value={editingShelfName}
                        onChange={(e) => setEditingShelfName(e.target.value)}
                        onBlur={() => handleCommitRename(shelf.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename(shelf.id);
                          if (e.key === 'Escape') setEditingShelfId(null);
                        }}
                        autoFocus
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-900 border border-rose-500 text-sm font-semibold text-stone-900 dark:text-stone-100 outline-none"
                      />
                    ) : (
                      <span className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                        {shelf.name}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 shrink-0">
                      {count} {count === 1 ? 'title' : 'titles'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleReorder(index, -1)}
                      aria-label="Move up"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === profileShelves.length - 1}
                      onClick={() => handleReorder(index, 1)}
                      aria-label="Move down"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 disabled:opacity-25 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartRename(shelf.id, shelf.name)}
                      aria-label={`Rename ${shelf.name}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateShelf(shelf.id, { visible: !shelf.visible })}
                      title={shelf.visible ? 'Visible in By List view' : 'Hidden'}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 cursor-pointer"
                    >
                      {shelf.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete list "${shelf.name}"? Titles stay in your library.`)) {
                          deleteShelf(shelf.id);
                        }
                      }}
                      aria-label={`Delete ${shelf.name}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Import & Export Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`p-6 rounded-3xl bg-white dark:bg-[#171A23] border-2 transition-all space-y-4 ${
            dragging
              ? 'border-rose-500 bg-rose-500/5'
              : 'border-stone-200/90 dark:border-stone-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Import Library or History
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Auto-detects MovieLibrary Household/Profile JSON, Letterboxd CSV, IMDb CSV, or
                CinemaTrack CSV/JSON.
              </p>
            </div>
            <Upload className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void processImportedFile(file);
            }}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-6 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 hover:border-rose-500 text-center cursor-pointer transition-colors"
          >
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Supports <code>.json</code> backups &amp; <code>.csv</code> exports
            </p>
          </div>

          {legacyCinemaTrackRaw && (
            <button
              type="button"
              onClick={() => {
                const preview = inspectImportFile(
                  'cinematrack-localStorage.json',
                  legacyCinemaTrackRaw,
                  db,
                  activeProfile?.id || null,
                );
                setImportPreview(preview);
              }}
              className="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 text-xs font-semibold cursor-pointer"
            >
              Import Detected CinemaTrack LocalStorage Data
            </button>
          )}
        </div>

        {/* Export & Reports */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Export, Backups &amp; PDF Reports
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Download portable backups or generate printable Movie Night Guides and yearbooks.
              </p>
            </div>
            <Download className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => exportHouseholdJson(db)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-left cursor-pointer"
            >
              <FileJson className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Household JSON
                </p>
                <p className="text-[11px] text-stone-400">All viewers, lists &amp; logs</p>
              </div>
            </button>

            <button
              type="button"
              disabled={!activeProfile}
              onClick={() => activeProfile && exportProfileJson(db, activeProfile)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-left cursor-pointer disabled:opacity-40"
            >
              <FileJson className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Profile JSON
                </p>
                <p className="text-[11px] text-stone-400">{activeProfile?.name}&rsquo;s backup</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => exportLetterboxdCsv(profileMovies, activeProfile?.name)}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-left cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Letterboxd CSV
                </p>
                <p className="text-[11px] text-stone-400">{profileMovies.length} titles</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                exportWatchLogsCsv(profileLogs, profileMovies, activeProfiles, activeProfile?.name)
              }
              className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 hover:border-rose-400 text-left cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Watch Logs CSV
                </p>
                <p className="text-[11px] text-stone-400">{profileLogs.length} watch sessions</p>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenPdfExport}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Create Custom PDF / Movie Night Guide
          </button>
        </div>
      </section>

      {/* Household Admin & Storage Diagnostics */}
      <section className="p-5 rounded-3xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Database className="w-3.5 h-3.5" />
              Storage: {effectiveEngine === 'indexeddb' ? 'IndexedDB' : 'localStorage'}
              {storageInfo ? ` (${formatByteCount(storageInfo.estimatedBytes)})` : ''}
            </span>
            {isActiveProfileAdmin && (
              <button
                type="button"
                onClick={() => setAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/12 text-rose-800 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Household Admin Controls
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400">
            Local-first storage stays in this browser until you connect Google Drive Sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Load the sample 3-viewer household (Alex, Maya, Sam)? This replaces current local data.',
                )
              ) {
                void loadSampleHousehold();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Load Sample Data
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Clear ALL local MovieLibrary data in this browser? Synced Google Drive files are not deleted.',
                )
              ) {
                resetAllLocalData();
              }
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            Reset Local DB
          </button>
        </div>
      </section>

      <CloudSyncModal open={cloudModalOpen} onClose={() => setCloudModalOpen(false)} />
      <ApiSettingsModal open={apiModalOpen} onClose={() => setApiModalOpen(false)} />
      <HouseholdAdminModal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
      <ImportPreviewModal preview={importPreview} onClose={() => setImportPreview(null)} />
    </div>
  );
};
