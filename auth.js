const SESSION_KEY = 'userSession';

function getSession(){
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function setSession(session){
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  updateUI();
}

function clearSession(){
  localStorage.removeItem(SESSION_KEY);
  updateUI();
}

function requireSession(){
  const session = getSession();
  if (!session || !session.user || session.credits <= 0){
    clearSession();
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function consumeCredit(){
  const session = requireSession();
  if (!session) return;
  session.credits -= 1;
  if (session.credits <= 0){
    alert('Se acabaron tus créditos');
    clearSession();
    window.location.href = 'login.html';
    return;
  }
  setSession(session);
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

// Export helpers for other scripts
window.Auth = { getSession, setSession, clearSession, requireSession, consumeCredit, updateUI };
