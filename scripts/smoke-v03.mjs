import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkV03({ page, db, upload, artifacts }) {
  const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' });
  const heading = (name) => page.getByRole('heading', { name, exact: true });
  const saveMaterial = async (name) => {
    await button('Сохранить материал').click();
    await heading(name).waitFor();
  };
  await button('Карты').click();
  await button(/^Mirage Материалов:/).click();
  await button(/^Смоки/).click();
  const tops = await page
    .locator('.entry-image')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().top));
  assert.ok(
    Math.abs(tops[0] - tops[1]) < 1,
    'tagged and untagged thumbnails must start at the same height',
  );
  await page.getByRole('textbox', { name: 'Поиск', exact: true }).focus();
  assert.equal(
    await page.locator('.search input').evaluate((n) => getComputedStyle(n).outlineStyle),
    'none',
  );
  assert.equal(
    await page.locator('.search').evaluate((n) => getComputedStyle(n).outlineStyle),
    'solid',
  );
  assert.equal(
    await page.locator('html').evaluate((n) => getComputedStyle(n).scrollbarWidth),
    'none',
  );
  await page.screenshot({ path: path.join(artifacts, 'desktop-cards-fixed.png'), fullPage: true });
  await button('Mirage').click();
  await button(/^Флешки/).click();
  await button('Добавить гранату').first().click();
  await page.getByRole('textbox', { name: /^Название/ }).fill('Тестовая флешка');
  await page.getByRole('textbox', { name: /^Откуда/ }).fill('Спавн');
  await page.getByRole('textbox', { name: /^Куда/ }).fill('Mid');
  await page.getByRole('combobox', { name: /Способ броска/ }).selectOption('Left click');
  assert.equal(await page.locator('.upload-grid .upload-tile').count(), 2);
  await page
    .getByLabel('Выбрать скриншоты', { exact: true })
    .setInputFiles([upload('position.jpg'), upload('aim.jpg')]);
  await saveMaterial('Тестовая флешка');
  assert.equal(await page.locator('.detail-shots figure').count(), 2);
  assert.equal(
    await page.locator('.throw-overlay').evaluate((n) => getComputedStyle(n).webkitTextStrokeWidth),
    '2px',
  );
  const flash = (await db()).entries.find((e) => e.title === 'Тестовая флешка');
  await button('Карты').click();
  await page.getByRole('textbox', { name: 'Поиск', exact: true }).fill('Тестовая флешка');
  await page.locator('.card-main').click();
  await heading('Тестовая флешка').waitFor();
  await button('Назад').click();
  await page.waitForFunction(
    () => document.querySelector('.search input')?.value === 'Тестовая флешка',
  );
  assert.equal(await button('Стрельба').count(), 0);
  assert.equal(await button('Пики').count(), 0);
  await button('Руководство').click();
  await button('Создать тему').click();
  await page.getByRole('textbox', { name: 'Название темы' }).fill('Стрельба');
  await button('Сохранить').click();
  await heading('Стрельба').waitFor();
  await button('Создать подтему').click();
  await page.getByRole('textbox', { name: 'Название подтемы' }).fill('Подготовка выхода');
  await page
    .getByRole('textbox', { name: 'Описание Markdown' })
    .fill('# Разминка\n\n' + 'Проверь позицию и команду.\n\n'.repeat(50));
  await button('Вставить ссылку').click();
  await page.getByRole('textbox', { name: 'Найти материал или подтему' }).fill('Тестовая флешка');
  await button(/^Тестовая флешка ·/).click();
  await button('Сохранить').click();
  await heading('Подготовка выхода').waitFor();
  const first = (await db()).guideArticles[0];
  assert.ok(first.markdown.includes(`cs2://material/${flash.id}`));
  await button('Тестовая флешка').scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  assert.ok(scroll > 300);
  await button('Тестовая флешка').click();
  await heading('Тестовая флешка').waitFor();
  await button('Назад').click();
  await heading('Подготовка выхода').waitFor();
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 3, scroll);
  await button('Вперёд').click();
  await heading('Тестовая флешка').waitFor();
  await button('Редактировать').click();
  await page.getByRole('textbox', { name: /^Название/ }).fill('Флешка после переименования');
  await saveMaterial('Флешка после переименования');
  await button('Руководство').click();
  await button('Стрельба').click();
  await button('Подготовка выхода').click();
  await button('Тестовая флешка').click();
  await heading('Флешка после переименования').waitFor();
  await button('Назад').click();
  await heading('Подготовка выхода').waitFor();
  await button('Создать подтему').click();
  await page.getByRole('textbox', { name: 'Название подтемы' }).fill('План тренировки');
  await page.getByRole('textbox', { name: 'Описание Markdown' }).fill('## План\n\n');
  await button('Вставить ссылку').click();
  await page.getByRole('textbox', { name: 'Найти материал или подтему' }).fill('Подготовка выхода');
  await button(/^Подготовка выхода ·/).click();
  await button('Сохранить').click();
  await heading('План тренировки').waitFor();
  await button('Подготовка выхода').click();
  await heading('Подготовка выхода').waitFor();
  await button('Тестовая флешка').click();
  await heading('Флешка после переименования').waitFor();
  await button('Назад').click();
  await heading('Подготовка выхода').waitFor();
  await button('Назад').click();
  await heading('План тренировки').waitFor();
  await page.screenshot({ path: path.join(artifacts, 'desktop-guide.png'), fullPage: true });
  // The draft must survive cancellation of navigation through a preview link.
  await button('Редактировать').click();
  await page.getByRole('textbox', { name: 'Название подтемы' }).fill('Несохранённое');
  await button('Просмотр').click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Подготовка выхода', exact: true })
    .click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Название подтемы' }).inputValue(),
    'Несохранённое',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await button('Отмена').click();
  await button('Подготовка выхода').click();
  await button('Тестовая флешка').click();
  await button('Удалить Флешка после переименования').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
  await button('Руководство').click();
  await button('Стрельба').click();
  await button('Подготовка выхода').click();
  await button('Тестовая флешка').click();
  await page.getByRole('status').filter({ hasText: 'Материал недоступен' }).waitFor();
  await heading('Подготовка выхода').waitFor();
  assert.equal((await db()).guideArticles.length, 2);
  await button('Создать тему').click();
  await page.getByRole('textbox', { name: 'Название темы' }).fill('Временная тема');
  await button('Сохранить').click();
  await heading('Временная тема').waitFor();
  await button('Создать подтему').click();
  await page.getByRole('textbox', { name: 'Название подтемы' }).fill('Подтема');
  await button('Сохранить').click();
  await heading('Подтема').waitFor();
  await button('Редактировать').click();
  await page.getByRole('textbox', { name: 'Название подтемы' }).fill('Изменённая подтема');
  await button('Сохранить').click();
  await heading('Изменённая подтема').waitFor();
  assert.ok((await db()).guideArticles.some((a) => a.title === 'Изменённая подтема'));
  page.once('dialog', (dialog) => dialog.accept());
  await button('Удалить Временная тема').click();
  await page.waitForFunction(() => !document.querySelector('.guide-detail'));
  assert.equal((await db()).guideTopics.length, 1);
  assert.equal((await db()).guideArticles.length, 2);
  console.log(
    'PASS: flash without result, fixed cards/search, guide CRUD, link picker, rename-safe links, back/forward + scroll, nested history, unsaved guard and missing target.',
  );
}
