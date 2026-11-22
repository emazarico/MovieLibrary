import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clapperboard,
  Cloud,
  CloudOff,
  Film,
  FolderCog,
  Moon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';
import type { AppTab } from '../../types/movie';
import { CloudSyncModal } from '../management/CloudSyncModal';
import { ProfileSwitcher } from '../profiles/ProfileSwitcher';
import { ApiSettingsModal } from '../search/ApiSettingsModal';
import { MobileNav } from './MobileNav';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const TABS: Array<{
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'library', label: 'My Library', shortLabel: 'Library', icon: Film },
  { id: 'search', label: 'Discover & Add', shortLabel: 'Add', icon: Search },
  { id: 'timeline', label: 'Watch Timeline', shortLabel: 'Timeline', icon: CalendarClock },
  { id: 'management', label: 'Lists & Data', shortLabel: 'Data', icon: FolderCog },
];

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  const { theme, toggleTheme, syncStatus, hasUnsyncedChanges } = useLibrary();
  const [cloudOpen, setCloudOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);

  const renderSyncPill = () => {
    if (syncStatus === 'syncing' || syncStatus === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="hidden lg:inline">Syncing</span>
        </span>
      );
    }
    if (syncStatus === 'synced') {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="hidden lg:inline">Synced</span>
        </span>
      );
    }
    if (syncStatus === 'token_expired' || syncStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">
            {syncStatus === 'token_expired' ? 'Reconnect' : 'Sync Error'}
          </span>
        </span>
      );
    }
    if (syncStatus === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-stone-500">
          <CloudOff className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Offline</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
        <Cloud className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        <span className="hidden lg:inline">{hasUnsyncedChanges ? 'Local' : 'Sync'}</span>
      </span>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] backdrop-blur-md bg-[#FAF8F5]/90 dark:bg-[#0F1117]/90 border-b border-stone-200/80 dark:border-stone-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('library')}
            className="flex items-center gap-2 cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-500 text-white flex items-center justify-center shadow-sm shadow-rose-600/25">
              <Clapperboard className="w-5 h-5" />
            </div>
            <span className="font-serif-display text-lg lg:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              MovieLibrary
            </span>
          </button>

          {/* Desktop / Tablet Navigation */}
          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-stone-200/60 dark:bg-stone-800/70 p-1 rounded-full min-w-0"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-[#1A1D27] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-rose-600 dark:text-rose-400' : ''
                    }`}
                  />
                  <span className="lg:hidden">{tab.shortLabel}</span>
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setApiOpen(true)}
              title="API & Streaming Region Settings"
              aria-label="API and Streaming Settings"
              className="p-2 rounded-full bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-rose-400 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCloudOpen(true)}
              title="Google Drive Sync"
              className="px-2.5 py-1.5 rounded-full bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700 text-xs font-semibold hover:border-rose-400 transition-colors cursor-pointer"
            >
              {renderSyncPill()}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-full bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <ProfileSwitcher />
          </div>
        </div>

        {/* Mobile Tab Strip kept in active top area above Safari bottom toolbar */}
        <MobileNav activeTab={activeTab} onSelectTab={onSelectTab} />
      </header>

      <CloudSyncModal open={cloudOpen} onClose={() => setCloudOpen(false)} />
      <ApiSettingsModal open={apiOpen} onClose={() => setApiOpen(false)} />
    </>
  );
};
