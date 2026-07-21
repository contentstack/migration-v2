import { describe, it, expect } from 'vitest';
import { mapOrganizationsForMigration } from '../../../src/utils/contentstack-user-orgs.utils.js';

describe('mapOrganizationsForMigration', () => {
  it('prefers admin and owner orgs', () => {
    const out = mapOrganizationsForMigration([
      { uid: 'a', name: 'A', org_roles: [{ admin: true }], is_owner: false },
      { uid: 'b', name: 'B', org_roles: [], is_owner: true },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.org_id).sort()).toEqual(['a', 'b']);
  });

  it('falls back to all orgs when no admin or owner match', () => {
    const out = mapOrganizationsForMigration([
      { uid: 'x', name: 'X', org_roles: [{ admin: false }], is_owner: false },
    ]);
    expect(out).toEqual([{ org_id: 'x', org_name: 'X' }]);
  });

  it('returns empty for empty input', () => {
    expect(mapOrganizationsForMigration([])).toEqual([]);
    expect(mapOrganizationsForMigration(undefined)).toEqual([]);
  });
});
