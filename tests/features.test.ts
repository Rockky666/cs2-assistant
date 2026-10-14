import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  categories,
  emptyDatabase,
  newEntry,
  parseDatabase,
  sortPinned,
  type Category,
  type Shot,
} from '../src/model';
import { moveEntryCategory } from '../src/editor-model';
import { messages, translator } from '../src/messages';
import { readDatabase, writeDatabase } from '../electron/storage';
import { backgroundFor, mapAssets, positionsFor, themeLogos } from '../src/assets';

const shot = (): Shot => ({
  id: crypto.randomUUID(),
  name: 'test.png',
  data: 'data:image/png;base64,aGVsbG8=',
});
const utility = () => ({
  ...newEntry('mirage', 'smoke', 'utility'),
  title: 'Джангл',
  from: 'Т-спавн',
  to: 'Джангл',
  throwType: 'Jumpthrow',
  images: [shot(), shot(), shot()],
});
test('v1 files migrate without losing notes, images, order or commands; first write backs up the original', async () => {
  const { tags, pinned, lineups, ...oldEntry } = utility();
  const old = {
    version: 1,
    entries: [oldEntry],
    commands: [{ id: crypto.randomUUID(), title: 'FPS', command: 'cl_showfps 1' }],
    customThrows: ['Step + jump'],
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-migrate-'));
  const file = path.join(dir, 'library.json');
  try {
    const original = JSON.stringify(old);
    await writeFile(file, original);
    const migrated = await readDatabase(file);
    assert.equal(migrated.version, 3);
    assert.deepEqual(migrated.entries[0].images, oldEntry.images);
    assert.equal(migrated.entries[0].pinned, false);
    assert.deepEqual(migrated.entries[0].tags, []);
    assert.equal(migrated.commands[0].command, old.commands[0].command);
    assert.deepEqual(migrated.settings, { language: 'ru', theme: 'dark' });
    assert.equal(await readFile(file, 'utf8'), original);
    await writeDatabase(file, migrated);
    assert.equal(await readFile(file + '.bak', 'utf8'), original);
    assert.equal((await readDatabase(file)).version, 3);
    assert.throws(
      () => parseDatabase({ ...old, entries: [{ ...oldEntry, from: '' }] }),
      /ERR_INVALID_DATA/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('custom categories must exist on the right map and retain their required fields', () => {
  const custom = {
    id: crypto.randomUUID(),
    mapId: 'mirage' as const,
    name: 'One-way',
    kind: 'utility' as const,
  };
  const db = {
    ...emptyDatabase(),
    customCategories: [custom],
    entries: [{ ...utility(), categoryId: custom.id }],
  };
  assert.equal(parseDatabase(db).entries[0].categoryId, custom.id);
  assert.throws(() => parseDatabase({ ...db, customCategories: [] }));
  assert.throws(() => parseDatabase({ ...db, customCategories: [{ ...custom, mapId: 'nuke' }] }));
  assert.throws(() => parseDatabase({ ...db, entries: [{ ...db.entries[0], throwType: '' }] }));
  assert.throws(() =>
    parseDatabase({
      ...db,
      customCategories: [custom, { ...custom, id: crypto.randomUUID(), name: 'ONE-WAY' }],
    }),
  );
});
test('pins outrank dates, unpin restores date order, and sorting never mutates input', () => {
  const rows = [
    { id: 'new', pinned: false, updatedAt: '2026-10-14' },
    { id: 'old', pinned: true, updatedAt: '2026-10-01' },
  ];
  assert.deepEqual(
    sortPinned(rows).map((r) => r.id),
    ['old', 'new'],
  );
  assert.equal(rows[0].id, 'new');
  assert.deepEqual(
    sortPinned(rows.map((r) => ({ ...r, pinned: false }))).map((r) => r.id),
    ['new', 'old'],
  );
});
test('category conversion preserves screenshot order and refuses conversions that exceed the limit', () => {
  const original = utility();
  const smoke = categories.find((c) => c.id === 'smoke')!;
  const lineup = categories.find((c) => c.id === 'lineup')!;
  const converted = moveEntryCategory(original, smoke, lineup);
  assert.deepEqual(converted.images, [original.images[0]]);
  assert.equal(converted.lineups[0].aim?.id, original.images[1].id);
  assert.equal(converted.lineups[0].result?.id, original.images[2].id);
  const restored = moveEntryCategory(converted, lineup, smoke);
  assert.deepEqual(restored, original);
  assert.throws(
    () =>
      moveEntryCategory(
        {
          ...converted,
          lineups: Array.from({ length: 20 }, () => ({
            ...converted.lineups[0],
            id: crypto.randomUUID(),
            aim: shot(),
            result: shot(),
          })),
        },
        lineup,
        smoke,
      ),
    /ERR_IMAGES_LIMIT/,
  );
});
test('v3 backup round-trip preserves lineups, tags, pins, settings, custom categories and crosshairs', () => {
  const custom: Category = {
    id: crypto.randomUUID(),
    name: 'Retakes',
    kind: 'lineup',
    mapId: 'mirage',
  };
  const entry = moveEntryCategory(utility(), categories[0], custom);
  const db = {
    ...emptyDatabase(),
    settings: { language: 'pt', theme: 'orange' },
    customCategories: [custom],
    entries: [
      {
        ...entry,
        pinned: true,
        tags: ['A', 'retake'],
        lineups: [
          ...entry.lineups,
          { id: crypto.randomUUID(), to: 'CT', throwType: 'Left click', aim: shot(), result: null },
        ],
      },
    ],
    crosshairs: [
      {
        id: crypto.randomUUID(),
        code: 'CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee',
        image: shot(),
        pinned: true,
        updatedAt: new Date().toISOString(),
      },
    ],
  };
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(db))), db);
  assert.throws(() => parseDatabase({ ...db, entries: [{ ...db.entries[0], tags: ['A', 'a'] }] }));
  assert.throws(() =>
    parseDatabase({ ...db, entries: [{ ...db.entries[0], images: [shot(), shot()] }] }),
  );
  assert.throws(() => parseDatabase({ ...db, crosshairs: [{ ...db.crosshairs[0], code: '   ' }] }));
  assert.throws(() => parseDatabase({ ...db, settings: { language: 'en', theme: 'unknown' } }));
});
test('all three translations are present and keep the same placeholders', () => {
  for (const [key, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 3, key);
    const parameters = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const translated of translations) {
      assert.ok(translated.length > 0, key);
      assert.deepEqual(parameters(translated), parameters(translations[0]), key);
    }
  }
  assert.equal(translator('pt')('settings'), 'Definições');
});
test('every configured offline map and logo asset exists; Ancient reports the missing alternative explicitly', async () => {
  for (const id of Object.keys(mapAssets) as Array<keyof typeof mapAssets>) {
    for (const asset of [
      backgroundFor(id),
      positionsFor(id, false),
      ...(mapAssets[id].alternative ? [positionsFor(id, true)] : []),
    ])
      assert.ok((await readFile(path.join('public', asset))).length > 0, asset);
  }
  for (const asset of Object.values(themeLogos))
    assert.ok((await readFile(path.join('public', asset))).length > 0);
  assert.equal(mapAssets.ancient.alternative, undefined);
});
