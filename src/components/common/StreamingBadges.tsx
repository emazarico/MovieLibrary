import React from 'react';
import { Check, Tv } from 'lucide-react';
import type { StreamingProviderOption, WatchProvidersSnapshot } from '../../types/movie';
import { matchesSubscribedService } from '../../utils/themes';

interface StreamingBadgesProps {
  providers?: WatchProvidersSnapshot;
  subscribedServices: string[];
  compact?: boolean;
  maxItems?: number;
}

export const StreamingBadges: React.FC<StreamingBadgesProps> = ({
  providers,
  subscribedServices,
  compact = true,
  maxItems = 3,
}) => {
  if (!providers) return null;

  const streamAndFree: Array<StreamingProviderOption & { kind: 'stream' | 'free' }> = [
    ...providers.stream.map((p) => ({ ...p, kind: 'stream' as const })),
    ...providers.free.map((p) => ({ ...p, kind: 'free' as const })),
  ];

  // Put household's subscribed services first
  streamAndFree.sort((a, b) => {
    const aSub = matchesSubscribedService(a.providerName, subscribedServices) ? 0 : 1;
    const bSub = matchesSubscribedService(b.providerName, subscribedServices) ? 0 : 1;
    return aSub - bSub;
  });

  if (streamAndFree.length === 0) {
    if (providers.rent.length === 0 && providers.buy.length === 0) return null;
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
          <Tv className="w-2.5 h-2.5" /> Rent / Buy
        </span>
      );
    }
    return null;
  }

  const shown = streamAndFree.slice(0, maxItems);
  const extra = streamAndFree.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((prov) => {
        const isSubscribed = matchesSubscribedService(prov.providerName, subscribedServices);
        return (
          <span
            key={`${prov.kind}-${prov.providerId}-${prov.providerName}`}
            title={
              isSubscribed
                ? `Included in your subscriptions: ${prov.providerName}`
                : `${prov.kind === 'free' ? 'Free with ads' : 'Stream'}: ${prov.providerName}`
            }
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
              isSubscribed
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35'
                : 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/20'
            }`}
          >
            {prov.logoUrl && (
              <img
                src={prov.logoUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm object-cover shrink-0"
              />
            )}
            <span className="truncate max-w-[90px]">{prov.providerName}</span>
            {isSubscribed && <Check className="w-2.5 h-2.5 shrink-0" />}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] font-semibold text-stone-400 px-1">+{extra}</span>
      )}
    </div>
  );
};
