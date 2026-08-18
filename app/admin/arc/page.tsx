import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import {
  decideApplication,
  getAllApplications,
  getArcBooks,
  upsertArcReader,
  type ArcApplication,
} from "@/lib/arc";
import { sendApplicationApprovedEmail } from "@/lib/email";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "ARC Applications | Admin",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  "missing-config": "Firebase is not configured — nothing was saved.",
  failed: "That action failed. Check the server logs and try again.",
};

const NOTICES: Record<string, string> = {
  approved: "Reader approved. Approval email sent if Resend is configured.",
  rejected: "Application rejected.",
};

export default async function AdminArcApplicationsPage({ searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { status } = await searchParams;
  const [applications, books] = await Promise.all([
    getAllApplications(),
    getArcBooks(),
  ]);

  const pending = applications.filter((a) => a.status === "pending");
  const decided = applications.filter((a) => a.status !== "pending");
  const openBooks = books.filter((b) => b.status === "open");

  return (
    <main className="mEditorPage">
      <ArcAdminBar
        current="applications"
        error={status ? ERRORS[status] : undefined}
        notice={status ? NOTICES[status] : undefined}
      />

      <div className="mPostList">
        {applications.length === 0 && (
          <div className="mPostListEmpty">
            <p>
              No applications yet. Share{" "}
              <Link href="/arc">the ARC landing page</Link> to start collecting
              them.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="mPostListHeading">Pending · {pending.length}</h2>
            <ul className="mPostListItems">
              {pending.map((application) => (
                <li className="mPostListItem" key={application.email}>
                  <ApplicationSummary application={application} />

                  <form action={decideAction} className="mArcActions">
                    <input
                      type="hidden"
                      name="email"
                      value={application.email}
                    />
                    <input type="hidden" name="name" value={application.name} />

                    {openBooks.length > 0 ? (
                      <fieldset className="mArcFieldset">
                        <legend>Give access to</legend>
                        {openBooks.map((book) => (
                          <label className="mArcCheck" key={book.slug}>
                            <input
                              type="checkbox"
                              name="bookSlugs"
                              value={book.slug}
                            />
                            <span>{book.title}</span>
                          </label>
                        ))}
                      </fieldset>
                    ) : (
                      <p className="mArcHint">
                        No open books yet —{" "}
                        <Link href="/admin/arc/books">add one</Link> to assign
                        reading. You can still approve now and assign later.
                      </p>
                    )}

                    <div className="mArcButtons">
                      <button
                        name="intent"
                        value="approved"
                        type="submit"
                        className="mBtnPublish"
                      >
                        Approve
                      </button>
                      <button
                        name="intent"
                        value="rejected"
                        type="submit"
                        className="mBtnDraft"
                      >
                        Reject
                      </button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {decided.length > 0 && (
          <section>
            <h2 className="mPostListHeading">Decided</h2>
            <ul className="mPostListItems">
              {decided.map((application) => (
                <li className="mPostListItem" key={application.email}>
                  <ApplicationSummary application={application} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function ApplicationSummary({ application }: { application: ArcApplication }) {
  return (
    <>
      <div className="mPostListMeta">
        <span
          className={`arcStatusBadge arcStatus${cap(application.status)}`}
        >
          {application.status}
        </span>
        {application.createdAt && (
          <span className="mPostListDate">
            {formatDate(application.createdAt)}
          </span>
        )}
      </div>
      <p className="mPostListTitle">
        {application.name || "Unnamed applicant"}{" "}
        <span className="mArcEmail">{application.email}</span>
      </p>
      {/* Reader-supplied text: rendered as a JSX text node, never as HTML. */}
      <p className="mPostListExcerpt">{application.reason}</p>
      {(application.goodreadsUrl || application.amazonProfileUrl) && (
        <p className="mArcLinks">
          {application.goodreadsUrl && (
            <a
              href={application.goodreadsUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Goodreads ↗
            </a>
          )}
          {application.amazonProfileUrl && (
            <a
              href={application.amazonProfileUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Amazon profile ↗
            </a>
          )}
        </p>
      )}
    </>
  );
}

async function decideAction(formData: FormData) {
  "use server";

  // A server action is its own entry point — re-check auth, never trust that
  // the page guard ran.
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const intent = String(formData.get("intent") ?? "");
  const decision = intent === "approved" ? "approved" : "rejected";
  const bookSlugs = formData
    .getAll("bookSlugs")
    .map((value) => String(value))
    .filter(Boolean);

  if (!email) redirect("/admin/arc?status=failed");

  try {
    await decideApplication(email, decision);

    if (decision === "approved") {
      await upsertArcReader({ email, name, bookSlugs, source: "application" });
      // Best-effort: an email failure must not undo a completed approval.
      await sendApplicationApprovedEmail(email, name);
    }
  } catch (err) {
    console.error("[decideAction]", err);
    redirect("/admin/arc?status=missing-config");
  }

  redirect(`/admin/arc?status=${decision}`);
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
