import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import {
  deleteChapter,
  getArcBook,
  getChapterSummaries,
  updateArcBook,
} from "@/lib/arc";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
};

export const metadata = {
  title: "Edit ARC Book | Admin",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  "missing-config": "Firebase is not configured — nothing was saved.",
  failed: "That action failed. Check the server logs and try again.",
  "chapter-too-large":
    "That chapter is too large for one document. Split it into two chapters.",
};

const NOTICES: Record<string, string> = {
  created: "Book added. Add its first chapter below.",
  saved: "Book details saved.",
  "chapter-saved": "Chapter saved.",
  "chapter-deleted": "Chapter deleted.",
  imported: "Chapters imported from EPUB.",
};

export default async function AdminArcBookPage({ params, searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { slug } = await params;
  const { status } = await searchParams;
  const book = await getArcBook(slug);

  if (!book) notFound();

  const chapters = await getChapterSummaries(slug);

  return (
    <main className="mEditorPage">
      <ArcAdminBar
        current="books"
        error={status ? ERRORS[status] : undefined}
        notice={status ? NOTICES[status] : undefined}
      />

      <div className="mPostList">
        <section>
          <h2 className="mPostListHeading">Book details</h2>
          <form
            action={updateBookAction.bind(null, slug)}
            className="mArcAddForm"
          >
            <label className="mSettingLabel">
              <span>Title</span>
              <input
                name="title"
                type="text"
                defaultValue={book.title}
                required
              />
            </label>
            <label className="mSettingLabel">
              <span>Cover image URL</span>
              <input
                name="coverUrl"
                type="url"
                defaultValue={book.coverUrl ?? ""}
                placeholder="https://…"
              />
            </label>
            <label className="mSettingLabel">
              <span>Description</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={book.description}
                className="mArcTextarea"
              />
            </label>
            <label className="mSettingLabel">
              <span>Status</span>
              <select
                name="status"
                className="mArcSelect"
                defaultValue={book.status}
              >
                <option value="open">Open — can be assigned to readers</option>
                <option value="closed">Closed — no new assignments</option>
              </select>
            </label>
            <p className="mArcHint">
              Slug: <code>{book.slug}</code> — readers open this book at{" "}
              <code>/arc/read/{book.slug}</code>. The slug can&apos;t be changed
              once chapters exist.
            </p>
            <button type="submit" className="mBtnPublish">
              Save details
            </button>
          </form>
        </section>

        <section>
          <div className="mArcSectionHead">
            <h2 className="mPostListHeading">
              Chapters · {chapters.length}
            </h2>
            <Link
              href={`/admin/arc/books/${slug}/import`}
              className="mBtnDraft mArcHeadButton"
            >
              Import EPUB
            </Link>
            <Link
              href={`/admin/arc/books/${slug}/chapters/new`}
              className="mBtnPublish mArcHeadButton"
            >
              New chapter
            </Link>
          </div>

          {chapters.length === 0 && (
            <div className="mPostListEmpty">
              <p>
                No chapters yet.{" "}
                <Link href={`/admin/arc/books/${slug}/chapters/new`}>
                  Add the first chapter →
                </Link>
              </p>
            </div>
          )}

          <ul className="mPostListItems">
            {chapters.map((chapter) => (
              <li className="mPostListItem" key={chapter.id}>
                <div className="mPostListMeta">
                  <span className="mPostListBadge mPostListBadgeDraft">
                    Chapter {chapter.order}
                  </span>
                </div>
                <p className="mPostListTitle">
                  <Link
                    href={`/admin/arc/books/${slug}/chapters/${chapter.id}`}
                  >
                    {chapter.title}
                  </Link>
                </p>
                <div className="mArcRowActions">
                  <form action={deleteChapterAction.bind(null, slug, chapter.id)}>
                    <button type="submit" className="mBtnDraft">
                      Delete chapter
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

async function updateBookAction(slug: string, formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const coverUrl = String(formData.get("coverUrl") ?? "").trim();
  const status =
    String(formData.get("status") ?? "") === "closed" ? "closed" : "open";

  try {
    await updateArcBook(slug, { title, description, coverUrl, status });
  } catch (err) {
    console.error("[updateBookAction]", err);
    redirect(`/admin/arc/books/${slug}?status=missing-config`);
  }

  redirect(`/admin/arc/books/${slug}?status=saved`);
}

async function deleteChapterAction(slug: string, chapterId: string) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  try {
    await deleteChapter(slug, chapterId);
  } catch (err) {
    console.error("[deleteChapterAction]", err);
    redirect(`/admin/arc/books/${slug}?status=failed`);
  }

  redirect(`/admin/arc/books/${slug}?status=chapter-deleted`);
}
