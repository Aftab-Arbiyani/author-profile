import { headers } from "next/headers";
import { COUNTRY_TO_STORE, DEFAULT_STORE_CODE } from "@/lib/amazon";

/**
 * Reads the visitor's country from Vercel's edge geo header and returns the
 * best-matching Amazon store code. Falls back to the US store when the header
 * is absent (local dev, non-Vercel hosts) or the country is unmapped.
 *
 * Lives in its own server-only module so the client `BuyOnAmazon` component
 * can import the marketplace data from `lib/amazon` without pulling
 * `next/headers` into the browser bundle.
 */
export async function detectStoreCode(): Promise<string> {
  const country = (await headers()).get("x-vercel-ip-country")?.toUpperCase();
  if (!country) return DEFAULT_STORE_CODE;
  return COUNTRY_TO_STORE[country] ?? DEFAULT_STORE_CODE;
}
