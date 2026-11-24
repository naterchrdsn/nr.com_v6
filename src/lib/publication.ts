import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { SITE, postUrl, label } from '../data/publication.ts';
import type { PublicationPost } from '../data/publication.ts';

export const escapeXml = (text: string): string => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
export const dateLabel = (date: string): string => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
export function bodyHtml(post: PublicationPost): string {
  const tokens = marked.lexer(post.body);
  const first = tokens.findIndex(t => t.type !== 'space');
  if (tokens[first]?.type === 'heading' && tokens[first].depth === 1) tokens.splice(first, 1);
  for (const t of tokens) if (t.type === 'heading' && t.depth === 1) t.depth = 2;
  const html = sanitizeHtml(marked.parser(tokens), { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt', 'title', 'width', 'height'] }, allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false });
  return post.format === 'quote' && !html.trimStart().startsWith('<blockquote>') ? `<blockquote>${html}</blockquote>` : html;
}
export function rss(posts: readonly PublicationPost[], path = '/rss.xml', title = 'Nate Richardson — Posts'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(title)}</title><link>${SITE}/posts/</link><description>Articles, notes, links, quotes and own-work updates from Nate Richardson.</description><language>en-us</language><atom:link href="${SITE}${escapeXml(path)}" rel="self" type="application/rss+xml"/>${posts.map(p => `<item><title>${escapeXml(p.title)}</title><link>${postUrl(p)}</link><guid isPermaLink="false">${escapeXml(p.guid ?? postUrl(p))}</guid><dc:creator>Nate Richardson</dc:creator><pubDate>${new Date(`${p.publishedAt}T00:00:00Z`).toUTCString()}</pubDate><description>${escapeXml(p.description)}</description>${p.categories.map(c => `<category>${escapeXml(label(c))}</category>`).join('')}<category>${p.format}</category><content:encoded>${escapeXml(bodyHtml(p) + (p.sourceUrl ? `<p>Source: <a href="${escapeXml(p.sourceUrl)}">${escapeXml(p.sourceName!)}</a></p>` : ''))}</content:encoded></item>`).join('')}</channel></rss>`;
}
