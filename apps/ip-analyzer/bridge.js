(function(){
  const analyzeBtn = document.getElementById('btnLookup');

  const bridge = window.FrameCreditBridge?.create({
    analyzeButton: analyzeBtn,
    creditsElementId: 'uiUserCredits',
    noCreditsElementId: 'uiNoCredits',
    userInfoBarId: 'userInfoBar',
    logoutButtonId: 'uiLogoutBtn',
    userFields: {
      name: 'uiUserName',
      email: 'uiUserEmail',
      plan: 'uiUserPlan',
    },
  });

  if (!bridge) {
    return;
  }

  bridge.requestUserInfo();

  window.addEventListener('message', (event) => {
    if (bridge.handleMessage(event)) {
      return;
    }
  });

  let spendInFlight = false;
  const originalLookup = window.lookup;

  if (typeof originalLookup === 'function') {
    const wrappedLookup = async function(){
      const evt = arguments[0];
      if (evt && typeof evt.preventDefault === 'function') {
        evt.preventDefault();
      }
      if (evt && typeof evt.stopImmediatePropagation === 'function') {
        evt.stopImmediatePropagation();
      }
      if (spendInFlight || bridge.isSpending()) {
        return;
      }
      spendInFlight = true;
      bridge.setSpending(true);
      bridge.setButtonLoading('Validando acceso…');
      bridge.showCreditLoader('Preparando análisis…');
      const ok = await bridge.spendCredits(4);
      const spendResult = typeof bridge.getLastSpendResult === 'function' ? bridge.getLastSpendResult() : null;
      if (!ok) {
        const reason = spendResult?.reason || 'denied';
        const message = spendResult?.message;
        if (reason === 'session-expired') {
          alert(message || 'Tu sesión expiró. Inicia sesión para continuar.');
          bridge.redirectToLogin();
        } else if (reason === 'network') {
          alert(message || 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.');
        } else if (reason === 'timeout') {
          alert(message || 'La solicitud de créditos tardó demasiado. Inténtalo nuevamente.');
        } else {
          alert(message || 'No se pudo validar el acceso. Intenta nuevamente.');
        }
        bridge.hideCreditLoader(400);
        bridge.restoreButton();
        bridge.setSpending(false);
        spendInFlight = false;
        return;
      }
      const unlimited = spendResult?.reason === 'unlimited';
      const successMessage = unlimited
        ? 'Acceso ilimitado confirmado. Ejecutando análisis…'
        : 'Acceso confirmado. Ejecutando análisis…';
      bridge.showCreditLoader(successMessage);
      try {
        return await originalLookup.apply(this, Array.prototype.slice.call(arguments, 1));
      } finally {
        bridge.restoreButton();
        bridge.hideCreditLoader(800);
        bridge.setSpending(false);
        spendInFlight = false;
      }
    };
    try {
      window.lookup = wrappedLookup;
      lookup = wrappedLookup;
    } catch (_err) {
      window.lookup = wrappedLookup;
    }
    if (analyzeBtn) {
      analyzeBtn.removeEventListener('click', originalLookup);
      analyzeBtn.addEventListener('click', wrappedLookup);
    }
  }

  const uiLogoutBtn = document.getElementById('uiLogoutBtn');
  if (uiLogoutBtn) {
    uiLogoutBtn.addEventListener('click', async function(){
      const viaBridge = await bridge.requestLogoutViaBridge();
      if (viaBridge) {
        bridge.redirectToLogin();
        return;
      }
      const direct = await bridge.tryDirectLogout();
      if (direct) {
        bridge.redirectToLogin();
        return;
      }
      alert('No se pudo cerrar la sesión automáticamente. Intenta salir desde WF-TOOLS.');
    });
  }
})();
