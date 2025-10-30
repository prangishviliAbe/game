// Simple in-game editor: select objects, edit transforms, save/load to localStorage
// NOTE: Instead of importing `main.js` directly (which can create module import timing
// issues in some browsers when the same file is also loaded via a <script> tag),
// the runtime exposes a global `window.__GAME` object from `main.js`. We read from that.

// Utility safe guard if something wasn't available
const safe = (v) => (typeof v !== 'undefined' ? v : null);

function game() {
  return (window && window.__GAME) ? window.__GAME : {};
}

const key = 'game-editor-scene-v1';

// Build editor UI
const panel = document.createElement('div');
panel.id = 'editor-panel';
panel.innerHTML = `
  <h3>Scene Editor</h3>
  <label>Category
    <select id="editor-category">
      <option value="trunks">Trunks</option>
      <option value="rocks">Rocks</option>
      <option value="houses">Houses</option>
      <option value="bushes">Bushes</option>
      <option value="fruits">Fruits</option>
    </select>
  </label>
  <label>Index / Item
    <input id="editor-index" type="number" min="0" value="0">
  </label>
  <label>Position X
    <input id="editor-posx" type="number" step="0.1">
  </label>
  <label>Position Y
    <input id="editor-posy" type="number" step="0.1">
  </label>
  <label>Position Z
    <input id="editor-posz" type="number" step="0.1">
  </label>
  <label>Rotation Y (deg)
    <input id="editor-roty" type="number" step="1">
  </label>
  <label>Scale
    <input id="editor-scale" type="number" step="0.01" value="1">
  </label>
  <div class="row">
    <button id="editor-apply">Apply</button>
    <button id="editor-refresh">Refresh</button>
  </div>
  <div class="row">
    <button id="editor-save">Save</button>
    <button id="editor-load">Load</button>
  </div>
  <label>Scene JSON (export/import)
    <textarea id="editor-json" rows="6"></textarea>
  </label>
  <div class="row">
    <button id="editor-export">Export to textarea</button>
    <button id="editor-import">Import from textarea</button>
  </div>
  <div class="row">
    <button id="editor-close">Close</button>
    <button id="editor-play">Close & Play</button>
  </div>
`;
document.body.appendChild(panel);

// Wire open button
const openButton = document.getElementById('editor-open-button');
if (openButton) openButton.addEventListener('click', openEditor);

// Elements
const el = (id) => document.getElementById(id);

function openEditor() {
  panel.style.display = 'block';
  // unlock pointer so UI is usable
  try { document.exitPointerLock(); } catch (e) {}
  refreshEditor();
}


function closeEditor() {
  panel.style.display = 'none';
}

function getArrayForCategory(cat) {
  switch (cat) {
    case 'trunks': return safe(game().trunkMeshes) || [];
    case 'rocks': return safe(game().rockMeshes) || [];
    case 'houses': return safe(game().houses) || [];
    case 'bushes': return []; // bushes created directly; not tracked in a single array in main.js
    case 'fruits': return safe(game().collectibles) || [];
    default: return [];
  }
}

function getObject(cat, idx) {
  const arr = getArrayForCategory(cat);
  if (!arr || arr.length === 0) return null;
  idx = Math.max(0, Math.min(arr.length - 1, idx));
  return arr[idx];
}

function refreshEditor() {
  const cat = el('editor-category').value;
  const arr = getArrayForCategory(cat);
  const max = Math.max(0, (arr && arr.length - 1) || 0);
  el('editor-index').max = max;
  const idx = Math.min(el('editor-index').value || 0, max);
  el('editor-index').value = idx;
  populateFromSelection();
}

function populateFromSelection() {
  const cat = el('editor-category').value;
  const idx = parseInt(el('editor-index').value || '0', 10);
  const obj = getObject(cat, idx);
  if (!obj) {
    el('editor-posx').value = el('editor-posy').value = el('editor-posz').value = '';
    el('editor-roty').value = el('editor-scale').value = '';
    return;
  }
  // different types (group vs mesh vs plain descriptor)
  if (obj.position) {
    el('editor-posx').value = obj.position.x.toFixed(2);
    el('editor-posy').value = obj.position.y.toFixed(2);
    el('editor-posz').value = obj.position.z.toFixed(2);
  } else if (typeof obj.x !== 'undefined') {
    el('editor-posx').value = obj.x.toFixed(2);
    el('editor-posy').value = (obj.y || 0).toFixed(2);
    el('editor-posz').value = obj.z.toFixed(2);
  }
  // rotation
  const rotY = (obj.rotation && obj.rotation.y) ? (obj.rotation.y * 180 / Math.PI) : 0;
  el('editor-roty').value = (rotY).toFixed(1);
  // scale - if group, try scale.x
  const scale = (obj.scale && obj.scale.x) ? obj.scale.x : 1;
  el('editor-scale').value = scale.toFixed(2);
}

function applyToSelection() {
  const cat = el('editor-category').value;
  const idx = parseInt(el('editor-index').value || '0', 10);
  const obj = getObject(cat, idx);
  if (!obj) return;
  const x = parseFloat(el('editor-posx').value || 0);
  const y = parseFloat(el('editor-posy').value || 0);
  const z = parseFloat(el('editor-posz').value || 0);
  const ry = parseFloat(el('editor-roty').value || 0) * Math.PI / 180;
  const s = parseFloat(el('editor-scale').value || 1);
  if (obj.position) obj.position.set(x, y, z);
  if (obj.rotation) obj.rotation.y = ry;
  if (obj.scale) obj.scale.set(s, s, s);
}

function buildSceneJSON() {
  return {
    trunks: (game().trunkMeshes || []).map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z, ry: (m.rotation && m.rotation.y) || 0, s: (m.scale && m.scale.x) || 1 })),
    rocks: (game().rockMeshes || []).map(m => ({ x: m.position.x, y: m.position.y, z: m.position.z, ry: (m.rotation && m.rotation.y) || 0, s: (m.scale && m.scale.x) || 1 })),
    houses: (game().houses || []).map(h => ({ x: h.x, z: h.z, w: h.w, d: h.d })),
    fruits: (game().collectibles || []).map(f => ({ x: f.position.x, y: f.position.y, z: f.position.z })),
    // NOTE: this is a minimal snapshot; expand as needed (textures, procedural seeds, etc.)
  };
}

function saveSceneToLocal() {
  const json = buildSceneJSON();
  localStorage.setItem(key, JSON.stringify(json));
  el('editor-json').value = JSON.stringify(json, null, 2);
  alert('Scene saved to localStorage.');
}

function loadSceneFromLocal() {
  const raw = localStorage.getItem(key);
  if (!raw) { alert('No saved scene in localStorage.'); return; }
  try {
    const data = JSON.parse(raw);
    applySceneData(data);
    el('editor-json').value = JSON.stringify(data, null, 2);
    alert('Scene loaded from localStorage.');
  } catch (e) { alert('Failed to parse saved scene: ' + e); }
}

function applySceneData(data) {
  if (!data) return;
  if (data.trunks) {
    const trunks = game().trunkMeshes || [];
    for (let i = 0; i < Math.min(data.trunks.length, trunks.length); i++) {
      const d = data.trunks[i];
      const m = trunks[i];
      if (m && m.position) m.position.set(d.x, d.y, d.z);
      if (m && m.rotation) m.rotation.y = d.ry || 0;
      if (m && m.scale) m.scale.set(d.s || 1, d.s || 1, d.s || 1);
    }
  }
  if (data.rocks) {
    const rocks = game().rockMeshes || [];
    for (let i = 0; i < Math.min(data.rocks.length, rocks.length); i++) {
      const d = data.rocks[i];
      const m = rocks[i];
      if (m && m.position) m.position.set(d.x, d.y, d.z);
      if (m && m.rotation) m.rotation.y = d.ry || 0;
      if (m && m.scale) m.scale.set(d.s || 1, d.s || 1, d.s || 1);
    }
  }
  if (data.fruits) {
    // For simplicity, if there are fewer saved fruits than existing, remove extras
    // If more, create additional fruits
    const saved = data.fruits;
    // remove all current fruits
    const coll = game().collectibles || [];
    for (let i = coll.length - 1; i >= 0; i--) {
      const f = coll[i];
      if (f.parent) f.parent.remove(f);
    }
    coll.length = 0;
    // recreate from saved
    for (const d of saved) {
      const createFn = game().createFruit;
      if (createFn) createFn(d.x, d.z);
    }
  }
}

// Export/import via textarea
el('editor-export').addEventListener('click', () => { el('editor-json').value = JSON.stringify(buildSceneJSON(), null, 2); });
el('editor-import').addEventListener('click', () => {
  try {
    const data = JSON.parse(el('editor-json').value);
    applySceneData(data);
    localStorage.setItem(key, JSON.stringify(data));
    alert('Imported and applied scene.');
  } catch (e) { alert('JSON parse error: ' + e); }
});

// Wire buttons
el('editor-apply').addEventListener('click', () => { applyToSelection(); });
el('editor-refresh').addEventListener('click', () => { refreshEditor(); });
el('editor-save').addEventListener('click', () => { saveSceneToLocal(); });
el('editor-load').addEventListener('click', () => { loadSceneFromLocal(); });
el('editor-close').addEventListener('click', () => { closeEditor(); });
el('editor-play').addEventListener('click', () => { closeEditor(); /* optionally re-lock pointer later by pressing Play */ });

el('editor-category').addEventListener('change', refreshEditor);
el('editor-index').addEventListener('input', populateFromSelection);

// Initialize: if saved scene exists, show small hint in textarea
if (localStorage.getItem(key)) {
  el('editor-json').value = localStorage.getItem(key);
}

// Expose open function on window for debugging
window.__openEditor = openEditor;

// small helper: populate on load
setTimeout(() => { /* nothing - keep panel hidden until user opens */ }, 200);
