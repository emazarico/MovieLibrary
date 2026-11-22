import React from 'react';
import {
  Check,
  Clock,
  Disc,
  Film,
  HeartHandshake,
  MessageSquareQuote,
  Plus,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import { useResolvedPoster } from '../../services/posterStore';
import type { MovieItem, UserProfile } from '../../types/movie';
import { getPosterStyle } from '../../utils/poster';
import { formatRuntimeHuman, getMovieProgressInfo } from '../../utils/progress';
import { AVATAR_THEME_MAP, MEDIA_TYPE_META, STATUS_META } from '../../utils/themes';
import { MoviePoster } from '../common/MoviePoster';
import { StarRating } from '../common/StarRating';
import { StreamingBadges } from '../common/StreamingBadges';

interface MovieCardProps {
  movie: MovieItem;
  onSelect: (movie: MovieItem) => void;
  onQuickLog: (movie: MovieItem) => void;
  profiles?: UserProfile[];
  subscribedServices?: string[];
  badgeContext?: 'status' | 'rewatch';
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onSelect,
  onQuickLog,
  profiles = [],
  subscribedServices = [],
  badgeContext = 'status',
}) => {
  const statusMeta = STATUS_META[movie.status];
  const mediaMeta = MEDIA_TYPE_META[movie.mediaType];
  const progress = getMovieProgressInfo(movie);
  const posterStyle = getPosterStyle(movie.title, movie.director);
  const resolvedPoster = useResolvedPoster(movie.posterUrl);
  const watchCount =
    (movie.watchHistory?.length ?? 0) + (movie.status === 'watched' ? 1 : 0);

  const coWatchers = (movie.watchedWithProfileIds || [])
    .map((id) => profiles.find((p) => p.id === id && !p.deletedAt))
    .filter((p): p is UserProfile => Boolean(p));

  const showProgressBar =
    movie.status === 'watching' ||
    (movie.mediaType === 'series' &&
      (movie.episodesWatched ?? 0) > 0 &&
      movie.status !== 'watched');

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
      className="group relative flex gap-4 p-4 rounded-2xl bg-white dark:bg-[#171A23] border border-stone-200/90 dark:border-stone-800 hover:border-rose-300 dark:hover:border-rose-700/70 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      {/* Subtle Ambient Blurred Poster Aura */}
      {resolvedPoster ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 w-44 h-44 rounded-full opacity-[0.07] dark:opacity-[0.14] blur-2xl bg-cover bg-center transition-opacity group-hover:opacity-[0.13] dark:group-hover:opacity-[0.22]"
          style={{ backgroundImage: `url(${resolvedPoster})` }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -left-12 w-40 h-40 rounded-full opacity-[0.08] dark:opacity-[0.14] blur-2xl"
          style={{ background: posterStyle.bgFrom }}
        />
      )}

      {/* 3D Poster */}
      <div className="relative z-10 shrink-0 pt-0.5">
        <MoviePoster
          title={movie.title}
          director={movie.director}
          posterUrl={movie.posterUrl}
          size="md"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Top Status / Watch / Type / Lent Row */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {badgeContext === 'rewatch' && watchCount > 1 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-rose-500/12 text-rose-800 dark:bg-rose-400/15 dark:text-rose-200 border-rose-500/25">
                  <Sparkles className="w-2.5 h-2.5" />
                  Watch #{watchCount}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusMeta.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                  {statusMeta.shortLabel}
                </span>
              )}

              {movie.mediaType === 'series' && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${mediaMeta.badgeClass}`}
                >
                  <Tv className="w-2.5 h-2.5" /> Series
                </span>
              )}

              {movie.certification && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                  {movie.certification}
                </span>
              )}

              {movie.language && movie.language.toLowerCase() !== 'english' && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                  {movie.language}
                </span>
              )}
            </div>

            {movie.lentTo && (
              <span
                title={`Disc lent to ${movie.lentTo}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-800 dark:text-amber-300"
              >
                <HeartHandshake className="w-3 h-3" />
                {movie.lentTo}
              </span>
            )}
          </div>

          {/* Franchise Kicker */}
          {movie.franchise && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate mb-0.5">
              {movie.franchise}
              {movie.franchiseIndex !== undefined ? ` · #${movie.franchiseIndex}` : ''}
            </p>
          )}

          {/* Title & Director */}
          <h3 className="font-serif-display text-[15px] font-bold text-stone-900 dark:text-stone-100 leading-snug line-clamp-2 group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
            {movie.title}
            {movie.releaseYear ? (
              <span className="ml-1.5 font-sans text-xs font-medium text-stone-400 dark:text-stone-500">
                ({movie.releaseYear})
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
            {movie.director}
            {movie.runtimeMinutes > 0 && (
              <span className="text-stone-400 dark:text-stone-500">
                {' '}
                · {formatRuntimeHuman(movie.runtimeMinutes)}
                {movie.mediaType === 'series' ? '/ep' : ''}
              </span>
            )}
          </p>

          {/* Streaming Providers */}
          {movie.watchProviders && (
            <div className="mt-2">
              <StreamingBadges
                providers={movie.watchProviders}
                subscribedServices={subscribedServices}
                compact
                maxItems={2}
              />
            </div>
          )}

          {/* Co-Watching Family Pills */}
          {(coWatchers.length > 0 || movie.watchedWithGuests) && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Users className="w-3 h-3 text-rose-500 shrink-0 mr-0.5" />
              {coWatchers.slice(0, 3).map((cw) => {
                const theme = AVATAR_THEME_MAP[cw.avatarTheme] || AVATAR_THEME_MAP.rose;
                return (
                  <span
                    key={cw.id}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${theme.softBg} ${theme.text}`}
                  >
                    <span>{cw.avatarEmoji}</span>
                    <span>{cw.name}</span>
                  </span>
                );
              })}
              {coWatchers.length > 3 && (
                <span className="text-[10px] font-semibold text-stone-400">
                  +{coWatchers.length - 3}
                </span>
              )}
              {movie.watchedWithGuests && (
                <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate max-w-[110px]">
                  + {movie.watchedWithGuests}
                </span>
              )}
            </div>
          )}

          {/* Progress Bar (for series / in-progress movies) */}
          {showProgressBar && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1">
                <span className="truncate">{progress.label}</span>
                {progress.percent !== null && (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 ml-1">
                    {progress.percent}%
                  </span>
                )}
              </div>
              {progress.percent !== null && (
                <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Recommendation Attribution */}
          {movie.status === 'want-to-watch' && movie.recommendedBy && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1 truncate">
              <Sparkles className="w-3 h-3 shrink-0" />
              Picked by {movie.recommendedBy}
            </p>
          )}
        </div>

        {/* Bottom Rating & Action Row */}
        <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center gap-2 min-w-0">
            {movie.rating > 0 ? (
              <StarRating value={movie.rating} size="sm" />
            ) : movie.externalRatings?.tmdbScore ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                <Film className="w-3 h-3 text-amber-500" />
                TMDB {movie.externalRatings.tmdbScore.toFixed(1)}
              </span>
            ) : movie.ownership === 'owned-disc' ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                <Disc className="w-3 h-3" /> Disc
              </span>
            ) : (
              <span className="text-[11px] text-stone-400 italic">Unrated</span>
            )}

            {movie.review?.trim() && (
              <span title="Has personal review" className="text-rose-500 dark:text-rose-400">
                <MessageSquareQuote className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickLog(movie);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 ${
              movie.status === 'watching'
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                : movie.status === 'watched'
                  ? 'bg-amber-500/12 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300'
            }`}
          >
            {movie.status === 'watched' ? (
              <>
                <Check className="w-3 h-3" /> Rewatch / Log
              </>
            ) : movie.status === 'watching' ? (
              <>
                <Clock className="w-3 h-3" /> Log
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" /> Watch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
