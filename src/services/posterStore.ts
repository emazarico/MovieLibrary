import { useEffect, useState } from 'react';
import { generateId } from '../utils/crypto';
import { sanitizePosterUrl } from '../utils/poster';

const DB_NAME = 'movielibrary_posters_v1';
const STORE_NAME = 'posters';

const memoryPosters = new Map<string, string>();

function openPostersDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSetPoster(key: string, dataUrl: string): Promise<void> {
  const db = await openPostersDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetPoster(key: string): Promise<string | undefined> {
  const db = await openPostersDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressPosterToWebPDataUrl(
  file: Blob,
  maxWidth = 340,
  maxHeight = 510,
  quality = 0.8,
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return blobToDataUrl(file);
  }

  const objectUrl =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : await blobToDataUrl(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode poster image.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxWidth / Math.max(1, img.width), maxHeight / Math.max(1, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return blobToDataUrl(file);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) {
      return webp;
    }
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    if (objectUrl.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

export async function saveCustomPoster(file: Blob): Promise<string> {
  const dataUrl = await compressPosterToWebPDataUrl(file);
  const key = `idb-poster:${generateId('pst')}`;
  memoryPosters.set(key, dataUrl);
  await idbSetPoster(key, dataUrl);
  return key;
}

export async function resolvePosterUrl(url?: string): Promise<string | undefined> {
  const clean = sanitizePosterUrl(url);
  if (!clean) return undefined;
  if (!clean.startsWith('idb-poster:')) return clean;

  const cached = memoryPosters.get(clean);
  if (cached) return cached;

  const stored = await idbGetPoster(clean);
  if (stored) {
    memoryPosters.set(clean, stored);
  }
  return stored;
}

export function useResolvedPoster(rawUrl?: string): string | undefined {
  const clean = sanitizePosterUrl(rawUrl);
  const syncValue = clean?.startsWith('idb-poster:') ? memoryPosters.get(clean) : clean;
  const [resolved, setResolved] = useState<string | undefined>(syncValue);

  useEffect(() => {
    if (!clean) {
      setResolved(undefined);
      return;
    }
    if (!clean.startsWith('idb-poster:')) {
      setResolved(clean);
      return;
    }

    const cached = memoryPosters.get(clean);
    if (cached) {
      setResolved(cached);
      return;
    }

    let cancelled = false;
    void resolvePosterUrl(clean).then((url) => {
      if (!cancelled) {
        setResolved(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clean]);

  return resolved;
}
