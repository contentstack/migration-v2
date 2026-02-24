#!/usr/bin/env node

/**
 * One-time script to encrypt sensitive fields in manifest.json.
 *
 * Usage:
 *   MANIFEST_ENCRYPT_KEY=<your-secret-key> node encrypt-manifest.js
 *
 * This will overwrite manifest.json with encrypted uid, client_id, and client_secret.
 * Run once, then commit the encrypted manifest.json.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";
const ENCRYPT_KEY = process.env.MANIFEST_ENCRYPT_KEY;
const ENCRYPT_SALT = process.env.MANIFEST_ENCRYPT_SALT;

if (!ENCRYPT_KEY || !ENCRYPT_SALT) {
  console.error("Error: MANIFEST_ENCRYPT_KEY and MANIFEST_ENCRYPT_SALT environment variables are required.");
  console.error("Usage: MANIFEST_ENCRYPT_KEY=<key> MANIFEST_ENCRYPT_SALT=<salt> node encrypt-manifest.js");
  process.exit(1);
}

function encrypt(plaintext) {
  const key = crypto.scryptSync(ENCRYPT_KEY, ENCRYPT_SALT, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${ENC_PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
}

const manifestPath = path.join(__dirname, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

let changed = false;

if (manifest.uid && !manifest.uid.startsWith(ENC_PREFIX)) {
  console.log(`Encrypting uid: ${manifest.uid.substring(0, 8)}...`);
  manifest.uid = encrypt(manifest.uid);
  changed = true;
}

if (manifest.oauth?.client_id && !manifest.oauth.client_id.startsWith(ENC_PREFIX)) {
  console.log(`Encrypting oauth.client_id: ${manifest.oauth.client_id.substring(0, 8)}...`);
  manifest.oauth.client_id = encrypt(manifest.oauth.client_id);
  changed = true;
}

if (manifest.oauth?.client_secret && !manifest.oauth.client_secret.startsWith(ENC_PREFIX)) {
  console.log(`Encrypting oauth.client_secret: ${manifest.oauth.client_secret.substring(0, 8)}...`);
  manifest.oauth.client_secret = encrypt(manifest.oauth.client_secret);
  changed = true;
}

if (!changed) {
  console.log("All sensitive fields are already encrypted. Nothing to do.");
  process.exit(0);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n");
console.log("\nmanifest.json updated with encrypted values.");
console.log("Make sure to store MANIFEST_ENCRYPT_KEY securely (e.g. in your .env file).");
