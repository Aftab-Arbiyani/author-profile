import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/admin-auth";
import { getAllBlogPosts } from "@/lib/firestore";
import { BrandMark } from "@/components/BrandMark";

export const metadata = {
  title: "All Posts | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminBlogPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const posts = await getAllBlogPosts();
  const drafts = posts.filter((p) => !p.published);
  const published = posts.filter((p) => p.published);

  return (
    <main className="mEditorPage">
      <form id="logoutForm" action={logoutAction} aria-hidden style={{ display: "none" }} />

      <header className="mTopBar">
        <Link href="/admin" className="mTopBarLeft mTopBarHome">
          <BrandMark size={32} className="mTopBarAvatar" />
          <span className="mTopBarDraft">Posts</span>
        </Link>
        <div className="mTopBarRight">
          <button type="submit" form="logoutForm" className="mTopBarSignOut">
            Sign out
          </button>
          <Link href="/admin/blog/new" className="mAdminCta">
            New post
          </Link>
        </div>
      </header>

      <div className="mPostList">
        {posts.length === 0 && (
          <div className="mPostListEmpty">
            <p>No posts yet. <Link href="/admin/blog/new">Write your first post →</Link></p>
          </div>
        )}

        {drafts.length > 0 && (
          <section>
            <h2 className="mPostListHeading">Drafts</h2>
            <ul className="mPostListItems">
              {drafts.map((post) => (
                <li key={post.id} className="mPostListItem">
                  <div className="mPostListMeta">
                    <span className="mPostListBadge mPostListBadgeDraft">Draft</span>
                    <span className="mPostListDate">Saved</span>
                  </div>
                  <p className="mPostListTitle">
                    <Link href={`/admin/blog/${post.id}/edit`}>{post.title}</Link>
                  </p>
                  <p className="mPostListExcerpt">{post.excerpt}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {published.length > 0 && (
          <section>
            <h2 className="mPostListHeading">Published</h2>
            <ul className="mPostListItems">
              {published.map((post) => (
                <li key={post.id} className="mPostListItem">
                  <div className="mPostListMeta">
                    <span className="mPostListBadge mPostListBadgePublished">Published</span>
                    <span className="mPostListDate">{formatDate(post.publishedAt)}</span>
                    <Link href={`/blog/${post.slug}`} target="_blank" className="mPostListViewLink">
                      View ↗
                    </Link>
                  </div>
                  <p className="mPostListTitle">
                    <Link href={`/admin/blog/${post.id}/edit`}>{post.title}</Link>
                  </p>
                  <p className="mPostListExcerpt">{post.excerpt}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
