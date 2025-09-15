// app.js
// =================== v1.2.0 (clasificación IP ampliada + tabla residencial) ===================

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
const uploadBtn = document.getElementById("uploadBtn");
const filePicker = document.getElementById("filePicker");

// Login y administración
const loginScreen = document.getElementById("loginScreen");
const loginUser = document.getElementById("loginUser");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const appWrap = document.getElementById("appWrap");
const adminPanel = document.getElementById("adminPanel");
const clientsTable = document.getElementById("clientsTable");
const newClientName = document.getElementById("newClientName");
const newClientCredits = document.getElementById("newClientCredits");
const addClientBtn = document.getElementById("addClientBtn");

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

const adminUser = { username: 'admin', password: '12345' };
let clients = [ { name: 'Cliente demo', credits: 10 } ];

// Zona horaria de referencia (UTC−5 sin DST)
const HLC_TZ = 'America/Bogota';

// Servicio (mantener en estado para exportar)
let currentServiceInfo = {
  serviceStart: "-",
  osBuild: "-",
  connState: "-",
  lastSeen: "-",
  lastSeenISO: "",  // ISO real de "Last seen" en UTC
  lastSeenAgo: "-",
  lastIP: "-",
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
  if (Number.isNaN(+d)) return "-";
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(d);
}
function formatUTC(dateLike){
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
  if (Number.isNaN(+d)) return "-";
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

async function handleDroppedFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const zipFiles = files.filter(f => /\.zip$/i.test(f.name));
  const textFiles = files.filter(f => /\.(txt|csv|html?)$/i.test(f.name));

  const parts = [];

  if (zipFiles.length){
    for (const z of zipFiles){
      const res = await processZipFile(z);
      if (res){
        parts.push(res.html);
        if (res.ai) accountIdEl.value = res.ai;
      }
    }
  }

  if (textFiles.length){
    for (const f of textFiles){
      try{ parts.push(await readFileAsText(f)); }
      catch{ logError('file_read'); }
    }
  }

  if (parts.length){
    const merged = parts.join("\n\n");
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

  logError('no_files');
  const msg = "No se detectaron archivos compatibles. Arrastra un .zip con records.html o .txt/.csv/.html.";
  alert(errorStats.no_files > 1 ? msg + " Revisa que sean archivos válidos." : msg);
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

    // 👇 Declarar primero y luego agregar la hoja Residencial (para evitar ReferenceError)
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

// =============== MODAL GUÍA (auto-open) ===============
(function setupHowtoModal(){
  const modal   = document.getElementById("howtoModal");
  const overlay = document.getElementById("modalOverlay");
  const openBtn = document.getElementById("openGuide");

  if (!modal || !overlay) return;

  const open = () => { modal.classList.add("open"); overlay.classList.add("open"); document.body.classList.add("noscroll"); };
  const close = () => { modal.classList.remove("open"); overlay.classList.remove("open"); document.body.classList.remove("noscroll"); };

  document.querySelectorAll("[data-close-howto]").forEach(el => el.addEventListener("click", close));
  overlay.addEventListener("click", close);
  openBtn?.addEventListener("click", (e) => { e.preventDefault(); open(); });

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
  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); e.stopPropagation(); dragCounter++; dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); dragCounter--; if (dragCounter <= 0) dropZone.classList.remove('dragging'); });
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
function setText(el, val){ if (el) el.textContent = (val == null || val === "") ? "-" : String(val); }

/* ====== setters que sincronizan UI y estado ====== */
function setServiceStart(dateStrOrObj){
  if (!serviceStartEl) return;
  let disp = "-";
  if (dateStrOrObj){
    const d = dateStrOrObj instanceof Date ? new Date(dateStrOrObj) : parseFlexibleDate(dateStrOrObj);
    if (d && !Number.isNaN(+d)) disp = formatInTZ(d);
  }
  setText(serviceStartEl, disp);
  currentServiceInfo.serviceStart = disp;
}

const GREEN_STATES_RX = /^(online|connected|en\s*línea|conectad[oa])$/i;
function setConnState(val){
  const v = (val && String(val).trim()) || "-";
  setText(connStatEl, v);
  connStatEl?.classList.remove('red','green');
  if (v !== "-" ){
    if (GREEN_STATES_RX.test(v)) connStatEl?.classList.add('green');
    else connStatEl?.classList.add('red');
  }
  currentServiceInfo.connState = v;
}
function setOSBuild(val){ const v = (val && String(val).trim()) || "-"; setText(osBuildEl, v); currentServiceInfo.osBuild = v; }
function setLastIp(val){ const v = (val && String(val).trim()) || "-"; setText(lastIpEl, v); currentServiceInfo.lastIP = v; }
function setISP(val){ const v = (val && String(val).trim()) || "-"; setText(ispEl, v); currentServiceInfo.isp = v; }
function setIPVersion(val){ const v = (val && String(val).trim()) || "-"; setText(ipVersionEl, v); currentServiceInfo.ipVersion = v; }
function setIPType(val){
  const v = (val && String(val).trim()) || "-";
  setText(ipTypeEl, v);
  currentServiceInfo.ipType = v;
  updateResidentialSection(); // actualizar visibilidad/tabla
}

// Ciudad / País / Chips
function setCity(val){ const v = (val && String(val).trim()) || "-"; setText(cityEl, v); currentServiceInfo.city = v; }
function countryCodeToEmoji(cc){ if (!cc || cc.length !== 2) return ""; const A=127397; return String.fromCodePoint(...cc.toUpperCase().split("").map(c => c.charCodeAt(0)+A)); }
function setCountry(countryCode, countryName, flagEmoji){
  const code = (countryCode || "").toUpperCase();
  const flag = flagEmoji || countryCodeToEmoji(code);
  const label = [flag, countryName || code || "-"].filter(Boolean).join(" ");
  setText(countryEl, label || "-");
  currentServiceInfo.country = countryName || code || "-";
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
    setText(lastSeenAgoEl, "-");
    currentServiceInfo.lastSeenAgo = "-";
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
  let disp = "-";
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

  // Señales fuertes móviles (APN / 3GPP / rDNS / léxico)
  const hasMobileClues =
    /\b(apn|epc|ims|3gpp|mnc\d{2,3}|mcc\d{2,3}|lte|4g|5g|umts|hspa|gprs|edge|wap|cell|celular|movil|mobile)\b/.test(txt);

  // Huellas de hosting/CDN/VPS (por tu política → “celular”)
  const hasHostingClues =
    /\b(aws|amazon|ec2|compute|gcp|1e100\.net|cloudflare|azure|microsoft|digitalocean|ovh|kimsufi|soyoustart|hetzner|contabo|linode|vultr|oracle|oci|akamai|fastly|leaseweb|scaleway|aruba|rackspace|colo|colocation|datacenter|vps|server|cloud|cdn|dc-)\b/.test(txt);

  // Hogar / cliente final / dinámicos
  const hasResidentialClues =
    /\b(residential|residencial|home|hogar|ftth|hfc|adsl|xdsl|cable|fiber|fibra|pppoe|pool|dynamic|dhcp|customer|cust|subscriber|user)\b/.test(txt);

  // Empresa/dedicado
  const hasEnterpriseClues =
    /\b(business|empresa|corporate|corp|empresarial|b2b|static[-\s]?ip|ip\s*fija|ip\s*fixa|dedicated|enlace\s*de\s*datos|metroethernet|mpls)\b/.test(txt);

  // 1) Marca móvil o indicios móviles → CELULAR
  if (isMobileBrand || hasMobileClues) return "celular";

  // 2) Empresa explícito (si no hay residencial fuerte) → EMPRESA
  if (hasEnterpriseClues && !hasResidentialClues) return "empresa";

  // 3) ISPs solo-fijo (sin pistas móviles) → RESIDENCIAL
  if (isFixedOnly && !hasMobileClues) return "residencial";

  // 4) Marca mixta: si hay pistas móviles → CELULAR; si hay residenciales → RESIDENCIAL; si no, RESIDENCIAL por defecto
  if (isMixedBrand){
    if (hasMobileClues) return "celular";
    if (hasResidentialClues) return "residencial";
    return "residencial";
  }

  // 5) Hosting / CDN / VPS → CELULAR (según tu política)
  if (hasHostingClues) return "celular";

  // 6) Si hay pistas residenciales, RESIDENCIAL
  if (hasResidentialClues) return "residencial";

  // 7) Default conservador
  return "residencial";
}

/* ====== consulta IP + clasificación ====== */
/* ==== helpers para fetch con timeout y limpieza ==== */
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
  if (!ip || ip === "-") return;
  setLastIp(ip);

  // caché
  if (ipCache.has(ip)){
    const c = ipCache.get(ip);
    setISP(c.isp || "-");
    setIPVersion(c.version || (/:/.test(ip) ? "IPv6":"IPv4"));
    setIPType(classifyType(c.baseType || "", c.isp || "", c.hints || ""));
    setCity(c.city || "-");
    setCountry(c.countryCode || "", c.countryName || "", c.flag || "");
    setSecurityFlags(!!c.proxy, !!c.vpn, !!c.tor);
    return;
  }

  try{
    // disparamos en paralelo con tolerancia a fallos
    const [r1, r2, r3] = await Promise.allSettled([
      fetchJSONWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}`, 6500),
      fetchJSONWithTimeout(`https://ipwhois.app/json/${encodeURIComponent(ip)}`, 6500),
      fetchJSONWithTimeout(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, 6500)
    ]);

    const d1 = (r1.status==="fulfilled" && r1.value && r1.value.success!==false) ? r1.value : null; // ipwho.is
    const d2 = (r2.status==="fulfilled" && r2.value && !r2.value.error) ? r2.value : null;         // ipwhois.app
    const d3 = (r3.status==="fulfilled" && r3.value && !r3.value.error) ? r3.value : null;         // ipapi.co

    // ISP/ORG
    const isp = pickFirst(
      d1?.connection?.isp, d1?.isp, d1?.org,
      d2?.isp, d2?.org,
      d3?.org
    ) || "-";

    // versión
    const version = pickFirst(
      d1?.type,
      d2?.type,
      (/:/.test(ip) ? "IPv6" : "IPv4")
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

    // hints para clasificar (juntamos rDNS/hostname + org + ASN + el tipo que diga el proveedor)
    const hints = [rdns, org, asn, providerTypeStr].filter(Boolean).join(" ");

    // clasificación final
    const finalType = classifyType(providerTypeStr, isp, hints);

    // set en UI
    setISP(isp || "-");
    setIPVersion(version || (/:/.test(ip) ? "IPv6":"IPv4"));
    setIPType(finalType);
    setCity(city || "-");
    setCountry(countryCode || "", countryName || "", flagEmoji || "");
    setSecurityFlags(proxy, vpn, tor);

    // guarda en caché
    ipCache.set(ip, {
      isp, version, baseType: providerTypeStr, hints,
      city, countryName, countryCode, flag: flagEmoji,
      proxy, vpn, tor
    });

  }catch(err){
    console.error("Error consultando IP:", err);
    // Mínimo: mostrar versión y mantener resto con guiones
    setIPVersion(/:/.test(ip) ? "IPv6":"IPv4");
  }
}



/* ====== extracción principal del panel ====== */
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
    setCity("-");
    setCountry("", "-", "");
    setSecurityFlags(false, false, false);
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
  const ob = f(osBuild,    lbls.osBuild);
  const cs = f(connState,  lbls.connStat);
  const ls = f(lastSeen,   lbls.lastSeen);

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
    "FECHA Y HORA SOLICITADAS"
  ]];

  rows.push([
    ip,
    formatUTC(base),           // UTC centrado
    `${formatInTZ(base)} HLC`, // HLC centrado
    windowStr                  // Rango ±5 min en HLC
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
      .map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`)
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
    ["Service start", currentServiceInfo.serviceStart || "-"],
    ["Device OS Build Number", currentServiceInfo.osBuild || "-"],
    ["Connection State", currentServiceInfo.connState || "-"],
    ["Last seen", currentServiceInfo.lastSeen || "-"],
    ["Visto hace", currentServiceInfo.lastSeenAgo || "-"],
    ["Last IP", currentServiceInfo.lastIP || "-"],
    ["ISP", currentServiceInfo.isp || "-"],
    ["Versión", currentServiceInfo.ipVersion || "-"],
    ["Tipo", currentServiceInfo.ipType || "-"],
    ["Ciudad", currentServiceInfo.city || "-"],
    ["País", (currentServiceInfo.flag ? currentServiceInfo.flag+" " : "") + (currentServiceInfo.country || "-")],
    ["Proxy", currentServiceInfo.proxy || "No"],
    ["VPN", currentServiceInfo.vpn || "No"],
    ["Tor", currentServiceInfo.tor || "No"]
  ];
}
function getServiceRowsForBatch(){
  const rows = [["Objetivo","Caso","Service start","Device OS Build Number","Connection State","Last seen","Visto hace","Last IP","ISP","Versión","Tipo","Ciudad","País","Proxy","VPN","Tor"]];
  batch.forEach(item=>{
    const s = item.service || {};
    const pais = (s.flag ? s.flag+" " : "") + (s.country || "-");
    rows.push([
      item.objective || "—",
      item.caseId || "—",
      s.serviceStart || "-",
      s.osBuild || "-",
      s.connState || "-",
      s.lastSeen || "-",
      s.lastSeenAgo || "-",
      s.lastIP || "-",
      s.isp || "-",
      s.ipVersion || "-",
      s.ipType || "-",
      s.city || "-",
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
  const header = ["DIRECCION IP","FECHA Y HORA COLOMBIANA UTC","FECHA Y HORA COLOMBIANA HLC","FECHA Y HORA SOLICITADAS"];
  const out = [header];
  let added = 0;
  batch.forEach(item=>{
    const s = item.service || {};
    if ((s.ipType||"").toLowerCase() !== "residencial") return;
    if (!s.lastIP || !s.lastSeenISO) return;
    const rows = generateResidentialRows(s.lastIP, s.lastSeenISO);
    if (rows) { rows.slice(1).forEach(r => out.push(r)); added += 1; }
  });
  return added ? out : null;
}

// ====== Chatbot y gráfico de conexiones ======
let graphNetwork = null;

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

function renderGraph(numbers){
  if (!graphEl) return;
  graphEl.innerHTML = '';
  const objectiveLabel = getNormalizedObjective() || 'Objetivo';
  const nodeArr = [{ id: 'root', label: objectiveLabel, shape: 'box' }];
  const edges = [];
  (numbers || []).forEach((n, i) => {
    const freq = currentCounts.countsMap[n] || 1;
    nodeArr.push({ id: i, label: String(freq), title: n });
    edges.push({ from: 'root', to: i });
  });
  const nodesDs = new vis.DataSet(nodeArr);
  const data = { nodes: nodesDs, edges: new vis.DataSet(edges) };
  const options = {
    physics: { stabilization: true },
    nodes: { shape: 'circle', size: 30, font: { color: '#fff' } },
    edges: { arrows: 'to' }
  };
  if (graphNetwork) graphNetwork.destroy();
  graphNetwork = new vis.Network(graphEl, data, options);
  graphNetwork.once('stabilizationIterationsDone', () => {
    graphNetwork.setOptions({ physics: false });
  });
  attachNumberLabels(graphNetwork, nodeArr);
}

function renderBatchGraph(){
  if (!graphEl) return;
  const nodeArr = []; const edges = []; const owners = new Map();
  batch.forEach((item, idx) => {
    const id = `item-${idx}`;
    nodeArr.push({ id, label: item.objective || `Reporte ${idx + 1}`, shape: 'box', color: { background: item.color } });
    item.contacts.forEach(c => {
      if (!owners.has(c)) owners.set(c, new Set());
      owners.get(c).add(id);
    });
  });
  let cIdx = 0;
  owners.forEach((set, contact) => {
    const cid = `c-${cIdx++}`;
    const freq = set.size;
    const color = freq > 1 ? { background: '#ff6b6b' } : undefined;
    nodeArr.push({ id: cid, label: String(freq), title: contact, color });
    set.forEach(id => edges.push({ from: id, to: cid }));
  });
  if (edges.length === 0) {
    if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
    graphEl.innerHTML = '<div class="muted">Sin datos en el lote</div>';
    return;
  }
  const nodesDs = new vis.DataSet(nodeArr);
  const data = { nodes: nodesDs, edges: new vis.DataSet(edges) };
  const options = {
    physics: { stabilization: true },
    nodes: { shape: 'circle', size: 30, font: { color: '#fff' } },
    edges: { arrows: 'to' }
  };
  if (graphNetwork) graphNetwork.destroy();
  graphNetwork = new vis.Network(graphEl, data, options);
  graphNetwork.once('stabilizationIterationsDone', () => {
    graphNetwork.setOptions({ physics: false });
  });
  attachNumberLabels(graphNetwork, nodeArr);
}

function renderRelations(){
  if(batch.length>0) renderBatchGraph();
  else if(currentContacts.length) renderGraph(currentContacts);
  else{
    if(graphNetwork){ graphNetwork.destroy(); graphNetwork=null; }
    if(graphEl) graphEl.innerHTML='';
  }
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
if (relBtn){
  relBtn.addEventListener('click', ()=>{
    if(!graphPanel) return;
    graphPanel.classList.toggle('fullscreen');
    relBtn.textContent = graphPanel.classList.contains('fullscreen') ? 'Cerrar' : 'Pantalla completa';
    if(graphNetwork) graphNetwork.redraw();
  });
}

function renderClients(){
  if(!clientsTable) return;
  const tbody = clientsTable.querySelector('tbody');
  tbody.innerHTML='';
  clients.forEach((c,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${c.name}</td><td><input type="number" value="${c.credits}" data-idx="${idx}" class="credit-input"></td><td><button class="btn" data-idx="${idx}">Guardar</button></td>`;
    tbody.appendChild(tr);
  });
}

function handleLogin(){
  const user=loginUser.value.trim();
  const pass=loginPassword.value;
  if(user===adminUser.username && pass===adminUser.password){
    loginError.style.display='none';
    loginScreen.style.display='none';
    appWrap.style.display='block';
    adminPanel.style.display='block';
    renderClients();
  }else{
    loginError.textContent='Credenciales inválidas';
    loginError.style.display='block';
  }
}

loginBtn?.addEventListener('click', handleLogin);
loginUser?.addEventListener('keydown', e=>{ if(e.key==='Enter') handleLogin(); });
loginPassword?.addEventListener('keydown', e=>{ if(e.key==='Enter') handleLogin(); });

clientsTable?.addEventListener('click', e=>{
  if(e.target.matches('button[data-idx]')){
    const idx=+e.target.dataset.idx;
    const inp=clientsTable.querySelector(`input[data-idx="${idx}"]`);
    clients[idx].credits=parseInt(inp.value,10)||0;
  }
});

addClientBtn?.addEventListener('click', ()=>{
  const name=(newClientName.value||'').trim();
  const credits=parseInt(newClientCredits.value,10)||0;
  if(!name) return;
  clients.push({ name, credits });
  renderClients();
  newClientName.value='';
  newClientCredits.value='';
});

/* ====== init ====== */
window.addEventListener('DOMContentLoaded', () => {
  restoreLocal();
  renderPreview();
});
