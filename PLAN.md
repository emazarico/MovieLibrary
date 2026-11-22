# MovieLibrary Roadmap & Plan

## Shipped (`v0.1.0`)

- **Core Household Architecture**: React 19 + TypeScript + Vite + Tailwind v4 editorial cinema aesthetic (`Fraunces` + `Plus Jakarta Sans`), light/dark themes, Cinema Crimson & Gold accent palette, 3D tilted poster cards, PWA manifest & service worker (`./sw.js`).
- **Multi-Profile & Security**: Parent/Admin and Viewer roles, salted SHA-256 PINs (`movielibrary-v1:`), Parent PIN reset/promotion controls, 3-profile demo household (`Alex`, `Maya`, `Sam`).
- **Family Co-Watching Engine**: Multi-member watch logging with bidirectional `watchGroupId` linking, auto-adding watched titles to co-watchers without overwriting personal ratings/reviews, retroactive co-watcher addition, Family Watchlist browser, and random Movie Night Spinner.
- **Catalog Search & Streaming Providers**: TMDB v3 primary catalog + Trending/Discover presets + JustWatch regional streaming/free/rent/buy snapshots matched against household subscribed services, optional OMDb IMDb/RT/Metascore enrichment, and zero-key Apple iTunes + TVMaze fallback.
- **Analytics & Reports**: Monthly hours/titles chart, daily watch heatmap streak tracker, watch medium/genre/rating breakdown analytics, 9 customizable Cinema Milestones, browser print view, standalone HTML/PDF export modal, and CLI script (`scripts/render-pdf.mjs`).
- **Persistence, Migration & Sync**: IndexedDB primary store (`movielibrary_storage_v1`) + WebP poster store (`movielibrary_posters_v1`), Google Drive LWW sync (`movielibrary-db.json`), and importers for Letterboxd CSV, IMDb CSV, CinemaTrack JSON/CSV, OmniLibrary v3 JSON, and MovieLibrary JSON.

---

## Upcoming Priorities

- **P1 — Season & Episode Checklist**: Expand TMDB TV detail fetch to cache season episode lists so series watchers can check off individual episodes or jump between seasons directly inside `MovieDetailDrawer`.
- **P2 — Automatic Background OAuth Silent Re-auth & Conflict Inspector**: Use GIS silent refresh hints before long sessions expire and show a visual diff preview if remote Drive sync changes exceed a threshold.
- **P3 — Playwright End-to-End Test Suite**: Add headless Chromium tests covering onboarding, PIN lock flows, co-watch syncing, offline reload persistence, and print/PDF rendering.
- **P4 — Bundle Optimization**: Code-split heavy modal views (`PdfExportModal`, `PrintReportView`, `ShelvesDataView`, `TimelineView`) via `React.lazy` to reduce initial JS chunk size below 500 kB.
- **P5 — Household Watchlist Voting & Shared Watch Parties**: Allow family members to upvote queued picks in `FamilyWatchlistModal` and schedule upcoming Friday Movie Night calendar reminders.
- **P6 — Extended Subtitles, Formats & Physical Shelf Location Tags**: Track 4K UHD Steelbook vs Blu-ray formats, audio/subtitle tracks, and living-room shelf bin locations for physical media collectors.
