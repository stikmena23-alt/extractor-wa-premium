// app-core.js
// =================== v1.2.1 (server-side extract via Supabase Edge Functions) ===================

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
const lastPortEl     = document.getElementById("lastPortVal"); // NUEVO
const ispEl          = document.getElementById("ispVal");
const ipVersionEl    = document.getElementById("ipVersionVal");
const ipTypeEl       = document.getElementById("ipTypeVal");

// Coincidir con tu HTML actual:
const cityEl         = document.getElementById("cityVal");
const countryEl      = document.getElementById("countryVal");
const secChipsEl     = document.getElementById("secChips");

// NUEVO: Tarjeta y tabla residencial (mantiene tu feature anterior; no depende del servidor)
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

// Zona horaria de referencia (UTC−5 sin DST)
const HLC_TZ = 'America/Bogota';

// Servicio (mantener en estado para exportar)
let currentServiceInfo = {
  serviceStart: "-",
  osBuild: "-",
  connState: "-",
  lastSeen: "-",
  lastSeenISO: "",
  lastSeenAgo: "-",
  lastIP: "-",
  lastPort: "-",    // NUEVO
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
  residentialRows: null
};

// =================== CONFIG SERVER (Supabase Edge Functions) ===================

// Detecta local vs prod y usa el host correcto de Functions
const IS_LOCAL = /localhost|127\.0\.0\.1/.test(location.host);

const EDGE_BASE = IS_LOCAL
  ? 'http://localhost:54321/functions/v1'              // emulador local
  : 'https://htkwcjhcuqyepclpmpsv.functions.supabase.co'; // PRODUCCIÓN

const EXTRACT_HTML_URL = `${EDGE_BASE}/smart-extract`;
const EXTRACT_ZIP_URL  = `${EDGE_BASE}/smart-extract-zip`;

// Obtener token de usuario para firmar request (si existe Auth.getAccessToken)
async function getAccessToken() {
  try { return await (window.Auth?.getAccessToken?.() || Promise.resolve(null)); }
  catch { return null; }
}
async function callSmartExtractHTML(html) {
  const token = await getAccessToken();
  const resp = await fetch(EXTRACT_HTML_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ html })
  });
  if (!resp.ok) throw new Error(`smart-extract error ${resp.status}`);
  return resp.json();
}
async function callSmartExtractZIP(file) {
  const token = await getAccessToken();
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch(EXTRACT_ZIP_URL, {
    method: 'POST',
    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
    body: fd
  });
  if (!resp.ok) throw new Error(`smart-extract-zip error ${resp.status}`);
  return resp.json();
}

// =================== UTILIDADES ===================
function normalizeNumber(n){ return String(n).replace(/\D+/g, ""); }
function stripCountry57(d){
  if (!d) return "";
  if (d.startsWith("0057")) return d.slice(4);
  if (d.startsWith("57") && d.length > 2) return d.slice(2);
  return d;
}
function getNormalizedObjective(){
  const v = (accountIdEl.value || "").trim();
  const n = stripCountry57(normalizeNumber(v));
  return n || "";
}
function randomColor(){
  return '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
}

// Fecha: formateo en zona sin restas manuales
function formatInTZ(dateLike, tz = HLC_TZ) {
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
  if (Number.isNaN(+d)) return "-";
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: tz, hour12: false,
    year:'numeric', month:'numeric', day:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).format(d);
}
function formatUTC(dateLike){
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(String(dateLike));
  if (Number.isNaN(+d)) return "-";
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', hour12: false,
    year:'numeric', month:'numeric', day:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).format(d) + ' UTC';
}
function toHLCString(dateLike){ return formatInTZ(dateLike, HLC_TZ); }

// =================== FILE HELPERS ===================
function readFileAsText(file){
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsText(file, 'utf-8');
  });
}

// =================== PREVIEW & RENDER ===================
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

// =================== BATCH ===================
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

// =================== APLICAR RESPUESTA DEL SERVIDOR ===================
function setText(el, val){ if (el) el.textContent = (val == null || val === "") ? "-" : String(val); }
function resetServicePanel(){
  setServiceStart(null);
  setOSBuild("-");
  setConnState("-");
  setLastSeen(null);
  setLastIp("-");
  setLastPort(null);
  setISP("-");
  setIPVersion("-");
  setIPType("-");
  setCity("-");
  setCountry("", "-", "");
  setSecurityFlags(false, false, false);
}

function applyServerExtraction(data){
  // Account Identifier → objetivo
  if (data.account_identifier) {
    accountIdEl.value = stripCountry57(normalizeNumber(data.account_identifier));
  }

  // Contactos
  if (Array.isArray(data.contacts)) {
    const cleanedList = data.contacts
      .map(c => c.cleaned || c.digits || c.original)
      .filter(Boolean);
    currentContacts = cleanedList;
    const read = data.stats?.read ?? cleanedList.length;
    const uniq = cleanedList.length;
    const dup  = data.stats?.duplicates ?? Math.max(0, read - uniq);
    // reconstruir countsMap mínimo para grafo
    const countsMap = {};
    cleanedList.forEach(c => { countsMap[c] = (countsMap[c]||0) + 1; });
    currentCounts = { read, unique: uniq, duplicates: dup, countsMap };
  } else {
    currentContacts = [];
    currentCounts = { read: 0, unique: 0, duplicates: 0, countsMap: {} };
  }
  renderPreview();

  // Servicio / IP / Puerto / Device
  resetServicePanel();

  // Service start (opcional)
  if (data.service_start) setServiceStart(data.service_start);

  // Net endpoints: tomar el primero (si hay varios puedes listarlos aparte)
  const ep = data.net?.endpoints?.[0];
  if (ep) {
    setLastIp(ep.ip || "-");
    setLastPort(ep.port != null ? String(ep.port) : null);
    setIPVersion(ep.version === 6 ? "IPv6" : (ep.version === 4 ? "IPv4" : "-"));
    // Sin enrichment: usar is_private como tipo visible
    setIPType(ep.is_private ? "Privada" : "Pública");
  }

  // Device (si existe)
  const dev = data.device || null;
  if (dev) {
    // En tu UI "OS Build" mostrará os_version (o lo que prefieras)
    setOSBuild(dev.os_version || "-");
    // Si más adelante quieres mostrar manufacturer/model/app, añade campos nuevos en UI.
  }
}

// =================== EVENTOS (SERVER-SIDE) ===================
processBtn.addEventListener("click", async () => {
  const pasted = inputText.value || "";
  if (!pasted.trim()){
    alert("Pega el record.html o su contenido para procesar.");
    return;
  }
  try{
    const ok = await requestCredit();
    if (ok === false) return;
    const data = await callSmartExtractHTML(pasted);
    applyServerExtraction(data);
  }catch(err){
    console.error(err);
    alert("Error procesando en el servidor.");
  }
});

async function handleDroppedFiles(fileList){
  const files = Array.from(fileList || []);
  if (!files.length) return;

  try{
    const results = [];

    // Primero .zip → server
    const zipFiles = files.filter(f => /\.zip$/i.test(f.name));
    for (const z of zipFiles){
      try{
        const data = await callSmartExtractZIP(z);
        results.push(data);
      }catch(e){
        console.error("ZIP error:", e);
      }
    }

    // Luego .txt/.csv/.html → leer texto y enviar a server
    const textFiles = files.filter(f => /\.(txt|csv|html?)$/i.test(f.name));
    for (const f of textFiles){
      try{
        const html = await readFileAsText(f);
        const data = await callSmartExtractHTML(String(html||""));
        results.push(data);
      }catch(e){
        console.error("Text file error:", e);
      }
    }

    if (results.length){
      // Si arrastraron varios, usamos el último en la vista principal (y puedes empujar los demás al lote si quieres)
      const last = results[results.length - 1];
      applyServerExtraction(last);
      alert("Archivos cargados. Vista previa actualizada.");
      return;
    }

    alert("No se detectaron archivos compatibles o el servidor no pudo procesarlos.");
  }catch(err){
    console.error(err);
    alert("Error procesando archivos en el servidor.");
  }
}

// =================== BATCH / LIMPIEZA ===================
addToBatchBtn.addEventListener("click", () => {
  if (!currentContacts.length) { alert("No hay contactos."); return; }

  const objective = stripCountry57(normalizeNumber((accountIdEl.value || "").trim()));
  const caseId = (caseIdEl.value || '').trim();

  // Guardar snapshot de servicio en el lote (incluye puerto nuevo)
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
  resetServicePanel();
});

clearBatchBtn.addEventListener("click", () => {
  if (!confirm("¿Vaciar lote?")) return;
  batch=[]; renderBatch();
});

showAllEl.addEventListener("change", () => { renderPreview(); });
previewFilter.addEventListener("input", () => { renderPreview(); });
sortSelect.addEventListener("change", () => { renderPreview(); });

// =================== THEME / TOGGLES ===================
themeToggle.addEventListener("change", ()=>{
  settings.theme=themeToggle.checked?'light':'dark';
  document.body.setAttribute('data-theme', settings.theme);
  saveLocal();
  renderRelations();
});
anonToggle.addEventListener("change", ()=>{ settings.anonymize=anonToggle.checked; saveLocal(); renderPreview(); });
autosaveToggle.addEventListener("change", ()=>{ settings.autosave=autosaveToggle.checked; saveLocal(); });

// =================== DESCARGAS ===================
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
      ["Leídos", currentCounts.read || 0],
      ["Únicos", currentContacts.length || 0],
      ["Duplicados", currentCounts.duplicates || 0],
      ["Fecha", new Date().toISOString()]
    ];

    // Servicio (del estado actual)
    const rowsServicio = getServiceRowsForCurrent();

    // Hoja Residencial (si aplica)
    const resRows = getResidentialRowsForCurrent();

    const sheets = { "Datos": rowsDatos, "Resumen": rowsResumen, "Servicio": rowsServicio };
    if (resRows) sheets["Residencial"] = resRows;

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

    pushHistory({ ts, filename: `${objective}_contacts_${ts}`, total: currentCounts.read || 0, unique: currentContacts.length || 0 });

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
async function requestCredit(){
  if (window.Auth && typeof window.Auth.spendCredit === 'function'){
    try { return await window.Auth.spendCredit(); }
    catch (error) { console.error('No se pudo consumir crédito', error); return false; }
  }
  return true;
}

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
      const ok = await requestCredit();
      if(ok) await handleDroppedFiles(dt.files);
    } else alert("Suelta archivos válidos (.zip con records.html, o .txt/.csv/.html).");
  });
}

// =================== SUBIR ARCHIVOS (input[file]) ===================
if (uploadBtn && filePicker){
  uploadBtn.addEventListener('click', () => { filePicker.click(); });
  filePicker.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length){
      const ok = await requestCredit();
      if(ok) await handleDroppedFiles(files);
    }
    filePicker.value = "";
  });
}

// =================== PANEL SERVICIO — SETTERS BÁSICOS ===================
const GREEN_STATES_RX = /^(online|connected|en\s*línea|conectad[oa])$/i;
function setServiceStart(dateStrOrObj){
  if (!serviceStartEl) return;
  let disp = "-";
  if (dateStrOrObj){
    const d = new Date(String(dateStrOrObj));
    if (!Number.isNaN(+d)) disp = formatInTZ(d);
  }
  setText(serviceStartEl, disp);
  currentServiceInfo.serviceStart = disp;
}
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
function setLastPort(val){
  const v = (val == null || val === "") ? "-" : String(val);
  setText(lastPortEl, v);
  currentServiceInfo.lastPort = v;
}
function setISP(val){ const v = (val && String(val).trim()) || "-"; setText(ispEl, v); currentServiceInfo.isp = v; }
function setIPVersion(val){ const v = (val && String(val).trim()) || "-"; setText(ipVersionEl, v); currentServiceInfo.ipVersion = v; }
function setIPType(val){
  const v = (val && String(val).trim()) || "-";
  setText(ipTypeEl, v);
  currentServiceInfo.ipType = v;
  updateResidentialSection();
}
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

// Fechas humanizadas (si en futuro decides enviar last_seen desde server)
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
function setLastSeen(dateStrOrObj){
  if (!lastSeenEl) return;
  lastSeenEl.classList.remove('red','green');
  let disp = "-";
  let parsed = null;
  if (dateStrOrObj){
    parsed = new Date(String(dateStrOrObj));
    if (parsed && !Number.isNaN(+parsed)){
      disp = formatInTZ(parsed);
      const now = new Date();
      if (parsed < now) lastSeenEl.classList.add('red'); else lastSeenEl.classList.add('green');
    }
  }
  setText(lastSeenEl, disp);
  currentServiceInfo.lastSeen = disp;
  currentServiceInfo.lastSeenISO = parsed ? parsed.toISOString() : "";
  setLastSeenAgo(parsed);
  updateResidentialSection();
}

/* ====== Tabla residencial (sigue igual) ====== */
function generateResidentialRows(ip, lastSeenISO){
  if (!ip || !lastSeenISO) return null;
  const base = new Date(lastSeenISO);
  if (Number.isNaN(+base)) return null;

  const fDate = new Intl.DateTimeFormat('es-CO', { timeZone: HLC_TZ, hour12: false, year: 'numeric', month: 'numeric', day: 'numeric' });
  const fTime = new Intl.DateTimeFormat('es-CO', { timeZone: HLC_TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

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
    formatUTC(base),
    `${formatInTZ(base)} HLC`,
    windowStr
  ]);

  return rows;
}
function renderResidentialTable(){
  const tipo = (currentServiceInfo.ipType || "").toLowerCase();
  const isResidential = (tipo === "residencial"); // Si cambiaste a "Privada/Pública", esta lógica quedará oculta por defecto
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
  currentServiceInfo.residentialRows = rows;
}
function updateResidentialSection(){ renderResidentialTable(); }

// ====== helpers de exportación del panel ======
function getServiceRowsForCurrent(){
  return [
    ["Clave","Valor"],
    ["Service start", currentServiceInfo.serviceStart || "-"],
    ["Device OS Build Number", currentServiceInfo.osBuild || "-"],
    ["Connection State", currentServiceInfo.connState || "-"],
    ["Last seen", currentServiceInfo.lastSeen || "-"],
    ["Visto hace", currentServiceInfo.lastSeenAgo || "-"],
    ["Last IP", currentServiceInfo.lastIP || "-"],
    ["Puerto", currentServiceInfo.lastPort || "-"], // NUEVO
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
  const rows = [["Objetivo","Caso","Service start","Device OS Build Number","Connection State","Last seen","Visto hace","Last IP","Puerto","ISP","Versión","Tipo","Ciudad","País","Proxy","VPN","Tor"]];
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
      s.lastPort || "-",
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

// ====== Grafo / Chat (sin cambios funcionales) ======
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
    edges: { arrows: 'to', color: { color: 'rgba(148,163,184,.55)', highlight: '#38bdf8' }, smooth: { type: 'dynamic' } }
  };
  if (graphLayoutMode === 'hierarchical-lr'){
    base.layout = { hierarchical: { enabled: true, direction: 'LR', nodeSpacing: 220, levelSeparation: 220, sortMethod: 'hubsize' } };
    base.physics = { enabled: false };
  } else if (graphLayoutMode === 'hierarchical-ud'){
    base.layout = { hierarchical: { enabled: true, direction: 'UD', nodeSpacing: 200, levelSeparation: 200, sortMethod: 'hubsize' } };
    base.physics = { enabled: false };
  } else {
    base.layout = { randomSeed: graphRandomSeed, improvedLayout: false };
    base.physics = { enabled: true, solver: 'forceAtlas2Based', stabilization: { iterations: 220 }, barnesHut: { springLength: 160, avoidOverlap: 0.25 } };
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
      if (!n.title) return;
      const pos = network.getPositions([n.id])[n.id];
      if (!pos) return;
      ctx.fillText(n.title, pos.x, pos.y + 32);
    });
    ctx.restore();
  });
}
function renderGraphNetwork(nodeArr, edges){
  if (!graphEl) return;
  const options = getGraphOptions();
  const data = { nodes: new vis.DataSet(nodeArr), edges: new vis.DataSet(edges) };
  if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
  graphNetwork = new vis.Network(graphEl, data, options);
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
}
function renderGraph(numbers){
  if (!graphEl) return;
  const list = Array.isArray(numbers) ? numbers : [];
  if (!list.length){
    if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
    graphEl.innerHTML = '<div class="muted">Sin contactos para graficar</div>';
    return false;
  }
  graphEl.innerHTML = '';
  const objectiveLabel = getNormalizedObjective() || 'Objetivo';
  const nodeArr = [{ id: 'root', label: objectiveLabel, shape: 'box', color: { background: '#0ea5e9', border: '#0b8ec7' }, font: { color: '#041024' } }];
  const edges = [];
  list.forEach((n, i) => {
    const freq = currentCounts.countsMap[n] || 1;
    nodeArr.push({ id: i, label: String(freq), title: n, value: Math.max(1, freq) });
    edges.push({ from: 'root', to: i });
  });
  renderGraphNetwork(nodeArr, edges);
  return true;
}
function renderBatchGraph(){
  if (!graphEl) return;
  const nodeArr = [];
  const edges = [];
  const owners = new Map();
  batch.forEach((item, idx) => {
    const id = `item-${idx}`;
    nodeArr.push({ id, label: item.objective || `Reporte ${idx + 1}`, shape: 'box', color: { background: item.color }, font: { color: '#041024' } });
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
    nodeArr.push({ id: cid, label: String(freq), title: contact, color, value: Math.max(1, freq) });
    set.forEach(id => edges.push({ from: id, to: cid }));
  });
  if (edges.length === 0) {
    if (graphNetwork) { graphNetwork.destroy(); graphNetwork = null; }
    graphEl.innerHTML = '<div class="muted">Sin datos en el lote</div>';
    return false;
  }
  graphEl.innerHTML = '';
  renderGraphNetwork(nodeArr, edges);
  return true;
}
function setGraphControlsEnabled(enabled){
  if (graphLayoutSelect) graphLayoutSelect.disabled = !enabled;
  if (graphRefreshBtn) graphRefreshBtn.disabled = !enabled;
}
function renderRelations(){
  let hasData = false;
  if(batch.length>0) hasData = !!renderBatchGraph();
  else if(currentContacts.length) hasData = !!renderGraph(currentContacts);
  else{
    if(graphNetwork){ graphNetwork.destroy(); graphNetwork=null; }
    if(graphEl) graphEl.innerHTML='';
  }
  setGraphControlsEnabled(hasData);
}

// ====== Chat (igual) ======
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

// ====== Fullscreen Grafo ======
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

// =================== INIT ===================
function initCore(){
  restoreLocal();
  renderPreview();
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
