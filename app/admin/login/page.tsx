import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated, loginAdmin } from "@/lib/admin-auth";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata = {
  title: "Sign in | Aftab Arbiyani",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: Props) {
  if (await isAdminAuthenticated()) redirect("/admin/blog/new");

  const { status } = await searchParams;

  return (
    <main className="mLoginPage">
      <div className="mLoginCard">
        <p className="mLoginBrand">Aftab Arbiyani</p>
        <p className="mLoginSub">Sign in to your writing space</p>

        {status === "forbidden" && (
          <p className="mLoginError">Incorrect password. Try again.</p>
        )}
        {status === "missing-config" && (
          <p className="mLoginError">
            <code>BLOG_ADMIN_SECRET</code> is not set in your environment.
          </p>
        )}

        <form className="mLoginForm" action={loginAction}>
          <input
            name="password"
            type="password"
            placeholder="Password"
            autoFocus
            required
            autoComplete="current-password"
          />
          <button type="submit">
            Continue
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>

        <Link href="/" className="mLoginBack">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M11 7H3M6 3L2 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to site
        </Link>
      </div>
    </main>
  );
}

async function loginAction(formData: FormData) {
  "use server";

  if (!process.env.BLOG_ADMIN_SECRET) redirect("/admin/login?status=missing-config");

  const ok = await loginAdmin(String(formData.get("password") ?? ""));
  if (!ok) redirect("/admin/login?status=forbidden");

  redirect("/admin/blog/new");
}
