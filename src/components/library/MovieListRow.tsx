import React from 'react';
import { Pencil, Play, Tv, Users } from 'lucide-react';
import type { MovieItem, UserProfile } from '../../types/movie';
import { formatRuntimeHuman, getMovieProgressInfo } from '../../utils/progress';
import { STATUS_META } from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';
import { StreamingBadges } from '../common/StreamingBadges';

interface MovieListRowProps {
  movie: MovieItem;
  onSelect: (movie: MovieItem) => void;
  onQuickLog: (movie: MovieItem) => void;
  onEdit: (movie: MovieItem) => void;
  profiles?: UserProfile[];
  subscribedServices?: string[];
}

export const MovieListRow: React.FC<MovieListRowProps> = ({
  movie,
  onSelect,
  onQuickLog,
  onEdit,
  profiles = [],
  subscribedServices = [],
}) => {
  const statusMeta = STATUS_META[movie.status];
  const progress = getMovieProgressInfo(movie);
  const coWatchers = (movie.watchedWithProfileIds || [])
    .map((id) => profiles.find((p) => p.id === id && !p.deletedAt))
    .filter((p): p is UserProfile => Boolean(p));

  return (
    <div
      onClick={() => onSelect(movie)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(movie);
        }
      }}
      className="group flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 hover:border-rose-300 dark:hover:border-rose-700/70 transition-all cursor-pointer"
    >
      <MoviePoster
        title={movie.title}
        director={movie.director}
        posterUrl={movie.posterUrl}
        size="xs"
        interactive={false}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h3 className="font-serif-display text-sm font-bold text-stone-900 dark:text-stone-100 truncate group-hover:text-rose-700 dark:group-hover:text-rose-300">
            {movie.title}
          </h3>
          {movie.releaseYear && (
            <span className="text-xs text-stone-400">({movie.releaseYear})</span>
          )}
          {movie.mediaType === 'series' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/12 text-violet-700 dark:text-violet-300">
              <Tv className="w-2.5 h-2.5" /> Series
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusMeta.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
            {statusMeta.shortLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          <span className="truncate">{movie.director}</span>
          {movie.runtimeMinutes > 0 && (
            <span>
              · {formatRuntimeHuman(movie.runtimeMinutes)}
              {movie.mediaType === 'series' ? '/ep' : ''}
            </span>
          )}
          {movie.status === 'watching' && (
            <span className="text-emerald-700 dark:text-emerald-300 font-medium">
              · {progress.shortLabel}
            </span>
          )}
          {coWatchers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300">
              <Users className="w-3 h-3" />
              {coWatchers.map((c) => `${c.avatarEmoji} ${c.name}`).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center">
        <StreamingBadges
          providers={movie.watchProviders}
          subscribedServices={subscribedServices}
          compact
          maxItems={2}
        />
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {movie.rating > 0 ? (
          <StarRating value={movie.rating} size="sm" />
        ) : movie.externalRatings?.tmdbScore ? (
          <span className="text-[11px] font-semibold text-stone-400">
            TMDB {movie.externalRatings.tmdbScore.toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickLog(movie);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
          title="Log watch session"
        >
          <Play className="w-3 h-3" />
          <span className="hidden sm:inline">Watch</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(movie);
          }}
          className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors"
          aria-label="Edit title"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
