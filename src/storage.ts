import { emptyDatabase, parseDatabase, type Database } from './model';
import { REPOSITORY } from './app-info';
import { youtubeVideo } from './video';
export interface StorageBridge {
  load(): Promise<Database>;
  save(data: Database): Promise<Database>;
  exportBackup(): Promise<boolean>;
  importBackup(): Promise<Database | null>;
  exportMaterial(id: string): Promise<boolean>;
  importMaterial(): Promise<{ data: Database; entryId: string } | null>;
  copy(text: string): Promise<void>;
  openRepository(): Promise<void>;
  openVideo(url: string): Promise<void>;
}
declare global {
  interface Window {
    desktop?: StorageBridge;
  }
}
// Browser mode is an isolated UI preview; the desktop library is never shared with it.
let preview = emptyDatabase();
export const storage: StorageBridge = window.desktop ?? {
  load: async () => preview,
  save: async (data) => {
    preview = parseDatabase(data);
    return preview;
  },
  copy: async (text) => navigator.clipboard.writeText(text),
  openRepository: async () => {
    window.open(REPOSITORY, '_blank', 'noopener,noreferrer');
  },
  openVideo: async (url) => {
    const video = youtubeVideo(url);
    if (!video) throw new Error('ERR_VIDEO_URL');
    window.open(video.watchUrl, '_blank', 'noopener,noreferrer');
  },
  exportBackup: async () => {
    throw new Error('ERR_PREVIEW');
  },
  exportMaterial: async () => {
    throw new Error('ERR_PREVIEW');
  },
  importMaterial: async () => {
    throw new Error('ERR_PREVIEW');
  },
  importBackup: async () => {
    throw new Error('ERR_PREVIEW');
  },
};
