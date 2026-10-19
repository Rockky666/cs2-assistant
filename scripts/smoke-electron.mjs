import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { checkV03 } from './smoke-v03.mjs';
import { checkTransfer } from './smoke-transfer.mjs';
import { checkV05 } from './smoke-v05.mjs';

const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-desktop-'));
const artifacts = path.resolve('output/playwright');
await mkdir(artifacts, { recursive: true });
const env = { ...process.env, CS2_TEST_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
const fixture = await readFile('public/assets/Map-backgrounds/Mirage.jpg');
const upload = (name) => ({ name, mimeType: 'image/jpeg', buffer: fixture });
const libraryFile = path.join(dir, 'library.json');
const legacy = {
  version: 1,
  entries: [
    {
      id: crypto.randomUUID(),
      mapId: 'mirage',
      categoryId: 'smoke',
      title: 'Старая раскидка',
      from: 'Т-спавн',
      to: 'CT',
      throwType: 'Jumpthrow',
      markdown: '**Заметка из версии 0.1**',
      images: [
        {
          id: crypto.randomUUID(),
          name: 'legacy.jpg',
          data: `data:image/jpeg;base64,${fixture.toString('base64')}`,
        },
      ],
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
  ],
  commands: [{ id: crypto.randomUUID(), title: 'Старый FPS', command: 'cl_showfps 1' }],
  customThrows: [],
};
await writeFile(libraryFile, JSON.stringify(legacy));
let app;
let page;
let originalClipboard;
const errors = [];
const db = async () => JSON.parse(await readFile(libraryFile, 'utf8'));
async function launch() {
  app = await electron.launch({ args: ['.'], env });
  page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(12000);
  await page.locator('.map-grid').waitFor();
}
const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' });
async function goMirage() {
  await button('Карты').click();
  await button(/^Mirage Материалов:/).click();
}
async function saveMaterial(name) {
  await button('Сохранить материал').click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
}
try {
  await launch();
  originalClipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.map-art img')].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.screenshot({ path: path.join(artifacts, 'desktop-home.png'), fullPage: true });
  assert.equal((await db()).version, 1, 'read-only migration must not rewrite the old file');
  await goMirage();
  await button(/^Смоки/).click();
  await button('Добавить гранату').click();
  await page.getByRole('textbox', { name: /^Название/ }).fill('Смок в джангл');
  await page.getByRole('textbox', { name: /^Откуда/ }).fill('Т-спавн');
  await page.getByRole('textbox', { name: /^Куда/ }).fill('Джангл');
  await button('Добавить свой способ броска').click();
  await page.getByRole('textbox', { name: 'Свой способ броска' }).fill('Шаг + jumpthrow');
  await button('Добавить').click();
  await page.getByLabel('Теги', { exact: true }).fill('выход A');
  await button('Добавить тег').click();
  await page
    .getByLabel('Выбрать скриншоты', { exact: true })
    .setInputFiles(['position.jpg', 'aim.jpg', 'result.jpg', 'extra.jpg'].map(upload));
  await button('Скриншот 4: Переместить раньше').click();
  await page
    .getByRole('textbox', { name: 'Описание Markdown' })
    .fill('## Проверка\n\n**Важная позиция**\n\n- Встать у стены');
  await button('Просмотр').click();
  await page.getByRole('heading', { name: 'Проверка', exact: true }).waitFor();
  await saveMaterial('Смок в джангл');
  assert.equal((await db()).version, 4);
  assert.equal(JSON.parse(await readFile(libraryFile + '.bak', 'utf8')).version, 1);
  assert.equal((await db()).entries[1].images[2].name, 'extra.jpg');
  assert.deepEqual((await db()).entries[1].tags, ['выход A']);
  assert.equal(await page.locator('.throw-overlay').textContent(), 'Шаг + jumpthrow');
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('img', { name: 'aim.jpg', exact: true }) })
    .click();
  assert.equal(
    await page.getByRole('dialog').locator('.throw-overlay').textContent(),
    'Шаг + jumpthrow',
  );
  await button('Закрыть').click();
  await button('Редактировать').click();
  await button('Удалить Скриншот 4').click();
  await saveMaterial('Смок в джангл');
  await button('Смоки').click();
  await button('Закрепить Старая раскидка').click();
  await button('Открепить Старая раскидка').waitFor();
  assert.equal(await page.locator('.entry-card h3').first().textContent(), 'Старая раскидка');
  await button('#выход A').click();
  assert.equal(await page.locator('.entry-card').count(), 1);
  await button('Все теги').click();
  console.log('PASS: v1 migration, utility CRUD, tags, pins, screenshot order and throw overlays.');

  await goMirage();
  await button(/^Тактики/).click();
  await button('Добавить материал').first().click();
  await page.getByRole('textbox', { name: /^Название/ }).fill('Разбор выхода');
  await button('Добавить категорию').click();
  await page.getByRole('textbox', { name: 'Название категории' }).fill('Разборы');
  await page.getByRole('combobox', { name: 'Тип материала' }).selectOption('note');
  await button('Добавить').click();
  await page
    .getByRole('textbox', { name: 'Описание Markdown' })
    .fill(
      '# План\n\n1. Занять mid\n\n<script>window.bad=true</script>\n\n[Смок](cs2://material/example)',
    );
  await page.getByLabel('Теги', { exact: true }).fill('команда');
  await saveMaterial('Разбор выхода');
  assert.equal(await page.evaluate(() => window.bad), undefined);
  assert.equal(await page.locator('.markdown a').count(), 0);
  assert.ok((await db()).customCategories.some((c) => c.name === 'Разборы'));
  assert.deepEqual((await db()).entries.find((e) => e.title === 'Разбор выхода').tags, ['команда']);
  await goMirage();
  await button(/^Разборы/).waitFor();
  await button(/^Раскиды/).click();
  await button('Добавить материал').first().click();
  await page.getByRole('textbox', { name: /^Название/ }).fill('Два смока с одной позиции');
  await page.getByRole('textbox', { name: /^Откуда/ }).fill('Т-спавн');
  await page
    .getByLabel('Выбрать скриншоты: Где стоять', { exact: true })
    .setInputFiles(upload('standing.jpg'));
  await page.getByRole('textbox', { name: 'Куда 1', exact: true }).fill('CT');
  await page.getByRole('combobox', { name: /Способ броска 1/ }).selectOption('Jumpthrow');
  await page
    .getByLabel('Выбрать скриншоты: Куда целиться 1', { exact: true })
    .setInputFiles(upload('ct-aim.jpg'));
  await page
    .getByLabel('Выбрать скриншоты: Результат броска 1', { exact: true })
    .setInputFiles(upload('ct-result.jpg'));
  await button('Добавить прицеливание и результат').click();
  await page.getByRole('textbox', { name: 'Куда 2', exact: true }).fill('Джангл');
  await page.getByRole('combobox', { name: /Способ броска 2/ }).selectOption('Left click');
  await page
    .getByLabel('Выбрать скриншоты: Куда целиться 2', { exact: true })
    .setInputFiles(upload('jungle-aim.jpg'));
  await page
    .getByLabel('Выбрать скриншоты: Результат броска 2', { exact: true })
    .setInputFiles(upload('jungle-result.jpg'));
  await button('Вариант 2: Переместить раньше').click();
  await saveMaterial('Два смока с одной позиции');
  const lineup = (await db()).entries.find((e) => e.categoryId === 'lineup');
  assert.equal(lineup.images.length, 1);
  assert.equal(lineup.lineups.length, 2);
  assert.equal(lineup.lineups[0].to, 'Джангл');
  assert.equal(lineup.lineups[0].aim.name, 'jungle-aim.jpg');
  assert.equal(await page.locator('.standing-detail figure').count(), 1);
  assert.deepEqual(await page.locator('.throw-overlay').allTextContents(), [
    'Left click',
    'Jumpthrow',
  ]);
  await page.screenshot({ path: path.join(artifacts, 'desktop-lineups.png'), fullPage: true });
  console.log('PASS: custom categories, pending tags, Markdown safety and multi-target lineups.');

  await button('Консольные команды').click();
  await button('Добавить команду').click();
  await page.getByRole('textbox', { name: 'Название', exact: true }).fill('Тест FPS');
  await page.getByRole('textbox', { name: 'Команда', exact: true }).fill('cl_showfps 2');
  await button('Сохранить').click();
  await button('Копировать Тест FPS').click();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), 'cl_showfps 2');
  await button('Закрепить Тест FPS').click();
  await button('Открепить Тест FPS').waitFor();
  assert.equal(await page.locator('.command-card h3').first().textContent(), 'Тест FPS');
  await button('Прицелы').click();
  await button('Добавить прицел').click();
  assert.equal(await page.getByRole('textbox', { name: 'Название', exact: true }).count(), 0);
  await page
    .getByLabel('Выбрать скриншоты: Скриншот прицела', { exact: true })
    .setInputFiles(upload('crosshair.jpg'));
  const code = 'CSGO-aaaaa-bbbbb-ccccc-ddddd-eeeee';
  const code2 = 'cl_crosshairsize 2; cl_crosshairgap -3';
  await page.getByRole('textbox', { name: 'Код импорта', exact: true }).fill(code);
  await button('Сохранить').click();
  await button(`Копировать ${code}`).click();
  assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), code);
  await button(`Редактировать ${code}`).click();
  await page.getByRole('textbox', { name: 'Код импорта' }).fill(code2);
  await button('Сохранить').click();
  await button(`Закрепить ${code2}`).click();
  await button(`Открепить ${code2}`).waitFor();
  await page.screenshot({ path: path.join(artifacts, 'desktop-crosshairs.png'), fullPage: true });
  console.log('PASS: command and crosshair CRUD, pinning and real clipboard.');

  for (const name of ['Dust 2', 'Mirage', 'Nuke', 'Ancient', 'Inferno', 'Anubis', 'Cache']) {
    await button('Карты').click();
    await button(new RegExp(`^${name} Материалов:`)).click();
    await page.getByRole('tab', { name: 'Карта', exact: true }).click();
    await page.waitForFunction(() => {
      const img = document.querySelector('.map-position-image img');
      return img?.complete && img.naturalWidth > 0;
    });
    if (name === 'Ancient') assert.equal(await button('Альтернативная').isDisabled(), true);
    else {
      const before = await page.locator('.map-position-image img').getAttribute('src');
      await button('Альтернативная').click();
      await page.waitForFunction(() => {
        const img = document.querySelector('.map-position-image img');
        return img?.complete && img.naturalWidth > 0;
      });
      assert.notEqual(await page.locator('.map-position-image img').getAttribute('src'), before);
      if (name === 'Mirage')
        await page.screenshot({ path: path.join(artifacts, 'desktop-map.png'), fullPage: true });
    }
  }
  await button('Настройки').click();
  for (const [name, theme, color, logo] of [
    ['Тёмная', 'dark', 'rgb(13, 13, 13)', 'Dark-logo'],
    ['Тёмно-красная', 'dark-red', 'rgb(72, 0, 2)', 'Red-logo'],
    ['Оранжевая', 'orange', 'rgb(33, 21, 13)', 'Orange-logo'],
    ['Светлая', 'light', 'rgb(244, 245, 247)', 'Light-logo'],
    ['Тёмно-синяя', 'dark-blue', 'rgb(11, 17, 32)', 'Blue-logo'],
  ]) {
    await button(new RegExp(`^${name}`)).click();
    await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, theme);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
      color,
    );
    assert.ok((await page.locator('.brand-mark img').getAttribute('src')).includes(logo));
    assert.equal((await db()).settings.theme, theme);
    await page.evaluate(() =>
      Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.waitForFunction(() =>
      [...document.querySelectorAll('.theme-preview img')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    if (theme === 'light' || theme === 'orange')
      await page.screenshot({
        path: path.join(artifacts, `desktop-theme-${theme}.png`),
        fullPage: true,
      });
  }
  await page.getByRole('combobox', { name: 'Язык интерфейса' }).selectOption('en');
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  await button(/^Dark red/).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark-red');
  await page.screenshot({ path: path.join(artifacts, 'desktop-settings.png'), fullPage: true });
  await button('Console commands').click();
  await page.getByRole('heading', { name: 'Console commands' }).waitFor();
  await button('Add command').click();
  await page.getByRole('dialog', { name: 'New command' }).waitFor();
  await button('Cancel').click();
  await button('Settings').click();
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('pt');
  await page.getByRole('heading', { name: 'Definições' }).waitFor();
  await button(/^Laranja/).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'orange');
  await button('Miras').click();
  await page.getByRole('heading', { name: 'Miras' }).waitFor();
  await app.close();
  await launch();
  assert.equal(await page.locator('html').getAttribute('lang'), 'pt');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'orange');
  const persisted = await db();
  assert.ok(persisted.entries.find((e) => e.title === 'Старая раскидка').pinned);
  assert.ok(persisted.crosshairs[0].pinned);
  await button('Definições').click();
  await page.getByRole('combobox', { name: 'Idioma da interface' }).selectOption('ru');
  await page.getByRole('heading', { name: 'Настройки', exact: true }).waitFor();
  console.log(
    'PASS: all map images, alternative maps, all theme colours/logos, three languages and restart persistence.',
  );

  await checkV03({ page, db, upload, artifacts });
  await checkTransfer({ app, page, db, dir });
  await checkV05({ page, db, upload, artifacts });
  const backup = path.join(dir, 'export.json');
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, backup);
  await button('Данные и резервные копии').click();
  await button('Экспортировать').click();
  await page.getByRole('status').filter({ hasText: 'Резервная копия сохранена' }).waitFor();
  const exported = JSON.parse(await readFile(backup, 'utf8'));
  await button('Прицелы').click();
  await button(`Удалить ${code2}`).click();
  await button('Отмена').click();
  await button(`Копировать ${code2}`).waitFor();
  await button(`Удалить ${code2}`).click();
  await button('Удалить').click();
  await page.getByRole('heading', { name: 'Твои прицелы будут здесь' }).waitFor();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  }, backup);
  await button('Данные и резервные копии').click();
  await button('Восстановить из копии').click();
  await page.getByRole('status').filter({ hasText: 'Библиотека восстановлена' }).waitFor();
  assert.deepEqual(await db(), exported);
  await writeFile(backup, '{"version":99}');
  await button('Восстановить из копии').click();
  await page.getByRole('alert').waitFor();
  assert.deepEqual(await db(), exported);
  await goMirage();
  await button(/^Смоки/).click();
  await button('Удалить Смок в джангл').click();
  await button('Удалить').click();
  await button('Редактировать Старая раскидка').waitFor();
  await button('Карты').click();
  await page.setViewportSize({ width: 760, height: 850 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, 'desktop-compact.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: full v4 backup round-trip, corrupt import rejection, delete/cancel and compact layout.',
  );
} catch (error) {
  console.error(error);
  if (page && !page.isClosed()) {
    await page
      .screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true })
      .catch(() => {});
    console.error((await page.locator('body').innerText()).slice(-7000));
  }
  throw error;
} finally {
  if (app) {
    await app
      .evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1;
      })
      .catch(() => {});
    if (originalClipboard !== undefined)
      await app
        .evaluate(({ clipboard }, text) => clipboard.writeText(text), originalClipboard)
        .catch(() => {});
    await app.close().catch(() => {});
  }
  if (path.dirname(dir) === os.tmpdir() && path.basename(dir).startsWith('cs2-desktop-'))
    await rm(dir, { recursive: true, force: true });
}
