const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mynotes', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportPdf: (notebook, pageImages) => ipcRenderer.invoke('notebook:export-pdf', notebook, pageImages),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close')
});
