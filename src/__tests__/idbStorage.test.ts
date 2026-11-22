import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDatabaseFromIdb,
  getStorageEngineInfo,
  isIndexedDbAvailable,
  loadDatabaseFromIdb,
  saveDatabaseToIdb,
} from '../services/idbStorage';
import type { MovieLibraryDatabase } from '../types/movie';

const sampleDb: MovieLibraryDatabase = {
  schemaVersion: 1,
  dbId: 'db-idb-test',
  updatedAt: '2026-03-01T00:00:00.000Z',
  profiles: [],
  shelves: [],
  movies: [],
  watchLogs: [],
};

describe('idbStorage service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('degrades gracefully in Node / environments without indexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(isIndexedDbAvailable()).toBe(false);
    expect(await loadDatabaseFromIdb()).toBeNull();
    const saveRes = await saveDatabaseToIdb(sampleDb);
    expect(saveRes.ok).toBe(false);
    await expect(clearDatabaseFromIdb()).resolves.toBeUndefined();

    const info = await getStorageEngineInfo(sampleDb);
    expect(info.engine).toBe('localstorage');
    expect(info.estimatedBytes).toBeGreaterThan(0);
  });

  it('saves, loads, and clears databases cleanly when IndexedDB is present', async () => {
    const store = new Map<string, unknown>();

    const mockOpen = vi.fn(() => {
      const req: Record<string, unknown> = {
        result: {
          objectStoreNames: { contains: () => true },
          close: () => undefined,
          transaction: (_name: string, _mode: string) => {
            const tx: Record<string, unknown> = {
              oncomplete: null,
              onerror: null,
              onabort: null,
              objectStore: () => ({
                get: (key: string) => {
                  const getReq: Record<string, unknown> = {
                    result: store.get(key),
                    onsuccess: null,
                    onerror: null,
                  };
                  queueMicrotask(() => {
                    (getReq.onsuccess as (() => void) | null)?.();
                    (tx.oncomplete as (() => void) | null)?.();
                  });
                  return getReq;
                },
                put: (val: unknown, key: string) => {
                  store.set(key, val);
                  queueMicrotask(() => {
                    (tx.oncomplete as (() => void) | null)?.();
                  });
                },
                delete: (key: string) => {
                  store.delete(key);
                  queueMicrotask(() => {
                    (tx.oncomplete as (() => void) | null)?.();
                  });
                },
              }),
            };
            return tx;
          },
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        (req.onsuccess as (() => void) | null)?.();
      });
      return req;
    });

    vi.stubGlobal('indexedDB', { open: mockOpen });

    expect(isIndexedDbAvailable()).toBe(true);
    const saved = await saveDatabaseToIdb(sampleDb);
    expect(saved).toEqual({ ok: true });

    const loaded = await loadDatabaseFromIdb();
    expect(loaded?.dbId).toBe('db-idb-test');

    await clearDatabaseFromIdb();
    expect(await loadDatabaseFromIdb()).toBeNull();
  });
});
