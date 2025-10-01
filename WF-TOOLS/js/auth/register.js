(function (global) {
  const module = {};
  const elements = {};

  function cacheElements() {
    elements.form = document.getElementById('registerForm');
    elements.showButton = document.getElementById('showRegisterBtn');
    elements.backButton = document.getElementById('btnBackLogin');
    elements.submitButton = document.getElementById('btnRegister');
    elements.error = document.getElementById('registerError');
    elements.success = document.getElementById('registerSuccess');
    elements.username = document.getElementById('registerUsername');
    elements.userEmail = document.getElementById('registerUserEmail');
    elements.nameInput = document.getElementById('reg_name');
    elements.emailInput = document.getElementById('reg_email');
    elements.phoneInput = document.getElementById('reg_phone');
    elements.passwordInput = document.getElementById('reg_password');
  }

  function ensureElements() {
    if (!elements.form) {
      cacheElements();
    }
  }

  module.init = function init() {
    cacheElements();
    return module;
  };

  module.clearFeedback = function clearFeedback({ keepSuccess = false } = {}) {
    ensureElements();
    if (elements.error) {
      elements.error.textContent = '';
      elements.error.style.display = 'none';
    }
    if (!keepSuccess && elements.success) {
      elements.success.hidden = true;
    }
  };

  module.showError = function showError(message) {
    ensureElements();
    if (!elements.error) return;
    const text = message || '';
    elements.error.textContent = text;
    elements.error.style.display = text ? 'block' : 'none';
    if (text && typeof elements.error.focus === 'function') {
      elements.error.focus();
    }
  };

  module.setLoading = function setLoading(isLoading) {
    ensureElements();
    if (elements.submitButton) {
      elements.submitButton.disabled = !!isLoading;
      elements.submitButton.classList.toggle('loading', !!isLoading);
    }
  };

  module.toggleInputs = function toggleInputs(disabled) {
    ensureElements();
    [elements.nameInput, elements.emailInput, elements.phoneInput, elements.passwordInput].forEach((input) => {
      if (input) input.disabled = !!disabled;
    });
  };

  module.showSuccess = function showSuccess({ username, email }) {
    ensureElements();
    if (elements.username) elements.username.textContent = username || '-';
    if (elements.userEmail) elements.userEmail.textContent = email || '-';
    if (elements.success) elements.success.hidden = false;
  };

  module.switchView = function switchView(view, { loginForm, loginEmail, onShowLogin } = {}) {
    ensureElements();
    if (!elements.form || !loginForm) return;
    const showRegister = view === 'register';
    loginForm.classList.toggle('is-hidden', showRegister);
    elements.form.classList.toggle('is-hidden', !showRegister);

    if (showRegister) {
      module.clearFeedback();
      module.setLoading(false);
      module.toggleInputs(false);
      try {
        elements.nameInput?.focus?.({ preventScroll: true });
      } catch (_err) {
        elements.nameInput?.focus?.();
      }
      return;
    }

    module.clearFeedback();
    module.setLoading(false);
    module.toggleInputs(false);
    elements.form.reset?.();
    if (typeof onShowLogin === 'function') {
      try {
        onShowLogin();
      } catch (_err) {
        /* ignore */
      }
    }
    if (loginEmail) {
      try {
        loginEmail.focus({ preventScroll: true });
      } catch (_err) {
        loginEmail.focus();
      }
    }
  };

  Object.defineProperty(module, 'elements', {
    enumerable: true,
    get: () => {
      ensureElements();
      return elements;
    },
  });

  global.WFRegisterModule = module;
})(window);
