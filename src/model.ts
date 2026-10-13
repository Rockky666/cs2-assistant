import { z } from 'zod';

export const maps = [
  {
    id: 'dust2',
    name: 'Dust 2',
    code: 'D2',
    subtitle: 'Песок и длинные дистанции',
    color: '#ccac76',
  },
  {
    id: 'mirage',
    name: 'Mirage',
    code: 'MR',
    subtitle: 'Контроль центра — ключ к раунду',
    color: '#7d9fd0',
  },
  {
    id: 'nuke',
    name: 'Nuke',
    code: 'NK',
    subtitle: 'Два уровня. Больше возможностей.',
    color: '#7ab6c5',
  },
  {
    id: 'ancient',
    name: 'Ancient',
    code: 'AN',
    subtitle: 'Среди руин и узких проходов',
    color: '#80ad92',
  },
  {
    id: 'inferno',
    name: 'Inferno',
    code: 'IN',
    subtitle: 'Каждый метр имеет значение',
    color: '#c98b76',
  },
  { id: 'anubis', name: 'Anubis', code: 'AB', subtitle: 'По обе стороны канала', color: '#b9a472' },
  {
    id: 'cache',
    name: 'Cache',
    code: 'CH',
    subtitle: 'Знакомые углы. Новые идеи.',
    color: '#9aa681',
  },
] as const;
export const categories = [
  { id: 'smoke', name: 'Смоки', note: 'Закрывай обзор. Открывай возможности.', utility: true },
  { id: 'he', name: 'HE-гранаты', note: 'Точный урон в нужный момент', utility: true },
  { id: 'flash', name: 'Флешки', note: 'Подготовь выход своей команды', utility: true },
  { id: 'molotov', name: 'Молотовы', note: 'Освободи позицию для атаки', utility: true },
  { id: 'position', name: 'Позиции', note: 'A, B, mid, con, short и другие', utility: false },
  { id: 'tactic', name: 'Тактики', note: 'От первого шага до плэнта', utility: false },
  { id: 'tip', name: 'Полезные фишки', note: 'Детали, которые решают раунд', utility: false },
] as const;
export const defaultThrows = [
  'Left click',
  'Right click',
  'Left + right click',
  'Jumpthrow',
  'Jumpthrow + Ctrl',
  'Runthrow',
  'Run + jumpthrow',
  'Ctrl + left click',
];
const shortText = z.string().trim().min(1).max(200);
export const imageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  data: z
    .string()
    .max(12 * 1024 * 1024)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
});
export const entrySchema = z
  .object({
    id: z.string().uuid(),
    mapId: z.enum(['dust2', 'mirage', 'nuke', 'ancient', 'inferno', 'anubis', 'cache']),
    categoryId: z.enum(['smoke', 'he', 'flash', 'molotov', 'position', 'tactic', 'tip']),
    title: shortText,
    from: z.string().trim().max(200),
    to: z.string().trim().max(200),
    throwType: z.string().trim().max(200),
    markdown: z.string().max(100000),
    images: z.array(imageSchema).max(30),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((entry, ctx) => {
    if (
      categories.find((c) => c.id === entry.categoryId)?.utility &&
      (!entry.from || !entry.to || !entry.throwType)
    ) {
      ctx.addIssue({ code: 'custom', message: 'Укажите откуда, куда и способ броска' });
    }
  });
export const commandSchema = z.object({
  id: z.string().uuid(),
  title: shortText,
  command: z.string().trim().min(1).max(10000),
});
export const databaseSchema = z
  .object({
    version: z.literal(1),
    entries: z.array(entrySchema).max(10000),
    commands: z.array(commandSchema).max(10000),
    customThrows: z.array(shortText).max(100),
  })
  .superRefine((db, ctx) => {
    const ids = [...db.entries, ...db.commands].map((item) => item.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Повторяющиеся идентификаторы' });
  });
export type Entry = z.infer<typeof entrySchema>;
export type Shot = z.infer<typeof imageSchema>;
export type Command = z.infer<typeof commandSchema>;
export type Database = z.infer<typeof databaseSchema>;
export const emptyDatabase = (): Database => ({
  version: 1,
  entries: [],
  commands: [],
  customThrows: [],
});
export const MAX_DATABASE_BYTES = 100 * 1024 * 1024;
export function parseDatabase(input: unknown): Database {
  const result = databaseSchema.safeParse(input);
  if (!result.success)
    throw new Error('Некорректные данные справочника: ' + result.error.issues[0].message);
  return result.data;
}
