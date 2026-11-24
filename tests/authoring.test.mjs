import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('authoring command imports Markdown as an unpublished validated draft and refuses duplicates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'publication-author-'));
  try {
    const body = join(dir, 'body.md');
    const output = join(dir, 'drafts.json');
    writeFileSync(body, 'Fixture text, never published.');
    writeFileSync(output, '[]');
    const args = ['scripts/draft-post.mjs', '--slug', 'test-draft', '--title', 'Test draft', '--body', body, '--output', output, '--date', '2026-11-24'];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const [draft] = JSON.parse(readFileSync(output));
    assert.equal(draft.body, 'Fixture text, never published.');
    assert.equal(draft.published, false);
    assert.equal(draft.format, 'note');
    assert.notEqual(spawnSync(process.execPath, args).status, 0);
    assert.equal(JSON.parse(readFileSync(output)).length, 1);
    assert.notEqual(spawnSync(process.execPath, [...args, '--format', 'link']).status, 0);
  } finally { rmSync(dir, { recursive: true }); }
});
