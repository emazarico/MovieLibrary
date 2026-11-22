import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../types/movie';
import { getHouseholdAdmins, isProfileAdmin } from '../utils/admin';

function makeProfile(overrides: Partial<UserProfile>): UserProfile {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'p1',
    name: 'Alex',
    avatarEmoji: '🦉',
    avatarTheme: 'rose',
    pinHash: null,
    yearlyMovieGoal: 40,
    monthlyWatchHoursGoal: 15,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('admin helpers', () => {
  it('identifies explicit admin profiles and excludes members', () => {
    const admin = makeProfile({ id: 'p1', name: 'Alex', role: 'admin' });
    const member = makeProfile({ id: 'p2', name: 'Maya', role: 'member' });
    const profiles = [admin, member];

    expect(isProfileAdmin(admin, profiles)).toBe(true);
    expect(isProfileAdmin(member, profiles)).toBe(false);
    expect(getHouseholdAdmins(profiles).map((p) => p.id)).toEqual(['p1']);
  });

  it('falls back to earliest non-deleted profile when no explicit role exists', () => {
    const first = makeProfile({ id: 'p1', name: 'First' });
    const second = makeProfile({ id: 'p2', name: 'Second' });
    const profiles = [first, second];

    expect(isProfileAdmin(first, profiles)).toBe(true);
    expect(isProfileAdmin(second, profiles)).toBe(false);
  });

  it('excludes soft-deleted profiles from admin checks', () => {
    const deletedAdmin = makeProfile({
      id: 'p1',
      name: 'Deleted',
      role: 'admin',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });
    const member = makeProfile({ id: 'p2', name: 'Maya', role: 'member' });

    expect(isProfileAdmin(deletedAdmin, [deletedAdmin, member])).toBe(false);
    expect(getHouseholdAdmins([deletedAdmin, member]).map((p) => p.id)).toEqual(['p2']);
  });
});
