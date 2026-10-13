import { build, Platform } from 'electron-builder';
import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Package outside OneDrive: its synchronizer can lock Electron's staging directory.
const staging = await mkdtemp(path.join(os.tmpdir(), 'cs2-package-'));
const unpacked = process.argv.includes('--dir');
try {
  await build({
    targets: Platform.WINDOWS.createTarget(unpacked ? 'dir' : 'portable'),
    config: { directories: { output: staging } },
  });
  await mkdir('release', { recursive: true });
  if (unpacked) {
    await cp(path.join(staging, 'win-unpacked'), path.resolve('release/win-unpacked'), {
      recursive: true,
    });
    console.log('Application: ' + path.resolve('release/win-unpacked/CS2 Assistant.exe'));
  } else {
    for (const file of await readdir(staging)) {
      if (!file.endsWith('.exe')) continue;
      const destination = path.resolve('release', file);
      await cp(path.join(staging, file), destination);
      console.log('Application: ' + destination);
    }
  }
} finally {
  if (path.dirname(staging) === os.tmpdir() && path.basename(staging).startsWith('cs2-package-')) {
    await rm(staging, { recursive: true, force: true });
  }
}
