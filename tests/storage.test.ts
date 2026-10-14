import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readDatabase, writeDatabase } from '../electron/storage';
import { emptyDatabase, parseDatabase, type Entry } from '../src/model';

const entry = (): Entry => ({
  id: crypto.randomUUID(),
  mapId: 'mirage',
  categoryId: 'smoke',
  title: 'Джангл',
  from: 'Т-спавн',
  to: 'Джангл',
  throwType: 'Jumpthrow',
  markdown: '**Тест**',
  tags: [],
  pinned: false,
  lineups: [],
  images: [{ id: crypto.randomUUID(), name: 'shot.png', data: 'data:image/png;base64,aGVsbG8=' }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
test('empty install, persistence across reads and previous-version backup', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-test-'));
  const file = path.join(dir, 'library.json');
  try {
    assert.deepEqual(await readDatabase(file), emptyDatabase());
    const first = { ...emptyDatabase(), entries: [entry()], customThrows: ['Свой способ'] };
    await writeDatabase(file, first);
    assert.deepEqual(await readDatabase(file), first);
    const second = {
      ...first,
      commands: [{ id: crypto.randomUUID(), title: 'FPS', command: 'cl_showfps 1', pinned: false }],
    };
    await writeDatabase(file, second);
    assert.deepEqual(await readDatabase(file), second);
    assert.deepEqual(JSON.parse(await readFile(file + '.bak', 'utf8')), first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('corrupt and incompatible data fail without erasing the file', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-test-'));
  const file = path.join(dir, 'library.json');
  try {
    await writeFile(file, '{broken');
    await assert.rejects(readDatabase(file), /ERR_READ/);
    assert.equal(await readFile(file, 'utf8'), '{broken');
    await assert.rejects(writeDatabase(file, { version: 99 }), /ERR_INVALID_DATA/);
    assert.equal(await readFile(file, 'utf8'), '{broken');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('imports reject invalid categories, executable image data, duplicate IDs and incomplete throws', () => {
  const base = { ...emptyDatabase(), entries: [entry()] };
  assert.throws(() => parseDatabase({ ...base, version: 99 }));
  assert.throws(() => parseDatabase({ ...base, entries: [{ ...entry(), categoryId: 'unknown' }] }));
  assert.throws(() => parseDatabase({ ...base, entries: [{ ...entry(), from: ' ' }] }));
  assert.throws(() => parseDatabase({ ...base, entries: [base.entries[0], base.entries[0]] }));
  assert.throws(() =>
    parseDatabase({
      ...base,
      entries: [
        {
          ...entry(),
          images: [
            { id: crypto.randomUUID(), name: 'x.svg', data: 'data:image/svg+xml;base64,PHN2Zz4=' },
          ],
        },
      ],
    }),
  );
});
test('notes do not require throw fields and backup round-trip preserves image order', () => {
  const note = {
    ...entry(),
    categoryId: 'tactic',
    from: '',
    to: '',
    throwType: '',
    images: [entry().images[0], entry().images[0]],
  };
  const db = parseDatabase({ ...emptyDatabase(), entries: [note] });
  assert.deepEqual(parseDatabase(JSON.parse(JSON.stringify(db))), db);
  assert.equal(db.entries[0].images[1].id, note.images[1].id);
});
