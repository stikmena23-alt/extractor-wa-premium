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

  function toggleLoginButton(disabled) {
    if (loginBtn) loginBtn.disabled = !!disabled;
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
    if (creditsChip) creditsChip.style.display = "none";
    if (creditCountEl) creditCountEl.textContent = "0";
    if (logoutBtn) logoutBtn.style.display = "none";
    global.AppCore?.setCreditDependentActionsEnabled(false);
  }

  function showLoginUI() {
    if (appWrap) appWrap.style.display = "none";
    if (loginScreen) loginScreen.style.display = "flex";
    clearCreditsUI();
    resetLoginForm();
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
    if (planChip) {
      const planClass = planName.toLowerCase();
      planChip.className = "chip" + (planClass ? " plan-" + planClass : "");
      planChip.style.display = "inline-block";
    }
    if (typeof profile.credits === "number" && creditCountEl) {
      creditCountEl.textContent = String(profile.credits);
    }
    if (creditsChip) creditsChip.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    global.AppCore?.setCreditDependentActionsEnabled((profile.credits || 0) > 0);
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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);
    toggleLoginButton(false);

    if (error) {
      showError(error.message || "Error de login");
      return;
    }

    showAppUI();
    await updateCredits();
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("No se pudo cerrar sesión");
      return;
    }
    showLoginUI();
  }

  async function spendCredit() {
    const { error } = await supabase.rpc("spend_credit");
    if (error) {
      if ((error.message || "").includes("NO_CREDITS")) {
        alert("Sin créditos");
        global.AppCore?.setCreditDependentActionsEnabled(false);
      } else {
        alert("Error: " + error.message);
      }
      await updateCredits();
      return false;
    }

    if (creditCountEl) {
      const current = parseInt(creditCountEl.textContent || "0", 10) - 1;
      const next = Math.max(0, current);
      creditCountEl.textContent = String(next);
      global.AppCore?.setCreditDependentActionsEnabled(next > 0);
    }
    return true;
  }

  async function init() {
    global.AppCore?.setCreditDependentActionsEnabled(false);
    loginForm?.addEventListener("submit", handleLoginSubmit);
    logoutBtn?.addEventListener("click", handleLogout);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      showAppUI();
      await updateCredits();
    } else {
      showLoginUI();
    }

    supabase.auth.onAuthStateChange(async (_evt, session) => {
      if (session) {
        showAppUI();
        await updateCredits();
      } else {
        showLoginUI();
      }
    });
  }

  global.Auth = {
    init,
    spendCredit,
  };
})(window);
