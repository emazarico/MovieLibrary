import React, { useId, useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (next: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showNumeric?: boolean;
}

const SIZE_PX: Record<NonNullable<StarRatingProps['size']>, number> = {
  sm: 14,
  md: 18,
  lg: 24,
};

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'sm',
  showNumeric = false,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const clipPrefix = useId();
  const displayValue = hoverValue !== null ? hoverValue : value;
  const px = SIZE_PX[size];

  const handleSelect = (candidate: number) => {
    if (!onChange) return;
    onChange(value === candidate ? 0 : candidate);
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 select-none"
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, displayValue - (starIndex - 1)));
        const isHalf = fillAmount >= 0.25 && fillAmount < 0.75;
        const isFull = fillAmount >= 0.75;
        const halfId = `${clipPrefix}-half-${starIndex}`;

        return (
          <div key={starIndex} className="relative inline-flex" style={{ width: px, height: px }}>
            <svg
              viewBox="0 0 24 24"
              width={px}
              height={px}
              className="pointer-events-none"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={halfId}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
              <path
                d="M12 2.2l2.92 6.08 6.68.93-4.86 4.68 1.18 6.63L12 17.34l-5.92 3.18 1.18-6.63L2.4 9.21l6.68-.93L12 2.2z"
                className="fill-stone-200 dark:fill-stone-700"
              />
              {isFull && (
                <path
                  d="M12 2.2l2.92 6.08 6.68.93-4.86 4.68 1.18 6.63L12 17.34l-5.92 3.18 1.18-6.63L2.4 9.21l6.68-.93L12 2.2z"
                  className="fill-amber-400 dark:fill-amber-400"
                />
              )}
              {isHalf && (
                <path
                  d="M12 2.2l2.92 6.08 6.68.93-4.86 4.68 1.18 6.63L12 17.34l-5.92 3.18 1.18-6.63L2.4 9.21l6.68-.93L12 2.2z"
                  clipPath={`url(#${halfId})`}
                  className="fill-amber-400 dark:fill-amber-400"
                />
              )}
            </svg>

            {onChange && (
              <>
                <button
                  type="button"
                  aria-label={`Rate ${starIndex - 0.5} stars`}
                  onMouseEnter={() => setHoverValue(starIndex - 0.5)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(starIndex - 0.5);
                  }}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={`Rate ${starIndex} stars`}
                  onMouseEnter={() => setHoverValue(starIndex)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(starIndex);
                  }}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer focus:outline-none"
                />
              </>
            )}
          </div>
        );
      })}

      {showNumeric && value > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300 tabular-nums">
          {value.toFixed(value % 1 === 0 ? 0 : 1)}
        </span>
      )}
    </div>
  );
};
