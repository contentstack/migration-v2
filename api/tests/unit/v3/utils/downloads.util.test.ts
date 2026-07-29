import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — v3 downloads.util. Saves a REAL export bundle Buffer to the user's
 * actual Downloads folder (this is a local dev tool: the backend and the
 * browser run on the same machine, so a direct filesystem write is the
 * genuine "save it to my Downloads" behavior being asked for). Directory is
 * V3_DOWNLOADS_DIR-overridable so tests never touch the real ~/Downloads.
 */
import { saveBundleToDownloads, downloadsDir } from "../../../../v3/utils/downloads.util.js";

const TMP = path.join(os.tmpdir(), `v3-downloads-test-${process.pid}`);

beforeEach(() => {
  vi.stubEnv("V3_DOWNLOADS_DIR", TMP);
  fs.rmSync(TMP, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("v3 downloads.util", () => {
  it("(positive) writes the buffer to the configured downloads directory and returns the full path", () => {
    const buf = Buffer.from("zip-bytes");
    const filePath = saveBundleToDownloads(buf, "my-export.zip");

    expect(filePath).toBe(path.join(TMP, "my-export.zip"));
    expect(fs.readFileSync(filePath)).toEqual(buf);
  });

  // Negative — taxonomy #1 (missing target): the directory doesn't exist yet
  // (first export ever run) — must be created, not throw ENOENT.
  it("(negative) creates the downloads directory if it does not already exist", () => {
    expect(fs.existsSync(TMP)).toBe(false);
    saveBundleToDownloads(Buffer.from("x"), "a.zip");
    expect(fs.existsSync(TMP)).toBe(true);
  });

  it("(positive) downloadsDir defaults to the real OS Downloads folder when V3_DOWNLOADS_DIR is unset", () => {
    vi.unstubAllEnvs();
    expect(downloadsDir()).toBe(path.join(os.homedir(), "Downloads"));
  });
});
