(function(){
  const analyzeBtn = document.getElementById('btnAnalyze');
  const resultsBox = document.getElementById('results');
  const rawOut = document.getElementById('rawOut');
  const osintLinks = document.getElementById('osintLinks');

  function setAnalysisLoading(){
    if (resultsBox){
      resultsBox.innerHTML = '<div class="loading-state">Procesando números…</div>';
    }
    if (rawOut) rawOut.textContent = '';
    if (osintLinks) osintLinks.innerHTML = '';
  }

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

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async function(evt){
      if (evt) {
        evt.preventDefault?.();
        evt.stopImmediatePropagation?.();
      }
      if (spendInFlight || bridge.isSpending()) {
        return;
      }
      spendInFlight = true;
      bridge.setSpending(true);
      bridge.setButtonLoading('Descontando crédito…');
      bridge.showCreditLoader('Descontando 1 crédito…');
      const ok = await bridge.spendCredits(1);
      const spendResult = typeof bridge.getLastSpendResult === 'function' ? bridge.getLastSpendResult() : null;
      if (!ok) {
        const reason = spendResult?.reason || 'denied';
        const message = spendResult?.message;
        if (reason === 'session-expired') {
          alert(message || 'Tu sesión expiró. Inicia sesión para continuar.');
          bridge.redirectToLogin();
        } else if (reason === 'no-credits') {
          alert(message || 'No tienes créditos suficientes para esta consulta.');
        } else if (reason === 'network') {
          alert(message || 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo nuevamente.');
        } else if (reason === 'timeout') {
          alert(message || 'La solicitud de créditos tardó demasiado. Inténtalo nuevamente.');
        } else {
          alert(message || 'No se pudo consumir créditos. Intenta nuevamente.');
        }
        bridge.hideCreditLoader(400);
        bridge.restoreButton();
        bridge.setSpending(false);
        spendInFlight = false;
        return;
      }
      const unlimited = spendResult?.reason === 'unlimited';
      let consumed = 0;
      if (!unlimited) {
        consumed = Number.isFinite(Number(spendResult?.amount)) && Number(spendResult.amount) > 0
          ? Number(spendResult.amount)
          : 1;
      }
      if (consumed > 0) {
        bridge.reflectLocalSpend(consumed);
      }
      setAnalysisLoading();
      const successMessage = unlimited ? 'Créditos ilimitados, analizando…' : 'Crédito descontado, analizando…';
      bridge.showCreditLoader(successMessage);
      try {
        const raw = (document.querySelector('#numbers').value || '')
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const numbers = typeof dedupe === 'function' ? dedupe(raw) : raw;
        const country = document.querySelector('#country').value || 'CO';
        const rows = typeof analyzeOffline === 'function'
          ? analyzeOffline(numbers, country)
          : [];
        if (window) {
          window.__rows = rows;
        }
        if (typeof renderResults === 'function') {
          renderResults(rows);
        }
        if (typeof buildOSINTLinks === 'function') {
          buildOSINTLinks(rows.map((r) => r.e164 || r.input));
        }
      } finally {
        bridge.restoreButton();
        bridge.setSpending(false);
        spendInFlight = false;
        bridge.hideCreditLoader(800);
      }
    }, true);
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
