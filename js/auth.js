// auth.js
(function (global) {
  if (!global.supabase || typeof global.supabase.createClient !== "function") {
    console.error("Supabase no está disponible. Se omite la inicialización de autenticación.");
    global.Auth = {
      init: async () => {},
      spendCredit: async () => true,
    };
    return;
  }
  const SUPABASE_URL = "https://htkwcjhcuqyepclpmpsv.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0a3djamhjdXF5ZXBjbHBtcHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTk4MTgsImV4cCI6MjA3MzQ5NTgxOH0.dBeJjYm12YW27LqIxon5ifPR1ygfFXAHVg8ZuCZCEf8";

  const supabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const loginScreen = document.getElementById("loginScreen");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const loginLoading = document.getElementById("loginLoading");
  const logoutBtn = document.getElementById("logoutBtn");
  const appWrap = document.getElementById("appWrap");
  const planChip = document.getElementById("planChip");
  const planNameEl = document.getElementById("planName");
  const creditsChip = document.getElementById("creditsChip");
  const creditCountEl = document.getElementById("creditCount");
  const userEmailEl = document.getElementById("currentUserEmail");
  const userPlanEl = document.getElementById("currentUserPlan");
  const userCreditsEl = document.getElementById("currentUserCredits");
  const creditStatusEl = document.getElementById("creditStatus");
  const creditBarEl = document.getElementById("creditBar");
  const creditBarFillEl = document.getElementById("creditBarFill");
  const creditAlertEl = document.getElementById("creditAlertMsg");
  const sessionStatusText = document.getElementById("sessionStatusText");
  const sessionToast = document.getElementById("sessionToast");
  const sessionModal = document.getElementById("sessionModal");
  const sessionModalTitle = document.getElementById("sessionModalTitle");
  const sessionModalMessage = document.getElementById("sessionModalMessage");
  const sessionModalClose = document.getElementById("sessionModalClose");

  let lastCreditsValue = null;
  let maxCreditsSeen = 0;
  let toastTimeout = null;
  let pendingWelcomeEmail = null;

  function toggleLoginButton(disabled) {
    if (loginBtn) loginBtn.disabled = !!disabled;
  }

  function toggleLogoutButton(disabled) {
    if (logoutBtn) logoutBtn.disabled = !!disabled;
  }

  function setSessionStatusMessage(message, state) {
    if (!sessionStatusText) return;
    sessionStatusText.textContent = message || "";
    sessionStatusText.classList.remove("active", "closed");
    if (state === "active") {
      sessionStatusText.classList.add("active");
    } else if (state === "closed") {
      sessionStatusText.classList.add("closed");
    }
  }

  function hideSessionToast() {
    if (!sessionToast) return;
    sessionToast.classList.remove("is-visible");
    sessionToast.setAttribute("aria-hidden", "true");
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  }

  function showSessionToast(message, variant = "info") {
    if (!sessionToast) return;
    sessionToast.textContent = message;
    sessionToast.dataset.variant = variant;
    sessionToast.classList.add("is-visible");
    sessionToast.setAttribute("aria-hidden", "false");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      hideSessionToast();
    }, 4600);
  }

  function closeSessionModal() {
    if (!sessionModal) return;
    sessionModal.classList.remove("is-open");
    sessionModal.setAttribute("aria-hidden", "true");
  }

  function openSessionModal(title, message) {
    if (!sessionModal) return;
    if (sessionModalTitle) sessionModalTitle.textContent = title;
    if (sessionModalMessage) sessionModalMessage.textContent = message;
    sessionModal.classList.add("is-open");
    sessionModal.setAttribute("aria-hidden", "false");
    if (sessionModalClose) {
      try {
        sessionModalClose.focus({ preventScroll: true });
      } catch (_err) {
        sessionModalClose.focus();
      }
    }
  }

  function showWelcomeFeedback(email) {
    const displayEmail = email || "tu cuenta";
    showSessionToast(`Inicio de sesión exitoso para ${displayEmail}.`, "success");
    openSessionModal("¡Sesión iniciada!", `Bienvenido, ${displayEmail}. Tus créditos y reportes ya están disponibles.`);
  }

  function activeSessionMessage(email) {
    const displayEmail = email || "tu cuenta";
    return `Sesión activa como ${displayEmail}. ¡Listo para trabajar!`;
  }

  sessionToast?.addEventListener("click", hideSessionToast);
  sessionModalClose?.addEventListener("click", closeSessionModal);
  sessionModal?.addEventListener("click", (event) => {
    if (event.target === sessionModal) {
      closeSessionModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSessionModal();
    }
  });

  function updateUserIdentity(user) {
    if (userEmailEl) userEmailEl.textContent = user?.email || "-";
  }

  function renderCreditState(rawCredits) {
    if (!creditStatusEl) return;
    const hasValue = typeof rawCredits === "number" && Number.isFinite(rawCredits);
    if (!hasValue) {
      if (userCreditsEl) userCreditsEl.textContent = "0";
      creditStatusEl.dataset.state = "idle";
      if (creditBarEl) {
        creditBarEl.setAttribute("aria-valuenow", "0");
        creditBarEl.setAttribute("aria-valuemax", "0");
      }
      if (creditBarFillEl) creditBarFillEl.style.width = "0%";
      if (creditAlertEl) {
        creditAlertEl.textContent = "Inicia sesión para visualizar tu saldo.";
        creditAlertEl.classList.remove("pulse");
      }
      lastCreditsValue = null;
      maxCreditsSeen = 0;
      return;
    }

    const credits = Math.max(0, Math.floor(rawCredits));
    if (userCreditsEl) userCreditsEl.textContent = String(credits);

    maxCreditsSeen = Math.max(maxCreditsSeen, credits);
    const maxForBar = maxCreditsSeen || credits || 1;
    const percent = Math.max(0, Math.min(100, Math.round((credits / maxForBar) * 100)));
    if (creditBarFillEl) creditBarFillEl.style.width = `${percent}%`;
    if (creditBarEl) {
      creditBarEl.setAttribute("aria-valuenow", String(credits));
      creditBarEl.setAttribute("aria-valuemax", String(maxForBar));
    }

    let state = "success";
    let message = `Saldo disponible: ${credits} crédito${credits === 1 ? "" : "s"}.`;

    if (credits === 0) {
      state = "danger";
      message = "Sin créditos disponibles. Escríbenos al +57 312 646 1216 para recargar.";
    } else if (credits <= 3) {
      state = "danger";
      message = `Te quedan ${credits} crédito${credits === 1 ? "" : "s"}. Escríbenos al +57 312 646 1216 para recargar.`;
    } else if (credits <= 8) {
      state = "warning";
      message = `Te quedan ${credits} créditos. Ve preparando una recarga.`;
    } else if (credits <= 15) {
      state = "success";
      message = `Saldo moderado: ${credits} créditos disponibles.`;
    }

    creditStatusEl.dataset.state = state;
    if (creditAlertEl) {
      const decreased = lastCreditsValue !== null && credits < lastCreditsValue;
      creditAlertEl.textContent = message;
      creditAlertEl.classList.toggle("pulse", decreased);
      if (decreased) {
        setTimeout(() => creditAlertEl.classList.remove("pulse"), 1600);
      }
    }

    lastCreditsValue = credits;
  }

  function showLoading(show) {
    if (loginLoading) loginLoading.style.display = show ? "block" : "none";
  }

  function showError(message) {
    if (!loginError) return;
    loginError.textContent = message || "";
    loginError.style.display = message ? "block" : "none";
  }

  function resetLoginForm() {
    loginForm?.reset();
    showError("");
    showLoading(false);
    toggleLoginButton(false);
  }

  function clearCreditsUI() {
    if (planChip) {
      planChip.style.display = "none";
      planChip.className = "chip";
    }
    if (planNameEl) planNameEl.textContent = "-";
    if (userPlanEl) userPlanEl.textContent = "-";
    if (creditsChip) creditsChip.style.display = "none";
    if (creditCountEl) creditCountEl.textContent = "0";
    renderCreditState(null);
    if (logoutBtn) {
      logoutBtn.style.display = "none";
      logoutBtn.disabled = false;
    }
    global.AppCore?.setCreditDependentActionsEnabled(false);
  }

  function showLoginUI(message, state) {
    if (appWrap) appWrap.style.display = "none";
    if (loginScreen) loginScreen.style.display = "flex";
    clearCreditsUI();
    resetLoginForm();
    updateUserIdentity(null);
    closeSessionModal();
    pendingWelcomeEmail = null;
    if (message) {
      setSessionStatusMessage(message, state);
    } else {
      setSessionStatusMessage("Inicia sesión para ver tu plan y tus créditos en tiempo real.");
    }
  }

  function showAppUI() {
    if (loginScreen) loginScreen.style.display = "none";
    if (appWrap) appWrap.style.display = "block";
    resetLoginForm();
  }

  function applyCredits(profile) {
    if (!profile) return;
    const planName = profile.plan || "-";
    if (planNameEl) planNameEl.textContent = planName;
    if (userPlanEl) userPlanEl.textContent = planName;
    if (planChip) {
      const planClass = planName.toLowerCase();
      planChip.className = "chip" + (planClass ? " plan-" + planClass : "");
      planChip.style.display = "inline-block";
    }
    const numericCredits = Number(profile.credits);
    if (Number.isFinite(numericCredits) && creditCountEl) {
      creditCountEl.textContent = String(Math.max(0, Math.floor(numericCredits)));
    }
    if (creditsChip) creditsChip.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    const safeCredits = Number.isFinite(numericCredits) ? numericCredits : null;
    global.AppCore?.setCreditDependentActionsEnabled((safeCredits || 0) > 0);
    renderCreditState(safeCredits);
  }

  async function updateCredits() {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("plan, credits")
      .single();
    if (error) {
      console.error("Perfil", error);
      return;
    }
    applyCredits(profile);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    showError("");
    toggleLoginButton(true);
    showLoading(true);

    const email = loginEmail?.value.trim();
    const password = loginPassword?.value.trim();
    if (!email || !password) {
      showLoading(false);
      toggleLoginButton(false);
      showError("Completa email y contraseña");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);
    toggleLoginButton(false);

    if (error) {
      const message = error.message || "Error de login";
      showError(message);
      showSessionToast(message, "danger");
      return;
    }

    pendingWelcomeEmail = data?.user?.email || email;
    showError("");
  }

  async function handleLogout() {
    toggleLogoutButton(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toggleLogoutButton(false);
      showSessionToast("No hay una sesión activa para cerrar.", "info");
      showLoginUI();
      return;
    }

    const { error } = await supabase.auth.signOut();
    toggleLogoutButton(false);
    if (error) {
      showSessionToast("No se pudo cerrar sesión. Intenta nuevamente.", "danger");
    }
  }

  async function spendCredit() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      showSessionToast("Tu sesión expiró. Inicia sesión para continuar.", "danger");
      showLoginUI("Tu sesión expiró. Inicia sesión para continuar.", "closed");
      return false;
    }

    const { error } = await supabase.rpc("spend_credit");
    if (error) {
      if ((error.message || "").includes("NO_CREDITS")) {
        showSessionToast("Sin créditos disponibles. Escríbenos al +57 312 646 1216 para recargar.", "danger");
        global.AppCore?.setCreditDependentActionsEnabled(false);
      } else {
        showSessionToast(error.message || "No se pudo consumir un crédito.", "danger");
      }
      await updateCredits();
      return false;
    }

    const currentUi = creditCountEl ? parseInt(creditCountEl.textContent || "0", 10) : (lastCreditsValue ?? 0);
    const next = Math.max(0, (Number.isFinite(currentUi) ? currentUi : 0) - 1);
    if (creditCountEl) {
      creditCountEl.textContent = String(next);
    }
    global.AppCore?.setCreditDependentActionsEnabled(next > 0);
    renderCreditState(next);
    return true;
  }

  async function init() {
    global.AppCore?.setCreditDependentActionsEnabled(false);
    loginForm?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    updateUserIdentity(session?.user || null);

    if (session) {
      setSessionStatusMessage(activeSessionMessage(session.user?.email), "active");
      showAppUI();
      await updateCredits();
    } else {
      showLoginUI();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      updateUserIdentity(session?.user || null);
      if (session) {
        showAppUI();
        await updateCredits();
        const email = session.user?.email || pendingWelcomeEmail || "tu cuenta";
        setSessionStatusMessage(activeSessionMessage(email), "active");
        if (pendingWelcomeEmail || event === "SIGNED_IN") {
          showWelcomeFeedback(email);
          pendingWelcomeEmail = null;
        }
      } else {
        const message = event === "SIGNED_OUT"
          ? "Sesión cerrada. ¡Hasta pronto!"
          : "Inicia sesión para ver tu plan y tus créditos en tiempo real.";
        showLoginUI(message, event === "SIGNED_OUT" ? "closed" : undefined);
        if (event === "SIGNED_OUT") {
          showSessionToast("Sesión cerrada correctamente. ¡Hasta pronto!", "info");
        }
      }
    });
  }

  global.Auth = {
    init,
    spendCredit,
  };
})(window);
