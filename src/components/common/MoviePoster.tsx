import React, { useEffect, useState } from 'react';
import { useResolvedPoster } from '../../services/posterStore';
import { getPosterStyle } from '../../utils/poster';

interface MoviePosterProps {
  title: string;
  director: string;
  posterUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MoviePosterProps['size']>, string> = {
  xs: 'w-9 h-13',
  sm: 'w-14 h-21',
  md: 'w-24 h-36',
  lg: 'w-28 h-42',
  xl: 'w-36 h-54 sm:w-44 sm:h-66',
};

export const MoviePoster: React.FC<MoviePosterProps> = ({
  title,
  director,
  posterUrl,
  size = 'md',
  interactive = true,
  className = '',
}) => {
  const cleanUrl = useResolvedPoster(posterUrl);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
  }, [cleanUrl]);

  const style = getPosterStyle(title, director);
  const showImage = Boolean(cleanUrl) && !imgFailed;

  return (
    <div className={`movie-poster-stage inline-block shrink-0 ${SIZE_CLASSES[size]} ${className}`}>
      <div
        className={`relative w-full h-full rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-800 ${
          interactive ? 'movie-poster-3d' : 'shadow-md'
        }`}
      >
        {/* Bespoke Vintage Cinema Poster Layer (visible while loading and on missing/failed poster) */}
        <div
          className={`relative z-0 w-full h-full flex flex-col justify-between p-2.5 select-none overflow-hidden transition-opacity duration-200 ${
            showImage && imgLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            background: `linear-gradient(155deg, ${style.bgFrom} 0%, ${style.bgTo} 100%)`,
            color: style.ink,
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 100 150"
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
          >
            {style.motif === 'curtain' && (
              <path
                d="M12 10 Q32 45 16 140 M88 10 Q68 45 84 140"
                fill="none"
                stroke={style.accent}
                strokeWidth="2.5"
              />
            )}
            {style.motif === 'spotlight' && (
              <>
                <polygon points="50,8 92,140 8,140" fill="none" stroke={style.accent} strokeWidth="2" />
                <circle cx="50" cy="82" r="22" fill="none" stroke={style.accent} strokeWidth="1.5" />
              </>
            )}
            {style.motif === 'reel' && (
              <>
                <circle cx="50" cy="75" r="32" fill="none" stroke={style.accent} strokeWidth="2" />
                <circle cx="50" cy="75" r="10" fill="none" stroke={style.accent} strokeWidth="2" />
              </>
            )}
            {style.motif === 'marquee' && (
              <rect
                x="12"
                y="14"
                width="76"
                height="122"
                rx="6"
                fill="none"
                stroke={style.accent}
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            )}
          </svg>

          <div className="relative flex items-center gap-1">
            <span
              className="inline-block w-3 h-[2px] rounded-full"
              style={{ backgroundColor: style.accent }}
            />
          </div>

          <div className="relative my-auto">
            <p
              className={`font-serif-display font-semibold leading-tight line-clamp-3 ${
                size === 'xs'
                  ? 'text-[7px]'
                  : size === 'sm'
                    ? 'text-[9px]'
                    : size === 'md'
                      ? 'text-xs'
                      : 'text-sm'
              }`}
            >
              {title}
            </p>
          </div>

          {size !== 'xs' && (
            <div className="relative pt-1 border-t border-white/15">
              <p
                className={`uppercase tracking-wider truncate opacity-85 ${
                  size === 'sm' ? 'text-[7px]' : 'text-[9px]'
                }`}
              >
                {director}
              </p>
            </div>
          )}
        </div>

        {/* Poster Image Overlay */}
        {showImage && (
          <img
            src={cleanUrl}
            alt={`${title} poster`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className={`absolute inset-0 z-20 w-full h-full object-cover select-none transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Specular poster sheen */}
        <div aria-hidden="true" className="poster-gloss absolute inset-0 z-30 pointer-events-none" />
      </div>
    </div>
  );
};
