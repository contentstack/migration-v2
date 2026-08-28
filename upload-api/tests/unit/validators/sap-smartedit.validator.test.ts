import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sapSmarteditValidator from '../../../src/validators/sap-smartedit/index';

/**
 * Regression coverage for a previously-untested branch: the validator's directory
 * handling (`findFirstImpex`'s breadth-first search) was implemented but never
 * exercised by an automated test — every other check in this repo passes a raw
 * ImpEx string or a single file path. This pins the real "hand us a folder" flow
 * a customer's upload actually takes (`upload-api/src/routes/index.ts`'s
 * `fileformat_id: "directory"` branch, dispatched as `sap-smartedit-folder`).
 */
const FIXTURES_ROOT = path.join(__dirname, '../../fixtures/sap-smartedit/validator-folder');

describe('sapSmarteditValidator — folder input', () => {
  it('accepts a folder with a single .impex file directly at its root', () => {
    const dir = path.join(FIXTURES_ROOT, 'valid-root');
    expect(sapSmarteditValidator(dir)).toBe(true);
  });

  it('finds an .impex file nested arbitrarily deep, not just at the root', () => {
    const dir = path.join(FIXTURES_ROOT, 'valid-nested');
    expect(sapSmarteditValidator(dir)).toBe(true);
  });

  it('rejects a folder that contains no .impex file at all', () => {
    const dir = path.join(FIXTURES_ROOT, 'no-impex');
    expect(sapSmarteditValidator(dir)).toBe(false);
  });

  it('rejects a genuinely empty folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-smartedit-validator-empty-'));
    try {
      expect(sapSmarteditValidator(dir)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a folder whose only .impex file has no real ImpEx header', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-smartedit-validator-bad-'));
    try {
      fs.writeFileSync(path.join(dir, 'notes.impex'), 'just some text, not an export');
      expect(sapSmarteditValidator(dir)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    'known limitation: only sniffs the FIRST .impex file found — a folder with an invalid ' +
      'file before a valid one is rejected even though a valid export exists inside it',
    () => {
      // a-bad.impex sorts before z-good.impex in directory-listing order, so
      // findFirstImpex reads a-bad.impex (no header) and never reaches z-good.impex.
      const dir = path.join(FIXTURES_ROOT, 'first-invalid-second-valid');
      expect(sapSmarteditValidator(dir)).toBe(false);
    },
  );
});
