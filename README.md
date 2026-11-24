# nr.com v6

Personal site for Nate Richardson: an interactive constellation pointing to Posts, projects, code, and social profiles, plus a native mixed-format publication at `/posts/`. Each page load creates a new arrangement. Drag a star to rearrange it, or use arrow keys on its handle; labels remain normal links. New sky resets the arrangement. Motion respects the visitor's reduced-motion preference.

## Tech Stack

- **Astro** - Static site generator
- **TypeScript** - Type-safe scripting
- **Tailwind CSS 4** - Utility-first styling

## Project Structure

```text
src/
  data/          # social links
  layouts/       # BaseLayout (head, SEO, JSON-LD)
  pages/         # index, 404
  components/    # ConstellationHome and retained design experiments
  styles/        # global.css and retained legacy styles
public/
  llms.txt       # llms.txt summary for LLMs and crawlers
  index.md       # Markdown version of the homepage (linked via rel="alternate")
  scripts/       # constellation layout and drag handles
  prototypes/    # original design explorations; not deployed to production
  fonts/ icons/ images/
```

## Development

Requires Node.js 22.23.4 or newer (Astro 7).

```sh
npm install      # Install dependencies
npm run dev      # Start dev server at localhost:4321
npm run build    # Build for production
npm run preview  # Preview production build locally
npx playwright install chromium # Install the headless test browser once
npm test         # Desktop/mobile browser regression tests against dist/
```

## Crawlers

SEO includes canonical URLs, Open Graph and X cards, Person structured data,
`/llms.txt`, `/index.md`, and a generated sitemap excluding the noindexed 404 page.
The existing Matomo Tag Manager container `8BNVnhE0` is retained (site ID 3).

## Native publication

`/posts/` is chronological: articles show excerpts; notes, links, quotes and own-work
updates render their full Markdown body inline. Every entry has a permalink. Format
and topic navigation uses static archives, so reading and filtering require no JS.
The initial publication contains only the six existing articles copied from Nacho
Labs, unchanged. Empty short-format archives are intentional, not filler content.

### Authoring without TypeScript strings

Write a UTF-8 Markdown file, then create an **unpublished** draft:

```sh
npm run post:draft -- --slug my-note --title "My note" --body ./my-note.md --format note --category development
npm run posts:validate
```

Optional flags: `--description`, `--date YYYY-MM-DD`, `--source-url`, `--source-name`.
Use comma-separated category slugs for multiple topics. Formats are `article`,
`note`, `link`, `quote`, `update`; links and quotes require source URL and source
name. The CLI reads the Markdown into `src/data/authored-posts.json`, rejects
invalid dates/URLs and duplicate identities, and always sets `published: false`.
Review the draft and its source attribution; only set `published: true` after
approval. A date alone never publishes a draft. Do not fabricate commentary or
backfill short posts to make an archive appear populated.

### Registry and importer contract

`src/data/publication.ts` exports `PublicationPost`, `PublicationFormat`,
`PUBLICATIONS` (all records), `PUBLISHED_POSTS` (published, newest first), `FORMATS`,
`CATEGORIES`, and `validatePublications`. `PublicationPost` fields:

- Required: `slug`, `title`, `description`, `publishedAt` (real `YYYY-MM-DD`),
  `format`, nonempty `categories: string[]`, `published: boolean`, `body` (Markdown).
- Optional: `sourceUrl`, `sourceName`, `guid`. Source URLs must be HTTP(S), without
  embedded credentials. Links and quotes need both attribution fields.
- `guid` is a stable opaque feed identity; omit for new native posts to use their
  canonical personal-site URL. Never change the six legacy GUIDs.

Three arrays are combined and validated at build time:
`migrated-posts.json` (preserved originals), `authored-posts.json` (native drafts and
approved posts), `imported-updates.json` (reserved importer boundary, initially `[]`).
Importers must write the same schema, use stable GUIDs, preserve original source
attribution, dedupe, and explicitly gate publication; this site does not fetch or
schedule imports. Imported own-work updates should carry `sourceUrl`, `sourceName`
and `guid`. Research candidates stay unpublished pending editorial review.

### Feeds and migration identity

`/rss.xml` contains full rendered bodies, not excerpts. Every format has
`/posts/format/{article,note,link,quote,update}/rss.xml`; topics have
`/posts/category/<topic>/rss.xml`. Archives expose the applicable RSS link, and
HTML discovery tags advertise the all-posts feed plus the current filtered feed.
Canonical page/item URLs are on `naterichardson.com`; migrated item GUID text stays
`https://nacholabs.net/posts/<slug>` to avoid duplicating existing subscriptions.
Migrated Markdown is preserved in storage; rendering removes only its redundant
leading H1 and sanitizes HTML/unsafe URLs. The old Nacho Labs redirects/feed
forwarding are handled in that repository, not this one.

### Verification

```sh
npm run test:unit  # migration hashes, validation, rendering, draft CLI
npm run check     # Astro/TypeScript diagnostics
npm run build
npm test          # Chromium desktop/mobile against dist, loopback port 4326
npm run test:formats # disposable fixture build + real Chromium at 390/1440px
```

Set `PLAYWRIGHT_BROWSERS_PATH` when using a shared browser cache. The mixed-format
test builds a scratch checkout, verifies full short bodies/article excerpts,
attribution, quotes, draft exclusion, no-JS navigation and parsed RSS; fixture
content never touches the real registries or real `dist/`. These are local gates,
not a claim of hosted CI or production verification.

## Publishing

Source: https://github.com/naterchrdsn/nr.com_v6. The previous `nr.com_v5` repository remains separate.
Build with `npm ci && npm run build`; publish `dist/` to the naterichardson.com
20i document root, excluding `prototypes/`. Preserve unrelated directories,
especially `analytics/` and `workout/`; never mirror-delete the hosting root.
Back up changed files before replacement, upload assets before HTML, purge the
site's StackCDN cache, and verify the bare public URL and analytics requests.
