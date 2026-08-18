import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import {
  assignBook,
  createMagicLinkToken,
  extendReaderAccess,
  getAllArcReaders,
  getArcBooks,
  setReaderStatus,
  unassignBook,
  upsertArcReader,
  type ArcReader,
} from "@/lib/arc";
import { sendMagicLinkEmail } from "@/lib/email";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "ARC Readers | Admin",
  robots: { index: false, follow: false },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.aftabarbiyani.com";

const ERRORS: Record<string, string> = {
  "missing-config": "Firebase is not configured — nothing was saved.",
  failed: "That action failed. Check the server logs and try again.",
  "invalid-email": "Enter a valid email address.",
  "link-failed": "Couldn't send the sign-in link. Check Resend configuration.",
};

const NOTICES: Record<string, string> = {
  added: "Reader added.",
  revoked: "Access revoked — the reader is locked out immediately.",
  reactivated: "Reader reactivated.",
  assigned: "Book assigned.",
  unassigned: "Book unassigned.",
  "link-sent": "Sign-in link sent.",
  extended: "Reading window extended.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function AdminArcReadersPage({ searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { status } = await searchParams;
  const [readers, books] = await Promise.all([getAllArcReaders(), getArcBooks()]);

  return (
    <main className="mEditorPage">
      <ArcAdminBar
        current="readers"
        error={status ? ERRORS[status] : undefined}
        notice={status ? NOTICES[status] : undefined}
      />

      <div className="mPostList">
        <section>
          <h2 className="mPostListHeading">Add a reader directly</h2>
          <form action={addReaderAction} className="mArcAddForm">
            <label className="mSettingLabel">
              <span>Name</span>
              <input name="name" type="text" placeholder="Reader name" required />
            </label>
            <label className="mSettingLabel">
              <span>Email</span>
              <input
                name="email"
                type="email"
                placeholder="reader@example.com"
                required
              />
            </label>
            {books.length > 0 && (
              <fieldset className="mArcFieldset">
                <legend>Give access to</legend>
                {books.map((book) => (
                  <label className="mArcCheck" key={book.slug}>
                    <input type="checkbox" name="bookSlugs" value={book.slug} />
                    <span>
                      {book.title}
                      {book.status === "closed" && " (closed)"}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <button type="submit" className="mBtnPublish">
              Add reader
            </button>
          </form>
        </section>

        <section>
          <h2 className="mPostListHeading">Readers · {readers.length}</h2>

          {readers.length === 0 && (
            <div className="mPostListEmpty">
              <p>
                No ARC readers yet. Approve an{" "}
                <Link href="/admin/arc">application</Link> or add someone
                directly above.
              </p>
            </div>
          )}

          <ul className="mPostListItems">
            {readers.map((reader) => {
              const unassigned = books.filter(
                (book) => !reader.bookSlugs.includes(book.slug),
              );

              return (
                <li className="mPostListItem" key={reader.email}>
                  <div className="mPostListMeta">
                    <span
                      className={`arcStatusBadge arcStatus${cap(reader.status)}`}
                    >
                      {reader.status}
                    </span>
                    <span className="mPostListDate">
                      {reader.source === "manual" ? "Added manually" : "Applied"}
                      {reader.approvedAt
                        ? ` · ${formatDate(reader.approvedAt)}`
                        : ""}
                      {" · "}
                      {accessLabel(reader)}
                    </span>
                  </div>

                  <p className="mPostListTitle">
                    {reader.name || "Unnamed reader"}{" "}
                    <span className="mArcEmail">{reader.email}</span>
                  </p>

                  <p className="mPostListExcerpt">
                    {reader.bookSlugs.length === 0
                      ? "No books assigned yet."
                      : `Reading: ${reader.bookSlugs
                          .map(
                            (slug) =>
                              books.find((b) => b.slug === slug)?.title ?? slug,
                          )
                          .join(", ")}`}
                  </p>

                  <div className="mArcRowActions">
                    <form action={toggleStatusAction}>
                      <input type="hidden" name="email" value={reader.email} />
                      <input
                        type="hidden"
                        name="next"
                        value={reader.status === "active" ? "revoked" : "active"}
                      />
                      <button type="submit" className="mBtnDraft">
                        {reader.status === "active"
                          ? "Revoke access"
                          : "Reactivate"}
                      </button>
                    </form>

                    {reader.status === "active" && (
                      <form action={sendLinkAction}>
                        <input type="hidden" name="email" value={reader.email} />
                        <button type="submit" className="mBtnDraft">
                          Send sign-in link
                        </button>
                      </form>
                    )}

                    {unassigned.length > 0 && (
                      <form action={assignBookAction} className="mArcInlineForm">
                        <input type="hidden" name="email" value={reader.email} />
                        <select name="bookSlug" aria-label="Assign a book">
                          {unassigned.map((book) => (
                            <option value={book.slug} key={book.slug}>
                              {book.title}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="mBtnDraft">
                          Assign
                        </button>
                      </form>
                    )}

                    {reader.bookSlugs.length > 0 && (
                      <form
                        action={unassignBookAction}
                        className="mArcInlineForm"
                      >
                        <input type="hidden" name="email" value={reader.email} />
                        <select name="bookSlug" aria-label="Remove a book">
                          {reader.bookSlugs.map((slug) => (
                            <option value={slug} key={slug}>
                              {books.find((b) => b.slug === slug)?.title ?? slug}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="mBtnDraft">
                          Remove
                        </button>
                      </form>
                    )}

                    {reader.status === "active" && (
                      <form
                        action={extendAccessAction}
                        className="mArcInlineForm"
                      >
                        <input type="hidden" name="email" value={reader.email} />
                        <select
                          name="days"
                          aria-label="Extend access by"
                          defaultValue="30"
                        >
                          <option value="7">7 days</option>
                          <option value="14">14 days</option>
                          <option value="30">30 days</option>
                          <option value="60">60 days</option>
                        </select>
                        <button type="submit" className="mBtnDraft">
                          Extend
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}

async function addReaderAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const bookSlugs = formData
    .getAll("bookSlugs")
    .map((value) => String(value))
    .filter(Boolean);

  if (!EMAIL_RE.test(email)) {
    redirect("/admin/arc/readers?status=invalid-email");
  }

  try {
    await upsertArcReader({ email, name, bookSlugs, source: "manual" });
  } catch (err) {
    console.error("[addReaderAction]", err);
    redirect("/admin/arc/readers?status=missing-config");
  }

  redirect("/admin/arc/readers?status=added");
}

async function toggleStatusAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const next = String(formData.get("next") ?? "") === "revoked" ? "revoked" : "active";

  if (!email) redirect("/admin/arc/readers?status=failed");

  try {
    await setReaderStatus(email, next);
  } catch (err) {
    console.error("[toggleStatusAction]", err);
    redirect("/admin/arc/readers?status=failed");
  }

  redirect(
    `/admin/arc/readers?status=${next === "revoked" ? "revoked" : "reactivated"}`,
  );
}

/**
 * Admin-initiated sign-in link. Deliberately skips the per-reader send
 * throttle used by the public endpoint — that throttle exists to stop anonymous
 * mail-bombing, and this caller is the authenticated author.
 */
async function sendLinkAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();

  if (!email) redirect("/admin/arc/readers?status=failed");

  const token = await createMagicLinkToken(email);

  if (!token) {
    redirect("/admin/arc/readers?status=link-failed");
  }

  const result = await sendMagicLinkEmail(
    email,
    `${SITE_URL}/arc/verify?token=${token}`,
  );

  if (result !== "sent") {
    redirect("/admin/arc/readers?status=link-failed");
  }

  redirect("/admin/arc/readers?status=link-sent");
}

async function assignBookAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const bookSlug = String(formData.get("bookSlug") ?? "").trim();

  if (!email || !bookSlug) redirect("/admin/arc/readers?status=failed");

  try {
    await assignBook(email, bookSlug);
  } catch (err) {
    console.error("[assignBookAction]", err);
    redirect("/admin/arc/readers?status=failed");
  }

  redirect("/admin/arc/readers?status=assigned");
}

async function unassignBookAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const bookSlug = String(formData.get("bookSlug") ?? "").trim();

  if (!email || !bookSlug) redirect("/admin/arc/readers?status=failed");

  try {
    await unassignBook(email, bookSlug);
  } catch (err) {
    console.error("[unassignBookAction]", err);
    redirect("/admin/arc/readers?status=failed");
  }

  redirect("/admin/arc/readers?status=unassigned");
}

async function extendAccessAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const email = String(formData.get("email") ?? "").trim();
  const days = Number(formData.get("days"));

  if (!email || !Number.isFinite(days)) {
    redirect("/admin/arc/readers?status=failed");
  }

  try {
    await extendReaderAccess(email, Math.min(365, Math.max(1, Math.round(days))));
  } catch (err) {
    console.error("[extendAccessAction]", err);
    redirect("/admin/arc/readers?status=failed");
  }

  redirect("/admin/arc/readers?status=extended");
}

function cap(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Reading-window summary for a reader row. */
function accessLabel(reader: ArcReader) {
  if (!reader.accessExpiresAt) return "No expiry";

  const expiresAt = Date.parse(reader.accessExpiresAt);

  if (!Number.isFinite(expiresAt)) return "No expiry";

  return expiresAt < Date.now()
    ? `Access ended ${formatDate(reader.accessExpiresAt)}`
    : `Access until ${formatDate(reader.accessExpiresAt)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
