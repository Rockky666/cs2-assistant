import { z } from 'zod';

export const maps = [
  { id: 'dust2', name: 'Dust 2', code: 'D2', color: '#ccac76' },
  { id: 'mirage', name: 'Mirage', code: 'MR', color: '#7d9fd0' },
  { id: 'nuke', name: 'Nuke', code: 'NK', color: '#7ab6c5' },
  { id: 'ancient', name: 'Ancient', code: 'AN', color: '#80ad92' },
  { id: 'inferno', name: 'Inferno', code: 'IN', color: '#c98b76' },
  { id: 'anubis', name: 'Anubis', code: 'AB', color: '#b9a472' },
  { id: 'cache', name: 'Cache', code: 'CH', color: '#9aa681' },
] as const;
const mapIdSchema = z.enum(['dust2', 'mirage', 'nuke', 'ancient', 'inferno', 'anubis', 'cache']);
export type MapId = z.infer<typeof mapIdSchema>;
export type CategoryKind = 'utility' | 'note' | 'lineup';
export type Category = { id: string; name: string; kind: CategoryKind; mapId?: MapId };
export const categories: Category[] = [
  { id: 'smoke', name: 'Смоки', kind: 'utility' },
  { id: 'he', name: 'HE-гранаты', kind: 'utility' },
  { id: 'flash', name: 'Флешки', kind: 'utility' },
  { id: 'molotov', name: 'Молотовы', kind: 'utility' },
  { id: 'lineup', name: 'Раскиды', kind: 'lineup' },
  { id: 'position', name: 'Позиции', kind: 'note' },
  { id: 'tactic', name: 'Тактики', kind: 'note' },
  { id: 'tip', name: 'Полезные фишки', kind: 'note' },
];
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
export const languages = ['ru', 'en', 'pt'] as const;
export const themes = ['dark-blue', 'dark', 'dark-red', 'orange', 'light'] as const;
export type Language = (typeof languages)[number];
export type Theme = (typeof themes)[number];
export const settingsSchema = z.object({ language: z.enum(languages), theme: z.enum(themes) });
export const defaultSettings = () => ({ language: 'ru' as Language, theme: 'dark' as Theme });
const shortText = z.string().trim().min(1).max(200);
export const imageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  data: z
    .string()
    .max(12 * 1024 * 1024)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/),
});
const entryBase = z.object({
  id: z.string().uuid(),
  mapId: mapIdSchema,
  categoryId: z.enum(['smoke', 'he', 'flash', 'molotov', 'position', 'tactic', 'tip']),
  title: shortText,
  from: z.string().trim().max(200),
  to: z.string().trim().max(200),
  throwType: z.string().trim().max(200),
  markdown: z.string().max(100000),
  images: z.array(imageSchema).max(30),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const lineupSchema = z.object({
  id: z.string().uuid(),
  to: shortText,
  throwType: shortText,
  aim: imageSchema.nullable(),
  result: imageSchema.nullable(),
});
export const customCategorySchema = z.object({
  id: z.string().uuid(),
  mapId: mapIdSchema,
  name: shortText,
  kind: z.enum(['utility', 'note', 'lineup']),
});
export const entrySchema = entryBase.extend({
  categoryId: z.union([
    z.enum(['smoke', 'he', 'flash', 'molotov', 'position', 'tactic', 'tip', 'lineup']),
    z.string().uuid(),
  ]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  pinned: z.boolean(),
  lineups: z.array(lineupSchema).max(20),
});
const legacyCommand = z.object({
  id: z.string().uuid(),
  title: shortText,
  command: z.string().trim().min(1).max(10000),
});
export const commandSchema = legacyCommand.extend({ pinned: z.boolean() });
export const crosshairSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1).max(10000),
  image: imageSchema,
  pinned: z.boolean(),
  updatedAt: z.string().datetime(),
});
export const guideTopicSchema = z.object({ id: z.string().uuid(), title: shortText });
export const guideArticleSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  title: shortText,
  markdown: z.string().max(100000),
  updatedAt: z.string().datetime(),
});
export type GuideTopic = z.infer<typeof guideTopicSchema>;
export type GuideArticle = z.infer<typeof guideArticleSchema>;
export const databaseSchema = z
  .object({
    version: z.literal(3),
    guideTopics: z.array(guideTopicSchema).max(200),
    guideArticles: z.array(guideArticleSchema).max(10000),
    entries: z.array(entrySchema).max(10000),
    commands: z.array(commandSchema).max(10000),
    customThrows: z.array(shortText).max(100),
    customCategories: z.array(customCategorySchema).max(200),
    crosshairs: z.array(crosshairSchema).max(1000),
    settings: settingsSchema,
  })
  .superRefine((db, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const ids = [
      ...db.entries,
      ...db.commands,
      ...db.crosshairs,
      ...db.customCategories,
      ...db.guideTopics,
      ...db.guideArticles,
    ].map((i) => i.id);
    if (new Set(ids).size !== ids.length) fail('Duplicate IDs');
    for (const article of db.guideArticles)
      if (!db.guideTopics.some((t) => t.id === article.topicId)) fail('Unknown guide topic');
    const categoryNames = db.customCategories.map(
      (c) => `${c.mapId}:${c.name.toLocaleLowerCase()}`,
    );
    if (new Set(categoryNames).size !== categoryNames.length) fail('Duplicate category names');
    for (const entry of db.entries) {
      const category =
        categories.find((c) => c.id === entry.categoryId) ??
        db.customCategories.find((c) => c.id === entry.categoryId && c.mapId === entry.mapId);
      if (!category) {
        fail('Unknown category');
        continue;
      }
      if (category.kind === 'utility' && (!entry.from || !entry.to || !entry.throwType))
        fail('Missing throw fields');
      if (
        category.kind === 'lineup' &&
        (!entry.from || entry.lineups.length === 0 || entry.images.length > 1)
      )
        fail('Invalid lineup');
      if (category.kind !== 'lineup' && entry.lineups.length)
        fail('Lineup groups outside a lineup');
      if (entryShotCount(entry) > 41) fail('Too many screenshots');
      const shotIds = [
        ...entry.images,
        ...entry.lineups.flatMap((l) => [l.aim, l.result].filter(Boolean)),
      ].map((s) => s!.id);
      if (new Set(shotIds).size !== shotIds.length) fail('Duplicate screenshot IDs');
      if (new Set(entry.lineups.map((l) => l.id)).size !== entry.lineups.length)
        fail('Duplicate lineup IDs');
      if (new Set(entry.tags.map((t) => t.toLocaleLowerCase())).size !== entry.tags.length)
        fail('Duplicate tags');
    }
  });
const legacySchema = z.object({
  version: z.literal(1),
  entries: z.array(entryBase).max(10000),
  commands: z.array(legacyCommand).max(10000),
  customThrows: z.array(shortText).max(100),
});
export type Entry = z.infer<typeof entrySchema>;
export type Shot = z.infer<typeof imageSchema>;
export type Lineup = z.infer<typeof lineupSchema>;
export type Command = z.infer<typeof commandSchema>;
export type Crosshair = z.infer<typeof crosshairSchema>;
export type CustomCategory = z.infer<typeof customCategorySchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Database = z.infer<typeof databaseSchema>;
export const emptyDatabase = (): Database => ({
  version: 3,
  guideTopics: [],
  guideArticles: [],
  entries: [],
  commands: [],
  customThrows: [],
  customCategories: [],
  crosshairs: [],
  settings: defaultSettings(),
});
export const MAX_DATABASE_BYTES = 100 * 1024 * 1024;
export function parseDatabase(input: unknown): Database {
  let candidate = input;
  if (typeof input === 'object' && input !== null && 'version' in input && input.version === 1) {
    const old = legacySchema.safeParse(input);
    if (!old.success) throw new Error('ERR_INVALID_DATA');
    candidate = {
      ...emptyDatabase(),
      entries: old.data.entries.map((e) => ({ ...e, tags: [], pinned: false, lineups: [] })),
      commands: old.data.commands.map((c) => ({ ...c, pinned: false })),
      customThrows: old.data.customThrows,
    };
  }
  if (typeof input === 'object' && input !== null && 'version' in input && input.version === 2) {
    const old = input as Record<string, unknown>;
    const preferences = old.settings as Record<string, unknown> | undefined;
    candidate = {
      ...old,
      version: 3,
      guideTopics: [],
      guideArticles: [],
      settings: {
        ...preferences,
        theme: preferences?.theme === 'dark-green' ? 'dark' : preferences?.theme,
      },
    };
  }
  const result = databaseSchema.safeParse(candidate);
  if (!result.success) throw new Error('ERR_INVALID_DATA');
  return result.data;
}
export function getCategories(db: Pick<Database, 'customCategories'>, mapId?: string): Category[] {
  return [...categories, ...db.customCategories.filter((c) => c.mapId === mapId)];
}
export function entryShotCount(entry: Pick<Entry, 'images' | 'lineups'>) {
  return (
    entry.images.length +
    entry.lineups.reduce((sum, l) => sum + Number(!!l.aim) + Number(!!l.result), 0)
  );
}
export function sortPinned<T extends { pinned: boolean; updatedAt?: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  );
}
export function newLineup(): Lineup {
  return { id: crypto.randomUUID(), to: '', throwType: '', aim: null, result: null };
}
export function newEntry(mapId: MapId, categoryId: string, kind: CategoryKind): Entry {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    mapId,
    categoryId,
    title: '',
    from: '',
    to: '',
    throwType: '',
    markdown: '',
    images: [],
    tags: [],
    pinned: false,
    lineups: kind === 'lineup' ? [newLineup()] : [],
    createdAt: now,
    updatedAt: now,
  };
}
