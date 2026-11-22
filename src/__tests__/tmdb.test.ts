import { describe, expect, it } from 'vitest';
import { parseWatchProvidersResponse } from '../services/tmdb';
import { isoLangToMovieLanguage, matchesSubscribedService } from '../utils/themes';

describe('tmdb streaming provider parsing & normalization', () => {
  it('extracts flatrate, free/ads, rent, and buy providers for preferred region', () => {
    const snap = parseWatchProvidersResponse(
      {
        US: {
          link: 'https://www.themoviedb.org/movie/569094/watch?locale=US',
          flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
          free: [{ provider_id: 73, provider_name: 'Tubi TV' }],
          ads: [{ provider_id: 300, provider_name: 'Pluto TV' }],
          rent: [{ provider_id: 2, provider_name: 'Apple TV' }],
          buy: [{ provider_id: 10, provider_name: 'Amazon Video' }],
        },
        CA: {
          flatrate: [{ provider_id: 119, provider_name: 'Amazon Prime Video' }],
        },
      },
      'us',
    );

    expect(snap).toBeTruthy();
    expect(snap!.region).toBe('US');
    expect(snap!.stream[0]).toMatchObject({
      providerId: 8,
      providerName: 'Netflix',
      logoUrl: 'https://image.tmdb.org/t/p/w92/netflix.jpg',
    });
    expect(snap!.free.map((f) => f.providerName)).toEqual(['Tubi TV', 'Pluto TV']);
    expect(snap!.rent[0].providerName).toBe('Apple TV');
  });

  it('matches normalized streaming service variants against household subscriptions', () => {
    const subs = ['Netflix', 'Max', 'Apple TV+', 'Amazon Prime Video'];
    expect(matchesSubscribedService('Netflix basic with Ads', subs)).toBe(true);
    expect(matchesSubscribedService('HBO Max', subs)).toBe(true);
    expect(matchesSubscribedService('Prime Video', subs)).toBe(true);
    expect(matchesSubscribedService('Apple TV', subs)).toBe(true);
    expect(matchesSubscribedService('Hulu', subs)).toBe(false);
  });

  it('maps ISO language codes to readable display names', () => {
    expect(isoLangToMovieLanguage('ja')).toBe('Japanese');
    expect(isoLangToMovieLanguage('ko')).toBe('Korean');
    expect(isoLangToMovieLanguage('fr')).toBe('French');
    expect(isoLangToMovieLanguage(undefined)).toBe('English');
  });
});
