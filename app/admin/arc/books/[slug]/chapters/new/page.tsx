import { notFound, redirect } from "next/navigation";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TitleField } from "@/components/TitleField";
import { BrandMark } from "@/components/BrandMark";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/admin-auth";
import {
  ChapterTooLargeError,
  getArcBook,
  getChapterSummaries,
  saveChapter,
} from "@/lib/arc";
import { sanitizeEditorHtml } from "@/lib/sanitize";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
};

export const metadata = {
  title: "New ARC Chapter | Admin",
  robots: { index: false, follow: false },
};

export default async function NewArcChapterPage({ params, searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { slug } = await params;
  const { status } = await searchParams;
  const book = await getArcBook(slug);

  if (!book) notFound();

  // Default the new chapter to the end of the running order.
  const chapters = await getChapterSummaries(slug);
  const nextOrder = chapters.length
    ? Math.max(...chapters.map((c) => c.order)) + 1
    : 1;

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
          <span className="mTopBarDraft">{book.title} · new chapter</span>
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
          <button type="submit" form="logoutForm" className="mTopBarSignOut">
            Sign out
          </button>
          <button type="submit" form="chapterForm" className="mBtnPublish">
            Save chapter
          </button>
        </div>
      </header>

      <form id="chapterForm" action={createChapterAction.bind(null, slug)}>
        <div className="mCanvas">
          <TitleField autoFocus />

          <label className="mSettingLabel mArcOrderField">
            <span>Chapter order</span>
            <input
              name="order"
              type="number"
              min={1}
              step={1}
              defaultValue={nextOrder}
              required
            />
          </label>

          <hr className="mCanvasDivider" />

          <RichTextEditor />
        </div>
      </form>
    </main>
  );
}

async function createChapterAction(slug: string, formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const title = String(formData.get("title") ?? "").trim();
  const order = Number(formData.get("order") ?? 1);
  // Author-authored content, so the existing regex sanitiser is the right
  // level of protection here (see lib/sanitize.ts).
  const html = sanitizeEditorHtml(String(formData.get("contentHtml") ?? ""));

  try {
    await saveChapter(slug, {
      order: Number.isFinite(order) && order >= 1 ? Math.floor(order) : 1,
      title: title || "Untitled chapter",
      html,
    });
  } catch (err) {
    if (err instanceof ChapterTooLargeError) {
      redirect(
        `/admin/arc/books/${slug}/chapters/new?status=chapter-too-large`,
      );
    }
    console.error("[createChapterAction]", err);
    redirect(`/admin/arc/books/${slug}/chapters/new?status=missing-config`);
  }

  redirect(`/admin/arc/books/${slug}?status=chapter-saved`);
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}
