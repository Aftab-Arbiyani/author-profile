import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { loginArcReader } from "@/lib/arc-auth";
import { redeemMagicLinkToken } from "@/lib/arc";

type Props = {
  searchParams: Promise<{ token?: string; status?: string }>;
};

export const metadata: Metadata = {
  title: "Confirm ARC Sign In",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  expired: "That sign-in link has expired. Links are valid for 15 minutes.",
  used: "That sign-in link has already been used. Request a fresh one.",
  invalid: "That sign-in link isn't valid. Request a fresh one.",
  revoked: "That account is no longer active. Get in touch if this is a mistake.",
  "missing-config": "Sign-in isn't available right now. Please try again later.",
};

/**
 * Magic-link confirmation. Redemption happens in the POST action below, never
 * on GET: corporate mail scanners and link previewers fetch URLs from email
 * bodies, and a single-use token consumed by a scanner would leave the real
 * reader locked out.
 */
export default async function ArcVerifyPage({ searchParams }: Props) {
  const { token, status } = await searchParams;
  const error = status ? MESSAGES[status] : undefined;

  return (
    <main>
      <section className="arcAuthPage">
        <nav className="arcAuthNav" aria-label="Primary">
          <Link className="arcAuthBrand" href="/">
            <BrandMark size={26} />
            Aftab Arbiyani
          </Link>
        </nav>

        <div className="arcAuthCard">
          <p className="eyebrow">ARC readers</p>

          {error ? (
            <>
              <h1 className="arcAuthTitle">Link didn&apos;t work</h1>
              <p className="arcAuthBody">{error}</p>
              <p className="arcAuthFoot">
                <Link className="textLink" href="/arc/signin">
                  Request a new sign-in link →
                </Link>
              </p>
            </>
          ) : !token ? (
            <>
              <h1 className="arcAuthTitle">Nothing to confirm</h1>
              <p className="arcAuthBody">
                This page confirms a sign-in link sent to your email.
              </p>
              <p className="arcAuthFoot">
                <Link className="textLink" href="/arc/signin">
                  Request a sign-in link →
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="arcAuthTitle">You&apos;re nearly in</h1>
              <p className="arcAuthBody">
                Confirm below to open your ARC library on this device. This link
                works once.
              </p>
              <form action={redeemAction} className="arcAuthForm">
                <input type="hidden" name="token" value={token} />
                <button type="submit" className="arcApplyButton">
                  Continue to my library
                </button>
              </form>
            </>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

async function redeemAction(formData: FormData) {
  "use server";

  const token = String(formData.get("token") ?? "");

  if (!token) redirect("/arc/verify?status=invalid");

  const result = await redeemMagicLinkToken(token);

  if (result.status !== "ok") {
    redirect(`/arc/verify?status=${result.status}`);
  }

  const signedIn = await loginArcReader(result.email);

  if (!signedIn) {
    // ARC_SESSION_SECRET missing — the token is already spent, so say so
    // plainly rather than silently failing to a signed-out library.
    redirect("/arc/verify?status=missing-config");
  }

  redirect("/arc/library");
}
