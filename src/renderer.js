const COVER_COLORS = ['#c44536','#d9763b','#e0b145','#4f8f62','#3d7c8a','#3f5f9a','#6b4f8a','#2f3136'];
const PAGE_W = 794;
const PAGE_H = 1123;

/* ─── Color palette for color picker ────────────────────────────────── */
const COLOR_PALETTE = [
  '#000000','#1a1a1a','#3d3d3d','#666666','#999999','#cccccc','#e8e8e8','#ffffff',
  '#c44536','#d9763b','#e0b145','#4f8f62','#3d7c8a','#3f5f9a','#6b4f8a','#9b3870',
  '#ff4444','#ff8c00','#ffd700','#32cd32','#00bcd4','#2196f3','#9c27b0','#e91e63',
  '#ffcdd2','#ffe0b2','#fff9c4','#c8e6c9','#b2ebf2','#bbdefb','#e1bee7','#f8bbd0',
  '#b71c1c','#bf360c','#f57f17','#1b5e20','#006064','#0d47a1','#4a148c','#880e4f',
  '#795548','#607d8b','#455a64','#37474f','#263238','#1a237e','#311b92','#4e342e',
];

const state = {
  data: { notebooks: [] },
  view: 'library',
  notebookId: null,
  pageId: null,
  tool: 'pen',
  color: '#1f2933',
  size: 2,
  currentStroke: null,
  undo: [],
  redo: [],
  saveTimer: null,
  modal: null,
  sidebarOpen: true,
  theme: localStorage.getItem('theme') || 'light',
  zoom: 1.0,
  openPopover: null  // track which popover is open
};

const $ = (id) => document.getElementById(id);
const libraryView    = $('libraryView');
const notebookView   = $('notebookView');
const notebookGrid   = $('notebookGrid');
const pagesScroller  = $('pagesScroller');
const pageThumbs     = $('pageThumbs');
const toast          = $('toast');
const pageRail       = $('pageRail');

/* ═══════════════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════════════ */
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
  localStorage.setItem('theme', theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = $('themeToggleBtn');
  if (!btn) return;
  btn.innerHTML = state.theme === 'dark'
    ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" fill="currentColor"/>
       </svg>`
    : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="3" fill="currentColor"/>
        <line x1="7" y1="0.5" x2="7" y2="2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="7" y1="12" x2="7" y2="13.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="0.5" y1="7" x2="2" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="12" y1="7" x2="13.5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="2.4" y1="2.4" x2="3.4" y2="3.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="10.6" y1="10.6" x2="11.6" y2="11.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="11.6" y1="2.4" x2="10.6" y2="3.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="3.4" y1="10.6" x2="2.4" y2="11.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
       </svg>`;
  btn.title = state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

$('themeToggleBtn').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

/* ═══════════════════════════════════════════════════════════════════════
   WINDOW CONTROLS
═══════════════════════════════════════════════════════════════════════ */
$('wcMinimize').addEventListener('click', () => window.mynotes.minimize());
$('wcMaximize').addEventListener('click', () => window.mynotes.maximize());
$('wcClose').addEventListener('click', () => window.mynotes.close());

/* ═══════════════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════════════ */
function setSidebar(open) {
  state.sidebarOpen = open;
  pageRail.classList.toggle('collapsed', !open);
  if (state.view === 'notebook') setTimeout(() => renderNotebook(), 230);
}
$('sidebarToggleBtn').addEventListener('click', () => setSidebar(!state.sidebarOpen));

/* ═══════════════════════════════════════════════════════════════════════
   POPOVERS  (shapes, paper, color) — fixed-positioned to escape overflow
═══════════════════════════════════════════════════════════════════════ */
function positionPopover(popover, trigger) {
  const tr = trigger.getBoundingClientRect();
  const pw = popover.offsetWidth  || 200;
  const ph = popover.offsetHeight || 160;
  // prefer centered under trigger, but keep inside viewport
  let left = tr.left + tr.width / 2 - pw / 2;
  let top  = tr.bottom + 8;
  left = Math.max(8, Math.min(left, window.innerWidth  - pw - 8));
  top  = Math.max(8, Math.min(top,  window.innerHeight - ph - 8));
  popover.style.left = left + 'px';
  popover.style.top  = top  + 'px';
}

function openPopover(id, triggerId) {
  closeAllPopovers();
  const el  = $(id);
  const btn = $(triggerId);
  if (!el || !btn) return;
  el.classList.add('open');
  state.openPopover = id;
  // Position after paint so offsetWidth is valid
  requestAnimationFrame(() => positionPopover(el, btn));
}

function closeAllPopovers() {
  document.querySelectorAll('.tool-popover').forEach((p) => p.classList.remove('open'));
  state.openPopover = null;
}

function togglePopover(id, triggerId) {
  if (state.openPopover === id) closeAllPopovers();
  else openPopover(id, triggerId);
}

$('shapesBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePopover('shapesPopover', 'shapesBtn'); });
$('paperBtn').addEventListener('click',  (e) => { e.stopPropagation(); togglePopover('paperPopover',  'paperBtn'); });
$('colorBtn').addEventListener('click',  (e) => { e.stopPropagation(); togglePopover('colorPopover',  'colorBtn'); });

// close when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tool-group, .tool-popover')) closeAllPopovers();
  if (!e.target.closest('.context-menu, [data-menu]')) closeMenu();
});

/* ─── Shapes popover clicks ─────────────────────────────────────────── */
const SHAPE_TOOLS = new Set(['line','rect','roundrect','circle','triangle','diamond','arrow','dbarrow','star']);

$('shapesPopover').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (!btn) return;
  state.tool = btn.dataset.tool;
  // Mirror icon into shapes button
  $('shapeIcon').innerHTML = btn.querySelector('svg').innerHTML;
  $('shapeIcon').setAttribute('viewBox', btn.querySelector('svg').getAttribute('viewBox'));
  // Mark active
  $('shapesPopover').querySelectorAll('.pop-btn').forEach((b) => b.classList.toggle('active', b === btn));
  $('shapesBtn').classList.add('active');
  closeAllPopovers();
  updatePageToolMode();
});

/* ─── Paper style popover clicks ────────────────────────────────────── */
$('paperPopover').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-paper]');
  if (!btn) return;
  const paper = btn.dataset.paper;
  const page = currentPage();
  if (page) {
    page.paper = paper;
    persist();
    renderNotebook();
  }
  $('paperPopover').querySelectorAll('.paper-btn').forEach((b) => b.classList.toggle('active', b === btn));
  closeAllPopovers();
});

/* ─── Color popover ─────────────────────────────────────────────────── */
function buildColorPalette() {
  const palette = $('cpPalette');
  palette.innerHTML = '';
  COLOR_PALETTE.forEach((hex) => {
    const btn = document.createElement('button');
    btn.className = `cp-swatch ${hex === state.color ? 'active' : ''}`;
    btn.style.background = hex;
    btn.style.color = hex; // used by box-shadow active ring
    btn.dataset.color = hex;
    btn.title = hex;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setColor(hex);
      closeAllPopovers();
    });
    palette.appendChild(btn);
  });
  $('cpHexInput').value = state.color.replace('#', '');
  $('cpHexPreview').style.background = state.color;
}

function setColor(hex) {
  // Ensure it starts with #
  if (!hex.startsWith('#')) hex = '#' + hex;
  state.color = hex;
  $('colorSwatch').style.background = hex;
  $('colorSwatch').style.setProperty('--current-color', hex);
  $('cpHexPreview').style.background = hex;
  $('cpHexInput').value = hex.replace('#', '');
  // Update active swatch
  $('cpPalette').querySelectorAll('.cp-swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.color === hex);
  });
  updatePageToolMode();
}

$('cpHexInput').addEventListener('input', (e) => {
  const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
  e.target.value = val;
  if (val.length === 6) {
    setColor('#' + val);
  } else {
    $('cpHexPreview').style.background = val.length === 6 ? '#' + val : 'transparent';
  }
});

$('cpHexInput').addEventListener('keydown', (e) => e.stopPropagation());

/* ═══════════════════════════════════════════════════════════════════════
   ZOOM
═══════════════════════════════════════════════════════════════════════ */
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const ZOOM_DEFAULT = 1.0;

function setZoom(z) {
  state.zoom = Math.min(3.0, Math.max(0.1, z));
  $('zoomPct').textContent = Math.round(state.zoom * 100) + '%';
  applyZoomToSheets();
}

function applyZoomToSheets() {
  pagesScroller.querySelectorAll('.page-sheet').forEach((sheet) => {
    if (state.zoom === 1) {
      sheet.style.transform = '';
      sheet.style.marginBottom = '';
    } else {
      const scaledH = sheet.offsetHeight * state.zoom;
      const extra = scaledH - sheet.offsetHeight;
      sheet.style.transform = `scale(${state.zoom})`;
      // push siblings down so pages don't overlap
      sheet.style.marginBottom = `${extra + 28}px`;
    }
  });
}

function zoomStep(direction) {
  const idx = ZOOM_STEPS.findIndex((z) => z >= state.zoom - 0.001);
  if (direction > 0) setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, idx + 1)]);
  else setZoom(ZOOM_STEPS[Math.max(0, idx - 1)]);
}

function zoomFitWidth() {
  const scrollerW = pagesScroller.clientWidth - 64; // 32px padding each side
  const z = Math.min(3.0, Math.max(0.1, scrollerW / PAGE_W));
  setZoom(z);
}

function zoomFitHeight() {
  const scrollerH = pagesScroller.clientHeight - 56;
  const z = Math.min(3.0, Math.max(0.1, scrollerH / PAGE_H));
  setZoom(z);
}

$('zoomInBtn').addEventListener('click', () => zoomStep(1));
$('zoomOutBtn').addEventListener('click', () => zoomStep(-1));
$('zoomFitBtn').addEventListener('click', () => {
  // Cycle: 100% → fit-width → fit-height → 100%
  if (Math.abs(state.zoom - 1.0) < 0.01) zoomFitWidth();
  else if ($('zoomPct').dataset.mode === 'width') zoomFitHeight();
  else setZoom(ZOOM_DEFAULT);
  $('zoomPct').dataset.mode =
    Math.abs(state.zoom - 1.0) < 0.01 ? '' :
    (Math.abs(state.zoom - (pagesScroller.clientWidth - 64) / PAGE_W) < 0.01 ? 'width' : 'height');
});

pagesScroller.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  zoomStep(e.deltaY < 0 ? 1 : -1);
}, { passive: false });

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════════ */
function uid(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`; }
function notebook() { return state.data.notebooks.find((n) => n.id === state.notebookId); }
function currentPage() {
  const book = notebook();
  return book?.pages.find((p) => p.id === state.pageId) || book?.pages[0];
}
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove('show'), 2200);
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
  return { id: uid('notebook'), name, color: color || COVER_COLORS[state.data.notebooks.length % COVER_COLORS.length], updatedAt: Date.now(), pages: [blankPage(1)] };
}
function setView(view) {
  state.view = view;
  libraryView.classList.toggle('hidden', view !== 'library');
  notebookView.classList.toggle('hidden', view !== 'notebook');
}
function pageIndex() { return notebook().pages.findIndex((p) => p.id === state.pageId); }
function updateIndicator() {
  const book = notebook();
  if (!book) return;
  const idx = Math.max(0, pageIndex());
  $('pageIndicator').textContent = `Page ${idx + 1} of ${book.pages.length}`;
  $('notebookTitleBtn').textContent = book.name;
}
function showLoading(text) { $('loadingText').textContent = text; $('loadingOverlay').classList.remove('hidden'); }
function hideLoading() { $('loadingOverlay').classList.add('hidden'); }
function closeMenu() { document.querySelector('.context-menu')?.remove(); }
function escapeHtml(v) { return String(v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

function relativePoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  // Account for zoom when computing relative coords
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
    p: event.pressure || 0.5
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   DRAWING ENGINE
═══════════════════════════════════════════════════════════════════════ */
function drawStroke(ctx, stroke, width, height) {
  if (!stroke.points?.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(1, stroke.size) * (width / PAGE_W);

  const tool = stroke.tool;

  if (tool === 'line') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    ctx.beginPath();
    ctx.moveTo(p0.x * width, p0.y * height);
    ctx.lineTo(p1.x * width, p1.y * height);
    ctx.stroke();
  } else if (tool === 'rect') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    ctx.beginPath();
    ctx.strokeRect(p0.x*width, p0.y*height, (p1.x-p0.x)*width, (p1.y-p0.y)*height);
  } else if (tool === 'roundrect') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const x = p0.x*width, y = p0.y*height, w = (p1.x-p0.x)*width, h = (p1.y-p0.y)*height, r = Math.min(Math.abs(w), Math.abs(h)) * 0.15;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.stroke();
  } else if (tool === 'circle') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const cx = ((p0.x+p1.x)/2)*width, cy = ((p0.y+p1.y)/2)*height;
    const rx = Math.abs(p1.x-p0.x)/2*width, ry = Math.abs(p1.y-p0.y)/2*height;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1,rx), Math.max(1,ry), 0, 0, Math.PI*2);
    ctx.stroke();
  } else if (tool === 'triangle') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const cx = ((p0.x+p1.x)/2)*width, top = p0.y*height;
    const bl = p1.x*width, br = p1.x*width - (p1.x-p0.x)*width, bottom = p1.y*height;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(p1.x*width, bottom);
    ctx.lineTo(p0.x*width, bottom);
    ctx.closePath();
    ctx.stroke();
  } else if (tool === 'diamond') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const cx = ((p0.x+p1.x)/2)*width, cy = ((p0.y+p1.y)/2)*height;
    const hw = Math.abs(p1.x-p0.x)/2*width, hh = Math.abs(p1.y-p0.y)/2*height;
    ctx.beginPath();
    ctx.moveTo(cx, cy-hh); ctx.lineTo(cx+hw, cy);
    ctx.lineTo(cx, cy+hh); ctx.lineTo(cx-hw, cy); ctx.closePath();
    ctx.stroke();
  } else if (tool === 'arrow') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const x0=p0.x*width, y0=p0.y*height, x1=p1.x*width, y1=p1.y*height;
    const angle = Math.atan2(y1-y0, x1-x0);
    const hLen = Math.max(10, Math.min(20, Math.hypot(x1-x0,y1-y0)*0.18));
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.lineTo(x1-hLen*Math.cos(angle-Math.PI/6), y1-hLen*Math.sin(angle-Math.PI/6));
    ctx.moveTo(x1,y1);
    ctx.lineTo(x1-hLen*Math.cos(angle+Math.PI/6), y1-hLen*Math.sin(angle+Math.PI/6));
    ctx.stroke();
  } else if (tool === 'dbarrow') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const x0=p0.x*width, y0=p0.y*height, x1=p1.x*width, y1=p1.y*height;
    const angle = Math.atan2(y1-y0, x1-x0);
    const hLen = Math.max(10, Math.min(20, Math.hypot(x1-x0,y1-y0)*0.18));
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.moveTo(x1,y1);
    ctx.lineTo(x1-hLen*Math.cos(angle-Math.PI/6), y1-hLen*Math.sin(angle-Math.PI/6));
    ctx.moveTo(x1,y1);
    ctx.lineTo(x1-hLen*Math.cos(angle+Math.PI/6), y1-hLen*Math.sin(angle+Math.PI/6));
    ctx.moveTo(x0,y0);
    ctx.lineTo(x0+hLen*Math.cos(angle-Math.PI/6), y0+hLen*Math.sin(angle-Math.PI/6));
    ctx.moveTo(x0,y0);
    ctx.lineTo(x0+hLen*Math.cos(angle+Math.PI/6), y0+hLen*Math.sin(angle+Math.PI/6));
    ctx.stroke();
  } else if (tool === 'star') {
    const p0 = stroke.points[0], p1 = stroke.points[stroke.points.length - 1];
    const cx=((p0.x+p1.x)/2)*width, cy=((p0.y+p1.y)/2)*height;
    const outerR = Math.min(Math.abs(p1.x-p0.x)/2*width, Math.abs(p1.y-p0.y)/2*height);
    const innerR = outerR * 0.4;
    ctx.beginPath();
    for (let i=0; i<10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI / 5) - Math.PI / 2;
      if (i===0) ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
      else ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    }
    ctx.closePath(); ctx.stroke();
  } else {
    // freehand pen
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = pt.x * width, y = pt.y * height;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

/* ─── Segment-level eraser (not whole-stroke) ───────────────────────── */
function eraseAtPixel(page, point, canvas) {
  const eraserRadius = (state.size * 2 + 4) / canvas.clientWidth;
  let changed = false;

  page.strokes = page.strokes.reduce((acc, stroke) => {
    if (!stroke.points?.length) return acc;
    // Check if any point is within eraser radius
    const touched = stroke.points.some((pt) => Math.hypot(pt.x - point.x, pt.y - point.y) < eraserRadius);
    if (!touched) { acc.push(stroke); return acc; }
    // Split stroke around erased points
    changed = true;
    let segment = [];
    stroke.points.forEach((pt) => {
      if (Math.hypot(pt.x - point.x, pt.y - point.y) < eraserRadius) {
        if (segment.length > 1) acc.push({ ...stroke, id: uid('stroke'), points: segment });
        segment = [];
      } else {
        segment.push(pt);
      }
    });
    if (segment.length > 1) acc.push({ ...stroke, id: uid('stroke'), points: segment });
    return acc;
  }, []);

  if (changed) {
    state.undo.push({ type: 'erase', pageId: page.id });
    state.redo = [];
  }
  return changed;
}

function renderCanvas(canvas, page, thumb = false) {
  const ratio = thumb ? 1 : (window.devicePixelRatio || 1);
  const width  = canvas.clientWidth  || (thumb ? 116 : PAGE_W);
  const height = canvas.clientHeight || (thumb ? 154 : PAGE_H);
  canvas.width  = width  * ratio;
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
    box.style.top  = `${item.y * 100}%`;
    box.addEventListener('input', () => { item.value = box.textContent; persist(); });
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.appendChild(box);
  });
}

function syncCurrentPageFromScroll() {
  const sheets = [...pagesScroller.querySelectorAll('.page-sheet')];
  if (!sheets.length) return;
  const mid = pagesScroller.scrollTop + pagesScroller.clientHeight / 2;
  let closest = sheets[0], dist = Infinity;
  sheets.forEach((s) => {
    const d = Math.abs((s.offsetTop + s.offsetHeight / 2) - mid);
    if (d < dist) { dist = d; closest = s; }
  });
  if (closest.dataset.page !== state.pageId) {
    state.pageId = closest.dataset.page;
    highlightThumbs();
    updateIndicator();
  }
}

function highlightThumbs() {
  pageThumbs.querySelectorAll('.page-thumb').forEach((b) => b.classList.toggle('current', b.dataset.page === state.pageId));
}

function goToPage(pageId, smooth = true) {
  state.pageId = pageId;
  const sheet = pagesScroller.querySelector(`[data-page="${pageId}"]`);
  if (sheet) sheet.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  highlightThumbs();
  updateIndicator();
}

function renderThumbs() {
  const book = notebook();
  pageThumbs.innerHTML = '';
  book.pages.forEach((page, index) => {
    const btn = document.createElement('button');
    btn.className = `page-thumb ${page.id === state.pageId ? 'current' : ''}`;
    btn.dataset.page = page.id;
    btn.innerHTML = `<canvas></canvas><span>${index + 1}</span>`;
    btn.addEventListener('click', () => goToPage(page.id));
    pageThumbs.appendChild(btn);
    renderCanvas(btn.querySelector('canvas'), page, true);
  });
}

/* ─── Per-canvas pointer events ─────────────────────────────────────── */
function bindPageCanvas(canvas, page) {
  let erasing = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (state.tool === 'eraser') {
      canvas.setPointerCapture(e.pointerId);
      erasing = true;
      const pt = relativePoint(e, canvas);
      eraseAtPixel(page, pt, canvas);
      renderCanvas(canvas, page);
      persist();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    const point = relativePoint(e, canvas);
    state.currentStroke = {
      id: uid('stroke'), tool: state.tool,
      color: state.color, size: Number(state.size),
      points: [point]
    };
    page.strokes.push(state.currentStroke);
    state.undo.push({ type: 'stroke', pageId: page.id, strokeId: state.currentStroke.id });
    state.redo = [];
  });

  canvas.addEventListener('pointermove', (e) => {
    if (erasing) {
      const pt = relativePoint(e, canvas);
      if (eraseAtPixel(page, pt, canvas)) {
        renderCanvas(canvas, page);
        persist();
      }
      return;
    }
    if (!state.currentStroke || state.currentStroke !== page.strokes.at(-1)) return;
    const pt = relativePoint(e, canvas);
    if (SHAPE_TOOLS.has(state.tool)) {
      state.currentStroke.points = [state.currentStroke.points[0], pt];
    } else {
      state.currentStroke.points.push(pt);
    }
    renderCanvas(canvas, page);
  });

  canvas.addEventListener('pointerup', () => {
    if (erasing) { erasing = false; renderThumbs(); return; }
    if (state.currentStroke) persist();
    state.currentStroke = null;
    renderThumbs();
  });
}

/* ─── Render pages ───────────────────────────────────────────────────── */
function renderPages() {
  const book = notebook();
  pagesScroller.innerHTML = '';
  book.pages.forEach((page) => {
    const sheet = document.createElement('article');
    sheet.className = `page-sheet ${page.paper || 'lined'}`;
    sheet.dataset.page = page.id;
    const canvas = document.createElement('canvas');
    const layer  = document.createElement('div');
    layer.className = 'text-layer';
    sheet.append(canvas, layer);
    pagesScroller.appendChild(sheet);
    requestAnimationFrame(() => { renderCanvas(canvas, page); renderTexts(layer, page); });
    bindPageCanvas(canvas, page);
  });

  // ── Add-page float button after last page ───────────────────────────
  const addBtn = document.createElement('button');
  addBtn.className = 'add-page-float';
  addBtn.title = 'Add new page';
  addBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  addBtn.addEventListener('click', addPage);
  pagesScroller.appendChild(addBtn);

  applyZoomToSheets();
  updatePageToolMode();
  updatePaperBtn();
}

function updatePaperBtn() {
  const page = currentPage();
  if (!page) return;
  // Update paper popover active states
  $('paperPopover').querySelectorAll('.paper-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.paper === (page.paper || 'lined'));
  });
}

function updatePageToolMode() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
  document.querySelectorAll('.tool-btn.size-preset').forEach((b) => b.classList.toggle('active', Number(b.dataset.size) === Number(state.size)));
  const slider = $('strokeSize');
  if (slider) slider.value = state.size;
  // Update color swatch
  $('colorSwatch').style.background = state.color;
  // If current tool is a shape, mark shapes btn active
  $('shapesBtn').classList.toggle('active', SHAPE_TOOLS.has(state.tool));
}

function renderNotebook() {
  if (!notebook()) return;
  if (!state.pageId) state.pageId = notebook().pages[0].id;
  renderPages();
  renderThumbs();
  updateIndicator();
  requestAnimationFrame(() => goToPage(state.pageId, false));
}

/* ═══════════════════════════════════════════════════════════════════════
   LIBRARY
═══════════════════════════════════════════════════════════════════════ */
function formatEdited(ts) {
  const d = new Date(ts || Date.now());
  const t = d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
  const today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate()-1);
  if (d.toDateString() === today.toDateString()) return `Today, ${t}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${t}`;
  return d.toLocaleDateString([], { month:'short', day:'numeric' }) + ', ' + t;
}

function paintPreview(canvas, item) {
  const w=236, h=124, ratio = window.devicePixelRatio||1;
  canvas.width=w*ratio; canvas.height=h*ratio;
  canvas.style.width=`${w}px`; canvas.style.height=`${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.fillStyle = '#faf9f8'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = '#efece8'; ctx.lineWidth = 1;
  for (let y=18; y<h; y+=14) { ctx.beginPath(); ctx.moveTo(12,y); ctx.lineTo(w-12,y); ctx.stroke(); }
  const page = item.pages[0];
  if (page) {
    (page.strokes||[]).forEach((s) => drawStroke(ctx, s, w, h));
    ctx.fillStyle = '#323130'; ctx.font = '12px Segoe UI,system-ui,sans-serif';
    (page.texts||[]).slice(0,3).forEach((t,i) => { if (t.value) ctx.fillText(t.value.slice(0,28), 16, 36+i*18); });
  }
}

function renderLibrary() {
  const query = ($('searchNotebooks').value||'').trim().toLowerCase();
  const notebooks = state.data.notebooks.slice()
    .sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0))
    .filter((n) => n.name.toLowerCase().includes(query));

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
      <button class="preview-open" data-open="${item.id}"><canvas class="preview"></canvas></button>
      <div class="board-info">
        <div class="board-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${formatEdited(item.updatedAt)}</small>
        </div>
        <button class="card-menu" data-menu="${item.id}" title="Options">⋯</button>
      </div>`;
    notebookGrid.appendChild(card);
    paintPreview(card.querySelector('canvas'), item);
  });

  notebookGrid.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openNotebook(b.dataset.open)));
  notebookGrid.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    showNotebookMenu(b.dataset.menu, e.clientX, e.clientY);
  }));
}

function showNotebookMenu(id, x, y) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${x}px`; menu.style.top = `${y}px`;
  menu.innerHTML = `<button data-action="open">Open</button><button data-action="rename">Rename</button><button data-action="delete" class="danger">Delete</button>`;
  document.body.appendChild(menu);
  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action; closeMenu();
    if (action === 'open') openNotebook(id);
    if (action === 'rename') openModal({ mode:'rename', notebook: state.data.notebooks.find((n) => n.id===id) });
    if (action === 'delete') deleteNotebook(id);
  });
}

async function openNotebook(id) {
  const item = state.data.notebooks.find((n) => n.id === id);
  if (!item) return;
  showLoading(`Opening ${item.name}…`);
  state.notebookId = id;
  state.pageId = item.pages[0].id;
  state.undo = []; state.redo = [];
  state.zoom = 1.0;
  await new Promise((r) => setTimeout(r, 280));
  setView('notebook');
  renderNotebook();
  hideLoading();
  setZoom(1.0);
}

function deleteNotebook(id) {
  if (state.data.notebooks.length === 1) { showToast('Keep at least one notebook.'); return; }
  state.data.notebooks = state.data.notebooks.filter((n) => n.id !== id);
  persist(true); renderLibrary(); showToast('Notebook deleted.');
}

function addPage() {
  const book = notebook();
  const page = blankPage(book.pages.length + 1);
  book.pages.push(page);
  persist(); renderNotebook();
  requestAnimationFrame(() => goToPage(page.id));
}

function undo() {
  const action = state.undo.pop(); if (!action) return;
  const page = notebook().pages.find((p) => p.id === action.pageId);
  if (!page) return;
  if (action.type === 'stroke') {
    const stroke = page.strokes.find((s) => s.id === action.strokeId);
    page.strokes = page.strokes.filter((s) => s.id !== action.strokeId);
    state.redo.push({ ...action, stroke });
  }
  persist(); renderNotebook();
}

function redo() {
  const action = state.redo.pop(); if (!action) return;
  const page = notebook().pages.find((p) => p.id === action.pageId);
  if (!page) return;
  if (action.type === 'stroke' && action.stroke) {
    page.strokes.push(action.stroke);
    state.undo.push({ type:'stroke', pageId: page.id, strokeId: action.stroke.id });
  }
  persist(); renderNotebook();
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════════════════════════ */
function openModal({ mode, notebook: item }) {
  state.modal = { mode, notebook: item };
  $('modalTitle').textContent = mode === 'create' ? 'New notebook' : 'Rename notebook';
  $('modalName').value = item?.name || 'Untitled notebook';
  $('colorPicker').innerHTML = COVER_COLORS.map((c) =>
    `<button type="button" class="color-dot ${c===(item?.color||COVER_COLORS[0])?'selected':''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
  $('colorPicker').dataset.color = item?.color || COVER_COLORS[0];
  $('modalOverlay').classList.remove('hidden');
  $('modalName').focus(); $('modalName').select();
}
function closeModal() { $('modalOverlay').classList.add('hidden'); state.modal = null; }

/* ═══════════════════════════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════════════════════════ */
$('colorPicker').addEventListener('click', (e) => {
  const color = e.target.dataset.color; if (!color) return;
  $('colorPicker').dataset.color = color;
  $('colorPicker').querySelectorAll('.color-dot').forEach((d) => d.classList.toggle('selected', d.dataset.color===color));
});

$('modalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('modalName').value.trim();
  const color = $('colorPicker').dataset.color;
  if (!name || !state.modal) return;
  if (state.modal.mode === 'create') {
    const item = blankNotebook(name, color);
    state.data.notebooks.push(item); persist(true); renderLibrary(); openNotebook(item.id);
  } else if (state.modal.notebook) {
    state.modal.notebook.name = name; state.modal.notebook.color = color;
    persist(true); renderLibrary();
    if (state.view === 'notebook') updateIndicator();
    showToast('Notebook renamed.');
  }
  closeModal();
});

$('modalCancel').addEventListener('click', closeModal);
$('modalOverlay').addEventListener('click', (e) => { if (e.target === $('modalOverlay')) closeModal(); });

$('searchNotebooks').addEventListener('input', renderLibrary);
$('allNotebooksLink').addEventListener('click', () => { $('searchNotebooks').value = ''; renderLibrary(); });
$('backToLibrary').addEventListener('click', () => { persist(true); setView('library'); renderLibrary(); });
$('notebookTitleBtn').addEventListener('click', () => openModal({ mode:'rename', notebook: notebook() }));
$('addPageRailBtn').addEventListener('click', addPage);

$('prevPageBtn').addEventListener('click', () => {
  const book = notebook(), idx = pageIndex();
  if (idx > 0) goToPage(book.pages[idx - 1].id);
});
$('nextPageBtn').addEventListener('click', () => {
  const book = notebook(), idx = pageIndex();
  if (idx < book.pages.length - 1) goToPage(book.pages[idx + 1].id);
});

$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('clearPageBtn').addEventListener('click', () => {
  const page = currentPage(); if (!page) return;
  page.strokes = []; page.texts = []; persist(); renderNotebook();
});
$('exportPdfBtn').addEventListener('click', async () => {
  persist(true);
  const result = await window.mynotes.exportPdf(notebook());
  if (!result.canceled) showToast('Notebook exported as PDF.');
});

$('strokeSize').addEventListener('input', (e) => {
  state.size = Number(e.target.value);
  document.querySelectorAll('.tool-btn.size-preset').forEach((b) => b.classList.remove('active'));
});

$('toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]:not(.pop-btn), [data-size]');
  if (!btn) return;
  const tool = btn.dataset.tool, size = btn.dataset.size;
  if (tool && !SHAPE_TOOLS.has(tool)) { state.tool = tool; $('shapesBtn').classList.remove('active'); }
  if (size !== undefined) { state.size = Number(size); $('strokeSize').value = state.size; }
  updatePageToolMode();
});

pagesScroller.addEventListener('scroll', () => {
  clearTimeout(pagesScroller._snapT);
  pagesScroller._snapT = setTimeout(syncCurrentPageFromScroll, 80);
});

/* ─── Keyboard shortcuts ─────────────────────────────────────────────── */
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const editing = tag==='input' || tag==='textarea' || document.activeElement?.isContentEditable;

  if (e.key === 'Escape') {
    closeAllPopovers(); closeMenu(); closeModal();
    if (state.view === 'notebook' && document.activeElement?.className !== 'text-box') {
      persist(true); setView('library'); renderLibrary();
    }
  }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey||e.metaKey) && e.key === '=') { e.preventDefault(); zoomStep(1); }
  if ((e.ctrlKey||e.metaKey) && e.key === '-') { e.preventDefault(); zoomStep(-1); }
  if ((e.ctrlKey||e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(ZOOM_DEFAULT); }

  if (state.view === 'notebook' && !editing && !e.ctrlKey && !e.metaKey) {
    const shortcuts = { p:'pen', e:'eraser', l:'line', r:'rect', o:'circle' };
    if (shortcuts[e.key.toLowerCase()]) { state.tool = shortcuts[e.key.toLowerCase()]; updatePageToolMode(); }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') $('nextPageBtn').click();
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   $('prevPageBtn').click();
    if (e.key === '\\') setSidebar(!state.sidebarOpen);
  }
});

window.addEventListener('resize', () => { if (state.view === 'notebook') renderNotebook(); });

/* ═══════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════ */
async function boot() {
  applyTheme(state.theme);
  buildColorPalette();
  setColor(state.color);
  state.data = await window.mynotes.load();
  if (!state.data.notebooks?.length) state.data.notebooks = [blankNotebook('My first notebook', COVER_COLORS[0])];
  setView('library');
  renderLibrary();
}

boot();
