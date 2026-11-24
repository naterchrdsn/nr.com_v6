import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLICATIONS, validatePublications } from '../src/data/publication.ts';

try {
  const { values: v } = parseArgs({ options: Object.fromEntries(['slug', 'title', 'description', 'body', 'format', 'category', 'date', 'source-url', 'source-name', 'output'].map(key => [key, { type: 'string' }])) });
  if (!v.slug || !v.title || !v.body) throw new Error('Usage: npm run post:draft -- --slug my-note --title "My note" --body path/to/note.md [--format note] [--category development] [--date YYYY-MM-DD] [--source-url URL --source-name Name]');
  const output = v.output ? resolve(v.output) : new URL('../src/data/authored-posts.json', import.meta.url);
  const drafts = JSON.parse(readFileSync(output, 'utf8'));
  if (!Array.isArray(drafts)) throw new Error('Draft registry must be an array');
  const body = readFileSync(resolve(v.body), 'utf8');
  const post = { slug: v.slug, title: v.title, description: v.description ?? v.title, publishedAt: v.date ?? new Date().toISOString().slice(0, 10), format: v.format ?? 'note', categories: (v.category ?? 'development').split(','), published: false, body, ...(v['source-url'] ? { sourceUrl: v['source-url'], sourceName: v['source-name'] } : {}) };
  // Check against the entire publication as well as an explicitly selected draft file.
  validatePublications([...PUBLICATIONS, ...(v.output ? drafts : []), post]);
  const temporary = typeof output === 'string' ? `${output}.pending` : new URL(`${output.href}.pending`);
  writeFileSync(temporary, `${JSON.stringify([...drafts, post], null, 2)}\n`, { flag: 'wx' });
  renameSync(temporary, output);
  console.log(`Created unpublished ${post.format}: ${post.slug}. Review the draft and set published to true only when approved.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
