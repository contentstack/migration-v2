import { describe, it, expect } from 'vitest';
import { shouldDisableCreateTestStack } from '../../../src/components/TestMigration';

/**
 * A project's test stack is created once and reused. The rule previously re-enabled the
 * button after a test migration succeeded, so each completed test run re-opened stack
 * creation — leaving a trail of "<project>-Test-1" stacks and eventually tripping
 * Contentstack's stack-creation rate limit (HTTP 429) part-way through a migration.
 */
describe('shouldDisableCreateTestStack', () => {
  it('is enabled for a fresh project with no test stack', () => {
    expect(shouldDisableCreateTestStack({ test_migration: {}, testStacks: [] })).toBe(false);
  });

  it('is disabled once a test stack has been created', () => {
    expect(
      shouldDisableCreateTestStack({ test_migration: { stack_api_key: 'blt123' }, testStacks: [] }),
    ).toBe(true);
  });

  it('is disabled when the project already records a test stack', () => {
    expect(
      shouldDisableCreateTestStack({
        test_migration: {},
        testStacks: [{ stackUid: 'blt123', isMigrated: false }],
      }),
    ).toBe(true);
  });

  it('stays disabled after the test migration has succeeded', () => {
    // The regression: a migrated test stack used to re-enable creation.
    expect(
      shouldDisableCreateTestStack({
        test_migration: { stack_api_key: 'blt123' },
        testStacks: [{ stackUid: 'blt123', isMigrated: true }],
      }),
    ).toBe(true);
  });

  it('is disabled while a test migration is running', () => {
    expect(
      shouldDisableCreateTestStack({ test_migration: { isMigrationStarted: true }, testStacks: [] }),
    ).toBe(true);
  });

  it('is disabled while the final migration is running', () => {
    expect(
      shouldDisableCreateTestStack({
        test_migration: {},
        testStacks: [],
        migration_execution: { migrationStarted: true },
      }),
    ).toBe(true);
  });

  it('is disabled once the final migration has completed', () => {
    expect(
      shouldDisableCreateTestStack({
        test_migration: {},
        testStacks: [],
        migration_execution: { migrationCompleted: true },
      }),
    ).toBe(true);
  });

  it('returns a boolean rather than a falsy value for undefined input', () => {
    // Feeds a `disabled` prop, so it must never be undefined.
    expect(shouldDisableCreateTestStack(undefined)).toBe(false);
  });
});
