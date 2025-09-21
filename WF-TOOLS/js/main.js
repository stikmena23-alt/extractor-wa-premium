// main.js
// Lista de correos autorizados para el acceso de administradores.  Se incluyen
// tres elementos para permitir la ampliación a otros dos correos además del
// principal.  Para añadir más administradores, simplemente agrega sus emails
// en este arreglo.
const ADMIN_EMAILS = [
  'stikmena6@gmail.com',
  'admin2@gmail.com', // correo adicional (puedes cambiarlo)
  'admin3@example.com'  // correo adicional (puedes cambiarlo)
];
const ADMIN_PREFIXES = ['admin.', 'sup.'];
const ADMIN_PORTAL_URL = 'https://stikmena23-alt.github.io/wf-toolsadmin/';

function isPrivilegedEmail(email){
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (ADMIN_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase() === normalized);
}

function openAdminPortal(){
  const adminWindow = window.open(ADMIN_PORTAL_URL, '_blank');
  if (adminWindow) {
    adminWindow.opener = null;
  }
}

function setupAdminAccess(){
  const buttonIds = ['adminAccessBtn', 'adminPanelBtn', 'adminPanelBtnInline'];
  const buttons = buttonIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (!buttons.length) return;

  const handleClick = (event) => {
    // Si estamos dentro de un iframe (por ejemplo, en el index unificado),
    // delegamos la navegación al contenedor padre para evitar prompts y
    // abrir el panel de administración de forma integrada.
    try {
      if (window.self !== window.top && window.parent && typeof window.parent.showFrame === 'function') {
        event.preventDefault();
        event.stopPropagation();
        window.parent.showFrame('adminFrame');
        return;
      }
    } catch (_) {
      // En caso de error (por ejemplo, políticas de origen), seguimos con el flujo normal
    }

    const sessionEmail = typeof window.Auth?.getCurrentUserEmail === 'function'
      ? window.Auth.getCurrentUserEmail()
      : null;

    if (sessionEmail && isPrivilegedEmail(sessionEmail)) {
      event.preventDefault();
      openAdminPortal();
      return;
    }

    const input = prompt('Ingresa el correo de administrador');
    if (!input) return;
    const email = input.trim().toLowerCase();
    if (isPrivilegedEmail(email)) {
      event.preventDefault();
      openAdminPortal();
    } else {
      alert('Correo de administrador no válido.');
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', handleClick);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupAdminAccess();
    window.AppCore?.init();
    if (window.Auth?.init) {
      await window.Auth.init();
    }
  } catch (error) {
    console.error('Error inicializando la aplicación', error);
  }
});
