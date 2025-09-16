// main.js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    window.AppCore?.init();
    if (window.Auth?.init) {
      await window.Auth.init();
    }
  } catch (error) {
    console.error('Error inicializando la aplicación', error);
  }
});
