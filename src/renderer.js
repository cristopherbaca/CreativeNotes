const COVER_COLORS = ['#c44536', '#d9763b', '#e0b145', '#4f8f62', '#3d7c8a', '#3f5f9a', '#6b4f8a', '#2f3136'];
const PAGE_W = 794;
const PAGE_H = 1123;

const state = {
  data: { notebooks: [] },
  view: 'library',
  notebookId: null,
  pageId: null,
  tool: 'pen',
  color: '#1f2933',
  size: 3,
  currentStroke: null,
  undo: [],
  redo: [],
  saveTimer: null,
  modal: null
};

const $ = (id) => document.getElementById(id);
const libraryView = $('libraryView');
const notebookView = $('notebookView');
const notebookGrid = $('notebookGrid');
const pagesScroller = $('pagesScroller');
const pageThumbs = $('pageThumbs');
const toast = $('toast');

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function notebook() {
  return state.data.notebooks.find((item) => item.id === state.notebookId);
}

function currentPage() {
  const book = notebook();
  return book?.pages.find((page) => page.id === state.pageId) || book?.pages[0];
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function persist(immediate = false) {
  const book = notebook();
  if (book) book.updatedAt = Date.now();
  clearTimeout(state.saveTimer);
  const write = () => window.mynotes.save(state.data);
  if (immediate) return write();
  state.saveTimer = setTimeout(write, 250);
}

function blankPage(index) {
  return { id: uid('page'), name: `Page ${index}`, paper: 'lined', strokes: [], texts: [] };
}

function blankNotebook(name, color) {
  return {
    id: uid('notebook'),
    name,
    color: color || COVER_COLORS[state.data.notebooks.length % COVER_COLORS.length],
    updatedAt: Date.now(),
    pages: [blankPage(1)]
  };
}

function setView(view) {
  state.view = view;
  libraryView.classList.toggle('hidden', view !== 'library');
  notebookView.classList.toggle('hidden', view !== 'notebook');
}

function pageIndex() {
  const book = notebook();
  return book.pages.findIndex((page) => page.id === state.pageId);
}

function updateIndicator() {
  const book = notebook();
  if (!book) return;
  const index = Math.max(0, pageIndex());
  $('pageIndicator').textContent = `Page ${index + 1} of ${book.pages.length}`;
  $('notebookTitleBtn').textContent = book.name;
}

function showLoading(text) {
  $('loadingText').textContent = text;
  $('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
  $('loadingOverlay').classList.add('hidden');
}

function closeMenu() {
  document.querySelector('.context-menu')?.remove();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]
  ));
}

function relativePoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
    p: event.pressure || 0.5
  };
}

function drawStroke(ctx, stroke, width, height) {
  if (!stroke.points?.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(10, stroke.size * 4) * (width / PAGE_W);
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = Math.max(1.2, stroke.size) * (width / PAGE_W);
  }
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function renderCanvas(canvas, page, thumb = false) {
  const ratio = thumb ? 1 : (window.devicePixelRatio || 1);
  const width = canvas.clientWidth || (thumb ? 112 : PAGE_W);
  const height = canvas.clientHeight || (thumb ? 148 : PAGE_H);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  (page.strokes || []).forEach((stroke) => drawStroke(ctx, stroke, width, height));
}

function renderTexts(layer, page) {
  layer.innerHTML = '';
  (page.texts || []).forEach((item) => {
    const box = document.createElement('div');
    box.className = 'text-box';
    box.contentEditable = 'true';
    box.dataset.id = item.id;
    box.textContent = item.value || '';
    box.style.left = `${item.x * 100}%`;
    box.style.top = `${item.y * 100}%`;
    box.addEventListener('input', () => {
      item.value = box.textContent;
      persist();
    });
    box.addEventListener('pointerdown', (event) => event.stopPropagation());
    layer.appendChild(box);
  });
}

function syncCurrentPageFromScroll() {
  const sheets = [...pagesScroller.querySelectorAll('.page-sheet')];
  if (!sheets.length) return;
  const mid = pagesScroller.scrollTop + pagesScroller.clientHeight / 2;
  let closest = sheets[0];
  let distance = Infinity;
  sheets.forEach((sheet) => {
    const center = sheet.offsetTop + sheet.offsetHeight / 2;
    const next = Math.abs(center - mid);
    if (next < distance) {
      distance = next;
      closest = sheet;
    }
  });
  if (closest.dataset.page !== state.pageId) {
    state.pageId = closest.dataset.page;
    highlightThumbs();
    updateIndicator();
  }
}

function highlightThumbs() {
  pageThumbs.querySelectorAll('.page-thumb').forEach((button) => {
    button.classList.toggle('current', button.dataset.page === state.pageId);
  });
}

function goToPage(pageId, smooth = true) {
  state.pageId = pageId;
  const sheet = pagesScroller.querySelector(`[data-page="${pageId}"]`);
  if (sheet) {
    sheet.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }
  highlightThumbs();
  updateIndicator();
}

function renderThumbs() {
  const book = notebook();
  pageThumbs.innerHTML = '';
  book.pages.forEach((page, index) => {
    const button = document.createElement('button');
    button.className = `page-thumb ${page.id === state.pageId ? 'current' : ''}`;
    button.dataset.page = page.id;
    button.innerHTML = `<canvas></canvas><span>${index + 1}</span>`;
    button.addEventListener('click', () => goToPage(page.id));
    pageThumbs.appendChild(button);
    renderCanvas(button.querySelector('canvas'), page, true);
  });
}

function bindPageCanvas(canvas, page) {
  canvas.addEventListener('pointerdown', (event) => {
    if (state.tool === 'text') return;
    canvas.setPointerCapture(event.pointerId);
    const point = relativePoint(event, canvas);
    if (state.tool === 'eraser') {
      eraseAt(page, point);
      renderCanvas(canvas, page);
      renderThumbs();
      persist();
      return;
    }
    state.currentStroke = {
      id: uid('stroke'),
      tool: state.tool,
      color: state.color,
      size: Number(state.size),
      points: [point]
    };
    page.strokes.push(state.currentStroke);
    state.undo.push({ type: 'stroke', pageId: page.id, strokeId: state.currentStroke.id });
    state.redo = [];
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.currentStroke || state.currentStroke !== page.strokes.at(-1)) return;
    state.currentStroke.points.push(relativePoint(event, canvas));
    renderCanvas(canvas, page);
  });

  canvas.addEventListener('pointerup', () => {
    if (state.currentStroke) persist();
    state.currentStroke = null;
    renderThumbs();
  });
}

function eraseAt(page, point) {
  const before = page.strokes.length;
  page.strokes = page.strokes.filter((stroke) => {
    return !stroke.points.some((dot) => {
      const dx = dot.x - point.x;
      const dy = dot.y - point.y;
      return Math.hypot(dx, dy) < 0.03;
    });
  });
  if (page.strokes.length !== before) {
    state.undo.push({ type: 'erase', pageId: page.id });
    state.redo = [];
  }
}

function renderPages() {
  const book = notebook();
  pagesScroller.innerHTML = '';
  book.pages.forEach((page) => {
    const sheet = document.createElement('article');
    sheet.className = `page-sheet ${page.paper || 'lined'} ${state.tool === 'text' ? 'text-mode' : ''}`;
    sheet.dataset.page = page.id;
    const canvas = document.createElement('canvas');
    const layer = document.createElement('div');
    layer.className = 'text-layer';
    sheet.append(canvas, layer);
    pagesScroller.appendChild(sheet);
    requestAnimationFrame(() => {
      renderCanvas(canvas, page);
      renderTexts(layer, page);
    });
    bindPageCanvas(canvas, page);
    layer.addEventListener('pointerdown', (event) => {
      if (state.tool !== 'text' || event.target !== layer) return;
      const rect = sheet.getBoundingClientRect();
      const item = {
        id: uid('text'),
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
        value: ''
      };
      page.texts.push(item);
      renderTexts(layer, page);
      persist();
      layer.querySelector(`[data-id="${item.id}"]`)?.focus();
    });
  });
  updatePageToolMode();
}

function updatePageToolMode() {
  document.querySelectorAll('.page-sheet').forEach((sheet) => {
    sheet.classList.toggle('text-mode', state.tool === 'text');
  });
  document.querySelectorAll('.tool-btn[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === state.tool);
  });
  document.querySelectorAll('.tool-btn[data-color]').forEach((button) => {
    button.style.setProperty('--swatch', button.dataset.color);
    button.classList.toggle('active', button.dataset.color === state.color);
  });
}

function renderNotebook() {
  if (!notebook()) return;
  if (!state.pageId) state.pageId = notebook().pages[0].id;
  renderPages();
  renderThumbs();
  updateIndicator();
  requestAnimationFrame(() => goToPage(state.pageId, false));
}

function formatEdited(timestamp) {
  const date = new Date(timestamp || Date.now());
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Edited: Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Edited: Yesterday, ${time}`;
  return `Edited: ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function paintPreview(canvas, item) {
  const width = 236;
  const height = 124;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#faf9f8';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#efece8';
  for (let y = 18; y < height; y += 14) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(width - 12, y);
    ctx.stroke();
  }
  const page = item.pages[0];
  if (!page) return;
  (page.strokes || []).forEach((stroke) => drawStroke(ctx, stroke, width, height));
  ctx.fillStyle = '#323130';
  ctx.font = '12px Segoe UI, system-ui, sans-serif';
  (page.texts || []).slice(0, 3).forEach((text, index) => {
    if (text.value) ctx.fillText(text.value.slice(0, 28), 16, 36 + index * 18);
  });
}

function renderLibrary() {
  const query = ($('searchNotebooks').value || '').trim().toLowerCase();
  const notebooks = state.data.notebooks
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter((item) => item.name.toLowerCase().includes(query));

  notebookGrid.innerHTML = '';

  const create = document.createElement('button');
  create.className = 'create-card';
  create.innerHTML = `<div class="create-plus">+</div><span>New notebook</span>`;
  create.addEventListener('click', () => openModal({ mode: 'create' }));
  notebookGrid.appendChild(create);

  notebooks.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'board-card';
    card.innerHTML = `
      <button class="preview-open" data-open="${item.id}">
        <canvas class="preview"></canvas>
      </button>
      <div class="board-info">
        <div class="board-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${formatEdited(item.updatedAt)}</small>
        </div>
        <button class="card-menu" data-menu="${item.id}" title="Notebook options">⋯</button>
      </div>
    `;
    notebookGrid.appendChild(card);
    paintPreview(card.querySelector('canvas'), item);
  });

  notebookGrid.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => openNotebook(button.dataset.open));
  });
  notebookGrid.querySelectorAll('[data-menu]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      showNotebookMenu(button.dataset.menu, event.clientX, event.clientY);
    });
  });
}

function showNotebookMenu(id, x, y) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.innerHTML = `
    <button data-action="open">Open</button>
    <button data-action="rename">Rename</button>
    <button data-action="delete" class="danger">Delete</button>
  `;
  document.body.appendChild(menu);
  menu.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    closeMenu();
    if (action === 'open') openNotebook(id);
    if (action === 'rename') {
      const item = state.data.notebooks.find((notebookItem) => notebookItem.id === id);
      openModal({ mode: 'rename', notebook: item });
    }
    if (action === 'delete') deleteNotebook(id);
  });
}

async function openNotebook(id) {
  const item = state.data.notebooks.find((notebookItem) => notebookItem.id === id);
  if (!item) return;
  showLoading(`Opening ${item.name}…`);
  state.notebookId = id;
  state.pageId = item.pages[0].id;
  state.undo = [];
  state.redo = [];
  await new Promise((resolve) => setTimeout(resolve, 280));
  setView('notebook');
  renderNotebook();
  hideLoading();
}

function deleteNotebook(id) {
  if (state.data.notebooks.length === 1) {
    showToast('Keep at least one notebook.');
    return;
  }
  state.data.notebooks = state.data.notebooks.filter((item) => item.id !== id);
  persist(true);
  renderLibrary();
  showToast('Notebook deleted.');
}

function addPage() {
  const book = notebook();
  const page = blankPage(book.pages.length + 1);
  book.pages.push(page);
  persist();
  renderNotebook();
  requestAnimationFrame(() => goToPage(page.id));
}

function undo() {
  const action = state.undo.pop();
  if (!action) return;
  const page = notebook().pages.find((item) => item.id === action.pageId);
  if (action.type === 'stroke') {
    const stroke = page.strokes.find((item) => item.id === action.strokeId);
    page.strokes = page.strokes.filter((item) => item.id !== action.strokeId);
    state.redo.push({ ...action, stroke });
  }
  persist();
  renderNotebook();
}

function redo() {
  const action = state.redo.pop();
  if (!action) return;
  const page = notebook().pages.find((item) => item.id === action.pageId);
  if (action.type === 'stroke' && action.stroke) {
    page.strokes.push(action.stroke);
    state.undo.push({ type: 'stroke', pageId: page.id, strokeId: action.stroke.id });
  }
  persist();
  renderNotebook();
}

function openModal({ mode, notebook: item }) {
  state.modal = { mode, notebook: item };
  $('modalTitle').textContent = mode === 'create' ? 'New notebook' : 'Rename notebook';
  $('modalName').value = item?.name || 'Untitled notebook';
  $('colorPicker').innerHTML = COVER_COLORS.map((color) => `
    <button type="button" class="color-dot ${color === (item?.color || COVER_COLORS[0]) ? 'selected' : ''}" data-color="${color}" style="background:${color}"></button>
  `).join('');
  $('colorPicker').dataset.color = item?.color || COVER_COLORS[0];
  $('modalOverlay').classList.remove('hidden');
  $('modalName').focus();
  $('modalName').select();
}

function closeModal() {
  $('modalOverlay').classList.add('hidden');
  state.modal = null;
}

$('colorPicker').addEventListener('click', (event) => {
  const color = event.target.dataset.color;
  if (!color) return;
  $('colorPicker').dataset.color = color;
  $('colorPicker').querySelectorAll('.color-dot').forEach((dot) => {
    dot.classList.toggle('selected', dot.dataset.color === color);
  });
});

$('modalForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('modalName').value.trim();
  const color = $('colorPicker').dataset.color;
  if (!name || !state.modal) return;
  if (state.modal.mode === 'create') {
    const item = blankNotebook(name, color);
    state.data.notebooks.push(item);
    persist(true);
    renderLibrary();
    openNotebook(item.id);
  } else if (state.modal.notebook) {
    state.modal.notebook.name = name;
    state.modal.notebook.color = color;
    persist(true);
    renderLibrary();
    if (state.view === 'notebook') updateIndicator();
    showToast('Notebook renamed.');
  }
  closeModal();
});

$('modalCancel').addEventListener('click', closeModal);
$('modalOverlay').addEventListener('click', (event) => {
  if (event.target === $('modalOverlay')) closeModal();
});

$('searchNotebooks').addEventListener('input', renderLibrary);
$('allNotebooksLink').addEventListener('click', () => {
  $('searchNotebooks').value = '';
  renderLibrary();
});
$('backToLibrary').addEventListener('click', () => {
  persist(true);
  setView('library');
  renderLibrary();
});
$('notebookTitleBtn').addEventListener('click', () => openModal({ mode: 'rename', notebook: notebook() }));
$('addPageBtn').addEventListener('click', addPage);
$('addPageRailBtn').addEventListener('click', addPage);
$('prevPageBtn').addEventListener('click', () => {
  const book = notebook();
  const index = pageIndex();
  if (index > 0) goToPage(book.pages[index - 1].id);
});
$('nextPageBtn').addEventListener('click', () => {
  const book = notebook();
  const index = pageIndex();
  if (index < book.pages.length - 1) goToPage(book.pages[index + 1].id);
});
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('clearPageBtn').addEventListener('click', () => {
  const page = currentPage();
  page.strokes = [];
  persist();
  renderNotebook();
});
$('exportPdfBtn').addEventListener('click', async () => {
  persist(true);
  const result = await window.mynotes.exportPdf(notebook());
  if (!result.canceled) showToast('Notebook exported as PDF.');
});
$('strokeSize').addEventListener('input', (event) => {
  state.size = Number(event.target.value);
});
$('toolbar').addEventListener('click', (event) => {
  const tool = event.target.closest('[data-tool]')?.dataset.tool;
  const color = event.target.closest('[data-color]')?.dataset.color;
  if (tool) state.tool = tool;
  if (color) {
    state.color = color;
    if (state.tool === 'eraser') state.tool = 'pen';
  }
  updatePageToolMode();
});

pagesScroller.addEventListener('scroll', () => {
  window.clearTimeout(pagesScroller.snapTimer);
  pagesScroller.snapTimer = window.setTimeout(syncCurrentPageFromScroll, 80);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.context-menu, [data-menu]')) closeMenu();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
    closeModal();
    if (state.view === 'notebook' && document.activeElement?.className !== 'text-box') {
      persist(true);
      setView('library');
      renderLibrary();
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  }
  if (state.view === 'notebook' && document.activeElement === document.body) {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') $('nextPageBtn').click();
    if (event.key === 'ArrowUp' || event.key === 'PageUp') $('prevPageBtn').click();
  }
});

window.addEventListener('resize', () => {
  if (state.view === 'notebook') renderNotebook();
});

async function boot() {
  state.data = await window.mynotes.load();
  if (!state.data.notebooks?.length) state.data.notebooks = [blankNotebook('My first notebook', COVER_COLORS[0])];
  setView('library');
  renderLibrary();
}

boot();
