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

```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
BLOG_ADMIN_SECRET=choose_a_private_password
# NEXT_PUBLIC_SITE_URL=https://www.aftabarbiyani.com
```

Without Firebase configured, the site still runs — the blog simply shows no posts and subscribe returns "not configured."

## Routes

| Path                                       | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `/`                                        | Author homepage                    |
| `/about`                                   | About / author bio (`ProfilePage`) |
| `/blog`                                    | Blog index                         |
| `/blog/[slug]`                             | Blog post                          |
| `/admin/login`, `/admin/blog`              | Admin login and post list          |
| `/admin/blog/new`, `/admin/blog/[id]/edit` | Create / edit a post               |
| `/api/subscribe`                           | Newsletter signup (POST)           |
| `/api/blog/[slug]/view`                    | View-count beacon (POST)           |
| `/api/link-preview`                        | Link-preview helper for the editor |

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
