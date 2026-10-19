import type { Entry } from './model';
export function categoryTags(entries: Entry[], mapId: string, categoryId: string) {
  const tags = new Map<string, { name: string; count: number }>();
  for (const entry of entries)
    if (entry.mapId === mapId && entry.categoryId === categoryId) {
      for (const name of entry.tags) {
        const key = name.toLocaleLowerCase();
        const tag = tags.get(key);
        if (tag) tag.count++;
        else tags.set(key, { name, count: 1 });
      }
    }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function hasTag(entry: Entry, tag?: string) {
  return !tag || entry.tags.some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase());
}
