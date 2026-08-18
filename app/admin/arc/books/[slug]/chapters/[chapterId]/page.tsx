import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TitleField } from "@/components/TitleField";
import { BrandMark } from "@/components/BrandMark";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/admin-auth";
import { ChapterTooLargeError, getArcBook, getChapter, saveChapter } from "@/lib/arc";
import { sanitizeEditorHtml } from "@/lib/sanitize";

type Props = {
  params: Promise<{ slug: string; chapterId: string }>;
  searchParams: Promise<{ status?: string }>;
};

export const metadata = {
  title: "Edit ARC Chapter | Admin",
  robots: { index: false, follow: false },
};

export default async function EditArcChapterPage({
  params,
  searchParams,
}: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { slug, chapterId } = await params;
  const { status } = await searchParams;
  const [book, chapter] = await Promise.all([
    getArcBook(slug),
    getChapter(slug, chapterId),
  ]);

  if (!book || !chapter) notFound();

  return (
    <main className="mEditorPage">
      <form
        id="logoutForm"
        action={logoutAction}
        aria-hidden
        style={{ display: "none" }}
      />

      <header className="mTopBar">
        <div className="mTopBarLeft">
          <BrandMark size={32} className="mTopBarAvatar" />
          <span className="mTopBarDraft">
            {book.title} · chapter {chapter.order}
          </span>
        </div>

        {status === "missing-config" && (
          <p className="mTopBarError">Firebase is not configured.</p>
        )}
        {status === "chapter-too-large" && (
          <p className="mTopBarError">
            That chapter is too large for one document. Split it in two.
          </p>
        )}

        <div className="mTopBarRight">
          <Link href={`/admin/arc/books/${slug}`} className="mTopBarSignOut">
            Back to book
          </Link>
          <button type="submit" form="logoutForm" className="mTopBarSignOut">
            Sign out
          </button>
          <button type="submit" form="chapterForm" className="mBtnPublish">
            Update chapter
          </button>
        </div>
      </header>

      <form
        id="chapterForm"
        action={updateChapterAction.bind(null, slug, chapterId)}
      >
        <div className="mCanvas">
          <TitleField defaultValue={chapter.title} />

          <label className="mSettingLabel mArcOrderField">
            <span>Chapter order</span>
            <input
              name="order"
              type="number"
              min={1}
              step={1}
              defaultValue={chapter.order}
              required
            />
          </label>

          <hr className="mCanvasDivider" />

          <RichTextEditor initialHtml={chapter.html} />
        </div>
      </form>
    </main>
  );
}

async function updateChapterAction(
  slug: string,
  chapterId: string,
  formData: FormData,
) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const title = String(formData.get("title") ?? "").trim();
  const order = Number(formData.get("order") ?? 1);
  const html = sanitizeEditorHtml(String(formData.get("contentHtml") ?? ""));

  try {
    await saveChapter(
      slug,
      {
        order: Number.isFinite(order) && order >= 1 ? Math.floor(order) : 1,
        title: title || "Untitled chapter",
        html,
      },
      chapterId,
    );
  } catch (err) {
    if (err instanceof ChapterTooLargeError) {
      redirect(
        `/admin/arc/books/${slug}/chapters/${chapterId}?status=chapter-too-large`,
      );
    }
    console.error("[updateChapterAction]", err);
    redirect(
      `/admin/arc/books/${slug}/chapters/${chapterId}?status=missing-config`,
    );
  }

  redirect(`/admin/arc/books/${slug}?status=chapter-saved`);
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}
