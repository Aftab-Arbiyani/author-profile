import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlogPost, type BlogPost } from "@/lib/firestore";
import { jsonLdScript } from "@/lib/jsonld";
import { ReadingProgress } from "@/components/ReadingProgress";
import { TrackView } from "@/components/TrackView";
import { BrandMark } from "@/components/BrandMark";
import { AmazonLinkRewriter } from "@/components/AmazonLinkRewriter";
import { regionalizeAmazonLinks } from "@/lib/amazon";
import { detectStoreCode } from "@/lib/detect-store";
import { SiteFooter } from "@/components/SiteFooter";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    return {
      title: "Post Not Found",
      robots: { index: false, follow: false },
    };
  }

  const description = metaDescription(post);
  const ogImage = post.coverUrl
    ? { url: post.coverUrl, alt: post.title }
    : {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Aftab Arbiyani, author of psychological mystery fiction",
      };

  return {
    title: post.title,
    description,
    alternates: {
      canonical: `/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description,
      url: `/blog/${slug}`,
      type: "article",
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || post.publishedAt || undefined,
      authors: ["Aftab Arbiyani"],
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [post.coverUrl ?? "/og-default.jpg"],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const { words, minutes: readingMinutes } = readingStats(
    post.contentHtml,
    post.content,
  );
  const postUrl = `https://www.aftabarbiyani.com/blog/${post.slug}`;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": postUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    headline: post.title,
    description: metaDescription(post),
    url: postUrl,
    inLanguage: "en",
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt || post.publishedAt || undefined,
    author: { "@id": "https://www.aftabarbiyani.com/#person" },
    publisher: { "@id": "https://www.aftabarbiyani.com/#person" },
    wordCount: words,
    timeRequired: `PT${readingMinutes}M`,
    image: post.coverUrl ?? "https://www.aftabarbiyani.com/og-default.jpg",
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
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `https://www.aftabarbiyani.com/blog/${post.slug}`,
      },
    ],
  };

  const storeCode = await detectStoreCode();
  const bodyHtml = post.contentHtml
    ? regionalizeAmazonLinks(post.contentHtml, storeCode)
    : "";

  return (
    <main>
      <ReadingProgress />
      <TrackView slug={post.slug} />
      <AmazonLinkRewriter initialCode={storeCode} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />
      <article className="articlePage">
        <Link className="textLink articleBackLink" href="/blog">
          ← Back to blog
        </Link>
        <p className="eyebrow">Blog</p>
        <h1>{post.title}</h1>
        {post.excerpt ? <p className="articleExcerpt">{post.excerpt}</p> : null}

        <div className="articleByline">
          <BrandMark size={46} className="articleBylineAvatar" />
          <div className="articleBylineMeta">
            <span className="articleBylineName">Aftab Arbiyani</span>
            <span className="articleBylineSub">
              {post.publishedAt ? (
                <time dateTime={post.publishedAt}>
                  {formatDate(post.publishedAt)}
                </time>
              ) : (
                formatDate(post.publishedAt)
              )}
              <span className="articleBylineDot">·</span>
              {readingMinutes} min read
              {post.views > 0 ? (
                <>
                  <span className="articleBylineDot">·</span>
                  {post.views.toLocaleString()} reads
                </>
              ) : null}
            </span>
          </div>
        </div>

        {post.coverUrl ? (
          <div className="articleCover">
            <Image
              src={post.coverUrl}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 820px) 100vw, 720px"
            />
          </div>
        ) : null}
        {post.contentHtml ? (
          <div
            className="articleBody"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <div className="articleBody">
            {post.content?.length ? renderRichText(post.content) : null}
          </div>
        )}

        <footer className="articleEnd">
          <span className="articleEndMark">· · ·</span>
          <h2 className="articleEndTitle">Thanks for reading.</h2>
          <p className="articleEndCopy">
            Occasional notes on new books, essays, and launch news, sent only
            when there&apos;s something worth your time.
          </p>
          <div className="articleEndActions">
            <Link className="button primary" href="/#subscribe">
              Subscribe
            </Link>
            <Link className="button secondary articleEndSecondary" href="/blog">
              More essays
            </Link>
          </div>
        </footer>
      </article>
      <SiteFooter />
    </main>
  );
}

function renderRichText(blocks: string[]) {
  return blocks.map((text, index) => {
    if (!text.trim()) {
      return null;
    }

    return <p key={index}>{text}</p>;
  });
}

function readingStats(contentHtml?: string, content?: string[]) {
  const text = contentHtml
    ? contentHtml.replace(/<[^>]+>/g, " ")
    : (content ?? []).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, minutes };
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

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd() + "…";
}

/**
 * Meta/OG description for a post. Prefers the author's excerpt when it reads as
 * a real sentence (>= 50 chars); otherwise derives one from the article body so
 * the fallback is meaningful rather than a generic 31-char string. Truncated to
 * ~160 chars on a word boundary. Never fabricates — it only reuses the author's
 * own excerpt or body copy.
 */
function metaDescription(post: BlogPost): string {
  const excerpt = post.excerpt?.trim() ?? "";
  if (excerpt.length >= 50) {
    return truncateAtWord(excerpt, 160);
  }

  const body = post.contentHtml
    ? post.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : (post.content ?? []).join(" ").replace(/\s+/g, " ").trim();
  const source = body.length > excerpt.length ? body : excerpt;

  return source
    ? truncateAtWord(source, 160)
    : "An essay by novelist Aftab Arbiyani.";
}
