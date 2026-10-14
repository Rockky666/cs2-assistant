import type { MapId, Theme } from './model';
const base = './assets/';
export const themeLogos: Record<Theme, string> = {
  'dark-blue': base + 'Logo-themes/Blue-logo.png',
  dark: base + 'Logo-themes/Dark-logo.svg',
  'dark-red': base + 'Logo-themes/Red-logo.png',
  orange: base + 'Logo-themes/Orange-logo.svg',
  light: base + 'Logo-themes/Light-logo.svg',
};
export const mapAssets: Record<
  MapId,
  { background: string; normal: string; alternative?: string }
> = {
  dust2: { background: 'Dust2.jpg', normal: 'Dust2.png', alternative: 'Dust-2-alternative.jpg' },
  mirage: {
    background: 'Mirage.jpg',
    normal: 'Mirage.jpg',
    alternative: 'Mirage-alternative.webp',
  },
  nuke: { background: 'Nuke.jpeg', normal: 'Nuke.jpg', alternative: 'Nuke-alternative.jpg' },
  ancient: { background: 'Ancient.jpg', normal: 'Ancient.jpg' },
  inferno: {
    background: 'Inferno.jpg',
    normal: 'Inferno.jpg',
    alternative: 'Inferno-alternative.jpg',
  },
  anubis: { background: 'Anubis.jpg', normal: 'Anubis.png', alternative: 'Anubis-alternative.jpg' },
  cache: { background: 'Cache.jpg', normal: 'Cache.png', alternative: 'Cache-alternative.jpg' },
};
export const backgroundFor = (id: MapId) => base + 'Map-backgrounds/' + mapAssets[id].background;
export const positionsFor = (id: MapId, alternative: boolean) =>
  base +
  'Map-positions/' +
  (alternative && mapAssets[id].alternative ? mapAssets[id].alternative : mapAssets[id].normal);
