import { mkdir, readFile, rename, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { emptyDatabase, MAX_DATABASE_BYTES, parseDatabase } from '../src/model';

export async function readDatabase(file: string) {
  try {
    if ((await stat(file)).size > MAX_DATABASE_BYTES)
      throw new Error('Размер базы превышает 100 МБ');
    return parseDatabase(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyDatabase();
    throw new Error(
      'Не удалось прочитать базу. Исходный файл сохранён. Восстановите резервную копию. ' +
        (error as Error).message,
    );
  }
}

export async function writeDatabase(file: string, input: unknown) {
  const data = parseDatabase(input);
  const json = JSON.stringify(data);
  if (Buffer.byteLength(json) > MAX_DATABASE_BYTES)
    throw new Error('База превышает 100 МБ. Уменьшите размер скриншотов.');
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
