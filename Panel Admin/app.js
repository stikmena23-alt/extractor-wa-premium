/************* CONFIG *************/
const SUPABASE_URL = 'https://htkwcjhcuqyepclpmpsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0a3djamhjdXF5ZXBjbHBtcHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTk4MTgsImV4cCI6MjA3MzQ5NTgxOH0.dBeJjYm12YW27LqIxon5ifPR1ygfFXAHVg8ZuCZCEf8';

/* ✅ Múltiples administradores:
   - Agrega o quita correos aquí.
   - Se hace toLowerCase al comparar. */
const ADMIN_EMAILS = new Set([
  'stikmena6@gmail.com',
  'admin.kevinqt@wftools.com',
  'admin.devinsonmq@wftools.com',
  'admin.franciscojm@wftools.com',
  // 'otro.admin@tu-dominio.com',
]);

const FUNCTIONS_BASE = SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co');

// ✅ Ruta del LOGO (PNG) para el UI
const LOGO_URL = './WF TOOLS.png';
const CLIENT_APP_URL = '../WF-TOOLS/index.html';

const ENDPOINTS = {
  list: 'admin-list',
  update: 'admin-update',
  recovery: 'admin-recovery',
  setPassword: 'admin-setpassword',
  block: 'admin-block',
  remove: 'admin-delete',
  blockedList: 'admin-blocked',
};

/************* STATE *************/
const supabaseManager = window.WFSupabase || null;
const SUPABASE_SESSION_THRESHOLD_MS = 90_000;

let sb = null;
if (supabaseManager && typeof supabaseManager.init === "function") {
  sb = supabaseManager.init({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    refreshIntervalMs: 180000,
    refreshThresholdMs: SUPABASE_SESSION_THRESHOLD_MS,
  });
}
if (!sb) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let page = 1; const perPage = 10; let currentRows = []; let currentEdit = null;
let lastSummary = { creditCount: 0, activeCount: 0, inactiveCount: 0, lowCount: 0, reportingCount: 0, totalRows: 0, blockedCount: 0 };
let blockModalState = null;
let blockedSummaryOverride = null;
const activeBlockCache = new Map();
let filterMode = 'all';
let blockedUsers = [];
let blockedLoading = false;
let blockedLoadPromise = null;
let unblockModalState = null;
let blockedViewActive = false;
let passwordModalState = null;
let deleteModalState = null;

const DEFAULT_BLOCK_AMOUNT = 12;

const qs = sel => document.querySelector(sel);
const $rows = qs('#rows'), $cards = qs('#cards'), $empty = qs('#empty'), $skeleton = qs('#skeleton');
const loginView = qs('#loginView'), adminView = qs('#adminView'), loginError = qs('#loginError');
const btnLogin = qs('#btnLogin'), btnLoginText = btnLogin?.querySelector('.btn-text'), btnLoginSpinner = btnLogin?.querySelector('.btn-spinner');
const emailInput = qs('#email');
const passwordInput = qs('#password');
const rememberCheck = qs('#rememberUser');
const togglePasswordBtn = qs('#togglePassword');
const togglePasswordText = togglePasswordBtn?.querySelector('.toggle-text');
const togglePasswordIcon = togglePasswordBtn?.querySelector('.icon');
const $overlay = qs('#overlay');
const $creditSummary = qs('#creditSummary');
const sessionOverlay = qs('#sessionOverlay');
const sessionMessage = sessionOverlay?.querySelector('.session-message');
const numberFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const averageFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const currencyFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const REMEMBER_KEY = 'wf-toolsadmin:remembered-email';
const CREDIT_VALUE = 10000;

/* ✅ NUEVO: refs de la banda de usuario conectado */
const cuBox = qs('#currentUserBox');
const cuName = qs('#cuName');
const cuEmail = qs('#cuEmail');
const accountPanel = qs('#accountPanel');
const accountUserName = qs('#accountUserName');
const accountUserEmail = qs('#accountUserEmail');
const accountTotalCreditsEl = qs('#accountTotalCredits');
const accountTotalCreditsDetailEl = qs('#accountTotalCreditsDetail');
const accountActiveCountEl = qs('#accountActiveCount');
const accountAlertsEl = qs('#accountAlerts');
const accountStatusTag = qs('#accountStatusTag');
const btnGoClient = qs('#btnGoClient');
const btnLoginGoClient = qs('#btnLoginGoClient');

const blockModal = qs('#blockModal');
const blockModalTitle = qs('#blockModalTitle');
const blockModalSubtitle = qs('#blockModalSubtitle');
const blockAmountInput = qs('#blockAmount');
const blockUnitInputs = Array.from(blockModal?.querySelectorAll('input[name="blockUnit"]') || []);
const blockQuickButtons = Array.from(blockModal?.querySelectorAll('[data-quick-unit]') || []);
const blockCustomUntilInput = qs('#blockCustomUntil');
const blockSummarySince = qs('#blockSummarySince');
const blockSummaryUntil = qs('#blockSummaryUntil');
const blockSummaryDuration = qs('#blockSummaryDuration');
const blockError = qs('#blockError');
const btnBlockConfirm = qs('#btnBlockConfirm');
const btnBlockCancel = qs('#blockModalCancel');
const btnBlockClose = qs('#blockModalClose');
const unblockModal = qs('#unblockModal');
const unblockModalTitle = qs('#unblockModalTitle');
const unblockModalSubtitle = qs('#unblockModalSubtitle');
const unblockModalDescription = qs('#unblockModalDescription');
const unblockModalMeta = qs('#unblockModalMeta');
const btnUnblockConfirm = qs('#btnUnblockConfirm');
const btnUnblockCancel = qs('#unblockModalCancel');
const btnUnblockClose = qs('#unblockModalClose');
const filterButtons = Array.from(document.querySelectorAll('[data-filter-mode]'));
const blockedDrawer = qs('#blockedDrawer');
const blockedListEl = qs('#blockedList');
const blockedEmptyEl = qs('#blockedEmpty');
const blockedStatusEl = qs('#blockedStatus');
const btnToggleBlocked = qs('#btnToggleBlocked');
const btnCloseBlocked = qs('#btnCloseBlocked');
const btnRefreshBlocked = qs('#btnRefreshBlocked');
const passwordModal = qs('#passwordModal');
const passwordModalSubtitle = qs('#passwordModalSubtitle');
const passwordModalInput = qs('#passwordModalInput');
const passwordModalError = qs('#passwordModalError');
const btnPasswordConfirm = qs('#passwordModalConfirm');
const btnPasswordCancel = qs('#passwordModalCancel');
const btnPasswordClose = qs('#passwordModalClose');
const deleteModal = qs('#deleteModal');
const deleteModalSubtitle = qs('#deleteModalSubtitle');
const deleteModalMeta = qs('#deleteModalMeta');
const btnDeleteConfirm = qs('#deleteModalConfirm');
const btnDeleteCancel = qs('#deleteModalCancel');
const btnDeleteClose = qs('#deleteModalClose');

// Inyectar logo en login y header (con seguridad si no existen)
const loginLogoEl = qs('#loginLogo');
if (loginLogoEl) loginLogoEl.src = LOGO_URL;
const headerLogoEl = qs('#headerLogo');
if (headerLogoEl) headerLogoEl.src = LOGO_URL;

function rememberEmail(value){
  try {
    const trimmed = (value || '').trim();
    if(rememberCheck?.checked && trimmed){
      localStorage.setItem(REMEMBER_KEY, trimmed);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
  } catch(err){
    console.warn('No se pudo recordar el correo', err);
  }
}

function loadRememberedEmail(){
  if(!emailInput || !rememberCheck) return;
  try {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if(stored){
      emailInput.value = stored;
      rememberCheck.checked = true;
    }
  } catch(err){
    console.warn('No se pudo cargar el correo recordado', err);
  }
}

/************* UI HELPERS *************/
function show(v){
  if(!v) return;
  if(v.classList && v.classList.contains('view')){
    const desired = v.dataset.display || 'block';
    v.style.display = desired;
    requestAnimationFrame(()=> v.classList.add('active'));
  } else {
    v.style.display='block';
  }
}
function hide(v){
  if(!v) return;
  if(v.classList && v.classList.contains('view')){
    v.classList.remove('active');
    setTimeout(()=>{ v.style.display='none'; }, 220);
  } else {
    v.style.display='none';
  }
}

function overlay(on){ $overlay?.classList.toggle('show', !!on); }
function sessionLoading(on, text='Gestionando sesión…'){
  if(!sessionOverlay) return;
  if(on){
    if(sessionMessage) sessionMessage.textContent = text;
    sessionOverlay.style.display='flex';
    requestAnimationFrame(()=> sessionOverlay.classList.add('show'));
  } else {
    sessionOverlay.classList.remove('show');
    setTimeout(()=>{
      sessionOverlay.style.display='none';
      if(sessionMessage) sessionMessage.textContent='';
    }, 220);
  }
}
function toast(msg, type='ok'){
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, { position:'fixed', bottom:'18px', right:'18px', padding:'10px 14px', border:'1px solid var(--border)', borderRadius:'12px', boxShadow:'var(--shadow)', zIndex:60 });
  const colors = { ok:['#0c1912','#a7f3d0'], warn:['#1a150a','#fde68a'], err:['#1a0e0e','#fecaca'] };
  const [bg, fg] = colors[type] || colors.ok; el.style.background = bg; el.style.color = fg; document.body.append(el); setTimeout(()=>el.remove(), 2800);
}

function avatarFor(){ return `<div class="avatar"><img src="${LOGO_URL}" alt="WF TOOLS" /></div>` }

function escapeHTML(str){
  if(str == null) return '';
  const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch] || ch);
}

function isAdminRow(user){
  if(!user) return false;
  if (user.is_admin === true || user.admin === true || user.isAdmin === true) return true;
  const email = (user.email || '').toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) return true;
  const roleFields = [
    user.role,
    user.user_role,
    user.account_role,
    user.account_type,
    user.type,
    user.kind,
    user.plan_role,
    user.app_role,
    user.segment,
  ];
  const normalizedRoles = roleFields
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean);
  if (normalizedRoles.some((value) => value.includes('admin') || value.includes('staff'))) {
    return true;
  }
  if (Array.isArray(user.tags) && user.tags.some((tag) => typeof tag === 'string' && tag.toLowerCase().includes('admin'))) {
    return true;
  }
  const synthetic = {
    email: user.email,
    app_metadata: Object.assign({}, user.app_metadata, user.metadata, user.meta, {
      role: normalizedRoles[0] || user.app_metadata?.role,
    }),
    user_metadata: Object.assign({}, user.user_metadata, {
      role: normalizedRoles[0] || user.user_metadata?.role,
      isAdmin: user.is_admin ?? user.admin ?? user.isAdmin,
    }),
  };
  return isAdminUser(synthetic);
}

function parseDate(value){
  if(!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(date){
  if(!date) return '';
  try {
    return date.toLocaleString('es-CO', { dateStyle:'medium', timeStyle:'short' });
  } catch {
    return date.toISOString();
  }
}

function isTruthyFlag(value){
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (['true','1','yes','y','on','activo','activa','active','si','sí','t'].includes(normalized)) return true;
    if (normalized === 'permanent' || normalized === 'perma' || normalized === 'permanente') return true;
    return false;
  }
  if (typeof value === 'object') {
    if (!value) return false;
    if ('active' in value) return isTruthyFlag(value.active);
    if ('enabled' in value) return isTruthyFlag(value.enabled);
  }
  return false;
}

function getBanState(user){
  const meta = user?.user_metadata || {};
  const appMeta = user?.app_metadata || {};
  const topLevelBan = (user?.ban && typeof user.ban === 'object') ? user.ban : null;
  const userBan = (meta?.ban && typeof meta.ban === 'object') ? meta.ban : null;
  const appBan = (appMeta?.ban && typeof appMeta.ban === 'object') ? appMeta.ban : null;
  const directFlags = (typeof user === 'object' && user) ? user : {};
  const statusCandidates = [
    user?.ban_status,
    user?.status,
    topLevelBan?.status,
    appMeta?.status,
    meta?.status,
    appMeta?.ban_status,
    meta?.ban_status,
    appMeta?.ban_state,
    meta?.ban_state,
    userBan?.status,
    appBan?.status,
    directFlags?.ban_status,
    directFlags?.ban_state,
    directFlags?.banState,
    directFlags?.status,
    directFlags?.state,
    directFlags?.block_status,
    directFlags?.blockState,
    directFlags?.block_state,
    directFlags?.banStatus,
    directFlags?.reason,
    directFlags?.ban?.status,
    directFlags?.block?.status,
  ];
  const normalizedStatus = statusCandidates
    .map((value) => (value == null ? '' : String(value).toLowerCase()))
    .find((value) => value);
  const statusBlocked = normalizedStatus
    ? ['banned', 'blocked', 'bloqueado', 'baneado', 'suspendido', 'suspensión', 'suspendida', 'permanent', 'permanente', 'indefinido']
        .some((keyword) => normalizedStatus.includes(keyword))
    : false;
  const flaggedExplicitly = [
    user?.is_banned,
    user?.banned,
    topLevelBan?.active,
    topLevelBan?.blocked,
    meta?.is_banned,
    meta?.banned,
    meta?.ban_active,
    userBan?.active,
    userBan?.blocked,
    appMeta?.is_banned,
    appMeta?.banned,
    appMeta?.ban_active,
    appBan?.active,
    appBan?.blocked,
    directFlags?.blocked,
    directFlags?.is_blocked,
    directFlags?.ban_active,
    directFlags?.active_block,
    directFlags?.banActive,
    directFlags?.block_active,
    directFlags?.active,
    directFlags?.ban?.active,
    directFlags?.block?.active,
  ].some(isTruthyFlag);
  const untilCandidates = [
    user?.ban_expires,
    user?.banned_until,
    user?.bannedUntil,
    user?.blocked_until,
    user?.blockedUntil,
    directFlags?.ban_expires,
    directFlags?.blocked_until,
    directFlags?.ban_until,
    directFlags?.blockedUntil,
    directFlags?.block_until,
    topLevelBan?.until,
    topLevelBan?.expires_at,
    topLevelBan?.expires,
    meta?.ban_expires,
    meta?.banned_until,
    meta?.ban_until,
    meta?.ban?.until,
    userBan?.until,
    userBan?.expires_at,
    userBan?.expires,
    appMeta?.ban_expires,
    appMeta?.banned_until,
    appMeta?.ban_until,
    appMeta?.ban?.until,
    appBan?.until,
    appBan?.expires_at,
    appBan?.expires,
    directFlags?.ban?.until,
    directFlags?.block?.until,
  ];
  const until = untilCandidates.map(parseDate).find(Boolean) || null;
  const sinceCandidates = [
    user?.blocked_at,
    user?.blockedAt,
    user?.banned_at,
    user?.bannedAt,
    directFlags?.blocked_at,
    directFlags?.banned_at,
    directFlags?.ban_since,
    directFlags?.block_since,
    directFlags?.banSince,
    topLevelBan?.since,
    topLevelBan?.from,
    topLevelBan?.started_at,
    topLevelBan?.startedAt,
    userBan?.since,
    userBan?.from,
    userBan?.started_at,
    userBan?.startedAt,
    appBan?.since,
    appBan?.from,
    appBan?.started_at,
    appBan?.startedAt,
    directFlags?.ban?.since,
    directFlags?.block?.since,
  ];
  const since = sinceCandidates.map(parseDate).find(Boolean) || null;
  const durationCandidates = [
    user?.ban_duration,
    topLevelBan?.duration,
    meta?.ban_duration,
    userBan?.duration,
    appMeta?.ban_duration,
    appBan?.duration,
    directFlags?.ban_duration,
    directFlags?.ban?.duration,
  ];
  const rawDuration = durationCandidates
    .map((value) => (value == null ? '' : String(value).toLowerCase()))
    .find((value) => value);
  let isBlocked = false;
  if (until){
    isBlocked = until.getTime() > Date.now();
  }
  if (!isBlocked){
    const hasDuration = rawDuration && rawDuration !== 'none' && rawDuration !== '0' && rawDuration !== '0h';
    const durationSuggestsPermanent = rawDuration && /perma|indefin|forever|sin limite|sin límite/.test(rawDuration);
    const statusSuggestsPermanent = normalizedStatus && /perma|indefin|forever/.test(normalizedStatus);
    isBlocked = statusBlocked || flaggedExplicitly || hasDuration || durationSuggestsPermanent || statusSuggestsPermanent;
  }
  return {
    isBlocked,
    until,
    since,
  };
}

function normalizeBlockEntry(entry){
  if (!entry || typeof entry !== 'object') return null;
  const result = {};
  const nestedBan = typeof entry.ban === 'object' && entry.ban ? entry.ban : null;
  const nestedMeta = typeof entry.meta === 'object' && entry.meta ? entry.meta : null;
  const statusCandidates = [
    entry.status,
    entry.state,
    entry.block_status,
    entry.blockState,
    entry.ban_status,
    entry.reason,
    nestedBan?.status,
    nestedMeta?.status,
  ].filter((value) => value != null && value !== '');
  if (statusCandidates.length) {
    result.status = String(statusCandidates[0]);
  }
  const activeCandidates = [
    entry.active,
    entry.is_active,
    entry.enabled,
    entry.blocked,
    entry.is_blocked,
    entry.banned,
    entry.isBanned,
    entry.active_block,
    entry.blockActive,
    nestedBan?.active,
    nestedMeta?.active,
    nestedMeta?.enabled,
  ];
  const activeValue = activeCandidates.find((value) => value !== undefined);
  if (activeValue !== undefined) {
    result.active = isTruthyFlag(activeValue);
  }
  const untilCandidates = [
    entry.until,
    entry.until_at,
    entry.until_date,
    entry.untilIso,
    entry.expires_at,
    entry.expires,
    entry.blocked_until,
    entry.banned_until,
    entry.end_at,
    nestedBan?.until,
    nestedBan?.expires_at,
    nestedBan?.expires,
    nestedMeta?.until,
    nestedMeta?.expires_at,
  ];
  const sinceCandidates = [
    entry.since,
    entry.since_at,
    entry.started_at,
    entry.start_at,
    entry.blocked_at,
    entry.banned_at,
    entry.created_at,
    nestedBan?.since,
    nestedBan?.started_at,
    nestedMeta?.since,
  ];
  const parse = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return null;
    return date;
  };
  const untilDate = untilCandidates.map(parse).find(Boolean);
  const sinceDate = sinceCandidates.map(parse).find(Boolean);
  if (untilDate) result.until = untilDate;
  if (sinceDate) result.since = sinceDate;
  return result;
}

function normalizeBlockedRecord(entry){
  if (!entry || typeof entry !== 'object') return null;
  const id = entry.user_id || entry.userId || entry.profile_id || entry.profileId || entry.uid || entry.id;
  if (!id) return null;
  const contactEmail = entry.contact_email || entry.contactEmail || null;
  const authEmail = entry.auth_email || entry.authEmail || entry.user_email || entry.userEmail || null;
  const baseEmail = entry.email || entry.identity || null;
  const email = baseEmail || contactEmail || authEmail || '';
  const name =
    entry.full_name ||
    entry.name ||
    entry.display_name ||
    entry.profile_name ||
    entry.owner_name ||
    entry.contact_name ||
    '';
  const since = parseDate(
    entry.blocked_at ||
      entry.banned_at ||
      entry.start_at ||
      entry.started_at ||
      entry.since ||
      entry.created_at ||
      entry.inserted_at,
  );
  const until = parseDate(
    entry.blocked_until ||
      entry.banned_until ||
      entry.end_at ||
      entry.expires_at ||
      entry.expires ||
      entry.until ||
      entry.valid_until,
  );
  const reason = entry.reason || entry.note || entry.notes || entry.detail || entry.cause || entry.motive || '';
  const plan = entry.plan || entry.account_plan || entry.tier || entry.subscription || null;
  const creditsRaw = entry.credits ?? entry.credit_balance ?? entry.total_credits ?? entry.creditCount;
  let credits = null;
  if (creditsRaw !== undefined && creditsRaw !== null && creditsRaw !== '') {
    const numericCredits = Number(creditsRaw);
    if (Number.isFinite(numericCredits)) credits = numericCredits;
  }
  const phone = entry.phone_number || entry.phone || entry.contact_phone || null;
  const actorEmail = entry.actor_email || entry.actorEmail || null;
  const checkedAt = parseDate(
    entry.checked_at ||
      entry.checkedAt ||
      entry.updated_at ||
      entry.updatedAt
  );
  return {
    id: String(id),
    email,
    name,
    since,
    until,
    reason,
    plan: plan || null,
    credits,
    phone: phone || null,
    authEmail: authEmail || null,
    contactEmail: contactEmail || null,
    actorEmail: actorEmail || null,
    checkedAt,
    source: entry.source || entry.origin || null,
    raw: entry,
  };
}

function registerBlockedCache(record){
  if (!record || !record.id) return;
  const payload = Object.assign({}, record.raw || {}, {
    user_id: record.raw?.user_id || record.raw?.userId || record.raw?.profile_id || record.id,
    email: record.email,
    full_name: record.name,
    blocked_at: record.raw?.blocked_at || (record.since instanceof Date ? record.since.toISOString() : record.raw?.blocked_at),
    blocked_until:
      record.raw?.blocked_until || (record.until instanceof Date ? record.until.toISOString() : record.raw?.blocked_until),
    banned_until:
      record.raw?.banned_until || (record.until instanceof Date ? record.until.toISOString() : record.raw?.banned_until),
    auth_email: record.authEmail || record.raw?.auth_email || null,
    contact_email: record.contactEmail || record.raw?.contact_email || null,
    reason: record.raw?.reason || record.reason || null,
    actor_email: record.raw?.actor_email || record.actorEmail || null,
    updated_at:
      record.raw?.updated_at ||
      (record.checkedAt instanceof Date ? record.checkedAt.toISOString() : record.raw?.updated_at),
    checked_at:
      record.raw?.checked_at ||
      (record.checkedAt instanceof Date ? record.checkedAt.toISOString() : record.raw?.checked_at),
    source: record.raw?.source || record.source || record.raw?.origin || null,
  });
  activeBlockCache.set(String(record.id), payload);
}

function applyBlockedDataset(records){
  if (!Array.isArray(records) || !records.length) return;
  records.forEach(registerBlockedCache);
}

function setBlockedStatus(message, { loading = false } = {}){
  if (!blockedStatusEl) return;
  if (!message) {
    blockedStatusEl.hidden = true;
    blockedStatusEl.textContent = '';
    blockedStatusEl.classList.remove('loading');
    return;
  }
  blockedStatusEl.hidden = false;
  blockedStatusEl.textContent = message;
  blockedStatusEl.classList.toggle('loading', !!loading);
}

function updateBlockedToggleButton(){
  if (!btnToggleBlocked) return;
  btnToggleBlocked.setAttribute('aria-expanded', blockedViewActive ? 'true' : 'false');
  btnToggleBlocked.setAttribute('aria-pressed', blockedViewActive ? 'true' : 'false');
  const label = btnToggleBlocked.querySelector('.btn-text') || btnToggleBlocked.querySelector('span:last-child');
  if (label) {
    label.textContent = blockedViewActive ? 'Ocultar bloqueados' : 'Mostrar bloqueados';
  }
}

async function withButtonLoading(button, action, { loadingText = 'Procesando…', spinnerText = '⏳', minDelay = 0 } = {}){
  if (typeof action !== 'function') return;
  if (!button) {
    return action();
  }
  const textEl = button.querySelector('.btn-text');
  const spinnerEl = button.querySelector('.btn-spinner');
  const originalText = textEl ? textEl.textContent : '';
  const originalSpinnerText = spinnerEl ? spinnerEl.textContent : '';
  const originalDisplay = spinnerEl ? spinnerEl.style.display : '';
  const wasDisabled = button.disabled;
  button.disabled = true;
  if (textEl && typeof loadingText === 'string') {
    textEl.textContent = loadingText;
  }
  if (spinnerEl) {
    if (typeof spinnerText === 'string') spinnerEl.textContent = spinnerText;
    spinnerEl.style.display = 'inline-flex';
  }
  const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());
  const started = getNow();
  let result;
  let caughtError;
  try {
    result = await action();
  } catch (err) {
    caughtError = err;
  } finally {
    const elapsed = getNow() - started;
    if (minDelay && elapsed < minDelay) {
      await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
    }
    if (textEl) {
      textEl.textContent = originalText ?? '';
    }
    if (spinnerEl) {
      spinnerEl.textContent = originalSpinnerText ?? '';
      spinnerEl.style.display = originalDisplay || 'none';
    }
    button.disabled = wasDisabled;
  }
  if (caughtError !== undefined) {
    throw caughtError;
  }
  return result;
}

function setBlockedDrawerVisible(show, { skipRenderRows = false } = {}){
  if (!blockedDrawer) return;
  blockedViewActive = !!show;
  blockedDrawer.hidden = !blockedViewActive;
  updateBlockedToggleButton();
  if (!skipRenderRows) {
    renderRows();
  }
  if (!blockedViewActive) {
    setBlockedStatus('');
    return;
  }
  renderBlockedUsers();
  if (blockedLoading) {
    setBlockedStatus('Consultando bloqueos…', { loading: true });
    return;
  }
  if (!blockedUsers.length) {
    setBlockedStatus('Consultando bloqueos…', { loading: true });
    loadBlockedUsers({ force: true });
  } else {
    setBlockedStatus(`Total: ${numberFmt.format(blockedUsers.length)}`);
  }
}

function toggleBlockedDrawer(){
  setBlockedDrawerVisible(!blockedViewActive);
}

function renderBlockedUsers(){
  if (!blockedListEl || !blockedEmptyEl) return;
  blockedListEl.innerHTML = '';
  if (!blockedUsers.length) {
    blockedEmptyEl.hidden = false;
    return;
  }
  blockedEmptyEl.hidden = true;
  blockedUsers.forEach((record) => {
    const card = document.createElement('div');
    card.className = 'blocked-card';
    const email = escapeHTML(record.email || '—');
    const name = record.name ? escapeHTML(record.name) : '—';
    const sinceText = record.since ? formatDateTime(record.since) : '—';
    const untilText = record.until ? formatDateTime(record.until) : 'Indefinido';
    const detailText = composeBanTitle({ until: record.until, since: record.since });
    const elapsedText = record.since ? formatElapsedDuration(record.since) : '';
    const reasonText = record.reason
      ? `<span class="detail-line">Motivo: ${escapeHTML(record.reason)}</span>`
      : '';
    const elapsedLine = elapsedText
      ? `<span class="elapsed-line">Transcurrido: <strong>${escapeHTML(elapsedText)}</strong></span>`
      : '';
    const metaParts = [];
    if (record.plan) metaParts.push(`Plan: <strong>${escapeHTML(record.plan)}</strong>`);
    if (Number.isFinite(record.credits)) metaParts.push(`Créditos: <strong>${escapeHTML(numberFmt.format(record.credits))}</strong>`);
    if (record.phone) metaParts.push(`Tel: ${escapeHTML(record.phone)}`);
    const metaLine = metaParts.length ? `<span class="meta-line">${metaParts.join(' · ')}</span>` : '';
    const normalizedEmail = (record.email || '').toLowerCase();
    const contactParts = [];
    if (record.authEmail && record.authEmail.toLowerCase() !== normalizedEmail) {
      contactParts.push(`Acceso: <strong>${escapeHTML(record.authEmail)}</strong>`);
    }
    if (record.contactEmail && record.contactEmail.toLowerCase() !== normalizedEmail) {
      contactParts.push(`Contacto: <strong>${escapeHTML(record.contactEmail)}</strong>`);
    }
    const contactLine = contactParts.length ? `<span class="meta-line">${contactParts.join(' · ')}</span>` : '';
    const idLine = record.id ? `<span class="meta-line">ID: <strong>${escapeHTML(record.id)}</strong></span>` : '';
    const checkedLine = record.checkedAt ? `<span>Revisado: ${escapeHTML(formatDateTime(record.checkedAt))}</span>` : '';
    card.innerHTML = `
      <div class="blocked-card__info">
        <span class="email">${email}</span>
        <span class="name">${name}</span>
        ${idLine}
        ${metaLine}
        ${contactLine}
        ${reasonText}
        <span class="detail-line">${escapeHTML(detailText)}</span>
        ${elapsedLine}
      </div>
      <div class="blocked-card__dates">
        <span>Desde: ${escapeHTML(sinceText)}</span>
        <span>Hasta: ${escapeHTML(untilText)}</span>
        ${checkedLine}
      </div>
    `;
    blockedListEl.append(card);
  });
}

function extractBlockedArray(payload){
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.blockedUsers)) return payload.blockedUsers;
  if (Array.isArray(payload.bannedUsers)) return payload.bannedUsers;
  return [];
}

async function fetchBlocksByIdentifiers({ ids = [], emails = [] } = {}){
  const uniqIds = Array.from(new Set(ids.map((value) => String(value).trim()).filter(Boolean)));
  const uniqEmails = Array.from(new Set(emails.map((value) => String(value).trim()).filter(Boolean)));
  const desiredLimit = Math.min(Math.max((uniqIds.length + uniqEmails.length) || 1, 10), 200);
  const query = { limit: desiredLimit };
  if (uniqIds.length) query.userId = uniqIds;
  if (uniqEmails.length) query.email = uniqEmails;
  if (!Object.keys(query).length) return [];
  try {
    const res = await api(ENDPOINTS.blockedList, { method: 'GET', query });
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      console.warn('No se pudieron obtener bloqueos específicos', message);
      return [];
    }
    const payload = await res.json().catch(() => null);
    const rows = extractBlockedArray(payload);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn('Error consultando bloqueos específicos', err);
    return [];
  }
}

async function loadBlockedUsers({ force = false, silent = false } = {}){
  if (blockedLoading) {
    if (!force) return blockedLoadPromise;
    try {
      await blockedLoadPromise;
    } catch (_) {
      // ignore previous failure and retry
    }
  }

  if (!silent) {
    setBlockedStatus('Consultando bloqueos…', { loading: true });
  }

  const task = (async () => {
    blockedLoading = true;
    if(blockedEmptyEl) blockedEmptyEl.hidden = true;
    try {
      const res = await api(ENDPOINTS.blockedList, { method: 'GET', query: { limit: 500 } });
      if (res.networkError) {
        setBlockedStatus('No se pudo conectar con Supabase.');
        blockedUsers = [];
        blockedSummaryOverride = 0;
        renderBlockedUsers();
        return [];
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('blockedList error:', txt);
        setBlockedStatus('Error al consultar usuarios bloqueados.');
        return [];
      }
      const payload = await res.json();
      let rawList = extractBlockedArray(payload);
      if (!Array.isArray(rawList)) rawList = [];
      const normalized = rawList.map(normalizeBlockedRecord).filter(Boolean);
      normalized.sort((a, b) => {
        const untilA = a.until instanceof Date ? a.until.getTime() : 0;
        const untilB = b.until instanceof Date ? b.until.getTime() : 0;
        if (untilA !== untilB) return untilB - untilA;
        const sinceA = a.since instanceof Date ? a.since.getTime() : 0;
        const sinceB = b.since instanceof Date ? b.since.getTime() : 0;
        return sinceB - sinceA;
      });
      blockedUsers = normalized;
      applyBlockedDataset(normalized);
      const totalCount = Number.isFinite(Number(payload.blockedTotal))
        ? Number(payload.blockedTotal)
        : normalized.length;
      blockedSummaryOverride = totalCount;
      renderBlockedUsers();
      if (totalCount) {
        setBlockedStatus(`Total: ${numberFmt.format(totalCount)}`);
      } else {
        setBlockedStatus('Sin bloqueos activos');
      }
      if (currentRows.length) {
        await enrichUsersWithActiveBlocks(currentRows, { blockedUsers: rawList });
        renderRows();
      }
      return normalized;
    } catch (err) {
      console.error('Error obteniendo bloqueados', err);
      blockedUsers = [];
      blockedSummaryOverride = 0;
      renderBlockedUsers();
      setBlockedStatus('Error obteniendo bloqueados.');
      return [];
    } finally {
      blockedLoading = false;
      blockedLoadPromise = null;
    }
  })();

  blockedLoadPromise = task;
  return task;
}

async function enrichUsersWithActiveBlocks(users, payload){
  if (!Array.isArray(users) || !users.length) return;
  const blockMap = new Map();
  const register = (entry) => {
    if (!entry || typeof entry !== 'object') return;
    const id =
      entry.user_id ||
      entry.userId ||
      entry.uid ||
      entry.id ||
      entry.user ||
      entry.profile_id ||
      entry.profileId;
    if (!id) return;
    const key = String(id);
    const normalized = Object.assign({}, entry, {
      user_id:
        entry.user_id ||
        entry.profile_id ||
        entry.profileId ||
        entry.id ||
        key,
    });
    if (normalized.banned_until && !normalized.blocked_until) {
      normalized.blocked_until = normalized.banned_until;
    }
    if (!('blocked' in normalized) && !('is_blocked' in normalized)) {
      normalized.blocked = true;
      normalized.is_blocked = true;
    } else if (!('is_blocked' in normalized)) {
      normalized.is_blocked = !!normalized.blocked;
    } else if (!('blocked' in normalized)) {
      normalized.blocked = !!normalized.is_blocked;
    }
    blockMap.set(key, normalized);
    activeBlockCache.set(key, normalized);
  };
  const ids = Array.from(new Set(users.map((u) => u?.id).filter(Boolean))).map((id) => String(id));
  ids.forEach((id) => {
    if (blockMap.has(id)) return;
    const cached = activeBlockCache.get(id);
    if (cached) {
      blockMap.set(id, cached);
    }
  });
  const sources = [payload?.blockedUsers, payload?.bannedUsers];
  sources.forEach((arr) => {
    if (Array.isArray(arr)) arr.forEach(register);
  });
  const missingIds = ids.filter((id) => !blockMap.has(id));
  const missingEmails = [];
  users.forEach((user) => {
    if (!user) return;
    const id = user.id ? String(user.id) : null;
    if (id && blockMap.has(id)) return;
    const emailCandidates = [
      user.email,
      user.contact_email,
      user.contactEmail,
      user.user_email,
      user.userEmail,
      user.auth_email,
      user.authEmail,
      user.identity,
    ];
    const email = emailCandidates.find((value) => typeof value === 'string' && value.trim() !== '');
    if (email) missingEmails.push(email.trim().toLowerCase());
  });
  if (missingIds.length || missingEmails.length) {
    const fetched = await fetchBlocksByIdentifiers({ ids: missingIds, emails: missingEmails });
    fetched.forEach(register);
  }
  if (!blockMap.size) return;

  users.forEach((user) => {
    if (!user || !user.id) return;
    const key = String(user.id);
    const info = blockMap.get(key);
    if (!info) {
      activeBlockCache.delete(key);
      return;
    }
    const normalized = normalizeBlockEntry(info);
    if (!normalized) return;
    const { active, status, since, until } = normalized;
    if (status) {
      user.ban_status = status;
      user.status = user.status || status;
      user.ban = Object.assign({}, user.ban, { status });
    }
    if (active != null) {
      const flag = !!active;
      user.blocked = flag;
      user.is_blocked = flag;
      user.is_banned = flag;
      user.banned = flag;
      user.block_active = flag;
      user.ban_active = flag;
      user.ban = Object.assign({}, user.ban, { active: flag });
    }
    if (since instanceof Date) {
      const iso = since.toISOString();
      user.blocked_at = iso;
      user.banned_at = iso;
      user.ban = Object.assign({}, user.ban, { since: iso });
    }
    if (until instanceof Date) {
      const iso = until.toISOString();
      user.blocked_until = iso;
      user.banned_until = iso;
      user.blockedUntil = iso;
      user.ban_expires = iso;
      user.ban = Object.assign({}, user.ban, { until: iso });
    }
  });

  if (typeof blockedSummaryOverride !== 'number' && blockMap.size) {
    blockedSummaryOverride = blockMap.size;
  }
}

function composeBanTitle({ until, since } = {}){
  const parts = [];
  if(since) parts.push(`Bloqueado desde ${formatDateTime(since)}`);
  if(until) parts.push(`Hasta ${formatDateTime(until)}`);
  if(!parts.length) return 'Bloqueo activo';
  return parts.join(' · ');
}

function formatElapsedDuration(since, now = new Date()){
  const start = since instanceof Date ? since : parseDate(since);
  if(!(start instanceof Date) || Number.isNaN(start.valueOf())) return '';
  const end = now instanceof Date && !Number.isNaN(now.valueOf()) ? now : new Date();
  let diff = end.getTime() - start.getTime();
  if(!Number.isFinite(diff) || diff <= 0) return 'Menos de un minuto';
  const units = [
    { label: 'año', plural: 'años', ms: 365 * 24 * 60 * 60 * 1000 },
    { label: 'mes', plural: 'meses', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'día', plural: 'días', ms: 24 * 60 * 60 * 1000 },
    { label: 'hora', plural: 'horas', ms: 60 * 60 * 1000 },
    { label: 'minuto', plural: 'minutos', ms: 60 * 1000 },
  ];
  const parts = [];
  for(const unit of units){
    if(diff >= unit.ms){
      const value = Math.floor(diff / unit.ms);
      diff -= value * unit.ms;
      parts.push(`${value} ${value === 1 ? unit.label : unit.plural}`);
      if(parts.length === 2) break;
    }
  }
  if(!parts.length) return 'Menos de un minuto';
  return parts.join(' · ');
}

function pluralizeDuration(unit, amount){
  const value = Math.max(0, Math.round(Number(amount) || 0));
  const abs = Math.abs(value);
  switch(unit){
    case 'years': return abs === 1 ? '1 año' : `${value} años`;
    case 'months': return abs === 1 ? '1 mes' : `${value} meses`;
    case 'days': return abs === 1 ? '1 día' : `${value} días`;
    case 'hours':
    default: return abs === 1 ? '1 hora' : `${value} horas`;
  }
}

function describeCustomDuration(totalHours){
  const hours = Math.max(1, Math.ceil(Number(totalHours) || 0));
  let remainingHours = hours;
  const days = Math.floor(remainingHours / 24);
  remainingHours -= days * 24;
  const years = Math.floor(days / 365);
  const months = Math.floor((days - years * 365) / 30);
  const daysLeft = days - (years * 365) - (months * 30);
  const parts = [];
  if(years > 0) parts.push(years === 1 ? '1 año' : `${years} años`);
  if(months > 0) parts.push(months === 1 ? '1 mes' : `${months} meses`);
  if(daysLeft > 0) parts.push(daysLeft === 1 ? '1 día' : `${daysLeft} días`);
  if(!parts.length || remainingHours > 0){
    if(remainingHours > 0){
      parts.push(remainingHours === 1 ? '1 hora' : `${remainingHours} horas`);
    } else if(!parts.length){
      parts.push('1 hora');
    }
  }
  return parts.join(' · ');
}

function calculateBlockRange({ since, amount, unit, customUntil }){
  const baseSince = since instanceof Date && !Number.isNaN(since.valueOf()) ? new Date(since) : new Date();
  if(customUntil instanceof Date && !Number.isNaN(customUntil.valueOf())){
    if(customUntil.getTime() <= baseSince.getTime()){
      return { error: 'La fecha debe ser posterior a la actual.' };
    }
    const diffMs = customUntil.getTime() - baseSince.getTime();
    const hours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
    return {
      since: baseSince,
      until: customUntil,
      hours,
      label: describeCustomDuration(hours),
      source: 'custom'
    };
  }
  const numericAmount = Number(amount);
  if(!Number.isFinite(numericAmount) || numericAmount <= 0){
    return { error: 'Ingresa una cantidad válida.' };
  }
  const safeUnit = unit || 'hours';
  const until = new Date(baseSince);
  switch(safeUnit){
    case 'years':
      until.setFullYear(until.getFullYear() + Math.round(numericAmount));
      break;
    case 'months':
      until.setMonth(until.getMonth() + Math.round(numericAmount));
      break;
    case 'days':
      until.setDate(until.getDate() + Math.round(numericAmount));
      break;
    case 'hours':
    default:
      until.setHours(until.getHours() + Math.round(numericAmount));
      break;
  }
  const diff = until.getTime() - baseSince.getTime();
  if(!Number.isFinite(diff) || diff <= 0){
    return { error: 'No se pudo calcular la duración.' };
  }
  const hours = Math.max(1, Math.ceil(diff / (60 * 60 * 1000)));
  return {
    since: baseSince,
    until,
    hours,
    label: pluralizeDuration(safeUnit, Math.round(numericAmount)),
    source: 'auto',
    unit: safeUnit,
    amount: Math.round(numericAmount)
  };
}

function getSelectedBlockUnit(){
  const active = blockUnitInputs.find((input)=> input.checked);
  return active ? active.value : 'hours';
}

function setSelectedBlockUnit(unit){
  blockUnitInputs.forEach((input)=>{
    input.checked = input.value === unit;
  });
}

function allowBodyScrollIfNoModal(){
  const editOpen = modal && modal.style.display === 'flex';
  const blockOpen = blockModal && blockModal.style.display === 'flex';
  const unblockOpen = unblockModal && unblockModal.style.display === 'flex';
  const passwordOpen = passwordModal && passwordModal.style.display === 'flex';
  const deleteOpen = deleteModal && deleteModal.style.display === 'flex';
  if(!editOpen && !blockOpen && !unblockOpen && !passwordOpen && !deleteOpen){
    document.body.style.overflow = '';
  }
}

function updateBlockSummary(){
  if(!blockModalState) return;
  const since = blockModalState.since instanceof Date ? blockModalState.since : new Date();
  const amount = blockAmountInput ? Number(blockAmountInput.value) : DEFAULT_BLOCK_AMOUNT;
  const unit = getSelectedBlockUnit();
  const customRaw = blockCustomUntilInput?.value?.trim() || '';
  const customDate = customRaw ? new Date(customRaw) : null;
  const result = calculateBlockRange({ since, amount, unit, customUntil: customDate });

  if(blockSummarySince) blockSummarySince.textContent = formatDateTime(since);

  if(result.error){
    if(blockSummaryUntil) blockSummaryUntil.textContent = '—';
    if(blockSummaryDuration) blockSummaryDuration.textContent = '—';
    if(blockError){
      blockError.textContent = result.error;
      blockError.style.display = 'block';
    }
    if(btnBlockConfirm) btnBlockConfirm.disabled = true;
    blockModalState.computed = null;
    if(blockCustomUntilInput){
      if(customRaw){
        blockCustomUntilInput.setAttribute('aria-invalid', 'true');
      } else {
        blockCustomUntilInput.removeAttribute('aria-invalid');
      }
    }
    if(blockAmountInput){
      blockAmountInput.setAttribute('aria-invalid', (!customRaw && result.error) ? 'true' : 'false');
    }
    return;
  }

  blockModalState.computed = result;
  if(blockSummaryUntil) blockSummaryUntil.textContent = formatDateTime(result.until);
  if(blockSummaryDuration){
    const durationText = result.label || pluralizeDuration('hours', result.hours);
    blockSummaryDuration.textContent = `${durationText} · ${numberFmt.format(result.hours)} h`;
  }
  if(blockError) blockError.style.display = 'none';
  if(btnBlockConfirm) btnBlockConfirm.disabled = false;
  if(blockCustomUntilInput){
    blockCustomUntilInput.setAttribute('aria-invalid', 'false');
  }
  if(blockAmountInput){
    blockAmountInput.setAttribute('aria-invalid', 'false');
  }
}

function openBlockModalForUser({ id, displayName, email }){
  if(!blockModal) return;
  blockModalState = {
    id,
    displayName,
    email,
    since: new Date(),
    computed: null,
  };
  if(blockModalTitle) blockModalTitle.textContent = 'Bloquear usuario';
  if(blockModalSubtitle){
    const namePart = displayName || 'Usuario';
    const emailPart = email ? ` · ${email}` : '';
    blockModalSubtitle.textContent = `${namePart}${emailPart}`;
  }
  if(blockAmountInput){
    blockAmountInput.value = String(DEFAULT_BLOCK_AMOUNT);
    blockAmountInput.setAttribute('aria-invalid', 'false');
  }
  if(blockCustomUntilInput){
    blockCustomUntilInput.value = '';
    blockCustomUntilInput.setAttribute('aria-invalid', 'false');
  }
  setSelectedBlockUnit('hours');
  if(blockError){
    blockError.style.display = 'none';
    blockError.textContent = '';
  }
  if(btnBlockConfirm){
    btnBlockConfirm.disabled = false;
    btnBlockConfirm.textContent = 'Confirmar bloqueo';
  }
  if(blockSummaryUntil) blockSummaryUntil.textContent = '—';
  if(blockSummaryDuration) blockSummaryDuration.textContent = '—';
  if(blockSummarySince) blockSummarySince.textContent = formatDateTime(blockModalState.since);
  document.body.style.overflow = 'hidden';
  blockModal.style.display = 'flex';
  updateBlockSummary();
}

function closeBlockModal(){
  if(!blockModal) return;
  blockModal.style.display = 'none';
  if(blockAmountInput){
    blockAmountInput.value = String(DEFAULT_BLOCK_AMOUNT);
    blockAmountInput.setAttribute('aria-invalid', 'false');
  }
  if(blockCustomUntilInput){
    blockCustomUntilInput.value = '';
    blockCustomUntilInput.setAttribute('aria-invalid', 'false');
  }
  if(blockError){
    blockError.style.display = 'none';
    blockError.textContent = '';
  }
  if(btnBlockConfirm){
    btnBlockConfirm.disabled = false;
    btnBlockConfirm.textContent = 'Confirmar bloqueo';
  }
  if(blockSummarySince) blockSummarySince.textContent = '—';
  if(blockSummaryUntil) blockSummaryUntil.textContent = '—';
  if(blockSummaryDuration) blockSummaryDuration.textContent = '—';
  if(blockModalSubtitle) blockModalSubtitle.textContent = '—';
  blockModalState = null;
  allowBodyScrollIfNoModal();
}

function openUnblockModalForUser({ id, displayName, email, since, until } = {}){
  if(!unblockModal){
    toast('No se pudo abrir el modal de desbloqueo', 'err');
    return;
  }
  if(!id){
    toast('No se pudo identificar al usuario', 'err');
    return;
  }

  const key = String(id);
  const listEntry = blockedUsers.find((entry) => entry && entry.id === key);
  const cached = (listEntry && listEntry.raw) || activeBlockCache.get(key) || {};
  const sinceDate = since instanceof Date
    ? since
    : listEntry?.since instanceof Date
      ? listEntry.since
      : parseDate(cached.blocked_at || cached.banned_at || cached.created_at);
  const untilDate = until instanceof Date
    ? until
    : listEntry?.until instanceof Date
      ? listEntry.until
      : parseDate(cached.blocked_until || cached.banned_until);
  const reason = listEntry?.reason || cached.reason || cached.block_reason || cached.notes || null;
  const actor = listEntry?.actorEmail || cached.actor_email || cached.actorEmail || null;
  const summary = composeBanTitle({ since: sinceDate, until: untilDate });
  const subtitlePieces = [];
  if (displayName) subtitlePieces.push(displayName);
  const baseEmail =
    email ||
    listEntry?.email ||
    listEntry?.contactEmail ||
    listEntry?.authEmail ||
    cached.email ||
    cached.user_email ||
    cached.contact_email ||
    cached.auth_email ||
    '';
  if (baseEmail) subtitlePieces.push(baseEmail);
  if (unblockModalTitle) unblockModalTitle.textContent = 'Desbloquear usuario';
  if (unblockModalSubtitle) unblockModalSubtitle.textContent = subtitlePieces.length ? subtitlePieces.join(' • ') : '—';
  if (unblockModalDescription) {
    unblockModalDescription.textContent = summary && summary !== 'Bloqueo activo'
      ? summary
      : 'El usuario recuperará el acceso de inmediato.';
  }
  if (unblockModalMeta) {
    unblockModalMeta.innerHTML = '';
    const metaRows = [];
    if (sinceDate) metaRows.push({ label: 'Bloqueado desde', value: formatDateTime(sinceDate) });
    if (untilDate) metaRows.push({ label: 'Bloqueado hasta', value: formatDateTime(untilDate) });
    const elapsed = sinceDate ? formatElapsedDuration(sinceDate) : '';
    if (elapsed) metaRows.push({ label: 'Tiempo transcurrido', value: elapsed });
    if (reason) metaRows.push({ label: 'Motivo', value: reason });
    if (actor) metaRows.push({ label: 'Registrado por', value: actor });
    if (!metaRows.length) {
      const row = document.createElement('div');
      row.className = 'muted';
      row.textContent = 'Sin detalles adicionales del bloqueo.';
      unblockModalMeta.append(row);
    } else {
      metaRows.forEach(({ label, value }) => {
        const row = document.createElement('span');
        const labelEl = document.createElement('strong');
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.textContent = value;
        row.append(labelEl, valueEl);
        unblockModalMeta.append(row);
      });
    }
  }

  unblockModalState = {
    id: key,
    displayName: displayName || '',
    email: baseEmail || '',
    since: sinceDate || null,
    until: untilDate || null,
  };

  document.body.style.overflow = 'hidden';
  unblockModal.style.display = 'flex';
}

function closeUnblockModal(){
  if(!unblockModal) return;
  unblockModal.style.display = 'none';
  if(unblockModalMeta) unblockModalMeta.innerHTML = '';
  unblockModalState = null;
  allowBodyScrollIfNoModal();
}

function openPasswordModal({ id, email, name } = {}){
  if(!passwordModal) return;
  if(!id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  const user = currentRows.find((row) => row?.id === id) || null;
  const resolvedName = name || user?.full_name || user?.display_name || '';
  const resolvedEmail = email || user?.email || user?.contact_email || '';
  passwordModalState = {
    id,
    email: resolvedEmail,
    name: resolvedName,
  };
  const parts = [];
  if(resolvedName) parts.push(resolvedName);
  if(resolvedEmail) parts.push(resolvedEmail);
  if(passwordModalSubtitle) passwordModalSubtitle.textContent = parts.length ? parts.join(' • ') : '—';
  if(passwordModalInput){
    passwordModalInput.value = '';
    passwordModalInput.removeAttribute('aria-invalid');
  }
  if(passwordModalError){
    passwordModalError.textContent = '';
    passwordModalError.style.display = 'none';
  }
  document.body.style.overflow = 'hidden';
  passwordModal.style.display = 'flex';
  setTimeout(()=> passwordModalInput?.focus(), 50);
}

function closePasswordModal(){
  if(!passwordModal) return;
  passwordModal.style.display = 'none';
  if(passwordModalInput){
    passwordModalInput.value = '';
    passwordModalInput.removeAttribute('aria-invalid');
  }
  if(passwordModalError){
    passwordModalError.textContent = '';
    passwordModalError.style.display = 'none';
  }
  if(passwordModalSubtitle) passwordModalSubtitle.textContent = '—';
  passwordModalState = null;
  allowBodyScrollIfNoModal();
}

async function handlePasswordSubmit(){
  if(!passwordModalState || !passwordModalState.id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  const value = passwordModalInput?.value?.trim() || '';
  if(value.length < 12){
    if(passwordModalError){
      passwordModalError.textContent = 'La contraseña debe tener al menos 12 caracteres.';
      passwordModalError.style.display = 'block';
    }
    passwordModalInput?.setAttribute('aria-invalid','true');
    passwordModalInput?.focus();
    return;
  }
  if(passwordModalError){
    passwordModalError.textContent = '';
    passwordModalError.style.display = 'none';
  }
  passwordModalInput?.removeAttribute('aria-invalid');

  await withButtonLoading(btnPasswordConfirm, async () => {
    const res = await api(ENDPOINTS.setPassword, { method:'POST', body:{ userId: passwordModalState.id, password: value } });
    if(!res || res.networkError){
      toast('No se pudo conectar con el servicio','err');
      return;
    }
    if(!res.ok){
      const txt = await res.text().catch(()=>null);
      console.error('password update error:', txt);
      if(passwordModalError){
        passwordModalError.textContent = 'No se pudo actualizar la contraseña. Intenta de nuevo.';
        passwordModalError.style.display = 'block';
      }
      toast('No se pudo cambiar la contraseña','err');
      return;
    }
    toast('Contraseña actualizada');
    closePasswordModal();
  }, { loadingText: 'Actualizando…', minDelay: 300 });
}

function openDeleteModal({ id, email, name } = {}){
  if(!deleteModal) return;
  if(!id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  deleteModalState = {
    id,
    email: email || '',
    name: name || '',
  };
  const user = currentRows.find((row) => row?.id === id) || null;
  const parts = [];
  const resolvedName = (name && name.trim()) || user?.full_name || user?.display_name || '';
  const resolvedEmail = email || user?.email || user?.contact_email || '';
  if(resolvedName) parts.push(resolvedName);
  if(resolvedEmail) parts.push(resolvedEmail);
  if(deleteModalSubtitle) deleteModalSubtitle.textContent = parts.length ? parts.join(' • ') : '—';

  if(deleteModalMeta){
    deleteModalMeta.innerHTML = '';
    const detailRows = [];
    if(resolvedEmail) detailRows.push({ label: 'Correo', value: resolvedEmail });
    if(resolvedName) detailRows.push({ label: 'Nombre', value: resolvedName });
    if(user?.plan) detailRows.push({ label: 'Plan', value: user.plan });
    const numericCredits = Number(user?.credits);
    if(Number.isFinite(numericCredits)) detailRows.push({ label: 'Créditos', value: numberFmt.format(numericCredits) });
    if(user?.id) detailRows.push({ label: 'ID', value: user.id });
    if(!detailRows.length){
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Sin información adicional disponible.';
      deleteModalMeta.append(empty);
    } else {
      detailRows.forEach(({ label, value }) => {
        const row = document.createElement('span');
        const labelEl = document.createElement('strong');
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.textContent = value;
        row.append(labelEl, valueEl);
        deleteModalMeta.append(row);
      });
    }
  }

  document.body.style.overflow = 'hidden';
  deleteModal.style.display = 'flex';
}

function closeDeleteModal(){
  if(!deleteModal) return;
  deleteModal.style.display = 'none';
  if(deleteModalMeta) deleteModalMeta.innerHTML = '';
  if(deleteModalSubtitle) deleteModalSubtitle.textContent = '—';
  deleteModalState = null;
  allowBodyScrollIfNoModal();
}

async function handleDeleteConfirm(){
  if(!deleteModalState || !deleteModalState.id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  await withButtonLoading(btnDeleteConfirm, async () => {
    const res = await api(ENDPOINTS.remove, { method:'POST', body:{ userId: deleteModalState.id } });
    if(!res || res.networkError){
      toast('No se pudo conectar con el servicio','err');
      return;
    }
    if(res.ok){
      toast('Usuario eliminado');
      closeDeleteModal();
      loadUsers();
      if(blockedViewActive || blockedUsers.length){
        loadBlockedUsers({ force: true }).catch(()=>{});
      }
    } else {
      const txt = await res.text().catch(()=>null);
      console.error('delete error:', txt);
      toast('No se pudo eliminar al usuario','err');
    }
  }, { loadingText: 'Eliminando…', minDelay: 300 });
}

function applyBlockStateForUser(userId, { isBlocked, until = null, since = null } = {}){
  if(!userId) return;
  const detail = composeBanTitle({ until, since });
  const title = isBlocked ? `Quitar bloqueo · ${detail}` : 'Bloquear temporalmente al usuario';
  document.querySelectorAll('button[data-act="block"]').forEach((button)=>{
    if(button.dataset.id !== userId) return;
    button.dataset.blocked = isBlocked ? 'true' : 'false';
    button.dataset.blockedUntil = until ? String(until.toISOString?.() || until) : '';
    button.dataset.blockedSince = since ? String(since.toISOString?.() || since) : '';
    button.textContent = isBlocked ? 'Desbloquear' : 'Bloquear';
    button.title = title;
    if(button.classList){
      button.classList.remove('btn-warning', 'btn-success');
      button.classList.add(isBlocked ? 'btn-success' : 'btn-warning');
    }
    const tableCell = button.closest('tr')?.querySelector('.plan-cell');
    const cardCell = button.closest('.card-row')?.querySelector('.plan-cell');
    [tableCell, cardCell].forEach((cell)=>{
      if(!cell) return;
      let tag = cell.querySelector('.tag-blocked');
      if(isBlocked){
        if(!tag){
          tag = document.createElement('span');
          tag.className = 'tag tag-blocked';
          cell.insertBefore(tag, cell.firstChild);
        }
        tag.textContent = 'Bloqueado';
        tag.title = detail;
      } else if(tag){
        tag.remove();
      }
    });
  });

  if (typeof blockedSummaryOverride === 'number') {
    const delta = isBlocked ? 1 : -1;
    const nextValue = blockedSummaryOverride + delta;
    blockedSummaryOverride = nextValue < 0 ? 0 : nextValue;
  }

  if(!isBlocked){
    activeBlockCache.delete(userId);
  }
}

function isExcludedFromReport(email){
  if(!email) return false;
  const local = String(email).split('@')[0]?.toLowerCase() || '';
  return local.startsWith('admin.') || local.startsWith('sup.');
}

function updateAccountSummary({ creditCount = 0, activeCount = 0, lowCount = 0 } = {}){
  const totalValue = creditCount * CREDIT_VALUE;
  if(accountTotalCreditsEl) accountTotalCreditsEl.textContent = currencyFmt.format(totalValue);
  if(accountTotalCreditsDetailEl) accountTotalCreditsDetailEl.textContent = `${numberFmt.format(creditCount)} créditos clientes`;
  if(accountActiveCountEl) accountActiveCountEl.textContent = numberFmt.format(activeCount);
  if(accountAlertsEl) accountAlertsEl.textContent = numberFmt.format(lowCount);
  if(accountStatusTag){
    accountStatusTag.classList.remove('warn', 'danger');
    if(creditCount <= 0){
      accountStatusTag.textContent = 'Sin créditos';
      accountStatusTag.classList.add('danger');
    } else if(lowCount > 0){
      accountStatusTag.textContent = 'Revisar alertas';
      accountStatusTag.classList.add('warn');
    } else {
      accountStatusTag.textContent = 'Activo';
    }
  }
  if(accountPanel && cuBox && cuBox.style.display !== 'none'){
    accountPanel.style.display = 'block';
  }
}

function resetAccountPanel(){
  if(accountUserName) accountUserName.textContent = '—';
  if(accountUserEmail) accountUserEmail.textContent = '—';
  if(accountTotalCreditsEl) accountTotalCreditsEl.textContent = currencyFmt.format(0);
  if(accountTotalCreditsDetailEl) accountTotalCreditsDetailEl.textContent = '0 créditos clientes';
  if(accountActiveCountEl) accountActiveCountEl.textContent = '0';
  if(accountAlertsEl) accountAlertsEl.textContent = '0';
  if(accountStatusTag){
    accountStatusTag.textContent = 'Sin sesión';
    accountStatusTag.classList.remove('warn', 'danger');
  }
  if(accountPanel) accountPanel.style.display = 'none';
}
function creditMeta(rawCredits){
  const value = Number(rawCredits ?? 0);
  if(!Number.isFinite(value) || value <= 0) return { value:0, level:'low', text:'Sin créditos', recommend:true };
  if(value < 20) return { value, level:'low', text:'Crédito bajo', recommend:true };
  if(value < 60) return { value, level:'medium', text:'Nivel medio', recommend:false };
  return { value, level:'high', text:'Nivel saludable', recommend:false };
}
function creditBadge(meta){
  return `<div class="credit-badge credit-${meta.level}"><span class="dot"></span><span>${numberFmt.format(meta.value)} créditos</span><span>· ${meta.text}</span></div>`;
}

/************* AUTH & API *************/
async function ensureSessionAlive(forceRefresh = false){
  if (supabaseManager && typeof supabaseManager.ensureSession === "function") {
    try {
      const session = await supabaseManager.ensureSession({
        minimumValidityMs: SUPABASE_SESSION_THRESHOLD_MS,
        forceRefresh,
      });
      if (session) {
        return session;
      }
    } catch (err) {
      console.warn("No se pudo asegurar la sesion con el gestor", err);
    }
  }
  let session = null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.warn("Error obteniendo la sesion actual", error);
    }
    session = data?.session || null;
  } catch (err) {
    console.warn("No se pudo obtener la sesion actual", err);
    session = null;
  }
  if (!session) {
    return null;
  }
  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const needsRefresh = forceRefresh || (expiresAtMs && expiresAtMs - Date.now() <= SUPABASE_SESSION_THRESHOLD_MS);
  if (!needsRefresh) {
    return session;
  }
  try {
    const { data, error } = await sb.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (error) {
      console.warn("No se pudo refrescar la sesion", error);
      return session;
    }
    return data?.session || session;
  } catch (err) {
    console.warn("Fallo refrescando la sesion", err);
    return session;
  }
}

async function authHeaderAsync(){
  const session = await ensureSessionAlive();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function api(path, { method='GET', headers={}, body=null, query=null } = {}){
  const url = new URL(`${FUNCTIONS_BASE}/${path}`);
  if(query){
    Object.entries(query).forEach(([k,v])=>{
      if(v == null) return;
      if(Array.isArray(v)){
        v.filter((piece)=> piece != null && piece !== '').forEach((piece)=>{
          url.searchParams.append(k, String(piece));
        });
      } else {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const auth = await authHeaderAsync();
  const requestInit = {
    method,
    headers: { 'Content-Type':'application/json', apikey: SUPABASE_ANON_KEY, ...auth, ...headers },
    body: body != null ? JSON.stringify(body) : null,
  };
  if(requestInit.body === null) delete requestInit.body;
  try {
    const res = await fetch(url, requestInit);
    if(res.status===401){
      toast('Sesión expirada o no autorizada', 'warn');
      await sb.auth.signOut();
      hide(adminView);
      show(loginView);
      resetAccountPanel();
      sessionLoading(false);
    }
    return res;
  } catch(error){
    console.error('Error al llamar función', error);
    return {
      ok: false,
      status: 0,
      networkError: true,
      json: async ()=>null,
      text: async ()=> error?.message || 'Error de red',
    };
  }
}

/* ✅ Soporte multi-admin:
   - Si el correo del usuario está en ADMIN_EMAILS → admin.
   - O si el token trae app_metadata.role === 'admin' (o user_metadata) → admin.
   - O si user_metadata.isAdmin === true → admin. */
function isAdminUser(user){
  if(!user) return false;
  const email = (user.email || '').toLowerCase();
  if (ADMIN_EMAILS.has(email)) return true;
  const role = (user.app_metadata?.role || user.user_metadata?.role || '').toString().toLowerCase();
  if (role === 'admin') return true;
  if (user.user_metadata?.isAdmin === true) return true;
  return false;
}

async function guardAdmin(){
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if(!user){
    hide(adminView);
    show(loginView);
    resetAccountPanel();
    return false;
  }
  if(!isAdminUser(user)){
    await sb.auth.signOut();
    hide(adminView);
    show(loginView);
    resetAccountPanel();
    if (loginError){
      loginError.style.display='block';
      loginError.textContent='No eres administrador.';
    }
    return false;
  }
  return true;
}

/* ✅ NUEVO: rellenar nombre/correo del admin conectado */
async function fillCurrentUserBox(){
  if(!cuBox || !cuName || !cuEmail) return;
  try{
    const { data } = await sb.auth.getUser();
    const u = data?.user;
    if(!u){
      cuBox.style.display = 'none';
      resetAccountPanel();
      return;
    }
    const name =
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      u.user_metadata?.fullName ||
      u.user_metadata?.display_name ||
      'Administrador';
    cuName.textContent = String(name);
    cuEmail.textContent = u.email || '—';
    cuBox.style.display = 'flex';
    if(accountUserName) accountUserName.textContent = String(name);
    if(accountUserEmail) accountUserEmail.textContent = u.email || '—';
    if(accountPanel) accountPanel.style.display = 'block';
  } catch(err){
    console.warn('No se pudo obtener el usuario actual', err);
    cuBox.style.display = 'none';
    resetAccountPanel();
  }
}

/************* AUTH FLOW *************/
qs('#btnLogin')?.addEventListener('click', async()=>{
  if (!btnLoginText || !btnLoginSpinner) return;
  if (loginError) loginError.style.display='none';
  const email = emailInput?.value.trim();
  const password = passwordInput?.value;
  if(!email || !password){
    if (loginError){
      loginError.style.display='block';
      loginError.textContent='Completa email y contraseña';
    }
    return;
  }
  sessionLoading(true, 'Iniciando sesión…');
  btnLogin.disabled=true; btnLoginText.style.display='none'; btnLoginSpinner.style.display='inline';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btnLogin.disabled=false; btnLoginText.style.display='inline'; btnLoginSpinner.style.display='none';
  if(error){
    sessionLoading(false);
    if (loginError){
      loginError.style.display='block';
      loginError.textContent = error.message;
    }
    return;
  }
  rememberEmail(email);
  const ok = await guardAdmin();
  if(ok){
    hide(loginView);
    show(adminView);
    await fillCurrentUserBox();   // ✅ mostrar datos del admin
    loadBlockedUsers({ force: true, silent: true });
    loadUsers();
    toast('Bienvenido, admin');
    setTimeout(()=>sessionLoading(false), 320);
  } else {
    sessionLoading(false);
  }
});

qs('#btnLogout')?.addEventListener('click', async()=>{
  sessionLoading(true, 'Cerrando sesión…');
  let closed = false;
  let noSession = false;
  let hadError = false;
  try {
    const helper = window.WFSessionHelper;
    if(helper && typeof helper.ensureLogout === 'function'){
      const res = await helper.ensureLogout(sb);
      closed = !!res?.ok;
      noSession = res?.reason === 'no-session';
      if(noSession){
        toast('No hay sesión activa para cerrar', 'warn');
      } else if(res && res.error){
        hadError = true;
        console.error('Error cerrando sesión', res.error);
        toast('No se pudo cerrar sesión. Intenta nuevamente.', 'err');
      }
    } else {
      const { data } = await sb.auth.getSession();
      if(data?.session){
        const { error } = await sb.auth.signOut();
        if(error){
          hadError = true;
          console.error('Error cerrando sesión', error);
          toast('No se pudo cerrar sesión. Intenta nuevamente.', 'err');
        } else {
          closed = true;
        }
      } else {
        noSession = true;
        toast('No hay sesión activa para cerrar', 'warn');
      }
    }

    if(!hadError && (closed || noSession)){
      hide(adminView);
      show(loginView);
      resetAccountPanel();
      if(passwordInput) passwordInput.value='';
      if(cuBox){ cuBox.style.display = 'none'; }
    }
    if(closed && !hadError){
      toast('Sesión cerrada correctamente');
    }
  } catch(err){
    hadError = true;
    console.error('Fallo inesperado al cerrar sesión', err);
    toast('No se pudo cerrar sesión. Revisa la consola.', 'err');
  } finally {
    setTimeout(()=>sessionLoading(false), 220);
  }
});
sb.auth.onAuthStateChange((_, s)=>{
  if(!s){
    hide(adminView);
    show(loginView);
    setTimeout(()=>sessionLoading(false), 250);
    /* ✅ ocultar banda si no hay sesión */
    if(cuBox){ cuBox.style.display = 'none'; }
    resetAccountPanel();
  }
});

togglePasswordBtn?.addEventListener('click', ()=>{
  if(!passwordInput) return;
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  togglePasswordBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
  if(togglePasswordText) togglePasswordText.textContent = show ? 'Ocultar' : 'Mostrar';
  if(togglePasswordIcon) togglePasswordIcon.textContent = show ? '🙈' : '👁️';
});

rememberCheck?.addEventListener('change', ()=>{
  if(!emailInput) return;
  if(rememberCheck.checked){
    rememberEmail(emailInput.value.trim());
  } else {
    rememberEmail('');
  }
});

emailInput?.addEventListener('input', ()=>{
  if(rememberCheck?.checked){
    rememberEmail(emailInput.value.trim());
  }
});

blockUnitInputs.forEach((input)=>{
  input.addEventListener('change', ()=>{
    if(blockModalState){
      updateBlockSummary();
    }
  });
});

blockAmountInput?.addEventListener('input', ()=> updateBlockSummary());
blockAmountInput?.addEventListener('change', ()=> updateBlockSummary());

blockCustomUntilInput?.addEventListener('input', ()=> updateBlockSummary());
blockCustomUntilInput?.addEventListener('change', ()=> updateBlockSummary());

blockQuickButtons.forEach((btn)=>{
  btn.addEventListener('click', ()=>{
    const unit = btn.dataset.quickUnit;
    const rawValue = btn.dataset.quickValue;
    if(!unit || !rawValue) return;
    setSelectedBlockUnit(unit);
    if(blockAmountInput){
      blockAmountInput.value = rawValue;
    }
    if(blockCustomUntilInput){
      blockCustomUntilInput.value = '';
      blockCustomUntilInput.setAttribute('aria-invalid', 'false');
    }
    updateBlockSummary();
  });
});

btnBlockCancel?.addEventListener('click', (event)=>{
  event?.preventDefault?.();
  closeBlockModal();
});

btnBlockClose?.addEventListener('click', (event)=>{
  event?.preventDefault?.();
  closeBlockModal();
});

btnBlockConfirm?.addEventListener('click', async ()=>{
  if(!blockModalState?.id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  updateBlockSummary();
  const result = blockModalState.computed;
  if(!result || !Number.isFinite(result.hours) || result.hours <= 0){
    if(blockError){
      blockError.textContent = 'Define una duración válida para el bloqueo.';
      blockError.style.display = 'block';
    }
    return;
  }
  const userId = blockModalState.id;
  const confirmOriginal = btnBlockConfirm.textContent;
  btnBlockConfirm.disabled = true;
  btnBlockConfirm.textContent = 'Bloqueando…';
  let res;
  try {
    res = await api(ENDPOINTS.block, { method:'POST', body:{ userId, hours: result.hours } });
  } finally {
    btnBlockConfirm.disabled = false;
    btnBlockConfirm.textContent = confirmOriginal || 'Confirmar bloqueo';
  }
  if(!res || res.networkError){
    toast('No se pudo conectar con el servicio','err');
    return;
  }
  if(res.ok){
    const durationText = result.label || pluralizeDuration('hours', result.hours);
    const untilText = result.until ? formatDateTime(result.until) : '';
    const message = untilText
      ? `Usuario bloqueado hasta ${untilText} · ${durationText}`
      : `Usuario bloqueado · ${durationText}`;
    toast(message);
    applyBlockStateForUser(userId, { isBlocked:true, since: result.since, until: result.until });
    closeBlockModal();
    await loadBlockedUsers({ force: true });
    loadUsers();
  } else {
    const txt = await res.text().catch(()=>null);
    console.error('block error:', txt);
    toast('No se pudo bloquear al usuario','err');
  }
});

btnUnblockCancel?.addEventListener('click', (event)=>{
  event?.preventDefault?.();
  closeUnblockModal();
});

btnUnblockClose?.addEventListener('click', (event)=>{
  event?.preventDefault?.();
  closeUnblockModal();
});

btnUnblockConfirm?.addEventListener('click', async ()=>{
  if(!unblockModalState?.id){
    toast('No se pudo identificar al usuario','err');
    return;
  }
  const userId = unblockModalState.id;
  const original = btnUnblockConfirm?.textContent || 'Desbloquear ahora';
  if(btnUnblockConfirm){
    btnUnblockConfirm.disabled = true;
    btnUnblockConfirm.textContent = 'Desbloqueando…';
  }
  let res;
  try {
    res = await api(ENDPOINTS.block, { method:'POST', body:{ userId, unblock:true } });
  } finally {
    if(btnUnblockConfirm){
      btnUnblockConfirm.disabled = false;
      btnUnblockConfirm.textContent = original;
    }
  }
  if(!res || res.networkError){
    toast('No se pudo conectar con el servicio','err');
    return;
  }
  if(res.ok){
    toast('Usuario desbloqueado');
    applyBlockStateForUser(userId, { isBlocked:false });
    activeBlockCache.delete(userId);
    blockedUsers = blockedUsers.filter((entry) => entry.id !== userId);
    blockedSummaryOverride = typeof blockedSummaryOverride === 'number'
      ? Math.max(0, blockedSummaryOverride - 1)
      : blockedUsers.length;
    renderBlockedUsers();
    if (blockedUsers.length) {
      setBlockedStatus(`Total: ${numberFmt.format(blockedUsers.length)}`);
    } else {
      setBlockedStatus('Sin bloqueos activos');
    }
    closeUnblockModal();
    await loadBlockedUsers({ force: true });
    loadUsers();
  } else {
    const txt = await res.text().catch(()=>null);
    console.error('unblock error:', txt);
    toast('No se pudo desbloquear al usuario','err');
  }
});

async function bootstrap(){
  loadRememberedEmail();
  sessionLoading(true, 'Verificando sesión…');
  try{
    const { data } = await sb.auth.getSession();
    if(data?.session){
      const ok = await guardAdmin();
      if(ok){
        hide(loginView);
        show(adminView);
        await fillCurrentUserBox(); // ✅ también al reingresar con sesión viva
        loadBlockedUsers({ force: true, silent: true });
        await loadUsers();
        return;
      }
    }
    hide(adminView);
    show(loginView);
    resetAccountPanel();
  } catch(err){
    console.error('Error verificando sesión', err);
    hide(adminView);
    show(loginView);
    resetAccountPanel();
  } finally {
    setTimeout(()=>sessionLoading(false), 220);
  }
}

bootstrap();

/************* LISTAR USUARIOS *************/
let searchTimer = null;
qs('#q')?.addEventListener('input', ()=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=>{ page=1; loadUsers(); }, 350);
});
qs('#q')?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ page=1; loadUsers(); }});
qs('#btnSearch')?.addEventListener('click', ()=>{ page=1; loadUsers(); });
function navigateToClientApp(event){
  if(event){
    if(typeof event.preventDefault === 'function') event.preventDefault();
    if(typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  overlay(false);
  if($skeleton) $skeleton.style.display='none';
  sessionLoading(true, 'Conectando con WF-TOOLS…');
  try{
    if(window.self !== window.top && window.parent && typeof window.parent.showFrame === 'function'){
      window.parent.showFrame('wfFrame', { reload:true, skipOverlay:true });
      setTimeout(()=> sessionLoading(false), 900);
      return;
    }
  } catch(_err){
    /* ignorado */
  }
  window.location.replace(CLIENT_APP_URL);
}
btnGoClient?.addEventListener('click', navigateToClientApp);
btnLoginGoClient?.addEventListener('click', navigateToClientApp);
qs('#btnReload')?.addEventListener('click', ()=> loadUsers());
qs('#prev')?.addEventListener('click', ()=>{ if(page>1){ page--; loadUsers(); }});
qs('#next')?.addEventListener('click', ()=>{ page++; loadUsers(); });
btnReviewAlerts?.addEventListener('click', ()=>{
  const warning = document.querySelector('.credit-warning');
  if(warning){
    warning.classList.add('highlight-alert');
    warning.scrollIntoView({ behavior:'smooth', block:'center' });
    setTimeout(()=> warning.classList.remove('highlight-alert'), 2200);
  } else {
    toast('Sin alertas de crédito pendientes');
  }
});
btnDownloadReport?.addEventListener('click', downloadReport);

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setFilterMode(btn.dataset.filterMode || 'all');
  });
});

btnToggleBlocked?.addEventListener('click', () => toggleBlockedDrawer());
btnCloseBlocked?.addEventListener('click', () => {
  if(!blockedViewActive) return;
  withButtonLoading(btnCloseBlocked, async () => {
    setBlockedDrawerVisible(false);
  }, { loadingText: 'Cerrando…', minDelay: 200 }).catch(()=>{});
});
btnRefreshBlocked?.addEventListener('click', () => {
  withButtonLoading(btnRefreshBlocked, () => loadBlockedUsers({ force: true }), {
    loadingText: 'Actualizando…',
    minDelay: 350,
  }).catch(()=>{});
});

btnPasswordCancel?.addEventListener('click', () => closePasswordModal());
btnPasswordClose?.addEventListener('click', () => closePasswordModal());
btnPasswordConfirm?.addEventListener('click', () => handlePasswordSubmit());
passwordModalInput?.addEventListener('keydown', (event) => {
  if(event.key === 'Enter'){
    event.preventDefault();
    handlePasswordSubmit();
  }
});

btnDeleteCancel?.addEventListener('click', () => closeDeleteModal());
btnDeleteClose?.addEventListener('click', () => closeDeleteModal());
btnDeleteConfirm?.addEventListener('click', () => handleDeleteConfirm());

updateFilterButtons();
updateBlockedToggleButton();

async function loadUsers(){
  try{
    overlay(true); if($skeleton) $skeleton.style.display='block';
    if($rows) $rows.innerHTML=''; if($cards) $cards.innerHTML='';
    if($empty) $empty.style.display='none';
    blockedSummaryOverride = null;
    const q = qs('#q')?.value.trim() || undefined;
    const res = await api(ENDPOINTS.list, { query:{ page, perPage, q } });
    if(res.networkError){
      toast('No se pudo conectar con el servicio', 'err');
      return;
    }
    if(!res.ok){
      const txt = await res.text();
      console.error('list error:',txt);
      toast('Error cargando usuarios','err'); return;
    }
    const payload = await res.json(); currentRows = payload.users || [];
    if (payload) {
      const summaryCandidate =
        payload.blockedTotal ??
        payload.blocked_count ??
        payload.blockedCount ??
        (payload.summary && payload.summary.blockedCount) ??
        (payload.metrics && payload.metrics.blocked);
      if (Number.isFinite(Number(summaryCandidate))) {
        blockedSummaryOverride = Number(summaryCandidate);
      }
    }
    await enrichUsersWithActiveBlocks(currentRows, payload);
    renderRows(); const pageInfo = qs('#pageInfo'); if(pageInfo) pageInfo.textContent = `Página ${page}`;
  } finally {
    if($skeleton) $skeleton.style.display='none'; overlay(false);
  }
}

function getVisibleRows(){
  if (!Array.isArray(currentRows)) return [];
  let rows;
  if (filterMode === 'admins') {
    rows = currentRows.filter((row) => isAdminRow(row));
  } else if (filterMode === 'clients') {
    rows = currentRows.filter((row) => !isAdminRow(row));
  } else {
    rows = currentRows.slice();
  }
  if (blockedViewActive) {
    rows = rows.filter((row) => {
      const { isBlocked } = getBanState(row);
      return isBlocked;
    });
  }
  return rows;
}

function updateFilterButtons(){
  filterButtons.forEach((btn) => {
    const mode = btn.dataset.filterMode || 'all';
    const active = mode === filterMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function setFilterMode(mode){
  const normalized = mode === 'admins' || mode === 'clients' ? mode : 'all';
  if (filterMode === normalized) return;
  filterMode = normalized;
  updateFilterButtons();
  renderRows();
}

function renderRows(){
  if($rows) $rows.innerHTML=''; if($cards) $cards.innerHTML='';
  if($creditSummary) $creditSummary.style.display='none';
  const rows = getVisibleRows();
  if(!rows.length){
    lastSummary = { creditCount: 0, activeCount: 0, inactiveCount: 0, lowCount: 0, reportingCount: 0, totalRows: 0, blockedCount: 0 };
    if (Number.isFinite(Number(blockedSummaryOverride))) {
      lastSummary.blockedCount = Number(blockedSummaryOverride);
    }
    updateAccountSummary({ creditCount: 0, activeCount: 0, lowCount: 0 });
    if($empty) $empty.style.display='block';
    return;
  }
  if($empty) $empty.style.display='none';

  let reportingCreditCount = 0;
  let reportingLowCount = 0;
  let reportingInactiveCount = 0;
  let reportingActiveCount = 0;
  let reportingCount = 0;

  let blockedCount = 0;

  for(const u of rows){
    const meta = creditMeta(u.credits);
    const creditBadgeHtml = creditBadge(meta);
    const displayName = (u.full_name && u.full_name.trim()) || u.email || 'Usuario';
    const safeDisplayName = escapeHTML(displayName);
    const creditWarningHtml = meta.recommend ? `<div class="credit-warning">Recargar créditos al usuario ${safeDisplayName}</div>` : '';
    const email = u.email || '';
    const fullName = u.full_name || '';
    const plan = u.plan || '—';
    const id = u.id || '';
    const safeEmail = escapeHTML(email);
    const safeFullName = fullName ? escapeHTML(fullName) : '—';
    const safePlan = escapeHTML(plan);
    const safeId = escapeHTML(id);
    const excluded = isExcludedFromReport(email);
    const { isBlocked, until: banUntil, since: banSince } = getBanState(u);
    if(isBlocked) blockedCount++;
    const banTitle = composeBanTitle({ until: banUntil, since: banSince });
    const banTag = isBlocked ? `<span class="tag tag-blocked" title="${escapeHTML(banTitle)}">Bloqueado</span>` : '';
    const blockBtnLabel = isBlocked ? 'Desbloquear' : 'Bloquear';
    const blockBtnClass = isBlocked ? 'btn btn-ghost btn-sm btn-success' : 'btn btn-ghost btn-sm btn-warning';
    const blockBtnState = isBlocked ? 'true' : 'false';
    const blockBtnTitle = isBlocked ? `Quitar bloqueo · ${banTitle}` : 'Bloquear temporalmente al usuario';
    const blockBtnExtraData = [
      `data-blocked="${blockBtnState}"`,
      banUntil ? `data-blocked-until="${escapeHTML(banUntil.toISOString())}"` : '',
      banSince ? `data-blocked-since="${escapeHTML(banSince.toISOString())}"` : '',
    ].filter(Boolean).join(' ');

    if(!excluded){
      reportingCreditCount += meta.value;
      if(meta.recommend) reportingLowCount++;
      if(meta.value <= 0){
        reportingInactiveCount++;
      } else {
        reportingActiveCount++;
      }
      reportingCount++;
    }

    // tabla
    if ($rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${avatarFor()}</td>
        <td>${safeEmail}</td>
        <td>${safeFullName}</td>
        <td><div class="plan-cell"><span class="tag">${safePlan}</span>${banTag}</div></td>
        <td>${creditBadgeHtml}${creditWarningHtml}</td>
        <td style="font-size:.8rem;color:var(--muted)">${safeId}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${safeId}">Editar</button>
            <button class="btn btn-ghost btn-sm" data-act="recovery" data-email="${safeEmail}">Link recuperación</button>
            <button class="btn btn-primary btn-sm" data-act="password" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}">Cambiar contraseña</button>
            <button class="${blockBtnClass}" data-act="block" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}" ${blockBtnExtraData} title="${escapeHTML(blockBtnTitle)}">${blockBtnLabel}</button>
            <button class="btn btn-danger btn-sm" data-act="delete" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}">Eliminar</button>
          </div>
        </td>`;
      if(meta.recommend) tr.classList.add('row-alert');
      $rows.append(tr);
    }

    // cards (móvil)
    if ($cards){
      const card = document.createElement('div');
      card.className='card-row';
      card.innerHTML = `
        <div class="row-top">
          <div style="display:flex; align-items:center; gap:10px">
            ${avatarFor()}
            <div>
              <div style="font-weight:700">${safeFullName}</div>
              <div class="muted" style="font-size:.85rem">${safeEmail}</div>
            </div>
          </div>
          <div class="plan-cell">${banTag}<span class="tag">${safePlan}</span></div>
        </div>
        <div class="row-mid">
          <div><div class="label">Créditos</div><div>${creditBadgeHtml}</div></div>
          <div><div class="label">ID</div><div style="font-size:.8rem;color:var(--muted)">${safeId}</div></div>
        </div>
        ${creditWarningHtml}
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${safeId}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="recovery" data-email="${safeEmail}">Recuperación</button>
          <button class="btn btn-primary btn-sm" data-act="password" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}">Contraseña</button>
          <button class="${blockBtnClass}" data-act="block" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}" ${blockBtnExtraData} title="${escapeHTML(blockBtnTitle)}">${blockBtnLabel}</button>
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${safeId}" data-email="${safeEmail}" data-name="${safeDisplayName}">Eliminar</button>
        </div>`;
      if(meta.recommend) card.classList.add('row-alert');
      $cards.append(card);
    }
  }

  const avgCredits = reportingActiveCount ? reportingCreditCount / reportingActiveCount : 0;
  const avgText = reportingActiveCount
    ? `Promedio ${currencyFmt.format(avgCredits * CREDIT_VALUE)} (${averageFmt.format(avgCredits)} créditos)`
    : 'Sin cuentas activas de clientes';

  updateAccountSummary({ creditCount: reportingCreditCount, activeCount: reportingActiveCount, lowCount: reportingLowCount });

  let resolvedBlockedCount = Number.isFinite(Number(blockedSummaryOverride)) && filterMode === 'all'
    ? Number(blockedSummaryOverride)
    : blockedCount;
  if (blockedViewActive) {
    resolvedBlockedCount = rows.length;
  }

  lastSummary = {
    creditCount: reportingCreditCount,
    activeCount: reportingActiveCount,
    inactiveCount: reportingInactiveCount,
    lowCount: reportingLowCount,
    reportingCount,
    totalRows: rows.length,
    blockedCount: resolvedBlockedCount,
  };

  if ($creditSummary){
    $creditSummary.style.display='flex';
    $creditSummary.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-body">
          <span class="stat-title">Valor total de créditos (clientes)</span>
          <span class="stat-value">${currencyFmt.format(reportingCreditCount * CREDIT_VALUE)}</span>
          <span class="stat-sub">${numberFmt.format(reportingCreditCount)} créditos disponibles</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-body">
          <span class="stat-title">Cuentas activas de clientes</span>
          <span class="stat-value">${numberFmt.format(reportingActiveCount)}</span>
          <span class="stat-sub">${avgText}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📉</div>
        <div class="stat-body">
          <span class="stat-title">Cuentas sin crédito</span>
          <span class="stat-value">${numberFmt.format(reportingInactiveCount)}</span>
          <span class="stat-sub">Clientes analizados: ${numberFmt.format(reportingCount)}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚨</div>
        <div class="stat-body">
          <span class="stat-title">Alertas críticas</span>
          <span class="stat-value">${numberFmt.format(reportingLowCount)}</span>
          <span class="stat-sub">${reportingLowCount ? 'Revisa las cuentas marcadas' : 'Todo en orden'}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⛔</div>
        <div class="stat-body">
          <span class="stat-title">Usuarios bloqueados</span>
          <span class="stat-value">${numberFmt.format(resolvedBlockedCount)}</span>
          <span class="stat-sub">${resolvedBlockedCount ? 'Bloqueos activos en la lista' : 'Sin bloqueos activos'}</span>
        </div>
      </div>`;
  }
}

function downloadReport(){
  const rows = getVisibleRows();
  if(!rows.length){
    toast('No hay usuarios para exportar', 'warn');
    return;
  }
  if(typeof window.XLSX === 'undefined'){
    toast('Biblioteca de reportes no disponible', 'err');
    return;
  }

  const summaryRows = [
    ['Métrica', 'Valor'],
    ['Usuarios listados', numberFmt.format(lastSummary.totalRows)],
    ['Clientes analizados', numberFmt.format(lastSummary.reportingCount)],
    ['Créditos clientes', numberFmt.format(lastSummary.creditCount)],
    ['Valor créditos (COP)', currencyFmt.format(lastSummary.creditCount * CREDIT_VALUE)],
    ['Cuentas activas', numberFmt.format(lastSummary.activeCount)],
    ['Cuentas sin crédito', numberFmt.format(lastSummary.inactiveCount)],
    ['Alertas críticas', numberFmt.format(lastSummary.lowCount)],
    ['Usuarios bloqueados', numberFmt.format(lastSummary.blockedCount)],
  ];

  const summarySheet = window.XLSX.utils.aoa_to_sheet(summaryRows);
  const userData = rows.map((u)=>{
    const email = u.email || '';
    const meta = creditMeta(u.credits);
    const excluded = isExcludedFromReport(email);
    const { isBlocked, until, since } = getBanState(u);
    const banText = until ? formatDateTime(until) : (isBlocked ? 'Activo' : '—');
    const banSinceText = since ? formatDateTime(since) : (isBlocked ? 'Desconocido' : '—');
    return {
      'Correo': email || '—',
      'Nombre': u.full_name || '',
      'Plan': u.plan || '—',
      'Créditos': meta.value,
      'Valor créditos (COP)': currencyFmt.format(meta.value * CREDIT_VALUE),
      'Estado': meta.value > 0 ? 'Activa' : 'Sin créditos',
      'Alerta': meta.recommend ? 'Sí' : 'No',
      'Tipo de cuenta': excluded ? 'Administrativa' : 'Cliente',
      'ID': u.id || '',
      'Bloqueado': isBlocked ? 'Sí' : 'No',
      'Bloqueado hasta': banText,
      'Bloqueado desde': banSinceText,
    };
  });
  const usersSheet = window.XLSX.utils.json_to_sheet(userData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen');
  window.XLSX.utils.book_append_sheet(wb, usersSheet, 'Usuarios');
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  window.XLSX.writeFile(wb, `wf-tools-usuarios-${stamp}.xlsx`);
  toast('Reporte XLSX generado');
}

// acciones delegadas
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const act = btn.dataset.act; if(!act) return;

  if(act==='recovery'){
    const email = btn.dataset.email; if(!email){ toast('Ese usuario no tiene email','warn'); return; }
    btn.disabled = true;
    await api(ENDPOINTS.recovery, { method:'POST', body:{ email } }).catch(()=>{});
    btn.disabled = false; toast('Link de recuperación enviado');
  }

  if(act==='password'){
    const id = btn.dataset.id;
    if(!id){ toast('No se pudo identificar al usuario','err'); return; }
    openPasswordModal({ id, email: btn.dataset.email, name: btn.dataset.name });
    return;
  }

  if(act==='block'){
    const id = btn.dataset.id;
    if(!id){ toast('No se pudo identificar al usuario','err'); return; }
    const displayName = btn.dataset.name || btn.dataset.email || 'usuario';
    const isBlocked = btn.dataset.blocked === 'true';
    if(isBlocked){
      const blockedUntil = parseDate(btn.dataset.blockedUntil);
      const blockedSince = parseDate(btn.dataset.blockedSince);
      openUnblockModalForUser({
        id,
        displayName,
        email: btn.dataset.email || '',
        since: blockedSince,
        until: blockedUntil,
      });
      return;
    }
    openBlockModalForUser({ id, displayName, email: btn.dataset.email || '' });
    return;
  }

  if(act==='delete'){
    const id = btn.dataset.id;
    if(!id){ toast('No se pudo identificar al usuario','err'); return; }
    openDeleteModal({ id, email: btn.dataset.email, name: btn.dataset.name });
    return;
  }

  if(act==='edit'){
    const id = btn.dataset.id; currentEdit = currentRows.find(x=>x.id===id); openModal(currentEdit);
  }
});

/************* MODAL *************/
const modal = qs('#modal');
const m_email = qs('#m_email');
const m_email_err = qs('#m_email_err');
const m_name = qs('#m_name');
const m_plan = qs('#m_plan');
const m_credits = qs('#m_credits');
const m_password = qs('#m_password');
const m_pwd_err = qs('#m_pwd_err');

function sanitizeCreditsInput(raw){
  if(raw == null) return 0;
  const digits = String(raw).replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function setCreditsInputValue(value){
  if(!m_credits) return;
  const numeric = sanitizeCreditsInput(value);
  m_credits.dataset.rawValue = String(numeric);
  m_credits.value = numeric ? numberFmt.format(numeric) : '';
}

function getCreditsInputValue(){
  if(!m_credits) return 0;
  const stored = m_credits.dataset.rawValue;
  if(stored && /^\d+$/.test(stored)) return Number(stored);
  return sanitizeCreditsInput(m_credits.value);
}

function handleCreditsInputEvent(){
  if(!m_credits) return;
  const numeric = sanitizeCreditsInput(m_credits.value);
  m_credits.dataset.rawValue = String(numeric);
  const formatted = numeric ? numberFmt.format(numeric) : '';
  m_credits.value = formatted;
  const pos = formatted.length;
  requestAnimationFrame(()=>{
    try { m_credits.setSelectionRange(pos, pos); } catch {}
  });
}

m_credits?.addEventListener('input', handleCreditsInputEvent);
m_credits?.addEventListener('blur', handleCreditsInputEvent);

function openModal(u){
  if(!u) return;
  m_email.value = u.email || '';
  m_name.value = u.full_name || '';
  m_plan.value = u.plan || 'Básico';
  setCreditsInputValue(u.credits ?? 0);
  m_password.value = '';
  m_email.setAttribute('data-current', u.email || '');
  m_email_err.style.display='none'; m_email.setAttribute('aria-invalid','false');
  m_pwd_err.style.display='none'; m_password.setAttribute('aria-invalid','false');

  document.body.style.overflow = 'hidden'; // bloquear scroll del fondo
  modal.style.display='flex';
}

function closeEditModal(){
  if(modal) modal.style.display = 'none';
  allowBodyScrollIfNoModal();
}

qs('#closeModal')?.addEventListener('click', ()=>{
  closeEditModal();
});

function validateModal(){
  const email = m_email.value.trim();
  const pwd = m_password.value.trim();
  let ok = true;

  if(!email){
    m_email_err.style.display='block';
    m_email.setAttribute('aria-invalid','true');
    ok = false;
  } else {
    m_email_err.style.display='none';
    m_email.setAttribute('aria-invalid','false');
  }

  if(pwd && pwd.length < 12){
    m_pwd_err.style.display='block';
    m_password.setAttribute('aria-invalid','true');
    ok = false;
  } else {
    m_pwd_err.style.display='none';
    m_password.setAttribute('aria-invalid','false');
  }

  return ok;
}

qs('#btnSave')?.addEventListener('click', async()=>{
  if(!currentEdit) return;
  if(!validateModal()) return;

  const payload = {
    userId: currentEdit.id,
    email: m_email.value.trim(),
    full_name: (m_name.value.trim() || null),
    plan: m_plan.value,
    credits: getCreditsInputValue(),
    newPassword: (m_password.value.trim() || null)
  };

  const btn = qs('#btnSave'); btn.disabled = true; btn.textContent = 'Guardando…';
  const res = await api(ENDPOINTS.update, { method:'POST', body: payload });
  if(res?.networkError){
    btn.disabled = false; btn.textContent = 'Guardar cambios';
    toast('No se pudo conectar con el servicio','err');
    return;
  }
  const txt = await res.text();
  btn.disabled = false; btn.textContent = 'Guardar cambios';

  if(!res.ok){
    console.error('update error:', txt);
    toast(`Error al guardar: ${txt}`, 'err');
    return;
  }
  try { const data = JSON.parse(txt); console.log('Perfil guardado:', data.profile); } catch {}

  closeEditModal();
  toast('Cambios guardados');
  loadUsers();
});

qs('#btnRecovery')?.addEventListener('click', async()=>{
  if(!currentEdit?.email) return;
  const btn = qs('#btnRecovery'); btn.disabled = true; btn.textContent = 'Enviando…';
  await api(ENDPOINTS.recovery, { method:'POST', body:{ email: currentEdit.email } }).catch(()=>{});
  btn.disabled = false; btn.textContent = 'Enviar link de recuperación';
  toast('Link de recuperación enviado');
});

// Cerrar modales con tecla Escape
window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    if(blockModal && blockModal.style.display === 'flex'){
      closeBlockModal();
      return;
    }
    if(unblockModal && unblockModal.style.display === 'flex'){
      closeUnblockModal();
      return;
    }
    if(passwordModal && passwordModal.style.display === 'flex'){
      closePasswordModal();
      return;
    }
    if(deleteModal && deleteModal.style.display === 'flex'){
      closeDeleteModal();
      return;
    }
    if(modal && modal.style.display === 'flex'){
      closeEditModal();
    }
  }
});
