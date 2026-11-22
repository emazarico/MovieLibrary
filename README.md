# MovieLibrary

A warm, tactile, local-first household movie & TV series tracker built with React, TypeScript, Tailwind CSS v4, and Vite. Inspired by editorial film journals, **MovieLibrary** lets families track movies and TV shows together, check where titles are streaming, co-watch across household profiles without overwriting each other's ratings, and sync privately via Google Drive.

---

## Features

- **Household Profiles & Parental Controls**
  - Independent profiles for everyone in the household (`Parent / Admin` and `Viewer` roles) with customizable avatars, yearly watch goals, and monthly hour targets.
  - Optional 4–6 digit PIN locks hashed locally with per-profile salted SHA-256 (`movielibrary-v1:` prefix) plus Parent/Admin PIN recovery.
- **Movies & TV Series Tracking**
  - Track feature films (runtime, release year, MPAA rating, director, cast, franchise order) and TV series (seasons, total episodes, current season/episode counter with quick `+1 Episode` logging).
  - Status queues (`Want to Watch`, `Watching`, `Watched`, `Dropped`), 3D tactile poster cards with blurred poster aura, rewatch cycle history, and physical 4K/Blu-ray/DVD lending tracker.
- **Family Co-Watching & Watchlists**
  - Check off which family members (and guests) watched a movie or episode with you when logging or adding a title—automatically syncing linked `WatchLog`s (`watchGroupId`) and adding the entry to their libraries without overwriting their personal star ratings or reviews.
  - Retroactively add family members to an existing watch anytime from the detail drawer.
  - **Family Watchlist & Movie Night Spinner**: browse everyone's queued picks filtered by your active streaming subscriptions and spin for a random family movie night winner.
- **Catalog Search & Live Streaming Availability**
  - **TMDB v3 Primary**: search movies/TV or IMDb `tt...` IDs, browse Trending/Popular/Top-Rated/Now Playing strips, and fetch regional JustWatch streaming/free/rent/buy providers (`US`, `CA`, `GB`, etc.). Highlights matches against your household's subscribed services (`Netflix`, `Disney+`, `Max`, `Apple TV+`, etc.).
  - **Optional OMDb Enrichment**: adds IMDb scores, Rotten Tomatoes Tomatometer, Metascore, and Awards citations.
  - **Zero-Key Fallback**: searches **Apple iTunes Search API** (movies) and **TVMaze API** (TV series) out of the box even before configuring any API keys.
- **Watch Timeline, Heatmaps & Milestones**
  - Interactive monthly hours/titles bar chart, daily watch heatmap streak tracker, watch medium donut (`Streaming`, `Theater`, `Disc`, `TV`), top genres/tags, rating distribution, and 9 unlockable Cinema Milestones with custom parent rewards.
- **Import, Export & Print/PDF Reports**
  - Import/export MovieLibrary JSON backups, Letterboxd CSV (`watched.csv` / `ratings.csv` / `watchlist.csv`), IMDb CSV ratings exports, CinemaTrack CSV/JSON (`cinemaHistory`), and OmniLibrary v3 movie JSON.
  - Styled print/PDF report generator in-app (`5` layouts, `3` themes) plus standalone Node CLI (`npm run pdf:cli`).
- **Offline-First Storage & Google Drive Sync**
  - Primary persistence in browser IndexedDB (`movielibrary_storage_v1`) with `localStorage` fallback and compressed local WebP custom poster uploads (`movielibrary_posters_v1`).
  - Optional Google Drive AppData/File sync (`movielibrary-db.json`) with Last-Write-Wins per-record merging across devices.

---

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm test            # Run Vitest unit & integration suite
npm run build       # TypeScript type-check (tsc -b) + production Vite bundle
npm run pdf:cli     # Standalone CLI HTML/PDF report renderer
```

---

## API & Streaming Setup

MovieLibrary works immediately in **Zero-Key Mode** using Apple iTunes + TVMaze search and full manual entry. To unlock rich metadata and live streaming availability:

1. **TMDB Read Access Token (free)**: Create a free developer API Read Access Token (v4 auth bearer used against TMDB v3 API) at `themoviedb.org/settings/api`.
2. **OMDb API Key (optional, free tier)**: Request a key at `omdbapi.com` for IMDb, Rotten Tomatoes, and Metascore badges.
3. Configure inside the app via **Discover & Add -> API & Streaming** (stored locally per browser), or bake defaults into your GitHub Pages build via GitHub Actions repository variables/secrets:
   - `VITE_TMDB_READ_TOKEN`
   - `VITE_TMDB_API_KEY` (optional v3 key alternative)
   - `VITE_OMDB_API_KEY` (optional)

> Do not commit live API keys or private credentials into the repository.

---

## Google Drive Cloud Sync Setup (Shared Family Account Friendly)

MovieLibrary uses client-side Google Identity Services (GIS) OAuth 2.0 with scopes:

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/userinfo.email`

If you already set up a Google Cloud Web OAuth Client ID for **BookLibrary** on your shared family Gmail account, you can **reuse the exact same OAuth Client ID**!
- Because `BookLibrary` writes `booklibrary-db.json` and `MovieLibrary` writes `movielibrary-db.json`, they never overwrite or conflict with each other in the same Google Drive account.
- Just add your GitHub Pages origin (e.g. `https://<username>.github.io`) and `http://localhost:5173` under **Authorized JavaScript origins** in Google Cloud Console (`APIs & Services -> Credentials`).
- If your OAuth consent screen is in **Testing** mode, make sure any family Google accounts signing in are listed under **Test users**.
- Supply the Web Client ID either via `VITE_GOOGLE_CLIENT_ID` at build time or paste it directly into **Lists & Data -> Google Drive Sync** inside the app.

---

## Deploying to GitHub Pages

A GitHub Actions workflow is included at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

1. Push this repository to GitHub (`main` branch).
2. In your GitHub repository **Settings -> Pages**, set **Source** to **GitHub Actions**.
3. Optionally configure repository Variables/Secrets in **Settings -> Secrets and variables -> Actions**:
   - `VITE_GOOGLE_CLIENT_ID` (Variable or Secret)
   - `VITE_TMDB_READ_TOKEN` (Secret)
   - `VITE_TMDB_API_KEY` (Secret, optional)
   - `VITE_OMDB_API_KEY` (Secret, optional)
4. Every push to `main` runs `npm ci`, `npm test`, `npm run build` with `VITE_BASE_PATH="./"`, and deploys `dist/` to GitHub Pages.

---

## CLI Report Generator

Export a MovieLibrary JSON backup from **Lists & Data** and render a standalone HTML or PDF report from the terminal:

```bash
npm run pdf:cli -- --input movielibrary-backup.json --output report.html --html-only
```

See all flags:

```bash
npm run pdf:cli -- --help
```
