import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch, mockSave, mockRemove } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockSave: vi.fn(),
  mockRemove: vi.fn()
}));

vi.mock('../../../src/services/api/user.service', () => ({
  fetchSourceSession: mockFetch,
  saveSourceSession: mockSave,
  removeSourceSession: mockRemove
}));

import {
  getMigrationSourceSession,
  setMigrationSourceSession,
  clearMigrationSourceSession
} from '../../../src/utilities/migrationSourceSession';

describe('utilities/migrationSourceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setMigrationSourceSession', () => {
    it('trims the region and forwards to saveSourceSession', async () => {
      mockSave.mockResolvedValue(undefined);
      await setMigrationSourceSession('  EU  ', 'tok-xyz');
      expect(mockSave).toHaveBeenCalledWith('EU', 'tok-xyz');
    });

    it('skips the API call when region is empty', async () => {
      await setMigrationSourceSession('', 'tok');
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('skips the API call when appToken is empty', async () => {
      await setMigrationSourceSession('EU', '');
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('getMigrationSourceSession', () => {
    it('returns the session when the backend provides one', async () => {
      mockFetch.mockResolvedValue({ region: 'EU', appToken: 'tok' });
      expect(await getMigrationSourceSession()).toEqual({ region: 'EU', appToken: 'tok' });
    });

    it('returns null when the backend returns null', async () => {
      mockFetch.mockResolvedValue(null);
      expect(await getMigrationSourceSession()).toBeNull();
    });

    it('returns null when the backend record is missing appToken', async () => {
      mockFetch.mockResolvedValue({ region: 'EU', appToken: '' });
      expect(await getMigrationSourceSession()).toBeNull();
    });

    it('returns null when the backend record is missing region', async () => {
      mockFetch.mockResolvedValue({ region: '', appToken: 'tok' });
      expect(await getMigrationSourceSession()).toBeNull();
    });
  });

  describe('clearMigrationSourceSession', () => {
    it('delegates to removeSourceSession', async () => {
      mockRemove.mockResolvedValue(undefined);
      await clearMigrationSourceSession();
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
