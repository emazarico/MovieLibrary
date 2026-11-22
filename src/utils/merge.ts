import type {
  HouseholdSettings,
  MovieItem,
  MovieLibraryDatabase,
  Shelf,
  UserProfile,
  WatchLog,
} from '../types/movie';

type TimestampedRecord = {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
};

function parseTime(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function mergeRecordArrays<T extends TimestampedRecord>(localArr: T[], remoteArr: T[]): T[] {
  const map = new Map<string, T>();

  for (const item of remoteArr) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }

  for (const localItem of localArr) {
    if (!localItem || !localItem.id) continue;
    const remoteItem = map.get(localItem.id);
    if (!remoteItem) {
      map.set(localItem.id, localItem);
      continue;
    }

    const localTs = Math.max(parseTime(localItem.updatedAt), parseTime(localItem.deletedAt));
    const remoteTs = Math.max(parseTime(remoteItem.updatedAt), parseTime(remoteItem.deletedAt));

    if (localTs >= remoteTs) {
      map.set(localItem.id, localItem);
    }
  }

  return Array.from(map.values());
}

function mergeHouseholdSettings(
  local?: HouseholdSettings,
  remote?: HouseholdSettings,
): HouseholdSettings | undefined {
  if (!local && !remote) return undefined;
  if (!local) return remote;
  if (!remote) return local;
  return parseTime(local.updatedAt) >= parseTime(remote.updatedAt) ? local : remote;
}

/**
 * Deterministic per-record Last-Write-Wins (LWW) merge across two database snapshots.
 * Preserves deletedAt tombstones so deletions propagate across devices cleanly.
 */
export function mergeDatabases(
  local: MovieLibraryDatabase,
  remote: MovieLibraryDatabase,
): MovieLibraryDatabase {
  const profiles = mergeRecordArrays<UserProfile>(local.profiles || [], remote.profiles || []);
  const shelves = mergeRecordArrays<Shelf>(local.shelves || [], remote.shelves || []);
  const movies = mergeRecordArrays<MovieItem>(local.movies || [], remote.movies || []);
  const watchLogs = mergeRecordArrays<WatchLog>(
    local.watchLogs || [],
    remote.watchLogs || [],
  );

  const localDbTime = parseTime(local.updatedAt);
  const remoteDbTime = parseTime(remote.updatedAt);
  const latestMs = Math.max(localDbTime, remoteDbTime, Date.now());

  return {
    schemaVersion: 1,
    dbId: remote.dbId || local.dbId,
    updatedAt: new Date(latestMs).toISOString(),
    householdSettings: mergeHouseholdSettings(local.householdSettings, remote.householdSettings),
    profiles,
    shelves,
    movies,
    watchLogs,
  };
}
