// HTML5 Banner Generator - Main Application
// ==========================================

const GATE_PASSWORD = 'html5';
const ASSETS_DIR = 'assets';
const LOGO_ASSET = ASSETS_DIR + '/Logo.png';
const FONT_FILES = [
  ASSETS_DIR + '/fonts/InterstateWGL-Bold.woff2',
  ASSETS_DIR + '/fonts/InterstateWGL-Regular.woff2'
];

const IMAGE_IMPORT = { maxLongEdge: 1200, quality: 0.76, background: '#ffffff' };
const TEXT_LIMITS = { headline: 25, subline: 30, ctaText: 17 };
const IMPR_TAG = '<img src="https://tagm.tchibo.de/ai.aspx?extProvId=300&extProvApi=129768..." style="display:none">';

// State
let selectedFormats = [];
let uploadedImages = [];
let cropSettings = {};
let cachedLogoDataUrl = null;
let previewHtmlUrls = [];

let appData = {
  headline: 'Bereit für dein Workout?',
  subline: 'Indoor & Outdoor',
  ctaText: 'Jetzt shoppen',
  landingUrl: '',
  zipName: ''
};

// Crop state
let currentCropFormat = null;
let currentCropImageIndex = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartPosX = 50;
let dragStartPosY = 50;
let currentPosX = 50;
let currentPosY = 50;

// DOM Elements
const $ = id => document.getElementById(id);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Password gate
  $('pwInput').addEventListener('input', () => {
    $('pwError').style.display = 'none';
    $('pwInput').classList.remove('input-over');
  });
  $('pwSubmit').addEventListener('click', checkPassword);
  $('pwInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword(); });
  $('pwInput').focus();

  // Format grid
  renderFormatGrid();
  $('selectAllBtn').addEventListener('click', toggleSelectAll);
  $('nextStep1').addEventListener('click', () => { if (selectedFormats.length > 0) showStep(2); });
  $('backStep1').addEventListener('click', () => { $('previewSection').classList.remove('visible'); showStep(1); });

  // Text inputs
  bindCharLimit('headline', 'headlineHint', TEXT_LIMITS.headline, v => appData.headline = v);
  bindCharLimit('subline', 'sublineHint', TEXT_LIMITS.subline, v => appData.subline = v);
  bindCharLimit('ctaText', 'ctaHint', TEXT_LIMITS.ctaText, v => appData.ctaText = v);

  // URL inputs
  $('clickUrl').addEventListener('input', e => appData.landingUrl = e.target.value);
  $('zipName').addEventListener('input', e => appData.zipName = e.target.value);

  // Image upload
  setupImageUpload();

  // Preview
  $('createPreview').addEventListener('click', createPreview);
  $('togglePreviewBtn').addEventListener('click', () => {
    $('previewSection').classList.remove('visible');
    revokePreviewUrls();
  });

  // Export
  $('exportBanners').addEventListener('click', handleExport);
  $('exportModalClose').addEventListener('click', () => $('exportModal').classList.remove('open'));
  $('exportModalBackdrop').addEventListener('click', () => $('exportModal').classList.remove('open'));

  // Crop modal
  $('cropModalBackdrop').addEventListener('click', closeCropModal);
  $('cropModalClose').addEventListener('click', closeCropModal);
  $('cropResetBtn').addEventListener('click', resetCrop);
  $('cropSaveBtn').addEventListener('click', saveCrop);

  // Crop drag - IMPORTANT: bind to the container
  const cropContainer = $('cropCanvasContainer');
  cropContainer.addEventListener('mousedown', startCropDrag);
  document.addEventListener('mousemove', doCropDrag);
  document.addEventListener('mouseup', endCropDrag);
  
  // Touch support for mobile
  cropContainer.addEventListener('touchstart', startCropDragTouch, { passive: false });
  document.addEventListener('touchmove', doCropDragTouch, { passive: false });
  document.addEventListener('touchend', endCropDrag);

  // ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('cropModal').classList.contains('open')) closeCropModal();
      else if ($('exportModal').classList.contains('open')) $('exportModal').classList.remove('open');
    }
  });
}

// Password
function checkPassword() {
  if ($('pwInput').value.trim() === GATE_PASSWORD) {
    $('pwGate').style.display = 'none';
  } else {
    $('pwError').style.display = 'block';
    $('pwInput').classList.add('input-over');
    $('pwInput').focus();
  }
}

// Steps
function showStep(n) {
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
  $('step' + n)?.classList.add('active');
}

// Format Grid
function renderFormatGrid() {
  const grid = $('formatGrid');
  grid.innerHTML = '';
  FORMAT_ORDER.forEach(key => {
    const cfg = FORMAT_CONFIGS[key];
    const chip = document.createElement('label');
    chip.className = 'format-chip';
    chip.innerHTML = `
      <input type="checkbox" value="${key}">
      <div class="format-name">${key}</div>
      <div class="format-type">${cfg.label}</div>
      <span class="chip-check"><i class="fas fa-check"></i></span>
    `;
    grid.appendChild(chip);
    chip.querySelector('input').addEventListener('change', updateFormatSelection);
  });
}

function updateFormatSelection() {
  selectedFormats = [];
  $('formatGrid').querySelectorAll('input:checked').forEach(cb => selectedFormats.push(cb.value));
  $('nextStep1').disabled = selectedFormats.length === 0;
  
  const all = selectedFormats.length === FORMAT_ORDER.length;
  $('selectAllBtn').classList.toggle('active', all);
  $('selectAllBtn').innerHTML = all 
    ? '<i class="fas fa-times"></i> Auswahl aufheben' 
    : '<i class="fas fa-check-double"></i> Alle auswählen';
}

function toggleSelectAll() {
  const all = selectedFormats.length === FORMAT_ORDER.length;
  $('formatGrid').querySelectorAll('input').forEach(cb => cb.checked = !all);
  updateFormatSelection();
}

// Character limits
function bindCharLimit(inputId, hintId, max, onChange) {
  const input = $(inputId);
  const hint = $(hintId);
  
  function update() {
    const len = input.value.length;
    hint.textContent = `${len}/${max} Zeichen`;
    hint.classList.toggle('over', len > max);
    input.classList.toggle('input-over', len > max);
    if (onChange) onChange(input.value);
  }
  
  update();
  input.addEventListener('input', update);
}

// Image Upload
function setupImageUpload() {
  const area = $('uploadArea');
  const input = $('imageUpload');
  
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', async e => {
    e.preventDefault();
    area.classList.remove('dragover');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    await processImages(files);
  });
  
  input.addEventListener('change', async e => {
    await processImages([...e.target.files]);
    e.target.value = '';
  });
}

async function processImages(files) {
  for (const file of files) {
    try {
      const blob = await convertToJpeg(file);
      const url = URL.createObjectURL(blob);
      uploadedImages.push({
        name: (uploadedImages.length + 1) + '.jpg',
        blob,
        url,
        original: file.name
      });
    } catch (e) {
      console.error('Image processing failed:', e);
    }
  }
  renumberImages();
  renderImageList();
}

async function convertToJpeg(file) {
  const { maxLongEdge, quality, background } = IMAGE_IMPORT;
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(bitmap.width, bitmap.height) > maxLongEdge 
    ? maxLongEdge / Math.max(bitmap.width, bitmap.height) 
    : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function renumberImages() {
  uploadedImages.forEach((img, i) => img.name = (i + 1) + '.jpg');
}

let dragSrcIndex = null;

function renderImageList() {
  const container = $('uploadedImages');
  container.innerHTML = '';
  
  uploadedImages.forEach((img, i) => {
    const div = document.createElement('div');
    div.className = 'uploaded-image';
    div.draggable = true;
    div.dataset.index = i;
    div.innerHTML = `
      <img src="${img.url}" alt="${img.original}">
      <button class="remove" type="button"><i class="fas fa-times"></i></button>
      <span class="number">${i + 1}</span>
    `;
    
    div.querySelector('.remove').addEventListener('click', e => {
      e.stopPropagation();
      URL.revokeObjectURL(uploadedImages[i].url);
      uploadedImages.splice(i, 1);
      renumberImages();
      renderImageList();
    });
    
    // Drag & drop reorder
    div.addEventListener('dragstart', () => { dragSrcIndex = i; div.classList.add('dragging'); });
    div.addEventListener('dragend', () => { div.classList.remove('dragging'); dragSrcIndex = null; });
    div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('dragover'); });
    div.addEventListener('dragleave', () => div.classList.remove('dragover'));
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('dragover');
      if (dragSrcIndex !== null && dragSrcIndex !== i) {
        const item = uploadedImages.splice(dragSrcIndex, 1)[0];
        uploadedImages.splice(dragSrcIndex < i ? i - 1 : i, 0, item);
        renumberImages();
        renderImageList();
      }
    });
    
    container.appendChild(div);
  });
}

// Click URL
function getFinalClickTag() {
  let url = (appData.landingUrl || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'dbm');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'cpm');
    return 'https://tagm.tchibo.de/cl.aspx?extProvId=300&extProvApi=129768&extPu=tchibo-dv360&extLi=${INSERTION_ORDER_ID}&extPm=${CAMPAIGN_ID}&extCr=${CREATIVE_ID}&adslotid=${PUBLISHER_ID}&gdpr=${GDPR}&gdpr_consent=${GDPR_CONSENT_312}&url=' + encodeURIComponent(u.toString());
  } catch (e) {
    return '';
  }
}

// Logo
async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch(LOGO_ASSET);
    const blob = await res.blob();
    return cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

// Preview
function revokePreviewUrls() {
  previewHtmlUrls.forEach(u => URL.revokeObjectURL(u));
  previewHtmlUrls = [];
}

async function createPreview() {
  if (!getFinalClickTag()) return alert('Bitte gib eine gültige Ziel-URL ein!');
  if (!(appData.zipName || '').trim()) return alert('Bitte gib ein Naming ein!');
  if (selectedFormats.length === 0) return alert('Bitte wähle mindestens ein Format aus.');
  if (uploadedImages.length === 0) return alert('Bitte lade mindestens 1 Bild hoch.');
  
  revokePreviewUrls();
  const grid = $('previewGrid');
  grid.innerHTML = '';
  
  $('detailName').textContent = appData.zipName || '-';
  $('detailClickTag').textContent = getFinalClickTag() || '-';
  $('detailImprTag').textContent = IMPR_TAG;
  
  const logoSrc = await getLogoDataUrl();
  
  for (const format of selectedFormats) {
    const cfg = FORMAT_CONFIGS[format];
    const images = uploadedImages.map(img => ({ src: img.url }));
    
    const html = generateFormatHTML(format, {
      mode: 'preview',
      images,
      headline: appData.headline,
      subline: appData.subline,
      ctaText: appData.ctaText,
      clickTag: getFinalClickTag(),
      logoSrc: logoSrc || 'Logo.png',
      cropSettings
    });
    
    const item = document.createElement('div');
    item.className = 'preview-item';
    
    const header = document.createElement('div');
    header.className = 'preview-item-header';
    header.innerHTML = `
      <h4>${format} (${cfg.label})</h4>
      <button class="btn-crop" data-format="${format}"><i class="fas fa-crop-alt"></i> Anpassen</button>
    `;
    item.appendChild(header);
    
    header.querySelector('.btn-crop').addEventListener('click', () => openCropModal(format));
    
    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'preview-scroll-wrap';
    
    const viewport = document.createElement('div');
    viewport.className = 'iframe-viewport';
    viewport.style.width = cfg.w + 'px';
    viewport.style.height = cfg.h + 'px';
    
    const iframe = document.createElement('iframe');
    iframe.width = cfg.w;
    iframe.height = cfg.h;
    iframe.style.width = cfg.w + 'px';
    iframe.style.height = cfg.h + 'px';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    previewHtmlUrls.push(url);
    iframe.src = url;
    
    viewport.appendChild(iframe);
    scrollWrap.appendChild(viewport);
    item.appendChild(scrollWrap);
    grid.appendChild(item);
  }
  
  $('previewSection').classList.add('visible');
}

// ==========================================
// CROP MODAL - Fixed drag functionality
// ==========================================

function openCropModal(format) {
  currentCropFormat = format;
  currentCropImageIndex = null;
  
  const cfg = FORMAT_CONFIGS[format];
  $('cropFormatTitle').textContent = `${format} (${cfg.label})`;
  
  // Setup preview iframe size
  const maxW = 300, maxH = 350;
  const scale = Math.min(1, maxW / cfg.w, maxH / cfg.h);
  
  const iframe = $('cropPreviewIframe');
  iframe.width = cfg.w;
  iframe.height = cfg.h;
  iframe.style.width = cfg.w + 'px';
  iframe.style.height = cfg.h + 'px';
  iframe.style.transform = `scale(${scale})`;
  
  $('cropPreviewFrame').style.width = Math.ceil(cfg.w * scale) + 'px';
  $('cropPreviewFrame').style.height = Math.ceil(cfg.h * scale) + 'px';
  
  updateCropPreview();
  renderCropThumbnails();
  
  $('cropEditorSection').style.display = 'none';
  $('cropModal').classList.add('open');
}

function closeCropModal() {
  $('cropModal').classList.remove('open');
  currentCropFormat = null;
  currentCropImageIndex = null;
  isDragging = false;
}

async function updateCropPreview() {
  if (!currentCropFormat) return;
  
  const logoSrc = await getLogoDataUrl();
  const images = uploadedImages.map(img => ({ src: img.url }));
  
  const html = generateFormatHTML(currentCropFormat, {
    mode: 'preview',
    images,
    headline: appData.headline,
    subline: appData.subline,
    ctaText: appData.ctaText,
    clickTag: getFinalClickTag(),
    logoSrc: logoSrc || 'Logo.png',
    cropSettings
  });
  
  const blob = new Blob([html], { type: 'text/html' });
  $('cropPreviewIframe').src = URL.createObjectURL(blob);
}

function renderCropThumbnails() {
  const grid = $('cropImagesGrid');
  grid.innerHTML = '';
  
  uploadedImages.forEach((img, idx) => {
    const hasCrop = cropSettings[currentCropFormat]?.[idx];
    const thumb = document.createElement('div');
    thumb.className = 'crop-image-thumb' + (hasCrop ? ' has-crop' : '');
    thumb.innerHTML = `
      <img src="${img.url}" alt="Bild ${idx + 1}">
      <span class="thumb-num">${idx + 1}</span>
    `;
    thumb.addEventListener('click', () => selectCropImage(idx));
    grid.appendChild(thumb);
  });
}

function selectCropImage(idx) {
  currentCropImageIndex = idx;
  
  // Update active state on thumbnails
  $('cropImagesGrid').querySelectorAll('.crop-image-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });
  
  // Show editor
  $('cropEditorSection').style.display = 'block';
  $('cropEditorImageName').textContent = `Bild ${idx + 1}`;
  
  // Get current position
  const saved = cropSettings[currentCropFormat]?.[idx];
  currentPosX = saved ? saved.x : 50;
  currentPosY = saved ? saved.y : 50;
  
  // Set image
  const img = $('cropEditorImage');
  img.src = uploadedImages[idx].url;
  img.style.objectPosition = `${currentPosX}% ${currentPosY}%`;
  
  updatePositionIndicator();
}

function updatePositionIndicator() {
  $('cropPosIndicator').textContent = `${Math.round(currentPosX)}% / ${Math.round(currentPosY)}%`;
  $('cropEditorImage').style.objectPosition = `${currentPosX}% ${currentPosY}%`;
}

// DRAG HANDLERS - Mouse
function startCropDrag(e) {
  if (currentCropImageIndex === null) return;
  
  e.preventDefault();
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartPosX = currentPosX;
  dragStartPosY = currentPosY;
  
  $('cropCanvasContainer').style.cursor = 'grabbing';
}

function doCropDrag(e) {
  if (!isDragging) return;
  
  e.preventDefault();
  
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  
  // Sensitivity - how much the position changes per pixel dragged
  // Negative because dragging right should move the image left (show more of right side)
  const sensitivity = 0.3;
  
  currentPosX = Math.max(0, Math.min(100, dragStartPosX - dx * sensitivity));
  currentPosY = Math.max(0, Math.min(100, dragStartPosY - dy * sensitivity));
  
  updatePositionIndicator();
}

function endCropDrag() {
  if (!isDragging) return;
  
  isDragging = false;
  $('cropCanvasContainer').style.cursor = 'grab';
}

// DRAG HANDLERS - Touch
function startCropDragTouch(e) {
  if (currentCropImageIndex === null) return;
  if (e.touches.length !== 1) return;
  
  e.preventDefault();
  isDragging = true;
  dragStartX = e.touches[0].clientX;
  dragStartY = e.touches[0].clientY;
  dragStartPosX = currentPosX;
  dragStartPosY = currentPosY;
}

function doCropDragTouch(e) {
  if (!isDragging) return;
  if (e.touches.length !== 1) return;
  
  e.preventDefault();
  
  const dx = e.touches[0].clientX - dragStartX;
  const dy = e.touches[0].clientY - dragStartY;
  
  const sensitivity = 0.3;
  
  currentPosX = Math.max(0, Math.min(100, dragStartPosX - dx * sensitivity));
  currentPosY = Math.max(0, Math.min(100, dragStartPosY - dy * sensitivity));
  
  updatePositionIndicator();
}

function resetCrop() {
  currentPosX = 50;
  currentPosY = 50;
  updatePositionIndicator();
  
  // Remove from saved settings
  if (cropSettings[currentCropFormat]) {
    delete cropSettings[currentCropFormat][currentCropImageIndex];
  }
  
  renderCropThumbnails();
  if (currentCropImageIndex !== null) {
    $('cropImagesGrid').querySelectorAll('.crop-image-thumb')[currentCropImageIndex]?.classList.add('active');
  }
}

function saveCrop() {
  if (currentCropFormat === null || currentCropImageIndex === null) return;
  
  // Save position
  if (!cropSettings[currentCropFormat]) {
    cropSettings[currentCropFormat] = {};
  }
  cropSettings[currentCropFormat][currentCropImageIndex] = {
    x: currentPosX,
    y: currentPosY
  };
  
  // Update previews
  updateCropPreview();
  renderCropThumbnails();
  
  // Re-select the current image to show active state
  $('cropImagesGrid').querySelectorAll('.crop-image-thumb')[currentCropImageIndex]?.classList.add('active');
  
  // Refresh main preview if visible
  if ($('previewSection').classList.contains('visible')) {
    createPreview();
  }
}

// ==========================================
// EXPORT
// ==========================================

async function handleExport() {
  if (!getFinalClickTag()) return alert('Bitte gib eine gültige Ziel-URL ein!');
  if (!(appData.zipName || '').trim()) return alert('Bitte gib ein Naming ein!');
  if (selectedFormats.length === 0) return alert('Bitte wähle mindestens ein Format aus.');
  if (uploadedImages.length === 0) return alert('Bitte lade mindestens 1 Bild hoch.');
  
  const btn = $('exportBanners');
  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Export läuft... <i class="fas fa-spinner fa-spin"></i>';
  
  try {
    await exportAllBanners();
    $('exportModal').classList.add('open');
  } finally {
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}

async function exportAllBanners() {
  const baseName = (appData.zipName || 'banner').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_');
  
  for (const format of selectedFormats) {
    const zip = new JSZip();
    
    // Generate HTML
    const images = uploadedImages.map(img => ({ src: img.name }));
    const html = generateFormatHTML(format, {
      mode: 'export',
      images,
      headline: appData.headline,
      subline: appData.subline,
      ctaText: appData.ctaText,
      clickTag: getFinalClickTag(),
      logoSrc: 'Logo.png',
      cropSettings
    });
    
    zip.file('index.html', html);
    
    // Add images
    uploadedImages.forEach(img => zip.file(img.name, img.blob));
    
    // Add logo
    try {
      const logoRes = await fetch(LOGO_ASSET);
      const logoBlob = await logoRes.blob();
      zip.file('Logo.png', logoBlob);
    } catch (e) {
      console.warn('Logo not found');
    }
    
    // Add fonts
    for (const fontUrl of FONT_FILES) {
      try {
        const res = await fetch(fontUrl);
        const blob = await res.blob();
        zip.file('fonts/' + fontUrl.split('/').pop(), blob);
      } catch (e) {
        console.warn('Font not found:', fontUrl);
      }
    }
    
    // Generate and download
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${format}_${baseName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    
    // Small delay between downloads
    await new Promise(r => setTimeout(r, 300));
  }
}
