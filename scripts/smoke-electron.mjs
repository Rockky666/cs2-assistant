import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Real Electron window and IPC, isolated from the user's personal library.
const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-desktop-'));
const artifacts = path.resolve('output/playwright');
await mkdir(artifacts, { recursive: true });
const env = { ...process.env, CS2_TEST_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
let app;
const errors = [];
async function launch() {
  app = await electron.launch({ args: ['.'], env });
  const page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(10000);
  await page.getByRole('heading', { name: 'Выбери карту' }).waitFor();
  return page;
}
try {
  let page = await launch();
  await page.screenshot({ path: path.join(artifacts, 'desktop-home.png'), fullPage: true });
  assert.equal(await page.getByText('Предпросмотр интерфейса', { exact: false }).count(), 0);
  await page.getByRole('button', { name: 'Mirage 0 материалов', exact: true }).click();
  await page.getByRole('button', { name: /^Смоки/ }).click();
  await page.getByRole('button', { name: 'Добавить гранату', exact: true }).click();
  await page.getByLabel('Название', { exact: false }).fill('Смок в джангл');
  await page.getByLabel('Откуда', { exact: false }).fill('Т-спавн');
  await page
    .getByLabel('Куда', { exact: true })
    .count()
    .then(async (n) => {
      if (n) await page.getByLabel('Куда', { exact: true }).fill('Джангл');
      else await page.getByPlaceholder('Джангл', { exact: true }).fill('Джангл');
    });
  await page.getByRole('button', { name: 'Добавить свой способ броска', exact: true }).click();
  await page.getByRole('textbox', { name: 'Свой способ броска' }).fill('Шаг + jumpthrow');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  const fixture = await readFile(path.join(artifacts, 'desktop-home.png'));
  await page
    .getByLabel('Выбрать скриншоты')
    .setInputFiles(
      ['position.png', 'aim.png', 'result.png', 'extra.png'].map((name) => ({
        name,
        mimeType: 'image/png',
        buffer: fixture,
      })),
    );
  await page.getByRole('button', { name: 'Скриншот 4: переместить раньше' }).waitFor();
  await page.getByRole('button', { name: 'Скриншот 4: переместить раньше' }).click();
  await page
    .getByRole('textbox', { name: 'Описание Markdown' })
    .fill('## Проверка\n\n**Важная позиция**\n\n- Встать у стены\n- Проверить прицел');
  await page.getByRole('button', { name: 'Просмотр', exact: true }).click();
  await page.getByRole('heading', { name: 'Проверка', exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'desktop-editor.png'), fullPage: true });
  await page.getByRole('button', { name: 'Сохранить материал', exact: true }).click();
  await page.getByRole('heading', { name: 'Смок в джангл', exact: true }).waitFor();
  let db = JSON.parse(await readFile(path.join(dir, 'library.json'), 'utf8'));
  assert.equal(db.entries.length, 1);
  assert.equal(db.entries[0].images[2].name, 'extra.png');
  assert.equal(db.customThrows[0], 'Шаг + jumpthrow');
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('img', { name: 'position.png', exact: true }) })
    .click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Название', { exact: false }).fill('Джангл — проверено');
  await page.getByRole('button', { name: 'Удалить скриншот 4', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить материал', exact: true }).click();
  await page.getByRole('heading', { name: 'Джангл — проверено', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Карты', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск', exact: true }).fill('джангл');
  await page.getByRole('heading', { name: 'Джангл — проверено', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Очистить поиск' }).click();
  await page.getByRole('button', { name: 'Mirage 1 материалов', exact: true }).click();
  await page.getByRole('button', { name: /^Тактики/ }).click();
  await page.getByRole('button', { name: 'Добавить материал', exact: true }).first().click();
  await page.getByLabel('Название', { exact: false }).fill('Выход на A');
  await page
    .getByRole('textbox', { name: 'Описание Markdown' })
    .fill('# План\n\n1. Занять mid\n2. Выйти на A\n\n<script>window.bad=true</script>');
  await page.getByRole('button', { name: 'Сохранить материал' }).click();
  await page.getByRole('heading', { name: 'Выход на A', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.bad), undefined);
  await page.getByRole('button', { name: 'Консольные команды', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить команду', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название', exact: true }).fill('Тест FPS');
  await page.getByRole('textbox', { name: 'Команда', exact: true }).fill('cl_showfps 1');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: 'Копировать Тест FPS', exact: true }).click();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'cl_showfps 1');
  await page.getByRole('button', { name: 'Редактировать Тест FPS', exact: true }).click();
  await page.getByRole('textbox', { name: 'Команда', exact: true }).fill('cl_showfps 2');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByText('cl_showfps 2', { exact: true }).waitFor();
  await app.close();
  page = await launch();
  await page.getByRole('button', { name: 'Mirage 2 материалов', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Данные и резервные копии', exact: true }).click();
  const backup = path.join(dir, 'export.json');
  await app.evaluate(({ dialog }, backup) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: backup });
  }, backup);
  await page.getByRole('button', { name: 'Экспортировать', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Резервная копия сохранена' }).waitFor();
  const exported = JSON.parse(await readFile(backup, 'utf8'));
  assert.equal(exported.entries.length, 2);
  assert.equal(exported.commands[0].command, 'cl_showfps 2');
  await page.getByRole('button', { name: 'Консольные команды', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить Тест FPS', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('heading', { name: 'Твои команды будут здесь' }).waitFor();
  await page.getByRole('button', { name: 'Данные и резервные копии', exact: true }).click();
  await app.evaluate(({ dialog }, backup) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [backup] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, backup);
  await page.getByRole('button', { name: 'Восстановить из копии', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Библиотека восстановлена' }).waitFor();
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'library.json'), 'utf8')), exported);
  await writeFile(backup, '{"version":99}');
  await page.getByRole('button', { name: 'Восстановить из копии', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'library.json'), 'utf8')), exported);
  await page.getByRole('button', { name: 'Карты', exact: true }).click();
  await page.getByRole('button', { name: 'Mirage 2 материалов', exact: true }).click();
  await page.getByRole('button', { name: /^Смоки/ }).click();
  await page.getByRole('button', { name: 'Удалить Джангл — проверено', exact: true }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await page.getByRole('heading', { name: 'Джангл — проверено', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Удалить Джангл — проверено', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Здесь начинается твоя коллекция', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Карты', exact: true }).click();
  await page.setViewportSize({ width: 760, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'desktop-compact.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop CRUD, four screenshots and ordering, Markdown, search, clipboard, restart persistence, export/import, corrupt import rejection, delete/cancel and compact layout.',
  );
} finally {
  if (app) await app.close().catch(() => {});
  // Only the verified mkdtemp directory created by this test is removed.
  if (path.dirname(dir) === os.tmpdir() && path.basename(dir).startsWith('cs2-desktop-'))
    await rm(dir, { recursive: true, force: true });
}
