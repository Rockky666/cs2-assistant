import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('library:load'),
  save: (data: unknown) => ipcRenderer.invoke('library:save', data),
  exportBackup: () => ipcRenderer.invoke('library:export'),
  importBackup: () => ipcRenderer.invoke('library:import'),
  copy: (text: string) => ipcRenderer.invoke('clipboard:write', text),
});
