# nr.com v6

Personal homepage for Nate Richardson: an interactive constellation pointing to Nacho Labs, projects, code, and social profiles. Each page load creates a new arrangement. Drag a star to rearrange it, or use arrow keys on its handle; labels remain normal links. New sky resets the arrangement. Motion respects the visitor's reduced-motion preference.

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

```sh
npm install      # Install dependencies
npm run dev      # Start dev server at localhost:4321
npm run build    # Build for production
npm run preview  # Preview production build locally
```

## Crawlers

SEO includes canonical URLs, Open Graph and X cards, Person structured data,
`/llms.txt`, `/index.md`, and a generated sitemap excluding the noindexed 404 page.
The existing Matomo Tag Manager container `8BNVnhE0` is retained (site ID 3).

## Publishing

Source: https://github.com/naterchrdsn/nr.com_v6. The previous `nr.com_v5` repository remains separate.
Build with `npm ci && npm run build`; publish `dist/` to the naterichardson.com
20i document root, excluding `prototypes/`. Preserve unrelated directories,
especially `analytics/` and `workout/`; never mirror-delete the hosting root.
Back up changed files before replacement, upload assets before HTML, purge the
site's StackCDN cache, and verify the bare public URL and analytics requests.
