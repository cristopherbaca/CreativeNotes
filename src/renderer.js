const state = { data: null, notebook: null, page: null, penMode: false, strokes: [] };
const $ = (selector) => document.querySelector(selector);

const els = { notebooks: $('#notebookList'), pages: $('#pageList'), editor: $('#pageEditor'), canvas: $('#inkCanvas'), paper: $('#paper'), toast: $('#toast') };

function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function selectedNotebook() { return state.data.notebooks.find((notebook) => notebook.id === state.data.selectedNotebookId) || state.data.notebooks[0]; }
function save() { state.data.selectedNotebookId = state.notebook.id; state.page.content = els.editor.value; state.page.strokes = state.strokes; window.mynotes.save(state.data); }
function showToast(message) { els.toast.textContent = message; els.toast.classList.add('show'); setTimeout(() => els.toast.classList.remove('show'), 2200); }
function askName(label, value) { const name = prompt(label, value); return name && name.trim() ? name.trim() : null; }

function render() {
  state.notebook = selectedNotebook();
  state.page = state.notebook.pages.find((page) => page.id === state.page?.id) || state.notebook.pages[0];
  state.strokes = state.page.strokes || [];
  $('#notebookTitle').textContent = state.notebook.name;
  $('#breadcrumbNotebook').textContent = state.notebook.name;
  $('#breadcrumbPage').textContent = state.page.name;
  $('#pageName').textContent = state.page.name;
  $('#pageNumber').textContent = String(state.notebook.pages.indexOf(state.page) + 1).padStart(2, '0');
  $('#paperPage').textContent = $('#pageNumber').textContent;
  $('#pageCount').textContent = state.notebook.pages.indexOf(state.page) + 1;
  $('#pageTotal').textContent = state.notebook.pages.length;
  els.editor.value = state.page.content || '';
  renderNotebooks(); renderPages(); resizeCanvas(); drawStrokes();
}

function renderNotebooks() {
  els.notebooks.innerHTML = state.data.notebooks.map((notebook) => `
    <button class="notebook-item ${notebook.id === state.notebook.id ? 'selected' : ''}" data-notebook="${notebook.id}">
      <span class="notebook-swatch" style="background:${notebook.color}"></span><span><strong>${escapeHtml(notebook.name)}</strong><small>${notebook.pages.length} ${notebook.pages.length === 1 ? 'page' : 'pages'}</small></span>
    </button>`).join('');
  els.notebooks.querySelectorAll('[data-notebook]').forEach((button) => button.addEventListener('click', () => {
    state.data.selectedNotebookId = button.dataset.notebook; state.page = null; render(); save();
  }));
}

function renderPages() {
  els.pages.innerHTML = state.notebook.pages.map((page, index) => `
    <div class="page-card ${page.id === state.page.id ? 'selected' : ''}" data-page="${page.id}">
      <div class="page-card-head"><span>${String(index + 1).padStart(2, '0')}</span><button class="delete-page" data-delete="${page.id}" title="Delete page">×</button></div>
      <strong>${escapeHtml(page.name)}</strong><p>${escapeHtml((page.content || 'Blank page').replace(/\n/g, ' '))}</p>
    </div>`).join('');
  els.pages.querySelectorAll('[data-page]').forEach((card) => card.addEventListener('click', (event) => {
    if (event.target.dataset.delete) return;
    state.page = state.notebook.pages.find((page) => page.id === card.dataset.page); render();
  }));
  els.pages.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation(); if (state.notebook.pages.length === 1) return showToast('A notebook needs at least one page.');
    state.notebook.pages = state.notebook.pages.filter((page) => page.id !== button.dataset.delete); state.page = state.notebook.pages[0]; render(); save();
  }));
}

function addNotebook() {
  const name = askName('Name your new notebook', 'Untitled notebook'); if (!name) return;
  const notebook = { id: id('notebook'), name, color: ['#e7a84b', '#6f9b83', '#d17a69', '#8c91b0'][state.data.notebooks.length % 4], pages: [{ id: id('page'), name: 'First page', content: '', strokes: [] }] };
  state.data.notebooks.push(notebook); state.data.selectedNotebookId = notebook.id; state.page = null; render(); save();
}
function addPage() { const page = { id: id('page'), name: `Page ${state.notebook.pages.length + 1}`, content: '', strokes: [] }; state.notebook.pages.push(page); state.page = page; render(); save(); }
function renameNotebook() { const name = askName('Rename notebook', state.notebook.name); if (!name) return; state.notebook.name = name; render(); save(); }
function renamePage() { const name = askName('Rename page', state.page.name); if (!name) return; state.page.name = name; render(); save(); }

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function resizeCanvas() { const rect = els.paper.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; els.canvas.width = rect.width * ratio; els.canvas.height = rect.height * ratio; els.canvas.style.width = `${rect.width}px`; els.canvas.style.height = `${rect.height}px`; const context = els.canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0); }
function drawStrokes() { const context = els.canvas.getContext('2d'); const rect = els.paper.getBoundingClientRect(); context.clearRect(0, 0, rect.width, rect.height); context.strokeStyle = '#3f604a'; context.lineWidth = 2.2; context.lineCap = 'round'; state.strokes.forEach((stroke) => { context.beginPath(); stroke.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); }); }
function setupInk() {
  let currentStroke = null;
  els.canvas.addEventListener('pointerdown', (event) => { if (!state.penMode) return; els.canvas.setPointerCapture(event.pointerId); const rect = els.canvas.getBoundingClientRect(); currentStroke = [{ x: event.clientX - rect.left, y: event.clientY - rect.top }]; state.strokes.push(currentStroke); });
  els.canvas.addEventListener('pointermove', (event) => { if (!currentStroke) return; const rect = els.canvas.getBoundingClientRect(); currentStroke.push({ x: event.clientX - rect.left, y: event.clientY - rect.top }); drawStrokes(); });
  els.canvas.addEventListener('pointerup', () => { if (currentStroke) save(); currentStroke = null; });
}

els.editor.addEventListener('input', () => { state.page.content = els.editor.value; save(); });
$('#newNotebook').addEventListener('click', addNotebook); $('#addPage').addEventListener('click', addPage); $('#addPageBottom').addEventListener('click', addPage); $('#renameNotebook').addEventListener('click', renameNotebook); $('#renamePage').addEventListener('click', renamePage);
$('#clearInk').addEventListener('click', () => { state.strokes = []; save(); drawStrokes(); });
$('#exportPdf').addEventListener('click', async () => { save(); const result = await window.mynotes.exportPdf(state.notebook); if (!result.canceled) showToast('Notebook exported as PDF.'); });
document.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => { state.penMode = button.dataset.tool === 'pen'; document.querySelectorAll('[data-tool]').forEach((tool) => tool.classList.toggle('active', tool === button)); els.paper.classList.toggle('pen-mode', state.penMode); }));
window.addEventListener('resize', () => { resizeCanvas(); drawStrokes(); });
window.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'p' && document.activeElement !== els.editor) document.querySelector('[data-tool="pen"]').click(); });
setupInk();
window.mynotes.load().then((data) => { state.data = data; render(); });
