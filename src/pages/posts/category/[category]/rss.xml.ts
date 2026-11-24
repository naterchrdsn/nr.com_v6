import { CATEGORIES, PUBLISHED_POSTS, label } from '../../../../data/publication';
import { rss } from '../../../../lib/publication';
export function getStaticPaths() { return CATEGORIES.map(category => ({ params: { category }, props: { category } })); }
export function GET({ props }: { props: { category: string } }) { const { category } = props; return new Response(rss(PUBLISHED_POSTS.filter(p => p.categories.includes(category)), `/posts/category/${category}/rss.xml`, `Nate Richardson — ${label(category)}`), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }); }
