import { describe, it, expect } from 'vitest';
import {
  shouldAddGroupOption,
  shouldRecurseIntoNestedDestGroup,
  findGroupFieldInChildren,
} from '../groupSchema.utils';
import type { FieldMapType, ExistingFieldType, ContentTypesSchema } from '../contentMapper.interface';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeField(uid: string, backupFieldUid: string): FieldMapType {
  return {
    uid,
    backupFieldUid,
    id: uid,
    contentstackFieldType: 'group',
    backupFieldType: 'group',
    contentstackField: '',
    contentstackFieldUid: uid,
    isDeleted: false,
    otherCmsField: '',
    otherCmsType: '',
    contentstackUid: '',
    refrenceTo: [],
    initialRefrenceTo: [],
  };
}

function makeMappedField(label: string): { label: string; value: ContentTypesSchema } {
  return { label, value: { display_name: label, display_type: '' } };
}

// ---------------------------------------------------------------------------
// shouldAddGroupOption
// ---------------------------------------------------------------------------
//
// This function enforces equal nesting depth between source and destination
// group fields. A root source group may only be mapped to a root dest group,
// and a nested source group may only be mapped to a nested dest group.
//
// Source nesting is determined by whether data.uid contains a dot.
// Dest nesting is determined by whether parentUid (set during recursion) is
// non-empty.
// ---------------------------------------------------------------------------

describe('shouldAddGroupOption', () => {
  describe('root source group (no dot in uid)', () => {
    it('returns true when destination is also root-level (no parentUid)', () => {
      expect(shouldAddGroupOption('navigation', '')).toBe(true);
    });

    it('returns false when destination is nested (parentUid is set)', () => {
      expect(shouldAddGroupOption('navigation', 'dest_parent_uid')).toBe(false);
    });
  });

  describe('nested source group (dot in uid)', () => {
    it('returns false when destination is root-level (no parentUid)', () => {
      expect(shouldAddGroupOption('navigation.children', '')).toBe(false);
    });

    it('returns true when destination is also nested (parentUid is set)', () => {
      expect(shouldAddGroupOption('navigation.children', 'dest_parent_uid')).toBe(true);
    });
  });

  describe('deeply nested source group (multiple dots in uid)', () => {
    it('returns false when destination is root-level', () => {
      expect(shouldAddGroupOption('nav.children.sub', '')).toBe(false);
    });

    it('returns true when destination is also nested', () => {
      expect(shouldAddGroupOption('nav.children.sub', 'some_parent')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns true for empty uid (treated as root) with empty parentUid', () => {
      expect(shouldAddGroupOption('', '')).toBe(true);
    });

    it('returns false for empty uid with a non-empty parentUid', () => {
      expect(shouldAddGroupOption('', 'some_parent')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// shouldRecurseIntoNestedDestGroup
// ---------------------------------------------------------------------------
//
// Controls whether processSchema recurses into a destination group while
// building options for a source group field.
//
// Root source groups: always recurse (they explore the dest tree to surface
//   nested groups for their own children; the nesting-depth guard in
//   shouldAddGroupOption prevents wrong-level options from being added).
//
// Nested source groups: only recurse when the immediate parent source group
//   has been mapped AND its mapped destination label equals the current
//   destination group display name (updatedDisplayName).
// ---------------------------------------------------------------------------

describe('shouldRecurseIntoNestedDestGroup', () => {
  // -------------------------------------------------------------------------
  // Root-level source groups
  // -------------------------------------------------------------------------
  describe('root-level source group (uid has no dot)', () => {
    it('always returns true — regardless of mapping state', () => {
      expect(
        shouldRecurseIntoNestedDestGroup('navigation', 'Dest Navigation', [], {}),
      ).toBe(true);
    });

    it('returns true even when nestedList and existingField are empty', () => {
      expect(shouldRecurseIntoNestedDestGroup('hero', 'Hero Block', [], {})).toBe(true);
    });

    it('returns true for a single-segment uid with no dots', () => {
      expect(
        shouldRecurseIntoNestedDestGroup('footer', 'Footer Group', [], {}),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Nested source groups — parent NOT yet mapped
  // -------------------------------------------------------------------------
  describe('nested source group — parent NOT mapped', () => {
    it('returns false when nestedList is empty (parent node not found)', () => {
      expect(
        shouldRecurseIntoNestedDestGroup('navigation.children', 'Dest Navigation', [], {}),
      ).toBe(false);
    });

    it('returns false when parent node is in nestedList but has no entry in existingField', () => {
      const nestedList = [makeField('navigation', 'nav_backup_uid')];
      const existingField: ExistingFieldType = {};

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });

    it('returns false when parent node exists but backupFieldUid is empty string', () => {
      const nestedList = [makeField('navigation', '')]; // no backupFieldUid
      const existingField: ExistingFieldType = {};

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });

    it('returns false when parent is mapped with an empty label', () => {
      const nestedList = [makeField('navigation', 'nav_backup_uid')];
      const existingField: ExistingFieldType = {
        nav_backup_uid: makeMappedField(''),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Nested source groups — parent IS mapped
  // -------------------------------------------------------------------------
  describe('nested source group — parent IS mapped', () => {
    it('returns true when parent mapped label matches the current dest group display name', () => {
      const nestedList = [makeField('navigation', 'nav_backup_uid')];
      const existingField: ExistingFieldType = {
        nav_backup_uid: makeMappedField('Dest Navigation'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(true);
    });

    it('returns false when parent is mapped but to a DIFFERENT dest group', () => {
      const nestedList = [makeField('navigation', 'nav_backup_uid')];
      const existingField: ExistingFieldType = {
        nav_backup_uid: makeMappedField('Some Other Group'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });

    it('correctly targets the matching parent among multiple nestedList entries', () => {
      // generateSourceGroupSchema flattens nested groups as root-level entries,
      // so nestedList may contain both 'navigation' and 'navigation.children'
      // as siblings at the top level.
      const nestedList = [
        makeField('title', 'title_backup'),
        makeField('navigation', 'nav_backup_uid'),
        makeField('navigation.children', 'children_backup'), // sibling root entry
        makeField('footer', 'footer_backup'),
      ];
      const existingField: ExistingFieldType = {
        nav_backup_uid: makeMappedField('CS Navigation Group'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'CS Navigation Group',
          nestedList,
          existingField,
        ),
      ).toBe(true);
    });

    it('does NOT recurse when the label matches a different sibling field (not the parent)', () => {
      const nestedList = [
        makeField('navigation', 'nav_backup_uid'),
        makeField('footer', 'footer_backup_uid'),
      ];
      const existingField: ExistingFieldType = {
        // footer is mapped to 'Dest Navigation', but it is not navigation's parent
        footer_backup_uid: makeMappedField('Dest Navigation'),
        nav_backup_uid: makeMappedField('Some Other Label'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Deeper nesting (grandchild groups)
  // -------------------------------------------------------------------------
  describe('deeply nested source group (3+ uid segments)', () => {
    it('uses the immediate parent uid (not the root ancestor) for the mapping check', () => {
      // navigation.children.sub → immediate parent = navigation.children
      const nestedList = [
        makeField('navigation', 'nav_backup'),
        makeField('navigation.children', 'children_backup'),
      ];
      const existingField: ExistingFieldType = {
        children_backup: makeMappedField('CS Children Group'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children.sub',
          'CS Children Group',
          nestedList,
          existingField,
        ),
      ).toBe(true);
    });

    it('returns false when the immediate parent (not the root) is not mapped', () => {
      const nestedList = [
        makeField('navigation', 'nav_backup'),
        makeField('navigation.children', 'children_backup'),
      ];
      const existingField: ExistingFieldType = {
        // navigation IS mapped, but navigation.children is NOT
        nav_backup: makeMappedField('CS Navigation'),
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children.sub',
          'CS Children Group',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty string dataUid gracefully (treated as root → always recurse)', () => {
      expect(
        shouldRecurseIntoNestedDestGroup('', 'Some Group', [], {}),
      ).toBe(true);
    });

    it('handles undefined-like values in existingField gracefully', () => {
      const nestedList = [makeField('navigation', 'nav_backup_uid')];
      const existingField: ExistingFieldType = {
        nav_backup_uid: undefined,
      };

      expect(
        shouldRecurseIntoNestedDestGroup(
          'navigation.children',
          'Dest Navigation',
          nestedList,
          existingField,
        ),
      ).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// findGroupFieldInChildren
// ---------------------------------------------------------------------------

describe('findGroupFieldInChildren', () => {
  it('returns a group at the first level of children', () => {
    const inner: FieldMapType = {
      ...makeField('mb.quote.details', 'd_b'),
      contentstackFieldType: 'group',
    };
    const children: FieldMapType[] = [inner];
    expect(findGroupFieldInChildren(children, 'mb.quote.details')).toBe(inner);
  });

  it('finds a nested group when it is not a direct child', () => {
    const details: FieldMapType = {
      ...makeField('mb.quote.details', 'd_b'),
      contentstackFieldType: 'group',
      child: [],
    };
    const quoteWrap: FieldMapType = {
      ...makeField('mb.quote', 'q_b'),
      contentstackFieldType: 'group',
      child: [details],
    };
    const children = [quoteWrap];
    expect(findGroupFieldInChildren(children, 'mb.quote.details')).toBe(details);
  });

  it('returns undefined when uid does not exist', () => {
    expect(findGroupFieldInChildren([], 'x')).toBeUndefined();
    expect(findGroupFieldInChildren(undefined, 'x')).toBeUndefined();
  });

  it('does not match non-group fields with the same uid', () => {
    const leaf: FieldMapType = {
      ...makeField('mb.quote.paragraph', 'p_b'),
      contentstackFieldType: 'json',
    };
    expect(findGroupFieldInChildren([leaf], 'mb.quote.paragraph')).toBeUndefined();
  });
});
