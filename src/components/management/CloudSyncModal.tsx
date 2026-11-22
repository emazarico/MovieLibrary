import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import { Modal } from '../common/Modal';

interface CloudSyncModalProps {
  open: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ open, onClose }) => {
  const {
    syncStatus,
    syncError,
    driveConfig,
    isDriveConnected,
    hasUnsyncedChanges,
    updateDriveConfig,
    connectGoogleDrive,
    syncNow,
    disconnectGoogleDrive,
    addToast,
  } = useLibrary();

  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  useEffect(() => {
    if (!open) return;
    if (!driveConfig.clientId.trim() || syncStatus === 'error') {
      setGuideOpen(true);
    }
  }, [open, driveConfig.clientId, syncStatus]);

  const invalidClientIdFormat =
    driveConfig.clientId.trim().length > 0 &&
    !driveConfig.clientId.trim().endsWith('.apps.googleusercontent.com');

  const handleCopyFileId = () => {
    if (!driveConfig.fileId) return;
    navigator.clipboard
      .writeText(driveConfig.fileId)
      .then(() => {
        setCopiedFileId(true);
        addToast({ title: 'Copied Drive File ID', tone: 'success' });
        window.setTimeout(() => setCopiedFileId(false), 2000);
      })
      .catch(() => undefined);
  };

  const handleCopyOrigin = () => {
    navigator.clipboard
      .writeText(origin)
      .then(() => {
        setCopiedOrigin(true);
        addToast({ title: 'Copied origin URL', tone: 'success' });
        window.setTimeout(() => setCopiedOrigin(false), 2000);
      })
      .catch(() => undefined);
  };

  const statusBadge = () => {
    switch (syncStatus) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Synced
          </span>
        );
      case 'syncing':
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {syncStatus === 'connecting' ? 'Connecting…' : 'Syncing…'}
          </span>
        );
      case 'token_expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Reconnect Needed
          </span>
        );
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-500/15 text-stone-600 dark:text-stone-300">
            <CloudOff className="w-3 h-3" /> Offline (Local-first active)
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-3 h-3" /> Sync Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-200/80 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
            <Cloud className="w-3 h-3" /> Local Browser Only
          </span>
        );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Google Drive Household Sync"
      subtitle="Sync all viewer profiles, watchlists, movies, series, and co-watch logs via movielibrary-db.json."
      maxWidthClass="max-w-lg"
    >
      <div className="p-5 space-y-5">
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Connection Status
            </span>
            {statusBadge()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <span className="text-stone-400 block">Google Account</span>
              <span className="font-medium text-stone-800 dark:text-stone-200">
                {driveConfig.userEmail || 'Not signed in'}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block">Last Synced</span>
              <span className="font-medium text-stone-800 dark:text-stone-200">
                {driveConfig.lastSyncedAt
                  ? new Date(driveConfig.lastSyncedAt).toLocaleString()
                  : 'Never'}
              </span>
            </div>
          </div>

          {driveConfig.fileId && (
            <div className="pt-2 border-t border-stone-200/70 dark:border-stone-800 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-stone-400 block">
                  Drive File ID (auto-detected on shared account)
                </span>
                <code className="font-mono text-[11px] text-stone-700 dark:text-stone-300 truncate block">
                  {driveConfig.fileId}
                </code>
              </div>
              <button
                type="button"
                onClick={handleCopyFileId}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 hover:border-rose-400 cursor-pointer shrink-0"
              >
                {copiedFileId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedFileId ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {hasUnsyncedChanges && (
            <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
              • Local edits are safely saved on this device and waiting for next Drive sync.
            </p>
          )}

          {syncError && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
              {syncError}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {!isDriveConnected ? (
            <button
              type="button"
              disabled={syncStatus === 'connecting' || syncStatus === 'syncing'}
              onClick={() => void connectGoogleDrive(syncStatus === 'token_expired' ? '' : 'consent')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              {syncStatus === 'token_expired' ? 'Reconnect Google Drive' : 'Sign in with Google & Sync'}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={syncStatus === 'syncing'}
                onClick={() => void syncNow()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                Sync Now
              </button>
              <button
                type="button"
                onClick={() => void connectGoogleDrive('select_account')}
                className="px-3.5 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
              >
                Switch Account
              </button>
              <button
                type="button"
                onClick={disconnectGoogleDrive}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                Disconnect
              </button>
            </>
          )}
        </div>

        {/* Client ID & File Name */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Google OAuth Web Client ID
            </label>
            <input
              type="text"
              value={driveConfig.clientId}
              onChange={(e) => updateDriveConfig({ clientId: e.target.value.trim() })}
              placeholder="1234567890-abc123def.apps.googleusercontent.com"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              You can safely reuse the exact same Web Client ID and shared household Gmail from{' '}
              <strong>BookLibrary</strong> — MovieLibrary stores its own{' '}
              <code>movielibrary-db.json</code> file separately.
            </p>
            {invalidClientIdFormat && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                Client ID should end with <code>.apps.googleusercontent.com</code> (do not paste the
                Client Secret).
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                Drive File Name
              </label>
              <input
                type="text"
                value={driveConfig.fileName}
                onChange={(e) => updateDriveConfig({ fileName: e.target.value })}
                placeholder="movielibrary-db.json"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                Shared File ID (Optional)
              </label>
              <input
                type="text"
                value={driveConfig.fileId || ''}
                onChange={(e) => updateDriveConfig({ fileId: e.target.value.trim() || null })}
                placeholder="Auto-detected on sync"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-200 bg-stone-50/70 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
          >
            <span>Google Auth Platform — Setup &amp; Reusing BookLibrary Client ID ($0)</span>
            {guideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {guideOpen && (
            <div className="p-4 text-xs text-stone-600 dark:text-stone-300 space-y-3 bg-white dark:bg-[#171A23]">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-rose-900 dark:text-rose-200">
                    Your current origin (authorized in Google Cloud):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrigin}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border border-rose-500/30 text-[11px] font-semibold text-stone-800 dark:text-stone-100 cursor-pointer shrink-0"
                  >
                    {copiedOrigin ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedOrigin ? 'Copied' : 'Copy Origin'}
                  </button>
                </div>
                <code className="block font-mono text-[11px] text-rose-900 dark:text-rose-300 break-all">
                  {origin}
                </code>
                <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
                  Because GitHub Pages shares <code>https://&lt;username&gt;.github.io</code> as the
                  origin, your existing BookLibrary Client ID works automatically once you set{' '}
                  <code>VITE_GOOGLE_CLIENT_ID</code> in this repo&rsquo;s GitHub Actions Variables.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
