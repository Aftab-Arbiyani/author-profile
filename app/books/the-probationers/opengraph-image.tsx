import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Node runtime so we can read the cover file off disk and inline it.
export const runtime = "nodejs";

export const alt =
  "The Probationers, a psychological mystery novel by Aftab Arbiyani";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dedicated 1200x630 share card for the book page. Shows the actual cover
 * beside the title, tagline, rating, and byline — so a shared link unfurls as
 * the book, not the generic author graphic. (The site's brand serif is only
 * available as woff2, which satori can't load, so this uses next/og's default
 * font.)
 */
export default function OgImage() {
  const cover = readFileSync(
    join(process.cwd(), "public", "the-probationers-cover.jpeg"),
  );
  const coverSrc = `data:image/jpeg;base64,${cover.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: 64,
          background: "linear-gradient(115deg, #161616 0%, #2b322b 100%)",
          color: "#f7f1e4",
        }}
      >
        { }
        <img
          src={coverSrc}
          width={318}
          height={508}
          style={{
            borderRadius: 8,
            objectFit: "cover",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              color: "#d4a84b",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            A Psychological Mystery
          </div>
          <div
            style={{
              fontSize: 86,
              fontWeight: 700,
              lineHeight: 1.02,
              marginTop: 18,
            }}
          >
            The Probationers
          </div>
          <div
            style={{
              fontSize: 31,
              color: "#cfc7b8",
              lineHeight: 1.35,
              marginTop: 26,
            }}
          >
            Six postulants. One snowbound abbey. A murder beneath the bell tower.
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 44,
              fontSize: 27,
            }}
          >
            <span style={{ color: "#d4a84b", letterSpacing: 3 }}>★★★★★</span>
            <span>Aftab Arbiyani</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
