const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const dataPath = path.join(app.getPath('userData'), 'creativenotes.json');

const COVER_COLORS = ['#c44536', '#d9763b', '#e0b145', '#4f8f62', '#3d7c8a', '#3f5f9a', '#6b4f8a', '#2f3136'];

const starterData = {
  notebooks: [
    {
      id: 'notebook-1',
      name: 'My first notebook',
      color: COVER_COLORS[0],
      updatedAt: Date.now(),
      pages: [
        {
          id: 'page-1',
          name: 'Page 1',
          paper: 'lined',
          strokes: [],
          texts: []
        }
      ]
    }
  ]
};

function readData() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!parsed.notebooks) return starterData;
    return parsed;
  } catch {
    return structuredClone(starterData);
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]
  ));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f3f2f1',
    title: 'CreativeNotes',
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

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

ipcMain.handle('notebook:export-pdf', async (_event, notebook) => {
  const printable = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true }
  });

  const pages = (notebook.pages || []).map((page, index) => `
    <section class="page">
      <header>
        <span>${escapeHtml(notebook.name)}</span>
        <span>${index + 1} / ${notebook.pages.length}</span>
      </header>
      <h1>${escapeHtml(page.name || `Page ${index + 1}`)}</h1>
      ${(page.texts || []).map((item) => `<p>${escapeHtml(item.value || '')}</p>`).join('')}
    </section>
  `).join('');

  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, serif; color: #222; }
    .page { width: 8.27in; min-height: 11.69in; padding: .8in; page-break-after: always; }
    header { display: flex; justify-content: space-between; color: #888; font: 12px sans-serif; margin-bottom: 24px; }
    h1 { font: 700 22px sans-serif; margin: 0 0 28px; }
    p { font-size: 16px; line-height: 1.6; }
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

app.whenReady().then(() => {
  if (!fs.existsSync(dataPath)) writeData(structuredClone(starterData));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
