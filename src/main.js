const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const dataPath = path.join(app.getPath('userData'), 'mynotes.json');

const starterData = {
  selectedNotebookId: 'notebook-1',
  notebooks: [
    {
      id: 'notebook-1',
      name: 'My first notebook',
      color: '#e7a84b',
      pages: [
        {
          id: 'page-1',
          name: 'Welcome page',
          content: 'A quiet place for your ideas.\n\nStart writing, sketching, or planning here.',
          strokes: []
        }
      ]
    }
  ]
};

function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch {
    return starterData;
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return data;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f5f6f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_event, data) => writeData(data));
ipcMain.handle('notebook:export-pdf', async (_event, notebook) => {
  const printable = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  const pages = notebook.pages.map((page) => `
    <section class="page">
      <h1>${escapeHtml(page.name)}</h1>
      <div class="content">${escapeHtml(page.content || '').replace(/\n/g, '<br>')}</div>
    </section>`).join('');
  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; } body { margin: 0; font-family: Georgia, serif; color: #252923; }
    .page { width: 7.5in; min-height: 9.7in; padding: .7in; page-break-after: always; }
    h1 { font: 700 24px Arial, sans-serif; margin: 0 0 32px; color: #6a7169; }
    .content { font-size: 18px; line-height: 1.7; white-space: normal; }
  </style></head><body>${pages}</body></html>`;
  await printable.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await printable.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  printable.destroy();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export notebook as PDF',
    defaultPath: path.join(app.getPath('documents'), `${notebook.name}.pdf`),
    filters: [{ name: 'PDF document', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, pdf);
  return { canceled: false, filePath: result.filePath };
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

app.whenReady().then(() => {
  if (!fs.existsSync(dataPath)) writeData(starterData);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
