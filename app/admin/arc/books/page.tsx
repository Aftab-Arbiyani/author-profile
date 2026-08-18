import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import { BookSlugTakenError, createArcBook, getArcBooks } from "@/lib/arc";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "ARC Books | Admin",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  "missing-config": "Firebase is not configured — nothing was saved.",
  "slug-taken": "An ARC book with that slug already exists.",
  "missing-title": "Give the book a title.",
};

const NOTICES: Record<string, string> = {
  created: "Book added. Now add its chapters.",
};

export default async function AdminArcBooksPage({ searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { status } = await searchParams;
  const books = await getArcBooks();

  return (
    <main className="mEditorPage">
      <ArcAdminBar
        current="books"
        error={status ? ERRORS[status] : undefined}
        notice={status ? NOTICES[status] : undefined}
      />

      <div className="mPostList">
        <section>
          <h2 className="mPostListHeading">Add a book to the ARC program</h2>
          <form action={createBookAction} className="mArcAddForm">
            <label className="mSettingLabel">
              <span>Title</span>
              <input name="title" type="text" placeholder="Book title" required />
            </label>
            <label className="mSettingLabel">
              <span>Slug</span>
              <input name="slug" type="text" placeholder="auto-generated from title" />
            </label>
            <label className="mSettingLabel">
              <span>Cover image URL</span>
              <input name="coverUrl" type="url" placeholder="https://…" />
            </label>
            <label className="mSettingLabel">
              <span>Description (shown in the reader&apos;s library)</span>
              <textarea
                name="description"
                rows={3}
                placeholder="A short pitch for your ARC readers…"
                className="mArcTextarea"
              />
            </label>
            <label className="mSettingLabel">
              <span>Status</span>
              <select name="status" className="mArcSelect" defaultValue="open">
                <option value="open">Open — can be assigned to readers</option>
                <option value="closed">Closed — no new assignments</option>
              </select>
            </label>
            <button type="submit" className="mBtnPublish">
              Add book
            </button>
          </form>
        </section>

        <section>
          <h2 className="mPostListHeading">Books · {books.length}</h2>

          {books.length === 0 && (
            <div className="mPostListEmpty">
              <p>No ARC books yet. Add one above, then add its chapters.</p>
            </div>
          )}

          <ul className="mPostListItems">
            {books.map((book) => (
              <li className="mPostListItem" key={book.slug}>
                <div className="mPostListMeta">
                  <span
                    className={`mPostListBadge ${
                      book.status === "open"
                        ? "mPostListBadgePublished"
                        : "mPostListBadgeDraft"
                    }`}
                  >
                    {book.status}
                  </span>
                  <span className="mPostListDate">
                    {book.chapterCount}{" "}
                    {book.chapterCount === 1 ? "chapter" : "chapters"}
                  </span>
                </div>
                <p className="mPostListTitle">
                  <Link href={`/admin/arc/books/${book.slug}`}>{book.title}</Link>
                </p>
                <p className="mPostListExcerpt">{book.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

async function createBookAction(formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const title = str(formData, "title");
  const slug = str(formData, "slug") || slugify(title);
  const description = str(formData, "description");
  const coverUrl = str(formData, "coverUrl");
  const status = str(formData, "status") === "closed" ? "closed" : "open";

  if (!title || !slug) redirect("/admin/arc/books?status=missing-title");

  try {
    await createArcBook(slug, { title, description, coverUrl, status });
  } catch (err) {
    if (err instanceof BookSlugTakenError) {
      redirect("/admin/arc/books?status=slug-taken");
    }
    console.error("[createBookAction]", err);
    redirect("/admin/arc/books?status=missing-config");
  }

  redirect(`/admin/arc/books/${slug}?status=created`);
}

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
