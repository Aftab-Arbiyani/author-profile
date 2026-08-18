import { Timestamp } from "firebase-admin/firestore";
import { clientKey } from "@/lib/client-key";
import { getFirebaseDb } from "@/lib/firestore";

/**
 * Brute-force brake for the admin password.
 *
 * BLOG_ADMIN_SECRET is a single static string that is also the password, so
 * without a brake the login form is an unlimited online guessing oracle against
 * one value — and admin owns the whole manuscript, every reader's details, and
 * the EPUB import. Every other write path here is already throttled
 * (checkAndStampMagicLinkThrottle, checkAndStampReadThrottle); this closes the
 * one door that wasn't.
 *
 * Modelled on those helpers deliberately: same Firestore-doc shape, same
 * self-purging `purgeAt` field, same fail-open behaviour when Firebase is
 * unreachable. Failing open is the right call here because the password is still
 * required — a throttle outage must not lock the author out of their own site.
 */

/** Failed attempts allowed from one address before it's blocked. */
const MAX_ATTEMPTS = 5;
/** Attempts are counted within this rolling window. */
const WINDOW_MS = 15 * 60 * 1000;
/** How long an address stays blocked once it trips the limit. */
const BLOCK_MS = 15 * 60 * 1000;
/** How long a throttle doc stays useful after its last write. */
const PURGE_AFTER_MS = 60 * 60 * 1000;

/**
 * Minimum wall-clock cost of a failed attempt. Independent of the counter, so
 * even the first four guesses can't be sprayed at network speed, and rotating
 * IPs to dodge the counter still pays this per try.
 */
const FAILURE_DELAY_MS = 700;

type Doc = Record<string, unknown>;

/** Sleeps, to put a floor under the cost of a wrong password. */
export function failureDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
}

/**
 * Whether this address may attempt a password right now. Read-only — call
 * `recordFailedLogin` / `clearLoginAttempts` after the attempt resolves.
 */
export async function isLoginBlocked(): Promise<boolean> {
  const db = getFirebaseDb();

  if (!db) {
    return false;
  }

  try {
    const doc = await db
      .collection("adminLoginThrottle")
      .doc(await clientKey())
      .get();

    if (!doc.exists) {
      return false;
    }

    const blockedUntil = doc.data()?.blockedUntil;

    return (
      blockedUntil instanceof Timestamp && blockedUntil.toMillis() > Date.now()
    );
  } catch (err) {
    console.error("[isLoginBlocked]", err);
    return false;
  }
}

/**
 * Counts a wrong password against this address, blocking it once the window
 * fills. Returns true when this attempt was the one that tripped the block, so
 * the caller can say so rather than repeating "incorrect password".
 */
export async function recordFailedLogin(): Promise<boolean> {
  const db = getFirebaseDb();

  if (!db) {
    return false;
  }

  const ref = db.collection("adminLoginThrottle").doc(await clientKey());
  const now = Date.now();

  try {
    const doc = await ref.get();
    const data = doc.exists ? (doc.data() as Doc) : null;

    const windowStart =
      data?.windowStart instanceof Timestamp ? data.windowStart.toMillis() : 0;
    const attempts = typeof data?.attempts === "number" ? data.attempts : 0;
    const purgeAt = Timestamp.fromMillis(now + PURGE_AFTER_MS);

    // Window elapsed (or first ever failure): start counting again.
    if (!windowStart || now - windowStart > WINDOW_MS) {
      await ref.set({
        windowStart: Timestamp.fromMillis(now),
        attempts: 1,
        blockedUntil: null,
        updatedAt: Timestamp.now(),
        purgeAt,
      });

      return false;
    }

    const next = attempts + 1;

    if (next >= MAX_ATTEMPTS) {
      await ref.set({
        windowStart: Timestamp.fromMillis(now),
        attempts: next,
        blockedUntil: Timestamp.fromMillis(now + BLOCK_MS),
        updatedAt: Timestamp.now(),
        purgeAt,
      });

      return true;
    }

    await ref.set(
      {
        attempts: next,
        updatedAt: Timestamp.now(),
        purgeAt,
      },
      { merge: true },
    );

    return false;
  } catch (err) {
    console.error("[recordFailedLogin]", err);
    return false;
  }
}

/** Clears the counter after a correct password. */
export async function clearLoginAttempts(): Promise<void> {
  const db = getFirebaseDb();

  if (!db) {
    return;
  }

  try {
    await db
      .collection("adminLoginThrottle")
      .doc(await clientKey())
      .delete();
  } catch (err) {
    console.error("[clearLoginAttempts]", err);
  }
}
