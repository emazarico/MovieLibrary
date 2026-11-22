import { useCallback, useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ToastContainer } from './components/common/ToastContainer';
import { Header } from './components/layout/Header';
import { LibraryView } from './components/library/LibraryView';
import { MovieFormModal } from './components/library/MovieFormModal';
import { PdfExportModal } from './components/management/PdfExportModal';
import { PrintReportView } from './components/management/PrintReportView';
import { ShelvesDataView } from './components/management/ShelvesDataView';
import { ProfileGate } from './components/profiles/ProfileGate';
import { SearchView } from './components/search/SearchView';
import { LogWatchModal } from './components/timeline/LogWatchModal';
import { TimelineView } from './components/timeline/TimelineView';
import { useLibrary } from './store/LibraryContext';
import type { AppTab, CatalogSearchResult, MovieItem } from './types/movie';
import type { PdfReportOptions } from './utils/pdfReport';

export function App() {
  const {
    activeProfile,
    legacyCinemaTrackRaw,
    dismissLegacyCinemaTrackBanner,
  } = useLibrary();

  const [activeTab, setActiveTab] = useState<AppTab>('library');
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);

  // Add / Edit Movie Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);
  const [prefillCatalog, setPrefillCatalog] = useState<CatalogSearchResult | null>(null);

  // Log Watch Modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logMovieId, setLogMovieId] = useState<string | undefined>(undefined);
  const [logMarkWatched, setLogMarkWatched] = useState(false);

  // PDF Export & Browser Print State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PdfReportOptions | null>(null);

  const openForm = useCallback(
    (movie: MovieItem | null = null, prefill: CatalogSearchResult | null = null) => {
      setEditingMovie(movie);
      setPrefillCatalog(prefill);
      setFormOpen(true);
    },
    [],
  );

  const openQuickLog = useCallback((movie?: MovieItem, markWatched = false) => {
    setLogMovieId(movie?.id);
    setLogMarkWatched(markWatched);
    setLogModalOpen(true);
  }, []);

  const handleTriggerPrint = useCallback((options: PdfReportOptions) => {
    setPdfModalOpen(false);
    setPrintOptions(options);
  }, []);

  useEffect(() => {
    if (!printOptions) return;
    const handleAfterPrint = () => {
      setPrintOptions(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    const printTimer = window.setTimeout(() => {
      window.print();
    }, 350);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      window.clearTimeout(printTimer);
    };
  }, [printOptions]);

  return (
    <>
      <div
        className={`min-h-[100dvh] bg-[#FAF8F5] dark:bg-[#0F1117] text-stone-900 dark:text-stone-100 transition-colors ${
          printOptions ? 'print:hidden' : ''
        }`}
      >
        {!activeProfile ? (
          <ProfileGate />
        ) : (
          <div className="min-h-[100dvh] flex flex-col">
            <Header activeTab={activeTab} onSelectTab={setActiveTab} />

            {legacyCinemaTrackRaw && (
              <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/12 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    Legacy <code>cinemaHistory</code> data detected in this browser. You can import your earlier JSON/CSV export in <strong>Lists &amp; Data</strong>.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('management');
                        dismissLegacyCinemaTrackBanner();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold"
                    >
                      Go to Import
                    </button>
                    <button
                      type="button"
                      onClick={dismissLegacyCinemaTrackBanner}
                      className="p-1 rounded-lg hover:bg-amber-500/20"
                      aria-label="Dismiss banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))]">
              {activeTab === 'library' && (
                <LibraryView
                  selectedMovieId={selectedMovieId}
                  onSelectMovie={(m) => setSelectedMovieId(m ? m.id : null)}
                  onQuickLog={(m, mark) => openQuickLog(m, mark)}
                  onOpenForm={(m) => openForm(m ?? null, null)}
                  onOpenSearch={() => setActiveTab('search')}
                  onOpenPdfExport={() => setPdfModalOpen(true)}
                />
              )}

              {activeTab === 'search' && (
                <SearchView
                  onOpenManualForm={(prefill) => openForm(null, prefill ?? null)}
                  onSelectMovieId={(id) => {
                    setSelectedMovieId(id);
                    setActiveTab('library');
                  }}
                />
              )}

              {activeTab === 'timeline' && (
                <TimelineView
                  onSelectMovie={(m) => {
                    setSelectedMovieId(m.id);
                    setActiveTab('library');
                  }}
                  onQuickLog={(m, mark) => openQuickLog(m, mark)}
                  onOpenPdfExport={() => setPdfModalOpen(true)}
                />
              )}

              {activeTab === 'management' && (
                <ShelvesDataView onOpenPdfExport={() => setPdfModalOpen(true)} />
              )}
            </main>
          </div>
        )}

        <MovieFormModal
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingMovie(null);
            setPrefillCatalog(null);
          }}
          editingMovie={editingMovie}
          prefillCatalog={prefillCatalog}
        />

        <LogWatchModal
          open={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          initialMovieId={logMovieId}
          defaultMarkWatched={logMarkWatched}
        />

        <PdfExportModal
          open={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          onTriggerPrint={handleTriggerPrint}
        />

        <ToastContainer />
      </div>

      {printOptions && (
        <div className="hidden print:block">
          <PrintReportView options={printOptions} />
        </div>
      )}
    </>
  );
}

export default App;
