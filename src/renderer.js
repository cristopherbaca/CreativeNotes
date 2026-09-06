/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════════ */
const PAGE_W = 794;
const PAGE_H = 1123;

const COVER_COLORS  = ['#c44536','#d9763b','#e0b145','#4f8f62','#3d7c8a','#3f5f9a','#6b4f8a','#2f3136'];
const SHAPE_TOOLS   = new Set(['line','rect','roundrect','circle','triangle','diamond','arrow','dbarrow','star']);
const ZOOM_STEPS    = [0.25,0.33,0.5,0.67,0.75,0.9,1.0,1.1,1.25,1.5,1.75,2.0,2.5,3.0];
const ZOOM_DEFAULT  = 1.0;
const SAVE_DELAY    = 800; // ms

const COLOR_PALETTE = [
  '#000000','#1a1a1a','#3d3d3d','#666666','#999999','#cccccc','#e8e8e8','#ffffff',
  '#c44536','#d9763b','#e0b145','#4f8f62','#3d7c8a','#3f5f9a','#6b4f8a','#9b3870',
  '#ff4444','#ff8c00','#ffd700','#32cd32','#00bcd4','#2196f3','#9c27b0','#e91e63',
  '#ffcdd2','#ffe0b2','#fff9c4','#c8e6c9','#b2ebf2','#bbdefb','#e1bee7','#f8bbd0',
  '#b71c1c','#bf360c','#f57f17','#1b5e20','#006064','#0d47a1','#4a148c','#880e4f',
  '#795548','#607d8b','#455a64','#37474f','#263238','#1a237e','#311b92','#4e342e',
];

const PAGE_BG_COLORS = [
  '#ffffff','#fdf6e3','#f0f4ff','#f0fff4','#fff0f0',
  '#1a1a2e','#0d1117','#1e1e2e','#2d1b69','#1a2e1a',
];

/* ═══════════════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════════════ */
const state = {
  data:          { notebooks: [] },
  view:          'library',
  notebookId:    null,
  pageId:        null,
  tool:          'pen',
  color:         '#1f2933',
  size:          2,
  currentStroke: null,
  undo:          [],
  redo:          [],
  saveTimer:     null,
  modal:         null,
  sidebarOpen:   true,
  theme:         localStorage.getItem('theme') || 'light',
  zoom:          ZOOM_DEFAULT,
  openPopover:   null,
};

/* ═══════════════════════════════════════════════════════════════════════
   DOM REFS  (cached once at startup)
═══════════════════════════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);
const libraryView   = $('libraryView');
const notebookView  = $('notebookView');
const notebookGrid  = $('notebookGrid');
const pagesScroller = $('pagesScroller');
const pageThumbs    = $('pageThumbs');
const toast         = $('toast');
const pageRail      = $('pageRail');

/* ═══════════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════════ */
const uid = (pfx) => `${pfx}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
const notebook    = ()  => state.data.notebooks.find((n) => n.id === state.notebookId);
const currentPage = ()  => { const b = notebook(); return b?.pages.find((p) => p.id === state.pageId) ?? b?.pages[0]; };
const pageIndex   = ()  => notebook().pages.findIndex((p) => p.id === state.pageId);
const escapeHtml  = (v) => String(v).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2200);
}

function persist(immediate = false) {
  const book = notebook();
  if (book) book.updatedAt = Date.now();
  clearTimeout(state.saveTimer);
  if (immediate) { window.mynotes.save(state.data); return; }
  state.saveTimer = setTimeout(() => window.mynotes.save(state.data), SAVE_DELAY);
}

function blankPage(index) {
  return { id: uid('page'), name: `Page ${index}`, paper: 'lined', strokes: [], texts: [] };
}
function blankNotebook(name, color) {
  return {
    id: uid('notebook'), name,
    color: color ?? COVER_COLORS[state.data.notebooks.length % COVER_COLORS.length],
    updatedAt: Date.now(),
    pages: [blankPage(1)],
  };
}

function setView(view) {
  state.view = view;
  libraryView.classList.toggle('hidden', view !== 'library');
  notebookView.classList.toggle('hidden', view !== 'notebook');
}

function updateIndicator() {
  const book = notebook();
  if (!book) return;
  $('pageIndicator').textContent = `Page ${Math.max(0, pageIndex()) + 1} of ${book.pages.length}`;
  $('notebookTitleBtn').textContent = book.name;
}

function formatEdited(ts) {
  const d    = new Date(ts || Date.now());
  const t    = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const now  = new Date();
  const yest = new Date(); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return `Today, ${t}`;
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${t}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + t;
}

const closeMenu     = () => document.querySelector('.context-menu')?.remove();
const showLoading   = (text) => { $('loadingText').textContent = text; $('loadingOverlay').classList.remove('hidden'); };
const hideLoading   = () => $('loadingOverlay').classList.add('hidden');
const closeModal    = () => { $('modalOverlay').classList.add('hidden'); state.modal = null; };

/* ═══════════════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════════════ */
const MOON_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 8.5A5.5 5.5 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5z" fill="currentColor"/></svg>`;
const SUN_SVG  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
  <circle cx="7" cy="7" r="3" fill="currentColor"/>
  <line x1="7" y1="0.5" x2="7" y2="2"    stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="7" y1="12"  x2="7" y2="13.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="0.5" y1="7" x2="2"    y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="12"  y1="7" x2="13.5" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="2.4"  y1="2.4"  x2="3.4"  y2="3.4"  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="10.6" y1="10.6" x2="11.6" y2="11.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="11.6" y1="2.4"  x2="10.6" y2="3.4"  stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="3.4"  y1="10.6" x2="2.4"  y2="11.6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
  localStorage.setItem('theme', theme);
  const btn = $('themeToggleBtn');
  btn.innerHTML = theme === 'dark' ? MOON_SVG : SUN_SVG;
  btn.title     = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
}

/* ═══════════════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════════════ */
function setSidebar(open) {
  state.sidebarOpen = open;
  pageRail.classList.toggle('collapsed', !open);
  if (state.view === 'notebook') setTimeout(renderNotebook, 230);
}

/* ═══════════════════════════════════════════════════════════════════════
   POPOVERS
═══════════════════════════════════════════════════════════════════════ */
function positionPopover(popover, trigger) {
  const tr   = trigger.getBoundingClientRect();
  const pw   = popover.offsetWidth  || 200;
  const ph   = popover.offsetHeight || 160;
  const left = Math.max(8, Math.min(tr.left + tr.width / 2 - pw / 2, window.innerWidth  - pw - 8));
  const top  = Math.max(8, Math.min(tr.bottom + 8,                   window.innerHeight - ph - 8));
  popover.style.left = left + 'px';
  popover.style.top  = top  + 'px';
}

function closeAllPopovers() {
  document.querySelectorAll('.tool-popover').forEach((p) => p.classList.remove('open'));
  state.openPopover = null;
}

function openPopover(id, triggerId) {
  closeAllPopovers();
  const el  = $(id);
  const btn = $(triggerId);
  if (!el || !btn) return;
  el.classList.add('open');
  state.openPopover = id;
  requestAnimationFrame(() => positionPopover(el, btn));
}

function togglePopover(id, triggerId) {
  state.openPopover === id ? closeAllPopovers() : openPopover(id, triggerId);
}

/* ═══════════════════════════════════════════════════════════════════════
   ZOOM
═══════════════════════════════════════════════════════════════════════ */
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
      const extra = sheet.offsetHeight * (state.zoom - 1);
      sheet.style.transform    = `scale(${state.zoom})`;
      sheet.style.marginBottom = `${extra + 28}px`;
    }
  });
}

function zoomStep(dir) {
  const idx = ZOOM_STEPS.findIndex((z) => z >= state.zoom - 0.001);
  setZoom(ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir))]);
}

function zoomFitWidth() {
  setZoom(Math.min(3.0, Math.max(0.1, (pagesScroller.clientWidth - 64) / PAGE_W)));
}
function zoomFitHeight() {
  setZoom(Math.min(3.0, Math.max(0.1, (pagesScroller.clientHeight - 56) / PAGE_H)));
}

/* ═══════════════════════════════════════════════════════════════════════
   COLOR PICKER
═══════════════════════════════════════════════════════════════════════ */
function buildColorPalette() {
  const palette = $('cpPalette');
  palette.innerHTML = '';
  for (const hex of COLOR_PALETTE) {
    const btn = document.createElement('button');
    btn.className = `cp-swatch${hex === state.color ? ' active' : ''}`;
    btn.style.cssText = `background:${hex};color:${hex}`;
    btn.dataset.color = hex;
    btn.title = hex;
    palette.appendChild(btn);
  }
  $('cpHexInput').value = state.color.replace('#', '');
  $('cpHexPreview').style.background = state.color;
}

function setColor(hex) {
  if (!hex.startsWith('#')) hex = '#' + hex;
  state.color = hex;
  $('colorSwatch').style.cssText = `background:${hex};--current-color:${hex}`;
  $('cpHexPreview').style.background = hex;
  $('cpHexInput').value = hex.replace('#', '');
  $('cpPalette').querySelectorAll('.cp-swatch').forEach((b) => b.classList.toggle('active', b.dataset.color === hex));
  updateToolbar();
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE BACKGROUND COLOR
═══════════════════════════════════════════════════════════════════════ */
function buildPageBgSwatches() {
  const container = $('pageBgSwatches');
  container.innerHTML = '';
  for (const hex of PAGE_BG_COLORS) {
    const btn = document.createElement('button');
    btn.className = 'paper-bg-swatch';
    btn.style.background = hex;
    btn.dataset.bg = hex;
    btn.title = hex;
    container.appendChild(btn);
  }
}

function setPageBgColor(hex) {
  if (!hex.startsWith('#')) hex = '#' + hex;
  const page = currentPage();
  if (!page) return;
  page.bgColor = hex;
  const sheet = pagesScroller.querySelector(`[data-page="${page.id}"]`);
  if (sheet) sheet.style.backgroundColor = hex;
  syncPageBgUI(hex);
  renderThumbs();
  persist();
}

function syncPageBgUI(hex) {
  $('pageBgPreview').style.background = hex;
  $('pageBgHex').value = hex.replace('#', '');
  $('pageBgSwatches').querySelectorAll('.paper-bg-swatch').forEach((b) => b.classList.toggle('active', b.dataset.bg === hex));
}

/* ═══════════════════════════════════════════════════════════════════════
   DRAWING ENGINE
═══════════════════════════════════════════════════════════════════════ */
function relativePoint(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, p: e.pressure || 0.5 };
}

// Extracts start/end pixel coords from a two-point (shape) stroke
function shapeEnds(stroke, w, h) {
  const p0 = stroke.points[0];
  const p1 = stroke.points[stroke.points.length - 1];
  return [p0.x*w, p0.y*h, p1.x*w, p1.y*h];
}

function drawStroke(ctx, stroke, w, h) {
  if (!stroke.points?.length) return;
  ctx.save();
  ctx.lineCap    = 'round';
  ctx.lineJoin   = 'round';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth   = Math.max(1, stroke.size) * (w / PAGE_W);

  const { tool } = stroke;

  if (tool === 'line') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();

  } else if (tool === 'rect') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    ctx.beginPath(); ctx.strokeRect(x0, y0, x1-x0, y1-y0);

  } else if (tool === 'roundrect') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    const rw = x1-x0, rh = y1-y0, r = Math.min(Math.abs(rw), Math.abs(rh)) * 0.15;
    ctx.beginPath(); ctx.roundRect(x0, y0, rw, rh, r); ctx.stroke();

  } else if (tool === 'circle') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    ctx.beginPath();
    ctx.ellipse((x0+x1)/2, (y0+y1)/2, Math.max(1, Math.abs(x1-x0)/2), Math.max(1, Math.abs(y1-y0)/2), 0, 0, Math.PI*2);
    ctx.stroke();

  } else if (tool === 'triangle') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    ctx.beginPath();
    ctx.moveTo((x0+x1)/2, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1);
    ctx.closePath(); ctx.stroke();

  } else if (tool === 'diamond') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    const cx=(x0+x1)/2, cy=(y0+y1)/2, hw=Math.abs(x1-x0)/2, hh=Math.abs(y1-y0)/2;
    ctx.beginPath();
    ctx.moveTo(cx, cy-hh); ctx.lineTo(cx+hw, cy); ctx.lineTo(cx, cy+hh); ctx.lineTo(cx-hw, cy);
    ctx.closePath(); ctx.stroke();

  } else if (tool === 'arrow' || tool === 'dbarrow') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    const angle = Math.atan2(y1-y0, x1-x0);
    const hl    = Math.max(10, Math.min(20, Math.hypot(x1-x0, y1-y0) * 0.18));
    ctx.beginPath();
    ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
    ctx.lineTo(x1 - hl*Math.cos(angle - Math.PI/6), y1 - hl*Math.sin(angle - Math.PI/6));
    ctx.moveTo(x1,y1);
    ctx.lineTo(x1 - hl*Math.cos(angle + Math.PI/6), y1 - hl*Math.sin(angle + Math.PI/6));
    if (tool === 'dbarrow') {
      ctx.moveTo(x0,y0);
      ctx.lineTo(x0 + hl*Math.cos(angle - Math.PI/6), y0 + hl*Math.sin(angle - Math.PI/6));
      ctx.moveTo(x0,y0);
      ctx.lineTo(x0 + hl*Math.cos(angle + Math.PI/6), y0 + hl*Math.sin(angle + Math.PI/6));
    }
    ctx.stroke();

  } else if (tool === 'star') {
    const [x0,y0,x1,y1] = shapeEnds(stroke, w, h);
    const cx=(x0+x1)/2, cy=(y0+y1)/2;
    const outer = Math.min(Math.abs(x1-x0), Math.abs(y1-y0)) / 2;
    const inner = outer * 0.4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI / 5) - Math.PI / 2;
      i === 0 ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
              : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath(); ctx.stroke();

  } else {
    // Freehand — quadratic bezier through midpoints (smooth, Whiteboard-style)
    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x * w, pts[0].y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color; ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = ((pts[i].x + pts[i+1].x) / 2) * w;
        const my = ((pts[i].y + pts[i+1].y) / 2) * h;
        ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, mx, my);
      }
      ctx.lineTo(pts[pts.length-1].x * w, pts[pts.length-1].y * h);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ─── Segment-level eraser ──────────────────────────────────────────── */
function eraseAtPixel(page, pt, canvas) {
  const radius = (state.size * 2 + 4) / canvas.clientWidth;
  let changed = false;

  page.strokes = page.strokes.reduce((acc, stroke) => {
    if (!stroke.points?.length) return acc;
    if (!stroke.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < radius)) {
      acc.push(stroke); return acc;
    }
    changed = true;
    let seg = [];
    for (const p of stroke.points) {
      if (Math.hypot(p.x - pt.x, p.y - pt.y) < radius) {
        if (seg.length > 1) acc.push({ ...stroke, id: uid('stroke'), points: seg });
        seg = [];
      } else {
        seg.push(p);
      }
    }
    if (seg.length > 1) acc.push({ ...stroke, id: uid('stroke'), points: seg });
    return acc;
  }, []);

  if (changed) { state.undo.push({ type: 'erase', pageId: page.id }); state.redo = []; }
  return changed;
}

/* ─── Canvas helpers ────────────────────────────────────────────────── */
function sizeCanvas(canvas, thumb = false) {
  const ratio  = thumb ? 1 : (window.devicePixelRatio || 1);
  const width  = canvas.clientWidth  || (thumb ? 116 : PAGE_W);
  const height = canvas.clientHeight || (thumb ? 154 : PAGE_H);
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width  = width  * ratio;
    canvas.height = height * ratio;
  }
  return { ratio, width, height };
}

function paintCanvas(canvas, page, thumb = false) {
  const { ratio, width, height } = sizeCanvas(canvas, thumb);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  for (const stroke of (page.strokes || [])) drawStroke(ctx, stroke, width, height);
}

function paintActiveStroke(canvas, stroke) {
  if (!stroke?.points?.length) return;
  const { ratio, width, height } = sizeCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawStroke(ctx, stroke, width, height);
}

function clearCanvas(canvas) {
  const { ratio, width, height } = sizeCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE RAIL (thumbnails)
═══════════════════════════════════════════════════════════════════════ */
function highlightThumbs() {
  pageThumbs.querySelectorAll('.page-thumb').forEach((b) =>
    b.classList.toggle('current', b.dataset.page === state.pageId));
}

function renderThumbs() {
  const book = notebook();
  if (!book) return;
  pageThumbs.innerHTML = '';
  book.pages.forEach((page, i) => {
    const btn = document.createElement('button');
    btn.className = `page-thumb${page.id === state.pageId ? ' current' : ''}`;
    btn.dataset.page = page.id;
    btn.innerHTML = `<canvas></canvas><span>${i + 1}</span>`;
    btn.addEventListener('click', () => goToPage(page.id));

    const del = document.createElement('button');
    del.className = 'thumb-delete';
    del.title = 'Delete page';
    del.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
    del.addEventListener('click', (e) => { e.stopPropagation(); deletePage(page.id); });
    btn.appendChild(del);

    pageThumbs.appendChild(btn);
    paintCanvas(btn.querySelector('canvas'), page, true);
  });
}

function syncCurrentPageFromScroll() {
  const sheets = [...pagesScroller.querySelectorAll('.page-sheet')];
  if (!sheets.length) return;
  const mid = pagesScroller.scrollTop + pagesScroller.clientHeight / 2;
  let closest = sheets[0], best = Infinity;
  for (const s of sheets) {
    const d = Math.abs(s.offsetTop + s.offsetHeight / 2 - mid);
    if (d < best) { best = d; closest = s; }
  }
  if (closest.dataset.page !== state.pageId) {
    state.pageId = closest.dataset.page;
    highlightThumbs();
    updateIndicator();
  }
}

function goToPage(pageId, smooth = true) {
  state.pageId = pageId;
  pagesScroller.querySelector(`[data-page="${pageId}"]`)
    ?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  highlightThumbs();
  updateIndicator();
}

function deletePage(pageId) {
  const book = notebook();
  if (book.pages.length === 1) { showToast('A notebook must have at least one page.'); return; }
  book.pages = book.pages.filter((p) => p.id !== pageId);
  if (state.pageId === pageId) state.pageId = book.pages[0].id;
  persist(true);
  renderNotebook();
  showToast('Page deleted.');
}

/* ═══════════════════════════════════════════════════════════════════════
   CANVAS BINDING (two-layer: bg = committed, fg = live stroke)
═══════════════════════════════════════════════════════════════════════ */
function bindPageCanvas(bg, fg, page) {
  let erasing = false;
  const MIN_DIST = () => 1.5 / fg.clientWidth;

  fg.addEventListener('pointerdown', (e) => {
    if (state.tool === 'eraser') {
      fg.setPointerCapture(e.pointerId);
      erasing = true;
      if (eraseAtPixel(page, relativePoint(e, fg), fg)) { paintCanvas(bg, page); persist(); }
      return;
    }
    fg.setPointerCapture(e.pointerId);
    state.currentStroke = { id: uid('stroke'), tool: state.tool, color: state.color, size: Number(state.size), points: [relativePoint(e, fg)] };
    page.strokes.push(state.currentStroke);
    state.undo.push({ type: 'stroke', pageId: page.id, strokeId: state.currentStroke.id });
    state.redo = [];
    paintActiveStroke(fg, state.currentStroke);
  });

  fg.addEventListener('pointermove', (e) => {
    if (erasing) {
      let changed = false;
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        if (eraseAtPixel(page, relativePoint(ev, fg), fg)) changed = true;
      }
      if (changed) { paintCanvas(bg, page); persist(); }
      return;
    }
    if (!state.currentStroke || state.currentStroke !== page.strokes.at(-1)) return;

    if (SHAPE_TOOLS.has(state.tool)) {
      state.currentStroke.points = [state.currentStroke.points[0], relativePoint(e, fg)];
    } else {
      const md = MIN_DIST();
      for (const ev of e.getCoalescedEvents?.() ?? [e]) {
        const pt   = relativePoint(ev, fg);
        const prev = state.currentStroke.points.at(-1);
        if (Math.hypot(pt.x - prev.x, pt.y - prev.y) >= md) state.currentStroke.points.push(pt);
      }
    }
    paintActiveStroke(fg, state.currentStroke);
  });

  fg.addEventListener('pointerup', () => {
    if (erasing) { erasing = false; renderThumbs(); return; }
    if (state.currentStroke) { paintCanvas(bg, page); clearCanvas(fg); persist(); }
    state.currentStroke = null;
    renderThumbs();
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLBAR STATE
═══════════════════════════════════════════════════════════════════════ */
function updateToolbar() {
  document.querySelectorAll('.tool-btn[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === state.tool));
  document.querySelectorAll('.tool-btn.size-preset').forEach((b) => b.classList.toggle('active', Number(b.dataset.size) === Number(state.size)));
  const slider = $('strokeSize');
  if (slider) slider.value = state.size;
  $('colorSwatch').style.cssText = `background:${state.color};--current-color:${state.color}`;
  $('shapesBtn').classList.toggle('active', SHAPE_TOOLS.has(state.tool));
  // Sync paper popover
  const page = currentPage();
  $('paperPopover').querySelectorAll('.paper-btn').forEach((b) => b.classList.toggle('active', b.dataset.paper === (page?.paper || 'lined')));
  syncPageBgUI(page?.bgColor || '#ffffff');
}

/* ═══════════════════════════════════════════════════════════════════════
   NOTEBOOK RENDER
═══════════════════════════════════════════════════════════════════════ */
function renderPages() {
  const book = notebook();
  pagesScroller.innerHTML = '';

  for (const page of book.pages) {
    const sheet = document.createElement('article');
    sheet.className = `page-sheet ${page.paper || 'lined'}`;
    sheet.dataset.page = page.id;
    if (page.bgColor) sheet.style.backgroundColor = page.bgColor;

    const bg  = document.createElement('canvas'); bg.className  = 'bg-canvas';
    const fg  = document.createElement('canvas'); fg.className  = 'fg-canvas';
    const txt = document.createElement('div');    txt.className = 'text-layer';

    sheet.append(bg, fg, txt);
    pagesScroller.appendChild(sheet);

    requestAnimationFrame(() => { sizeCanvas(bg); sizeCanvas(fg); paintCanvas(bg, page); renderTexts(txt, page); });
    bindPageCanvas(bg, fg, page);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'add-page-float';
  addBtn.title     = 'Add new page';
  addBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  addBtn.addEventListener('click', addPage);
  pagesScroller.appendChild(addBtn);

  applyZoomToSheets();
  updateToolbar();
}

function renderTexts(layer, page) {
  layer.innerHTML = '';
  for (const item of (page.texts || [])) {
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
  }
}

function renderNotebook() {
  const book = notebook();
  if (!book) return;
  if (!state.pageId) state.pageId = book.pages[0].id;
  renderPages();
  renderThumbs();
  updateIndicator();
  requestAnimationFrame(() => goToPage(state.pageId, false));
}

/* ═══════════════════════════════════════════════════════════════════════
   UNDO / REDO
═══════════════════════════════════════════════════════════════════════ */
function undo() {
  const action = state.undo.pop();
  if (!action) return;
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
  const action = state.redo.pop();
  if (!action) return;
  const page = notebook().pages.find((p) => p.id === action.pageId);
  if (!page) return;
  if (action.type === 'stroke' && action.stroke) {
    page.strokes.push(action.stroke);
    state.undo.push({ type: 'stroke', pageId: page.id, strokeId: action.stroke.id });
  }
  persist(); renderNotebook();
}

function addPage() {
  const book = notebook();
  const page = blankPage(book.pages.length + 1);
  book.pages.push(page);
  persist(); renderNotebook();
  requestAnimationFrame(() => goToPage(page.id));
}

/* ═══════════════════════════════════════════════════════════════════════
   LIBRARY
═══════════════════════════════════════════════════════════════════════ */
function paintPreview(canvas, item) {
  const w = 236, h = 124, dpr = window.devicePixelRatio || 1;
  canvas.width  = w * dpr; canvas.height = h * dpr;
  canvas.style.cssText = `width:${w}px;height:${h}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#faf9f8'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#efece8'; ctx.lineWidth = 1;
  for (let y = 18; y < h; y += 14) { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(w-12, y); ctx.stroke(); }
  const page = item.pages[0];
  if (page) {
    for (const s of (page.strokes || [])) drawStroke(ctx, s, w, h);
    ctx.fillStyle = '#323130'; ctx.font = '12px Segoe UI,system-ui,sans-serif';
    (page.texts || []).slice(0, 3).forEach((t, i) => { if (t.value) ctx.fillText(t.value.slice(0, 28), 16, 36 + i*18); });
  }
}

function renderLibrary() {
  const query = ($('searchNotebooks').value || '').trim().toLowerCase();
  const books = state.data.notebooks
    .slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter((n) => n.name.toLowerCase().includes(query));

  notebookGrid.innerHTML = '';
  const create = document.createElement('button');
  create.className = 'create-card';
  create.innerHTML = `<div class="create-plus">+</div><span>New notebook</span>`;
  create.addEventListener('click', () => openModal({ mode: 'create' }));
  notebookGrid.appendChild(create);

  for (const item of books) {
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
  }

  notebookGrid.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openNotebook(b.dataset.open)));
  notebookGrid.querySelectorAll('[data-menu]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); showNotebookMenu(b.dataset.menu, e.clientX, e.clientY);
  }));
}

function showNotebookMenu(id, x, y) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.cssText = `left:${x}px;top:${y}px`;
  menu.innerHTML = `<button data-action="open">Open</button><button data-action="rename">Rename</button><button data-action="delete" class="danger">Delete</button>`;
  document.body.appendChild(menu);
  menu.addEventListener('click', (e) => {
    const { action } = e.target.dataset; closeMenu();
    if (action === 'open')   openNotebook(id);
    if (action === 'rename') openModal({ mode: 'rename', notebook: state.data.notebooks.find((n) => n.id === id) });
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
  await new Promise((r) => setTimeout(r, 280));
  setView('notebook');
  renderNotebook();
  hideLoading();
  setZoom(ZOOM_DEFAULT);
}

function deleteNotebook(id) {
  if (state.data.notebooks.length === 1) { showToast('Keep at least one notebook.'); return; }
  state.data.notebooks = state.data.notebooks.filter((n) => n.id !== id);
  persist(true); renderLibrary(); showToast('Notebook deleted.');
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL (create / rename notebook)
═══════════════════════════════════════════════════════════════════════ */
function openModal({ mode, notebook: item }) {
  state.modal = { mode, notebook: item };
  $('modalTitle').textContent = mode === 'create' ? 'New notebook' : 'Rename notebook';
  $('modalName').value = item?.name || 'Untitled notebook';
  $('colorPicker').innerHTML = COVER_COLORS.map((c) =>
    `<button type="button" class="color-dot${c === (item?.color || COVER_COLORS[0]) ? ' selected' : ''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
  $('colorPicker').dataset.color = item?.color || COVER_COLORS[0];
  $('modalOverlay').classList.remove('hidden');
  $('modalName').focus(); $('modalName').select();
}

/* ═══════════════════════════════════════════════════════════════════════
   PDF EXPORT
═══════════════════════════════════════════════════════════════════════ */
async function exportPdf() {
  persist(true);
  showToast('Preparing PDF…');
  const book = notebook();
  const pageImages = book.pages.map((page) => {
    const cvs = document.createElement('canvas');
    cvs.width = PAGE_W; cvs.height = PAGE_H;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = page.bgColor || '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    for (const stroke of (page.strokes || [])) drawStroke(ctx, stroke, PAGE_W, PAGE_H);
    return cvs.toDataURL('image/png');
  });
  const result = await window.mynotes.exportPdf(book, pageImages);
  if (!result.canceled) showToast('Notebook exported as PDF.');
}

/* ═══════════════════════════════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════════════════════════════ */

// Window controls
$('wcMinimize').addEventListener('click', () => window.mynotes.minimize());
$('wcMaximize').addEventListener('click', () => window.mynotes.maximize());
$('wcClose').addEventListener('click',    () => window.mynotes.close());

// Theme
$('themeToggleBtn').addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

// Sidebar
$('sidebarToggleBtn').addEventListener('click', () => setSidebar(!state.sidebarOpen));

// Popovers
$('shapesBtn').addEventListener('click', (e) => { e.stopPropagation(); togglePopover('shapesPopover', 'shapesBtn'); });
$('paperBtn').addEventListener('click',  (e) => { e.stopPropagation(); togglePopover('paperPopover',  'paperBtn'); });
$('colorBtn').addEventListener('click',  (e) => { e.stopPropagation(); togglePopover('colorPopover',  'colorBtn'); });
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tool-group, .tool-popover')) closeAllPopovers();
  if (!e.target.closest('.context-menu, [data-menu]'))  closeMenu();
});

// Shapes popover — select shape tool + mirror icon
$('shapesPopover').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]');
  if (!btn) return;
  state.tool = btn.dataset.tool;
  const svg = btn.querySelector('svg');
  $('shapeIcon').innerHTML = svg.innerHTML;
  $('shapeIcon').setAttribute('viewBox', svg.getAttribute('viewBox'));
  $('shapesPopover').querySelectorAll('.pop-btn').forEach((b) => b.classList.toggle('active', b === btn));
  $('shapesBtn').classList.add('active');
  closeAllPopovers(); updateToolbar();
});

// Paper style popover
$('paperPopover').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-paper]');
  if (!btn) return;
  const page = currentPage();
  if (page) { page.paper = btn.dataset.paper; persist(); renderNotebook(); }
  $('paperPopover').querySelectorAll('.paper-btn').forEach((b) => b.classList.toggle('active', b === btn));
  closeAllPopovers();
});

// Page background color — swatches (delegated)
$('pageBgSwatches').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bg]');
  if (btn) { e.stopPropagation(); setPageBgColor(btn.dataset.bg); }
});
$('pageBgHex').addEventListener('input', (e) => {
  const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
  e.target.value = val;
  $('pageBgPreview').style.background = val.length === 6 ? '#' + val : 'transparent';
  if (val.length === 6) setPageBgColor('#' + val);
});
$('pageBgHex').addEventListener('keydown', (e) => e.stopPropagation());

// Color picker — palette (delegated)
$('cpPalette').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-color]');
  if (btn) { e.stopPropagation(); setColor(btn.dataset.color); closeAllPopovers(); }
});
$('cpHexInput').addEventListener('input', (e) => {
  const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
  e.target.value = val;
  $('cpHexPreview').style.background = val.length === 6 ? '#' + val : 'transparent';
  if (val.length === 6) setColor('#' + val);
});
$('cpHexInput').addEventListener('keydown', (e) => e.stopPropagation());

// Zoom
$('zoomInBtn').addEventListener('click',  () => zoomStep(1));
$('zoomOutBtn').addEventListener('click', () => zoomStep(-1));
$('zoomFitBtn').addEventListener('click', () => {
  const pct = $('zoomPct');
  if (Math.abs(state.zoom - 1.0) < 0.01)                                        { zoomFitWidth();       pct.dataset.mode = 'width';  }
  else if (pct.dataset.mode === 'width')                                          { zoomFitHeight();      pct.dataset.mode = 'height'; }
  else                                                                             { setZoom(ZOOM_DEFAULT); pct.dataset.mode = '';      }
});
pagesScroller.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoomStep(e.deltaY < 0 ? 1 : -1); }, { passive: false });

// Modal
$('colorPicker').addEventListener('click', (e) => {
  const color = e.target.dataset.color; if (!color) return;
  $('colorPicker').dataset.color = color;
  $('colorPicker').querySelectorAll('.color-dot').forEach((d) => d.classList.toggle('selected', d.dataset.color === color));
});
$('modalForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('modalName').value.trim(), color = $('colorPicker').dataset.color;
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

// Navigation / editor actions
$('searchNotebooks').addEventListener('input', renderLibrary);
$('allNotebooksLink').addEventListener('click', () => { $('searchNotebooks').value = ''; renderLibrary(); });
$('backToLibrary').addEventListener('click', () => { persist(true); setView('library'); renderLibrary(); });
$('notebookTitleBtn').addEventListener('click', () => openModal({ mode: 'rename', notebook: notebook() }));
$('addPageRailBtn').addEventListener('click', addPage);
$('prevPageBtn').addEventListener('click', () => { const idx = pageIndex(); if (idx > 0)                           goToPage(notebook().pages[idx - 1].id); });
$('nextPageBtn').addEventListener('click', () => { const idx = pageIndex(); if (idx < notebook().pages.length - 1) goToPage(notebook().pages[idx + 1].id); });
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('clearPageBtn').addEventListener('click', () => { const p = currentPage(); if (p) { p.strokes = []; p.texts = []; persist(); renderNotebook(); } });
$('exportPdfBtn').addEventListener('click', exportPdf);

// Toolbar — tool + size selection
$('toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tool]:not(.pop-btn), [data-size]');
  if (!btn) return;
  if (btn.dataset.tool && !SHAPE_TOOLS.has(btn.dataset.tool)) { state.tool = btn.dataset.tool; $('shapesBtn').classList.remove('active'); }
  if (btn.dataset.size !== undefined) { state.size = Number(btn.dataset.size); $('strokeSize').value = state.size; }
  updateToolbar();
});
$('strokeSize').addEventListener('input', (e) => {
  state.size = Number(e.target.value);
  document.querySelectorAll('.tool-btn.size-preset').forEach((b) => b.classList.remove('active'));
});

// Scroll sync
pagesScroller.addEventListener('scroll', () => {
  clearTimeout(pagesScroller._t);
  pagesScroller._t = setTimeout(syncCurrentPageFromScroll, 80);
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const editing = ['input','textarea'].includes(document.activeElement?.tagName?.toLowerCase()) || document.activeElement?.isContentEditable;
  if (e.key === 'Escape') {
    closeAllPopovers(); closeMenu(); closeModal();
    if (state.view === 'notebook' && !document.activeElement?.classList.contains('text-box')) {
      persist(true); setView('library'); renderLibrary();
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); zoomStep(1); }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomStep(-1); }
  if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(ZOOM_DEFAULT); }
  if (state.view === 'notebook' && !editing && !e.ctrlKey && !e.metaKey) {
    const map = { p:'pen', e:'eraser', l:'line', r:'rect', o:'circle' };
    if (map[e.key.toLowerCase()]) { state.tool = map[e.key.toLowerCase()]; updateToolbar(); }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') $('nextPageBtn').click();
    if (e.key === 'ArrowUp'   || e.key === 'PageUp')   $('prevPageBtn').click();
    if (e.key === '\\') setSidebar(!state.sidebarOpen);
  }
});

window.addEventListener('resize',      () => { if (state.view === 'notebook') renderNotebook(); });
window.addEventListener('beforeunload', () => { clearTimeout(state.saveTimer); window.mynotes.save(state.data); });

/* ═══════════════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════════════ */
async function boot() {
  applyTheme(state.theme);
  buildColorPalette();
  buildPageBgSwatches();
  setColor(state.color);
  state.data = await window.mynotes.load();
  if (!state.data.notebooks?.length) state.data.notebooks = [blankNotebook('My first notebook', COVER_COLORS[0])];
  setView('library');
  renderLibrary();
}

boot();
