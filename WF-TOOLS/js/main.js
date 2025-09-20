// main.js
// Lista de correos autorizados para el acceso de administradores.  Se incluyen
// tres elementos para permitir la ampliación a otros dos correos además del
// principal.  Para añadir más administradores, simplemente agrega sus emails
// en este arreglo.
const ADMIN_EMAILS = [
  'stikmena6@gmail.com',
  'andresquinto243@gmail.com', // correo adicional (puedes cambiarlo)
  'admin3@example.com'  // correo adicional (puedes cambiarlo)
];
const ADMIN_PORTAL_URL = 'https://stikmena23-alt.github.io/wf-toolsadmin/';

function setupAdminAccess(){
  const adminBtn = document.getElementById('adminAccessBtn');
  if (!adminBtn) return;
  adminBtn.addEventListener('click', (event) => {
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

    // Comportamiento normal cuando se abre WF‑TOOLS de forma independiente
    const input = prompt('Ingresa el correo de administrador');
    if (!input) return;
    const email = input.trim().toLowerCase();
    // Comprobamos si el email ingresado se encuentra en la lista de admin
    const isAdmin = ADMIN_EMAILS.some((adm) => adm.toLowerCase() === email);
    if (isAdmin) {
      const adminWindow = window.open(ADMIN_PORTAL_URL, '_blank');
      if (adminWindow) {
        adminWindow.opener = null;
      }
    } else {
      alert('Correo de administrador no válido.');
    }
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
