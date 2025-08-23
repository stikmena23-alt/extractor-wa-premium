// app.js
// =================== v1.1.9 (sin PIN) ===================

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
const dropZone = document.getElementById("dropZone");

// Panel Servicio / Dispositivo
const serviceStartEl = document.getElementById("serviceStartVal");
const osBuildEl      = document.getElementById("osBuildVal");
const connStatEl     = document.getElementById("connStatVal");
const lastSeenEl     = document.getElementById("lastSeenVal");
const lastIpEl       = document.getElementById("lastIpVal");
const ispEl          = document.getElementById("ispVal");
const ipVersionEl    = document.getElementById("ipVersionVal");
const ipTypeEl       = document.getElementById("ipTypeVal");

// Subir archivos
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

// Servicio (mantener en estado para exportar)
let currentServiceInfo = {
  serviceStart: "-",
  osBuild: "-",
  connState: "-",
  lastSeen: "-",
  lastIP: "-",
  isp: "-",
  ipVersion: "-",
  ipType: "-"
};

// =================== UTILIDADES ===================

function normalizeNumber(n){ return String(n).replace(/\D+/g, ""); }
function stripCountry57(d){
  if (!d) return "";
  if (d.startsWith("0057")) return d.slice(4);
  if (d.startsWith("57") && d.length > 2) return d.slice(2);
  return d;
}
function isYearLike(d){ return /^\d{4}$/.test(d) && +d >= 1900 && +d <= 2099; }
function getNormalizedObjective(){
  const v = (accountIdEl.value || "").trim();
  const n = stripCountry57(normalizeNumber(v));
  return n || "";
}
function removeNumberAndUniq(arr, numToRemove){
  if (!numToRemove) return Array.from(new Set(arr));
  return Array.from(new Set(arr.filter(x => x !== numToRemove)));
}
function sanitizeSource(text){
  if (!text) return "";
  let t = String(text);
  t = t.replace(/(Internal\s*Ticket\s*Number|N[úu]mero\s+de\s+ticket\s+interno)[^0-9a-zA-Z]{0,10}\d[\d\s\-.,;:/]*/gi,'$1 [omitido]');
  t = t.replace(/(Internal\s*Ticket\s*Number|N[úu]mero\s+de\s+ticket\s+interno)[^\n\r]*[\n\r]+[^\n\r]*\d[\d\s\-.,;:/]*/gi,'$1 [omitido]');
  t = t.replace(/(Account\s*Identifier)([^0-9A-Za-z]{0,20})\+?[\d()\[\]\s\-.]{8,}/gi,'$1$2[omitido]');
  return t;
}
function uniq(arr){ return Array.from(new Set(arr)); }
function textToContacts(text){
  const matches = (text || "").match(/\d{8,}/g) || [];
  const clean = [];
  for (let n of matches){
    n = stripCountry57(normalizeNumber(n));
    if (!n) continue;
    if (isYearLike(n)) continue;
    clean.push(n);
  }
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
  const ai = getNormalizedObjective();
  if (ai && map[ai]){
    readCount -= map[ai];
    delete map[ai];
  }
  const dupCount = Object.values(map).filter(c => c > 1).length;
  return { read: readCount, duplicates: dupCount, countsMap: map };
}

// =================== ZIP & FILE HELPERS ===================

function readFileAsText(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsText(file, 'utf-8');
  });
}
function extractAccountIdentifierFromHtml(html){
  try{
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const all = Array.from(doc.querySelectorAll('body, body *'));
    const txt = el => (el ? (el.textContent || "") : "");
    for(const el of all){
      const t = txt(el).trim();
      if(!t) continue;
      if(/account\s*identifier/i.test(t)){
        let m = t.match(/account\s*identifier[^A-Za-z0-9+]*([+]?[\d()\[\]\s\-.]{8,})/i);
        if(m && m[1]){
          const cleaned = stripCountry57(normalizeNumber(m[1]));
          if (cleaned && !isYearLike(cleaned)) return cleaned;
        }
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
  }catch(e){}
  const rx = /Account\s*Identifier[^A-Za-z0-9+]*([+]?[\d()\[\]\s\-.]{8,})/i;
  const m = html.match(rx);
  if(m && m[1]){
    const cleaned3 = stripCountry57(normalizeNumber(m[1]));
    if (cleaned3 && !isYearLike(cleaned3)) return cleaned3;
  }
  return null;
}
async function processZipFile(file){
  try{
    const zip = await JSZip.loadAsync(file);
    const candidates = [];
    zip.forEach((path, entry) => { if (/records\.html$/i.test(path)) candidates.push(entry); });
    if (candidates.length === 0){
      alert("No se encontró records.html dentro del ZIP.");
      return;
    }
    const entry = candidates[0];
    const html = await entry.async('string');

    const aiRaw = extractAccountIdentifierFromHtml(html);
    if (aiRaw){ accountIdEl.value = aiRaw; }

    const srcSan = sanitizeSource(html);
    currentContacts = textToContacts(srcSan);
    currentCounts = countOccurrences(srcSan);
    inputText.value = html;
    renderPreview();

    extractServiceInfoFromSource(html);

    alert("ZIP procesado: se extrajeron números y (si se detectó) el Account Identifier.");
  }catch(err){
    console.error(err);
    alert("Error al leer el ZIP. ¿Es un archivo ZIP válido?");
  }
}
async function handleDroppedFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const zipFile = files.find(f => /\.zip$/i.test(f.name));
  if (zipFile){ await processZipFile(zipFile); return; }

  const textFiles = files.filter(f => /\.(txt|csv|html?)$/i.test(f.name));
  if (textFiles.length){
    const parts = [];
    for (const f of textFiles){
      try{ parts.push(await readFileAsText(f)); }catch{}
    }
    const merged = parts.join("\n\n");
    if (merged){
      const ai = extractAccountIdentifierFromHtml(merged);
      if (ai) accountIdEl.value = ai;

      const srcSan = sanitizeSource(merged);
      inputText.value = merged;
      currentContacts = textToContacts(srcSan);
      currentCounts = countOccurrences(srcSan);
      renderPreview();

      extractServiceInfoFromSource(merged);

      alert("Archivos cargados. Vista previa actualizada.");
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
function downloadWB(filename, sheets){
  const wb = XLSX.utils.book_new();
  for (const [n, rows] of Object.entries(sheets)) bookAppend(wb, n, rows);
  XLSX.writeFile(wb, filename);
}
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
    if (typeof s.autosave==="boolean"){ settings.autosave=s.autosave; autosaveToggle.checked = s.autosave; }
    const b = JSON.parse(localStorage.getItem(LS.batch) || "[]");
    batch = (b||[]).map(x => ({ ...x, contacts: new Set(x.contacts||[]) })); renderBatch();
    settings.exportHistory = JSON.parse(localStorage.getItem(LS.history) || "[]"); renderHistory();
  } catch {}
}
function pushHistory(entry){ settings.exportHistory.unshift(entry); settings.exportHistory=settings.exportHistory.slice(0,50); renderHistory(); saveLocal(); }
function renderHistory(){}

// =================== EVENTOS ===================

processBtn.addEventListener("click", () => {
  const pasted = inputText.value || "";

  const aiFromPasted = extractAccountIdentifierFromHtml(pasted);
  if (aiFromPasted) accountIdEl.value = aiFromPasted;

  if (accountIdEl.value) accountIdEl.value = stripCountry57(normalizeNumber(accountIdEl.value));

  const source = sanitizeSource(pasted);

  currentContacts = textToContacts(source);
  currentCounts = countOccurrences(source);
  renderPreview();

  extractServiceInfoFromSource(pasted);
});

addToBatchBtn.addEventListener("click", () => {
  if (!currentContacts.length) {
    const source = sanitizeSource(inputText.value);
    currentContacts = textToContacts(source);
    currentCounts = countOccurrences(source);
    if (!currentContacts.length){ alert("No hay contactos."); return; }
  }
  const objective = stripCountry57(normalizeNumber((accountIdEl.value || "").trim()));
  const caseId = (caseIdEl.value || '').trim();

  // Guardar snapshot de servicio en el lote
  const serviceSnapshot = JSON.parse(JSON.stringify(currentServiceInfo));

  batch.push({
    id: Date.now()+"-"+Math.random(),
    objective,
    caseId,
    contacts: new Set(currentContacts),
    service: serviceSnapshot
  });
  renderBatch();
  inputText.value="";
  currentContacts=[];
  currentCounts={ read:0,duplicates:0,countsMap:{} };
  renderPreview();
});

clearBtn.addEventListener("click", () => {
  inputText.value=""; accountIdEl.value=""; caseIdEl.value="";
  currentContacts=[]; currentCounts={ read:0,duplicates:0,countsMap:{} }; renderPreview();
  extractServiceInfoFromSource(null);
});

clearBatchBtn.addEventListener("click", () => {
  if (!confirm("¿Vaciar lote?")) return;
  batch=[]; renderBatch();
});

showAllEl.addEventListener("change", () => { renderPreview(); });
previewFilter.addEventListener("input", () => { renderPreview(); });
sortSelect.addEventListener("change", () => { renderPreview(); });

themeToggle.addEventListener("change", ()=>{ settings.theme=themeToggle.checked?'light':'dark'; document.body.setAttribute('data-theme', settings.theme); saveLocal(); });
anonToggle.addEventListener("change", ()=>{ settings.anonymize=anonToggle.checked; saveLocal(); renderPreview(); });
autosaveToggle.addEventListener("change", ()=>{ settings.autosave=autosaveToggle.checked; saveLocal(); });

downloadBtn.addEventListener("click", () => {
  if (!currentContacts.length){ alert("No hay contactos."); return; }
  const objective = stripCountry57(normalizeNumber((accountIdEl.value || "").trim())) || "objetivo";
  const caseId = (caseIdEl.value || '').trim();
  const ts = nowStamp();

  // Datos
  const rowsDatos = [["Contactos","Objetivo","Caso"]];
  currentContacts.forEach(c => rowsDatos.push([String(c), String(objective), String(caseId)]));

  // Resumen
  const rowsResumen = [
    ["Métrica","Valor"],
    ["Leídos", currentCounts.read],
    ["Únicos", currentContacts.length],
    ["Duplicados", currentCounts.duplicates],
    ["Fecha", new Date().toISOString()]
  ];

  // Servicio (del estado actual)
  const rowsServicio = getServiceRowsForCurrent();

  const sheets = { "Datos": rowsDatos, "Resumen": rowsResumen, "Servicio": rowsServicio };

  if (fmtXlsx.checked) downloadWB(`${objective}_contacts_${ts}.xlsx`, sheets);
  if (fmtCsv.checked) downloadCsv(`${objective}_contacts_${ts}.csv`, rowsDatos);
  if (fmtJson.checked) downloadJson(`${objective}_contacts_${ts}.json`, {
    datos: rowsDatos.slice(1).map(r=>({ contacto:r[0],objetivo:r[1],caso:r[2] })),
    resumen:Object.fromEntries(rowsResumen.slice(1)),
    servicio:Object.fromEntries(rowsServicio.slice(1))
  });
  pushHistory({ ts, filename: `${objective}_contacts_${ts}`, total: currentCounts.read, unique: currentContacts.length });
});

exportMergedBtn.addEventListener("click", () => {
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

  // Servicio (por cada item del lote)
  const rowsServicios = getServiceRowsForBatch();

  const sheets = { "Datos":rows, "Resumen":summary, "Servicio": rowsServicios };
  if (fmtXlsx.checked) downloadWB(`unificado_contacts_${ts}.xlsx`, sheets);
  if (fmtCsv.checked) downloadCsv(`unificado_contacts_${ts}.csv`, rows);
  if (fmtJson.checked) downloadJson(`unificado_contacts_${ts}.json`, {
    datos:rows.slice(1).map(r=>({contacto:r[0],objetivo:r[1],caso:r[2]})),
    resumen:Object.fromEntries(summary.slice(1)),
    servicio_tabular: rowsServicios
  });
  pushHistory({ ts, filename:`unificado_contacts_${ts}`, total:rows.length-1, unique:rows.length-1 });
});

// =============== MODAL GUÍA (robusto y auto-open) ===============
(function setupHowtoModal(){
  const modal   = document.getElementById("howtoModal");
  const overlay = document.getElementById("modalOverlay");
  const openBtn = document.getElementById("openGuide");

  if (!modal || !overlay) {
    console.warn("[HowtoModal] No se encontró el modal u overlay en el DOM.");
    return;
  }

  const open = () => {
    modal.classList.add("open");
    overlay.classList.add("open");
    document.body.classList.add("noscroll");
  };
  const close = () => {
    modal.classList.remove("open");
    overlay.classList.remove("open");
    document.body.classList.remove("noscroll");
  };

  document.querySelectorAll("[data-close-howto]").forEach(el => {
    el.addEventListener("click", close);
  });
  overlay.addEventListener("click", close);

  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(open));
  } else {
    requestAnimationFrame(open);
  }

  window.HowtoModal = { open, close };
})();

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
    const dt = e.dataTransfer; if (!dt) return;
    if (dt.files && dt.files.length){ await handleDroppedFiles(dt.files); }
    else alert("Suelta archivos válidos (.zip con records.html, o .txt/.csv/.html).");
  });
}

// =================== SUBIR ARCHIVOS (input[file]) ===================
if (uploadBtn && filePicker){
  uploadBtn.addEventListener('click', () => { filePicker.click(); });
  filePicker.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length){ await handleDroppedFiles(files); }
    filePicker.value = "";
  });
}

/* =================== PANEL SERVICIO — EXTRACCIÓN =================== */

const lbls = {
  serviceStart: [/^service\s*start$/i, /^inicio\s+del\s+servicio$/i, /^start\s+of\s+service$/i],
  osBuild: [/^device\s*os\s*build\s*number$/i, /^os\s*build\s*number$/i, /^n[úu]mero\s+de\s+compilaci[óo]n/i],
  connStat: [/^connection\s*state$/i, /^connection\s*stat$/i, /^estado\s+de\s+la\s+conexi[óo]n$/i],
  lastSeen: [/^last\s*seen$/i, /^[úu]ltim[ao]\s+vez\s+vist[oa]$/i, /^last\s+active$/i],
  lastIp: [/^last\s*ip$/i, /^[úu]ltim[ao]\s+ip$/i]
};
const RX = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}\b/g,
  ipv6: /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi,
  ddmmyyyy_hms: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*UTC|Z)?\b/i,
  iso: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z| ?UTC)?\b/i
};

// UTC -> HLC (UTC−5) para mostrar
function toHLCString(dateLike){
  try{
    const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
    if (Number.isNaN(+d)) return "-";
    d.setHours(d.getHours() - 5);
    return d.toLocaleString('es-CO', { hour12:false });
  }catch{ return "-"; }
}
function parseFlexibleDate(str){
  if (!str) return null;
  const s = String(str).trim();

  const mIso = s.match(RX.iso);
  if (mIso) {
    const raw = mIso[0].replace(/\s*UTC/i, 'Z'); // trata "UTC" como Z
    const d = new Date(raw);
    if (!Number.isNaN(+d)) return d;
  }
  const mDMY = s.match(RX.ddmmyyyy_hms);
  if (mDMY){
    const [ , dd, mm, yyyy, HH, MM, SS ] = mDMY;
    const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}T${String(HH).padStart(2,'0')}:${String(MM).padStart(2,'0')}:${String(SS||'00').padStart(2,'0')}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(+d)) return d;
  }
  const d2 = new Date(s);
  if (!Number.isNaN(+d2)) return d2;
  return null;
}
function getLabelTextFromTi(el){
  const all = (el.textContent || "").trim();
  const m = el.querySelector('.m');
  if (!m) return all;
  const mText = (m.textContent || "").trim();
  const label = all.replace(mText, "").trim();
  return label;
}
function findValueByStructuredLabels(doc, patterns){
  const nodes = Array.from(doc.querySelectorAll('.t.o > .t.i, .t.i'));
  for (const el of nodes){
    const label = getLabelTextFromTi(el);
    if (!label) continue;
    for (const re of patterns){
      if (re.test(label)){
        const vDiv = el.querySelector('.m > div');
        if (vDiv){
          for (const n of vDiv.childNodes){
            if (n.nodeType === 3){
              const val = String(n.nodeValue || '').trim();
              if (val) return val;
            }
          }
          const cleaned = (vDiv.textContent || '').trim();
          if (cleaned) return cleaned;
        }
        const mEl = el.querySelector('.m');
        if (mEl){
          const cleaned = (mEl.textContent || '').trim();
          if (cleaned) return cleaned;
        }
      }
    }
  }
  return null;
}
function extractByLabelsFallback(raw, patterns){
  const text = String(raw);
  for (const re of patterns){
    const rx = new RegExp(`${re.source}[^\\S\\n\\r]*[:：]?\\s*([^\\n\\r<]+)`, 'i');
    const m = text.match(rx);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}
function extractIPStructured(doc, patterns){
  const val = findValueByStructuredLabels(doc, patterns);
  if (val && (RX.ipv4.test(val) || RX.ipv6.test(val))) {
    const m4 = val.match(RX.ipv4);
    const m6 = val.match(RX.ipv6);
    return (m6 && m6[0]) || (m4 && m4[0]) || null;
  }
  const html = doc.body ? doc.body.innerText || doc.body.textContent : "";
  for (const re of patterns){
    const m = html.match(new RegExp(`${re.source}[\\s\\S]{0,200}`, 'i'));
    if (m){
      const seg = m[0];
      const ip4 = seg.match(RX.ipv4);
      if (ip4 && ip4[0]) return ip4[0];
      const ip6 = seg.match(RX.ipv6);
      if (ip6 && ip6[0]) return ip6[0];
    }
  }
  const ip4All = html.match(RX.ipv4);
  if (ip4All && ip4All[0]) return ip4All[0];
  const ip6All = html.match(RX.ipv6);
  if (ip6All && ip6All[0]) return ip6All[0];
  return null;
}
function setText(el, val){
  if (!el) return;
  el.textContent = (val == null || val === "") ? "-" : String(val);
}

/* ====== setters que sincronizan UI y estado para export ====== */
function setServiceStart(dateStrOrObj){
  if (!serviceStartEl) return;
  let disp = "-";
  if (dateStrOrObj){
    const d = dateStrOrObj instanceof Date ? new Date(dateStrOrObj) : parseFlexibleDate(dateStrOrObj);
    if (d && !Number.isNaN(+d)) disp = toHLCString(d);
  }
  setText(serviceStartEl, disp);
  currentServiceInfo.serviceStart = disp;
}

// Regla: rojo si la fecha es anterior a la actual; verde si es igual/posterior
function setLastSeen(dateStrOrObj){
  if (!lastSeenEl) return;
  lastSeenEl.classList.remove('red','green');
  let disp = "-";
  if (dateStrOrObj){
    const parsed = dateStrOrObj instanceof Date ? new Date(dateStrOrObj) : parseFlexibleDate(dateStrOrObj);
    if (parsed && !Number.isNaN(+parsed)){
      const dAdj = new Date(parsed);
      dAdj.setHours(dAdj.getHours() - 5);
      disp = dAdj.toLocaleString('es-CO', { hour12:false });
      const now = new Date();
      if (dAdj < now) lastSeenEl.classList.add('red'); else lastSeenEl.classList.add('green');
    }
  }
  setText(lastSeenEl, disp);
  currentServiceInfo.lastSeen = disp;
}

// Connection State verde si online/conectado, rojo en otros
const GREEN_STATES_RX = /^(online|connected|en\s*línea|conectad[oa])$/i;
function setConnState(val){
  const v = (val && String(val).trim()) || "-";
  setText(connStatEl, v);
  connStatEl.classList.remove('red','green');
  if (v !== "-" ){
    if (GREEN_STATES_RX.test(v)) connStatEl.classList.add('green');
    else connStatEl.classList.add('red');
  }
  currentServiceInfo.connState = v;
}

function setOSBuild(val){
  const v = (val && String(val).trim()) || "-";
  setText(osBuildEl, v);
  currentServiceInfo.osBuild = v;
}
function setLastIp(val){
  const v = (val && String(val).trim()) || "-";
  setText(lastIpEl, v);
  currentServiceInfo.lastIP = v;
}
function setISP(val){
  const v = (val && String(val).trim()) || "-";
  setText(ispEl, v);
  currentServiceInfo.isp = v;
}
function setIPVersion(val){
  const v = (val && String(val).trim()) || "-";
  setText(ipVersionEl, v);
  currentServiceInfo.ipVersion = v;
}
function setIPType(val){
  const v = (val && String(val).trim()) || "-";
  setText(ipTypeEl, v);
  currentServiceInfo.ipType = v;
}

/* ====== helpers de clasificación y consulta IP ====== */
function classifyType(baseType, ispOrg, asnDesc){
  const t = (baseType||"").toLowerCase();
  const o = (ispOrg||"").toLowerCase();
  const a = (asnDesc||"").toLowerCase();
  const cloudHints = /(aws|amazon|google|gcp|cloudflare|digitalocean|ovh|hetzner|azure|microsoft|vultr|linode|contabo|oracle)/i;
  if (t.includes('mobile') || t.includes('cell') || o.includes('mobile') || o.includes('cell') || a.includes('mobile')) return 'celular';
  if (t.includes('business') || t.includes('hosting') || cloudHints.test(ispOrg||'') || cloudHints.test(asnDesc||'')) return 'hosting';
  if (t.includes('res') || t.includes('home') || o.includes('home')) return 'residencial';
  return cloudHints.test(ispOrg||'') ? 'hosting' : 'residencial';
}
async function lookupIP(ip){
  if (!ip || ip === "-") return;
  setLastIp(ip);
  try{
    try{
      const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
      const data = await r.json();
      if (!data || data.success === false) throw new Error('ipwho.is failed');
      const isp = data?.connection?.isp || data?.isp || data?.org || "-";
      const typeVer = data?.type || (/:/.test(ip) ? 'IPv6':'IPv4');
      const asnDesc = (data?.connection?.asn ? `AS${data.connection.asn}` : '') + ' ' + (data?.connection?.org || '');
      setISP(isp || "-");
      setIPVersion(typeVer || "-");
      setIPType(classifyType(data?.connection?.type || "", isp, asnDesc));
      return;
    }catch{}
    try{
      const r2 = await fetch(`https://ipwhois.app/json/${encodeURIComponent(ip)}`);
      const j2 = await r2.json();
      const isp = j2?.isp || j2?.org || j2?.asn || "-";
      const typeVer = (j2?.type || (/:/.test(ip) ? 'IPv6':'IPv4'));
      const asnDesc = j2?.asn || "";
      setISP(isp || "-");
      setIPVersion(typeVer || "-");
      setIPType(classifyType(j2?.type || "", isp, asnDesc));
      return;
    }catch{}
  }catch(err){
    console.error("Error consultando IP:", err);
  }
}

/* ====== extracción principal del panel desde el texto/HTML ====== */
function extractServiceInfoFromSource(raw){
  if (!raw){
    setServiceStart(null);
    setOSBuild("-");
    setConnState("-");
    setLastSeen(null);
    setLastIp("-");
    setISP("-");
    setIPVersion("-");
    setIPType("-");
    return;
  }
  let doc = null;
  try{ doc = new DOMParser().parseFromString(String(raw), 'text/html'); }catch{}

  const serviceStart = doc ? findValueByStructuredLabels(doc, lbls.serviceStart) : null;
  const osBuild      = doc ? findValueByStructuredLabels(doc, lbls.osBuild)      : null;
  const connState    = doc ? findValueByStructuredLabels(doc, lbls.connStat)     : null;
  const lastSeen     = doc ? findValueByStructuredLabels(doc, lbls.lastSeen)     : null;
  let lastIP         = doc ? extractIPStructured(doc, lbls.lastIp)               : null;

  const f = (val, pats) => val || extractByLabelsFallback(raw, pats);
  const ss = f(serviceStart, lbls.serviceStart);
  const ob = f(osBuild, lbls.osBuild);
  const cs = f(connState, lbls.connStat);
  const ls = f(lastSeen, lbls.lastSeen);

  if (!lastIP){
    const text = String(raw);
    const ip4 = text.match(RX.ipv4); const ip6 = text.match(RX.ipv6);
    lastIP = (ip6 && ip6[0]) || (ip4 && ip4[0]) || null;
  }

  setServiceStart(ss ? (parseFlexibleDate(ss) || ss) : null);
  setOSBuild(ob || "-");
  setConnState(cs || "-");
  setLastSeen(ls ? (parseFlexibleDate(ls) || ls) : null);
  setLastIp(lastIP || "-");

  if (lastIP) lookupIP(lastIP);
}

/* ====== helpers de exportación del panel ====== */
function getServiceRowsForCurrent(){
  return [
    ["Clave","Valor"],
    ["Service start", currentServiceInfo.serviceStart || "-"],
    ["Device OS Build Number", currentServiceInfo.osBuild || "-"],
    ["Connection State", currentServiceInfo.connState || "-"],
    ["Last seen", currentServiceInfo.lastSeen || "-"],
    ["Last IP", currentServiceInfo.lastIP || "-"],
    ["ISP", currentServiceInfo.isp || "-"],
    ["Versión", currentServiceInfo.ipVersion || "-"],
    ["Tipo", currentServiceInfo.ipType || "-"]
  ];
}
function getServiceRowsForBatch(){
  const rows = [["Objetivo","Caso","Service start","Device OS Build Number","Connection State","Last seen","Last IP","ISP","Versión","Tipo"]];
  batch.forEach(item=>{
    const s = item.service || {};
    rows.push([
      item.objective || "—",
      item.caseId || "—",
      s.serviceStart || "-",
      s.osBuild || "-",
      s.connState || "-",
      s.lastSeen || "-",
      s.lastIP || "-",
      s.isp || "-",
      s.ipVersion || "-",
      s.ipType || "-"
    ]);
  });
  return rows;
}

/* ====== init ====== */
window.addEventListener('DOMContentLoaded', () => {
  restoreLocal();
  renderPreview();
});
