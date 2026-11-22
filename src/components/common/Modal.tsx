import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 h-[100dvh] z-50 flex items-center justify-center px-3 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(4rem,calc(env(safe-area-inset-bottom)+3rem))] sm:py-6 overflow-y-auto bg-stone-950/65 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClass} my-auto max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 shadow-2xl overflow-hidden animate-fade-slide`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-stone-100 dark:border-stone-800/80 shrink-0">
            <div>
              {title && (
                <h2 className="font-serif-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain custom-scrollbar flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
