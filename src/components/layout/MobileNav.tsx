import React from 'react';
import type { AppTab } from '../../types/movie';
import { TABS } from './Header';

interface MobileNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden border-t border-stone-200/70 dark:border-stone-800/70 px-2 py-1.5"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-4 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100/80 dark:hover:bg-stone-800/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
