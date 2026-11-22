import type { MovieItem, WatchLog } from '../types/movie';

export interface MovieProgressInfo {
  percent: number | null;
  label: string;
  shortLabel: string;
  currentMinutes: number;
  totalMinutes: number;
}

export function formatRuntimeHuman(minutesInput: number): string {
  const mins = Math.max(0, Math.round(minutesInput || 0));
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatWatchHours(minutesInput: number): string {
  const mins = Math.max(0, Math.round(minutesInput || 0));
  if (mins < 60) return `${mins}m`;
  const hrs = mins / 60;
  return `${hrs >= 10 ? Math.round(hrs) : Number(hrs.toFixed(1))}h`;
}

export function getMovieProgressInfo(movie: MovieItem): MovieProgressInfo {
  if (movie.mediaType === 'series') {
    const totalEps = Math.max(0, movie.totalEpisodes || 0);
    const watchedEps = Math.max(0, movie.episodesWatched ?? 0);
    const season = movie.currentSeason ?? 1;
    const episode = movie.currentEpisode ?? watchedEps;

    const percent =
      movie.status === 'watched'
        ? 100
        : totalEps > 0
          ? Math.min(100, Math.max(0, Math.round((watchedEps / totalEps) * 100)))
          : null;

    const label =
      totalEps > 0
        ? `S${season} · E${episode} (${watchedEps} / ${totalEps} eps)`
        : watchedEps > 0 || episode > 0
          ? `S${season} · E${episode}`
          : 'Not started';

    const shortLabel =
      totalEps > 0
        ? `${watchedEps}/${totalEps} eps`
        : episode > 0
          ? `S${season}E${episode}`
          : 'Series';

    return {
      percent,
      label,
      shortLabel,
      currentMinutes: Math.max(0, movie.watchedMinutes ?? 0),
      totalMinutes: Math.max(0, movie.runtimeMinutes || 0),
    };
  }

  const totalMinutes = Math.max(0, movie.runtimeMinutes || 0);
  const currentMinutes =
    movie.status === 'watched' && totalMinutes > 0
      ? Math.max(totalMinutes, movie.watchedMinutes ?? 0)
      : Math.max(0, movie.watchedMinutes ?? 0);

  const percent =
    movie.status === 'watched'
      ? 100
      : totalMinutes > 0
        ? Math.min(100, Math.max(0, Math.round((currentMinutes / totalMinutes) * 100)))
        : null;

  const label =
    totalMinutes > 0
      ? `${formatRuntimeHuman(currentMinutes)} / ${formatRuntimeHuman(totalMinutes)}`
      : currentMinutes > 0
        ? `${formatRuntimeHuman(currentMinutes)} watched`
        : 'Not started';

  const shortLabel =
    totalMinutes > 0
      ? `${formatRuntimeHuman(currentMinutes)}/${formatRuntimeHuman(totalMinutes)}`
      : formatRuntimeHuman(currentMinutes);

  return {
    percent,
    label,
    shortLabel,
    currentMinutes,
    totalMinutes,
  };
}

export function formatWatchLogBadge(log: WatchLog): string {
  const parts: string[] = [];
  if (log.episodesCount && log.episodesCount > 0) {
    const epPart = `+${log.episodesCount} ${log.episodesCount === 1 ? 'ep' : 'eps'}`;
    if (log.seasonNumber && log.episodeNumber) {
      parts.push(`${epPart} (S${log.seasonNumber}E${log.episodeNumber})`);
    } else {
      parts.push(epPart);
    }
  }
  if (log.minutesWatched > 0) {
    parts.push(`+${formatRuntimeHuman(log.minutesWatched)}`);
  }
  if (parts.length === 0) {
    return 'Watched';
  }
  return parts.join(' · ');
}
