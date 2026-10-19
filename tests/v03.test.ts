import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDatabase, parseDatabase, newEntry } from '../src/model';
import { parseInternalLink } from '../src/links';

test('v2 migration preserves IDs and content, replaces only the removed theme, and leaves input untouched', () => {
  const { guideTopics, guideArticles, ...base } = emptyDatabase();
  const entry = { ...newEntry('mirage', 'tactic', 'note'), title: 'Plan', markdown: 'Keep this' };
  const old = {
    ...base,
    version: 2,
    entries: [entry],
    settings: { language: 'pt', theme: 'dark-green' },
  };
  const original = JSON.stringify(old);
  const migrated = parseDatabase(old);
  assert.equal(migrated.version, 4);
  assert.equal(migrated.settings.theme, 'dark');
  assert.equal(migrated.settings.language, 'pt');
  assert.deepEqual(migrated.entries, [entry]);
  assert.deepEqual(migrated.guideTopics, []);
  assert.equal(JSON.stringify(old), original);
  assert.equal(
    parseDatabase({ ...old, settings: { language: 'en', theme: 'dark-blue' } }).settings.theme,
    'dark-blue',
  );
});
test('guide export/import retains articles and internal IDs; orphan and duplicate IDs are rejected', () => {
  const topic = { id: crypto.randomUUID(), title: 'Стрельба' };
  const article = {
    id: crypto.randomUUID(),
    topicId: topic.id,
    title: 'Контроль',
    markdown: '## Тренировка',
    updatedAt: new Date().toISOString(),
  };
  const db = { ...emptyDatabase(), guideTopics: [topic], guideArticles: [article] };
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(db))), db);
  assert.throws(() => parseDatabase({ ...db, guideTopics: [] }));
  assert.throws(() => parseDatabase({ ...db, guideArticles: [article, article] }));
  assert.throws(() => parseDatabase({ ...db, guideArticles: [{ ...article, id: topic.id }] }));
});
test('internal links only accept exact material or guide UUID addresses', () => {
  const id = crypto.randomUUID();
  for (const kind of ['material', 'guide'])
    assert.deepEqual(parseInternalLink(`cs2://${kind}/${id}`), { kind, id });
  for (const url of [
    'javascript:alert(1)',
    'file:///C:/Windows',
    'https://example.com',
    `cs2://material/${id}/other`,
    `cs2://material/${id}?x=1`,
    'cs2://material/example',
  ])
    assert.equal(parseInternalLink(url), null);
});
test('flash can be saved without result and crosshair text no longer needs CSGO format', () => {
  const flash = {
    ...newEntry('mirage', 'flash', 'utility'),
    title: 'Flash',
    from: 'A',
    to: 'B',
    throwType: 'Left click',
  };
  const code = 'cl_crosshairsize 2; cl_crosshairgap -3';
  const db = {
    ...emptyDatabase(),
    entries: [flash],
    crosshairs: [
      {
        id: crypto.randomUUID(),
        code,
        image: {
          id: crypto.randomUUID(),
          name: 'test.png',
          data: 'data:image/png;base64,aGVsbG8=',
        },
        pinned: false,
        updatedAt: new Date().toISOString(),
      },
    ],
  };
  assert.equal(parseDatabase(db).crosshairs[0].code, code);
});
