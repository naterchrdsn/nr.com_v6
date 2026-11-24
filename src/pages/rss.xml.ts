import { PUBLISHED_POSTS } from '../data/publication';
import { rss } from '../lib/publication';
export function GET() { return new Response(rss(PUBLISHED_POSTS), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }); }
