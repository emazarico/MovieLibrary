import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DRIVE_FILENAME,
  DRIVE_SCOPES,
  fetchUserEmail,
  formatGoogleAuthError,
  requestDriveAccessToken,
} from '../services/googleDriveSync';
import {
  clearCachedDriveToken,
  loadCachedDriveToken,
  saveCachedDriveToken,
  STORAGE_KEYS,
} from '../services/storage';

function installMockLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  });
  return store;
}

describe('googleDriveSync helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests both drive.file and userinfo.email scopes and uses movielibrary-db.json', async () => {
    expect(DEFAULT_DRIVE_FILENAME).toBe('movielibrary-db.json');
    expect(DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    expect(DRIVE_SCOPES).toContain('https://www.googleapis.com/auth/userinfo.email');

    let capturedScope = '';
    vi.stubGlobal('window', {
      location: { origin: 'https://example.github.io' },
      google: {
        accounts: {
          oauth2: {
            initTokenClient: (cfg: {
              scope: string;
              callback: (resp: { access_token?: string; expires_in?: number }) => void;
            }) => {
              capturedScope = cfg.scope;
              return {
                requestAccessToken: () =>
                  cfg.callback({ access_token: 'tok-123', expires_in: 3600 }),
              };
            },
          },
        },
      },
    });

    const res = await requestDriveAccessToken('123456.apps.googleusercontent.com');
    expect(res.accessToken).toBe('tok-123');
    expect(capturedScope).toBe(DRIVE_SCOPES);
  });

  it('validates empty or non-googleusercontent Client IDs clearly', async () => {
    await expect(requestDriveAccessToken('')).rejects.toThrow(/Client ID/i);
    await expect(requestDriveAccessToken('bad-client-id')).rejects.toThrow(
      /\.apps\.googleusercontent\.com/,
    );
  });

  it('formats common GIS error codes cleanly', () => {
    expect(formatGoogleAuthError('invalid_scope')).toMatch(/OAuth scope/i);
    expect(formatGoogleAuthError('access_denied')).toMatch(/Test users/i);
    expect(formatGoogleAuthError('origin_mismatch')).toMatch(/Authorized JavaScript origins/i);
  });

  it('falls back to Drive about endpoint when OAuth userinfo fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { emailAddress: 'family@example.com' } }),
      });

    vi.stubGlobal('fetch', fetchMock);
    const email = await fetchUserEmail('token-abc');
    expect(email).toBe('family@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/drive/v3/about?fields=user(emailAddress)');
  });

  it('caches Drive access token within TTL and clears stale or mismatched entries', () => {
    const lsStore = installMockLocalStorage();
    const clientA = '12345.apps.googleusercontent.com';
    const clientB = '99999.apps.googleusercontent.com';

    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    saveCachedDriveToken('tok-abc', 3600, clientA, 'family@example.com');
    expect(lsStore.has(STORAGE_KEYS.DRIVE_TOKEN)).toBe(true);

    const valid = loadCachedDriveToken(clientA, now + 10 * 60_000);
    expect(valid).toMatchObject({
      accessToken: 'tok-abc',
      clientId: clientA,
      userEmail: 'family@example.com',
    });

    // Different client ID -> ignored & cleared
    expect(loadCachedDriveToken(clientB, now + 1000)).toBeNull();
    expect(lsStore.has(STORAGE_KEYS.DRIVE_TOKEN)).toBe(false);

    // Within 60s expiry buffer or expired -> ignored & cleared
    saveCachedDriveToken('tok-def', 3600, clientA);
    expect(loadCachedDriveToken(clientA, now + 3541 * 1000)).toBeNull();
    expect(lsStore.has(STORAGE_KEYS.DRIVE_TOKEN)).toBe(false);

    saveCachedDriveToken('tok-ghi', 3600, clientA);
    clearCachedDriveToken();
    expect(loadCachedDriveToken(clientA, now)).toBeNull();
  });

  it('passes email hint on reconnect but omits it when switching accounts', async () => {
    const initMock = vi.fn();
    const requestMock = vi.fn();

    initMock.mockImplementation(
      (cfg: { callback: (r: { access_token: string; expires_in: number }) => void }) => {
        requestMock.mockImplementationOnce(() => {
          cfg.callback({ access_token: 'new-tok', expires_in: 3600 });
        });
        return { requestAccessToken: requestMock };
      },
    );

    vi.stubGlobal('window', {
      google: {
        accounts: {
          oauth2: {
            initTokenClient: initMock,
          },
        },
      },
    });

    const clientId = '12345.apps.googleusercontent.com';
    const res1 = await requestDriveAccessToken(clientId, '', 'family@example.com');
    expect(res1).toEqual({ accessToken: 'new-tok', expiresIn: 3600 });
    expect(initMock.mock.calls[0][0].hint).toBe('family@example.com');
    expect(requestMock.mock.calls[0][0]).toEqual({ prompt: '', hint: 'family@example.com' });

    const res2 = await requestDriveAccessToken(clientId, 'select_account', 'family@example.com');
    expect(res2).toEqual({ accessToken: 'new-tok', expiresIn: 3600 });
    expect(initMock.mock.calls[1][0].hint).toBeUndefined();
    expect(requestMock.mock.calls[1][0]).toEqual({ prompt: 'select_account' });
  });
});
