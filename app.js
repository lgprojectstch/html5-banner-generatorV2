// HTML5 Banner Generator - Main Application
// ==========================================

const GATE_PASSWORD = 'html5';
const ASSETS_DIR = 'assets';
const LOGO_ASSET_WHITE = ASSETS_DIR + '/LogoW.png';
const LOGO_ASSET_BLACK = ASSETS_DIR + '/LogoS.png';
function getLogoAsset() {
  return appData.logoVariant === 'black' ? LOGO_ASSET_BLACK : LOGO_ASSET_WHITE;
}
const FONT_FILES = [
  ASSETS_DIR + '/fonts/InterstateWGL-Bold.woff2',
  ASSETS_DIR + '/fonts/InterstateWGL-Regular.woff2'
];

const IMAGE_IMPORT = { maxLongEdge: 1200, quality: 0.82, background: '#ffffff' };
const TEXT_LIMITS = { headline: 25, subline: 30, ctaText: 17 };
const IMPR_TAG = '<img src="https://tagm.tchibo.de/ai.aspx?extProvId=300&extProvApi=129768..." style="display:none">';

// State
let selectedFormats = [];
let uploadedImages = [];
let cropSettings = {};
let previewHtmlUrls = [];

let appData = {
  headline: 'Bereit für dein Workout?',
  subline: 'Indoor & Outdoor',
  ctaText: 'Jetzt shoppen',
  landingUrl: '',
  zipName: '',
  template: 'standard',
  logoVariant: 'white',
  colors: { bg: '#63aeab', text: '#ffffff', ctaBg: '#ffffff', ctaText: '#63aeab' }
};

const TEMPLATE_PRESETS = {
  standard: { bg: '#63aeab', text: '#ffffff', ctaBg: '#ffffff', ctaText: '#63aeab' },
  sale:     { bg: '#be2d2f', text: '#ffffff', ctaBg: '#ffffff', ctaText: '#be2d2f' },
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

  // Template tabs
  document.querySelectorAll('.tmpl-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tmpl-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appData.template = btn.dataset.tmpl;
      if (appData.template !== 'custom') {
        appData.colors = { ...TEMPLATE_PRESETS[appData.template] };
      }
      $('customColors').style.display = appData.template === 'custom' ? 'block' : 'none';
      renderTemplateColorPreview();
    });
  });

  // Custom color inputs
  ['Bg', 'Text', 'CtaBg', 'CtaText'].forEach(key => {
    const inputId = 'color' + key;
    const hexId   = 'color' + key + 'Hex';
    const dataKey = key.charAt(0).toLowerCase() + key.slice(1);
    $(inputId).addEventListener('input', e => {
      appData.colors[dataKey] = e.target.value;
      $(hexId).textContent = e.target.value;
      renderTemplateColorPreview();
    });
  });

  renderTemplateColorPreview();

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
  const cropContainer = $('cropStage');
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

// ── Template color helpers ─────────────────────────────────────────────────

function renderTemplateColorPreview() {
  const c = appData.colors;
  const labels = [
    { key: c.bg,      label: 'Hintergrund' },
    { key: c.text,    label: 'Text' },
    { key: c.ctaBg,   label: 'CTA Button' },
    { key: c.ctaText, label: 'CTA Text' },
  ];
  const wrap = $('templateColorsPreview');
  if (!wrap) return;
  wrap.innerHTML = labels.map(s =>
    `<span class="color-swatch"><span class="color-swatch-dot" style="background:${s.key}"></span>${s.label}</span>`
  ).join('');
}

function getColors() {
  return appData.colors;
}

// Logo Variant
function setLogoVariant(variant) {
  appData.logoVariant = variant;
  // Reset cache so next preview loads the correct logo
  cachedLogoDataUrl = null;
  cachedLogoVariant = null;
  // Update button states
  const btnWhite = document.getElementById('logoBtnWhite');
  const btnBlack = document.getElementById('logoBtnBlack');
  if (btnWhite && btnBlack) {
    btnWhite.className = 'logo-btn' + (variant === 'white' ? ' active-white' : '');
    btnBlack.className = 'logo-btn' + (variant === 'black' ? ' active-black' : '');
  }
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
let cachedLogoDataUrl = null;
let cachedLogoVariant = null;
async function getLogoDataUrl() {
  const currentVariant = appData.logoVariant;
  if (cachedLogoDataUrl && cachedLogoVariant === currentVariant) return cachedLogoDataUrl;
  try {
    const res = await fetch(getLogoAsset());
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoVariant = currentVariant;
    return cachedLogoDataUrl;
  } catch (e) {
    return null;
  }
}

// Hilfsfunktion: Blob -> Data URL
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // FIX: Bilder als Data URLs konvertieren, damit sie im blob:-iframe geladen werden können
  const images = await Promise.all(
    uploadedImages.map(async img => ({ src: await blobToDataUrl(img.blob) }))
  );
  
  for (const format of selectedFormats) {
    const cfg = FORMAT_CONFIGS[format];
    
    const html = generateFormatHTML(format, {
      mode: 'preview',
      images,
      headline: appData.headline,
      subline: appData.subline,
      ctaText: appData.ctaText,
      clickTag: getFinalClickTag(),
      logoSrc: logoSrc || 'Logo.png',
      cropSettings,
      colors: getColors()
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
    
    // Scale banner so its longest dimension fits within MAX_PREVIEW_SIZE
    const MAX_PREVIEW_SIZE = 300;
    const scaleF = Math.min(1, MAX_PREVIEW_SIZE / Math.max(cfg.w, cfg.h));
    const scaledW = Math.round(cfg.w * scaleF);
    const scaledH = Math.round(cfg.h * scaleF);

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'preview-scroll-wrap';
    
    const viewport = document.createElement('div');
    viewport.className = 'iframe-viewport';
    viewport.style.width  = scaledW + 'px';
    viewport.style.height = scaledH + 'px';
    
    const iframe = document.createElement('iframe');
    iframe.width  = cfg.w;
    iframe.height = cfg.h;
    iframe.style.width  = cfg.w + 'px';
    iframe.style.height = cfg.h + 'px';
    iframe.style.transform = `scale(${scaleF})`;
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
// CROP MODAL - Framing Tool
// ==========================================

// Helper: compute the actual image region dimensions for a format
function getImageRegion(cfg) {
  let imgW, imgH;
  if (cfg.layout === 'h') {
    imgW = cfg.w * (1 - cfg.leftRatio);
    imgH = cfg.h;
  } else {
    imgW = cfg.w;
    imgH = cfg.h * (1 - cfg.topRatio);
  }
  if (cfg.dual) imgW = imgW / 2;
  return { imgW, imgH };
}

// ── Internal framing state ────────────────────────────────────────────────
let imgOffsetX = 0;  // top-left of the rendered image within the stage (editor px)
let imgOffsetY = 0;
let imgRenderW = 0;  // rendered image size in editor (cover + padding)
let imgRenderH = 0;
let frameX = 0, frameY = 0, frameW = 0, frameH = 0;  // frame rect in stage (editor px)

// Real banner pixel space — used only for % math
let realRegionW = 0;  // actual banner image-region width  (e.g. 132 for 300x250)
let realRegionH = 0;  // actual banner image-region height
let realNatW    = 0;  // natural image width
let realNatH    = 0;  // natural image height

let dragImgStartX = 0, dragImgStartY = 0;

const STAGE_H        = 320;
const CONTEXT_PAD_PX = 60;  // extra image visible outside the frame on each side (editor px)

// ── Real-space helpers ─────────────────────────────────────────────────────

// CSS object-fit:cover scale in real banner pixels
function realCoverScale() {
  return Math.max(realRegionW / realNatW, realRegionH / realNatH);
}

// CSS overflow in real banner pixels
function realOverflow() {
  const cs = realCoverScale();
  return {
    overW: realNatW * cs - realRegionW,
    overH: realNatH * cs - realRegionH
  };
}

// Editor pixels per real banner pixel
function editorScale() {
  return frameW / realRegionW;  // = frameH / realRegionH (same ratio)
}

// ── Coordinate conversions ─────────────────────────────────────────────────

// Editor pixel offset  →  object-position %
// imgOffsetX/Y is the translate() position of the image's top-left corner in the stage.
// At 0%: image left edge aligns with frame left edge  → offX = frameX
// At 100%: image is shifted left by (coverW - frameW) → offX = frameX - overW*es
// General: shiftX = frameX - offX  (how far the image left edge is to the right of frame left)
function offsetToObjectPos(offX, offY) {
  const { overW, overH } = realOverflow();
  const es = editorScale();

  const pctX = overW > 0.5 ? Math.max(0, Math.min(100, ((frameX - offX) / (overW * es)) * 100)) : 50;
  const pctY = overH > 0.5 ? Math.max(0, Math.min(100, ((frameY - offY) / (overH * es)) * 100)) : 50;
  return { pctX, pctY };
}

// object-position %  →  editor pixel offset
// offX = frameX - (pctX/100) * overW * es
// At 50%: offX = frameX - 0.5 * overW * es  (image centred over frame, matching CSS 50% 50%)
function objectPosToOffset(pctX, pctY) {
  const { overW, overH } = realOverflow();
  const es = editorScale();

  return {
    offX: frameX - (pctX / 100) * overW * es,
    offY: frameY - (pctY / 100) * overH * es,
  };
}

// Clamp so the cover portion always fully covers the frame.
// offX is the image top-left in stage coords.
// Cover must not expose gap at any edge of the frame:
//   left:  offX <= frameX           (image left edge at or left of frame left)
//   right: offX >= frameX - (coverW - frameW)  (image right edge at or right of frame right)
function clampOffset(offX, offY) {
  const cs = realCoverScale();
  const es = editorScale();
  const coverEditorW = Math.round(realNatW * cs * es);
  const coverEditorH = Math.round(realNatH * cs * es);

  const minX = frameX - (coverEditorW - frameW);
  const minY = frameY - (coverEditorH - frameH);

  return {
    offX: Math.min(frameX, Math.max(minX, offX)),
    offY: Math.min(frameY, Math.max(minY, offY)),
  };
}

// ── Layout ─────────────────────────────────────────────────────────────────

function layoutStage(cfg) {
  const stage  = $('cropStage');
  const stageW = stage.offsetWidth;
  const { imgW: regionW, imgH: regionH } = getImageRegion(cfg);

  realRegionW = regionW;
  realRegionH = regionH;

  // Scale frame to fit inside stage, leaving room for context padding + label
  const maxFW = stageW  - CONTEXT_PAD_PX * 2;
  const maxFH = STAGE_H - CONTEXT_PAD_PX * 2 - 24;  // 24 for label
  const scale = Math.min(maxFW / regionW, maxFH / regionH);
  frameW = Math.round(regionW * scale);
  frameH = Math.round(regionH * scale);

  // Center the frame in the stage
  frameX = Math.round((stageW  - frameW) / 2);
  frameY = Math.round((STAGE_H - frameH) / 2) + 12;  // +12 shifts down slightly for label

  const frame = $('cropFrame');
  frame.style.left   = frameX + 'px';
  frame.style.top    = frameY + 'px';
  frame.style.width  = frameW + 'px';
  frame.style.height = frameH + 'px';

  $('cropFrameLabel').textContent = `${Math.round(regionW)} x ${Math.round(regionH)} px`;

  $('cropOvTop').style.cssText    = `left:0;top:0;width:100%;height:${frameY}px;`;
  $('cropOvBottom').style.cssText = `left:0;top:${frameY+frameH}px;width:100%;height:${STAGE_H-frameY-frameH}px;`;
  $('cropOvLeft').style.cssText   = `left:0;top:${frameY}px;width:${frameX}px;height:${frameH}px;`;
  $('cropOvRight').style.cssText  = `left:${frameX+frameW}px;top:${frameY}px;width:${stageW-frameX-frameW}px;height:${frameH}px;`;
}

function layoutImage(naturalW, naturalH) {
  realNatW = naturalW;
  realNatH = naturalH;

  const cs = realCoverScale();  // real banner cover scale
  const es = editorScale();     // editor px per banner px

  // Image is rendered exactly at cover size — 1:1 correspondence with banner pixels.
  // CONTEXT_PAD_PX is purely positional: the image is translated so that up to
  // CONTEXT_PAD_PX pixels of it are visible outside the frame, giving drag context.
  imgRenderW = Math.round(naturalW * cs * es);
  imgRenderH = Math.round(naturalH * cs * es);

  const img = $('cropEditorImage');
  img.style.width  = imgRenderW + 'px';
  img.style.height = imgRenderH + 'px';
}

// Apply the current imgOffsetX/Y to the image element and update overlays + indicator
function applyImagePosition() {
  const clamped = clampOffset(imgOffsetX, imgOffsetY);
  imgOffsetX = clamped.offX;
  imgOffsetY = clamped.offY;

  $('cropEditorImage').style.transform = `translate(${imgOffsetX}px, ${imgOffsetY}px)`;

  const { pctX, pctY } = offsetToObjectPos(imgOffsetX, imgOffsetY);
  currentPosX = pctX;
  currentPosY = pctY;
  $('cropPosIndicator').textContent = `${Math.round(pctX)}% / ${Math.round(pctY)}%`;
}

// Initialize stage for a freshly selected image + format
async function initStageForImage(idx) {
  const cfg = FORMAT_CONFIGS[currentCropFormat];
  const stage = $('cropStage');

  layoutStage(cfg);

  // Load image to get natural dimensions
  const url = uploadedImages[idx].url;
  await new Promise(resolve => {
    const tmp = new Image();
    tmp.onload = () => {
      layoutImage(tmp.naturalWidth, tmp.naturalHeight);
      resolve();
    };
    tmp.src = url;
  });

  $('cropEditorImage').src = url;

  // Restore saved position or default to center
  const saved = cropSettings[currentCropFormat]?.[idx];
  const px = saved ? saved.x : 50;
  const py = saved ? saved.y : 50;
  const { offX, offY } = objectPosToOffset(px, py);
  imgOffsetX = offX;
  imgOffsetY = offY;

  applyImagePosition();
}

function openCropModal(format) {
  currentCropFormat = format;
  currentCropImageIndex = null;

  const cfg = FORMAT_CONFIGS[format];
  $('cropFormatTitle').textContent = `${format} (${cfg.label})`;

  const { imgW, imgH } = getImageRegion(cfg);
  const dualHint = cfg.dual ? ' · je Spalte' : '';
  if ($('cropFormatBadge')) {
    $('cropFormatBadge').textContent = `Bildbereich ${Math.round(imgW)}×${Math.round(imgH)}px${dualHint}`;
  }

  // Setup preview iframe
  const maxW = 300, maxH = 350;
  const scale = Math.min(1, maxW / cfg.w, maxH / cfg.h);
  const iframe = $('cropPreviewIframe');
  iframe.width = cfg.w; iframe.height = cfg.h;
  iframe.style.width = cfg.w + 'px'; iframe.style.height = cfg.h + 'px';
  iframe.style.transform = `scale(${scale})`;
  $('cropPreviewFrame').style.width  = Math.ceil(cfg.w * scale) + 'px';
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

  // FIX: Bilder als Data URLs konvertieren, damit sie im blob:-iframe geladen werden können
  const images = await Promise.all(
    uploadedImages.map(async img => ({ src: await blobToDataUrl(img.blob) }))
  );
  
  const html = generateFormatHTML(currentCropFormat, {
    mode: 'preview',
    images,
    headline: appData.headline,
    subline: appData.subline,
    ctaText: appData.ctaText,
    clickTag: getFinalClickTag(),
    logoSrc: logoSrc || 'Logo.png',
    cropSettings,
    colors: getColors()
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

  $('cropImagesGrid').querySelectorAll('.crop-image-thumb').forEach((t, i) => {
    t.classList.toggle('active', i === idx);
  });

  $('cropEditorSection').style.display = 'block';
  $('cropEditorImageName').textContent = `Bild ${idx + 1}`;

  // Initialize framing stage (async: needs image naturalWidth/Height)
  initStageForImage(idx);
}

function updatePositionIndicator() {
  // kept for compatibility — actual update now in applyImagePosition()
}

// DRAG HANDLERS - Mouse
function startCropDrag(e) {
  if (currentCropImageIndex === null) return;
  e.preventDefault();
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragImgStartX = imgOffsetX;
  dragImgStartY = imgOffsetY;
  $('cropStage').style.cursor = 'grabbing';
}

function doCropDrag(e) {
  if (!isDragging) return;
  e.preventDefault();
  imgOffsetX = dragImgStartX + (e.clientX - dragStartX);
  imgOffsetY = dragImgStartY + (e.clientY - dragStartY);
  applyImagePosition();
}

function endCropDrag() {
  if (!isDragging) return;
  isDragging = false;
  $('cropStage').style.cursor = 'grab';
}

// DRAG HANDLERS - Touch
function startCropDragTouch(e) {
  if (currentCropImageIndex === null) return;
  if (e.touches.length !== 1) return;
  e.preventDefault();
  isDragging = true;
  dragStartX = e.touches[0].clientX;
  dragStartY = e.touches[0].clientY;
  dragImgStartX = imgOffsetX;
  dragImgStartY = imgOffsetY;
}

function doCropDragTouch(e) {
  if (!isDragging) return;
  if (e.touches.length !== 1) return;
  e.preventDefault();
  imgOffsetX = dragImgStartX + (e.touches[0].clientX - dragStartX);
  imgOffsetY = dragImgStartY + (e.touches[0].clientY - dragStartY);
  applyImagePosition();
}

function resetCrop() {
  if (cropSettings[currentCropFormat]) {
    delete cropSettings[currentCropFormat][currentCropImageIndex];
  }
  // Re-init stage at 50/50
  if (currentCropImageIndex !== null) {
    initStageForImage(currentCropImageIndex);
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
    
    // Generate HTML — Bilder als relative Pfade (1.jpg, 2.jpg, ...) für den Export
    const images = uploadedImages.map(img => ({ src: img.name }));
    const html = generateFormatHTML(format, {
      mode: 'export',
      images,
      headline: appData.headline,
      subline: appData.subline,
      ctaText: appData.ctaText,
      clickTag: getFinalClickTag(),
      logoSrc: 'Logo.png',
      cropSettings,
      colors: getColors()
    });
    
    zip.file('index.html', html);
    
    // Add images
    uploadedImages.forEach(img => zip.file(img.name, img.blob));
    
    // Add logo
    try {
      const logoRes = await fetch(getLogoAsset());
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
