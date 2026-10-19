import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeVideo } from '../src/video';
import { categoryTags, hasTag } from '../src/tag-filter';
import { emptyDatabase, newEntry, parseDatabase } from '../src/model';
import { exportMaterial, importMaterial } from '../src/material-transfer';

test('YouTube URLs normalize IDs and timestamps without accepting arbitrary iframe sources', () => {
  for (const path of [
    'https://youtu.be/M7lc1UVf-VE',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtube.com/shorts/M7lc1UVf-VE',
    'https://youtube.com/live/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
  ]) {
    assert.equal(youtubeVideo(path)?.id, 'M7lc1UVf-VE');
  }
  assert.equal(youtubeVideo('https://youtu.be/M7lc1UVf-VE?t=1h2m3s')?.start, 3723);
  assert.equal(youtubeVideo('https://youtu.be/M7lc1UVf-VE?start=72')?.start, 72);
  for (const url of [
    'javascript:alert(1)',
    'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE',
    'https://evil.test/embed/M7lc1UVf-VE',
    'https://user@youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtube.com/watch?v=bad',
    'file:///M7lc1UVf-VE',
  ])
    assert.equal(youtubeVideo(url), null);
});
test('category tag filters are scoped, case insensitive, exact and count materials', () => {
  const entry = { ...newEntry('mirage', 'tip', 'note'), title: 'A', tags: ['A', 'retake'] };
  const entries = [
    entry,
    { ...entry, tags: ['a'] },
    { ...entry, mapId: 'nuke' as const, tags: ['other'] },
    { ...entry, categoryId: 'position', tags: ['position'] },
  ];
  assert.deepEqual(categoryTags(entries, 'mirage', 'tip'), [
    { name: 'A', count: 2 },
    { name: 'retake', count: 1 },
  ]);
  assert.equal(hasTag(entry, 'a'), true);
  assert.equal(hasTag({ ...entry, tags: ['AA'] }, 'A'), false);
  assert.equal(hasTag({ ...entry, tags: [] }, 'A'), false);
});
test('schema 3 migrates safely; cover and video survive backup and individual sharing', () => {
  const entry = { ...newEntry('mirage', 'tip', 'note'), title: 'Video' };
  const { cover, videoUrl, ...oldEntry } = entry;
  const migrated = parseDatabase({ ...emptyDatabase(), version: 3, entries: [oldEntry] });
  assert.equal(migrated.entries[0].id, entry.id);
  assert.equal(migrated.entries[0].cover, null);
  assert.equal(migrated.entries[0].videoUrl, '');
  entry.cover = {
    id: crypto.randomUUID(),
    name: 'cover.png',
    data: 'data:image/png;base64,aGVsbG8=',
  };
  entry.videoUrl = 'https://youtu.be/M7lc1UVf-VE?t=23';
  const database = { ...emptyDatabase(), entries: [entry] };
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(database))), database);
  const file = exportMaterial(database, entry.id);
  assert.equal(file.version, 2);
  const imported = importMaterial(emptyDatabase(), file).data.entries[0];
  assert.deepEqual(imported.cover, entry.cover);
  assert.equal(imported.videoUrl, entry.videoUrl);
  assert.equal(
    importMaterial(emptyDatabase(), { ...file, version: 1, entry: oldEntry }).data.entries[0].cover,
    null,
  );
  assert.throws(() =>
    parseDatabase({ ...database, entries: [{ ...entry, videoUrl: 'https://evil.test/' }] }),
  );
});
