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
  const REGISTRATION_TABLE = "client_registrations";
  const ADMIN_PANEL_URL = "../Panel%20Admin/index.html";

  const loginScreen = document.getElementById("loginScreen");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginTogglePassword = document.getElementById("loginTogglePassword");
  const loginRemember = document.getElementById("loginRemember");
  const loginBtn = document.getElementById("loginBtn");
  const adminPortalBtn = document.getElementById("adminPanelBtn");
  const adminPortalInlineBtn = document.getElementById("adminPanelBtnInline");
  const adminPortalButtons = [adminPortalBtn, adminPortalInlineBtn].filter(Boolean);
  const loginError = document.getElementById("loginError");
  const loginLoading = document.getElementById("loginLoading");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const registerForm = document.getElementById("registerForm");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");
  const registerUsername = document.getElementById("registerUsername");
  const registerUserEmail = document.getElementById("registerUserEmail");
  const btnBackLogin = document.getElementById("btnBackLogin");
  const btnRegister = document.getElementById("btnRegister");
  const btnRegisterSpinner = btnRegister?.querySelector(".btn-spinner");
  const btnRegisterText = btnRegister?.querySelector(".btn-text");
  const regNameInput = document.getElementById("reg_name");
  const regEmailInput = document.getElementById("reg_email");
  const regPhoneInput = document.getElementById("reg_phone");
  const regPasswordInput = document.getElementById("reg_password");
  const logoutBtn = document.getElementById("logoutBtn");
  const appWrap = document.getElementById("appWrap");
  const planChip = document.getElementById("planChip");
  const planNameEl = document.getElementById("planName");
  const creditsChip = document.getElementById("creditsChip");
  const creditCountEl = document.getElementById("creditCount");
  const userNameEl = document.getElementById("currentUserName");
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
  const accountAdminShortcut = document.getElementById("accountAdminShortcut");

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

  function toggleRegisterLoading(isLoading) {
    if (!btnRegister) return;
    btnRegister.disabled = !!isLoading;
    btnRegister.classList.toggle("loading", !!isLoading);
    if (btnRegisterSpinner) {
      btnRegisterSpinner.style.display = isLoading ? "inline-block" : "none";
    }
    if (btnRegisterText) {
      btnRegisterText.style.opacity = isLoading ? "0.7" : "1";
    }
  }

  function resetRegisterState(clearInputs = false) {
    if (registerError) {
      registerError.textContent = "";
      registerError.style.display = "none";
    }
    if (registerSuccess) registerSuccess.hidden = true;
    if (registerUsername) registerUsername.textContent = "—";
    if (registerUserEmail) registerUserEmail.textContent = "—";
    if (clearInputs) {
      registerForm?.reset();
    }
  }

  function showRegisterError(message) {
    if (!registerError) return;
    registerError.textContent = message || "";
    registerError.style.display = message ? "block" : "none";
  }

  function setAuthMode(mode) {
    const showRegister = mode === "register";
    loginForm?.classList.toggle("is-hidden", showRegister);
    registerForm?.classList.toggle("is-hidden", !showRegister);
    if (showRegister) {
      try {
        regNameInput?.focus({ preventScroll: true });
      } catch (_err) {
        regNameInput?.focus();
      }
    } else {
      try {
        loginEmail?.focus({ preventScroll: true });
      } catch (_err) {
        loginEmail?.focus();
      }
    }
  }

  function generateClientCredentials(name) {
    const normalized = (name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const sanitized = normalized
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/\.\.+/g, ".")
      .replace(/^\.|\.$/g, "")
      .slice(0, 24);
    const randomSuffix = Math.random().toString(36).slice(-4);
    const base = sanitized || `usuario${randomSuffix}`;
    const username = `clien.${base}`;
    const wfEmail = `${username}@wftools.com`;
    return { username, wfEmail };
  }

  function isAdminEmail(email) {
    if (!email) return false;
    const local = String(email).split("@")[0]?.toLowerCase() || "";
    return /^(admin|sup)\./.test(local);
  }

  function toggleAdminButton(button, show) {
    if (!button) return;
    button.hidden = !show;
    button.setAttribute("aria-hidden", show ? "false" : "true");
    button.disabled = !show;
  }

  function syncAdminPortalAccess(email) {
    const show = isAdminEmail(email);
    adminPortalButtons.forEach((button) => toggleAdminButton(button, show));
    if (accountAdminShortcut) {
      accountAdminShortcut.hidden = !show;
      accountAdminShortcut.setAttribute("aria-hidden", show ? "false" : "true");
    }
  }

  function navigateToAdminPanel(event) {
    if (event) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (typeof event.stopPropagation === "function") event.stopPropagation();
    }

    try {
      if (global.self !== global.top && global.parent && typeof global.parent.showFrame === "function") {
        global.parent.showFrame("adminFrame");
        return;
      }
    } catch (_err) {
      /* ignored */
    }

    global.location.href = ADMIN_PANEL_URL;
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
    if (userNameEl) {
      const metadata = user?.user_metadata || {};
      const rawName =
        metadata.full_name ||
        metadata.fullName ||
        metadata.name ||
        metadata.display_name ||
        null;
      if (rawName) {
        userNameEl.textContent = rawName;
      } else if (user?.email) {
        userNameEl.textContent = user.email.split("@")[0] || user.email;
      } else {
        userNameEl.textContent = "-";
      }
    }
    syncAdminPortalAccess(user?.email || null);
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

  function showRegisterSuccess(username, wfEmail) {
    if (registerUsername) registerUsername.textContent = username || "—";
    if (registerUserEmail) registerUserEmail.textContent = wfEmail || "—";
    if (registerSuccess) registerSuccess.hidden = false;
    if (wfEmail && loginEmail) {
      loginEmail.value = wfEmail;
    }
    if (loginRemember && loginRemember.checked && wfEmail) {
      setRememberedEmail(wfEmail);
    }
    showRegisterError("");
    showSessionToast(`Usuario creado: ${wfEmail}`, "success");
  }

  function resetLoginForm() {
    loginForm?.reset();
    showError("");
    showLoading(false);
    toggleLoginButton(false);
    restoreRememberedEmail();
    resetPasswordToggle();
    if (!loginRemember?.checked) {
      syncAdminPortalAccess(null);
    }
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

  async function handleRegisterSubmit(event) {
    event?.preventDefault();
    if (!btnRegister) return;
    resetRegisterState(false);
    const name = regNameInput?.value?.trim() || "";
    const email = regEmailInput?.value?.trim() || "";
    const phone = regPhoneInput?.value?.trim() || "";
    const password = regPasswordInput?.value || "";

    if (!name || !email || !phone || !password) {
      showRegisterError("Completa todos los campos.");
      return;
    }

    if (password.length < 8) {
      showRegisterError("La contraseña debe tener mínimo 8 caracteres.");
      return;
    }

    const { username, wfEmail } = generateClientCredentials(name);
    toggleRegisterLoading(true);

    try {
      const payload = {
        full_name: name,
        personal_email: email,
        phone_number: phone,
        plain_password: password,
        wf_username: username,
        wf_email: wfEmail,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(REGISTRATION_TABLE)
        .insert([payload], { returning: "minimal" });

      if (error) {
        console.error("Error registrando cliente", error);
        showRegisterError(error.message || "No se pudo completar el registro.");
        return;
      }

      registerForm?.reset();
      showRegisterSuccess(username, wfEmail);
    } catch (err) {
      console.error("Fallo general en registro", err);
      showRegisterError("Ocurrió un error registrando tu cuenta.");
    } finally {
      toggleRegisterLoading(false);
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
      syncAdminPortalAccess(loginEmail.value.trim());
    } catch (err) {
      if (loginRemember) loginRemember.checked = false;
      syncAdminPortalAccess(null);
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
    if (userNameEl) userNameEl.textContent = "-";
    if (userPlanEl) userPlanEl.textContent = "-";
    if (creditsChip) creditsChip.style.display = "none";
    renderCreditState(null);
    if (logoutBtn) {
      logoutBtn.style.display = "none";
      logoutBtn.disabled = false;
    }
    global.AppCore?.setCreditDependentActionsEnabled(false);
    syncAdminPortalAccess(null);
  }

  function showLoginUI(message, state) {
    setSessionLoadingState(false);
    if (appWrap) appWrap.style.display = "none";
    if (loginScreen) loginScreen.style.display = "flex";
    setAuthMode("login");
    resetRegisterState(true);
    toggleRegisterLoading(false);
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
    if (userNameEl) {
      const fullName = profile.full_name;
      if (fullName && typeof fullName === "string" && fullName.trim()) {
        userNameEl.textContent = fullName.trim();
      }
    }
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
      .select("plan, credits, full_name")
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
    resetRegisterState(true);
    setAuthMode("login");
    toggleRegisterLoading(false);
    loginForm?.addEventListener("submit", handleLoginSubmit);
    registerForm?.addEventListener("submit", handleRegisterSubmit);
    logoutBtn?.addEventListener("click", handleLogout);
    restoreRememberedEmail();
    resetPasswordToggle();

    showRegisterBtn?.addEventListener("click", () => {
      resetRegisterState(false);
      setAuthMode("register");
    });

    btnBackLogin?.addEventListener("click", () => {
      setAuthMode("login");
      showRegisterError("");
    });

    if (!storageAvailable && loginRemember) {
      loginRemember.checked = false;
      loginRemember.disabled = true;
      loginRemember.closest?.(".remember-option")?.classList.add("is-disabled");
    }

    loginEmail?.addEventListener("input", () => {
      const email = loginEmail.value.trim();
      if (!email && !loginRemember?.checked) {
        syncAdminPortalAccess(null);
        return;
      }
      syncAdminPortalAccess(email);
    });

    loginEmail?.addEventListener("blur", () => {
      const email = loginEmail.value.trim();
      if (email && loginRemember?.checked) {
        setRememberedEmail(email);
      }
    });

    loginRemember?.addEventListener("change", () => {
      if (!loginRemember.checked) {
        clearRememberedEmail();
        if (!loginEmail?.value.trim()) {
          syncAdminPortalAccess(null);
        }
        return;
      }
      const email = loginEmail?.value.trim();
      if (email) {
        setRememberedEmail(email);
        syncAdminPortalAccess(email);
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

    adminPortalButtons.forEach((button) => {
      button.addEventListener("click", navigateToAdminPanel);
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
