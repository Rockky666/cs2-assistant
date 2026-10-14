import { app, BrowserWindow, dialog, ipcMain, clipboard, shell } from 'electron';
import path from 'node:path';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { readDatabase, writeDatabase } from './storage';
import { MAX_DATABASE_BYTES, parseDatabase, type Language, type Settings } from '../src/model';
import { translator } from '../src/messages';
import { REPOSITORY } from '../src/app-info';
import { themeLogos } from '../src/assets';

let window: BrowserWindow;
const testData = !app.isPackaged && process.env.CS2_TEST_DATA_DIR;
const dataDirectory = testData || path.join(app.getPath('appData'), 'CS2 Assistant');
mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', dataDirectory);
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    const file = path.join(app.getPath('userData'), 'library.json');
    let loaded = false;
    let language: Language = 'ru';
    const applySettings = (settings: Settings) => {
      language = settings.language;
      window.setIcon(
        path.join(app.getAppPath(), 'dist', themeLogos[settings.theme].replace(/\.svg$/, '.png')),
      );
      window.setBackgroundColor(
        { 'dark-blue': '#0b1120', dark: '#0d0d0d', 'dark-red': '#480002', 'dark-green': '#233c00' }[
          settings.theme
        ],
      );
    };
    let queue: Promise<unknown> = Promise.resolve();
    const handle = (name: string, action: (...args: any[]) => unknown) =>
      ipcMain.handle(name, (event, ...args) => {
        if (
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame
        )
          throw new Error('ERR_INVALID_DATA');
        return action(...args);
      });
    handle('library:load', async () => {
      const data = await readDatabase(file);
      loaded = true;
      applySettings(data.settings);
      return data;
    });
    handle('library:save', (input: unknown) => {
      if (!loaded) throw new Error('ERR_READ');
      const next = queue.then(async () => {
        const data = await writeDatabase(file, input);
        applySettings(data.settings);
        return data;
      });
      queue = next.catch(() => {});
      return next;
    });
    handle('library:export', async () => {
      await queue;
      const result = await dialog.showSaveDialog(window, {
        defaultPath: `cs2-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: translator(language)('backupSection'), extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, JSON.stringify(await readDatabase(file)));
      return true;
    });
    handle('library:import', async () => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [{ name: translator(language)('backupSection'), extensions: ['json'] }],
      });
      if (result.canceled) return null;
      const source = result.filePaths[0];
      if ((await stat(source)).size > MAX_DATABASE_BYTES) throw new Error('ERR_TOO_LARGE');
      let data;
      try {
        data = parseDatabase(JSON.parse(await readFile(source, 'utf8')));
      } catch {
        throw new Error('ERR_INVALID_DATA');
      }
      const t = translator(language);
      const answer = await dialog.showMessageBox(window, {
        type: 'warning',
        title: t('importTitle'),
        message: t('importQuestion', {
          entries: data.entries.length,
          commands: data.commands.length,
          crosshairs: data.crosshairs.length,
        }),
        buttons: [t('cancel'), t('replace')],
        defaultId: 0,
        cancelId: 0,
      });
      if (answer.response !== 1) return null;
      const next = queue.then(() => writeDatabase(file, data));
      queue = next.catch(() => {});
      await next;
      loaded = true;
      applySettings(data.settings);
      return data;
    });
    handle('clipboard:write', (text: unknown) => {
      if (typeof text !== 'string' || text.length > 10000) throw new Error('ERR_INVALID_DATA');
      clipboard.writeText(text);
    });
    handle('app:repository', () => shell.openExternal(REPOSITORY));
    window = new BrowserWindow({
      width: 1360,
      height: 900,
      minWidth: 720,
      minHeight: 560,
      backgroundColor: '#0b1120',
      title: 'CS2 Assistant',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('will-prevent-unload', (event) => {
      const choice = dialog.showMessageBoxSync(window, {
        type: 'question',
        message: translator(language)('unsaved'),
        buttons: [translator(language)('stay'), translator(language)('close')],
        defaultId: 0,
        cancelId: 0,
      });
      if (choice === 1) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
      callback(false),
    );
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  });
  app.on('window-all-closed', () => app.quit());
}
