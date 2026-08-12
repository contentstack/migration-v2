import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Source Export Revamp — Impact 7, the CLI-presence check.
 *
 * Without this, a missing CLI surfaces as whatever `npx --no-install csdx` happens
 * to print — an opaque spawn failure that says nothing about the cause or the fix.
 * The export depends on a binary in this package's own `node_modules`, so "run npm
 * install" is a complete and actionable answer; the operator should not have to
 * infer it from a non-zero exit code.
 *
 * `fs` is mocked because the subject IS the filesystem probe. The real CLI is
 * installed here, so an unmocked test could only ever exercise the happy path — the
 * absent case is the one that matters.
 */
const { mockExistsSync } = vi.hoisted(() => ({ mockExistsSync: vi.fn() }));
vi.mock("fs", () => {
  const api = { existsSync: mockExistsSync };
  return { default: api, ...api };
});

import {
  isCliInstalled,
  assertCliAvailable,
  cliBinPath,
} from "../../../../v3/utils/cliPresence.util.js";

beforeEach(() => {
  mockExistsSync.mockReset();
});

describe("v3 CLI presence", () => {
  it("reports the CLI as installed when its executable is on disk", () => {
    mockExistsSync.mockReturnValue(true);

    expect(isCliInstalled()).toBe(true);
  });

  // Negative — taxonomy #6 (dependency failure): the whole point of the check.
  it("reports the CLI as missing when its executable is absent", () => {
    mockExistsSync.mockReturnValue(false);

    expect(isCliInstalled()).toBe(false);
  });

  it("passes silently when the CLI is present", () => {
    mockExistsSync.mockReturnValue(true);

    expect(() => assertCliAvailable()).not.toThrow();
  });

  /*
    The message has to carry the FIX, not just the fact. "csdx not found" leaves the
    reader guessing whether to install it globally, add it to the repo, or change a
    path — when the actual answer is always `npm install` in this package, because
    the export runs the CLI from this package's own node_modules.
  */
  it("throws a message naming the fix when the CLI is missing", () => {
    mockExistsSync.mockReturnValue(false);

    expect(() => assertCliAvailable()).toThrow(/npm install/i);
    expect(() => assertCliAvailable()).toThrow(/Contentstack CLI/i);
  });

  /*
    Negative — the path probed must be the one actually executed. A check pointing
    somewhere else would pass while the spawn fails, or fail while the spawn works:
    a check that can disagree with reality is worse than none, because it is
    believed.
  */
  it("probes the same local executable the export spawns", () => {
    mockExistsSync.mockReturnValue(true);
    isCliInstalled();

    const probed = mockExistsSync.mock.calls[0][0] as string;
    expect(probed).toBe(cliBinPath());
    expect(probed).toContain("node_modules");
    expect(probed).toContain("csdx");
  });
});
