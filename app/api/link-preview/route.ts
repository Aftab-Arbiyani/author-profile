import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(rawUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    return NextResponse.json({
      url: rawUrl,
      title: ogMeta(html, "og:title") || titleTag(html) || parsed.hostname,
      description: ogMeta(html, "og:description") || metaName(html, "description") || "",
      image: resolveUrl(ogMeta(html, "og:image"), rawUrl),
      siteName: ogMeta(html, "og:site_name") || parsed.hostname,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

function ogMeta(html: string, property: string): string {
  const a = html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"));
  return (a?.[1] ?? b?.[1] ?? "").trim();
}

function metaName(html: string, name: string): string {
  const a = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"));
  return (a?.[1] ?? b?.[1] ?? "").trim();
}

function titleTag(html: string): string {
  return (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
}

function resolveUrl(src: string, base: string): string {
  if (!src) return "";
  try {
    return new URL(src, base).href;
  } catch {
    return "";
  }
}
