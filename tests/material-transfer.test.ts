import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDatabase, newEntry, newLineup, type Database } from '../src/model';
import { exportMaterial, importMaterial, parseMaterialTransfer } from '../src/material-transfer';

const smoke = () => ({
  ...newEntry('mirage', 'smoke', 'utility'),
  title: 'Smoke',
  from: 'Spawn',
  to: 'CT',
  throwType: 'Step throw',
  pinned: true,
  tags: ['A'],
  images: [{ id: crypto.randomUUID(), name: 'aim.png', data: 'data:image/png;base64,aGVsbG8=' }],
});
test('single material export excludes unrelated library data; import adds fresh copies without overwriting', () => {
  const entry = smoke();
  entry.markdown = `[self](cs2://material/${entry.id})`;
  const source = { ...emptyDatabase(), entries: [entry, { ...smoke(), title: 'Private note' }] };
  const file = exportMaterial(source, entry.id);
  assert.deepEqual(Object.keys(file).sort(), ['category', 'entry', 'format', 'version']);
  assert.ok(!JSON.stringify(file).includes('Private note'));
  const original = JSON.stringify(source);
  const result = importMaterial(source, JSON.parse(JSON.stringify(file)));
  const imported = result.data.entries[2];
  assert.notEqual(imported.id, entry.id);
  assert.equal(imported.pinned, false);
  assert.deepEqual(imported.images, entry.images);
  assert.deepEqual(imported.tags, entry.tags);
  assert.equal(imported.markdown, `[self](cs2://material/${imported.id})`);
  assert.equal(JSON.stringify(source), original);
  assert.deepEqual(result.data.entries.slice(0, 2), source.entries);
  assert.deepEqual(result.data.settings, source.settings);
  assert.ok(result.data.customThrows.includes('Step throw'));
  assert.equal(importMaterial(result.data, file).data.entries.length, 4);
});
test('custom category collisions preserve local categories and reuse matching types on repeat import', () => {
  const category = {
    id: crypto.randomUUID(),
    mapId: 'mirage' as const,
    name: 'Retakes',
    kind: 'utility' as const,
  };
  const source = {
    ...emptyDatabase(),
    customCategories: [category],
    entries: [{ ...smoke(), categoryId: category.id }],
  };
  const file = exportMaterial(source, source.entries[0].id);
  const target: Database = {
    ...emptyDatabase(),
    customCategories: [{ ...category, kind: 'note' }],
  };
  const result = importMaterial(target, file).data;
  assert.equal(result.customCategories[0].kind, 'note');
  assert.equal(result.customCategories[1].name, 'Retakes (2)');
  assert.notEqual(result.entries[0].categoryId, category.id);
  const matching = {
    ...emptyDatabase(),
    customCategories: [{ ...category, id: crypto.randomUUID() }],
  };
  const reused = importMaterial(matching, file).data;
  assert.equal(reused.customCategories.length, 1);
  assert.equal(reused.entries[0].categoryId, matching.customCategories[0].id);
});
test('lineup transfer retains all variants and rejects invalid envelopes and missing dependencies', () => {
  const category = {
    id: crypto.randomUUID(),
    mapId: 'mirage' as const,
    name: 'Custom setups',
    kind: 'lineup' as const,
  };
  const entry = {
    ...smoke(),
    categoryId: category.id,
    lineups: [{ ...newLineup(), to: 'CT', throwType: 'Jumpthrow', aim: smoke().images[0] }],
  };
  const source = { ...emptyDatabase(), customCategories: [category], entries: [entry] };
  const file = exportMaterial(source, entry.id);
  assert.deepEqual(importMaterial(emptyDatabase(), file).data.entries[0].lineups, entry.lineups);
  for (const value of [
    source,
    { ...file, version: 9 },
    { ...file, category: null },
    { ...file, category: { ...category, mapId: 'nuke' } },
    { ...file, entry: { ...entry, images: [{ ...entry.images[0], data: 'javascript:alert(1)' }] } },
  ])
    assert.throws(() => parseMaterialTransfer(value), /ERR_MATERIAL_FILE/);
});
