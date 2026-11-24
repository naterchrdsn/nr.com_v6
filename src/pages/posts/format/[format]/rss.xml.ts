import { FORMATS, PUBLISHED_POSTS, label } from '../../../../data/publication';
import { rss } from '../../../../lib/publication';
export function getStaticPaths() { return FORMATS.map(format => ({ params: { format }, props: { format } })); }
export function GET({ props }: { props: { format: typeof FORMATS[number] } }) { const { format } = props; return new Response(rss(PUBLISHED_POSTS.filter(p => p.format === format), `/posts/format/${format}/rss.xml`, `Nate Richardson — ${label(format)}`), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }); }
