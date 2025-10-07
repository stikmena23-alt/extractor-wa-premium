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
      if (!ok) {
        alert('No tienes créditos suficientes para esta consulta.');
        bridge.hideCreditLoader(400);
        bridge.restoreButton();
        bridge.setSpending(false);
        spendInFlight = false;
        return;
      }
      bridge.reflectLocalSpend(1);
      setAnalysisLoading();
      bridge.showCreditLoader('Crédito descontado, analizando…');
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
