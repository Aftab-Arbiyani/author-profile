import { createHash } from "crypto";
import { headers } from "next/headers";

/**
 * A stable, hashed identifier for the calling client, for per-address rate
 * limits (lib/login-throttle.ts, the ARC application throttle in lib/arc.ts).
 *
 * Hashed rather than stored raw because a throttle only ever needs equality, and
 * these documents would otherwise be the one place the site keeps a log of
 * visitor IP addresses.
 *
 * `x-forwarded-for` is client-controlled in the general case. Behind Vercel the
 * proxy appends the real address and the first entry is trustworthy; if the site
 * is ever fronted by something that doesn't, this degrades to "an attacker can
 * spread their attempts across buckets" — the same position as having no
 * per-address limit at all, never worse. When no address header is present the
 * caller falls into a single shared bucket, which errs toward throttling more
 * rather than less.
 */
export async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0].trim() ||
    headerList.get("x-real-ip")?.trim() ||
    "unknown";

  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
