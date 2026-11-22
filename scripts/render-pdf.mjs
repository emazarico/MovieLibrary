#!/usr/bin/env node
/**
 * Standalone MovieLibrary CLI Report & PDF Renderer.
 * Converts a MovieLibrary Household/Profile JSON export into a styled standalone HTML or PDF report.
 * Zero TypeScript/bundler runtime dependencies; optional Playwright usage for headless PDF output.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const opts = {
    input: '',
    output: 'movielibrary-report.pdf',
    profile: '',
    from: '',
    to: '',
    status: 'watched,watching,want-to-watch,dropped',
    mediaType: 'all',
    tag: '',
    layout: 'cards',
    theme: 'classic',
    orientation: 'portrait',
    title: '',
    summary: true,
    timeline: true,
    notes: true,
    watchLogs: false,
    htmlOnly: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i] || '';
    switch (arg) {
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-i':
      case '--input':
        opts.input = next();
        break;
      case '-o':
      case '--output':
        opts.output = next();
        break;
      case '--profile':
        opts.profile = next();
        break;
      case '--from':
        opts.from = next();
        break;
      case '--to':
        opts.to = next();
        break;
      case '--status':
        opts.status = next();
        break;
      case '--media-type':
        opts.mediaType = next();
        break;
      case '--tag':
        opts.tag = next();
        break;
      case '--layout':
        opts.layout = next();
        break;
      case '--theme':
        opts.theme = next();
        break;
      case '--orientation':
        opts.orientation = next();
        break;
      case '--title':
        opts.title = next();
        break;
      case '--no-summary':
        opts.summary = false;
        break;
      case '--no-timeline':
        opts.timeline = false;
        break;
      case '--no-notes':
        opts.notes = false;
        break;
      case '--watch-logs':
        opts.watchLogs = true;
        break;
      case '--html-only':
        opts.htmlOnly = true;
        break;
      default:
        break;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`MovieLibrary CLI Report & PDF Generator

Usage:
  node scripts/render-pdf.mjs --input <backup.json> [options]

Options:
  -i, --input <path>        Path to MovieLibrary JSON export (required)
  -o, --output <path>       Output PDF or HTML path (default: movielibrary-report.pdf)
      --profile <id|name>   Filter to a specific viewer profile (comma-separated)
      --from <YYYY-MM-DD>   Start date filter
      --to <YYYY-MM-DD>     End date filter
      --status <list>       Statuses (default: watched,watching,want-to-watch,dropped)
      --media-type <type>   all | movie | series (default: all)
      --tag <tag>           Filter by tag
      --layout <layout>     cards | table | shelf | timeline (default: cards)
      --theme <theme>       classic | modern | minimal (default: classic)
      --orientation <dir>   portrait | landscape (default: portrait)
      --title <text>        Custom report title
      --no-summary          Omit KPI summary section
      --no-timeline         Omit monthly watch timeline
      --no-notes            Omit personal reviews & notes
      --watch-logs          Include detailed watch log table
      --html-only           Write standalone HTML instead of invoking Playwright PDF
  -h, --help                Show this help message
`);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRuntime(minsInput) {
  const mins = Math.max(0, Math.round(Number(minsInput) || 0));
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function normalizeDb(raw) {
  if (raw && raw.kind === 'movielibrary-profile-v1') {
    return {
      profiles: raw.profile ? [raw.profile] : [],
      movies: Array.isArray(raw.movies) ? raw.movies : [],
      watchLogs: Array.isArray(raw.watchLogs) ? raw.watchLogs : [],
    };
  }
  return {
    profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
    movies: Array.isArray(raw.movies) ? raw.movies : [],
    watchLogs: Array.isArray(raw.watchLogs) ? raw.watchLogs : [],
  };
}

function buildHtml(db, opts) {
  const activeProfiles = db.profiles.filter((p) => !p.deletedAt);
  const wantedProfileTokens = opts.profile
    ? opts.profile.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const selectedProfiles = wantedProfileTokens.length
    ? activeProfiles.filter(
        (p) =>
          wantedProfileTokens.includes(p.id.toLowerCase()) ||
          wantedProfileTokens.includes(p.name.toLowerCase()),
      )
    : activeProfiles;
  const profileSet = new Set(selectedProfiles.map((p) => p.id));
  const statusSet = new Set(
    opts.status.split(',').map((s) => s.trim()).filter(Boolean),
  );

  const movies = db.movies
    .filter((m) => {
      if (m.deletedAt) return false;
      if (profileSet.size > 0 && !profileSet.has(m.profileId)) return false;
      if (statusSet.size > 0 && !statusSet.has(m.status)) return false;
      if (opts.mediaType !== 'all' && m.mediaType !== opts.mediaType) return false;
      if (
        opts.tag &&
        !(m.tags || []).some((t) => t.toLowerCase() === opts.tag.toLowerCase())
      ) {
        return false;
      }
      const dateRef = m.dateWatched || m.dateStarted || (m.addedAt || '').slice(0, 10);
      if (opts.from && dateRef && dateRef < opts.from) return false;
      if (opts.to && dateRef && dateRef > opts.to) return false;
      return true;
    })
    .sort((a, b) =>
      (b.dateWatched || b.updatedAt || '').localeCompare(a.dateWatched || a.updatedAt || ''),
    );

  const logs = db.watchLogs
    .filter((l) => {
      if (l.deletedAt) return false;
      if (profileSet.size > 0 && !profileSet.has(l.profileId)) return false;
      if (opts.from && l.date < opts.from) return false;
      if (opts.to && l.date > opts.to) return false;
      return true;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const watchedCount = movies.filter((m) => m.status === 'watched').length;
  const totalMinutes = logs.reduce((s, l) => s + Math.max(0, Number(l.minutesWatched) || 0), 0);
  const rated = movies.filter((m) => Number(m.rating) > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length).toFixed(2)
    : '—';

  const title =
    opts.title ||
    (selectedProfiles.length === 1
      ? `${selectedProfiles[0].name}'s Cinema Report`
      : 'MovieLibrary Cinema Report');

  const accent = opts.theme === 'modern' ? '#4338ca' : opts.theme === 'minimal' ? '#18181b' : '#be123c';
  const rowsHtml = movies
    .map((m) => {
      const poster =
        m.posterUrl && !String(m.posterUrl).startsWith('idb-poster:')
          ? `<img src="${escapeHtml(m.posterUrl)}" alt="" style="width:48px;height:72px;object-fit:cover;border-radius:6px;" />`
          : `<div style="width:48px;height:72px;border-radius:6px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;padding:4px;">${escapeHtml(m.title.slice(0, 12))}</div>`;
      return `<tr>
        <td>${poster}</td>
        <td><strong>${escapeHtml(m.title)}</strong>${m.releaseYear ? ` (${m.releaseYear})` : ''}<br/><small>${escapeHtml(m.director || '')}</small></td>
        <td>${escapeHtml(m.status)}</td>
        <td>${Number(m.rating) > 0 ? `${m.rating}/5 ★` : '—'}</td>
        <td>${escapeHtml(m.dateWatched || m.dateStarted || '—')}</td>
        <td>${formatRuntime(m.runtimeMinutes)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: ${opts.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 14mm; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1c1917; max-width: 960px; margin: 0 auto; padding: 24px; }
    h1 { color: ${accent}; margin-bottom: 4px; }
    .meta { color: #78716c; font-size: 13px; margin-bottom: 18px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
    .kpi { border: 1px solid #e7e5e4; border-radius: 10px; padding: 12px; }
    .kpi .val { font-size: 22px; font-weight: 700; color: ${accent}; }
    .kpi .lbl { font-size: 11px; text-transform: uppercase; color: #78716c; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e7e5e4; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; color: #78716c; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Viewers: ${escapeHtml(selectedProfiles.map((p) => p.name).join(', ') || 'Household')} · Generated ${new Date().toLocaleDateString()}</div>
  ${
    opts.summary
      ? `<div class="kpis">
          <div class="kpi"><div class="val">${movies.length}</div><div class="lbl">Titles</div></div>
          <div class="kpi"><div class="val">${watchedCount}</div><div class="lbl">Watched</div></div>
          <div class="kpi"><div class="val">${formatRuntime(totalMinutes)}</div><div class="lbl">Logged Time</div></div>
          <div class="kpi"><div class="val">${avgRating}</div><div class="lbl">Avg Rating</div></div>
        </div>`
      : ''
  }
  <table>
    <thead><tr><th>Poster</th><th>Title</th><th>Status</th><th>Rating</th><th>Date</th><th>Runtime</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.input) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  const rawText = await fs.readFile(path.resolve(opts.input), 'utf8');
  const db = normalizeDb(JSON.parse(rawText));
  const html = buildHtml(db, opts);
  const outPath = path.resolve(opts.output);

  if (opts.htmlOnly || outPath.endsWith('.html')) {
    await fs.writeFile(outPath, html, 'utf8');
    console.log(`Wrote HTML report to ${outPath}`);
    return;
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    const htmlFallback = outPath.replace(/\.pdf$/i, '') + '.html';
    await fs.writeFile(htmlFallback, html, 'utf8');
    console.error(
      `Playwright is not installed; wrote HTML report to ${htmlFallback} instead. Run with --html-only or install playwright to emit PDF.`,
    );
    process.exit(1);
  }

  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.pdf({
      path: outPath,
      format: 'Letter',
      landscape: opts.orientation === 'landscape',
      printBackground: true,
    });
    console.log(`Wrote PDF report to ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
