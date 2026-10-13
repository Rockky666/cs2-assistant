import { emptyDatabase, parseDatabase, type Database } from './model';
export interface StorageBridge {
  load(): Promise<Database>;
  save(data: Database): Promise<Database>;
  exportBackup(): Promise<boolean>;
  importBackup(): Promise<Database | null>;
  copy(text: string): Promise<void>;
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
  exportBackup: async () => {
    throw new Error('Резервные копии доступны в приложении. Запустите npm start.');
  },
  importBackup: async () => {
    throw new Error('Резервные копии доступны в приложении. Запустите npm start.');
  },
};
