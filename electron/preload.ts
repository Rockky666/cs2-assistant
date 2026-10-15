import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('library:load'),
  save: (data: unknown) => ipcRenderer.invoke('library:save', data),
  exportBackup: () => ipcRenderer.invoke('library:export'),
  importBackup: () => ipcRenderer.invoke('library:import'),
  exportMaterial: (id: string) => ipcRenderer.invoke('material:export', id),
  importMaterial: () => ipcRenderer.invoke('material:import'),
  copy: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  openRepository: () => ipcRenderer.invoke('app:repository'),
});
