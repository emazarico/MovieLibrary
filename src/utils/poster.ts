export interface PosterStyle {
  bgFrom: string;
  bgTo: string;
  accent: string;
  ink: string;
  motif: 'curtain' | 'spotlight' | 'reel' | 'marquee';
}

const POSTER_PALETTES: Array<Omit<PosterStyle, 'motif'>> = [
  { bgFrom: '#4C0519', bgTo: '#1A040A', accent: '#FBBF24', ink: '#FFF1F2' }, // Cinema Velvet Crimson & Gold
  { bgFrom: '#1E1B4B', bgTo: '#090D16', accent: '#F59E0B', ink: '#EEF2FF' }, // Midnight IMAX & Amber
  { bgFrom: '#14532D', bgTo: '#052E16', accent: '#FDE68A', ink: '#ECFDF5' }, // Emerald Noir
  { bgFrom: '#7C2D12', bgTo: '#290E05', accent: '#FED7AA', ink: '#FFF7ED' }, // Technicolor Copper
  { bgFrom: '#581C87', bgTo: '#1E0836', accent: '#FDE047', ink: '#FAF5FF' }, // Marquee Violet
  { bgFrom: '#134E4A', bgTo: '#042F2E', accent: '#99F6E4', ink: '#F0FDFA' }, // Teal Matinee
  { bgFrom: '#7F1D1D', bgTo: '#2D0707', accent: '#FDE68A', ink: '#FEF2F2' }, // Scarlet Premiere
  { bgFrom: '#27272A', bgTo: '#09090B', accent: '#F43F5E', ink: '#FAFAFA' }, // Silver Screen Monochrome
];

const MOTIFS: PosterStyle['motif'][] = ['curtain', 'spotlight', 'reel', 'marquee'];

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Normalizes and validates poster/backdrop image URLs.
 * Supports IndexedDB poster keys (`idb-poster:...`), inline data URLs, upgrades HTTP for known API hosts,
 * and drops known dead placeholders or `'N/A'`.
 */
export function sanitizePosterUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed.toUpperCase() === 'N/A') return undefined;
  if (trimmed.includes('via.placeholder.com')) return undefined;
  if (trimmed.startsWith('idb-poster:') && trimmed.length > 'idb-poster:'.length) {
    return trimmed;
  }
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return undefined;
  }

  if (
    parsed.hostname === 'image.tmdb.org' ||
    parsed.hostname === 'm.media-amazon.com' ||
    parsed.hostname.endsWith('.mzstatic.com') ||
    parsed.hostname === 'static.tvmaze.com'
  ) {
    parsed.protocol = 'https:';
  }

  return parsed.toString();
}

export function buildTmdbImageUrl(
  path?: string | null,
  size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500',
): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const clean = path.trim();
  if (!clean) return undefined;
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return sanitizePosterUrl(clean);
  }
  const normalized = clean.startsWith('/') ? clean : `/${clean}`;
  return `https://image.tmdb.org/t/p/${size}${normalized}`;
}

export function getPosterStyle(title: string, director: string): PosterStyle {
  const h = hashString(`${title}::${director}`);
  const palette = POSTER_PALETTES[h % POSTER_PALETTES.length];
  const motif = MOTIFS[(h >>> 4) % MOTIFS.length];
  return { ...palette, motif };
}
