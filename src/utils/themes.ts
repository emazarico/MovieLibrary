import type {
  AvatarTheme,
  MediaType,
  MovieOwnership,
  WatchMedium,
  WatchStatus,
} from '../types/movie';

export const AVATAR_EMOJIS = [
  '🦉',
  '🦊',
  '🐻',
  '🐱',
  '🎬',
  '🍿',
  '🎭',
  '🚀',
  '🎞️',
  '✨',
  '📺',
  '🌙',
];

export const AVATAR_THEME_MAP: Record<
  AvatarTheme,
  {
    label: string;
    gradient: string;
    ring: string;
    softBg: string;
    text: string;
  }
> = {
  rose: {
    label: 'Cinema Crimson',
    gradient: 'from-rose-500 via-red-600 to-amber-500',
    ring: 'ring-rose-400/50',
    softBg: 'bg-rose-500/10 dark:bg-rose-400/15',
    text: 'text-rose-700 dark:text-rose-300',
  },
  amber: {
    label: 'Marquee Gold',
    gradient: 'from-amber-400 via-orange-500 to-rose-500',
    ring: 'ring-amber-400/50',
    softBg: 'bg-amber-500/10 dark:bg-amber-400/15',
    text: 'text-amber-700 dark:text-amber-300',
  },
  indigo: {
    label: 'Midnight IMAX',
    gradient: 'from-indigo-400 via-blue-600 to-violet-600',
    ring: 'ring-indigo-400/50',
    softBg: 'bg-indigo-500/10 dark:bg-indigo-400/15',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  emerald: {
    label: 'Emerald Noir',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    ring: 'ring-emerald-400/50',
    softBg: 'bg-emerald-500/10 dark:bg-emerald-400/15',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  violet: {
    label: 'Velvet Premiere',
    gradient: 'from-violet-400 via-purple-600 to-indigo-700',
    ring: 'ring-violet-400/50',
    softBg: 'bg-violet-500/10 dark:bg-violet-400/15',
    text: 'text-violet-700 dark:text-violet-300',
  },
  teal: {
    label: 'Sea Glass',
    gradient: 'from-teal-400 via-cyan-500 to-sky-600',
    ring: 'ring-teal-400/50',
    softBg: 'bg-teal-500/10 dark:bg-teal-400/15',
    text: 'text-teal-700 dark:text-teal-300',
  },
  coral: {
    label: 'Sunset Drive-In',
    gradient: 'from-orange-400 via-red-500 to-rose-600',
    ring: 'ring-orange-400/50',
    softBg: 'bg-orange-500/10 dark:bg-orange-400/15',
    text: 'text-orange-700 dark:text-orange-300',
  },
  slate: {
    label: 'Silver Screen',
    gradient: 'from-slate-500 via-zinc-700 to-stone-900',
    ring: 'ring-slate-400/50',
    softBg: 'bg-slate-500/10 dark:bg-slate-400/15',
    text: 'text-slate-700 dark:text-slate-300',
  },
};

export const MOVIE_LANGUAGES = [
  'English',
  'French',
  'Spanish',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Chinese',
  'Hindi',
  'Other',
] as const;

export function isoLangToMovieLanguage(code?: string): string {
  if (!code) return 'English';
  const clean = code.trim().toLowerCase();
  switch (clean) {
    case 'en':
    case 'eng':
    case 'english':
      return 'English';
    case 'fr':
    case 'fre':
    case 'fra':
    case 'french':
      return 'French';
    case 'es':
    case 'spa':
    case 'spanish':
      return 'Spanish';
    case 'de':
    case 'ger':
    case 'deu':
    case 'german':
      return 'German';
    case 'it':
    case 'ita':
    case 'italian':
      return 'Italian';
    case 'pt':
    case 'por':
    case 'portuguese':
      return 'Portuguese';
    case 'ja':
    case 'jpn':
    case 'japanese':
      return 'Japanese';
    case 'ko':
    case 'kor':
    case 'korean':
      return 'Korean';
    case 'zh':
    case 'chi':
    case 'zho':
    case 'chinese':
      return 'Chinese';
    case 'hi':
    case 'hin':
    case 'hindi':
      return 'Hindi';
    default:
      return clean.length > 2 ? clean[0].toUpperCase() + clean.slice(1) : 'English';
  }
}

export const STATUS_META: Record<
  WatchStatus,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  watching: {
    label: 'Watching',
    shortLabel: 'Watching',
    badgeClass:
      'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 border-emerald-500/20',
    dotClass: 'bg-emerald-500',
  },
  watched: {
    label: 'Watched',
    shortLabel: 'Watched',
    badgeClass:
      'bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300 border-amber-500/20',
    dotClass: 'bg-amber-500',
  },
  'want-to-watch': {
    label: 'Want to Watch',
    shortLabel: 'Watchlist',
    badgeClass:
      'bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300 border-sky-500/20',
    dotClass: 'bg-sky-500',
  },
  dropped: {
    label: 'Dropped',
    shortLabel: 'Dropped',
    badgeClass:
      'bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 border-rose-500/20',
    dotClass: 'bg-rose-500',
  },
};

export const MEDIA_TYPE_META: Record<
  MediaType,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
  }
> = {
  movie: {
    label: 'Movie',
    shortLabel: 'Movie',
    badgeClass:
      'bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 border-rose-500/20',
  },
  series: {
    label: 'TV Series',
    shortLabel: 'Series',
    badgeClass:
      'bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300 border-violet-500/20',
  },
};

export const WATCH_MEDIUM_META: Record<
  WatchMedium,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
  }
> = {
  streaming: {
    label: 'Streaming',
    shortLabel: 'Stream',
    badgeClass:
      'bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300 border-cyan-500/20',
  },
  theater: {
    label: 'Movie Theater',
    shortLabel: 'Theater',
    badgeClass:
      'bg-rose-500/12 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 border-rose-500/20',
  },
  disc: {
    label: '4K / Blu-ray / DVD',
    shortLabel: 'Disc',
    badgeClass:
      'bg-stone-500/10 text-stone-700 dark:bg-stone-400/15 dark:text-stone-300 border-stone-500/20',
  },
  tv: {
    label: 'Broadcast / Cable TV',
    shortLabel: 'TV',
    badgeClass:
      'bg-indigo-500/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300 border-indigo-500/20',
  },
  other: {
    label: 'Other',
    shortLabel: 'Other',
    badgeClass:
      'bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300 border-slate-500/20',
  },
};

export const OWNERSHIP_META: Record<
  MovieOwnership,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
  }
> = {
  streaming: {
    label: 'Streaming',
    shortLabel: 'Streaming',
    badgeClass:
      'bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300 border-cyan-500/20',
  },
  'owned-digital': {
    label: 'Owned Digital',
    shortLabel: 'Digital',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 border-emerald-500/20',
  },
  'owned-disc': {
    label: 'Owned Disc',
    shortLabel: 'Disc',
    badgeClass:
      'bg-amber-500/12 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300 border-amber-500/20',
  },
  borrowed: {
    label: 'Borrowed',
    shortLabel: 'Borrowed',
    badgeClass:
      'bg-orange-500/12 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300 border-orange-500/20',
  },
  other: {
    label: 'Other',
    shortLabel: 'Other',
    badgeClass:
      'bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300 border-slate-500/20',
  },
};

export const SUGGESTED_TAGS = [
  'watchlist',
  'favorite',
  'family-night',
  'theater',
  'rewatch',
  'classic',
  'documentary',
  'oscars',
];

export const SHELF_COLORS: Record<string, { label: string; badge: string; dot: string }> = {
  rose: {
    label: 'Crimson',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
  amber: {
    label: 'Marquee Gold',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  indigo: {
    label: 'Midnight Indigo',
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  emerald: {
    label: 'Emerald',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  violet: {
    label: 'Violet',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  teal: {
    label: 'Teal',
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
};

export const STREAMING_REGIONS = [
  { code: 'US', label: 'United States (US)' },
  { code: 'CA', label: 'Canada (CA)' },
  { code: 'GB', label: 'United Kingdom (GB)' },
  { code: 'FR', label: 'France (FR)' },
  { code: 'DE', label: 'Germany (DE)' },
  { code: 'ES', label: 'Spain (ES)' },
  { code: 'IT', label: 'Italy (IT)' },
  { code: 'AU', label: 'Australia (AU)' },
  { code: 'JP', label: 'Japan (JP)' },
  { code: 'BR', label: 'Brazil (BR)' },
  { code: 'MX', label: 'Mexico (MX)' },
  { code: 'IN', label: 'India (IN)' },
] as const;

export const POPULAR_STREAMING_SERVICES = [
  'Netflix',
  'Disney+',
  'Max',
  'Amazon Prime Video',
  'Apple TV+',
  'Hulu',
  'Peacock',
  'Paramount+',
  'Criterion Channel',
  'MUBI',
  'Kanopy',
  'Hoopla',
  'Tubi',
  'Pluto TV',
] as const;

function normalizeServiceName(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/\bstandard\s+with\s+ads\b/g, '')
    .replace(/\bwith\s+ads\b/g, '')
    .replace(/\bchannel\b/g, '')
    .replace(/\bamazon\s+channel\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (clean === 'hbo max' || clean === 'max') return 'max';
  if (clean === 'prime video' || clean === 'amazon prime video') return 'amazon prime video';
  if (clean === 'apple tv plus' || clean === 'apple tv') return 'apple tv plus';
  if (clean === 'disney plus') return 'disney plus';
  if (clean === 'paramount plus') return 'paramount plus';
  if (clean.startsWith('netflix')) return 'netflix';
  if (clean.startsWith('peacock')) return 'peacock';
  if (clean.startsWith('hulu')) return 'hulu';
  return clean;
}

export function matchesSubscribedService(
  providerName: string,
  subscribedServices: string[],
): boolean {
  if (!providerName || subscribedServices.length === 0) return false;
  const target = normalizeServiceName(providerName);
  if (!target) return false;
  return subscribedServices.some((sub) => {
    const normSub = normalizeServiceName(sub);
    return normSub === target || target.startsWith(`${normSub} `) || normSub.startsWith(`${target} `);
  });
}
