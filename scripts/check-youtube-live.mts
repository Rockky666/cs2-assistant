// Optional network check; requires an available embeddable YouTube video. Uses an isolated library.
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright-core';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { emptyDatabase, newEntry } from '../src/model.ts';
const dir = await mkdtemp(path.join(os.tmpdir(), 'cs2-video-'));
const env = { ...process.env, CS2_TEST_DATA_DIR: dir };
delete env.ELECTRON_RUN_AS_NODE;
const entry = {
  ...newEntry('mirage', 'tip', 'note'),
  title: 'YouTube playback test',
  videoUrl: 'https://youtu.be/M7lc1UVf-VE',
};
await writeFile(
  path.join(dir, 'library.json'),
  JSON.stringify({ ...emptyDatabase(), entries: [entry] }),
);
let app;
try {
  app = await electron.launch({ args: ['.'], env });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.embedHeaders = [];
    BrowserWindow.getAllWindows()[0].webContents.session.webRequest.onSendHeaders(
      { urls: ['https://www.youtube-nocookie.com/embed/*'] },
      (d) =>
        globalThis.embedHeaders.push({
          url: d.url,
          referer: d.requestHeaders.Referer ?? d.requestHeaders.referer,
        }),
    );
  });
  await page.getByRole('button', { name: /^Mirage Материалов:/ }).click();
  await page.getByRole('button', { name: /^Полезные фишки/ }).click();
  await page.getByText('YouTube playback test', { exact: true }).click();
  await page.locator('iframe.video-player').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe.video-player');
  try {
    await frame
      .getByRole('button', { name: /Воспроизвести|Play/i })
      .first()
      .click({ timeout: 20000 });
    await page.waitForFunction(() => false, {}, { timeout: 6000 }).catch(() => {});
  } catch (e) {
    console.log('Playback interaction:', e.message.slice(0, 200));
  }
  console.log('Headers:', await app.evaluate(() => globalThis.embedHeaders));
  console.log(
    'Player text:',
    await frame
      .locator('body')
      .innerText({ timeout: 5000 })
      .catch((e) => e.message.slice(0, 150)),
  );
  const state = await frame
    .locator('video')
    .evaluate((v) => ({ paused: v.paused, time: v.currentTime, error: v.error?.message }));
  console.log('Video state:', state);
  assert.equal(state.paused, false);
  assert.ok(state.time > 0);
  assert.equal(state.error, undefined);
  await page.screenshot({
    path: path.resolve('output/playwright/youtube-live.png'),
    fullPage: true,
  });
} finally {
  if (app) await app.close();
  if (path.dirname(dir) === os.tmpdir() && path.basename(dir).startsWith('cs2-video-'))
    await rm(dir, { recursive: true, force: true });
}
