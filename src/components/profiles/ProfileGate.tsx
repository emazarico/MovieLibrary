import React, { useRef, useState } from 'react';
import {
  Clapperboard,
  Cloud,
  History,
  Lock,
  Moon,
  Plus,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { inspectImportFile, type ImportPreview } from '../../services/importExport';
import { useLibrary } from '../../store/LibraryContext';
import { isProfileAdmin } from '../../utils/admin';
import { AVATAR_THEME_MAP } from '../../utils/themes';
import { CloudSyncModal } from '../management/CloudSyncModal';
import { ImportPreviewModal } from '../management/ImportPreviewModal';
import { HouseholdAdminModal } from './HouseholdAdminModal';
import { PinModal } from './PinModal';
import { ProfileFormModal } from './ProfileFormModal';

export const ProfileGate: React.FC = () => {
  const {
    db,
    activeProfiles,
    pendingPinProfile,
    beginSwitchToProfile,
    cancelPendingPin,
    loadSampleHousehold,
    legacyCinemaTrackRaw,
    dismissLegacyCinemaTrackBanner,
    theme,
    toggleTheme,
    syncStatus,
    addToast,
  } = useLibrary();

  const [createOpen, setCreateOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const preview = inspectImportFile(file.name, text, db, null);
      if (preview.format === 'unknown') {
        addToast({
          title: 'Unrecognized backup format',
          description:
            preview.warnings[0] ||
            'Choose a MovieLibrary JSON, Letterboxd CSV, IMDb CSV, or CinemaTrack CSV/JSON file.',
          tone: 'error',
        });
      } else {
        setImportPreview(preview);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleImportCinemaTrack = () => {
    if (!legacyCinemaTrackRaw) return;
    const preview = inspectImportFile('cinematrack-localStorage.json', legacyCinemaTrackRaw, db, null);
    setImportPreview(preview);
  };

  return (
    <div className="min-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col relative overflow-hidden bg-[#FAF8F5] dark:bg-[#0F1117]">
      {/* Warm cinema ambient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-96 h-96 rounded-full bg-rose-500/15 dark:bg-rose-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-amber-400/15 dark:bg-amber-500/10 blur-3xl" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 max-w-5xl mx-auto w-full px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-600/25">
            <Clapperboard className="w-5 h-5" />
          </div>
          <span className="font-serif-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            MovieLibrary
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {activeProfiles.length > 0 && (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-[#171A23]/80 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span className="hidden sm:inline">Parent / Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCloudOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 dark:bg-[#171A23]/80 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors cursor-pointer shadow-xs"
          >
            <Cloud className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>
              {syncStatus === 'synced'
                ? 'Drive Synced'
                : syncStatus === 'token_expired'
                  ? 'Reconnect Drive'
                  : 'Google Drive Sync'}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="p-2 rounded-full bg-white/80 dark:bg-[#171A23]/80 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
        {legacyCinemaTrackRaw && (
          <div className="w-full max-w-2xl mb-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <History className="w-5 h-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  CinemaTrack movie history found in this browser
                </p>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Import your older CinemaTrack ratings and watchlist right into a viewer profile.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleImportCinemaTrack}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                Import History
              </button>
              <button
                type="button"
                onClick={dismissLegacyCinemaTrackBanner}
                className="px-2 py-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Who&apos;s Watching?
          </h1>
          <p className="text-sm sm:text-base text-stone-500 dark:text-stone-400 mt-2 max-w-md mx-auto">
            Select your profile to open your watchlist, streaming picks, and family movie nights.
          </p>
        </div>

        {/* Profile Grid */}
        <div className="w-full flex flex-wrap items-stretch justify-center gap-5">
          {activeProfiles.map((profile) => {
            const themeMeta = AVATAR_THEME_MAP[profile.avatarTheme] || AVATAR_THEME_MAP.rose;
            const userMovies = db.movies.filter(
              (m) => m.profileId === profile.id && !m.deletedAt,
            );
            const watchingNow = userMovies.filter((m) => m.status === 'watching').length;
            const profileAdmin = isProfileAdmin(profile, activeProfiles);

            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => beginSwitchToProfile(profile.id)}
                className="group relative w-44 sm:w-48 p-5 rounded-3xl bg-white/90 dark:bg-[#171A23]/95 border border-stone-200/90 dark:border-stone-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col items-center text-center cursor-pointer"
              >
                {profileAdmin && (
                  <span
                    title="Parent / Household Admin"
                    className="absolute top-3.5 left-3.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-800 dark:text-rose-300"
                  >
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}

                {profile.pinHash && (
                  <span
                    title="PIN protected"
                    className="absolute top-3.5 right-3.5 w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400"
                  >
                    <Lock className="w-3 h-3" />
                  </span>
                )}

                <div
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${themeMeta.gradient} flex items-center justify-center text-4xl shadow-lg group-hover:scale-105 transition-transform duration-200 mb-4 mt-1`}
                >
                  {profile.avatarEmoji}
                </div>

                <h2 className="font-serif-display text-lg font-bold text-stone-900 dark:text-stone-100 truncate max-w-full">
                  {profile.name}
                </h2>

                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {userMovies.length} {userMovies.length === 1 ? 'title' : 'titles'}
                  {watchingNow > 0 ? ` · ${watchingNow} watching` : ''}
                </p>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="group w-44 sm:w-48 p-5 rounded-3xl border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-rose-500 dark:hover:border-rose-400 hover:bg-rose-500/5 transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer min-h-[176px]"
          >
            <div className="w-14 h-14 rounded-2xl bg-stone-200/70 dark:bg-stone-800 group-hover:bg-rose-500/15 flex items-center justify-center text-stone-600 dark:text-stone-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors mb-3">
              <Plus className="w-7 h-7" />
            </div>
            <span className="font-semibold text-sm text-stone-700 dark:text-stone-200">
              Add Viewer
            </span>
            <span className="text-[11px] text-stone-400 mt-0.5">Optional PIN lock</span>
          </button>
        </div>

        {/* Empty-state / quick actions */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {activeProfiles.length === 0 && (
            <button
              type="button"
              onClick={() => void loadSampleHousehold()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Load Sample Family Theater
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-[#171A23] border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-200 hover:border-rose-400 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-stone-500" /> Restore Backup / Import File
          </button>
        </div>

        {activeProfiles.some((p) => p.id.startsWith('profile-demo-')) && (
          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500 text-center">
            Demo hint: Alex (Admin, open) · Maya (Viewer, PIN:{' '}
            <code className="font-mono font-semibold">1234</code>) · Sam (open)
          </p>
        )}
      </main>

      {pendingPinProfile && (
        <PinModal profile={pendingPinProfile} onCancel={cancelPendingPin} />
      )}

      <ProfileFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        editProfile={null}
      />

      <HouseholdAdminModal open={adminOpen} onClose={() => setAdminOpen(false)} />

      <CloudSyncModal open={cloudOpen} onClose={() => setCloudOpen(false)} />

      <ImportPreviewModal
        preview={importPreview}
        onClose={() => setImportPreview(null)}
      />
    </div>
  );
};
