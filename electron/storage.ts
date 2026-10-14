import { mkdir, readFile, rename, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { emptyDatabase, MAX_DATABASE_BYTES, parseDatabase } from '../src/model';

export async function readDatabase(file: string) {
  try {
    if ((await stat(file)).size > MAX_DATABASE_BYTES) throw new Error('ERR_TOO_LARGE');
    return parseDatabase(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyDatabase();
    throw new Error('ERR_READ', { cause: error });
  }
}

export async function writeDatabase(file: string, input: unknown) {
  const data = parseDatabase(input);
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json) > MAX_DATABASE_BYTES) throw new Error('ERR_TOO_LARGE');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + '.tmp', json, 'utf8');
  try {
    await copyFile(file, file + '.bak');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await rename(file + '.tmp', file);
  return data;
}
