import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, KeyRound, Loader2, Sparkles, Tv, XCircle } from 'lucide-react';
import { hasTmdbCredentials } from '../../services/apiConfig';
import { testTmdbConnection } from '../../services/tmdb';
import { useLibrary } from '../../store/LibraryContext';
import { POPULAR_STREAMING_SERVICES, STREAMING_REGIONS } from '../../utils/themes';
import { Modal } from '../common/Modal';

interface ApiSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ open, onClose }) => {
  const {
    apiConfig,
    updateApiConfig,
    householdSettings,
    updateHouseholdSettings,
    addToast,
  } = useLibrary();

  const [tmdbToken, setTmdbToken] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [omdbKey, setOmdbKey] = useState('');
  const [region, setRegion] = useState('US');
  const [services, setServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState('');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setTmdbToken(apiConfig.tmdbReadToken);
    setTmdbKey(apiConfig.tmdbApiKey);
    setOmdbKey(apiConfig.omdbApiKey);
    setRegion(householdSettings.streamingRegion || 'US');
    setServices(householdSettings.subscribedServices || []);
    setTestResult(null);
  }, [open, apiConfig, householdSettings]);

  const toggleService = (name: string) => {
    setServices((prev) =>
      prev.some((s) => s.toLowerCase() === name.toLowerCase())
        ? prev.filter((s) => s.toLowerCase() !== name.toLowerCase())
        : [...prev, name],
    );
  };

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customService.trim();
    if (!clean) return;
    if (!services.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setServices((prev) => [...prev, clean]);
    }
    setCustomService('');
  };

  const handleTestTmdb = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testTmdbConnection({
      tmdbReadToken: tmdbToken,
      tmdbApiKey: tmdbKey,
      omdbApiKey: omdbKey,
    });
    setTesting(false);
    setTestResult(res);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateApiConfig({
      tmdbReadToken: tmdbToken.trim(),
      tmdbApiKey: tmdbKey.trim(),
      omdbApiKey: omdbKey.trim(),
    });
    updateHouseholdSettings({
      streamingRegion: region,
      subscribedServices: services,
    });
    addToast({ title: 'API & Streaming preferences saved', tone: 'success' });
    onClose();
  };

  const configured = hasTmdbCredentials({
    tmdbReadToken: tmdbToken,
    tmdbApiKey: tmdbKey,
    omdbApiKey: omdbKey,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Movie APIs & Streaming Region"
      subtitle="Connect free TMDB & OMDb keys for posters, cast, Rotten Tomatoes/IMDb scores, and JustWatch streaming providers."
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSave} className="p-5 space-y-5">
        {/* Household Streaming Region & Services */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5" /> Household Streaming Region &amp; Subscriptions
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Synced across family members via Google Drive. Subscribed services are highlighted on
            every movie card and filterable in your library.
          </p>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Country / Region (for JustWatch Streaming Data)
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-sm font-medium text-stone-900 dark:text-stone-100 outline-none"
            >
              {STREAMING_REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
              Your Household Subscriptions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_STREAMING_SERVICES.map((svc) => {
                const active = services.some((s) => s.toLowerCase() === svc.toLowerCase());
                return (
                  <button
                    key={svc}
                    type="button"
                    onClick={() => toggleService(svc)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-rose-400'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {svc}
                  </button>
                );
              })}
              {services
                .filter(
                  (s) =>
                    !POPULAR_STREAMING_SERVICES.some(
                      (p) => p.toLowerCase() === s.toLowerCase(),
                    ),
                )
                .map((custom) => (
                  <button
                    key={custom}
                    type="button"
                    onClick={() => toggleService(custom)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border bg-emerald-600 text-white border-emerald-600 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> {custom} ×
                  </button>
                ))}
            </div>

            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomService(e);
                  }
                }}
                placeholder="Add another service (e.g. Shudder, Criterion)…"
                className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={handleAddCustomService}
                className="px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-200 cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* TMDB API Section */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-rose-600" /> TMDB v3 Credentials (Recommended)
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              Free @ themoviedb.org
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Powers Movies &amp; TV Series search, Trending/Discover, trailers, and{' '}
            <strong>Where to Watch streaming availability</strong>. Without keys, MovieLibrary still
            searches Apple iTunes &amp; TVMaze automatically.
          </p>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              TMDB API Read Access Token (Bearer JWT)
            </label>
            <input
              type="password"
              value={tmdbToken}
              onChange={(e) => setTmdbToken(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiJ9..."
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
              Or TMDB v3 API Key (Optional if Token above is set)
            </label>
            <input
              type="password"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              placeholder="32-character TMDB API key"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!configured || testing}
              onClick={() => void handleTestTmdb()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-rose-400 text-xs font-semibold text-stone-700 dark:text-stone-200 disabled:opacity-45 cursor-pointer"
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              )}
              Test TMDB Connection
            </button>
            {testResult && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  testResult.ok
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Optional OMDb API Key */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
            Optional OMDb API Key (for IMDb / Rotten Tomatoes / Metascore badges)
          </label>
          <input
            type="password"
            value={omdbKey}
            onChange={(e) => setOmdbKey(e.target.value)}
            placeholder="Free key from omdbapi.com (1,000 req/day)"
            className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-mono text-stone-900 dark:text-stone-100 outline-none focus:ring-2 focus:ring-rose-500"
          />
          <p className="text-[11px] text-stone-400 mt-1">
            API keys stay in this browser&rsquo;s local storage (or optional GitHub Actions{' '}
            <code>VITE_TMDB_READ_TOKEN</code> / <code>VITE_OMDB_API_KEY</code> build variables) and
            are never stored inside synced Google Drive files.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </Modal>
  );
};
