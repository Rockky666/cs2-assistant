import { z } from 'zod';
import {
  categories,
  customCategorySchema,
  defaultThrows,
  emptyDatabase,
  entrySchema,
  parseDatabase,
  type Database,
} from './model';

const transferSchema = z
  .object({
    format: z.literal('cs2-assistant-material'),
    version: z.union([z.literal(1), z.literal(2)]),
    entry: entrySchema,
    category: customCategorySchema.nullable(),
  })
  .strict();
export type MaterialTransfer = z.infer<typeof transferSchema>;

export function parseMaterialTransfer(input: unknown): MaterialTransfer {
  const result = transferSchema.safeParse(input);
  if (!result.success) throw new Error('ERR_MATERIAL_FILE');
  const transfer = result.data;
  if (
    transfer.category &&
    (transfer.category.id !== transfer.entry.categoryId ||
      transfer.category.mapId !== transfer.entry.mapId)
  )
    throw new Error('ERR_MATERIAL_FILE');
  try {
    parseDatabase({
      ...emptyDatabase(),
      entries: [transfer.entry],
      customCategories: transfer.category ? [transfer.category] : [],
    });
  } catch {
    throw new Error('ERR_MATERIAL_FILE');
  }
  return transfer;
}

export function exportMaterial(db: Database, id: string): MaterialTransfer {
  const entry = db.entries.find((e) => e.id === id);
  if (!entry) throw new Error('ERR_MATERIAL_FILE');
  return parseMaterialTransfer({
    format: 'cs2-assistant-material',
    version: 2,
    entry,
    category: db.customCategories.find((c) => c.id === entry.categoryId) ?? null,
  });
}

// Always add a fresh copy. A friend's UUID can never overwrite local work.
export function importMaterial(db: Database, input: unknown) {
  const transfer = parseMaterialTransfer(input);
  const customCategories = [...db.customCategories];
  let categoryId = transfer.entry.categoryId;
  if (transfer.category) {
    const source = transfer.category;
    const existing = customCategories.find(
      (c) =>
        c.mapId === source.mapId &&
        c.kind === source.kind &&
        c.name.toLocaleLowerCase() === source.name.toLocaleLowerCase(),
    );
    if (existing) categoryId = existing.id;
    else {
      let name = source.name;
      let suffix = 2;
      const names = [
        ...categories,
        ...customCategories.filter((c) => c.mapId === source.mapId),
      ].map((c) => c.name.toLocaleLowerCase());
      while (names.includes(name.toLocaleLowerCase()))
        name = `${source.name.slice(0, 180)} (${suffix++})`;
      categoryId = crypto.randomUUID();
      customCategories.push({ ...source, id: categoryId, name });
    }
  }
  const id = crypto.randomUUID();
  const entry = {
    ...transfer.entry,
    id,
    categoryId,
    pinned: false,
    updatedAt: new Date().toISOString(),
    markdown: transfer.entry.markdown.replace(
      new RegExp(`cs2://material/${transfer.entry.id}`, 'gi'),
      `cs2://material/${id}`,
    ),
  };
  const methods = [entry.throwType, ...entry.lineups.map((l) => l.throwType)].filter(Boolean);
  const customThrows = [...db.customThrows];
  for (const method of methods)
    if (
      !defaultThrows.includes(method) &&
      !customThrows.includes(method) &&
      customThrows.length < 100
    )
      customThrows.push(method);
  const data = parseDatabase({
    ...db,
    entries: [...db.entries, entry],
    customCategories,
    customThrows,
  });
  return { data, entryId: id };
}
