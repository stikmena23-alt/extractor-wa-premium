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
  const loginTogglePassword = document.getElementById("loginTogglePassword");
  const loginRemember = document.getElementById("loginRemember");
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
  const bodyEl = document.body;
  const sessionLoading = document.getElementById("sessionLoading");
  const sessionLoadingMessage = document.getElementById("sessionLoadingMessage");

  let lastCreditsValue = null;
  let maxCreditsSeen = 0;
  let toastTimeout = null;
  let pendingWelcomeEmail = null;
  const creditFormatter = new Intl.NumberFormat("es-CO");
  const REMEMBER_KEY = "wf-tools.login.remembered-email";
  const STORAGE_TEST_KEY = "wf-tools.login.storage-test";
  const storage = global.localStorage;
  let storageAvailable = false;

  try {
    if (storage) {
      const testValue = String(Date.now());
      storage.setItem(STORAGE_TEST_KEY, testValue);
      const storedValue = storage.getItem(STORAGE_TEST_KEY);
      storage.removeItem(STORAGE_TEST_KEY);
      storageAvailable = storedValue === testValue;
    }
  } catch (_err) {
    storageAvailable = false;
  }

  function toggleLoginButton(disabled) {
    if (loginBtn) loginBtn.disabled = !!disabled;
  }

  function toggleLogoutButton(disabled) {
    if (logoutBtn) logoutBtn.disabled = !!disabled;
  }

  function setSessionLoadingState(active, message) {
    if (sessionLoadingMessage && message) {
      sessionLoadingMessage.textContent = message;
    }
    if (sessionLoading) {
      sessionLoading.setAttribute("aria-busy", active ? "true" : "false");
      sessionLoading.hidden = !active;
    }
    if (bodyEl) {
      bodyEl.classList.toggle("is-checking-session", !!active);
    }
  }

  function formatCreditsValue(value) {
    const numeric = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return creditFormatter.format(numeric);
  }

  function readCreditsFromText(text) {
    if (!text) return 0;
    const digits = text.replace(/\D+/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function getCreditsFromUi() {
    if (Number.isFinite(lastCreditsValue)) return lastCreditsValue;
    if (creditCountEl) return readCreditsFromText(creditCountEl.textContent || "");
    if (userCreditsEl) return readCreditsFromText(userCreditsEl.textContent || "");
    return 0;
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
      const zeroFormatted = formatCreditsValue(0);
      if (userCreditsEl) userCreditsEl.textContent = zeroFormatted;
      if (creditCountEl) creditCountEl.textContent = zeroFormatted;
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
    const formattedCredits = formatCreditsValue(credits);
    if (userCreditsEl) userCreditsEl.textContent = formattedCredits;
    if (creditCountEl) creditCountEl.textContent = formattedCredits;

    maxCreditsSeen = Math.max(maxCreditsSeen, credits);
    const maxForBar = maxCreditsSeen || credits || 1;
    const percent = Math.max(0, Math.min(100, Math.round((credits / maxForBar) * 100)));
    if (creditBarFillEl) creditBarFillEl.style.width = `${percent}%`;
    if (creditBarEl) {
      creditBarEl.setAttribute("aria-valuenow", String(credits));
      creditBarEl.setAttribute("aria-valuemax", String(maxForBar));
    }

    let state = "success";
    let message = `Saldo disponible: ${formattedCredits} crédito${credits === 1 ? "" : "s"}.`;

    if (credits === 0) {
      state = "danger";
      message = "Sin créditos disponibles. Escríbenos al +57 312 646 1216 para recargar.";
    } else if (credits <= 3) {
      state = "danger";
      message = `Te quedan ${formattedCredits} crédito${credits === 1 ? "" : "s"}. Escríbenos al +57 312 646 1216 para recargar.`;
    } else if (credits <= 8) {
      state = "warning";
      message = `Te quedan ${formattedCredits} créditos. Ve preparando una recarga.`;
    } else if (credits <= 15) {
      state = "success";
      message = `Saldo moderado: ${formattedCredits} créditos disponibles.`;
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
    restoreRememberedEmail();
    resetPasswordToggle();
  }

  function setRememberedEmail(value) {
    if (!storageAvailable) return;
    try {
      if (value) {
        storage.setItem(REMEMBER_KEY, value);
      }
    } catch (err) {
      console.warn("No se pudo recordar el correo", err);
    }
  }

  function clearRememberedEmail() {
    if (!storageAvailable) return;
    try {
      storage.removeItem(REMEMBER_KEY);
    } catch (err) {
      console.warn("No se pudo limpiar el correo recordado", err);
    }
  }

  function restoreRememberedEmail() {
    if (!storageAvailable || !loginEmail) return;
    try {
      const remembered = storage.getItem(REMEMBER_KEY);
      if (remembered) {
        loginEmail.value = remembered;
        if (loginRemember) loginRemember.checked = true;
      } else if (loginRemember) {
        loginRemember.checked = false;
      }
    } catch (err) {
      if (loginRemember) loginRemember.checked = false;
    }
  }

  function resetPasswordToggle() {
    if (loginTogglePassword) {
      loginTogglePassword.textContent = "Mostrar";
      loginTogglePassword.setAttribute("aria-pressed", "false");
      loginTogglePassword.setAttribute("aria-label", "Mostrar contraseña");
    }
    if (loginPassword) {
      loginPassword.type = "password";
    }
  }

  function clearCreditsUI() {
    if (planChip) {
      planChip.style.display = "none";
      planChip.className = "chip";
    }
    if (planNameEl) planNameEl.textContent = "-";
    if (userPlanEl) userPlanEl.textContent = "-";
    if (creditsChip) creditsChip.style.display = "none";
    renderCreditState(null);
    if (logoutBtn) {
      logoutBtn.style.display = "none";
      logoutBtn.disabled = false;
    }
    global.AppCore?.setCreditDependentActionsEnabled(false);
  }

  function showLoginUI(message, state) {
    setSessionLoadingState(false);
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
    setSessionLoadingState(false);
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
    if (creditsChip) creditsChip.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    const safeCredits = Number.isFinite(numericCredits) ? Math.max(0, Math.floor(numericCredits)) : null;
    renderCreditState(safeCredits);
    global.AppCore?.setCreditDependentActionsEnabled((safeCredits || 0) > 0);
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

    if (loginRemember?.checked) {
      setRememberedEmail(email);
    } else {
      clearRememberedEmail();
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

    const currentUi = getCreditsFromUi();
    const next = Math.max(0, currentUi - 1);
    renderCreditState(next);
    global.AppCore?.setCreditDependentActionsEnabled(next > 0);
    return true;
  }

  async function init() {
    global.AppCore?.setCreditDependentActionsEnabled(false);
    loginForm?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);
    restoreRememberedEmail();
    resetPasswordToggle();

    if (!storageAvailable && loginRemember) {
      loginRemember.checked = false;
      loginRemember.disabled = true;
      loginRemember.closest?.(".remember-option")?.classList.add("is-disabled");
    }

    loginEmail?.addEventListener("blur", () => {
      const email = loginEmail.value.trim();
      if (email && loginRemember?.checked) {
        setRememberedEmail(email);
      }
    });

    loginRemember?.addEventListener("change", () => {
      if (!loginRemember.checked) {
        clearRememberedEmail();
        return;
      }
      const email = loginEmail?.value.trim();
      if (email) {
        setRememberedEmail(email);
      }
    });

    loginTogglePassword?.addEventListener("click", () => {
      if (!loginPassword) return;
      const isVisible = loginPassword.type === "text";
      loginPassword.type = isVisible ? "password" : "text";
      const label = isVisible ? "Mostrar contraseña" : "Ocultar contraseña";
      if (loginTogglePassword) {
        loginTogglePassword.textContent = isVisible ? "Mostrar" : "Ocultar";
        loginTogglePassword.setAttribute("aria-pressed", isVisible ? "false" : "true");
        loginTogglePassword.setAttribute("aria-label", label);
      }
      if (!isVisible) {
        try {
          loginPassword.focus({ preventScroll: true });
        } catch (_err) {
          loginPassword.focus();
        }
      }
    });

    setSessionLoadingState(true, "Verificando tu sesión...");

    let session = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error obteniendo la sesión", error);
      }
      session = data?.session || null;
    } catch (err) {
      console.error("No se pudo verificar la sesión actual", err);
    }

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
   
