# MovieLibrary Engineering Handoff

## Project Summary
- **Location**: `/Users/emazaric/Documents/AI_projects/LibraryTracker/MovieLibrary`
- **Stack**: React 19, TypeScript 5.7 (strict), Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Lucide React, Vitest 3.
- **Visual System**: Warm editorial light/dark surfaces (`#FAF8F5` light, `#0F1117` dark), `Fraunces` display headings + `Plus Jakarta Sans` UI copy, Cinema Crimson (`rose-600`) & Marquee Gold (`amber-400`/`amber-500`) accents, 3D perspective poster stages (`.movie-poster-stage` / `.movie-poster-3d`).
- **Related Repos (Do Not Modify)**:
  - `../BookLibrary` — sibling Book tracker app with identical storage/sync philosophy.
  - `../../MovieTracker` — legacy single-file HTML prototype (`cinemaHistory` localStorage key / CSV format).

---

## Directory Structure

```text
.
├── .github/workflows/deploy-pages.yml   # CI test + build + GitHub Pages deploy
├── public/
│   ├── icon.svg
│   ├── manifest.webmanifest
│   └── sw.js                            # movielibrary-shell-v1 cache (skips cross-origin)
├── scripts/
│   └── render-pdf.mjs                   # Standalone Node CLI HTML/PDF renderer
└── src/
    ├── __tests__/                       # 15 Vitest unit & integration test suites (38 tests)
    ├── components/
    │   ├── common/                      # Modal, MoviePoster, StarRating, StreamingBadges, ToastContainer
    │   ├── layout/                      # Header, MobileNav
    │   ├── library/                     # LibraryView, MovieCard, MovieListRow, MovieDetailDrawer, MovieFormModal, FamilyWatchlistModal
    │   ├── management/                  # CloudSyncModal, ImportPreviewModal, PdfExportModal, PrintReportView, ShelvesDataView
    │   ├── profiles/                    # ProfileGate, ProfileSwitcher, ProfileFormModal, PinModal, HouseholdAdminModal
    │   ├── search/                      # SearchView, ApiSettingsModal
    │   └── timeline/                    # TimelineView, MonthlyChart, WatchHeatmap, BreakdownCharts, LogWatchModal
    ├── services/
    │   ├── apiConfig.ts                 # Build env + localStorage API key management
    │   ├── fallbackCatalog.ts           # Search orchestrator + Apple iTunes + TVMaze fallbacks
    │   ├── googleDriveSync.ts           # GIS OAuth + Drive REST v3 LWW sync (movielibrary-db.json)
    │   ├── idbStorage.ts                # IndexedDB primary database (movielibrary_storage_v1)
    │   ├── importExport.ts              # Multi-format importer/exporter
    │   ├── omdb.ts                      # Optional OMDb IMDb/RT/Metascore enrichment
    │   ├── posterStore.ts               # IndexedDB custom WebP poster store (movielibrary_posters_v1)
    │   ├── storage.ts                   # localStorage mirror, token cache, theme, session, legacy detection
    │   └── tmdb.ts                      # TMDB v3 search, details, discover & JustWatch watch providers
    ├── store/
    │   └── LibraryContext.tsx           # App state provider & household/co-watch actions
    ├── types/
    │   └── movie.ts                     # Canonical MovieLibrary schema (schemaVersion: 1)
    └── utils/                           # Pure helpers (admin, analytics, badges, cowatch, crypto, csv, demoData, duplicates, merge, pdfReport, poster, progress, stats, themes)
```

---

## Critical Architectural Invariants

1. **Zero Storage / Drive Collisions with BookLibrary**:
   - All `localStorage` / `sessionStorage` keys use the `movielibrary_` prefix (`movielibrary_db`, `movielibrary_drive_config`, `movielibrary_drive_token`, `movielibrary_api_config`, `movielibrary_theme`, `movielibrary_active_profile`, `movielibrary_active_profile_session`).
   - IndexedDB stores use `movielibrary_storage_v1` and `movielibrary_posters_v1`.
   - Google Drive sync filename defaults to `movielibrary-db.json` (while BookLibrary uses `booklibrary-db.json`), allowing the exact same Google OAuth Client ID and shared family Gmail Drive account to host both apps safely.
   - SHA-256 PIN hashing uses `"movielibrary-v1:" + profileId + ":" + pin` domain separation.

2. **Google Drive OAuth Scope & GIS Reconnect Contract**:
   - `requestDriveAccessToken()` in `src/services/googleDriveSync.ts` MUST request both `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/userinfo.email` so `fetchUserEmail()` succeeds cleanly and falls back to Drive `/drive/v3/about?fields=user(emailAddress)`.
   - GIS access tokens (~1h TTL) are cached under `movielibrary_drive_token` (`localStorage`, not `sessionStorage`, for iOS Safari PWA persistence) with a 60s expiry buffer (`DRIVE_TOKEN_EXPIRY_BUFFER_MS`) and strict `clientId` matching.
   - Returning devices pass `prompt: ''` + `hint: userEmail` (`hint` omitted on `'select_account'`), while startup auto-sync waits on `idbHydrated` so background sync never races IndexedDB hydration.
   - Never hardcode Google OAuth Client IDs, TMDB tokens, or OMDb keys in tracked source files. Read defaults from `import.meta.env.VITE_*` or user settings.

3. **Non-Destructive Family Co-Watching (`src/utils/cowatch.ts`)**:
   - `applyWatchEventToDatabase` and `addCoWatchersToExistingWatch` propagate watches, episodes, and linked `watchGroupId` logs across selected profiles, creating the movie on a co-watcher's shelf if missing (`rating: 0`, stripped of `'watchlist'`/`'wishlist'` tags), and **never overwrite** an existing co-watcher's personal `rating` or `review`.

4. **Custom Poster URLs & Print Filtering**:
   - Uploaded custom posters are compressed to WebP and saved in IndexedDB with `idb-poster:...` keys (`src/services/posterStore.ts`).
   - `MovieFormModal` MUST keep the Poster URL field as `type="text"` (never `type="url"`), otherwise browsers reject `idb-poster:...` on submit.
   - Standalone HTML export (`buildStandaloneReportHtml` in `src/utils/pdfReport.ts` and `scripts/render-pdf.mjs`) skips `idb-poster:` URLs so standalone files have no broken local scheme URLs.

5. **iPhone / Mobile Safari Ergonomics & Print Safety**:
   - Mobile navigation (`MobileNav`) lives inside the sticky top `<header>`—never `fixed bottom-0` where iOS Safari home indicator / toolbar intercepts taps.
   - Root layout and scrollable modals/drawers include `min-h-[100dvh]` and `env(safe-area-inset-bottom)` clearance.
   - Browser print hides `.print:hidden` and reveals `PrintReportView` only during active `printOptions` (`afterprint` listener resets state cleanly).

6. **Last-Write-Wins Merge (`src/utils/merge.ts`)**:
   - Synced records (`profiles`, `shelves`, `movies`, `watchLogs`) merge by `id` using `updatedAt` timestamps and soft-delete tombstones (`deletedAt`).
   - `householdSettings` (`streamingRegion` and `subscribedServices`) merges independently via `householdSettings.updatedAt`.
   - Client-only API keys (`apiConfig`) are intentionally excluded from `MovieLibraryDatabase` and Google Drive JSON sync for privacy.

---

## Verification Status (`v0.1.0`)

- **TypeScript + Production Vite Build**: Verified via `npm run build` (`tsc -b && vite build`).
- **Vitest Automated Tests**: Verified via `npm test` (15 test files, 38 tests covering admin, analytics, badges, cowatch, crypto, csv, duplicates, googleDriveSync, idbStorage, importExport, merge, pdfReport, progress, stats, and tmdb).
- **CLI Renderer**: Verified via `npm run pdf:cli -- --help`.
