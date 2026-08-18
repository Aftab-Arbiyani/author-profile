# Aftab Arbiyani — Author Site

The personal website of novelist Aftab Arbiyani: an author profile, a Firestore-backed blog with a Medium-style writing admin, a newsletter signup, and region-aware book links. Built with the Next.js App Router and designed for strong SEO / AI-search visibility.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Firestore** via `firebase-admin` (blog posts, subscribers, view counts)
- **marked** — markdown-to-HTML for the blog editor's paste handler
- **@vercel/analytics** — privacy-first traffic analytics
- Deployed on **Vercel**

## Features

- **Author homepage** — hero, published books, Q&A accordion, newsletter signup.
- **Blog** — `/blog` index and `/blog/[slug]` posts, served from Firestore (only `published: true` posts appear).
- **Writing admin** — login-gated editor with a Medium-style rich-text toolbar and **paste-as-markdown** (paste a markdown draft and it converts to formatted HTML).
- **SEO / AEO** — full metadata, canonical URLs, Open Graph / Twitter cards, `sitemap.xml`, `robots.txt`, and JSON-LD structured data (`Person`, `WebSite`, `Book`, `FAQPage`, `BlogPosting`, `BreadcrumbList`, `ProfilePage`).
- **Region-aware Amazon links** — detects the visitor's marketplace and rewrites buy links; all carry `rel="sponsored noopener noreferrer"` (affiliate tags pluggable in `lib/amazon.ts`).
- **Per-post view counts** — a client beacon increments a Firestore `views` field.
- **Newsletter** — stores subscribers in Firestore via `/api/subscribe` (honeypot-protected).
- **Route loading bar** + a brand mark used as the favicon and nav logo.

## Getting started

**Prerequisites:** Node.js 18.18+ (or 20+) and npm.

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:3000` (it picks the next free port if 3000 is taken).

## Environment variables

Create a `.env.local` in the project root (see `.env.example`). Get the Firebase values from a service-account key in your Firebase project.

| Variable                | Required | Description                                                                                                  |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `FIREBASE_PROJECT_ID`   | yes      | Firebase project id                                                                                          |
| `FIREBASE_CLIENT_EMAIL` | yes      | Service-account email                                                                                        |
| `FIREBASE_PRIVATE_KEY`  | yes      | Service-account private key (keep the `\n` escapes, wrap in quotes)                                          |
| `BLOG_ADMIN_SECRET`     | yes      | Password for the `/admin` blog editor                                                                        |
| `NEXT_PUBLIC_SITE_URL`  | no       | Canonical site URL (defaults to `https://www.aftabarbiyani.com`); used for metadata, sitemap, and canonicals |
| `ARC_SESSION_SECRET`    | for ARC  | HMAC key for ARC reader sessions (`openssl rand -hex 32`); never reuse `BLOG_ADMIN_SECRET`                   |
| `RESEND_API_KEY`        | for ARC  | Resend API key — magic-link sign-in and application/approval emails                                          |
| `EMAIL_FROM`            | no       | Verified sender for ARC emails (defaults to `Aftab Arbiyani <arc@aftabarbiyani.com>`)                        |
| `ARC_NOTIFY_EMAIL`      | no       | Author's address for new-application notifications                                                          |

```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BLOG_ADMIN_SECRET=choose_a_private_password
ARC_SESSION_SECRET=$(openssl rand -hex 32)
RESEND_API_KEY=re_your_api_key
# NEXT_PUBLIC_SITE_URL=https://www.aftabarbiyani.com
# EMAIL_FROM="Aftab Arbiyani <arc@aftabarbiyani.com>"
# ARC_NOTIFY_EMAIL=you@example.com
```

Without Firebase configured, the site still runs — the blog simply shows no posts and subscribe returns "not configured." Without `RESEND_API_KEY`, ARC flows complete but skip sending email (logged as `not-configured`).

## Routes

| Path                                       | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `/`                                        | Author homepage                    |
| `/about`                                   | About / author bio (`ProfilePage`) |
| `/blog`                                    | Blog index                         |
| `/blog/[slug]`                             | Blog post                          |
| `/admin/login`, `/admin/blog`              | Admin login and post list          |
| `/admin/blog/new`, `/admin/blog/[id]/edit` | Create / edit a post               |
| `/books/the-probationers`                  | Book page (`Book` + reviews)       |
| `/press`                                   | Press / media kit                  |
| `/api/subscribe`                           | Newsletter signup (POST)           |
| `/api/blog/[slug]/view`                    | View-count beacon (POST)           |

### ARC reader program

Public (indexable):

| Path   | Description                                       |
| ------ | ------------------------------------------------- |
| `/arc` | Landing page + application form (`FAQPage`, sitemap) |

Reader-only — noindex, `robots.txt`-disallowed, `no-store`:

| Path                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| `/arc/signin`        | Request a magic sign-in link                       |
| `/arc/verify`        | Confirm a magic link (redeemed on POST only)       |
| `/arc/library`       | The reader's assigned advance copies               |
| `/arc/read/[slug]`   | In-browser manuscript reader (`?chapter=N`)        |
| `/arc/review/[slug]` | Submit / view their review                         |

Admin (`BLOG_ADMIN_SECRET`):

| Path                                             | Description                        |
| ------------------------------------------------ | ---------------------------------- |
| `/admin/arc`                                     | Application queue — approve/reject |
| `/admin/arc/readers`                             | Add, revoke, assign books, resend link |
| `/admin/arc/books`, `/admin/arc/books/[slug]`    | ARC books and their chapters       |
| `/admin/arc/reviews`                             | Review moderation → publishes to the book page |

API:

| Path                 | Description                            |
| -------------------- | -------------------------------------- |
| `/api/arc/apply`     | Application submission (POST, honeypot) |
| `/api/arc/signin`    | Magic-link request (POST, throttled)    |
| `/api/arc/progress`  | Reading-position beacon (POST)          |

## Managing content

Start the site and open the editor:

```text
http://localhost:3000/admin/blog/new
```

Sign in with your `BLOG_ADMIN_SECRET`. Write in the rich-text editor, or **paste a markdown draft** (headings, bold/italic, links, lists, quotes, and `---` dividers all convert automatically). Toggle **published** to make a post live.

### Firestore collections

**`blogPosts`** documents:

| Field         | Type      | Notes                                              |
| ------------- | --------- | -------------------------------------------------- |
| `title`       | string    |                                                    |
| `slug`        | string    | e.g. `my-first-post`                               |
| `excerpt`     | string    | used for cards and meta descriptions               |
| `contentHtml` | string    | body HTML written by the editor                    |
| `content`     | string[]  | legacy paragraph array (still rendered if present) |
| `coverUrl`    | string    | optional cover image URL                           |
| `published`   | boolean   | only `true` posts are served publicly              |
| `publishedAt` | timestamp | first-publish date (`datePublished`)               |
| `updatedAt`   | timestamp | last edit (`dateModified`)                         |
| `createdAt`   | timestamp | draft creation                                     |
| `views`       | number    | incremented by the view beacon                     |

**`subscribers`** documents are keyed by lowercased email (`email`, `subscribedAt`, `source`).

### ARC collections

| Collection                    | Doc ID                  | Notes                                                        |
| ----------------------------- | ----------------------- | ------------------------------------------------------------ |
| `arcBooks`                    | slug                    | `title`, `coverUrl`, `description`, `status`, `chapterCount`  |
| `arcBooks/{slug}/chapters`    | auto-id                 | `order` (1-based), `title`, `html` — keep under ~900 KB each  |
| `arcApplications`             | lowercased email        | `status` pending/approved/rejected; re-apply allowed only after a rejection |
| `arcReaders`                  | lowercased email        | `status` active/revoked, `bookSlugs[]`, magic-link throttle fields |
| `arcTokens`                   | SHA-256 of raw token    | single-use, 15-min TTL — only the hash is stored              |
| `arcReviews`                  | `{bookSlug}__{email}`   | one per reader per book; `title`/`body` are **plain text**    |
| `arcProgress`                 | `{bookSlug}__{email}`   | `chapterOrder`, `percent` — powers "continue reading"         |
| `arcReadThrottle`             | lowercased email        | chapter-read velocity window — soft scrape brake              |

No composite indexes are required: every ARC query uses equality filters only
and sorts in memory. Adding an `orderBy` to one of them would need a composite
index (the failure is logged as `[fnName]`).

#### Expiring the throwaway collections

Most ARC collections hold one document per entity and stay naturally bounded.
Two don't: `arcTokens` gains a document for every sign-in link ever requested,
and `arcReadThrottle` one for every reader who has ever opened a chapter. Left
alone they only ever grow.

Both write a **`purgeAt`** timestamp for Firestore's [native TTL][ttl] to
collect — one hour after the last write for a throttle window, 24 hours after
issue for a token (comfortably past its own 15-minute validity, so a stale link
still reports "expired" rather than the blanker "invalid"). Enable one policy
per collection, once:

```bash
gcloud firestore fields ttls update purgeAt \
  --collection-group=arcTokens --enable-ttl --project=YOUR_PROJECT_ID
gcloud firestore fields ttls update purgeAt \
  --collection-group=arcReadThrottle --enable-ttl --project=YOUR_PROJECT_ID
```

Or in the Firebase console: **Firestore → Time-to-live → Create policy**, once
for each collection, with `purgeAt` as the field.

Deletion is asynchronous — Google's stated target is within 24 hours of the
timestamp, not at it. That's fine here, because nothing in the app depends on
the sweep having run: every expiry decision is made from the document's own
fields, so a document that outlives its `purgeAt` is wasted storage and never
wrong behaviour. Skipping the setup entirely costs storage, nothing more.

[ttl]: https://firebase.google.com/docs/firestore/ttl

### ARC program flow

1. A reader applies at `/arc` → `arcApplications` (pending).
2. You approve at `/admin/arc`, choosing which books they get → `arcReaders`, plus an approval email.
3. They request a link at `/arc/signin`, confirm it at `/arc/verify`, and read at `/arc/read/[slug]`.
4. They submit a review from their library → `arcReviews` (pending).
5. You publish it at `/admin/arc/reviews` — it then appears on the book page and in its
   `Review` / `aggregateRating` structured data, labelled "Received a free
   advance copy" — the material connection has to be disclosed, so the label
   says so plainly.

Revoking a reader locks them out immediately: every protected page re-reads the
`arcReaders` document, so the session cookie alone never grants access.

## Scripts

| Command         | Description                |
| --------------- | -------------------------- |
| `npm run dev`   | Start the dev server       |
| `npm run build` | Production build           |
| `npm run start` | Serve the production build |
| `npm run lint`  | Run ESLint                 |

> While the dev server is running, verify changes with `npx tsc --noEmit` rather than `npm run build` — a production build shares the `.next` cache with the dev server and can corrupt it.

## Deployment

Deploys on **Vercel**. Set the environment variables above in the Vercel project settings, then push to deploy.

- **Analytics:** after the first deploy, turn on Web Analytics in the Vercel dashboard (project → Analytics → Enable). Custom events (e.g. `newsletter_signup`) appear under Analytics → Events.
- **Amazon affiliate tags:** add per-marketplace tags to `ASSOCIATE_TAGS` in `lib/amazon.ts` when the Associates account is ready (link `rel="sponsored"` is already in place).
