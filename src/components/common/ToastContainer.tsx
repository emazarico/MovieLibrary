import React from 'react';
import { AlertCircle, CheckCircle2, Info, RotateCcw, X } from 'lucide-react';
import { useLibrary } from '../../store/LibraryContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useLibrary();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-5 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-80 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.tone === 'error'
            ? AlertCircle
            : toast.tone === 'success'
              ? CheckCircle2
              : Info;
        const iconColor =
          toast.tone === 'error'
            ? 'text-rose-500'
            : toast.tone === 'success'
              ? 'text-emerald-500'
              : 'text-amber-500';

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white/95 dark:bg-[#1E222E]/95 backdrop-blur-md border border-stone-200 dark:border-stone-700/80 shadow-xl animate-fade-slide"
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-snug">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                  {toast.description}
                </p>
              )}
            </div>
            {toast.undoAction && (
              <button
                type="button"
                onClick={() => {
                  toast.undoAction?.();
                  dismissToast(toast.id);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-rose-500/25 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" /> Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
