import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
  published: boolean;
  coverUrl?: string;
  content?: string[];
  contentHtml?: string;
  views: number;
};

type BlogPostDocument = {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string[] | string;
  contentHtml?: string;
  coverUrl?: string;
  published?: boolean;
  publishedAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
  createdAt?: Timestamp | Date | string;
  views?: number;
};

export type CreateBlogPostInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string[];
  contentHtml: string;
  coverUrl?: string;
  published: boolean;
};

function hasFirebaseConfig() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

export function getFirebaseDb() {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  }

  return getFirestore();
}

export function normalizeDate(value?: Timestamp | Date | string) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.toDate().toISOString();
}

function normalizeContent(value?: string[] | string) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : value.split("\n\n");
}

function normalizePost(id: string, data: BlogPostDocument): BlogPost {
  return {
    id,
    title: data.title ?? "Untitled post",
    slug: data.slug ?? id,
    excerpt: data.excerpt ?? "",
    publishedAt: normalizeDate(data.publishedAt),
    // Legacy posts predate these fields — fall back to publishedAt so
    // datePublished/dateModified stay sane rather than empty.
    updatedAt: normalizeDate(data.updatedAt ?? data.publishedAt),
    createdAt: normalizeDate(data.createdAt ?? data.publishedAt),
    published: data.published ?? false,
    coverUrl: data.coverUrl,
    content: normalizeContent(data.content),
    contentHtml: data.contentHtml,
    views: typeof data.views === "number" ? data.views : 0,
  };
}

/**
 * Atomically bumps a published post's view counter. Called from the client-side
 * beacon on the article page (see components/TrackView.tsx) rather than during
 * render, so prefetches, bots, and SSR don't inflate the count. Best-effort:
 * a failure here must never break the page, so errors are swallowed.
 */
export async function incrementBlogPostViews(slug: string): Promise<void> {
  const db = getFirebaseDb();

  if (!db) {
    return;
  }

  try {
    const snapshot = await db
      .collection("blogPosts")
      .where("slug", "==", slug)
      .where("published", "==", true)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];

    if (doc) {
      await doc.ref.update({ views: FieldValue.increment(1) });
    }
  } catch (err) {
    console.error("[incrementBlogPostViews]", err);
  }
}

export async function getBlogPosts(limitCount = 3): Promise<BlogPost[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("blogPosts")
      .where("published", "==", true)
      .orderBy("publishedAt", "desc")
      .limit(limitCount)
      .get();

    return snapshot.docs.map((doc) =>
      normalizePost(doc.id, doc.data() as BlogPostDocument),
    );
  } catch (err) {
    console.error("[getBlogPosts]", err);
    return [];
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const snapshot = await db
      .collection("blogPosts")
      .where("slug", "==", slug)
      .where("published", "==", true)
      .limit(1)
      .get();
    const post = snapshot.docs[0];

    return post ? normalizePost(post.id, post.data() as BlogPostDocument) : null;
  } catch (err) {
    // A thrown query usually means a missing Firestore composite index
    // (slug + published) — surface it so a published post never silently 404s.
    console.error("[getBlogPost]", err);
    return null;
  }
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const db = getFirebaseDb();

  if (!db) {
    return null;
  }

  try {
    const doc = await db.collection("blogPosts").doc(id).get();
    if (!doc.exists) return null;
    return normalizePost(doc.id, doc.data() as BlogPostDocument);
  } catch (err) {
    console.error("[getBlogPostById]", err);
    return null;
  }
}

export async function updateBlogPost(id: string, input: Partial<CreateBlogPostInput>) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  if (input.slug) {
    await assertSlugAvailable(db, input.slug, id);
  }

  const ref = db.collection("blogPosts").doc(id);

  // Every save is a modification; only the FIRST publish stamps publishedAt.
  // Re-editing an already-published post must not reset its original date —
  // that was the old bug where datePublished tracked the last edit.
  const update: Record<string, unknown> = {
    ...input,
    updatedAt: Timestamp.now(),
  };

  if (input.published) {
    const existing = (await ref.get()).data();
    if (!existing?.publishedAt) {
      update.publishedAt = Timestamp.now();
    }
  }

  await ref.update(update);
}

export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await db
      .collection("blogPosts")
      .orderBy("publishedAt", "desc")
      .get();

    return snapshot.docs.map((doc) =>
      normalizePost(doc.id, doc.data() as BlogPostDocument),
    );
  } catch (err) {
    // Likely a missing composite index — surface it rather than showing an
    // empty admin list as if there were genuinely no posts.
    console.error("[getAllBlogPosts]", err);
    return [];
  }
}

export type SubscribeResult =
  | "ok"
  | "duplicate"
  | "not-configured"
  | "error";

/**
 * Saves a newsletter subscriber. The lowercased email is used as the document
 * ID so re-subscribing is a natural no-op (returns "duplicate" instead of
 * creating a second record).
 */
export async function addSubscriber(
  email: string,
  name = "",
): Promise<SubscribeResult> {
  const db = getFirebaseDb();

  if (!db) {
    return "not-configured";
  }

  const normalized = email.trim().toLowerCase();

  try {
    const ref = db.collection("subscribers").doc(normalized);
    const existing = await ref.get();
    if (existing.exists) {
      return "duplicate";
    }

    await ref.set({
      email: normalized,
      name: name.trim(),
      subscribedAt: Timestamp.now(),
      source: "website",
    });

    return "ok";
  } catch (err) {
    console.error("[addSubscriber]", err);
    return "error";
  }
}

/** Thrown when a create/update would collide with an existing post's slug. */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`A post with the slug "${slug}" already exists.`);
    this.name = "SlugTakenError";
  }
}

/**
 * Guards slug uniqueness. Two posts sharing a slug would make `/blog/[slug]`
 * serve an arbitrary one and mis-route view counts, so creation/rename must
 * reject a duplicate. `ignoreId` lets an edit keep its own slug.
 */
async function assertSlugAvailable(
  db: ReturnType<typeof getFirestore>,
  slug: string,
  ignoreId?: string,
) {
  const snapshot = await db
    .collection("blogPosts")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  const clash = snapshot.docs[0];
  if (clash && clash.id !== ignoreId) {
    throw new SlugTakenError(slug);
  }
}

export async function createBlogPost(input: CreateBlogPostInput) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await assertSlugAvailable(db, input.slug);

  const now = Timestamp.now();

  await db.collection("blogPosts").add({
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    contentHtml: input.contentHtml,
    coverUrl: input.coverUrl ?? "",
    published: input.published,
    // Only stamp a publish date when actually publishing. Drafts store null so
    // that publishing later (see updateBlogPost) records the true publish time
    // instead of the draft-creation time. null still keeps the document in
    // `orderBy("publishedAt")` results, so the admin drafts list is unaffected.
    publishedAt: input.published ? now : null,
    createdAt: now,
    updatedAt: now,
  });
}
