#!/usr/bin/env node
/**
 * Attributes a leaked ARC manuscript to the reader it was served to.
 *
 * Usage:
 *   node scripts/detect-watermark.mjs leaked.txt
 *   pbpaste | node scripts/detect-watermark.mjs
 *   node scripts/detect-watermark.mjs leaked.txt --emails a@x.com,b@y.com
 *
 * Without --emails it reads the candidate list from the arcReaders collection,
 * so Firebase credentials must be present in .env.local (or the environment).
 *
 * The fingerprint is an HMAC of the reader's email, never stored anywhere, so
 * this recomputes it for each candidate and looks for the match.
 *
 * The encoding itself is imported straight from lib/watermark.ts rather than
 * reimplemented here. That matters more than it looks: if the two ever drifted,
 * this tool would quietly fail to match a genuine leak — and a forensics tool
 * that silently returns "no match" is worse than none at all. Importing a .ts
 * module needs Node 23.6+ (type stripping); the repo runs Node 24.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let readerFingerprint;
let extractFingerprint;

try {
  ({ readerFingerprint, extractFingerprint } = await import(
    resolve(REPO_ROOT, "lib/watermark.ts")
  ));
} catch (err) {
  console.error(
    "Couldn't load lib/watermark.ts. This needs Node 23.6+ for TypeScript " +
      `type stripping; you're on ${process.version}.\n\n${err.message}`,
  );
  process.exit(2);
}

/** Minimal .env.local reader — node scripts don't get Next's env loading. */
function loadEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    let raw;

    try {
      raw = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }

    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);

      if (!match) continue;

      const [, key, rest] = match;

      if (process.env[key]) continue;

      process.env[key] = rest
        .trim()
        .replace(/^["']|["']$/g, "")
        .replace(/\\n/g, "\n");
    }
  }
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

async function readerEmailsFromFirestore() {
  const { cert, initializeApp, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase credentials missing. Set FIREBASE_PROJECT_ID / " +
        "FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY, or pass --emails.",
    );
  }

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  const snapshot = await getFirestore().collection("arcReaders").get();
  return snapshot.docs.map((doc) => doc.id);
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const emailsFlag = args.indexOf("--emails");
  const explicitEmails =
    emailsFlag !== -1 && args[emailsFlag + 1]
      ? args[emailsFlag + 1]
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      : null;
  const filePath = args.find((a) => !a.startsWith("--") && a !== args[emailsFlag + 1]);

  const text = filePath ? readFileSync(resolve(filePath), "utf8") : readStdin();

  if (!text.trim()) {
    console.error("No input. Pass a file path or pipe text on stdin.");
    process.exit(2);
  }

  const { bits, tokenCount } = extractFingerprint(text);

  if (!bits) {
    console.log("No watermark found.");
    console.log(
      "The text may have been retyped, OCR'd from a screenshot, or run " +
        "through something that strips invisible characters.",
    );
    process.exit(1);
  }

  console.log(`Found ${tokenCount} token${tokenCount === 1 ? "" : "s"}.`);
  console.log(`Fingerprint: ${bits}`);

  const secret = (
    process.env.ARC_WATERMARK_SECRET ||
    process.env.ARC_SESSION_SECRET ||
    ""
  ).trim();

  if (!secret) {
    console.error(
      "\nNo ARC_WATERMARK_SECRET (or ARC_SESSION_SECRET) set — cannot match " +
        "the fingerprint to a reader.",
    );
    process.exit(2);
  }

  const candidates = explicitEmails ?? (await readerEmailsFromFirestore());

  if (!candidates.length) {
    console.error("\nNo candidate readers to check.");
    process.exit(2);
  }

  const matches = candidates.filter(
    (email) => readerFingerprint(email) === bits,
  );

  console.log(`Checked ${candidates.length} reader(s).`);

  if (matches.length === 0) {
    console.log(
      "\nNo match. The reader may have been deleted, or the watermark secret " +
        "has been rotated since this copy was served.",
    );
    process.exit(1);
  }

  console.log(`\nLeaked copy was served to: ${matches.join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
