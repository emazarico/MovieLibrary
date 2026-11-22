import { describe, expect, it } from 'vitest';
import { generateId, hashPin, sha256Hex, sha256Pure, verifyPin } from '../utils/crypto';

describe('crypto utilities', () => {
  it('computes NIST SHA-256 test vector accurately in pure JS', () => {
    expect(sha256Pure('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('sha256Hex matches sha256Pure output', async () => {
    const msg = 'movielibrary-test-vector';
    expect(await sha256Hex(msg)).toBe(sha256Pure(msg));
  });

  it('hashes and verifies per-profile salted PINs cleanly', async () => {
    const hashA = await hashPin('profile-alex', '1234');
    const hashB = await hashPin('profile-maya', '1234');
    expect(hashA).not.toBe(hashB);
    expect(await verifyPin('profile-alex', '1234', hashA)).toBe(true);
    expect(await verifyPin('profile-alex', ' 1234 ', hashA)).toBe(true);
    expect(await verifyPin('profile-alex', '9999', hashA)).toBe(false);
  });

  it('generates prefixed unique IDs', () => {
    const id1 = generateId('movie');
    const id2 = generateId('movie');
    expect(id1.startsWith('movie-')).toBe(true);
    expect(id1).not.toBe(id2);
  });
});
