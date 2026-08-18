import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAdmin } from "@/lib/admin-auth";
import { BrandMark } from "@/components/BrandMark";

type ArcAdminSection = "applications" | "readers" | "books" | "reviews";

const TABS: { key: ArcAdminSection; label: string; href: string }[] = [
  { key: "applications", label: "Applications", href: "/admin/arc" },
  { key: "readers", label: "Readers", href: "/admin/arc/readers" },
  { key: "books", label: "Books", href: "/admin/arc/books" },
  { key: "reviews", label: "Reviews", href: "/admin/arc/reviews" },
];

/**
 * Shared top bar for the /admin/arc pages. Mirrors the blog admin's mTopBar
 * layout, including the hidden-logout-form trick (a submit button outside a
 * <form> referencing it by id) so the sign-out control can live in the bar
 * without nesting forms.
 */
export function ArcAdminBar({
  current,
  error,
  notice,
}: {
  current: ArcAdminSection;
  error?: string;
  notice?: string;
}) {
  return (
    <>
      <form
        id="arcLogoutForm"
        action={logoutAction}
        aria-hidden
        style={{ display: "none" }}
      />

      <header className="mTopBar mTopBarArc">
        <Link href="/admin" className="mTopBarLeft mTopBarHome">
          <BrandMark size={32} className="mTopBarAvatar" />
          <span className="mTopBarDraft">ARC</span>
        </Link>

        {error && <p className="mTopBarError">{error}</p>}
        {!error && notice && <p className="mArcNotice">{notice}</p>}

        {/* Tabs sit outside .mTopBarRight so that on a phone the bar can wrap
            into two rows — brand + sign-out, then the full-width tab row. */}
        <nav className="mArcTabs" aria-label="ARC admin">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`mArcTab${tab.key === current ? " isActive" : ""}`}
              aria-current={tab.key === current ? "page" : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="mTopBarRight">
          <button type="submit" form="arcLogoutForm" className="mTopBarSignOut">
            Sign out
          </button>
        </div>
      </header>
    </>
  );
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}
