const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mynotes', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportPdf: (notebook) => ipcRenderer.invoke('notebook:export-pdf', notebook)
});
