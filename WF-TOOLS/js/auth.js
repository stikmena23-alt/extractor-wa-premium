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

  const loginScreen = document.getElementById("loginScreen");
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginTogglePassword = document.getElementById("loginTogglePassword");
  const loginRemember = document.getElementById("loginRemember");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const loginLoading = document.getElementById("loginLoading");
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
  const registerForm = document.getElementById("registerForm");
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const btnBackLogin = document.getElementById("btnBackLogin");
  const btnRegister = document.getElementById("btnRegister");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");
  const registerUsernameEl = document.getElementById("registerUsername");
  const registerUserEmailEl = document.getElementById("registerUserEmail");
  const regNameInput = document.getElementById("reg_name");
  const regEmailInput = document.getElementById("reg_email");
  const regPhoneInput = document.getElementById("reg_phone");
  const regPasswordInput = document.getElementById("reg_password");

  let lastCreditsValue = null;
  let maxCreditsSeen = 0;
  let toastTimeout = null;
  let pendingWelcomeEmail = null;
  let currentSessionEmail = null;
  let currentAuthUser = null;
  let currentProfile = null;
  let sessionActive = false;
  let revalidationPromise = null;
  const ADMIN_PREFIXES = ["admin.", "sup."];
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

  updateAdminAccessUI(getRememberedEmail());

  function toggleLoginButton(disabled) {
    if (loginBtn) loginBtn.disabled = !!disabled;
  }

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

  function getRememberedEmail() {
    if (!storageAvailable) return "";
    try {
      return storage.getItem(REMEMBER_KEY) || "";
    } catch (_err) {
      return "";
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
      const remembered = getRememberedEmail();
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
    applyProfileIdentity(null);
    updateAdminAccessUI(currentSessionEmail || loginEmail?.value || getRememberedEmail());
  }

  function showLoginUI(message, state) {
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
  }

  function showAppUI() {
    setSessionLoadingState(false);
    sessionActive = true;
    if (loginScreen) loginScreen.style.display = "none";
    if (appWrap) appWrap.style.display = "block";
    resetLoginForm();
    updateAdminAccessUI(currentSessionEmail);
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

  function computeUsernameSeed(name, email, phone) {
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
      .split(".")
      .filter(Boolean)
      .join(".")
      .slice(0, 28)
      .replace(/\.\.+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    const core = base || "cliente";
    const root = `clien.${core}`.replace(/\.\.+/g, ".").replace(/\.+$/, "");
    const timeSuffix = Date.now().toString(36).slice(-4);
    const randomSuffix = Math.random().toString(36).slice(-4);
    const variants = [root];
    variants.push(`${root}.${timeSuffix}`);
    variants.push(`${root}.${randomSuffix}`);
    return Array.from(new Set(variants)).map((candidate) =>
      candidate.replace(/\.\.+/g, ".").replace(/\.+$/, "").slice(0, 48)
    );
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

  function toggleRegisterInputs(disabled) {
    [regNameInput, regEmailInput, regPhoneInput, regPasswordInput].forEach((input) => {
      if (input) input.disabled = !!disabled;
    });
  }

  function setRegisterLoading(isLoading) {
    if (!btnRegister) return;
    btnRegister.disabled = !!isLoading;
    btnRegister.classList.toggle("loading", !!isLoading);
  }

  function clearRegisterFeedback(options = {}) {
    const { keepSuccess = false } = options;
    if (registerError) {
      registerError.textContent = "";
      registerError.style.display = "none";
    }
    if (!keepSuccess && registerSuccess) {
      registerSuccess.hidden = true;
    }
  }

  function showRegisterError(message) {
    if (!registerError) return;
    registerError.textContent = message || "";
    registerError.style.display = message ? "block" : "none";
    if (message) {
      registerError.focus?.();
    }
  }

  function showRegisterSuccess({ username, email }) {
    if (registerUsernameEl) registerUsernameEl.textContent = username || "-";
    if (registerUserEmailEl) registerUserEmailEl.textContent = email || "-";
    if (registerSuccess) registerSuccess.hidden = false;
  }

  function switchAuthView(view) {
    if (!loginForm || !registerForm) return;
    const showRegister = view === "register";
    loginForm.classList.toggle("is-hidden", showRegister);
    registerForm.classList.toggle("is-hidden", !showRegister);
    if (showRegister) {
      clearRegisterFeedback();
      setRegisterLoading(false);
      toggleRegisterInputs(false);
      try {
        regNameInput?.focus({ preventScroll: true });
      } catch (_err) {
        regNameInput?.focus();
      }
    } else {
      clearRegisterFeedback();
      setRegisterLoading(false);
      toggleRegisterInputs(false);
      registerForm.reset?.();
      try {
        loginEmail?.focus({ preventScroll: true });
      } catch (_err) {
        loginEmail?.focus();
      }
      updateAdminAccessUI(loginEmail?.value || getRememberedEmail());
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

  async function spendCredit() {
    const session = await ensureActiveSession();

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
    getCurrentUserEmail: () => currentSessionEmail,
  };
})(window);
