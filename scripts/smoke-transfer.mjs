import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function checkTransfer({ app, page, db, dir }) {
  const button = (name) => page.getByRole('button', { name, exact: true });
  const file = path.join(dir, 'friend.cs2material');
  const before = await db();
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, file);
  await button('Карты').click();
  await page.getByRole('button', { name: /^Mirage Материалов:/ }).click();
  await page.getByRole('button', { name: /^Смоки/ }).click();
  await button('Поделиться Смок в джангл').click();
  await page.getByRole('status').filter({ hasText: 'Файл материала сохранён' }).waitFor();
  const exported = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(exported.format, 'cs2-assistant-material');
  assert.equal(exported.entry.title, 'Смок в джангл');
  assert.equal(exported.entries, undefined);
  exported.entry.title = 'Смок от друга';
  await writeFile(file, JSON.stringify(exported));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    dialog.showMessageBox = async () => ({ response: 0 });
  }, file);
  await button('Импорт материала').click();
  await page.waitForFunction(
    () => !document.querySelector('button[aria-label="Импорт материала"]').disabled,
  );
  assert.deepEqual(await db(), before);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  await button('Импорт материала').click();
  await page.getByRole('heading', { name: 'Смок от друга', exact: true }).waitFor();
  const after = await db();
  assert.equal(after.entries.length, before.entries.length + 1);
  assert.deepEqual(after.entries.slice(0, -1), before.entries);
  assert.deepEqual(after.settings, before.settings);
  assert.deepEqual(after.guideArticles, before.guideArticles);
  const imported = after.entries.at(-1);
  assert.notEqual(imported.id, exported.entry.id);
  assert.deepEqual(imported.images, exported.entry.images);
  await button('Поделиться').click();
  await page.getByRole('status').filter({ hasText: 'Файл материала сохранён' }).waitFor();
  assert.equal(JSON.parse(await readFile(file, 'utf8')).entry.id, imported.id);
  await writeFile(file, JSON.stringify(before));
  await button('Импорт материала').click();
  await page.getByRole('alert').filter({ hasText: 'Не удалось прочитать материал' }).waitFor();
  assert.deepEqual(await db(), after);
  await button('Закрыть').click();
  await button('Удалить Смок от друга').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await button('Редактировать Смок в джангл').waitFor();
  console.log(
    'PASS: single-material export, friend import, cancel, non-destructive merge, images and invalid-file rejection.',
  );
}
