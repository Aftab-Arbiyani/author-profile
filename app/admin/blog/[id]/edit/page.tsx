import { redirect, notFound } from "next/navigation";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TitleField } from "@/components/TitleField";
import { BrandMark } from "@/components/BrandMark";
import { isAdminAuthenticated, logoutAdmin } from "@/lib/admin-auth";
import { getBlogPostById, updateBlogPost } from "@/lib/firestore";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "Edit Post | Aftab Arbiyani",
  robots: { index: false, follow: false },
};

export default async function EditBlogPage({ params, searchParams }: Props) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { id } = await params;
  const { status } = await searchParams;
  const post = await getBlogPostById(id);

  if (!post) notFound();

  return (
    <main className="mEditorPage">
      <form id="logoutForm" action={logoutAction} aria-hidden style={{ display: "none" }} />

      <header className="mTopBar">
        <div className="mTopBarLeft">
          <BrandMark size={32} className="mTopBarAvatar" />
          <span className="mTopBarDraft">{post.published ? "Published" : "Draft"}</span>
        </div>

        {status === "missing-config" && (
          <p className="mTopBarError">Firebase or admin secret is not configured.</p>
        )}

        <div className="mTopBarRight">
          <button type="submit" form="logoutForm" className="mTopBarSignOut">
            Sign out
          </button>
          {!post.published && (
            <button name="intent" value="draft" type="submit" form="postForm" className="mBtnDraft">
              Save draft
            </button>
          )}
          <button name="intent" value="publish" type="submit" form="postForm" className="mBtnPublish">
            {post.published ? "Update" : "Publish"}
          </button>
        </div>
      </header>

      <form id="postForm" action={updatePostAction.bind(null, id)}>
        <div className="mCanvas">
          <TitleField defaultValue={post.title} />

          <textarea
            name="excerpt"
            className="mSubtitleInput"
            placeholder="Write a subtitle…"
            rows={2}
            defaultValue={post.excerpt}
            required
          />

          <hr className="mCanvasDivider" />

          <RichTextEditor initialHtml={post.contentHtml ?? ""} />

          <details className="mPostSettings">
            <summary className="mPostSettingsTrigger">Post settings</summary>
            <div className="mPostSettingsGrid">
              <label className="mSettingLabel">
                <span>Slug</span>
                <input name="slug" type="text" defaultValue={post.slug} />
              </label>
              <label className="mSettingLabel">
                <span>Cover image URL</span>
                <input name="coverUrl" type="url" defaultValue={post.coverUrl ?? ""} placeholder="https://…" />
              </label>
            </div>
          </details>
        </div>
      </form>
    </main>
  );
}

async function updatePostAction(id: string, formData: FormData) {
  "use server";

  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const title = str(formData, "title");
  const slug = str(formData, "slug") || slugify(title);
  const excerpt = str(formData, "excerpt");
  const rawHtml = sanitize(str(formData, "contentHtml"));
  const content = rawHtml
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const coverUrl = str(formData, "coverUrl");
  const intent = str(formData, "intent");
  const published = intent === "publish";

  try {
    await updateBlogPost(id, { title, slug, excerpt, content, contentHtml: rawHtml, coverUrl, published });
  } catch {
    redirect(`/admin/blog/${id}/edit?status=missing-config`);
  }

  redirect(published ? `/blog/${slug}` : "/admin/blog");
}

async function logoutAction() {
  "use server";
  await logoutAdmin();
  redirect("/admin/login");
}

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function sanitize(v: string) {
  return v
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\shref=["']javascript:[^"']*["']/gi, "");
}
