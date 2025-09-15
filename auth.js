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
}

function clearSession(){
  localStorage.removeItem(SESSION_KEY);
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

// Export helpers for other scripts
window.Auth = { getSession, setSession, clearSession, requireSession, consumeCredit };
