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
  const FUNCTIONS_BASE = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");
  const CLIENT_ACCOUNT_ENDPOINT = `${FUNCTIONS_BASE}/client-account`;

  const loginModule = global.WFLoginModule?.init?.({ storage: global.localStorage }) || null;
  const loginEls = (loginModule && loginModule.elements) || {};
  const loginScreen = loginEls.screen || document.getElementById("loginScreen");
  const loginForm = loginEls.form || document.getElementById("loginForm");
  const loginEmail = loginEls.email || document.getElementById("loginEmail");
  const loginPassword = loginEls.password || document.getElementById("loginPassword");
  const loginTogglePassword = loginEls.togglePassword || document.getElementById("loginTogglePassword");
  const loginRemember = loginEls.remember || document.getElementById("loginRemember");
  const loginBtn = loginEls.button || document.getElementById("loginBtn");
  const loginError = loginEls.error || document.getElementById("loginError");
  const loginLoading = loginEls.loading || document.getElementById("loginLoading");
  const adminPanelBtn = document.getElementById("adminPanelBtn");
  const adminPanelBtnInline = document.getElementById("adminPanelBtnInline");
  const accountAdminShortcut = document.getElementById("accountAdminShortcut");
  const currentUserNameEl = document.getElementById("currentUserName");
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
  const registerModule = global.WFRegisterModule?.init?.() || null;
  const registerEls = (registerModule && registerModule.elements) || {};
  const registerForm = registerEls.form || document.getElementById("registerForm");
  const showRegisterBtn = registerEls.showButton || document.getElementById("showRegisterBtn");
  const btnBackLogin = registerEls.backButton || document.getElementById("btnBackLogin");
  const btnRegister = registerEls.submitButton || document.getElementById("btnRegister");
  const registerErrorEl = registerEls.error || document.getElementById("registerError");
  const registerSuccessEl = registerEls.success || document.getElementById("registerSuccess");
  const registerUsernameEl = registerEls.username || document.getElementById("registerUsername");
  const registerUserEmailEl = registerEls.userEmail || document.getElementById("registerUserEmail");
  const regNameInput = registerEls.nameInput || document.getElementById("reg_name");
  const regEmailInput = registerEls.emailInput || document.getElementById("reg_email");
  const regPhoneInput = registerEls.phoneInput || document.getElementById("reg_phone");
  const regPasswordInput = registerEls.passwordInput || document.getElementById("reg_password");
  const recoveryForm = document.getElementById("recoveryForm");
  const showRecoveryBtn = document.getElementById("showRecoveryBtn");
  const btnRecoveryBack = document.getElementById("btnRecoveryBack");
  const recoveryEmailInput = document.getElementById("recoveryEmail");
  const recoveryCodeInput = document.getElementById("recoveryCode");
  const recoveryTokenInput = document.getElementById("recoveryToken");
  const recoveryPasswordInput = document.getElementById("recoveryPassword");
  const recoveryPasswordConfirmInput = document.getElementById("recoveryPasswordConfirm");
  const recoveryErrorEl = document.getElementById("recoveryError");
  const recoverySuccessEl = document.getElementById("recoverySuccess");
  const btnRecoverySubmit = document.getElementById("btnRecoverySubmit");
  const recoverySubmitSpinner = btnRecoverySubmit?.querySelector(".btn-spinner");
  const recoverySubmitText = btnRecoverySubmit?.querySelector(".btn-text");

  const storageAvailable = loginModule?.isStorageAvailable?.() ?? false;
  const setRememberedEmail = loginModule?.setRememberedEmail?.bind(loginModule) || (() => {});
  const getRememberedEmail = loginModule?.getRememberedEmail?.bind(loginModule) || (() => "");
  const clearRememberedEmail = loginModule?.clearRememberedEmail?.bind(loginModule) || (() => {});
  const restoreRememberedEmail = loginModule?.restoreRememberedEmail?.bind(loginModule) || (() => {});
  const resetPasswordToggle = loginModule?.resetPasswordToggle?.bind(loginModule) || (() => {
    if (loginTogglePassword) {
      loginTogglePassword.textContent = "Mostrar";
      loginTogglePassword.setAttribute("aria-pressed", "false");
      loginTogglePassword.setAttribute("aria-label", "Mostrar contraseña");
    }
    if (loginPassword) {
      loginPassword.type = "password";
    }
  });
  const toggleLoginButton = loginModule?.toggleButton?.bind(loginModule) || ((disabled) => {
    if (loginBtn) loginBtn.disabled = !!disabled;
  });
  const showLoading = loginModule?.showLoading?.bind(loginModule) || ((show) => {
    if (loginLoading) loginLoading.style.display = show ? "block" : "none";
  });
  const showError = loginModule?.showError?.bind(loginModule) || ((message) => {
    if (!loginError) return;
    const text = message || "";
    loginError.textContent = text;
    loginError.style.display = text ? "block" : "none";
  });
  const resetLoginForm = loginModule?.resetForm?.bind(loginModule) || (() => {
    loginForm?.reset?.();
    showError("");
    showLoading(false);
    toggleLoginButton(false);
    restoreRememberedEmail();
    resetPasswordToggle();
  });
  const clearRegisterFeedback = registerModule?.clearFeedback?.bind(registerModule) || ((options = {}) => {
    const { keepSuccess = false } = options;
    if (registerErrorEl) {
      registerErrorEl.textContent = "";
      registerErrorEl.style.display = "none";
    }
    if (!keepSuccess && registerSuccessEl) {
      registerSuccessEl.hidden = true;
    }
  });
  const showRegisterError = registerModule?.showError?.bind(registerModule) || ((message) => {
    if (!registerErrorEl) return;
    const text = message || "";
    registerErrorEl.textContent = text;
    registerErrorEl.style.display = text ? "block" : "none";
    if (text) {
      registerErrorEl.focus?.();
    }
  });
  const setRegisterLoading = registerModule?.setLoading?.bind(registerModule) || ((isLoading) => {
    if (btnRegister) {
      btnRegister.disabled = !!isLoading;
      btnRegister.classList.toggle("loading", !!isLoading);
    }
  });
  const toggleRegisterInputs = registerModule?.toggleInputs?.bind(registerModule) || ((disabled) => {
    [regNameInput, regEmailInput, regPhoneInput, regPasswordInput].forEach((input) => {
      if (input) input.disabled = !!disabled;
    });
  });
  const showRegisterSuccess = registerModule?.showSuccess?.bind(registerModule) || ((payload = {}) => {
    if (registerUsernameEl) registerUsernameEl.textContent = payload.username || "-";
    if (registerUserEmailEl) registerUserEmailEl.textContent = payload.email || "-";
    if (registerSuccessEl) registerSuccessEl.hidden = false;
  });

  let lastCreditsValue = null;
  let maxCreditsSeen = 0;
  let toastTimeout = null;
  let pendingWelcomeEmail = null;
  let currentSessionEmail = null;
  let currentAuthUser = null;
  let currentProfile = null;
  let sessionActive = false;
  let revalidationPromise = null;
  let lastBroadcastedCredits = null;
  let sessionHeartbeatTimer = null;
  const SESSION_HEARTBEAT_MS = 60_000;
  const ADMIN_PREFIXES = ["admin.", "sup."];
  const creditFormatter = new Intl.NumberFormat("es-CO");

  updateAdminAccessUI(getRememberedEmail());

  function toggleLogoutButton(disabled) {
    if (logoutBtn) logoutBtn.disabled = !!disabled;
  }

  function setElementVisibility(element, visible) {
    if (!element) return;
    if (visible) {
      element.hidden = false;
      element.setAttribute("aria-hidden", "false");
    } else {
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
    }
  }

  function isPrivilegedEmail(email) {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;
    return ADMIN_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  function deriveNameFromEmail(email) {
    if (!email) return "-";
    const local = email.split("@")[0] || "";
    const cleaned = local
      .replace(/[._]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return email;
    return cleaned.replace(/\b([a-z])/g, (match, letter) => letter.toUpperCase());
  }

  function updateAdminAccessUI(candidateEmail) {
    const normalized = (candidateEmail || "").trim().toLowerCase();
    const canAccessAdmin = isPrivilegedEmail(normalized);
    setElementVisibility(adminPanelBtn, canAccessAdmin);

    const sessionOnlyVisible = sessionActive && canAccessAdmin;
    setElementVisibility(accountAdminShortcut, sessionOnlyVisible);
    setElementVisibility(adminPanelBtnInline, sessionOnlyVisible);
  }

  function setUserDisplayName(name) {
    if (!currentUserNameEl) return;
    const text = (name || "").toString().trim();
    currentUserNameEl.textContent = text ? text : "-";
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

  function stopSessionHeartbeat() {
    if (sessionHeartbeatTimer) {
      clearInterval(sessionHeartbeatTimer);
      sessionHeartbeatTimer = null;
    }
  }

  function startSessionHeartbeat() {
    stopSessionHeartbeat();
    sessionHeartbeatTimer = setInterval(() => {
      if (!sessionActive) return;
      try {
        const pending = revalidateSessionState();
        if (pending && typeof pending.catch === "function") {
          pending.catch((err) => {
            console.warn("No se pudo revalidar la sesión en el latido", err);
          });
        }
      } catch (err) {
        console.warn("No se pudo ejecutar el latido de sesión", err);
      }
    }, SESSION_HEARTBEAT_MS);
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
    currentAuthUser = user || null;
    currentSessionEmail = user?.email ? user.email.trim().toLowerCase() : null;
    if (userEmailEl) userEmailEl.textContent = user?.email || "-";

    if (!user) {
      setUserDisplayName(null);
    } else if (!currentProfile) {
      const metaName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.display_name ||
        null;
      if (metaName) {
        setUserDisplayName(metaName);
      } else if (currentSessionEmail) {
        setUserDisplayName(deriveNameFromEmail(currentSessionEmail));
      }
    }

    const candidateEmail = sessionActive
      ? currentSessionEmail
      : currentSessionEmail || loginEmail?.value || getRememberedEmail();
    updateAdminAccessUI(candidateEmail);
  }

  function resolveDisplayName(profileOverride) {
    const profileSource = profileOverride || currentProfile || {};
    let displayName =
      profileSource.full_name ||
      profileSource.display_name ||
      profileSource.name ||
      profileSource.owner_name ||
      profileSource.contact_name ||
      null;
    if (!displayName && currentAuthUser) {
      displayName =
        currentAuthUser.user_metadata?.full_name ||
        currentAuthUser.user_metadata?.name ||
        currentAuthUser.user_metadata?.display_name ||
        null;
    }
    if (!displayName && currentSessionEmail) {
      displayName = deriveNameFromEmail(currentSessionEmail);
    }
    return (displayName || "-").toString().trim();
  }

  function broadcastUserInfo({ profileOverride = null, creditsOverride, planOverride, force = false } = {}) {
    if (typeof window === "undefined" || !window.parent || window.parent === window) return;
    const email = currentSessionEmail || currentAuthUser?.email || "-";
    const planName = (planOverride || profileOverride?.plan || currentProfile?.plan || planNameEl?.textContent || "-")
      .toString()
      .trim();
    let creditsValue = creditsOverride;
    if (creditsValue == null) {
      if (Number.isFinite(lastCreditsValue)) {
        creditsValue = lastCreditsValue;
      } else {
        creditsValue = getCreditsFromUi();
      }
    }
    let numericCredits = Number(creditsValue);
    let creditsToSend = creditsValue;
    if (Number.isFinite(numericCredits)) {
      numericCredits = Math.max(0, Math.floor(numericCredits));
      creditsToSend = numericCredits;
    } else {
      numericCredits = null;
      creditsToSend = "-";
    }
    if (!force && numericCredits !== null && lastBroadcastedCredits !== null && numericCredits === lastBroadcastedCredits) {
      return;
    }
    const payload = {
      type: "wftools-user-info",
      name: resolveDisplayName(profileOverride),
      email: (email || "-").toString().trim() || "-",
      plan: planName || "-",
      credits: creditsToSend,
      isAdmin: isPrivilegedEmail(email),
    };
    try {
      window.parent.postMessage(payload, "*");
      lastBroadcastedCredits = numericCredits;
    } catch (err) {
      console.warn("No se pudo notificar al contenedor principal", err);
    }
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
      lastBroadcastedCredits = null;
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
      message = "Sin créditos disponibles. Pulsa el botón en la esquina inferior izquierda para recargar.";
    } else if (credits <= 3) {
      state = "danger";
      message = `Te quedan ${formattedCredits} crédito${credits === 1 ? "" : "s"}. Pulsa el botón en la esquina inferior izquierda para recargar.`;
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
    broadcastUserInfo({ creditsOverride: credits });
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
    lastBroadcastedCredits = null;
    if (logoutBtn) {
      logoutBtn.style.display = "none";
      logoutBtn.disabled = false;
    }
    global.AppCore?.setCreditDependentActionsEnabled(false);
    applyProfileIdentity(null);
    updateAdminAccessUI(currentSessionEmail || loginEmail?.value || getRememberedEmail());
  }

  function showLoginUI(message, state) {
    stopSessionHeartbeat();
    setSessionLoadingState(false);
    sessionActive = false;
    if (appWrap) appWrap.style.display = "none";
    if (loginScreen) loginScreen.style.display = "flex";
    clearCreditsUI();
    resetLoginForm();
    updateUserIdentity(null);
    closeSessionModal();
    pendingWelcomeEmail = null;
    updateAdminAccessUI(loginEmail?.value || getRememberedEmail());
    if (message) {
      setSessionStatusMessage(message, state);
    } else {
      setSessionStatusMessage("Inicia sesión para ver tu plan y tus créditos en tiempo real.");
    }
    // Notify parent frame that the user has logged out so the menu can be hidden.  The parent
    // handler will ignore this message if there is no parent or if it does not care about it.
    try {
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "wftools-logout" }, "*");
      }
    } catch (_err) {
      /* noop */
    }
  }

  function showAppUI() {
    setSessionLoadingState(false);
    sessionActive = true;
    startSessionHeartbeat();
    if (loginScreen) loginScreen.style.display = "none";
    if (appWrap) appWrap.style.display = "block";
    resetLoginForm();
    updateAdminAccessUI(currentSessionEmail);
    // Notify the parent frame that the user has successfully logged in.  This allows the
    // union index page to reveal the floating menu once a session is active.  We guard
    // against cross‑origin errors by wrapping in a try/catch.
    try {
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "wftools-login" }, "*");
      }
    } catch (_err) {
      /* noop */
    }
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
    applyProfileIdentity(profile);
    updateAdminAccessUI(currentSessionEmail);
    broadcastUserInfo({ profileOverride: profile, creditsOverride: safeCredits, planOverride: planName, force: true });
  }

  function applyProfileIdentity(profile) {
    currentProfile = profile || null;
    if (profile) {
      const profileName =
        profile.full_name ||
        profile.display_name ||
        profile.name ||
        profile.owner_name ||
        profile.contact_name ||
        null;
      if (profileName) {
        setUserDisplayName(profileName);
        return;
      }
    }

    if (currentAuthUser) {
      const metaName =
        currentAuthUser.user_metadata?.full_name ||
        currentAuthUser.user_metadata?.name ||
        currentAuthUser.user_metadata?.display_name ||
        null;
      if (metaName) {
        setUserDisplayName(metaName);
        return;
      }
    }

    if (currentSessionEmail) {
      setUserDisplayName(deriveNameFromEmail(currentSessionEmail));
    } else {
      setUserDisplayName(null);
    }
  }

  async function ensureActiveSession() {
    let cachedSession = null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error obteniendo la sesión", error);
      }
      if (data?.session) {
        cachedSession = data.session;
        const expiresAt = cachedSession.expires_at
          ? cachedSession.expires_at * 1000
          : 0;
        if (!expiresAt || expiresAt - Date.now() > 60_000) {
          return cachedSession;
        }
      }
    } catch (err) {
      console.error("No se pudo verificar la sesión actual", err);
    }

    const refreshToken = cachedSession?.refresh_token || null;
    if (!refreshToken) {
      return null;
    }

    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (error) {
        if (error.message && !/refresh token/i.test(error.message)) {
          console.warn("No se pudo refrescar la sesión", error);
        }
        return null;
      }
      return data?.session || null;
    } catch (err) {
      console.error("No se pudo refrescar la sesión", err);
      return null;
    }
  }

  async function revalidateSessionState() {
    if (revalidationPromise) return revalidationPromise;
    revalidationPromise = (async () => {
      const session = await ensureActiveSession();
      if (session) {
        updateUserIdentity(session.user || null);
        if (sessionActive) {
          await updateCredits();
          const email = session.user?.email || currentSessionEmail || "tu cuenta";
          setSessionStatusMessage(activeSessionMessage(email), "active");
        }
      }
      revalidationPromise = null;
      return session;
    })();
    return revalidationPromise;
  }

  function slugifyClientName(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/\.\.+/g, ".")
      .replace(/^\.+|\.+$/g, "");
  }

  function sanitizeNameTokens(value) {
    return (value || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z\s]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  const SURNAME_VOWELS = new Set(["a", "e", "i", "o", "u"]);

  function buildSurnameSignature(words, desiredLength = 2) {
    if (!Array.isArray(words) || !words.length || desiredLength <= 0) return "";

    const primary = [];
    const extras = [];

    words.forEach((rawWord) => {
      const letters = rawWord.toLowerCase().replace(/[^a-z]/g, "").split("");
      if (!letters.length) return;
      const firstConsonantIndex = letters.findIndex((letter) => !SURNAME_VOWELS.has(letter));
      if (firstConsonantIndex >= 0) {
        primary.push(letters[firstConsonantIndex]);
        letters.splice(firstConsonantIndex, 1);
      } else {
        primary.push(letters.shift());
      }

      const remainingConsonants = letters.filter((letter) => !SURNAME_VOWELS.has(letter));
      const remainingVowels = letters.filter((letter) => SURNAME_VOWELS.has(letter));
      extras.push(...remainingConsonants, ...remainingVowels);
    });

    const combined = [...primary, ...extras];
    return combined.join("").slice(0, desiredLength);
  }

  function buildPreferredUsernameFromName(name) {
    const tokens = sanitizeNameTokens(name);
    if (!tokens.length) return "";

    const firstName = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
    const surnameTokens = tokens.length > 2 ? tokens.slice(-2) : tokens.slice(1);
    const normalizedSurnames = surnameTokens
      .map((word) => word.toLowerCase().replace(/[^a-z]/g, ""))
      .filter(Boolean);

    const suffix = buildSurnameSignature(normalizedSurnames, 2);
    const base = `${firstName}${suffix}`.replace(/[^a-z0-9]/g, "");

    if (base) {
      return base.slice(0, 18);
    }
    return "";
  }

  function computeUsernameSeed(name, email, phone) {
    const preferred = buildPreferredUsernameFromName(name);
    if (preferred) return preferred;

    const fallbackEmail = (email || "").split("@")[0] || "";
    const fallbackPhone = (phone || "").replace(/\D+/g, "");
    return (
      slugifyClientName(name) ||
      slugifyClientName(fallbackEmail) ||
      (fallbackPhone ? fallbackPhone.slice(-8) : "") ||
      Date.now().toString(36)
    );
  }

  function buildUsernameCandidates(seed) {
    const base = (seed || "cliente")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 18);
    const core = base || "cliente";
    const timeSuffix = Date.now().toString(36).slice(-4);
    const randomSuffix = Math.random().toString(36).slice(-4);
    const variants = [core];
    variants.push(`${core}${timeSuffix}`);
    variants.push(`${core}${randomSuffix}`);
    return Array.from(new Set(variants)).map((candidate) => candidate.slice(0, 24));
  }

  function isDuplicateUserError(error) {
    if (!error) return false;
    const code = (error.code || "").toLowerCase();
    if (code === "user_already_exists" || code === "email_conflict") return true;
    const message = (error.message || "").toLowerCase();
    return (
      message.includes("already registered") ||
      message.includes("already exists") ||
      message.includes("ya existe")
    );
  }

  async function callClientAccountEndpoint(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(CLIENT_ACCOUNT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data?.error?.message ||
          data?.error?.msg ||
          data?.error ||
          response.statusText ||
          "No se pudo crear la cuenta";
        const error = new Error(message);
        if (data?.error?.code) error.code = data.error.code;
        throw error;
      }
      return data?.data ?? null;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("La solicitud tardó demasiado, inténtalo de nuevo.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function persistProfileExtras(userId, payload) {
    if (!userId) return;
    const phoneClean = (payload.phone || "").replace(/\D+/g, "");
    const profileData = {
      id: userId,
      full_name: payload.name || null,
      display_name: payload.name || null,
      contact_email: payload.personalEmail || null,
      phone_number: phoneClean || null,
    };
    const sanitized = Object.fromEntries(
      Object.entries(profileData).filter(([, value]) => value !== null && value !== "")
    );
    if (Object.keys(sanitized).length <= 1) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(sanitized, { onConflict: "id" });
      if (error) {
        console.warn("No se pudo sincronizar el perfil del nuevo usuario", error);
      }
    } catch (err) {
      console.warn("No se pudo actualizar la información adicional del perfil", err);
    }
  }

  async function createClientAccount({ name, personalEmail, phone, password }) {
    const seed = computeUsernameSeed(name, personalEmail, phone);
    const candidates = buildUsernameCandidates(seed);
    let lastError = null;
    for (const username of candidates) {
      const wfUsername = `client.${username}`;
      const wfEmail = `${wfUsername}@wftools.com`;
      try {
        const result = await callClientAccountEndpoint({
          email: wfEmail,
          password,
          full_name: name,
          contact_email: personalEmail,
          phone,
          metadata: {
            full_name: name,
            contact_email: personalEmail,
            phone,
            phone_number: phone,
            personal_email: personalEmail,
          },
        });
        const action = (result?.action || "").toLowerCase();
        if (action === "updated") {
          const duplicateError = new Error("El usuario ya existe");
          duplicateError.code = "user_already_exists";
          lastError = duplicateError;
          continue;
        }
        const createdUser = result?.user || null;
        await persistProfileExtras(createdUser?.id, {
          name,
          personalEmail,
          phone,
          generatedEmail: wfEmail,
        });
        return {
          user: createdUser,
          username: wfUsername,
          email: wfEmail,
        };
      } catch (error) {
        if (isDuplicateUserError(error)) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error("No se pudo generar un usuario único.");
  }

  function switchAuthView(view) {
    if (!loginForm) return;

    const showRegister = view === "register";
    const showRecovery = view === "recovery";

    if (recoveryForm) {
      recoveryForm.classList.toggle("is-hidden", !showRecovery);
    }

    if (showRecovery) {
      loginForm.classList.add("is-hidden");
      registerForm?.classList.add("is-hidden");
      prepareRecoveryView();
      return;
    }

    if (registerModule && typeof registerModule.switchView === "function") {
      registerModule.switchView(view, {
        loginForm,
        loginEmail,
        onShowLogin: () => updateAdminAccessUI(loginEmail?.value || getRememberedEmail()),
      });
      if (view === "login") {
        resetRecoveryState();
      }
      return;
    }

    if (registerForm) {
      registerForm.classList.toggle("is-hidden", !showRegister);
    }
    loginForm.classList.toggle("is-hidden", showRegister);

    if (showRegister) {
      clearRegisterFeedback();
      setRegisterLoading(false);
      toggleRegisterInputs(false);
      try {
        regNameInput?.focus({ preventScroll: true });
      } catch (_err) {
        regNameInput?.focus?.();
      }
      return;
    }

    clearRegisterFeedback();
    setRegisterLoading(false);
    toggleRegisterInputs(false);
    registerForm?.reset?.();
    resetRecoveryState();
    updateAdminAccessUI(loginEmail?.value || getRememberedEmail());
    try {
      loginEmail?.focus({ preventScroll: true });
    } catch (_err) {
      loginEmail?.focus?.();
    }
  }

  function resetRecoveryFeedback() {
    if (recoveryErrorEl) {
      recoveryErrorEl.textContent = "";
      recoveryErrorEl.style.display = "none";
    }
    if (recoverySuccessEl) {
      recoverySuccessEl.textContent = "";
      recoverySuccessEl.hidden = true;
      recoverySuccessEl.classList.remove("is-visible");
    }
  }

  function showRecoveryError(message) {
    if (!recoveryErrorEl) return;
    const text = message || "";
    recoveryErrorEl.textContent = text;
    recoveryErrorEl.style.display = text ? "block" : "none";
  }

  function showRecoverySuccess(message) {
    if (!recoverySuccessEl) return;
    const text = message || "";
    recoverySuccessEl.textContent = text;
    const visible = !!text;
    recoverySuccessEl.hidden = !visible;
    recoverySuccessEl.classList.toggle("is-visible", visible);
  }

  function toggleRecoveryInputs(disabled) {
    [
      recoveryEmailInput,
      recoveryCodeInput,
      recoveryTokenInput,
      recoveryPasswordInput,
      recoveryPasswordConfirmInput,
    ].forEach((input) => {
      if (input) input.disabled = !!disabled;
    });
  }

  function setRecoveryLoading(isLoading) {
    if (btnRecoverySubmit) btnRecoverySubmit.disabled = !!isLoading;
    btnRecoverySubmit?.classList.toggle("loading", !!isLoading);
    if (recoverySubmitSpinner) {
      recoverySubmitSpinner.style.display = isLoading ? "inline-block" : "none";
    }
    if (recoverySubmitText) {
      recoverySubmitText.style.opacity = isLoading ? "0.65" : "1";
    }
    toggleRecoveryInputs(isLoading);
  }

  function resetRecoveryState({ preserveEmail = false } = {}) {
    if (!recoveryForm) return;
    const emailValue = preserveEmail ? recoveryEmailInput?.value || "" : "";
    recoveryForm.reset?.();
    if (preserveEmail && recoveryEmailInput) {
      recoveryEmailInput.value = emailValue;
    }
    setRecoveryLoading(false);
    resetRecoveryFeedback();
  }

  function extractRecoveryToken(rawValue) {
    if (!rawValue) return "";
    const value = rawValue.trim();
    if (!value) return "";
    try {
      const url = new URL(value);
      const tokenParam = url.searchParams.get("token");
      if (tokenParam) return tokenParam.trim();
    } catch (_err) {
      // Ignorar: no es una URL completa
    }
    const match = value.match(/token=([^&]+)/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch (_err) {
        return match[1].trim();
      }
    }
    return value;
  }

  function prepareRecoveryView() {
    const remembered = loginEmail?.value?.trim() || getRememberedEmail();
    resetRecoveryState({ preserveEmail: false });
    if (remembered && recoveryEmailInput) {
      recoveryEmailInput.value = remembered;
    }
    const focusTarget = remembered ? recoveryCodeInput || recoveryTokenInput : recoveryEmailInput;
    try {
      focusTarget?.focus?.({ preventScroll: true });
    } catch (_err) {
      focusTarget?.focus?.();
    }
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault();
    resetRecoveryFeedback();

    const email = recoveryEmailInput?.value.trim() || "";
    const codeInput = recoveryCodeInput?.value.trim() || "";
    const linkInput = recoveryTokenInput?.value.trim() || "";
    const password = recoveryPasswordInput?.value || "";
    const confirmPassword = recoveryPasswordConfirmInput?.value || "";

    if (!password || password.length < 12) {
      showRecoveryError("La contraseña debe tener al menos 12 caracteres.");
      try {
        recoveryPasswordInput?.focus?.({ preventScroll: true });
      } catch (_err) {
        recoveryPasswordInput?.focus?.();
      }
      return;
    }

    if (password !== confirmPassword) {
      showRecoveryError("Las contraseñas no coinciden.");
      try {
        recoveryPasswordConfirmInput?.focus?.({ preventScroll: true });
      } catch (_err) {
        recoveryPasswordConfirmInput?.focus?.();
      }
      return;
    }

    const code = codeInput ? codeInput.replace(/\s+/g, "").toUpperCase() : "";
    const token = extractRecoveryToken(linkInput);

    if (!code && !token) {
      showRecoveryError("Ingresa el código corto o el enlace de recuperación.");
      try {
        (recoveryCodeInput || recoveryTokenInput)?.focus?.({ preventScroll: true });
      } catch (_err) {
        (recoveryCodeInput || recoveryTokenInput)?.focus?.();
      }
      return;
    }

    const payload = { password };
    if (code) payload.code = code;
    if (token) payload.token = token;
    if (email) payload.email = email;

    setRecoveryLoading(true);
    try {
      const response = await fetch(`${FUNCTIONS_BASE}/admin-complete-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data?.message ||
          data?.error ||
          "No se pudo actualizar la contraseña. Verifica el código o enlace.";
        showRecoveryError(message);
        return;
      }

      showRecoverySuccess("Contraseña actualizada. Ya puedes iniciar sesión.");
      if (email && loginEmail) {
        loginEmail.value = email;
        updateAdminAccessUI(email);
      }

      setTimeout(() => {
        switchAuthView("login");
        showSessionToast("Contraseña actualizada con éxito.", "success");
        try {
          loginPassword?.focus?.({ preventScroll: true });
        } catch (_err) {
          loginPassword?.focus?.();
        }
      }, 1600);
    } catch (error) {
      console.error("Error completando recuperación", error);
      showRecoveryError("No se pudo conectar con el servicio. Intenta nuevamente.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  const PROFILE_BASE_COLUMNS = "id, plan, credits";
  let profileSelectColumns = `*, ${PROFILE_BASE_COLUMNS}`;
  let profileSelectMode = "full";

  function isMissingColumnError(error) {
    if (!error) return false;
    const message = (error.message || "").toLowerCase();
    if (error.code && String(error.code) === "42703") return true;
    return /column .* does not exist/.test(message);
  }

  async function fetchProfile(userId, { requireMatch } = { requireMatch: true }) {
    let query = supabase.from("profiles").select(profileSelectColumns);
    if (userId && requireMatch) {
      query = query.eq("id", userId);
    }
    query = query.limit(1);
    const executor =
      typeof query.maybeSingle === "function" ? query.maybeSingle : query.single;
    const response = await executor.call(query);
    if (
      response.error &&
      isMissingColumnError(response.error) &&
      profileSelectMode === "full"
    ) {
      profileSelectMode = "base";
      profileSelectColumns = PROFILE_BASE_COLUMNS;
      return fetchProfile(userId, { requireMatch });
    }
    return response;
  }

  async function updateCredits() {
    const userId = currentAuthUser?.id;
    if (!userId) {
      applyProfileIdentity(null);
      updateAdminAccessUI(currentSessionEmail);
      renderCreditState(null);
      return;
    }

    let response = await fetchProfile(userId, {
      requireMatch: true,
    });

    if (!response.error && (!response.data || response.data.id !== userId)) {
      response = await fetchProfile(userId, {
        requireMatch: false,
      });
    }

    const { data, error } = response;

    if (error) {
      console.error("Perfil", error);
      applyProfileIdentity(null);
      updateAdminAccessUI(currentSessionEmail);
      renderCreditState(null);
      return;
    }

    if (data) {
      applyCredits(data);
    } else {
      applyProfileIdentity(null);
      updateAdminAccessUI(currentSessionEmail);
      renderCreditState(null);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    clearRegisterFeedback();

    const name = regNameInput?.value.trim();
    const personalEmail = regEmailInput?.value.trim();
    const rawPhone = regPhoneInput?.value || "";
    const password = regPasswordInput?.value || "";
    const numericPhone = rawPhone.replace(/\D+/g, "");

    if (!name || name.length < 3) {
      showRegisterError("Ingresa tu nombre completo.");
      return;
    }
    if (!personalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      showRegisterError("Ingresa un correo electrónico válido.");
      return;
    }
    if (!numericPhone || numericPhone.length < 7) {
      showRegisterError("Ingresa un número de teléfono válido.");
      return;
    }
    if (!password || password.length < 8) {
      showRegisterError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setRegisterLoading(true);
    toggleRegisterInputs(true);

    try {
      const result = await createClientAccount({
        name,
        personalEmail,
        phone: numericPhone,
        password,
      });
      registerForm?.reset();
      showRegisterSuccess(result);
      showSessionToast("Cuenta creada exitosamente. Usa el usuario generado para iniciar sesión.", "success");
      if (loginEmail) {
        loginEmail.value = result.email;
      }
      updateAdminAccessUI(result.email);
    } catch (error) {
      console.error("No se pudo registrar el usuario", error);
      let message = error?.message || "No se pudo completar el registro. Intenta nuevamente.";
      if (isDuplicateUserError(error)) {
        message = "No se pudo generar un usuario único. Intenta nuevamente.";
      }
      showRegisterError(message);
      showSessionToast(message, "danger");
    } finally {
      setRegisterLoading(false);
      toggleRegisterInputs(false);
    }
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
    try {
      const helper = global.WFSessionHelper;
      let hasSession = false;
      if (helper && typeof helper.hasActiveSession === "function") {
        hasSession = await helper.hasActiveSession(supabase);
      } else {
        const { data } = await supabase.auth.getSession();
        hasSession = !!data?.session;
      }

      if (!hasSession) {
        showSessionToast("No hay una sesión activa para cerrar.", "info");
        showLoginUI();
        return;
      }

      let ok = false;
      if (helper && typeof helper.logout === "function") {
        const res = await helper.logout(supabase);
        ok = !!res?.ok && !res.error;
        if (res && res.error) {
          console.error("Fallo cerrando sesión", res.error);
        }
      } else {
        const { error } = await supabase.auth.signOut();
        ok = !error;
        if (error) {
          console.error("Fallo cerrando sesión", error);
        }
      }

      if (!ok) {
        showSessionToast("No se pudo cerrar sesión. Intenta nuevamente.", "danger");
        return;
      }

      showSessionToast("Sesión cerrada correctamente.", "success");
      showLoginUI("Sesión cerrada correctamente.", "closed");
    } catch (error) {
      console.error("Error inesperado al cerrar sesión", error);
      showSessionToast("No se pudo cerrar sesión. Intenta nuevamente.", "danger");
    } finally {
      toggleLogoutButton(false);
    }
  }

  async function performSpendCredit() {
    try {
      const session = await ensureActiveSession();

      if (!session) {
        showSessionToast("Tu sesión expiró. Inicia sesión para continuar.", "danger");
        showLoginUI("Tu sesión expiró. Inicia sesión para continuar.", "closed");
        return false;
      }

      const { error } = await supabase.rpc("spend_credit");
      if (error) {
        if ((error.message || "").includes("NO_CREDITS")) {
          showSessionToast("Sin créditos disponibles. Pulsa el botón en la esquina inferior izquierda para recargar.", "danger");
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
    } catch (err) {
      console.error("Error inesperado al consumir créditos", err);
      showSessionToast("No se pudo consumir un crédito. Intenta nuevamente.", "danger");
      await updateCredits();
      return false;
    }
  }

  let spendCreditChain = Promise.resolve();

  function spendCredit() {
    const next = spendCreditChain.then(() => performSpendCredit());
    spendCreditChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function init() {
    global.AppCore?.setCreditDependentActionsEnabled(false);
    loginForm?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);
    registerForm?.addEventListener("submit", handleRegisterSubmit);
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

    loginEmail?.addEventListener("input", () => {
      if (!sessionActive) {
        updateAdminAccessUI(loginEmail.value);
      }
    });

    showRegisterBtn?.addEventListener("click", () => switchAuthView("register"));
    btnBackLogin?.addEventListener("click", () => switchAuthView("login"));
    showRecoveryBtn?.addEventListener("click", () => switchAuthView("recovery"));
    btnRecoveryBack?.addEventListener("click", () => {
      switchAuthView("login");
      try {
        loginEmail?.focus?.({ preventScroll: true });
      } catch (_err) {
        loginEmail?.focus?.();
      }
    });
    recoveryForm?.addEventListener("submit", handleRecoverySubmit);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        revalidateSessionState();
      }
    };
    window.addEventListener("focus", () => {
      revalidateSessionState();
    });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", () => {
      showSessionToast("Conexión restaurada.", "success");
    });
    window.addEventListener("offline", () => {
      showSessionToast("Sin conexión a internet. Algunas funciones estarán limitadas.", "danger");
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

    const session = await ensureActiveSession();

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
    ensureActiveSession,
    revalidateSessionState,
    forceLoginView: (message) => {
      const text = message || "Tu sesión expiró. Inicia sesión para continuar.";
      showLoginUI(text, "closed");
      try {
        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "wftools-open-login" }, "*");
        }
      } catch (_err) {
        /* noop */
      }
    },
    getCurrentUserEmail: () => currentSessionEmail,
  };

  function sendBridgeResponse(type, requestId, payload){
    if (!requestId) return;
    try {
      window.parent?.postMessage(Object.assign({ type, requestId }, payload), '*');
    } catch (err) {
      console.warn('No se pudo enviar la respuesta al contenedor principal', err);
    }
  }

  window.addEventListener('message', (event)=>{
    if (!event.data || typeof event.data !== 'object') return;
    const { type } = event.data;
    if (type === 'wftools-internal-spend-credits') {
      const requestId = event.data.requestId;
      const amount = Number.parseInt(event.data.amount, 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        sendBridgeResponse('wftools-internal-spend-result', requestId, { ok:false, reason:'invalid-amount' });
        return;
      }
      (async () => {
        if (!global.Auth || typeof global.Auth.spendCredit !== 'function') {
          sendBridgeResponse('wftools-internal-spend-result', requestId, { ok:false, reason:'unavailable' });
          return;
        }
        let ok = true;
        for (let i = 0; i < amount; i += 1) {
          try {
            const result = await global.Auth.spendCredit();
            if (!result) {
              ok = false;
              break;
            }
          } catch (err) {
            console.error('Error al consumir créditos desde el puente', err);
            ok = false;
            break;
          }
        }
        const refresh = typeof global.Auth.revalidateSessionState === 'function'
          ? global.Auth.revalidateSessionState()
          : null;
        if (refresh && typeof refresh.then === 'function') {
          try {
            await refresh;
          } catch (err) {
            console.warn('No se pudo revalidar la sesión tras consumir créditos', err);
          }
        }
        sendBridgeResponse('wftools-internal-spend-result', requestId, {
          ok,
          reason: ok ? null : 'denied',
        });
      })();
    } else if (type === 'wftools-internal-logout-request') {
      const requestId = event.data.requestId;
      (async () => {
        let ok = false;
        try {
          if (typeof handleLogout === 'function') {
            await handleLogout();
            ok = true;
          } else if (logoutBtn && typeof logoutBtn.click === 'function') {
            logoutBtn.click();
            ok = true;
          }
        } catch (err) {
          console.error('Error al cerrar sesión desde el puente', err);
        }
        if (!ok && logoutBtn && typeof logoutBtn.click === 'function') {
          try {
            logoutBtn.click();
            ok = true;
          } catch (err) {
            console.warn('No se pudo disparar el cierre de sesión automáticamente', err);
          }
        }
        sendBridgeResponse('wftools-internal-logout-result', requestId, {
          ok,
          reason: ok ? null : 'unavailable',
        });
      })();
    }
  });
})(window);
