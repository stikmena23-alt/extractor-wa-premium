const SESSION_KEY = 'userSession';
const LOGIN_PAGE = 'login.html';

const supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

function normalizeSession(raw){
  if (!raw) return null;
  const session = { ...raw };
  session.credits = Number(session.credits ?? 0);
  if (!Number.isFinite(session.credits)) session.credits = 0;
  return session;
}

function isSessionValid(session){
  if (!session) return false;
  if (!session.user || !session.userId) return false;
  return Number.isFinite(session.credits) && session.credits > 0;
}

function redirectToLogin(){
  const current = (window.location.pathname || '').split('/').pop();
  if (current === LOGIN_PAGE) return;
  window.location.href = LOGIN_PAGE;
}

function getSession(){
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    return normalizeSession(stored);
  } catch {
    return null;
  }
}

function setSession(session){
  const normalized = normalizeSession(session);
  if (!normalized){
    clearSession();
    return null;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
  updateUI();
  return normalized;
}

function clearSession(){
  localStorage.removeItem(SESSION_KEY);
  updateUI();
}

function invalidateSession(){
  clearSession();
  redirectToLogin();
}

function requireSession(){
  const session = getSession();
  if (!isSessionValid(session)){
    invalidateSession();
    return null;
  }
  return session;
}

async function refreshSession(){
  const session = getSession();
  if (!session) return null;
  if (!session.userId){
    invalidateSession();
    return null;
  }
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('plan, credits')
    .eq('id', session.userId)
    .single();
  if (error || !data){
    invalidateSession();
    return null;
  }
  session.plan = data.plan;
  session.credits = Number(data.credits ?? 0);
  setSession(session);
  if (!isSessionValid(session)){
    alert('Se acabaron tus créditos');
    invalidateSession();
    return null;
  }
  return session;
}

async function login(email, password){
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  const userId = data.user.id;
  const { data: profile, error: pError } = await supabaseClient
    .from('profiles')
    .select('plan, credits')
    .eq('id', userId)
    .single();
  if (pError) throw pError;
  const credits = Number(profile.credits ?? 0);
  if (!Number.isFinite(credits) || credits <= 0){
    throw new Error('Sin créditos disponibles');
  }
  const session = {
    user: email,
    userId,
    plan: profile.plan,
    credits,
    token: data.session.access_token
  };
  return setSession(session);
}

async function consumeCredit(){
  const session = requireSession();
  if (!session) return false;
  if (session.credits <= 0){
    alert('Se acabaron tus créditos');
    invalidateSession();
    return false;
  }
  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ credits: session.credits - 1 })
    .eq('id', session.userId)
    .select('credits')
    .single();
  if (error || !data){
    alert('Error al consumir crédito');
    return false;
  }
  session.credits = Number(data.credits ?? 0);
  if (!isSessionValid(session)){
    alert('Se acabaron tus créditos');
    invalidateSession();
    return false;
  }
  setSession(session);
  return true;
}

function updateUI(){
  const session = getSession();
  const creditEl = document.getElementById('creditCount');
  const planEl = document.getElementById('planName');
  const userEl = document.getElementById('userName');
  if (creditEl) creditEl.textContent = session ? session.credits : '-';
  if (planEl) planEl.textContent = session ? (session.plan || '-') : '-';
  if (userEl) userEl.textContent = session ? session.user : '';
}

window.Auth = {
  getSession,
  setSession,
  clearSession,
  requireSession,
  consumeCredit,
  updateUI,
  login,
  refreshSession
};
