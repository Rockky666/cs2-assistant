import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { emptyDatabase } from '../src/model';
import { readDatabase, writeDatabase } from '../electron/storage';

test('a valid database above the former 100 MiB limit can be saved and reopened', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cs2-large-'));
  const file = path.join(directory, 'library.json');
  const topic = { id: crypto.randomUUID(), title: 'Large library' };
  const markdown = 'x'.repeat(100000);
  const db = {
    ...emptyDatabase(),
    guideTopics: [topic],
    guideArticles: Array.from({ length: 1100 }, (_, index) => ({
      id: crypto.randomUUID(),
      topicId: topic.id,
      title: `Article ${index}`,
      markdown,
      updatedAt: new Date().toISOString(),
    })),
  };
  try {
    await writeDatabase(file, db);
    assert.ok((await stat(file)).size > 100 * 1024 * 1024);
    const loaded = await readDatabase(file);
    assert.equal(loaded.guideArticles.length, 1100);
    assert.equal(loaded.guideArticles[1099].id, db.guideArticles[1099].id);
    assert.equal(loaded.guideArticles[1099].markdown, markdown);
  } finally {
    if (
      path.dirname(directory) === os.tmpdir() &&
      path.basename(directory).startsWith('cs2-large-')
    )
      await rm(directory, { recursive: true, force: true });
  }
});
