import { describe, it, expect } from 'vitest';
import { getFieldDisplayName, getFieldTooltip } from './index';

/**
 * Regression: a source column repurposed as title (e.g. SAP's "name") kept showing its
 * original source label in the Map Content Fields row header, even though its UID had
 * already been repointed to Contentstack's "title" and its rules (mandatory, locked type)
 * applied. Confirmed live and via QA feedback that the row header itself must read "title"
 * too, not just the "UID: title" line underneath it — the source name is kept in the
 * tooltip instead, so the mapping stays traceable without confusing the row's own identity.
 */
describe('getFieldDisplayName', () => {
  it('shows "title" for a field repointed to the title uid, regardless of its source column name', () => {
    expect(getFieldDisplayName({ contentstackFieldUid: 'title', otherCmsField: 'name' })).toBe('title');
    expect(getFieldDisplayName({ contentstackFieldUid: 'title', otherCmsField: 'label' })).toBe('title');
    expect(getFieldDisplayName({ contentstackFieldUid: 'title', otherCmsField: 'heading' })).toBe('title');
  });

  it('shows the raw source column name for a non-title field', () => {
    expect(getFieldDisplayName({ contentstackFieldUid: 'active', otherCmsField: 'active' })).toBe('active');
  });

  it('still strips parent-hierarchy prefixes for a non-title field', () => {
    expect(getFieldDisplayName({ contentstackFieldUid: 'parent.child', otherCmsField: 'Parent > Child' })).toBe('Child');
  });
});

describe('getFieldTooltip', () => {
  it('names the original source column for a repurposed title field', () => {
    expect(getFieldTooltip({ contentstackFieldUid: 'title', otherCmsField: 'name' })).toBe('Field: title \nSource: name');
  });

  it('shows the plain field name for a non-title field with no hierarchy', () => {
    expect(getFieldTooltip({ contentstackFieldUid: 'active', otherCmsField: 'active' })).toBe('Field: active');
  });

  it('shows the full path for a non-title nested field', () => {
    expect(getFieldTooltip({ contentstackFieldUid: 'parent.child', otherCmsField: 'Parent > Child' })).toBe(
      'Field: Child \nFull path: Parent > Child'
    );
  });
});
