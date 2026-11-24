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
The six existing articles copied from Nacho Labs remain unchanged. Public release
updates from curated own-work projects are imported with explicit GitHub source
attribution; other empty short-format archives are intentional, not filler content.

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
approved posts), `imported-updates.json` (attributed public own-work releases).
Imported updates carry `sourceUrl`, `sourceName` and a stable numeric-release `guid`.
Research candidates stay unpublished pending editorial review.

### Own-activity sources

`config/activity-sources.json` is a deliberately small allowlist, cross-checked
against the public project catalog in `nacho-labs/content/projects.ts`: **point-grab**,
**hermes-plugin-nachos**, and **FridgeShare**, all under `Nacho-Labs-LLC`. These are
own projects, not arbitrary forks, client repositories, commits or starred links.
The importer checks each repository is still public, nonfork and nonarchived.
Only unauthenticated public GitHub API requests are made; no ambient token is used.

```sh
npm run activity:status            # fetch source health, counts and selected IDs; no writes
npm run activity:import            # same dry-run, default
npm run activity:import -- --write # explicitly update the local registry
npm run posts:validate
npm run test:unit && npm run check && npm run build
```

Each refresh adds at most the latest **published stable release per project**.
Drafts and prereleases are excluded. Dates come from `published_at`, never refresh
time. GUIDs use `github:release:<numeric-id>` and slugs use the same immutable ID;
the original release URL preserves project/source identity. Previously imported
releases are retained as immutable snapshots, even when the latest release changes
or a source returns no stable releases. Repeated imports produce identical bytes.
Bodies are neutral release notices attributed to GitHub, not invented first-person
commentary or copied third-party reporting. New releases in this explicit allowlist
are intentionally `published: true` in local build data; `--write` is the import
approval boundary. Review the resulting diff before committing or deploying.

Requests have a 15-second timeout, 2 MB response cap, and at most three 100-release
pages per project. The importer fails closed on pagination overflow, malformed
responses, unsafe/foreign release URLs, private/fork/archived sources or API errors.
403/429 errors report rate-limit/reset/retry-after headers for manual retry rather
than hammering the API. **Any source or schema failure leaves the previous registry
untouched**; validated writes use same-directory atomic replacement. A failed status
command exits nonzero and identifies the failing source; preceding source statuses
are informational only, not a partially accepted import.

No personal TIL/tools/research endpoints were found (404 in source discovery), so
none are configured or fabricated. External editorial sources remain in the
separate private `nacho-content-pipeline/newsroom/sources.json`; Simon's personal
sources and external news are not Nate-authored work. There is no cron, automatic
build-time network fetch, public publishing hook or deployment in this integration.
Refresh manually, then run the ordinary offline build.

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
