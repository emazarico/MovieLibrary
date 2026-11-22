import React, { useState } from 'react';
import { formatWatchHours } from '../../utils/progress';
import type { MonthlyBucket } from '../../utils/stats';

interface MonthlyChartProps {
  buckets: MonthlyBucket[];
  year: number;
  metric: 'hours' | 'titles';
  monthlyHoursGoal: number;
  yearlyMovieGoal: number;
  selectedMonth: number | null;
  onSelectMonth: (monthIndex: number | null) => void;
}

export const MonthlyChart: React.FC<MonthlyChartProps> = ({
  buckets,
  year,
  metric,
  monthlyHoursGoal,
  yearlyMovieGoal,
  selectedMonth,
  onSelectMonth,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const goalLineValue =
    metric === 'hours'
      ? Math.max(1, monthlyHoursGoal)
      : Math.max(1, Math.round((yearlyMovieGoal / 12) * 10) / 10);

  const getBucketTotal = (b: MonthlyBucket) =>
    metric === 'hours' ? Number((b.minutesWatched / 60).toFixed(1)) : b.titlesWatched;

  const maxDataVal = Math.max(1, ...buckets.map(getBucketTotal));
  const yMax = Math.max(maxDataVal * 1.15, goalLineValue * 1.1);

  const chartHeight = 200;
  const topPad = 18;
  const bottomPad = 28;
  const plotHeight = chartHeight - topPad - bottomPad;
  const svgWidth = 720;
  const leftPad = 38;
  const rightPad = 14;
  const slotWidth = (svgWidth - leftPad - rightPad) / 12;
  const barWidth = Math.min(34, slotWidth * 0.62);

  const valueToY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / yMax));
    return topPad + plotHeight - ratio * plotHeight;
  };

  const goalY = valueToY(goalLineValue);
  const activeBucket =
    hoveredMonth !== null
      ? buckets[hoveredMonth]
      : selectedMonth !== null
        ? buckets[selectedMonth]
        : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-stone-700 dark:text-stone-200">
            {year} Monthly Breakdown
          </span>
          {metric === 'hours' ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Logged
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-300/75 dark:bg-rose-400/35 inline-block" />{' '}
                Runtime Backfill
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Titles Watched
            </span>
          )}
        </div>

        <div className="min-h-[20px]">
          {activeBucket ? (
            <span className="font-semibold text-stone-800 dark:text-stone-100">
              {activeBucket.label} {year}:{' '}
              {metric === 'hours'
                ? `${formatWatchHours(activeBucket.minutesWatched)} (${formatWatchHours(activeBucket.loggedMinutes)} logged + ${formatWatchHours(activeBucket.backfillMinutes)} backfill)`
                : `${activeBucket.titlesWatched} title(s) · ${formatWatchHours(activeBucket.minutesWatched)}`}
            </span>
          ) : (
            <span>Click any bar to filter by month</span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar">
        <svg
          viewBox={`0 0 ${svgWidth} ${chartHeight}`}
          className="w-full min-w-[500px] h-52 select-none"
          role="img"
          aria-label={`${year} monthly watch ${metric} chart`}
        >
          {[0, 0.5, 1].map((fraction) => {
            const val = Number((yMax * fraction).toFixed(1));
            const y = valueToY(val);
            return (
              <g key={fraction}>
                <line
                  x1={leftPad}
                  x2={svgWidth - rightPad}
                  y1={y}
                  y2={y}
                  className="stroke-stone-200/80 dark:stroke-stone-800"
                  strokeWidth={1}
                />
                <text
                  x={leftPad - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-stone-400 text-[10px] font-medium"
                >
                  {metric === 'hours' ? `${Math.round(val)}h` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Monthly Goal Reference Line */}
          <line
            x1={leftPad}
            x2={svgWidth - rightPad}
            y1={goalY}
            y2={goalY}
            strokeDasharray="4 4"
            className="stroke-emerald-500/80"
            strokeWidth={1.5}
          />
          <text
            x={svgWidth - rightPad - 4}
            y={Math.max(12, goalY - 4)}
            textAnchor="end"
            className="fill-emerald-600 dark:fill-emerald-400 text-[10px] font-semibold"
          >
            Goal: {goalLineValue}{metric === 'hours' ? 'h' : ''}
          </text>

          {/* Bars */}
          {buckets.map((bucket, idx) => {
            const x = leftPad + idx * slotWidth + (slotWidth - barWidth) / 2;
            const totalVal = getBucketTotal(bucket);
            const barTopY = valueToY(totalVal);
            const baseY = valueToY(0);
            const totalH = Math.max(0, baseY - barTopY);

            const isSelected = selectedMonth === idx;
            const isHovered = hoveredMonth === idx;

            const loggedVal =
              metric === 'hours'
                ? Number((bucket.loggedMinutes / 60).toFixed(1))
                : totalVal;
            const loggedTopY = valueToY(loggedVal);
            const loggedH = Math.max(0, baseY - loggedTopY);
            const backfillH = Math.max(0, totalH - loggedH);

            return (
              <g
                key={bucket.monthKey}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMonth(idx)}
                onMouseLeave={() => setHoveredMonth(null)}
                onClick={() => onSelectMonth(isSelected ? null : idx)}
              >
                <rect
                  x={leftPad + idx * slotWidth}
                  y={topPad}
                  width={slotWidth}
                  height={plotHeight + bottomPad}
                  fill="transparent"
                />

                {metric === 'hours' ? (
                  <>
                    {backfillH > 0 && (
                      <rect
                        x={x}
                        y={barTopY}
                        width={barWidth}
                        height={backfillH}
                        rx={4}
                        className="fill-rose-300/80 dark:fill-rose-400/35 transition-opacity"
                        opacity={selectedMonth !== null && !isSelected ? 0.45 : 1}
                      />
                    )}
                    {loggedH > 0 && (
                      <rect
                        x={x}
                        y={loggedTopY}
                        width={barWidth}
                        height={loggedH}
                        rx={4}
                        className={`transition-all ${
                          isSelected || isHovered
                            ? 'fill-rose-600 dark:fill-rose-400'
                            : 'fill-rose-500 dark:fill-rose-500'
                        }`}
                        opacity={selectedMonth !== null && !isSelected ? 0.45 : 1}
                      />
                    )}
                  </>
                ) : (
                  totalH > 0 && (
                    <rect
                      x={x}
                      y={barTopY}
                      width={barWidth}
                      height={totalH}
                      rx={5}
                      className={`transition-all ${
                        isSelected || isHovered
                          ? 'fill-amber-600 dark:fill-amber-400'
                          : 'fill-amber-500 dark:fill-amber-500'
                      }`}
                      opacity={selectedMonth !== null && !isSelected ? 0.45 : 1}
                    />
                  )
                )}

                {isSelected && (
                  <rect
                    x={x - 2}
                    y={Math.min(barTopY, baseY - 6) - 2}
                    width={barWidth + 4}
                    height={Math.max(6, totalH) + 4}
                    rx={6}
                    fill="none"
                    className="stroke-stone-900 dark:stroke-white"
                    strokeWidth={1.5}
                  />
                )}

                <text
                  x={x + barWidth / 2}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className={`text-[11px] font-semibold ${
                    isSelected
                      ? 'fill-rose-700 dark:fill-rose-300'
                      : 'fill-stone-500 dark:fill-stone-400'
                  }`}
                >
                  {bucket.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
