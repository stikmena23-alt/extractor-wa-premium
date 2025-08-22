// =================== v1.1.6 + PIN (overlay inyectado, sin quitar nada) ===================

// -------- PIN (cámbialo aquí) --------
const PIN_CODE = "0509"; // <— Cambia este PIN
let unlocked = true;

// ----------- DOM ELEMENTS -----------
const inputText = document.getElementById("inputText");
const accountIdEl = document.getElementById("accountId");
const caseIdEl = document.getElementById("caseId");

const processBtn = document.getElementById("processBtn");
const addToBatchBtn = document.getElementById("addToBatchBtn");
const clearBtn = document.getElementById("clearBtn");

const contactsList = document.getElementById("contactsList");
const showAllEl = document.getElementById("showAll");
const statRead = document.getElementById("stat-read");
const statUnique = document.getElementById("stat-unique");
const statDup = document.getElementById("stat-dup");

const downloadBtn = document.getElementById("downloadBtn");
const exportMergedBtn = document.getElementById("exportMergedBtn");
const batchList = document.getElementById("batchList");
const clearBatchBtn = document.getElementById("clearBatchBtn");

const previewFilter = document.getElementById("previewFilter");
const sortSelect = document.getElementById("sortSelect");
const prefixDash = document.getElementById("prefixDash");

const fmtXlsx = document.getElementById("fmtXlsx");
const fmtCsv = document.getElementById("fmtCsv");
const fmtJson = document.getElementById("fmtJson");

const themeToggle = document.getElementById("themeToggle");
const anonToggle = document.getElementById("anonToggle");
const autosaveToggle = document.getElementById("autosaveToggle");

const openGuide = document.getElementById("openGuide");

const cmpFileA = document.getElementById("cmpFileA");
const cmpFileB = document.getElementById("cmpFileB");
const compareBtn = document.getElementById("compareBtn");
const exportDiffBtn = document.getElementById("exportDiffBtn");
const cmpStats = document.getElementById("cmpStats");
const cmpPreview = document.getElementById("cmpPreview");

const dropZone = document.getElementById("dropZone");

// NUEVO: subir archivos (además de drag & drop)
const uploadBtn = document.getElementById("uploadBtn");
const filePicker = document.getElementById("filePicker");

// ----------- ESTADO GLOBAL -----------
let currentContacts = [];
let batch = [];
let currentCounts = { read:0, duplicates:0, countsMap:{} };
let settings = {
  theme: 'dark',
  anonymize: false,
  autosave: true,
  exportHistory: []
};

// =================== UTILIDADES ===================

// Normaliza a dígitos
function normalizeNumber(n){ return String(n).replace(/\D+/g, ""); }

// Quita +57 / 57 / 0057
function stripCountry57(d){
  if (!d) return "";
  if (d.startsWith("0057")) return d.slice(4);
  if (d.startsWith("57") && d.length > 2) return d.slice(2);
  return d;
}

// Descarta valores que parezcan años 1900–2099 (y longitudes 4 exactas)
function isYearLike(d){
  return /^\d{4}$/.test(d) && +d >= 1900 && +d <= 2099;
}

// >>> NUEVO: obtener el objetivo normalizado (AI) <<<
function getNormalizedObjective(){
  const v = (accountIdEl.value || "").trim();
  const n = stripCountry57(normalizeNumber(v));
  return n || ""; // solo dígitos sin +57
}

// >>> NUEVO: quita un número específico de un array (si está) y deja únicos <<<
function removeNumberAndUniq(arr, numToRemove){
  if (!numToRemove) return Array.from(new Set(arr));
  return Array.from(new Set(arr.filter(x => x !== numToRemove)));
}

// NUEVO: antes de extraer, elimina números asociados a "Internal Ticket Number" / "Número de ticket interno"
// + enmascara número tras "Account Identifier"
function sanitizeSource(text){
  if (!text) return "";
  let t = String(text);

  // Caso 1: misma línea que la etiqueta (HTML o texto) - Internal Ticket
  t = t.replace(
    /(Internal\s*Ticket\s*Number|N[úu]mero\s+de\s+ticket\s+interno)[^0-9a-zA-Z]{0,10}\d[\d\s\-.,;:/]*/gi,
    '$1 [omitido]'
  );

  // Caso 2: número en la(s) siguiente(s) línea(s) cercanas - Internal Ticket
  t = t.replace(
    /(Internal\s*Ticket\s*Number|N[úu]mero\s+de\s+ticket\s+interno)[^\n\r]*[\n\r]+[^\n\r]*\d[\d\s\-.,;:/]*/gi,
    '$1 [omitido]'
  );

  // >>> NUEVO: enmascara cualquier número que siga a "Account Identifier"
  t = t.replace(
    /(Account\s*Identifier)([^0-9A-Za-z]{0,20})\+?[\d()\[\]\s\-.]{8,}/gi,
    '$1$2[omitido]'
  );

  return t;
}

// uniq
function uniq(arr){ return Array.from(new Set(arr)); }

// Extrae contactos desde texto (>=8 dígitos, filtra años) y EXCLUYE el AI
function textToContacts(text){
  const matches = (text || "").match(/\d{8,}/g) || [];
  const clean = [];
  for (let n of matches){
    n = stripCountry57(normalizeNumber(n));
    if (!n) continue;
    if (isYearLike(n)) continue;             // seguridad extra
    clean.push(n);
  }
  // >>> NUEVO: sacar el Account Identifier de la lista
  const ai = getNormalizedObjective();
  return removeNumberAndUniq(clean, ai);
}

function countOccurrences(text){
  const matches = (text || "").match(/\d{8,}/g) || [];
  const map = Object.create(null);
  let readCount = 0;
  for (let n of matches){
    n = stripCountry57(normalizeNumber(n));
    if (!n || isYearLike(n)) continue;
    map[n] = (map[n] || 0) + 1;
    readCount++;
  }

  // >>> NUEVO: elimina el AI del mapa y ajusta el conteo leído
  const ai = getNormalizedObjective();
  if (ai && map[ai]){
    readCount -= map[ai];
    delete map[ai];
  }

  const dupCount = Object.values(map).filter(c => c > 1).length;
  return { read: readCount, duplicates: dupCount, countsMap: map };
}

// =================== ZIP & FILE HELPERS (NEW) ===================

function readFileAsText(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsText(file, 'utf-8');
  });
}

// Extrae el Account Identifier desde HTML, retorna dígitos limpios (sin + ni 57)
function extractAccountIdentifierFromHtml(html){
  try{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const all = Array.from(doc.querySelectorAll('body, body *'));
    const txt = el => (el ? (el.textContent || "") : "");

    // 1) Busca nodos con "Account Identifier"
    for(const el of all){
      const t = txt(el).trim();
      if(!t) continue;
      if(/account\s*identifier/i.test(t)){
        // en el mismo nodo
        let m = t.match(/account\s*identifier[^A-Za-z0-9+]*([+]?[\d()\[\]\s\-.]{8,})/i);
        if(m && m[1]){
          const cleaned = stripCountry57(normalizeNumber(m[1]));
          if (cleaned && !isYearLike(cleaned)) return cleaned;
        }
        // en hermano cercano o hijo
        const next = el.nextElementSibling ? txt(el.nextElementSibling) : "";
        const near = (el.children && el.children[0]) ? txt(el.children[0]) : "";
        const candidates = [next, near].join(" ");
        m = candidates.match(/([+]?[\d()\[\]\s\-.]{8,})/);
        if(m && m[1]){
          const cleaned2 = stripCountry57(normalizeNumber(m[1]));
          if (cleaned2 && !isYearLike(cleaned2)) return cleaned2;
        }
      }
    }
  }catch(e){/* ignore */ }

  // 2) Fallback regex sobre HTML plano
  const rx = /Account\s*Identifier[^A-Za-z0-9+]*([+]?[\d()\[\]\s\-.]{8,})/i;
  const m = html.match(rx);
  if(m && m[1]){
    const cleaned3 = stripCountry57(normalizeNumber(m[1]));
    if (cleaned3 && !isYearLike(cleaned3)) return cleaned3;
  }
  return null;
}

// Procesa un ZIP: busca records.html, extrae números y Account Identifier
async function processZipFile(file){
  try{
    const zip = await JSZip.loadAsync(file);
    // Encuentra records.html (insensible a mayúsculas y subcarpetas)
    const candidates = [];
    zip.forEach((path, entry) => { if (/records\.html$/i.test(path)) candidates.push(entry); });
    if (candidates.length === 0){
      alert("No se encontró records.html dentro del ZIP.");
      return;
    }

    const entry = candidates[0];
    const html = await entry.async('string');

    // Detecta Account Identifier
    const aiRaw = extractAccountIdentifierFromHtml(html);
    if (aiRaw){
      accountIdEl.value = aiRaw; // ya limpio (sin + ni 57)
    }

    // Sanea para omitir "Internal Ticket Number" y años/fechas + enmascara AI
    const srcSan = sanitizeSource(html);

    // Extrae números y muestra (AI excluido en textToContacts y countOccurrences)
    currentContacts = textToContacts(srcSan);
    currentCounts = countOccurrences(srcSan);

    inputText.value = html; // Conserva traza original en textarea
    renderPreview();
    alert("ZIP procesado: se extrajeron números (omitiendo fechas y 'Internal Ticket Number') y (si se detectó) el Account Identifier.");
  }catch(err){
    console.error(err);
    alert("Error al leer el ZIP. ¿Es un archivo ZIP válido?");
  }
}

// Manejo de drag & drop para zip + txt/csv/html
async function handleDroppedFiles(fileList){
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN para usar la herramienta."); return; }
  const files = Array.from(fileList || []);
  if (!files.length) return;

  // Prioriza ZIP si está presente
  const zipFile = files.find(f => /\.zip$/i.test(f.name));
  if (zipFile){
    await processZipFile(zipFile);
    return;
  }

  // Si no hay ZIP, intenta .txt/.csv/.html
  const textFiles = files.filter(f => /\.(txt|csv|html?)$/i.test(f.name));
  if (textFiles.length){
    const parts = [];
    for (const f of textFiles){
      try{ parts.push(await readFileAsText(f)); }catch{/* ignora archivo problemático */}
    }
    const merged = parts.join("\n\n");
    if (merged){
      // Intento de AI desde HTML si hay <html> en alguno (sobre original)
      const ai = extractAccountIdentifierFromHtml(merged);
      if (ai) accountIdEl.value = ai;

      // Sanea fuente para el análisis (incluye enmascarar AI)
      const srcSan = sanitizeSource(merged);

      inputText.value = merged; // conserva original
      currentContacts = textToContacts(srcSan);
      currentCounts = countOccurrences(srcSan);
      renderPreview();
      alert("Archivos cargados. Vista previa actualizada (fechas e 'Internal Ticket Number' omitidos).");
      return;
    }
  }

  alert("No se detectaron archivos compatibles. Arrastra un .zip con records.html o .txt/.csv/.html.");
}

// =================== RENDER PREVIEW ===================

function anonymize(s){
  if (!settings.anonymize) return s;
  const d = String(s).replace(/\D+/g, '');
  if (d.length <= 4) return '*'.repeat(d.length);
  return d.slice(0,3) + '*'.repeat(Math.max(0, d.length-6)) + d.slice(-3);
}

function applyFilterAndSort(list){
  const q = (previewFilter.value || '').trim();
  let arr = list.slice();
  if (q){
    const qn = q.replace(/\s+/g, '');
    arr = arr.filter(v => String(v).includes(qn));
  }
  const mode = sortSelect.value;
  if (mode === 'asc'){ arr.sort((a,b)=> (a===b?0: a<b?-1:1)); }
  else if (mode === 'len'){ arr.sort((a,b)=> a.length===b.length ? (a<b?-1:1) : a.length-b.length); }
  return arr;
}

function buildPrefixDash(list){
  const map = new Map();
  for (const s of list){
    const d = String(s).replace(/\D+/g, '');
    if (d.length < 3) continue;
    const p = d.slice(0,3);
    map.set(p, (map.get(p)||0)+1);
  }
  const arr = Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,10);
  const total = arr.reduce((t, [,c])=>t+c, 0) || 1;
  prefixDash.innerHTML = arr.map(([p,c])=>{
    const w = Math.round((c/total)*100);
    return `<div class="bar-row"><span class="bar-label">${p}</span><div class="bar"><i style="width:${w}%"></i></div><span>${c}</span></div>`;
  }).join('') || '<div class="hint">Sin datos suficientes para prefijos</div>';
}

function renderPreview(){
  // Limpia el AI manualmente: si el usuario pega con +57, se normaliza
  if (accountIdEl.value){
    accountIdEl.value = stripCountry57(normalizeNumber(accountIdEl.value));
  }

  statRead.textContent = String(currentCounts.read || 0);
  statUnique.textContent = String(currentContacts.length || 0);
  statDup.textContent = String(currentCounts.duplicates || 0);

  const filtered = applyFilterAndSort(currentContacts);
  const list = (showAllEl.checked ? filtered : filtered.slice(0, 1000));
  contactsList.innerHTML = "";
  list.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "rowline" + ((currentCounts.countsMap[c] > 1) ? " dup" : "");
    const b = document.createElement("span");
    b.className = "badge"; b.textContent = String(i+1).padStart(3, "0");
    const v = document.createElement("span");
    v.textContent = anonymize(c);
    row.appendChild(b); row.appendChild(v);
    contactsList.appendChild(row);
  });
  buildPrefixDash(list);
  downloadBtn.disabled = currentContacts.length === 0;
}

// =================== RENDER BATCH ===================

function renderBatch(){
  batchList.innerHTML = "";
  batch.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="meta">
        <div class="tag">Objetivo:</div><div><code>${item.objective || "—"}</code></div>
        <div class="tag">Caso:</div><div><code>${item.caseId || "—"}</code></div>
        <div class="tag">Contactos:</div><div class="count">${item.contacts.size}</div>
      </div>
      <div class="rm"><button data-id="${item.id}">Quitar</button></div>`;
    batchList.appendChild(div);
  });
  batchList.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      batch = batch.filter(x => x.id !== id);
      renderBatch(); exportMergedBtn.disabled = batch.length === 0; saveLocal();
    });
  });
  exportMergedBtn.disabled = batch.length === 0; saveLocal();
}

// =================== XLSX / CSV / JSON HELPERS ===================

function aoaToSheetAsText(aoa){
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  Object.keys(ws).forEach(addr => { if (addr[0] === "!") return; const cell = ws[addr]; if (cell && typeof cell === "object") cell.t = "s"; });
  return ws;
}
function bookAppend(wb, name, rows){ XLSX.utils.book_append_sheet(wb, aoaToSheetAsText(rows), name.slice(0,31) || "Datos"); }
function nowStamp(){ const d = new Date(); const pad = (n)=> String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }
function downloadWB(filename, sheets){ const wb = XLSX.utils.book_new(); for (const [n, rows] of Object.entries(sheets)) bookAppend(wb, n, rows); XLSX.writeFile(wb, filename); }
function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}

// =================== LOCAL STORAGE ===================

const LS = { settings: 'v113_same_logic_settings', batch: 'v113_same_logic_batch', history: 'v113_same_logic_history' };
function saveLocal(){
  if (!settings.autosave) return;
  try {
    localStorage.setItem(LS.settings, JSON.stringify({ theme:settings.theme, anonymize:settings.anonymize, autosave:settings.autosave }));
    const batchSerializable = batch.map(b => ({ ...b, contacts: Array.from(b.contacts||[]) }));
    localStorage.setItem(LS.batch, JSON.stringify(batchSerializable));
    localStorage.setItem(LS.history, JSON.stringify(settings.exportHistory || []));
  } catch {}
}
function restoreLocal(){
  try {
    const s = JSON.parse(localStorage.getItem(LS.settings) || "{}");
    if (s.theme){ settings.theme = s.theme; document.body.setAttribute('data-theme', settings.theme); themeToggle.checked = (settings.theme==='light'); }
    if (typeof s.anonymize==="boolean"){ settings.anonymize=s.anonymize; anonToggle.checked=s.anonymize; }
    if (typeof s.autosave==="boolean"){ settings.autosave=s.autosave; }
    const b = JSON.parse(localStorage.getItem(LS.batch) || "[]");
    batch = (b||[]).map(x => ({ ...x, contacts: new Set(x.contacts||[]) })); renderBatch();
    settings.exportHistory = JSON.parse(localStorage.getItem(LS.history) || "[]"); renderHistory();
  } catch {}
}
function pushHistory(entry){ settings.exportHistory.unshift(entry); settings.exportHistory=settings.exportHistory.slice(0,50); renderHistory(); saveLocal(); }
function renderHistory(){}

// =================== PIN OVERLAY (inyección dinámica) ===================

function injectPinOverlay(){
  // CSS mínimo para overlay
  const style = document.createElement('style');
  style.textContent = `
  .pin-overlay{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);opacity:1;visibility:visible;pointer-events:auto;transition:opacity .2s,visibility .2s}
  .pin-overlay:not(.open){opacity:0;visibility:hidden;pointer-events:none}
  .pin-card{width:min(420px,92vw);background:linear-gradient(180deg,rgba(2,10,24,.96),rgba(2,8,18,.96));border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 16px;color:#d7e3ff;font-family:inherit}
  .pin-card h3{margin:0 0 8px}
  .pin-desc{margin:0 0 12px;opacity:.85}
  .pin-field{position:relative;display:flex;align-items:center;gap:8px}
  #pinInput{width:100%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:#d7e3ff;padding:12px 40px 12px 12px;border-radius:10px;font-size:18px;letter-spacing:2px}
  .pin-toggle{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:0;color:#d7e3ff;opacity:.85;cursor:pointer;font-size:16px;line-height:1}
  .pin-row{margin-top:10px}
  .pin-error{color:#ffb4b4;min-height:18px;margin-top:6px;font-size:13px}
  .pin-actions{margin-top:10px;display:flex;justify-content:flex-end}
  .pin-hint{margin-top:8px;opacity:.7;font-size:12px}
  `;
  document.head.appendChild(style);

  // Overlay
  const overlay = document.createElement('div');
  overlay.id = "pinOverlay";
  overlay.className = "pin-overlay open";
  overlay.setAttribute("aria-hidden","false");
  overlay.innerHTML = `
    <div class="pin-card" role="dialog" aria-modal="true" aria-labelledby="pin-title" aria-describedby="pin-desc">
      <h3 id="pin-title">Acceso con PIN</h3>
      <p id="pin-desc" class="pin-desc">Introduce el PIN para usar el extractor.</p>
      <div class="pin-field">
        <input type="password" id="pinInput" autocomplete="off" placeholder="••••" inputmode="numeric" aria-label="PIN"/>
        <button id="pinToggle" class="pin-toggle" aria-label="Mostrar u ocultar PIN">👁</button>
      </div>
      <div class="pin-row">
        <label class="switch small">
          <input type="checkbox" id="pinRemember">
          <span class="slider"></span><span class="lbl">Recordar en esta sesión</span>
        </label>
      </div>
      <div id="pinError" class="pin-error" role="alert" aria-live="assertive"></div>
      <div class="pin-actions">
        <button id="pinSubmit" class="btn">Iniciar</button>
      </div>
      <div class="pin-hint"><code></code><code></code></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Botón "Bloquear" (si existe un contenedor de acciones superior, lo añadimos)
  const topActions = document.querySelector(".topbar .actions.one-line");
  if (topActions && !document.getElementById("lockBtn")){
    const lockBtn = document.createElement("button");
    lockBtn.id = "lockBtn";
    lockBtn.className = "btn ghost";
    lockBtn.textContent = "Bloquear";
    lockBtn.title = "Bloquear con PIN";
    lockBtn.addEventListener("click", () => { sessionStorage.removeItem("pin_ok"); lock(); });
    topActions.prepend(lockBtn);
  }

  // Wire events
  const pinInput = document.getElementById("pinInput");
  const pinToggle = document.getElementById("pinToggle");
  const pinRemember = document.getElementById("pinRemember");
  const pinSubmit = document.getElementById("pinSubmit");
  const pinError = document.getElementById("pinError");

  function unlock(){
    unlocked = true;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }
  function lock(){
    unlocked = false;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    pinInput.value = "";
    pinError.textContent = "";
    setTimeout(()=> pinInput.focus(), 50);
  }

  // Exponer globalmente para otros handlers opcionales
  window.__pinLock = lock;
  window.__pinUnlock = unlock;

  const wasOk = sessionStorage.getItem("pin_ok") === "1";
  if (wasOk) unlock(); else lock();

  pinToggle.addEventListener("click", () => {
    const t = pinInput.getAttribute("type") === "password" ? "text" : "password";
    pinInput.setAttribute("type", t);
  });
  pinSubmit.addEventListener("click", () => {
    const v = (pinInput.value || "").trim();
    if (!v){ pinError.textContent = "Ingresa el PIN."; return; }
    if (v !== PIN_CODE){ pinError.textContent = "PIN incorrecto."; return; }
    pinError.textContent = "";
    if (pinRemember.checked) sessionStorage.setItem("pin_ok", "1");
    unlock();
  });
  pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") pinSubmit.click(); });

  // Atajo para bloquear rápidamente
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l'){
      sessionStorage.removeItem("pin_ok");
      lock();
    }
  });
}

// =================== EVENTOS BÁSICOS ===================

processBtn.addEventListener("click", () => {
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN para usar la herramienta."); return; }
  // Si el usuario pegó HTML, también intentamos auto AI (sobre original)
  const pasted = inputText.value || "";
  const aiFromPasted = extractAccountIdentifierFromHtml(pasted);
  if (aiFromPasted) accountIdEl.value = aiFromPasted;

  // Normaliza AI si usuario lo escribió con +57
  if (accountIdEl.value) accountIdEl.value = stripCountry57(normalizeNumber(accountIdEl.value));

  // Sanea fuente para análisis (omitir Internal Ticket Number y fechas/años + enmascarar AI)
  const source = sanitizeSource(pasted);

  currentContacts = textToContacts(source);   // AI excluido aquí
  currentCounts = countOccurrences(source);   // y aquí
  renderPreview();
});

addToBatchBtn.addEventListener("click", () => {
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN primero."); return; }
  if (!currentContacts.length) {
    // intentar a partir del textarea por si olvidó procesar
    const source = sanitizeSource(inputText.value);
    currentContacts = textToContacts(source);
    currentCounts = countOccurrences(source);
    if (!currentContacts.length){ alert("No hay contactos."); return; }
  }
  const objective = stripCountry57(normalizeNumber((accountIdEl.value || "").trim()));
  const caseId = (caseIdEl.value || '').trim();
  batch.push({ id: Date.now()+"-"+Math.random(), objective, caseId, contacts: new Set(currentContacts) });
  renderBatch();
  inputText.value=""; currentContacts=[]; currentCounts={ read:0,duplicates:0,countsMap:{} }; renderPreview();
});

clearBtn.addEventListener("click", () => {
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN primero."); return; }
  inputText.value=""; accountIdEl.value=""; caseIdEl.value="";
  currentContacts=[]; currentCounts={ read:0,duplicates:0,countsMap:{} }; renderPreview();
});

clearBatchBtn.addEventListener("click", () => { if (!unlocked){ alert("Bloqueado."); return; } if (!confirm("¿Vaciar lote?")) return; batch=[]; renderBatch(); });

showAllEl.addEventListener("change", () => { if (!unlocked) return; renderPreview(); });
previewFilter.addEventListener("input", () => { if (!unlocked) return; renderPreview(); });
sortSelect.addEventListener("change", () => { if (!unlocked) return; renderPreview(); });

themeToggle.addEventListener("change", ()=>{ settings.theme=themeToggle.checked?'light':'dark'; document.body.setAttribute('data-theme', settings.theme); saveLocal(); });
anonToggle.addEventListener("change", ()=>{ settings.anonymize=anonToggle.checked; saveLocal(); renderPreview(); });
autosaveToggle.addEventListener("change", ()=>{ settings.autosave=autosaveToggle.checked; saveLocal(); });

// EXPORT ACTUAL
downloadBtn.addEventListener("click", () => {
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN primero."); return; }
  if (!currentContacts.length){ alert("No hay contactos."); return; }
  const objective = stripCountry57(normalizeNumber((accountIdEl.value || "").trim())) || "objetivo";
  const caseId = (caseIdEl.value || '').trim();
  const ts = nowStamp();

  // Encabezados requeridos
  const rowsDatos = [["Contactos","Objetivo","Caso"]];
  currentContacts.forEach(c => rowsDatos.push([String(c), String(objective), String(caseId)]));

  const rowsResumen = [
    ["Métrica","Valor"],
    ["Leídos", currentCounts.read],
    ["Únicos", currentContacts.length],
    ["Duplicados", currentCounts.duplicates],
    ["Fecha", new Date().toISOString()]
  ];

  if (fmtXlsx.checked) downloadWB(`${objective}_contacts_${ts}.xlsx`, { "Datos": rowsDatos, "Resumen": rowsResumen });
  if (fmtCsv.checked) downloadCsv(`${objective}_contacts_${ts}.csv`, rowsDatos);
  if (fmtJson.checked) downloadJson(`${objective}_contacts_${ts}.json`, {
    datos: rowsDatos.slice(1).map(r=>({ contacto:r[0],objetivo:r[1],caso:r[2] })),
    resumen:Object.fromEntries(rowsResumen.slice(1))
  });
  pushHistory({ ts, filename: `${objective}_contacts_${ts}`, total: currentCounts.read, unique: currentContacts.length });
});

// EXPORT UNIFICADO (Lote)
exportMergedBtn.addEventListener("click", () => {
  if (!unlocked){ alert("Bloqueado. Ingresa el PIN primero."); return; }
  if (!batch.length){ alert("No hay reportes."); return; }
  const ts=nowStamp();
  const pairs=new Set();
  const rows=[["Contactos","Objetivo","Caso"]];

  batch.forEach(item=>{
    item.contacts.forEach(c=>{
      const key=`${c}|${item.objective}|${item.caseId}`;
      if (!pairs.has(key)){ pairs.add(key); rows.push([String(c),String(item.objective),String(item.caseId)]) }
    });
  });

  const summary=[["Métrica","Valor"],["Reportes",batch.length],["Total filas",rows.length-1],["Fecha",new Date().toISOString()]];
  if (fmtXlsx.checked) downloadWB(`unificado_contacts_${ts}.xlsx`, { "Datos":rows,"Resumen":summary });
  if (fmtCsv.checked) downloadCsv(`unificado_contacts_${ts}.csv`, rows);
  if (fmtJson.checked) downloadJson(`unificado_contacts_${ts}.json`, {
    datos:rows.slice(1).map(r=>({contacto:r[0],objetivo:r[1],caso:r[2]})),
    resumen:Object.fromEntries(summary.slice(1))
  });
  pushHistory({ ts, filename:`unificado_contacts_${ts}`, total:rows.length-1, unique:rows.length-1 });
});

// =============== COMPARADOR DE XLSX EXPORTADOS (Mejorado) ===============
let cmpA = null, cmpB = null; let cmpALabel="A", cmpBLabel="B";
function inferObjectiveLabel(arr){
  if (!arr.length) return "—";
  if (arr.length===1) return arr[0];
  const freq=new Map(); arr.forEach(v=>freq.set(v,(freq.get(v)||0)+1));
  const e=[...freq.entries()].sort((a,b)=>b[1]-a[1]);
  if (e[0] && (!e[1] || e[0][1]>e[1][1])) return e[0][0];
  return "Múltiples";
}
async function parseXlsxFile(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=e=>{
      try{
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const sn=wb.SheetNames.includes("Datos")?"Datos":wb.SheetNames[0];
        const ws=wb.Sheets[sn];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1});
        const h=(rows[0]||[]).map(x=>String(x||'').trim().toLowerCase());
        const iC=h.indexOf('contactos')!==-1?h.indexOf('contactos'):(h.indexOf('contacto')!==-1?h.indexOf('contacto'):0);
        const iO=h.indexOf('objetivo');
        const contacts=new Set(); const byObj=new Map(); const objs=[];
        for (let i=1;i<rows.length;i++){
          const r=rows[i]||[];
          const c=String((r[iC]||'')).trim(); if (!c) continue;
          contacts.add(c);
          let o=iO!==-1?String((r[iO]||'')).trim():"—"; if (!o) o="—";
          objs.push(o);
          if (!byObj.has(o)) byObj.set(o,new Set());
          byObj.get(o).add(c);
        }
        res({ label:inferObjectiveLabel(objs), contactsSet:contacts, byObjective:byObj });
      }catch(err){ rej(err); }
    };
    r.onerror=rej; r.readAsArrayBuffer(file);
  });
}
cmpFileA.addEventListener('change', async()=>{
  if (!unlocked){ alert("Bloqueado."); return; }
  const f=cmpFileA.files?.[0]; if(!f) return;
  try{ cmpA=await parseXlsxFile(f); cmpALabel=cmpA.label||"A"; }
  catch{ cmpA=null; cmpALabel="A"; alert("Error A"); }
  compareBtn.disabled=!(cmpA&&cmpB);
});
cmpFileB.addEventListener('change', async()=>{
  if (!unlocked){ alert("Bloqueado."); return; }
  const f=cmpFileB.files?.[0]; if(!f) return;
  try{ cmpB=await parseXlsxFile(f); cmpBLabel=cmpB.label||"B"; }
  catch{ cmpB=null; cmpBLabel="B"; alert("Error B"); }
  compareBtn.disabled=!(cmpA&&cmpB);
});
function countRepeatsAcrossObjectives(contact, map){
  let c=0; for(const s of map.values()){ if(s.has(contact)) c++; } return c;
}
compareBtn.addEventListener('click', ()=>{
  if(!(cmpA&&cmpB)) return;
  if (!unlocked){ alert("Bloqueado."); return; }
  const setA=cmpA.contactsSet,setB=cmpB.contactsSet;
  const onlyA=[],onlyB=[],both=[];
  setA.forEach(v=>{ if(!setB.has(v)) onlyA.push(v); else both.push(v); });
  setB.forEach(v=>{ if(!setA.has(v)) onlyB.push(v); });
  cmpStats.innerHTML=`<div class="chip">Solo ${cmpALabel}: <strong>${onlyA.length}</strong></div><div class="chip">Solo ${cmpBLabel}: <strong>${onlyB.length}</strong></div><div class="chip">Intersección: <strong>${both.length}</strong></div>`;
  cmpPreview.textContent=both.slice(0,50).join("\n");
  exportDiffBtn.disabled=true; // se habilita tras preparar datos
  exportDiffBtn._data={onlyA,onlyB,both,aLabel:cmpALabel,bLabel:cmpBLabel,aByObj:cmpA.byObjective,bByObj:cmpB.byObjective};
  exportDiffBtn.disabled=false;
});
exportDiffBtn.addEventListener('click', async()=>{
  if (!unlocked){ alert("Bloqueado."); return; }
  const d=exportDiffBtn._data; if(!d) return;
  const {onlyA,onlyB,both,aLabel,bLabel,aByObj,bByObj}=d;
  const wb=new ExcelJS.Workbook();
  function addSheet(n,h,rows){
    const ws=wb.addWorksheet(n); ws.addRow(h);
    rows.forEach(r=>ws.addRow(r)); ws.columns=h.map(()=>({width:24}));
    return ws;
  }
  addSheet(`Solo_${aLabel}`,["Contacto"],onlyA.map(v=>[v]));
  addSheet(`Solo_${bLabel}`,["Contacto"],onlyB.map(v=>[v]));
  const inter=both.map(v=>[v,countRepeatsAcrossObjectives(v,bByObj),countRepeatsAcrossObjectives(v,aByObj)]);
  const wsI=addSheet("Interseccion",["Contacto",`Repite en ${bLabel}`,`Repite en ${aLabel}`],inter);
  const redFill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFC7CE'}};
  const redFont={color:{argb:'FF9C0006'},bold:true};
  for(let r=2;r<=wsI.rowCount;r++){ wsI.getRow(r).eachCell(cell=>{ cell.fill=redFill; cell.font=redFont; }); }
  const buffer=await wb.xlsx.writeBuffer();
  const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`diff_${aLabel}_vs_${bLabel}_${nowStamp()}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
});

// =================== INIT & MODAL ===================
(function init(){
  restoreLocal(); renderPreview(); renderBatch();
  injectPinOverlay(); // <<— Inyecta y aplica PIN al cargar
})();

const modal = document.getElementById("howtoModal");
const overlay = document.getElementById("modalOverlay");

function openHowto(){
  if (!modal || !overlay) return;
  modal.classList.add("open"); overlay.classList.add("open");
  document.body.classList.add("noscroll");
}
function closeHowto(){
  if (!modal || !overlay) return;
  modal.classList.remove("open"); overlay.classList.remove("open");
  document.body.classList.remove("noscroll");
}

document.querySelectorAll("[data-close-howto]").forEach(el => el.addEventListener("click", closeHowto));
if (overlay) overlay.addEventListener("click", closeHowto);
if (openGuide) openGuide.addEventListener("click", (e) => { e.preventDefault(); if (!unlocked){ alert("Bloqueado."); return; } openHowto(); });

// Atajo de teclado
window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === '?' || (mod && e.key === '/')) { e.preventDefault(); if (!unlocked){ alert("Bloqueado."); return; } openHowto(); }
});

// Abre guía al cargar (si quieres mantenerlo, queda; el overlay de PIN queda por encima)
openHowto();

// =================== DRAG & DROP ===================
if (dropZone){
  let dragCounter = 0;

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter++; dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter--; if (dragCounter <= 0) dropZone.classList.remove('dragging');
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragging'); dragCounter = 0;
    if (!unlocked){ alert("Bloqueado. Ingresa el PIN para usar la herramienta."); return; }
    const dt = e.dataTransfer; if (!dt) return;
    if (dt.files && dt.files.length){ await handleDroppedFiles(dt.files); }
    else alert("Suelta archivos válidos (.zip con records.html, o .txt/.csv/.html).");
  });
}

// =================== SUBIR ARCHIVOS (input[file]) ===================
if (uploadBtn && filePicker){
  uploadBtn.addEventListener('click', () => { if (!unlocked){ alert("Bloqueado. Ingresa el PIN."); return; } filePicker.click(); });
  filePicker.addEventListener('change', async (e) => {
    if (!unlocked) return;
    const files = e.target.files;
    if (files && files.length){ await handleDroppedFiles(files); }
    // Limpia selección para poder volver a subir mismos archivos seguidos
    filePicker.value = "";
  });
}
