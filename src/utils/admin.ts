import type { UserProfile } from '../types/movie';

/**
 * Determines whether a profile holds Household Admin / Parental permissions.
 * Falls back to the earliest active profile if no profile explicitly carries role === 'admin'
 * so older backups without roles still have a recoverable admin.
 */
export function isProfileAdmin(
  profile: UserProfile,
  activeProfiles: UserProfile[],
): boolean {
  if (profile.deletedAt) return false;
  if (profile.role === 'admin') return true;
  const nonDeleted = activeProfiles.filter((p) => !p.deletedAt);
  const hasExplicitAdmin = nonDeleted.some((p) => p.role === 'admin');
  if (!hasExplicitAdmin) {
    return nonDeleted[0]?.id === profile.id;
  }
  return false;
}

export function getHouseholdAdmins(activeProfiles: UserProfile[]): UserProfile[] {
  return activeProfiles.filter((p) => isProfileAdmin(p, activeProfiles));
}
