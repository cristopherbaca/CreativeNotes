const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    icon: path.join(__dirname, '..', 'logo.ico'),
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

ipcMain.handle('notebook:export-pdf', async (_event, notebook, pageImages = []) => {
  const printable = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true }
  });

  const tmpDir  = path.join(os.tmpdir(), `cn-export-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Write each page PNG to a temp file so file:// can load them without CSP issues
  const imgPaths = pageImages.map((dataUrl, i) => {
    if (!dataUrl) return '';
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const imgFile = path.join(tmpDir, `page-${i}.png`);
    fs.writeFileSync(imgFile, Buffer.from(base64, 'base64'));
    return imgFile.replace(/\\/g, '/');
  });

  const pages = (notebook.pages || []).map((_page, index) => {
    const src = imgPaths[index] ? `file:///${imgPaths[index]}` : '';
    return `<section class="page">${src ? `<img src="${src}" class="page-img">` : ''}</section>`;
  }).join('');

  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #fff; }
    @page { size: A4; margin: 0; }
    .page {
      width: 210mm;
      height: 297mm;
      page-break-after: always;
      overflow: hidden;
      background: #fff;
    }
    .page-img {
      display: block;
      width: 210mm;
      height: 297mm;
    }
  </style></head><body>${pages}</body></html>`;

  const htmlFile = path.join(tmpDir, 'export.html');
  fs.writeFileSync(htmlFile, html, 'utf8');
  await printable.loadFile(htmlFile);

  const pdf = await printable.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    preferCSSPageSize: true,
    margins: { marginType: 'none' }
  });
  printable.destroy();

  // Clean up all temp files
  fs.rm(tmpDir, { recursive: true, force: true }, () => {});

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
