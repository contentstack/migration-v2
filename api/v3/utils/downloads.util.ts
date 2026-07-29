import fs from "fs";
import os from "os";
import path from "path";

/**
 * Saves the real export bundle to the user's Downloads folder. v3 is a local
 * dev tool where the backend and the browser run on the same machine, so a
 * direct filesystem write IS the genuine "save it to my Downloads" outcome —
 * not a browser download. V3_DOWNLOADS_DIR overrides the target dir for tests.
 */
export const downloadsDir = (): string =>
  process.env.V3_DOWNLOADS_DIR
    ? path.resolve(process.env.V3_DOWNLOADS_DIR)
    : path.join(os.homedir(), "Downloads");

export const saveBundleToDownloads = (buffer: Buffer, fileName: string): string => {
  const dir = downloadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};
