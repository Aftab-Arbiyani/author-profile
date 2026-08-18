import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/admin-auth";
import { BrandMark } from "@/components/BrandMark";
import { getAllBlogPosts, getFirebaseDb } from "@/lib/firestore";
import {
  getAllApplications,
  getAllArcReaders,
  getAllArcReviews,
  getArcBooks,
} from "@/lib/arc";
import { hasArcAuthConfig } from "@/lib/arc-auth";
import { hasEmailConfig } from "@/lib/email";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const firebaseReady = getFirebaseDb() !== null;

  // Every getter below swallows a missing-config or failed read into `[]`, so
  // the counts read as 0 rather than erroring when Firebase isn't wired up.
  // The setup notes at the foot of the page are what separate "nothing yet"
  // from "nothing configured".
  const [posts, applications, readers, reviews, books] = await Promise.all([
    getAllBlogPosts(),
    getAllApplications(),
    getAllArcReaders(),
    getAllArcReviews(),
    getArcBooks(),
  ]);

  const drafts = posts.filter((post) => !post.published).length;
  const published = posts.length - drafts;

  const pendingApplications = applications.filter(
    (application) => application.status === "pending",
  ).length;
  const activeReaders = readers.filter(
    (reader) => reader.status === "active",
  ).length;
  const pendingReviews = reviews.filter(
    (review) => review.status === "pending",
  ).length;
  const openBooks = books.filter((book) => book.status === "open").length;

  const setup: { label: string; detail: string }[] = [];
  if (!firebaseReady) {
    setup.push({
      label: "Firebase",
      detail:
        "FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY are not set — every count below is 0 and nothing can be saved.",
    });
  }
  if (!hasArcAuthConfig()) {
    setup.push({
      label: "ARC_SESSION_SECRET",
      detail:
        "Not set — approved readers cannot sign in or open the library, even though applications still record.",
    });
  }
  if (!hasEmailConfig()) {
    setup.push({
      label: "RESEND_API_KEY",
      detail:
        "Not set — approval emails and magic links are never sent. Copy sign-in links manually from the Readers page.",
    });
  }

  return (
    <main className="mEditorPage">
      <form
        id="adminLogoutForm"
        action={logoutAction}
        aria-hidden
        style={{ display: "none" }}
      />

      <header className="mTopBar">
        <div className="mTopBarLeft">
          <BrandMark size={32} className="mTopBarAvatar" />
          <span className="mTopBarDraft">Admin</span>
        </div>
        <div className="mTopBarRight">
          <Link href="/" className="mTopBarSignOut">
            View site
          </Link>
          <button
            type="submit"
            form="adminLogoutForm"
            className="mTopBarSignOut"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mAdminHub">
        <h1 className="mAdminHubTitle">Welcome back</h1>
        <p className="mAdminHubSub">
          Everything you run from here — the journal and the ARC reader
          programme.
        </p>

        <div className="mAdminHubGrid">
          <section className="mAdminCard">
            <div className="mAdminCardHead">
              <h2 className="mAdminCardTitle">Blog</h2>
              <Link href="/admin/blog" className="mAdminCardLink">
                All posts →
              </Link>
            </div>

            <div className="mAdminStats">
              <Stat
                href="/admin/blog"
                value={published}
                label={published === 1 ? "Published post" : "Published posts"}
              />
              <Stat
                href="/admin/blog"
                value={drafts}
                label={drafts === 1 ? "Draft" : "Drafts"}
                alert={drafts > 0}
              />
            </div>

            <div className="mAdminCardActions">
              <Link href="/admin/blog/new" className="mAdminCta">
                New post
              </Link>
            </div>
          </section>

          <section className="mAdminCard">
            <div className="mAdminCardHead">
              <h2 className="mAdminCardTitle">ARC readers</h2>
              <Link href="/admin/arc" className="mAdminCardLink">
                Open ARC →
              </Link>
            </div>

            <div className="mAdminStats">
              <Stat
                href="/admin/arc"
                value={pendingApplications}
                label={
                  pendingApplications === 1
                    ? "Application waiting"
                    : "Applications waiting"
                }
                alert={pendingApplications > 0}
              />
              <Stat
                href="/admin/arc/reviews"
                value={pendingReviews}
                label={
                  pendingReviews === 1 ? "Review to read" : "Reviews to read"
                }
                alert={pendingReviews > 0}
              />
              <Stat
                href="/admin/arc/readers"
                value={activeReaders}
                label={activeReaders === 1 ? "Active reader" : "Active readers"}
              />
              <Stat
                href="/admin/arc/books"
                value={openBooks}
                label={openBooks === 1 ? "Open book" : "Open books"}
              />
            </div>

            <div className="mAdminCardActions">
              <Link href="/admin/arc/books" className="mAdminCta">
                Manage books
              </Link>
              <Link href="/arc" className="mAdminCardLink">
                View the ARC page ↗
              </Link>
            </div>
          </section>
        </div>

        {setup.length > 0 && (
          <section className="mAdminSetup">
            <h2 className="mAdminSetupTitle">Setup</h2>
            <ul className="mAdminSetupList">
              {setup.map((note) => (
                <li key={note.label}>
                  <code>{note.label}</code>
                  <span>{note.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({
  href,
  value,
  label,
  alert,
}: {
  href: string;
  value: number;
  label: string;
  alert?: boolean;
}) {
  return (
    <Link href={href} className={`mAdminStat${alert ? " isAlert" : ""}`}>
      <span className="mAdminStatValue">{value}</span>
      <span className="mAdminStatLabel">{label}</span>
    </Link>
  );
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}
