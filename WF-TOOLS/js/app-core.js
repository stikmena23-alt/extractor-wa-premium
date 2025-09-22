// app.js
// =================== v1.2.0 (clasificación IP ampliada + tabla residencial + reset + IPv6/puerto robusto + ONLINE usa Online Since) ===================

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
const lastSeenAgoEl  = document.getElementById("lastSeenAgoVal");
const lastIpEl       = document.getElementById("lastIpVal");
const ispEl          = document.getElementById("ispVal");
const ipVersionEl    = document.getElementById("ipVersionVal");
const ipTypeEl       = document.getElementById("ipTypeVal");

// 🔹 NUEVO: Puerto en panel
const ipPortEl       = document.getElementById("ipPortVal");

// Coincidir con tu HTML actual:
const cityEl         = document.getElementById("cityVal");
const countryEl      = document.getElementById("countryVal");
const secChipsEl     = document.getElementById("secChips");

// NUEVO: Tarjeta y tabla residencial
const resCard        = document.getElementById("resCard");
const resTableBody   = document.getElementById("resTableBody");
const copyResTableBtn= document.getElementById("copyResTableBtn");

// Subir archivos
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatLog = document.getElementById("chatLog");
const graphEl = document.getElementById("graph");
const graphPanel = document.getElementById("graphPanel");
const colorControls = document.getElementById("colorControls");
const relBtn = document.getElementById("relBtn");
const graphLayoutSelect = document.getElementById("graphLayoutSelect");
const graphRefreshBtn = document.getElementById("graphRefreshBtn");
const uploadBtn = document.getElementById("uploadBtn");
const filePicker = document.getElementById("filePicker");
const uploadStatusPanel = document.getElementById("uploadStatusPanel");
const uploadStatusList = document.getElementById("uploadStatusList");
const uploadStatusCounter = document.getElementById("uploadStatusCounter");
const graphSelectionBox = document.getElementById("graphSelectionBox");
const graphSelectionLabel = document.getElementById("graphSelectionLabel");
const graphLabelInput = document.getElementById("graphLabelInput");
const graphCopyBtn = document.getElementById("graphCopyBtn");
const graphLabelSaveBtn = document.getElementById("graphLabelSaveBtn");
const graphDeleteBtn = document.getElementById("graphDeleteBtn");
const graphExportPdfBtn = document.getElementById("graphExportPdfBtn");
const graphExportXlsxBtn = document.getElementById("graphExportXlsxBtn");

// ----------- ESTADO GLOBAL -----------
let currentContacts = [];
let batch = [];
let currentCounts = { read:0, duplicates:0, countsMap:{} };
let isImportingFiles = false;
let settings = {
  theme: 'dark',
  anonymize: false,
  autosave: true,
  exportHistory: []
};
const MAX_UPLOAD_FILES = 10;
let uploadStatusItems = [];
let graphDataset = { nodes: [], edges: [], mode: 'none' };
let graphNodeMap = new Map();
let graphActiveMode = 'none';
let selectedGraphNode = null;
let graphPendingSelection = null;
const graphLabels = new Map();

// Zona horaria de referencia (UTC−5 sin DST)
const HLC_TZ = 'America/Bogota';

// Servicio (mantener en estado para exportar)
let currentServiceInfo = {
  serviceStart: "-",
  osBuild: "-",
  connState: "-",
  lastSeen: "-",
  lastSeenISO: "",  // ISO real de "Last seen" u "Online Since" en UTC
  lastSeenAgo: "-",
  lastIP: "-",
  lastPort: null,   // NUEVO
  isp: "-",
  ipVersion: "-",
  ipType: "-",
  city: "-",
  country: "-",
  countryCode: "-",
  flag: "",
  proxy: "No",
  vpn: "No",
  tor: "No",
  residentialRows: null // tabla calculada (incluye encabezado)
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
function randomColor(){
  return '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
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

// =================== ERRORES Y APRENDIZAJE ===================
const ERROR_STATS_KEY = 'v123_errorStats';
let errorStats = {};
try { errorStats = JSON.parse(localStorage.getItem(ERROR_STATS_KEY) || '{}'); } catch {}

function logError(code){
  errorStats[code] = (errorStats[code] || 0) + 1;
  try { localStorage.setItem(ERROR_STATS_KEY, JSON.stringify(errorStats)); } catch {}
}
function learnedMinDigits(){
  return (errorStats.shortNumbers && errorStats.shortNumbers > 5) ? 7 : 8;
}

function textToContacts(text){
  const matches = (text || "").match(/\d{7,}/g) || [];
  const clean = [];
  const minDigits = learnedMinDigits();
  for (let n of matches){
    n = stripCountry57(normalizeNumber(n));
    if (!n) continue;
    if (isYearLike(n)) continue;
    if (n.length < minDigits){ logError('shortNumbers'); continue; }
    clean.push(n);
  }
  const ai = getNormalizedObjective();
  return removeNumberAndUniq(clean, ai);
}
function countOccurrences(text){
  const matches = (text || "").match(/\d{7,}/g) || [];
  const map = Object.create(null);
  let readCount = 0;
  const minDigits = learnedMinDigits();
  for (let n of matches){
    n = stripCountry57(normalizeNumber(n));
    if (!n || isYearLike(n)) continue;
    if (n.length < minDigits){ logError('shortNumbers'); continue; }
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

// Fecha: formateo en zona sin restas manuales
function formatInTZ(dateLike, tz = HLC_TZ) {
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
  if (Number.isNaN(+d)) return "No encontrado";
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(d);
}
function formatUTC(dateLike){
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
  if (Number.isNaN(+d)) return "No encontrado";
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(d) + ' UTC';
}
function toHLCString(dateLike){ return formatInTZ(dateLike, HLC_TZ); }

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
    if (candidates.length === 0){ logError('zip_no_records'); return null; }
    const html = await candidates[0].async('string');
    const aiRaw = extractAccountIdentifierFromHtml(html);
    return { html, ai: aiRaw };
  }catch(err){
    logError('zip_read');
    console.error(err);
    return null;
  }
}

function renderUploadStatuses(){
  if (!uploadStatusList) return;
  uploadStatusList.innerHTML = '';
  if (!uploadStatusItems.length){
    const empty = document.createElement('p');
    empty.className = 'upload-status-empty';
    empty.textContent = 'Sin cargas registradas.';
    uploadStatusList.appendChild(empty);
    if (uploadStatusCounter) uploadStatusCounter.textContent = `0/${MAX_UPLOAD_FILES}`;
    return;
  }

  if (uploadStatusCounter) uploadStatusCounter.textContent = `${uploadStatusItems.length}/${MAX_UPLOAD_FILES}`;
  const statusLabels = { pending: 'Pendiente', processing: 'Procesando', done: 'Completado', error: 'Error' };

  uploadStatusItems.slice().reverse().forEach(item => {
    const row = document.createElement('div');
    row.className = `upload-item upload-item--${item.status || 'pending'}`;

    const top = document.createElement('div');
    top.className = 'upload-item__top';
    const nameEl = document.createElement('div');
    nameEl.className = 'upload-item__name';
    nameEl.textContent = item.name || 'Archivo';
    top.appendChild(nameEl);

    const state = document.createElement('div');
    state.className = 'upload-item__state';
    if (item.status === 'processing'){
      const spinner = document.createElement('span');
      spinner.className = 'upload-item__spinner';
      spinner.setAttribute('aria-hidden', 'true');
      state.appendChild(spinner);
    }
    const label = document.createElement('span');
    label.textContent = statusLabels[item.status] || statusLabels.pending;
    state.appendChild(label);
    top.appendChild(state);
    row.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'upload-item__meta';

    const contactBadge = document.createElement('span');
    contactBadge.className = 'upload-item__badge';
    const hasContacts = typeof item.contactCount === 'number' && item.contactCount > 0;
    if (hasContacts) contactBadge.classList.add('is-ok');
    else if (item.status !== 'processing') contactBadge.classList.add('is-empty');
    contactBadge.textContent = hasContacts
      ? `📇 ${item.contactCount} contacto${item.contactCount === 1 ? '' : 's'}`
      : '📇 Sin contactos';
    meta.appendChild(contactBadge);

    const ipBadge = document.createElement('span');
    ipBadge.className = 'upload-item__badge';
    if (item.ip){
      ipBadge.classList.add('is-ok');
      ipBadge.textContent = `🌐 ${item.ip}`;
    } else if (item.status !== 'processing') {
      ipBadge.classList.add('is-empty');
      ipBadge.textContent = '🌐 Sin IP';
    } else {
      ipBadge.textContent = '🌐 Analizando…';
    }
    meta.appendChild(ipBadge);

    if (typeof item.duplicates === 'number'){
      const dupBadge = document.createElement('span');
      dupBadge.className = 'upload-item__badge';
      dupBadge.textContent = `🔁 ${item.duplicates} duplicado${item.duplicates === 1 ? '' : 's'}`;
      meta.appendChild(dupBadge);
    }

    row.appendChild(meta);

    if (item.message){
      const msg = document.createElement('p');
      msg.className = 'upload-item__msg';
      msg.textContent = item.message;
      row.appendChild(msg);
    }

    uploadStatusList.appendChild(row);
  });
}

function addUploadStatusEntry(file){
  const entry = {
    id: `upl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file?.name || 'Archivo',
    status: 'pending',
    contactCount: null,
    duplicates: null,
    ip: null,
    message: ''
  };
  uploadStatusItems.push(entry);
  if (uploadStatusItems.length > MAX_UPLOAD_FILES){
    uploadStatusItems = uploadStatusItems.slice(uploadStatusItems.length - MAX_UPLOAD_FILES);
  }
  renderUploadStatuses();
  return entry;
}

function updateUploadStatusEntry(entry, patch){
  if (!entry) return;
  Object.assign(entry, patch || {});
  renderUploadStatuses();
}

function resetUploadTracking(){
  uploadStatusItems = [];
  renderUploadStatuses();
}

async function processSingleUploadedFile(file){
  if (!file) throw new Error('Archivo inválido');
  const name = file.name || 'Archivo';
  if (/\.zip$/i.test(name)){
    const res = await processZipFile(file);
    if (!res || !res.html) throw new Error('zip_invalido');
    const ai = res.ai ? stripCountry57(normalizeNumber(res.ai)) : null;
    return finalizeProcessedUpload(res.html, ai, name);
  }
  if (/\.(txt|csv|html?)$/i.test(name)){
    const raw = await readFileAsText(file);
    const aiRaw = extractAccountIdentifierFromHtml(raw || '');
    const ai = aiRaw ? stripCountry57(normalizeNumber(aiRaw)) : null;
    return finalizeProcessedUpload(raw, ai, name);
  }
  throw new Error('tipo_no_soportado');
}

function finalizeProcessedUpload(raw, accountId, name){
  if (!raw) throw new Error('contenido_vacio');
  const sanitized = sanitizeSource(raw);
  const contacts = textToContacts(sanitized);
  const counts = countOccurrences(sanitized);
  const ipInfo = parseIPAndPortFromText(raw);
  const ipShown = ipInfo ? (ipInfo.port != null ? `${ipInfo.ip}:${ipInfo.port}` : ipInfo.ip) : null;
  return {
    name,
    raw,
    sanitized,
    contacts,
    counts,
    accountId,
    ipInfo,
    ipShown
  };
}

function applyProcessedUpload(result){
  if (!result) return;
  inputText.value = result.raw || '';
  if (result.accountId){
    accountIdEl.value = stripCountry57(normalizeNumber(result.accountId));
  }
  currentContacts = Array.isArray(result.contacts) ? result.contacts : [];
  currentCounts = result.counts || { read:0, duplicates:0, countsMap:{} };
  renderPreview();
  extractServiceInfoFromSource(result.raw);
}

async function handleDroppedFiles(fileList){
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return false;

  const validFiles = incoming.filter(f => f && (/(\.zip)$/i.test(f.name || '') || /\.(txt|csv|html?)$/i.test(f.name || '')));
  if (!validFiles.length){
    const msg = 'No se detectaron archivos compatibles. Arrastra un .zip con records.html o .txt/.csv/.html.';
    alert(errorStats.no_files > 1 ? `${msg} Revisa que sean archivos válidos.` : msg);
    return false;
  }

  if (isImportingFiles){
    alert('Ya hay una importación en curso. Espera a que finalice.');
    return false;
  }

  const availableSlots = MAX_UPLOAD_FILES - uploadStatusItems.length;
  if (availableSlots <= 0){
    alert('Has alcanzado el límite de 10 archivos en el historial. Usa "Limpiar" para reiniciar.');
    return false;
  }

  let files = validFiles;
  if (validFiles.length > availableSlots){
    alert(`Solo se procesarán ${availableSlots} archivo${availableSlots === 1 ? '' : 's'} por el límite activo.`);
    files = validFiles.slice(0, availableSlots);
  }

  isImportingFiles = true;
  if (dropZone) dropZone.classList.add('processing');

  const previousAccountId = accountIdEl ? accountIdEl.value : '';
  let anySuccess = false;
  let lastSuccessful = null;

  try {
    for (const file of files){
      const entry = addUploadStatusEntry(file);
      updateUploadStatusEntry(entry, { status: 'processing', message: 'Leyendo archivo…' });
      try {
        const result = await processSingleUploadedFile(file);
        updateUploadStatusEntry(entry, { message: 'Validando crédito…' });
        const ok = await requestCredit();
        if (!ok){
          updateUploadStatusEntry(entry, {
            status: 'error',
            message: 'No se pudo consumir un crédito. Verifica tu sesión o tus créditos disponibles.'
          });
          continue;
        }
        applyProcessedUpload(result);
        anySuccess = true;
        lastSuccessful = result;
        updateUploadStatusEntry(entry, {
          status: 'done',
          contactCount: result.contacts.length,
          duplicates: result.counts.duplicates || 0,
          ip: result.ipShown || null,
          message: result.contacts.length
            ? `Contactos únicos: ${result.contacts.length}. Duplicados: ${result.counts.duplicates || 0}.`
            : 'Sin contactos válidos.'
        });
      } catch (error) {
        console.error('Error procesando archivo', error);
        updateUploadStatusEntry(entry, {
          status: 'error',
          message: 'No se pudo procesar este archivo. Verifica el contenido.'
        });
      }
    }

    if (!anySuccess){
      if (accountIdEl) accountIdEl.value = previousAccountId;
      return false;
    }

    if (lastSuccessful && lastSuccessful.accountId){
      accountIdEl.value = stripCountry57(normalizeNumber(lastSuccessful.accountId));
    }

    alert(files.length > 1 ? 'Carga múltiple finalizada. Revisa la vista previa.' : 'Archivo cargado y listo en la vista previa.');
    return true;
  } finally {
    if (dropZone) dropZone.classList.remove('processing');
    isImportingFiles = false;
  }
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
function updateRelBtn(){
  if(!relBtn) return;
  const disable = (batch.length === 0 && currentContacts.length === 0);
  relBtn.disabled = disable;
  if(disable && graphPanel){
    graphPanel.classList.remove('fullscreen');
    relBtn.textContent='Pantalla completa';
  }
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
  updateRelBtn();
  downloadBtn.disabled = currentContacts.length === 0;
  renderRelations();
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
  updateRelBtn();
  renderColorControls();
  renderRelations();
}

function renderColorControls(){
  if(!colorControls) return;
  colorControls.innerHTML="";
  batch.forEach(item=>{
    const wrap=document.createElement('div');
    wrap.className='color-item';
    const label=document.createElement('span');
    label.textContent=item.objective||'—';
    const inp=document.createElement('input');
    inp.type='color';
    const val=item.color||randomColor();
    item.color=val;
    inp.value=val;
    inp.addEventListener('input',()=>{ item.color=inp.value; renderBatchGraph(); saveLocal(); });
    wrap.appendChild(label); wrap.appendChild(inp);
    colorControls.appendChild(wrap);
  });
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
const LS = { settings: 'v122_settings', batch: 'v122_batch', history: 'v122_history' };
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
    service: serviceSnapshot,
    color: randomColor()
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
  extractServiceInfoFromSource(null); // reset panel
  resetUploadTracking();
});

clearBatchBtn.addEventListener("click", () => {
  if (!confirm("¿Vaciar lote?")) return;
  batch=[]; renderBatch();
});

showAllEl.addEventListener("change", () => { renderPreview(); });
previewFilter.addEventListener("input", () => { renderPreview(); });
sortSelect.addEventListener("change", () => { renderPreview(); });

themeToggle.addEventListener("change", ()=>{
  settings.theme=themeToggle.checked?'light':'dark';
  document.body.setAttribute('data-theme', settings.theme);
  saveLocal();
  renderRelations();
});
anonToggle.addEventListener("change", ()=>{ settings.anonymize=anonToggle.checked; saveLocal(); renderPreview(); });
autosaveToggle.addEventListener("change", ()=>{ settings.autosave=autosaveToggle.checked; saveLocal(); });

downloadBtn.addEventListener("click", () => {
  if (!currentContacts.length){ alert("No hay contactos."); return; }

  try {
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

    // Hoja Residencial (si aplica)
    const resRows = getResidentialRowsForCurrent();

    // 👇 Declarar primero y luego agregar la hoja Residencial
    const sheets = { "Datos": rowsDatos, "Resumen": rowsResumen, "Servicio": rowsServicio };
    if (resRows) sheets["Residencial"] = resRows;

    // Si no hay un formato seleccionado, por defecto XLSX
    const wantsXlsx = fmtXlsx?.checked ?? true;
    const wantsCsv  = fmtCsv?.checked  ?? false;
    const wantsJson = fmtJson?.checked ?? false;

    if (wantsXlsx) downloadWB(`${objective}_contacts_${ts}.xlsx`, sheets);
    if (wantsCsv)  downloadCsv(`${objective}_contacts_${ts}.csv`, rowsDatos);
    if (wantsJson) downloadJson(`${objective}_contacts_${ts}.json`, {
      datos: rowsDatos.slice(1).map(r=>({ contacto:r[0],objetivo:r[1],caso:r[2] })),
      resumen: Object.fromEntries(rowsResumen.slice(1)),
      servicio: Object.fromEntries(rowsServicio.slice(1)),
      residencial: resRows || null
    });

    pushHistory({ ts, filename: `${objective}_contacts_${ts}`, total: currentCounts.read, unique: currentContacts.length });

  } catch (err) {
    console.error("Error en exportación:", err);
    alert("Hubo un error al preparar la descarga. Revisa la consola para más detalles.");
  }
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

  // Residencial (por cada item residencial del lote)
  const rowsResidencial = getResidentialRowsForBatch();

  const sheets = { "Datos":rows, "Resumen":summary, "Servicio": rowsServicios };
  if (rowsResidencial) sheets["Residencial"] = rowsResidencial;

  if (fmtXlsx.checked) downloadWB(`unificado_contacts_${ts}.xlsx`, sheets);
  if (fmtCsv.checked) downloadCsv(`unificado_contacts_${ts}.csv`, rows);
  if (fmtJson.checked) downloadJson(`unificado_contacts_${ts}.json`, {
    datos:rows.slice(1).map(r=>({contacto:r[0],objetivo:r[1],caso:r[2]})),
    resumen:Object.fromEntries(summary.slice(1)),
    servicio_tabular: rowsServicios,
    residencial: rowsResidencial || null
  });
  pushHistory({ ts, filename:`unificado_contacts_${ts}`, total:rows.length-1, unique:rows.length-1 });
});

// Copiar tabla residencial
copyResTableBtn?.addEventListener("click", async () => {
  const rows = currentServiceInfo.residentialRows;
  if (!rows || rows.length <= 1) { alert("No hay tabla para copiar."); return; }
  const tsv = rows.map(r => r.join('\t')).join('\n');
  try{
    await navigator.clipboard.writeText(tsv);
    alert("Tabla copiada al portapapeles.");
  }catch{
    const ta = document.createElement('textarea');
    ta.value = tsv; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); alert("Tabla copiada al portapapeles."); }catch{}
    ta.remove();
  }
});

// =================== DRAG & DROP ===================
if (dropZone){
  let dragCounter = 0;
  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); dragCounter++; dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dragCounter--; if (dragCounter <= 0) dropZone.classList.remove('dragging'); });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragging'); dragCounter = 0;
    const dt = e.dataTransfer; if (!dt) return;
    if (dt.files && dt.files.length){
      await handleDroppedFiles(dt.files);
    } else alert("Suelta archivos válidos (.zip con records.html, o .txt/.csv/.html).");
  });
}

// =================== SUBIR ARCHIVOS (input[file]) ===================
if (uploadBtn && filePicker){
  uploadBtn.addEventListener('click', () => { filePicker.click(); });
  filePicker.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length){
      await handleDroppedFiles(files);
    }
    filePicker.value = "";
  });
}

/* =================== PANEL SERVICIO — EXTRACCIÓN =================== */
const lbls = {
  serviceStart: [/^service\s*start$/i, /^inicio\s+del\s+servicio$/i, /^start\s+of\s*service$/i],
  osBuild: [/^device\s*os\s*build\s*number$/i, /^os\s*build\s*number$/i, /^n[úu]mero\s+de\s+compilaci[óo]n/i],
  connStat: [/^connection\s*state$/i, /^connection\s*stat$/i, /^estado\s+de\s+la\s+conexi[óo]n$/i],
  lastSeen: [/^last\s*seen$/i, /^[úu]ltim[ao]\s+vez\s+vist[oa]$/i, /^last\s+active$/i],
  lastIp: [/^last\s*ip$/i, /^[úu]ltim[ao]\s+ip$/i],
  // NUEVOS labels
  onlineSince: [/^online\s*since$/i, /^en\s*linea\s*desde$/i, /^conectad[oa]\s*desde$/i],
  connectedFrom: [/^connected\s*from$/i, /^conectad[oa]\s*desde$/i]
};

const RX = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}\b/g,
  // ipv6 general (no usar directamente para extraer con puerto)
  ipv6_general: /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi,
  ddmmyyyy_hms: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*UTC|Z)?\b/i,
  iso: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z| ?UTC)?\b/i
};

// Helpers para hora tipo 16:19:05 (evitar confundir con IPv6)
function isClockLike(s){
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(s).trim());
}
function hasAtLeastTwoColons(s){
  const c = (String(s).match(/:/g) || []).length;
  return c >= 2;
}

// Parse flexible de fechas
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
    const rx = new RegExp(`${re.source}[^\S\n\r]*[:：]?\s*([^\n\r<]+)`, 'i');
    const m = text.match(rx);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

// --------- NUEVO: parser robusto de IP + puerto ---------
function parseIPAndPortFromText(txt){
  if (!txt) return null;
  const s = String(txt);

  // Evitar líneas "Generated: HH:MM(:SS)" para IP parsing
  const safe = s.split(/\r?\n/).filter(line => !/^\s*Generated\s*:/i.test(line)).join("\n");

  // IPv4 con puerto
  let m = safe.match(/\b(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\b/);
  if (m) return { ip: m[1], port: parseInt(m[2],10), version: 4 };

  // IPv4 simple
  m = safe.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
  if (m) return { ip: m[1], port: null, version: 4 };

  // IPv6 con corchetes + puerto
  m = safe.match(/\[([0-9a-fA-F:]+)\]:(\d{1,5})/);
  if (m) {
    const ip6 = m[1];
    if (!isClockLike(ip6) && hasAtLeastTwoColons(ip6)) {
      return { ip: ip6, port: parseInt(m[2],10), version: 6 };
    }
  }

  // IPv6 sin corchetes pero con puerto (último bloque numérico 1–5 dígitos)
  m = safe.match(/([0-9a-fA-F:]+):(\d{1,5})(?:\b|$)/);
  if (m && m[1].includes(":")) {
    const ip6 = m[1];
    if (!isClockLike(ip6) && hasAtLeastTwoColons(ip6)) {
      return { ip: ip6, port: parseInt(m[2],10), version: 6 };
    }
  }

  // IPv6 simple (evita capturar horas)
  const mAll = safe.match(/\b([0-9a-fA-F:]{2,})\b/g) || [];
  for (const cand of mAll){
    if (cand.includes(":") && !isClockLike(cand) && hasAtLeastTwoColons(cand)) {
      return { ip: cand, port: null, version: 6 };
    }
  }

  return null;
}

function extractIPStructured(doc, patterns){
  // 1) intentar de estructura
  const val = findValueByStructuredLabels(doc, patterns);
  if (val){
    const parsed = parseIPAndPortFromText(val);
    if (parsed) return parsed;
  }

  // 2) buscar 200 chars alrededor del label
  const html = doc.body ? (doc.body.innerText || doc.body.textContent || "") : "";
  for (const re of patterns){
    const m = html.match(new RegExp(`${re.source}[\\s\\S]{0,200}`, 'i'));
    if (m){
      const seg = m[0];
      const parsed2 = parseIPAndPortFromText(seg);
      if (parsed2) return parsed2;
    }
  }

  // 3) fallback global
  const parsed3 = parseIPAndPortFromText(html);
  if (parsed3) return parsed3;

  return null;
}

function setText(el, val){ if (el) el.textContent = (val == null || val === "") ? "No encontrado" : String(val); }

/* ====== setters que sincronizan UI y estado ====== */
function setServiceStart(dateStrOrObj){
  if (!serviceStartEl) return;
  let disp = "No encontrado";
  if (dateStrOrObj){
    const d = dateStrOrObj instanceof Date ? new Date(dateStrOrObj) : parseFlexibleDate(dateStrOrObj);
    if (d && !Number.isNaN(+d)) disp = formatInTZ(d);
  }
  setText(serviceStartEl, disp);
  currentServiceInfo.serviceStart = disp;
}

const GREEN_STATES_RX = /^(online|connected|en\s*línea|conectad[oa])$/i;
function setConnState(val){
  const v = (val && String(val).trim()) || "No encontrado";
  setText(connStatEl, v);
  connStatEl?.classList.remove('red','green');
  if (v !== "No encontrado" ){
    if (GREEN_STATES_RX.test(v)) connStatEl?.classList.add('green');
    else connStatEl?.classList.add('red');
  }
  currentServiceInfo.connState = v;
}

function setOSBuild(val){ const v = (val && String(val).trim()) || "No encontrado"; setText(osBuildEl, v); currentServiceInfo.osBuild = v; }

function setLastIp(val){
  const v = (val && String(val).trim()) || "No encontrado";
  setText(lastIpEl, v);
  // currentServiceInfo.lastIP se setea desde quien llama (para mantener ip/port separados)
}

function setISP(val){ const v = (val && String(val).trim()) || "No encontrado"; setText(ispEl, v); currentServiceInfo.isp = v; }
function setIPVersion(val){ const v = (val && String(val).trim()) || "No encontrado"; setText(ipVersionEl, v); currentServiceInfo.ipVersion = v; }
function setIPType(val){
  const v = (val && String(val).trim()) || "No encontrado";
  setText(ipTypeEl, v);
  currentServiceInfo.ipType = v;
  updateResidentialSection(); // actualizar visibilidad/tabla
}

// 🔹 NUEVO: setter para el puerto
function setIPPort(portVal){
  if (!ipPortEl) return;
  const v = (portVal == null || portVal === "") ? "No encontrado" : String(portVal);
  setText(ipPortEl, v);
  const asNum = Number(portVal);
  currentServiceInfo.lastPort = (portVal == null || portVal === "") ? null : (Number.isNaN(asNum) ? String(portVal) : asNum);
}

// Ciudad / País / Chips
function setCity(val){ const v = (val && String(val).trim()) || "No encontrado"; setText(cityEl, v); currentServiceInfo.city = v; }
function countryCodeToEmoji(cc){ if (!cc || cc.length !== 2) return ""; const A=127397; return String.fromCodePoint(...cc.toUpperCase().split("").map(c => c.charCodeAt(0)+A)); }
function setCountry(countryCode, countryName, flagEmoji){
  const code = (countryCode || "").toUpperCase();
  const flag = flagEmoji || countryCodeToEmoji(code);
  const label = [flag, countryName || code || "No encontrado"].filter(Boolean).join(" ");
  setText(countryEl, label || "No encontrado");
  currentServiceInfo.country = countryName || code || "No encontrado";
  currentServiceInfo.countryCode = code || "-";
  currentServiceInfo.flag = flag || "";
}
function renderSecurityChips({ proxy=false, vpn=false, tor=false }){
  if (!secChipsEl) return;
  const mk = (kind, on) => `<span class="chip tiny ${on ? 'on' : 'dim'}">${kind.toUpperCase()}: ${on?'Sí':'No'}</span>`;
  secChipsEl.innerHTML = `${mk('proxy', !!proxy)} ${mk('vpn', !!vpn)} ${mk('tor', !!tor)}`;
}
function setSecurityFlags(proxy, vpn, tor){
  const p = !!proxy, v = !!vpn, t = !!tor;
  renderSecurityChips({ proxy:p, vpn:v, tor:t });
  currentServiceInfo.proxy = p ? "Sí" : "No";
  currentServiceInfo.vpn   = v ? "Sí" : "No";
  currentServiceInfo.tor   = t ? "Sí" : "No";
}

// Humanizar diferencia
function humanizeDiffEs(ms){
  const abs = Math.abs(ms);
  const s = Math.round(abs/1000);
  const m = Math.round(abs/60000);
  const h = Math.round(abs/3600000);
  const d = Math.round(abs/86400000);
  if (d >= 1) return `${d} día${d!==1?'s':''}`;
  if (h >= 1) return `${h} hora${h!==1?'s':''}`;
  if (m >= 1) return `${m} minuto${m!==1?'s':''}`;
  return `${s} segundo${s!==1?'s':''}`;
}
function setLastSeenAgo(dateObj){
  if (!lastSeenAgoEl) return;
  if (!(dateObj instanceof Date) || Number.isNaN(+dateObj)) {
    setText(lastSeenAgoEl, "No encontrado");
    currentServiceInfo.lastSeenAgo = "No encontrado";
    return;
  }
  const now = new Date();
  const diff = now - dateObj;
  const phrase = diff >= 0 ? `hace ${humanizeDiffEs(diff)}` : `en ${humanizeDiffEs(diff)}`;
  setText(lastSeenAgoEl, phrase);
  currentServiceInfo.lastSeenAgo = phrase;
}

// Regla: rojo si la fecha es anterior a ahora; verde si igual/posterior
function setLastSeen(dateStrOrObj){
  if (!lastSeenEl) return;
  lastSeenEl.classList.remove('red','green');
  let disp = "No encontrado";
  let parsed = null;

  if (dateStrOrObj){
    parsed = dateStrOrObj instanceof Date ? new Date(dateStrOrObj) : parseFlexibleDate(dateStrOrObj);
    if (parsed && !Number.isNaN(+parsed)){
      disp = formatInTZ(parsed); // UTC−5 pantalla
      const now = new Date();
      if (parsed < now) lastSeenEl.classList.add('red'); else lastSeenEl.classList.add('green');
    }
  }
  setText(lastSeenEl, disp);
  currentServiceInfo.lastSeen = disp;
  currentServiceInfo.lastSeenISO = parsed ? parsed.toISOString() : "";
  setLastSeenAgo(parsed);
  updateResidentialSection(); // por si ya hay IP y tipo
}

/* ===== Clasificación de tipo de IP (Listas ampliadas + lógica robusta) ===== */
// Marcas que SOLO ofrecen acceso fijo (HFC/FTTH/xDSL/MetroE, etc.)
const FIXED_ONLY_ISPS = [
  // CO (fijo)
  "etb","emcali","internexa","anditel","metrotel","azteca comunicaciones",
  "media commerce","telebucaramanga","ibague telecom","columbus",
  // MX (fijo)
  "telmex","axtel","totalplay","izzi","megacable",
  // AR (fijo)
  "telecentro","iplan","fibertel","flow fibra","cooperativa electrica",
  // CL (fijo)
  "vtr","gtd","mundo pacifico","mundo fibra","telsur",
  // PE (fijo)
  "win peru","optical networks","wow peru","americatel peru",
  // UY / PY / BO / EC (fijo)
  "antel fibra","copaco","entel bolivia fibra","cnt fibra",
  // US (fijo)
  "comcast","xfinity","charter","spectrum","cox","frontier","centurylink","lumen",
  "consolidated communications","windstream","mediacom","optimum","suddenlink",
  "rcn","astound broadband","grande communications","wave broadband",
  "wow internet cable","breezeline","atlantic broadband",
  "google fiber","sonic.net","metronet","ziply fiber",
  "epb fiber optics","altafiber","cincinnati bell","utopia fiber",
  "sparklight","cable one","midco","gci","alaska communications",
  "tds telecom","armstrong","northstate","hargray","allegiance communications",
  "valley fiber","point broadband","tachus","fidium","brightspeed",
  "rcn telecom services",
  // CA (fijo)
  "teksavvy","distributel","oxio","start.ca","ebox","novus","cogeco","eastlink",
  // UK / IE (fijo)
  "openreach","cityfibre","community fibre","hyperoptic","gigaclear","giganet",
  "toob","trooli","f&w networks","lightspeed broadband","brsk","zzoomm",
  "swish fibre","grain connect","kcom","kcom lightstream","zen internet",
  "origin broadband","plusnet broadband","sky broadband","talktalk broadband",
  "eir fibre","siro",
  // DE (fijo)
  "deutsche glasfaser","m-net","netcologne","pyur","tele columbus",
  "wilhelm.tel","willy.tel","ewetel","swb","deutsche giga netz","deutsche glasnetz",
  // FR (fijo)
  "orange fibre","freebox fibre","sfr fibre","bouygues fibre","k-net","wibox","videofutur",
  // IT (fijo)
  "open fiber","eolo","linkem","tiscali fibra","fastweb fibra",
  // ES (fijo)
  "adamo","digi fibra","pepephone fibra","finetwork fibra","avatel","mundo r","euskaltel",
  // PT (fijo)
  "nowo","vodafone fibra pt","meo fibra","nos fibra",
  // NL (fijo)
  "delta fiber","caiway","glasvezel buitenaf","odido thuis","kpn netwerk",
  // Nordics (fijo)
  "bahnhof","bredband2","ownit","open universe","fibianet","fibia",
  "stadsnat","stadsnät","tampnet","altibox","lyse fiber","nornett",
  // BE / CH / AT (fijo)
  "telenet cable","proximus fiber","init7","quickline","green.ch","ewz zurinet","liwest",
  // PL / CZ / HU / RO (fijo)
  "netia","inea","vectra","multimedia polska","upc polska",
  "rcs rds","digi fiber ro","telekom romania fija","romtelecom",
  // Bálticos / Balcanes (fijo, ejemplos)
  "tet latvia","telia lietuva fiber","sbb","telekom srbije fiber"
];

// Marcas que tienen fijo y móvil bajo el mismo paraguas (mixto)
const MIXED_BRANDS = ["claro","comcel","movistar","tigo","une"];

// Marcas móviles (MNO/MVNO). Si aparece, se fuerza “celular”.
const MOBILE_BRANDS = [
  // LatAm
  "claro","comcel","telcel","movistar","entel","tigo","personal","vivo","tim brasil","wom",
  "bitel","cnt movil","antel celular","virgin mobile","tuenti","flash mobile",
  // US / CA
  "verizon wireless","t-mobile","at&t mobility","us cellular","cricket wireless","boost mobile",
  "metro by t-mobile","tracfone","straight talk","visible","google fi",
  "xfinity mobile","spectrum mobile",
  "rogers wireless","bell mobility","telus mobility","freedom mobile","videotron mobile",
  "fido","koodo","public mobile","chatr","lucky mobile",
  // UK / IE
  "ee","o2","three","3","vodafone","giffgaff","lebara","lycamobile",
  "tesco mobile","sky mobile","bt mobile","virgin mobile uk","id mobile",
  // FR
  "orange","sfr","bouygues telecom","free mobile","iliad",
  // ES / PT
  "yoigo","masmovil","pepephone","simyo","lowi","o2 españa","jazztel movil","finetwork","digi mobil",
  "nos movel","vodafone pt","moche","meo movel",
  // DE / AT / CH
  "deutsche telekom","telekom","t-mobile de","o2 de","telefonica de","vodafone de",
  "magenta at","a1 telekom austria","drei at","swisscom","sunrise","salt",
  // Nordics / Baltics
  "telia","telenor","tele2","elisa","dna","bite","lmt",
  // BE / NL
  "proximus","base","telenet mobile","vodafone nl","kpn mobile","odido mobile","ben","lebara nl",
  // IT
  "tim","vodafone it","windtre","iliad it","poste mobile","coopvoce","ho. mobile","very mobile","kena mobile",
  // PL / CZ / SK / HU / RO
  "orange polska","plus","play","t-mobile pl","heyah","nju mobile",
  "o2 czech","vodafone cz",
  "o2 slovensko","telekom sk","4ka",
  "vodafone hu","telekom hu","yettel hu",
  "orange romania","vodafone romania","telekom romania mobil","digi mobil",
  // Balkans / TR / GR / CY
  "a1","vip mobile","mt:s","telenor srbija","one telecom mk","m:tel","bh telecom",
  "turkcell","turk telekom","vodafone tr",
  "cosmote","vodafone gr","wind hellas","cyta","epic cy","primetel",
  // Africa / Middle East
  "mtn","airtel","glo mobile","9mobile","vodacom","cell c","rain","telkom mobile",
  "safaricom","ooredoo","stc","zain","mobily","du","etisalat","e&",
  // Asia / Oceania
  "ntt docomo","docomo","kddi","au","softbank","rakuten mobile",
  "china mobile","china unicom","china telecom",
  "reliance jio","jio","airtel india","vi india","bsnl","mtnl",
  "dtac","ais","true move h",
  "telkomsel","xl axiata","indosat ooredoo","smartfren",
  "viettel","mobifone","vinaphone",
  "sk telecom","kt","lg u+",
  "chunghwa telecom","taiwan mobile","far eastone","t star",
  "telstra","optus","vodafone au","tpg mobile","boost au",
  "spark","2degrees","skinny"
];

function normalizeStr(s){
  return String(s||"")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function ispMatch(haystack, list){
  const s = normalizeStr(haystack);
  return list.some(x => s.includes(normalizeStr(x)));
}
function classifyType(baseType, ispOrg, hints){
  const base = normalizeStr(baseType);
  const isp  = normalizeStr(ispOrg);
  const txt  = normalizeStr([baseType, ispOrg, hints].filter(Boolean).join(" "));

  const isFixedOnly     = ispMatch(isp, FIXED_ONLY_ISPS);
  const isMixedBrand    = ispMatch(isp, MIXED_BRANDS);
  const isMobileBrand   = ispMatch(isp, MOBILE_BRANDS);

  const hasMobileClues =
    /\b(apn|epc|ims|3gpp|mnc\d{2,3}|mcc\d{2,3}|lte|4g|5g|umts|hspa|gprs|edge|wap|cell|celular|movil|mobile)\b/.test(txt);

  const hasHostingClues =
    /\b(aws|amazon|ec2|compute|gcp|1e100\.net|cloudflare|azure|microsoft|digitalocean|ovh|kimsufi|soyoustart|hetzner|contabo|linode|vultr|oracle|oci|akamai|fastly|leaseweb|scaleway|aruba|rackspace|colo|colocation|datacenter|vps|server|cloud|cdn|dc-)\b/.test(txt);

  const hasResidentialClues =
    /\b(residential|residencial|home|hogar|ftth|hfc|adsl|xdsl|cable|fiber|fibra|pppoe|pool|dynamic|dhcp|customer|cust|subscriber|user)\b/.test(txt);

  const hasEnterpriseClues =
    /\b(business|empresa|corporate|corp|empresarial|b2b|static[-\s]?ip|ip\s*fija|ip\s*fixa|dedicated|enlace\s*de\s*datos|metroethernet|mpls)\b/.test(txt);

  if (isMobileBrand || hasMobileClues) return "celular";
  if (hasEnterpriseClues && !hasResidentialClues) return "empresa";
  if (isFixedOnly && !hasMobileClues) return "residencial";

  if (isMixedBrand){
    if (hasMobileClues) return "celular";
    if (hasResidentialClues) return "residencial";
    return "residencial";
  }

  if (hasHostingClues) return "celular";
  if (hasResidentialClues) return "residencial";
  return "residencial";
}

/* ====== consulta IP + clasificación ====== */
async function fetchJSONWithTimeout(url, timeoutMs = 6000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }finally{
    clearTimeout(t);
  }
}
const pickFirst = (...vals) => vals.find(v => v != null && v !== "") || "";

/* ==== caché simple por IP (memoria) ==== */
const ipCache = new Map();

/* ====== consulta IP + clasificación (reforzada) ====== */
async function lookupIP(ip){
  if (!ip || ip === "No encontrado" || ip === "-") return;
  // No pasar puerto aquí; ya recibimos sólo la IP "pura".
  const ipOnly = String(ip);

  // caché
  if (ipCache.has(ipOnly)){
    const c = ipCache.get(ipOnly);
    setISP(c.isp || "No encontrado");
    setIPVersion(c.version || (/:/.test(ipOnly) ? "IPv6":"IPv4"));
    setIPType(classifyType(c.baseType || "", c.isp || "", c.hints || ""));
    setCity(c.city || "No encontrado");
    setCountry(c.countryCode || "", c.countryName || "", c.flag || "");
    setSecurityFlags(!!c.proxy, !!c.vpn, !!c.tor);
    return;
  }

  try{
    // disparamos en paralelo con tolerancia a fallos
    const [r1, r2, r3] = await Promise.allSettled([
      fetchJSONWithTimeout(`https://ipwho.is/${encodeURIComponent(ipOnly)}`, 6500),
      fetchJSONWithTimeout(`https://ipwhois.app/json/${encodeURIComponent(ipOnly)}`, 6500),
      fetchJSONWithTimeout(`https://ipapi.co/${encodeURIComponent(ipOnly)}/json/`, 6500)
    ]);

    const d1 = (r1.status==="fulfilled" && r1.value && r1.value.success!==false) ? r1.value : null; // ipwho.is
    const d2 = (r2.status==="fulfilled" && r2.value && !r2.value.error) ? r2.value : null;         // ipwhois.app
    const d3 = (r3.status==="fulfilled" && r3.value && !r3.value.error) ? r3.value : null;         // ipapi.co

    // ISP/ORG
    const isp = pickFirst(
      d1?.connection?.isp, d1?.isp, d1?.org,
      d2?.isp, d2?.org,
      d3?.org
    ) || "No encontrado";

    // versión
    const version = pickFirst(
      d1?.type,
      d2?.type,
      (/:/.test(ipOnly) ? "IPv6" : "IPv4")
    );

    // país / ciudad / bandera
    const countryName = pickFirst(d1?.country, d2?.country, d3?.country_name, d3?.country) || "";
    const countryCode = (pickFirst(d1?.country_code, d1?.countryCode, d2?.country_code, d2?.country_code2, d3?.country_code) || "").toUpperCase();
    const city        = pickFirst(d1?.city, d2?.city, d3?.city) || "";
    const flagEmoji   = d1?.flag?.emoji || "";

    // rDNS / hostname / ASN pistas
    const rdns = pickFirst(d1?.reverse, d1?.rdns, d2?.reverse, d3?.hostname);
    const asn  = pickFirst(d2?.asn, d3?.asn);           // ej. "AS1234"
    const org  = pickFirst(d2?.org, d1?.org, d3?.org);  // organización

    // tipos que dicen los proveedores (p. ej. "mobile", "business", etc.)
    const providerTypeStr = [
      pickFirst(d1?.connection?.type, d1?.type),
      pickFirst(d2?.type, ""),
    ].filter(Boolean).join(" | ");

    // seguridad (combinamos si hay)
    const sec1 = d1?.security || d1?.privacy || {};
    const proxy = !!(sec1?.proxy ?? sec1?.is_proxy ?? d1?.proxy ?? false);
    const vpn   = !!(sec1?.vpn   ?? sec1?.is_vpn   ?? d1?.vpn   ?? false);
    const tor   = !!(sec1?.tor   ?? sec1?.is_tor   ?? d1?.tor   ?? false);

    // hints para clasificar (juntamos rDNS/hostname + org + ASN + el tipo)
    const hints = [rdns, org, asn, providerTypeStr].filter(Boolean).join(" ");

    // clasificación final
    const finalType = classifyType(providerTypeStr, isp, hints);

    // set en UI
    setISP(isp || "No encontrado");
    setIPVersion(version || (/:/.test(ipOnly) ? "IPv6":"IPv4"));
    setIPType(finalType);
    setCity(city || "No encontrado");
    setCountry(countryCode || "", countryName || "", flagEmoji || "");
    setSecurityFlags(proxy, vpn, tor);

    // guarda en caché
    ipCache.set(ipOnly, {
      isp, version, baseType: providerTypeStr, hints,
      city, countryName, countryCode, flag: flagEmoji,
      proxy, vpn, tor
    });

  }catch(err){
    console.error("Error consultando IP:", err);
    // Mínimo: mostrar versión y mantener resto con guiones
    setIPVersion(/:/.test(ipOnly) ? "IPv6":"IPv4");
  }
}

// ====== RESET PANEL (NUEVO) ======
function resetServicePanel(){
  setServiceStart(null);
  setOSBuild("No encontrado");
  setConnState("No encontrado");
  setLastSeen(null);
  setLastIp("No encontrado");
  setIPPort(null); // 🔹 limpia puerto en UI y estado
  setISP("No encontrado");
  setIPVersion("No encontrado");
  setIPType("No encontrado");
  setCity("No encontrado");
  setCountry("", "No encontrado", "");
  setSecurityFlags(false, false, false);

  currentServiceInfo = {
    serviceStart: null,
    osBuild: "No encontrado",
    connState: "No encontrado",
    lastSeen: null,
    lastSeenISO: "",
    lastSeenAgo: "",
    lastIP: "No encontrado",
    lastPort: null,
    isp: "No encontrado",
    ipVersion: "No encontrado",
    ipType: "No encontrado",
    city: "No encontrado",
    country: "No encontrado",
    countryCode: "-",
    flag: "",
    proxy: "No",
    vpn: "No",
    tor: "No",
    residentialRows: null
  };
}

/* ====== extracción principal del panel ====== */
function extractServiceInfoFromSource(raw){
  if (!raw){
    resetServicePanel();
    return;
  }

  // Siempre reset al inicio para no arrastrar datos de un record previo
  resetServicePanel();

  let doc = null;
  try{ doc = new DOMParser().parseFromString(String(raw), 'text/html'); }catch{}

  // Extraer valores por labels
  const serviceStart = doc ? findValueByStructuredLabels(doc, lbls.serviceStart) : null;
  const osBuild      = doc ? findValueByStructuredLabels(doc, lbls.osBuild)      : null;
  const connState    = doc ? findValueByStructuredLabels(doc, lbls.connStat)     : null;

  // lastSeen y onlineSince:
  const lastSeenLbl  = doc ? findValueByStructuredLabels(doc, lbls.lastSeen)     : null;
  const onlineSince  = doc ? findValueByStructuredLabels(doc, lbls.onlineSince)  : null;

  // IPs con prioridad: Connected from (si está ONLINE) > Last IP
  const connectedFrom = doc ? findValueByStructuredLabels(doc, lbls.connectedFrom) : null;
  let lastIPParsed = null;

  const f = (val, pats) => val || extractByLabelsFallback(raw, pats);
  const ss = f(serviceStart, lbls.serviceStart);
  const ob = f(osBuild,    lbls.osBuild);
  const cs = f(connState,  lbls.connStat);

  // Set básicos
  setServiceStart(ss ? (parseFlexibleDate(ss) || ss) : null);
  setOSBuild(ob || "No encontrado");
  setConnState(cs || "No encontrado");

  // Determinar "Última vez visto":
  // Si está ONLINE y hay Online Since, úsalo (no mostramos el label, solo fecha/hora para "visto hace")
  let lastSeenFinal = null;
  if (cs && GREEN_STATES_RX.test(cs) && onlineSince){
    lastSeenFinal = onlineSince;
  } else {
    lastSeenFinal = lastSeenLbl;
  }
  setLastSeen(lastSeenFinal ? (parseFlexibleDate(lastSeenFinal) || lastSeenFinal) : null);

  // Resolver IP + puerto
  // Si está ONLINE, priorizar "Connected from"
  if (cs && GREEN_STATES_RX.test(cs) && connectedFrom){
    lastIPParsed = parseIPAndPortFromText(connectedFrom);
  }
  // Si no salió, intenta por label Last IP
  if (!lastIPParsed && doc){
    const ipFromLastIp = extractIPStructured(doc, lbls.lastIp);
    if (ipFromLastIp) lastIPParsed = ipFromLastIp;
  }
  // Fallback: buscar global en el texto
  if (!lastIPParsed){
    lastIPParsed = parseIPAndPortFromText(raw);
  }

  if (lastIPParsed){
    const shown = lastIPParsed.port ? `${lastIPParsed.ip}:${lastIPParsed.port}` : lastIPParsed.ip;
    setLastIp(shown);
    currentServiceInfo.lastIP = lastIPParsed.ip;
    currentServiceInfo.lastPort = lastIPParsed.port;
    currentServiceInfo.ipVersion = lastIPParsed.version === 6 ? "IPv6" : "IPv4";
    setIPVersion(currentServiceInfo.ipVersion);
    setIPPort(lastIPParsed.port); // 🔹 refleja puerto en el panel
    // Consulta a servicios de IP con la IP "pura"
    lookupIP(lastIPParsed.ip);
  } else {
    setLastIp("No encontrado");
    setIPVersion("No encontrado");
    setIPPort(null); // 🔹 limpia si no hay puerto detectado
  }
}

/* ====== Tabla residencial (generación/visibilidad) ====== */
function generateResidentialRows(ip, lastSeenISO){
  if (!ip || !lastSeenISO) return null;
  const base = new Date(lastSeenISO);
  if (Number.isNaN(+base)) return null;

  // formateadores HLC (solo fecha y solo hora)
  const fDate = new Intl.DateTimeFormat('es-CO', {
    timeZone: HLC_TZ, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric'
  });
  const fTime = new Intl.DateTimeFormat('es-CO', {
    timeZone: HLC_TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const minus5 = new Date(base.getTime() - 5*60000);
  const plus5  = new Date(base.getTime() + 5*60000);

  const dateHLC  = fDate.format(base);
  const windowStr = `${dateHLC} de  ${fTime.format(minus5)} HLC hasta ${fTime.format(plus5)} HLC`;

  const rows = [[
    "DIRECCION IP",
    "FECHA Y HORA COLOMBIANA UTC",
    "FECHA Y HORA COLOMBIANA HLC",
    "FECHA Y HORA SOLICITADAS",
    "PUERTO DE CONEXIÓN" 
  ]];

  const ipWithPort = (currentServiceInfo.lastPort != null && ip && ip !== "No encontrado")
    ? `${ip}:${currentServiceInfo.lastPort}`
    : ip;

  rows.push([
    ipWithPort,                 // 🔹 IP completa (IP:PUERTO) en la 1ª columna
    formatUTC(base),            // UTC centrado
    `${formatInTZ(base)} HLC`,  // HLC centrado
    windowStr,                  // Rango ±5 min en HLC
    currentServiceInfo.lastPort ?? "" // puerto en la fila
  ]);

  return rows;
}

function renderResidentialTable(){
  const tipo = (currentServiceInfo.ipType || "").toLowerCase();
  const isResidential = (tipo === "residencial");
  const ip = currentServiceInfo.lastIP;
  const iso = currentServiceInfo.lastSeenISO;

  if (!resCard) return;

  if (!isResidential || !ip || !iso){
    resCard.classList.add("hidden");
    if (resTableBody) resTableBody.innerHTML = "";
    currentServiceInfo.residentialRows = null;
    return;
  }

  const rows = generateResidentialRows(ip, iso);
  if (!rows){
    resCard.classList.add("hidden");
    currentServiceInfo.residentialRows = null;
    return;
  }

  if (resTableBody){
    resTableBody.innerHTML = rows
      .slice(1)
      .map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4] ?? ""}</td></tr>`)
      .join('');
  }
  resCard.classList.remove("hidden");
  currentServiceInfo.residentialRows = rows; // para exportar/copiar
}

function updateResidentialSection(){ renderResidentialTable(); }

/* ====== helpers de exportación del panel ====== */
function getServiceRowsForCurrent(){
  return [
    ["Clave","Valor"],
    ["Service start", currentServiceInfo.serviceStart || "No encontrado"],
    ["Device OS Build Number", currentServiceInfo.osBuild || "No encontrado"],
    ["Connection State", currentServiceInfo.connState || "No encontrado"],
    ["Last seen", currentServiceInfo.lastSeen || "No encontrado"],
    ["Visto hace", currentServiceInfo.lastSeenAgo || "No encontrado"],
    ["Last IP", (currentServiceInfo.lastPort!=null && currentServiceInfo.lastIP && currentServiceInfo.lastIP!=="No encontrado") ? `${currentServiceInfo.lastIP}:${currentServiceInfo.lastPort}` : (currentServiceInfo.lastIP || "No encontrado")],
    ["Puerto", currentServiceInfo.lastPort ?? ""],
    ["ISP", currentServiceInfo.isp || "No encontrado"],
    ["Versión", currentServiceInfo.ipVersion || "No encontrado"],
    ["Tipo", currentServiceInfo.ipType || "No encontrado"],
    ["Ciudad", currentServiceInfo.city || "No encontrado"],
    ["País", (currentServiceInfo.flag ? currentServiceInfo.flag+" " : "") + (currentServiceInfo.country || "No encontrado")],
    ["Proxy", currentServiceInfo.proxy || "No"],
    ["VPN", currentServiceInfo.vpn || "No"],
    ["Tor", currentServiceInfo.tor || "No"]
  ];
}
function getServiceRowsForBatch(){
  const rows = [["Objetivo","Caso","Service start","Device OS Build Number","Connection State","Last seen","Visto hace","Last IP","Puerto","ISP","Versión","Tipo","Ciudad","País","Proxy","VPN","Tor"]];
  batch.forEach(item=>{
    const s = item.service || {};
    const pais = (s.flag ? s.flag+" " : "") + (s.country || "No encontrado");
    const lastIpShown = (s.lastPort!=null && s.lastIP && s.lastIP!=="No encontrado") ? `${s.lastIP}:${s.lastPort}` : (s.lastIP || "No encontrado");
    rows.push([
      item.objective || "—",
      item.caseId || "—",
      s.serviceStart || "No encontrado",
      s.osBuild || "No encontrado",
      s.connState || "No encontrado",
      s.lastSeen || "No encontrado",
      s.lastSeenAgo || "No encontrado",
      lastIpShown,
      s.lastPort ?? "",
      s.isp || "No encontrado",
      s.ipVersion || "No encontrado",
      s.ipType || "No encontrado",
      s.city || "No encontrado",
      pais,
      s.proxy || "No",
      s.vpn || "No",
      s.tor || "No"
    ]);
  });
  return rows;
}
// Tablas “Residencial” para exportar
function getResidentialRowsForCurrent(){
  const rows = currentServiceInfo.residentialRows;
  if (rows && rows.length > 1) return rows;
  return null;
}
function getResidentialRowsForBatch(){
  const header = ["DIRECCION IP","FECHA Y HORA COLOMBIANA UTC","FECHA Y HORA COLOMBIANA HLC","FECHA Y HORA SOLICITADAS","PUERTO"];
  const out = [header];
  let added = 0;
  batch.forEach(item=>{
    const s = item.service || {};
    if ((s.ipType||"").toLowerCase() !== "residencial") return;
    if (!s.lastIP || !s.lastSeenISO) return;
    // Usar puerto del item si está
    const prevPort = currentServiceInfo.lastPort;
    currentServiceInfo.lastPort = s.lastPort ?? null;
    const rows = generateResidentialRows(s.lastIP, s.lastSeenISO);
    // Restaurar puerto del current (por si acaso)
    currentServiceInfo.lastPort = prevPort;
    if (rows) { rows.slice(1).forEach(r => out.push(r)); added += 1; }
  });
  return added ? out : null;
}

// ====== Chatbot y gráfico de conexiones ======
let graphNetwork = null;
let graphLayoutMode = 'free';
let graphRandomSeed = Math.floor(Math.random() * 1e6);

function graphFontColor(){
  const themeAttr = document.documentElement?.getAttribute('data-theme') || document.body?.getAttribute('data-theme') || settings.theme;
  return (themeAttr && themeAttr.toLowerCase() === 'light') ? '#0a223d' : '#f8fafc';
}

function getGraphOptions(){
  const base = {
    nodes: { shape: 'circle', size: 30, font: { color: graphFontColor(), face: 'Space Grotesk', strokeWidth: 0 } },
    edges: {
      arrows: 'to',
      color: { color: 'rgba(148,163,184,.55)', highlight: '#38bdf8' },
      smooth: { type: 'dynamic' }
    }
  };

  if (graphLayoutMode === 'hierarchical-lr'){
    base.layout = {
      hierarchical: {
        enabled: true,
        direction: 'LR',
        nodeSpacing: 220,
        levelSeparation: 220,
        sortMethod: 'hubsize'
      }
    };
    base.physics = { enabled: false };
  } else if (graphLayoutMode === 'hierarchical-ud'){
    base.layout = {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        nodeSpacing: 200,
        levelSeparation: 200,
        sortMethod: 'hubsize'
      }
    };
    base.physics = { enabled: false };
  } else {
    base.layout = { randomSeed: graphRandomSeed, improvedLayout: false };
    base.physics = {
      enabled: true,
      solver: 'forceAtlas2Based',
      stabilization: { iterations: 220 },
      barnesHut: { springLength: 160, avoidOverlap: 0.25 }
    };
  }
  return base;
}

function attachNumberLabels(network, nodeData){
  network.on('afterDrawing', ctx => {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = settings.theme === 'dark' ? '#fff' : '#000';
    nodeData.forEach(n => {
      if (!n.title) return; // usar title como número
      const pos = network.getPositions([n.id])[n.id];
      if (!pos) return;
      ctx.fillText(n.title, pos.x, pos.y + 32);
    });
    ctx.restore();
  });
}

function getContactNodeLabel(contact, freq){
  if (!contact) return String(freq ?? 1);
  const label = graphLabels.get(contact);
  if (label){
    return `${label}\n(${freq ?? 1})`;
  }
  return String(freq ?? 1);
}

function storeGraphDataset(nodeArr, edges){
  graphDataset = {
    nodes: nodeArr.map(n => ({ ...n })),
    edges: edges.map(e => ({ ...e })),
    mode: graphActiveMode
  };
  graphNodeMap = new Map(graphDataset.nodes.map(n => [String(n.id), n]));
}

function renderGraphNetwork(nodeArr, edges){
  if (!graphEl) return;
  storeGraphDataset(nodeArr, edges);
  const options = getGraphOptions();
  const data = {
    nodes: new vis.DataSet(nodeArr.map(n => ({ ...n }))),
    edges: new vis.DataSet(edges.map(e => ({ ...e })))
  };
  if (graphNetwork) {
    graphNetwork.destroy();
    graphNetwork = null;
  }
  graphNetwork = new vis.Network(graphEl, data, options);
  graphNetwork.on('selectNode', handleGraphNodeSelect);
  graphNetwork.on('deselectNode', handleGraphNodeDeselect);
  if (options.physics && options.physics.enabled){
    graphNetwork.once('stabilizationIterationsDone', () => {
      graphNetwork.setOptions({ physics: false });
      requestAnimationFrame(() => {
        try { graphNetwork.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } }); } catch {}
      });
    });
  } else {
    setTimeout(() => {
      if (!graphNetwork) return;
      try { graphNetwork.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } }); } catch {}
    }, 80);
  }
  attachNumberLabels(graphNetwork, nodeArr);
  const desiredContact = graphPendingSelection || (selectedGraphNode?.contact || null);
  graphPendingSelection = null;
  if (desiredContact){
    selectGraphContactNode(desiredContact);
  } else {
    updateGraphSelectionUI();
  }
}

function renderGraph(numbers){
  if (!graphEl) return;
  graphActiveMode = 'current';
  const list = Array.isArray(numbers) ? numbers : [];
  if (!list.length){
    graphActiveMode = 'none';
    storeGraphDataset([], []);
    if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
    if (graphEl) graphEl.innerHTML = '<div class="muted">Sin contactos para graficar</div>';
    clearGraphSelection(true);
    updateGraphSelectionUI();
    return false;
  }
  graphEl.innerHTML = '';
  const objectiveLabel = getNormalizedObjective() || 'Objetivo';
  const nodeArr = [{
    id: 'root',
    label: objectiveLabel,
    shape: 'box',
    color: { background: '#0ea5e9', border: '#0b8ec7' },
    font: { color: '#041024' },
    type: 'objetivo',
    title: objectiveLabel
  }];
  const edges = [];
  list.forEach((n, i) => {
    const freq = currentCounts.countsMap[n] || 1;
    const nodeId = `c-${i}`;
    nodeArr.push({
      id: nodeId,
      label: getContactNodeLabel(n, freq),
      title: n,
      value: Math.max(1, freq),
      contact: n,
      freq,
      type: 'contact'
    });
    edges.push({ from: 'root', to: nodeId });
  });
  renderGraphNetwork(nodeArr, edges);
  return true;
}

function renderBatchGraph(){
  if (!graphEl) return;
  graphActiveMode = 'batch';
  const nodeArr = [];
  const edges = [];
  const owners = new Map();
  batch.forEach((item, idx) => {
    const id = `item-${idx}`;
    nodeArr.push({
      id,
      label: item.objective || `Reporte ${idx + 1}`,
      shape: 'box',
      color: { background: item.color },
      font: { color: '#041024' },
      type: 'reporte',
      title: item.objective || `Reporte ${idx + 1}`
    });
    item.contacts.forEach(c => {
      if (!owners.has(c)) owners.set(c, new Set());
      owners.get(c).add(id);
    });
  });
  let cIdx = 0;
  owners.forEach((set, contact) => {
    const cid = `c-${cIdx++}`;
    const freq = set.size;
    const color = freq > 1 ? { background: '#f87171', border: '#ef4444' } : { background: '#1e293b', border: '#334155' };
    nodeArr.push({
      id: cid,
      label: getContactNodeLabel(contact, freq),
      title: contact,
      color,
      value: Math.max(1, freq),
      contact,
      freq,
      type: 'contact',
      ownerRefs: Array.from(set)
    });
    set.forEach(id => edges.push({ from: id, to: cid }));
  });
  if (edges.length === 0) {
    graphActiveMode = 'none';
    storeGraphDataset([], []);
    if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
    graphEl.innerHTML = '<div class="muted">Sin datos en el lote</div>';
    clearGraphSelection(true);
    updateGraphSelectionUI();
    return false;
  }
  graphEl.innerHTML = '';
  renderGraphNetwork(nodeArr, edges);
  return true;
}

function clearGraphSelection(silent = false){
  selectedGraphNode = null;
  graphPendingSelection = null;
  if (graphLabelInput) graphLabelInput.value = '';
  if (!silent) updateGraphSelectionUI();
}

function selectGraphContactNode(contact){
  if (!contact){
    clearGraphSelection();
    return;
  }
  const node = graphDataset.nodes.find(n => n.contact === contact);
  if (!node){
    clearGraphSelection();
    return;
  }
  selectedGraphNode = { id: node.id, contact: node.contact, type: node.type || 'contact' };
  if (graphNetwork){
    try { graphNetwork.selectNodes([node.id]); } catch {}
  }
  if (graphLabelInput) graphLabelInput.value = graphLabels.get(node.contact) || '';
  updateGraphSelectionUI();
}

function handleGraphNodeSelect(params){
  if (!params.nodes || !params.nodes.length){
    clearGraphSelection();
    return;
  }
  const nodeId = params.nodes[0];
  const node = graphNodeMap.get(String(nodeId));
  if (node && node.contact){
    selectedGraphNode = { id: nodeId, contact: node.contact, type: node.type || 'contact' };
    if (graphLabelInput) graphLabelInput.value = graphLabels.get(node.contact) || '';
    graphPendingSelection = node.contact;
  } else {
    clearGraphSelection();
    return;
  }
  updateGraphSelectionUI();
}

function handleGraphNodeDeselect(){
  clearGraphSelection();
}

function updateGraphSelectionUI(){
  const hasData = (graphDataset.nodes?.length || 0) > 0;
  const hasSelection = !!(hasData && selectedGraphNode && selectedGraphNode.contact);
  if (graphSelectionBox){
    graphSelectionBox.classList.toggle('is-disabled', !hasData);
  }
  if (graphSelectionLabel){
    if (!hasData){
      graphSelectionLabel.textContent = 'Sin datos disponibles.';
    } else if (hasSelection){
      const label = graphLabels.get(selectedGraphNode.contact) || 'Sin etiqueta';
      graphSelectionLabel.innerHTML = `<strong>${escapeHTML(selectedGraphNode.contact)}</strong> · ${escapeHTML(label)}`;
    } else {
      graphSelectionLabel.textContent = 'Selecciona un contacto del gráfico.';
    }
  }
  if (graphLabelInput){
    if (hasSelection){
      graphLabelInput.disabled = false;
      graphLabelInput.value = graphLabels.get(selectedGraphNode.contact) || '';
    } else {
      graphLabelInput.disabled = true;
      graphLabelInput.value = '';
    }
  }
  [graphCopyBtn, graphLabelSaveBtn, graphDeleteBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = !hasSelection;
  });
  [graphExportPdfBtn, graphExportXlsxBtn].forEach(btn => {
    if (!btn) return;
    btn.disabled = !hasData;
  });
}

function setGraphControlsEnabled(enabled){
  if (graphLayoutSelect) graphLayoutSelect.disabled = !enabled;
  if (graphRefreshBtn) graphRefreshBtn.disabled = !enabled;
  updateGraphSelectionUI();
}

function renderRelations(){
  let hasData = false;
  if(batch.length>0) hasData = !!renderBatchGraph();
  else if(currentContacts.length) hasData = !!renderGraph(currentContacts);
  else{
    graphActiveMode = 'none';
    storeGraphDataset([], []);
    if(graphNetwork){ graphNetwork.destroy(); graphNetwork=null; }
    if(graphEl) graphEl.innerHTML='';
    clearGraphSelection(true);
    updateGraphSelectionUI();
  }
  setGraphControlsEnabled(hasData);
}

async function copySelectedContact(){
  if (!selectedGraphNode?.contact) return;
  const value = selectedGraphNode.contact;
  try {
    await navigator.clipboard.writeText(value);
    alert('Número copiado al portapapeles.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      alert('Número copiado al portapapeles.');
    } catch {
      alert('No se pudo copiar el número.');
    }
    ta.remove();
  }
}

function saveGraphLabel(){
  if (!selectedGraphNode?.contact || !graphLabelInput || graphLabelInput.disabled) return;
  const contact = selectedGraphNode.contact;
  const value = (graphLabelInput.value || '').trim();
  if (value){
    graphLabels.set(contact, value);
  } else {
    graphLabels.delete(contact);
  }
  graphPendingSelection = contact;
  renderRelations();
}

function deleteSelectedContact(){
  if (!selectedGraphNode?.contact) return;
  const contact = selectedGraphNode.contact;
  if (!confirm(`¿Eliminar ${contact} del gráfico actual?`)) return;
  graphLabels.delete(contact);
  graphPendingSelection = null;
  selectedGraphNode = null;
  if (graphActiveMode === 'current'){
    currentContacts = currentContacts.filter(n => n !== contact);
    if (currentCounts?.countsMap && currentCounts.countsMap[contact]){
      const freq = currentCounts.countsMap[contact];
      currentCounts.read = Math.max(0, (currentCounts.read || 0) - freq);
      if (freq > 1) currentCounts.duplicates = Math.max(0, (currentCounts.duplicates || 0) - 1);
      delete currentCounts.countsMap[contact];
    }
    renderPreview();
  } else if (graphActiveMode === 'batch'){
    batch.forEach(item => { if (item.contacts) item.contacts.delete(contact); });
    renderBatch();
  } else {
    renderRelations();
  }
}

function buildGraphExportSheets(){
  if (!graphDataset || !graphDataset.nodes.length) return null;
  const nodeMap = new Map(graphDataset.nodes.map(n => [String(n.id), n]));
  const nodesRows = [["ID","Tipo","Contacto","Etiqueta","Frecuencia","Relacionados"]];
  graphDataset.nodes.forEach(node => {
    if (node.contact){
      const related = graphDataset.edges
        .filter(edge => edge.from === node.id || edge.to === node.id)
        .map(edge => {
          const otherId = edge.from === node.id ? edge.to : edge.from;
          const other = nodeMap.get(String(otherId));
          if (!other) return '';
          if (other.contact) return other.contact;
          return other.title || other.label || String(otherId);
        })
        .filter(Boolean);
      nodesRows.push([
        node.id,
        graphActiveMode === 'batch' ? 'Contacto (lote)' : 'Contacto',
        node.contact,
        graphLabels.get(node.contact) || '',
        node.freq ?? '',
        related.join(', ')
      ]);
    } else {
      const typeLabel = node.type === 'objetivo' ? 'Objetivo' : node.type === 'reporte' ? 'Reporte' : 'Nodo';
      nodesRows.push([node.id, typeLabel, node.title || node.label || '', '', '', '']);
    }
  });
  const edgesRows = [["Desde","Hasta"]];
  graphDataset.edges.forEach(edge => edgesRows.push([edge.from, edge.to]));
  return { nodesRows, edgesRows };
}

async function exportGraphToPdf(){
  if (!graphDataset.nodes.length){
    alert('No hay datos para exportar.');
    return;
  }
  if (!window.html2canvas || !window.jspdf?.jsPDF){
    alert('Las bibliotecas de exportación no están disponibles.');
    return;
  }
  const target = graphPanel || graphEl;
  if (!target) return;
  try {
    const styles = window.getComputedStyle(document.body);
    const bg = styles.getPropertyValue('background-color') || '#ffffff';
    const canvas = await window.html2canvas(target, { backgroundColor: bg, useCORS: true, scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    const offsetX = (pageWidth - imgWidth) / 2;
    const offsetY = (pageHeight - imgHeight) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, imgWidth, imgHeight);
    pdf.save(`wf-tools_grafico_${nowStamp()}.pdf`);
  } catch (error) {
    console.error('Error exportando gráfico a PDF', error);
    alert('No se pudo exportar el gráfico a PDF.');
  }
}

function exportGraphToXlsx(){
  const sheets = buildGraphExportSheets();
  if (!sheets){
    alert('No hay datos para exportar.');
    return;
  }
  const filename = `wf-tools_grafico_${nowStamp()}.xlsx`;
  downloadWB(filename, { 'Nodos': sheets.nodesRows, 'Conexiones': sheets.edgesRows });
}

function addChatMessage(text, who){
  if (!chatLog) return;
  const p = document.createElement('p');
  p.className = who;
  p.textContent = text;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

const sentiment = window.Sentiment ? new window.Sentiment() : null;
async function handleChat(msg){
  const m = msg.toLowerCase();
  if (m.includes('cuantos') || m.includes('contar')){
    return `Se encontraron ${currentContacts.length} números.`;
  }
  if (m.includes('duplicados')){
    return `Hay ${currentCounts.duplicates || 0} números duplicados.`;
  }
  if (m.includes('promedio')){
    const nums = currentContacts.map(Number).filter(n=>!isNaN(n));
    if(!nums.length) return 'No hay números para analizar.';
    const expr = `mean(${JSON.stringify(nums)})`;
    try{
      const res = await fetch(`https://api.mathjs.org/v4/?expr=${encodeURIComponent(expr)}`);
      const txt = await res.text();
      return `El promedio es ${txt}`;
    }catch{
      return 'No pude obtener el promedio.';
    }
  }
  if (m.includes('sentimiento') && sentiment){
    const r = sentiment.analyze(msg);
    return `Sentimiento: ${r.score >= 0 ? 'positivo' : 'negativo'} (puntaje ${r.score}).`;
  }
  if (m.includes('lote') || m.includes('relacion')){
    const counts={};
    batch.forEach(it=>{ it.contacts.forEach(c=>{ counts[c]=(counts[c]||0)+1; }); });
    const total=Object.keys(counts).length;
    const shared=Object.values(counts).filter(v=>v>1).length;
    return `En el lote hay ${total} contactos y ${shared} compartidos entre reportes.`;
  }
  if (m.includes('hola') || m.includes('ayuda') || m.includes('dime')){
    return 'Puedes preguntarme por "cuantos", "duplicados", "promedio", "sentimiento" o "lote".';
  }
  return 'No tengo una respuesta para eso. Escribe "ayuda" para ver opciones.';
}

async function sendChat(){
  const msg = (chatInput.value||'').trim();
  if(!msg) return;
  addChatMessage(msg,'user');
  const resp = await handleChat(msg);
  addChatMessage(resp,'bot');
  chatInput.value='';
}

if (chatSend){
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });
}

function updateFullscreenButtonState(isFull){
  if (!relBtn) return;
  const textEl = relBtn.querySelector('.text');
  if (textEl) textEl.textContent = isFull ? 'Cerrar gráfico' : 'Pantalla completa';
  relBtn.setAttribute('aria-pressed', String(isFull));
  relBtn.classList.toggle('is-close', isFull);
}

if (relBtn){
  updateFullscreenButtonState(graphPanel?.classList.contains('fullscreen'));
  relBtn.addEventListener('click', ()=>{
    if(!graphPanel) return;
    const isFull = graphPanel.classList.toggle('fullscreen');
    updateFullscreenButtonState(isFull);
    if(graphNetwork){
      graphNetwork.redraw();
      setTimeout(() => {
        try { graphNetwork.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } }); } catch {}
      }, 100);
    }
  });
}

if (graphLayoutSelect){
  if (graphLayoutSelect.value) graphLayoutMode = graphLayoutSelect.value;
  graphLayoutSelect.addEventListener('change', event => {
    graphLayoutMode = event.target.value || 'free';
    graphRandomSeed = Math.floor(Math.random() * 1e6);
    renderRelations();
  });
}

if (graphRefreshBtn){
  graphRefreshBtn.addEventListener('click', () => {
    graphRandomSeed = Math.floor(Math.random() * 1e6);
    renderRelations();
  });
}

graphCopyBtn?.addEventListener('click', copySelectedContact);
graphLabelSaveBtn?.addEventListener('click', saveGraphLabel);
graphDeleteBtn?.addEventListener('click', deleteSelectedContact);
graphLabelInput?.addEventListener('keydown', event => {
  if (event.key === 'Enter'){
    event.preventDefault();
    saveGraphLabel();
  }
});
graphExportPdfBtn?.addEventListener('click', exportGraphToPdf);
graphExportXlsxBtn?.addEventListener('click', exportGraphToXlsx);

let graphResizeTimer = null;
if (typeof window !== 'undefined'){
  window.addEventListener('resize', () => {
    if (!graphNetwork) return;
    if (graphResizeTimer) clearTimeout(graphResizeTimer);
    graphResizeTimer = setTimeout(() => {
      graphResizeTimer = null;
      try {
        graphNetwork.redraw();
        graphNetwork.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
      } catch {}
    }, 160);
  });
}

setGraphControlsEnabled(false);

async function requestCredit(){
  if (window.Auth && typeof window.Auth.spendCredit === 'function'){
    try {
      return await window.Auth.spendCredit();
    } catch (error) {
      console.error('No se pudo consumir crédito', error);
      return false;
    }
  }
  return true;
}

function initCore(){
  restoreLocal();
  renderPreview();
  renderUploadStatuses();
  updateGraphSelectionUI();
}

function setCreditDependentActionsEnabled(enabled){
  if (uploadBtn) uploadBtn.disabled = !enabled;
  if (processBtn) processBtn.disabled = !enabled;
}

window.AppCore = {
  init: initCore,
  requestCredit,
  setCreditDependentActionsEnabled
};
