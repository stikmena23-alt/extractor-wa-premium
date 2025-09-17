// main.js
const ADMIN_EMAIL = 'stikmena6@gmail.com';
const ADMIN_PORTAL_URL = 'https://stikmena23-alt.github.io/wf-toolsadmin/';

function setupAdminAccess(){
  const adminBtn = document.getElementById('adminAccessBtn');
  if (!adminBtn) return;
  adminBtn.addEventListener('click', () => {
    const input = prompt('Ingresa el correo de administrador');
    if (!input) return;
    if (input.trim().toLowerCase() === ADMIN_EMAIL) {
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
