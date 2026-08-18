import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ArcAdminBar } from "@/components/ArcAdminBar";
import { EpubImporter } from "@/components/EpubImporter";
import { getArcBook, getChapterSummaries } from "@/lib/arc";

type Props = { params: Promise<{ slug: string }> };

export const metadata = {
  title: "Import EPUB | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminArcImportPage({ params }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { slug } = await params;
  const book = await getArcBook(slug);

  if (!book) notFound();

  const chapters = await getChapterSummaries(slug);

  return (
    <main className="mEditorPage">
      <ArcAdminBar current="books" />

      <div className="mPostList">
        <section>
          <div className="mArcSectionHead">
            <h2 className="mPostListHeading">Import EPUB · {book.title}</h2>
            <Link
              href={`/admin/arc/books/${slug}`}
              className="mBtnDraft mArcHeadButton"
            >
              Back to book
            </Link>
          </div>

          <EpubImporter
            bookSlug={slug}
            bookTitle={book.title}
            existingChapterCount={chapters.length}
          />
        </section>
      </div>
    </main>
  );
}
