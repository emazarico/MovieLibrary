import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DRIVE_FILENAME,
  DRIVE_SCOPES,
  fetchUserEmail,
  formatGoogleAuthError,
  requestDriveAccessToken,
} from '../services/googleDriveSync';

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
});
