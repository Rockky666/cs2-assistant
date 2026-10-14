import { newLineup, type Category, type Entry, type Lineup } from './model';
// Explicit conversion keeps screenshots when a material changes between category types.
export function moveEntryCategory(entry: Entry, previous: Category, next: Category): Entry {
  const value = { ...entry, categoryId: next.id };
  if (previous.kind === next.kind) return value;
  if (next.kind === 'lineup') {
    const lineups: Lineup[] = [];
    for (let i = 1; i < entry.images.length; i += 2)
      lineups.push({
        ...newLineup(),
        to: i === 1 ? entry.to : '',
        throwType: entry.throwType,
        aim: entry.images[i],
        result: entry.images[i + 1] ?? null,
      });
    return {
      ...value,
      images: entry.images.slice(0, 1),
      lineups: lineups.length
        ? lineups
        : [{ ...newLineup(), to: entry.to, throwType: entry.throwType }],
    };
  }
  if (previous.kind === 'lineup') {
    const images = [
      ...entry.images,
      ...entry.lineups.flatMap((l) =>
        [l.aim, l.result].filter((s): s is NonNullable<typeof s> => s !== null),
      ),
    ];
    if (images.length > 30) throw new Error('ERR_IMAGES_LIMIT');
    return {
      ...value,
      images,
      lineups: [],
      to: entry.lineups[0]?.to ?? entry.to,
      throwType: entry.lineups[0]?.throwType ?? entry.throwType,
    };
  }
  return value;
}
