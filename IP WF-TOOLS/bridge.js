(function(){
      function redirectToLogin(){
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'wftools-open-login' }, '*');
          }
        } catch (_err) {}
      }

      // Solicita la información del usuario al cargar el iframe
      try {
        window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
      } catch(_e) {}

      // Escucha los mensajes provenientes del index unificado
      window.addEventListener('message', function(event) {
        if (!event.data || typeof event.data !== 'object') return;
        const type = event.data.type;
        if (type === 'wftools-user-info') {
          const name = event.data.name || '—';
          const email = event.data.email || '—';
          const plan = event.data.plan || '—';
          const creditsRaw = event.data.credits;
          let credits = (creditsRaw !== undefined && creditsRaw !== null) ? creditsRaw : '—';
          const uNameEl    = document.getElementById('uiUserName');
          const uEmailEl   = document.getElementById('uiUserEmail');
          const uPlanEl    = document.getElementById('uiUserPlan');
          const uCreditsEl = document.getElementById('uiUserCredits');
          const noCreditsEl= document.getElementById('uiNoCredits');
          const analyzeBtn = document.getElementById('btnLookup');
          if (uNameEl)    uNameEl.textContent    = name;
          if (uEmailEl)   uEmailEl.textContent   = email;
          if (uPlanEl)    uPlanEl.textContent    = plan;
          // Formatea visualmente los créditos con separador de miles
          let displayCredits = credits;
          const numCred = parseInt(credits, 10);
          if (Number.isFinite(numCred)) {
            displayCredits = numCred.toLocaleString('es-CO');
          }
          if (uCreditsEl) uCreditsEl.textContent = displayCredits;
          // Controla disponibilidad de botón según créditos
          const num = parseInt(credits, 10);
          if (!Number.isFinite(num) || num <= 0) {
            if (noCreditsEl) noCreditsEl.style.display = 'inline';
            if (analyzeBtn) analyzeBtn.disabled = true;
          } else {
            if (noCreditsEl) noCreditsEl.style.display = 'none';
            if (analyzeBtn) analyzeBtn.disabled = false;
          }
        } else if (type === 'wftools-logout') {
          // Limpia el panel al cerrar sesión y deshabilita la consulta
          ['uiUserName','uiUserEmail','uiUserPlan','uiUserCredits'].forEach(function(id){
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
          });
          const noCreditsEl= document.getElementById('uiNoCredits');
          const analyzeBtn = document.getElementById('btnLookup');
          if (noCreditsEl) noCreditsEl.style.display = 'none';
          if (analyzeBtn) analyzeBtn.disabled = true;
          redirectToLogin();
        }
      });

      const CREDIT_TIMEOUT_MS = 8000;

      function makeRequestId(prefix){
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      async function tryDirectSpend(amount){
        try {
          const parentDoc = window.parent?.document;
          if (!parentDoc) return null;
          const wfFrame = parentDoc.getElementById('wfFrame');
          const auth = wfFrame?.contentWindow?.Auth;
          if (!auth || typeof auth.spendCredit !== 'function') return null;
          for (let i = 0; i < amount; i += 1) {
            const ok = await auth.spendCredit();
            if (!ok) return false;
          }
          try {
            window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
          } catch (_e) {}
          return true;
        } catch (err) {
          console.error('Error al consumir créditos directamente:', err);
          return false;
        }
      }

      function requestCreditsViaBridge(amount){
        return new Promise((resolve) => {
          if (!window.parent || window.parent === window) {
            resolve(true);
            return;
          }
          const requestId = makeRequestId('spend');
          const handler = (event) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type !== 'wftools-spend-credits-result') return;
            if (event.data.requestId !== requestId) return;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve(event.data.ok === true);
          };
          window.addEventListener('message', handler);
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
          }, CREDIT_TIMEOUT_MS);
          try {
            window.parent.postMessage({ type: 'wftools-spend-credits', amount, requestId }, '*');
          } catch (err) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            console.error('No se pudo solicitar consumo de créditos:', err);
            resolve(false);
          }
        }).then((ok) => {
          if (ok) {
            try {
              window.parent.postMessage({ type: 'wftools-request-user-info' }, '*');
            } catch (_e) {}
          }
          return ok;
        });
      }

      // Consumir créditos comunicándose con el contenedor principal
      async function spendCredits(n) {
        const amount = Number.parseInt(n, 10);
        if (!Number.isFinite(amount) || amount <= 0) return true;
        const direct = await tryDirectSpend(amount);
        if (direct === true) return true;
        if (direct === false) return false;
        return requestCreditsViaBridge(amount);
      }

      // Envuelve la función de búsqueda para descontar créditos antes de analizar
      const originalLookup = window.lookup;
      if (typeof originalLookup === 'function') {
        window.lookup = async function() {
          const ok = await spendCredits(4);
          if (!ok) {
            alert('No tienes créditos suficientes para esta consulta.');
            return;
          }
          return originalLookup.apply(this, arguments);
        };
      }

      // Maneja el botón de cierre de sesión (en la barra de usuario)
      const uiLogoutBtn = document.getElementById('uiLogoutBtn');
      async function tryDirectLogout(){
        try {
          const parentDoc = window.parent?.document;
          if (!parentDoc) return null;
          const wfFrame = parentDoc.getElementById('wfFrame');
          const frameDoc = wfFrame?.contentWindow?.document;
          if (!frameDoc) return null;
          const logoutEl = frameDoc.getElementById('logoutBtn');
          if (logoutEl && typeof logoutEl.click === 'function') {
            logoutEl.click();
            return true;
          }
          return null;
        } catch (err) {
          console.error('Error al cerrar sesión directamente:', err);
          return false;
        }
      }

      function requestLogoutViaBridge(){
        return new Promise((resolve) => {
          if (!window.parent || window.parent === window) {
            resolve(true);
            return;
          }
          const requestId = makeRequestId('logout');
          const handler = (event) => {
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.type !== 'wftools-logout-result') return;
            if (event.data.requestId !== requestId) return;
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve(event.data.ok === true);
          };
          window.addEventListener('message', handler);
          const timer = setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
          }, CREDIT_TIMEOUT_MS);
          try {
            window.parent.postMessage({ type: 'wftools-request-logout', requestId }, '*');
          } catch (err) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            console.error('No se pudo solicitar el cierre de sesión:', err);
            resolve(false);
          }
        });
      }

      if (uiLogoutBtn) {
        uiLogoutBtn.addEventListener('click', async function() {
          const viaBridge = await requestLogoutViaBridge();
          if (viaBridge) {
            redirectToLogin();
            return;
          }
          const direct = await tryDirectLogout();
          if (direct) {
            redirectToLogin();
            return;
          }
          alert('No se pudo cerrar la sesión automáticamente. Intenta salir desde WF-TOOLS.');
        });
      }
    })();
