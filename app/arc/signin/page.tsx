import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArcSigninForm } from "@/components/ArcSigninForm";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { requireActiveReader } from "@/lib/arc-auth";

export const metadata: Metadata = {
  title: "ARC Reader Sign In",
  robots: { index: false, follow: false },
};

export default async function ArcSigninPage() {
  // Already signed in — skip straight to the library.
  if (await requireActiveReader()) redirect("/arc/library");

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
          <h1 className="arcAuthTitle">Sign in to your library</h1>
          <ArcSigninForm />
          <p className="arcAuthFoot">
            Not an ARC reader yet?{" "}
            <Link className="textLink" href="/arc">
              Apply to join the team →
            </Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
