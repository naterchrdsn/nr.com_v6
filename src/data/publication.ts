import migrated from './migrated-posts.json' with { type: 'json' };
import imported from './imported-updates.json' with { type: 'json' };
import authored from './authored-posts.json' with { type: 'json' };

export const FORMATS = ['article', 'note', 'link', 'quote', 'update'] as const;
export type PublicationFormat = typeof FORMATS[number];
export interface PublicationPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  format: PublicationFormat;
  categories: string[];
  published: boolean;
  body: string;
  sourceUrl?: string;
  sourceName?: string;
  guid?: string;
}
export const SITE = 'https://naterichardson.com';
export const postUrl = (post: PublicationPost) => `${SITE}/posts/${post.slug}/`;
export const label = (value: string) => ({ 'ai-agents': 'AI & agents', development: 'Development', article: 'Articles', note: 'Notes', link: 'Links', quote: 'Quotes', update: 'Updates' }[value] ?? value.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()));
export function validatePublications(posts: readonly PublicationPost[]): void {
  const slugs = new Set<string>();
  const guids = new Set<string>();
  const token = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const p of posts) {
    const fail = (message: string): never => { throw new Error(`Publication ${p?.slug}: ${message}`); };
    if (!p || !token.test(p.slug) || ['category', 'format'].includes(p.slug) || slugs.has(p.slug)) fail('invalid or duplicate slug');
    slugs.add(p.slug);
    for (const key of ['title', 'description', 'body'] as const) if (typeof p[key] !== 'string' || !p[key].trim()) fail(`missing ${key}`);
    if (!FORMATS.includes(p.format)) fail('invalid format');
    if (typeof p.published !== 'boolean') fail('published must be boolean');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.publishedAt) || !Number.isFinite(Date.parse(p.publishedAt)) || new Date(p.publishedAt).toISOString().slice(0, 10) !== p.publishedAt) fail('invalid date');
    if (!Array.isArray(p.categories) || !p.categories.length || p.categories.some(c => !token.test(c)) || new Set(p.categories).size !== p.categories.length) fail('invalid categories');
    if (['link', 'quote'].includes(p.format) && (!p.sourceUrl || !p.sourceName?.trim())) fail('source URL and attribution required');
    if (p.sourceUrl) {
      let url: URL;
      try { url = new URL(p.sourceUrl); } catch { fail('invalid source URL'); }
      if (!['http:', 'https:'].includes(url!.protocol) || url!.username || url!.password) fail('unsafe source URL');
      if (!p.sourceName?.trim()) fail('source name required');
    }
    const guid = p.guid ?? postUrl(p);
    if (typeof guid !== 'string' || !guid.trim() || guids.has(guid)) fail('invalid or duplicate GUID');
    guids.add(guid);
  }
}
export const PUBLICATIONS: PublicationPost[] = [...migrated, ...authored, ...imported] as PublicationPost[];
validatePublications(PUBLICATIONS);
export const PUBLISHED_POSTS = PUBLICATIONS.filter(p => p.published).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
export const CATEGORIES = [...new Set(PUBLISHED_POSTS.flatMap(p => p.categories))].sort();
