import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/firestore";
import { SiteFooter } from "@/components/SiteFooter";
import { BrandMark } from "@/components/BrandMark";
import { jsonLdScript } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Blog: Essays & Craft Notes",
  description:
    "Essays, craft notes, launch updates, and reading letters from psychological mystery writer Aftab Arbiyani.",
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog: Essays & Craft Notes | Aftab Arbiyani",
    description:
      "Essays, craft notes, launch updates, and reading letters from psychological mystery writer Aftab Arbiyani.",
    url: "/blog",
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Aftab Arbiyani, author of psychological mystery fiction",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog: Essays & Craft Notes | Aftab Arbiyani",
    description:
      "Essays, craft notes, launch updates, and reading letters from psychological mystery writer Aftab Arbiyani.",
    images: ["/og-default.jpg"],
  },
};

const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://www.aftabarbiyani.com/blog",
  url: "https://www.aftabarbiyani.com/blog",
  name: "Aftab Arbiyani Blog",
  description:
    "Essays, craft notes, and reading letters from psychological mystery writer Aftab Arbiyani.",
  author: { "@id": "https://www.aftabarbiyani.com/#person" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.aftabarbiyani.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: "https://www.aftabarbiyani.com/blog",
    },
  ],
};

export default async function BlogPage() {
  const posts = await getBlogPosts(12);

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      <section className="simpleHero">
        <nav className="nav" aria-label="Primary">
          <Link className="brand" href="/">
            <BrandMark size={26} className="brandMark" />
            Aftab Arbiyani
          </Link>
          <div className="navLinks">
            <Link href="/about">About</Link>
            <Link href="/#books">Books</Link>
            <Link href="/blog">Blog</Link>
          </div>
        </nav>
        <div className="simpleHeroCopy">
          <p className="eyebrow">Blog</p>
          <h1>Notes from the writing desk.</h1>
          <p className="lede">
            Essays, launch updates, craft notes, and reading letters for people
            who like their mysteries with pressure, silence, and moral weather.
          </p>
        </div>
      </section>

      <section className="blogIndex">
        {posts.length > 0 ? (
          <div className="postGrid">
            {posts.map((post) => (
              <article className="postCard" key={post.id}>
                {post.coverUrl ? (
                  <div className="postCardCover">
                    <Image
                      src={post.coverUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 600px) 100vw, (max-width: 820px) 50vw, 360px"
                    />
                  </div>
                ) : null}
                <p className="postDate">
                  {post.publishedAt ? (
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt)}
                    </time>
                  ) : (
                    formatDate(post.publishedAt)
                  )}
                </p>
                <h2>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                <p>{post.excerpt}</p>
                <Link className="textLink" href={`/blog/${post.slug}`}>
                  Read post
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <p className="eyebrow">Coming soon</p>
            <h2>No posts published yet.</h2>
            {/* <p>Once a blog post is published, it will appear here automatically.</p> */}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "Draft";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
