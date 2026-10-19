import assert from 'node:assert/strict';
import path from 'node:path';
export async function checkV05({ page, db, upload, artifacts }) {
  const button = (name) => page.getByRole('button', { name, exact: typeof name === 'string' });
  await button('Карты').click();
  await button(/^Mirage Материалов:/).click();
  await button(/^Смоки/).click();
  await button('Теги категории: #выход A').click();
  assert.equal(await button('Теги категории: #выход A').getAttribute('aria-pressed'), 'true');
  assert.equal(await button('Редактировать Старая раскидка').count(), 0);
  await button('Все теги').click();
  await button('Редактировать Старая раскидка').waitFor();
  await button('Карты').click();
  await button(/^Mirage Материалов:/).click();
  await button(/^Раскиды/).click();
  assert.equal(await button('Теги категории: #выход A').count(), 0);
  const title = 'Два смока с одной позиции';
  const before = (await db()).entries.find((e) => e.title === title);
  await button(`Редактировать ${title}`).click();
  await page
    .getByLabel('Выбрать скриншоты: Обложка раскида', { exact: true })
    .setInputFiles(upload('cover.jpg'));
  await page
    .getByLabel('Ссылка на видео YouTube', { exact: true })
    .fill('https://example.com/not-youtube');
  await button('Сохранить материал').click();
  await page.getByRole('alert').waitFor();
  await page
    .getByLabel('Ссылка на видео YouTube', { exact: true })
    .fill('https://youtu.be/M7lc1UVf-VE?t=23');
  await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>Video fixture</body></html>' }),
  );
  await button('Сохранить материал').click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  await page.locator('iframe.video-player').scrollIntoViewIfNeeded();
  assert.equal(
    await page.locator('iframe.video-player').getAttribute('src'),
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?playsinline=1&start=23',
  );
  await page.frameLocator('iframe.video-player').getByText('Video fixture').waitFor();
  const after = (await db()).entries.find((e) => e.title === title);
  assert.equal(after.cover.name, 'cover.jpg');
  assert.deepEqual(after.images, before.images);
  assert.deepEqual(after.lineups, before.lineups);
  await page.screenshot({ path: path.join(artifacts, 'desktop-video.png'), fullPage: true });
  await button('Карты').click();
  await button(/^Mirage Материалов:/).click();
  await button(/^Раскиды/).click();
  assert.equal(
    await page.getByRole('img', { name: title, exact: true }).getAttribute('src'),
    after.cover.data,
  );
  await button(`Редактировать ${title}`).click();
  await button('Удалить Обложка раскида').click();
  await page.getByLabel('Ссылка на видео YouTube', { exact: true }).fill('');
  await button('Сохранить материал').click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(await page.locator('iframe.video-player').count(), 0);
  assert.equal((await db()).entries.find((e) => e.title === title).cover, null);
  await page.unroute('https://www.youtube-nocookie.com/embed/**');
  console.log(
    'PASS: category tag filters, separate cover, video validation/embed/removal and screenshot preservation.',
  );
}
