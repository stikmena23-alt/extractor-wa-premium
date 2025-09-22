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
};

/************* STATE *************/
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let page = 1; const perPage = 10; let currentRows = []; let currentEdit = null;
let lastSummary = { creditCount: 0, activeCount: 0, inactiveCount: 0, lowCount: 0, reportingCount: 0, totalRows: 0 };

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
async function authHeaderAsync(){
  const { data } = await sb.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function api(path, { method='GET', headers={}, body=null, query=null } = {}){
  const url = new URL(`${FUNCTIONS_BASE}/${path}`);
  if(query) Object.entries(query).forEach(([k,v])=> v!=null && url.searchParams.set(k,String(v)));
  const auth = await authHeaderAsync();
  const res = await fetch(url, { method, headers:{ 'Content-Type':'application/json', ...auth, ...headers }, body: body? JSON.stringify(body): null });
  if(res.status===401){
    toast('Sesión expirada o no autorizada', 'warn');
    await sb.auth.signOut();
    hide(adminView);
    show(loginView);
    resetAccountPanel();
    sessionLoading(false);
  }
  return res;
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
      window.parent.showFrame('wfFrame', { reload:true });
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

async function loadUsers(){
  try{
    overlay(true); if($skeleton) $skeleton.style.display='block';
    if($rows) $rows.innerHTML=''; if($cards) $cards.innerHTML='';
    if($empty) $empty.style.display='none';
    const q = qs('#q')?.value.trim() || undefined;
    const res = await api(ENDPOINTS.list, { query:{ page, perPage, q } });
    if(!res.ok){
      const txt = await res.text();
      console.error('list error:',txt);
      toast('Error cargando usuarios','err'); return;
    }
    const payload = await res.json(); currentRows = payload.users || [];
    renderRows(); const pageInfo = qs('#pageInfo'); if(pageInfo) pageInfo.textContent = `Página ${page}`;
  } finally {
    if($skeleton) $skeleton.style.display='none'; overlay(false);
  }
}

function renderRows(){
  if($rows) $rows.innerHTML=''; if($cards) $cards.innerHTML='';
  if($creditSummary) $creditSummary.style.display='none';
  if(!currentRows.length){
    lastSummary = { creditCount: 0, activeCount: 0, inactiveCount: 0, lowCount: 0, reportingCount: 0, totalRows: 0 };
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

  for(const u of currentRows){
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
        <td><span class="tag">${safePlan}</span></td>
        <td>${creditBadgeHtml}${creditWarningHtml}</td>
        <td style="font-size:.8rem;color:var(--muted)">${safeId}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${safeId}">Editar</button>
            <button class="btn btn-ghost btn-sm" data-act="recovery" data-email="${safeEmail}">Link recuperación</button>
            <button class="btn btn-primary btn-sm" data-act="password" data-id="${safeId}">Cambiar contraseña</button>
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
          <span class="tag">${safePlan}</span>
        </div>
        <div class="row-mid">
          <div><div class="label">Créditos</div><div>${creditBadgeHtml}</div></div>
          <div><div class="label">ID</div><div style="font-size:.8rem;color:var(--muted)">${safeId}</div></div>
        </div>
        ${creditWarningHtml}
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${safeId}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-act="recovery" data-email="${safeEmail}">Recuperación</button>
          <button class="btn btn-primary btn-sm" data-act="password" data-id="${safeId}">Cambiar contraseña</button>
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

  lastSummary = {
    creditCount: reportingCreditCount,
    activeCount: reportingActiveCount,
    inactiveCount: reportingInactiveCount,
    lowCount: reportingLowCount,
    reportingCount,
    totalRows: currentRows.length,
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
      </div>`;
  }
}

function downloadReport(){
  if(!currentRows.length){
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
  ];

  const summarySheet = window.XLSX.utils.aoa_to_sheet(summaryRows);
  const userData = currentRows.map((u)=>{
    const email = u.email || '';
    const meta = creditMeta(u.credits);
    const excluded = isExcludedFromReport(email);
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
    const id = btn.dataset.id; const pwd = prompt('Nueva contraseña (mín 12, segura):'); if(!pwd) return;
    if(pwd.length < 12){ toast('La contraseña debe tener al menos 12 caracteres','warn'); return; }
    btn.disabled = true;
    const res = await api(ENDPOINTS.setPassword, { method:'POST', body:{ userId:id, password:pwd } });
    btn.disabled = false;
    if(res.ok) toast('Contraseña actualizada'); else toast('No se pudo cambiar','err');
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

function openModal(u){
  if(!u) return;
  m_email.value = u.email || '';
  m_name.value = u.full_name || '';
  m_plan.value = u.plan || 'Básico';
  m_credits.value = u.credits ?? 0;
  m_password.value = '';
  m_email.setAttribute('data-current', u.email || '');
  m_email_err.style.display='none'; m_email.setAttribute('aria-invalid','false');
  m_pwd_err.style.display='none'; m_password.setAttribute('aria-invalid','false');

  document.body.style.overflow = 'hidden'; // bloquear scroll del fondo
  modal.style.display='flex';
}

qs('#closeModal')?.addEventListener('click', ()=>{
  modal.style.display='none';
  document.body.style.overflow = ''; // restaurar scroll del fondo
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
    credits: Number(m_credits.value) || 0,
    newPassword: (m_password.value.trim() || null)
  };

  const btn = qs('#btnSave'); btn.disabled = true; btn.textContent = 'Guardando…';
  const res = await api(ENDPOINTS.update, { method:'POST', body: payload });
  const txt = await res.text();
  btn.disabled = false; btn.textContent = 'Guardar cambios';

  if(!res.ok){
    console.error('update error:', txt);
    toast(`Error al guardar: ${txt}`, 'err');
    return;
  }
  try { const data = JSON.parse(txt); console.log('Perfil guardado:', data.profile); } catch {}

  modal.style.display='none';
  document.body.style.overflow = ''; // restaurar scroll
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

// Cerrar modal con tecla Escape
window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && modal.style.display === 'flex'){
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
});
