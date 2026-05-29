import fs from "fs";
import path from "path";

/**
 * Resolves the Contentstack app manifest path (decrypted app.json).
 * Order: APP_CONFIG_PATH env → ./app.json next to cwd (Docker mount) → ../app.json (local monorepo).
 */
export function getAppJsonPath(): string {
  const fromEnv = process.env.APP_CONFIG_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const nextToCwd = path.join(process.cwd(), "app.json");
  if (fs.existsSync(nextToCwd)) {
    return nextToCwd;
  }
  return path.join(process.cwd(), "..", "app.json");
}
