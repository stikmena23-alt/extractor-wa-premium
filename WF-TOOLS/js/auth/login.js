(function (global) {
  const module = {};
  const elements = {};
  const REMEMBER_KEY = 'wf-tools.login.remembered-email';
  const STORAGE_TEST_KEY = `${REMEMBER_KEY}.__test`;
  let storage = null;
  let storageAvailable = false;

  function cacheElements() {
    elements.screen = document.getElementById('loginScreen');
    elements.form = document.getElementById('loginForm');
    elements.email = document.getElementById('loginEmail');
    elements.password = document.getElementById('loginPassword');
    elements.togglePassword = document.getElementById('loginTogglePassword');
    elements.remember = document.getElementById('loginRemember');
    elements.button = document.getElementById('loginBtn');
    elements.error = document.getElementById('loginError');
    elements.loading = document.getElementById('loginLoading');
  }

  function testStorage(candidate) {
    if (!candidate) return false;
    try {
      const value = String(Date.now());
      candidate.setItem(STORAGE_TEST_KEY, value);
      const stored = candidate.getItem(STORAGE_TEST_KEY);
      candidate.removeItem(STORAGE_TEST_KEY);
      return stored === value;
    } catch (_err) {
      return false;
    }
  }

  function ensureElements() {
    if (!elements.form) {
      cacheElements();
    }
  }

  module.init = function init(options = {}) {
    cacheElements();
    storage = options.storage ?? global.localStorage ?? null;
    storageAvailable = testStorage(storage);
    module.resetPasswordToggle();
    return module;
  };

  module.toggleButton = function toggleButton(disabled) {
    ensureElements();
    if (elements.button) {
      elements.button.disabled = !!disabled;
    }
  };

  module.showLoading = function showLoading(show) {
    ensureElements();
    if (elements.loading) {
      elements.loading.style.display = show ? 'block' : 'none';
    }
  };

  module.showError = function showError(message) {
    ensureElements();
    if (!elements.error) return;
    const text = message || '';
    elements.error.textContent = text;
    elements.error.style.display = text ? 'block' : 'none';
  };

  module.setRememberedEmail = function setRememberedEmail(value) {
    if (!storageAvailable || !storage) return;
    const trimmed = (value || '').trim();
    if (!trimmed) return;
    try {
      storage.setItem(REMEMBER_KEY, trimmed);
    } catch (_err) {
      /* ignore */
    }
  };

  module.getRememberedEmail = function getRememberedEmail() {
    if (!storageAvailable || !storage) return '';
    try {
      return storage.getItem(REMEMBER_KEY) || '';
    } catch (_err) {
      return '';
    }
  };

  module.clearRememberedEmail = function clearRememberedEmail() {
    if (!storageAvailable || !storage) return;
    try {
      storage.removeItem(REMEMBER_KEY);
    } catch (_err) {
      /* ignore */
    }
  };

  module.restoreRememberedEmail = function restoreRememberedEmail() {
    ensureElements();
    if (!storageAvailable || !storage || !elements.email) return;
    try {
      const remembered = module.getRememberedEmail();
      if (remembered) {
        elements.email.value = remembered;
        if (elements.remember) {
          elements.remember.checked = true;
        }
      } else if (elements.remember) {
        elements.remember.checked = false;
      }
    } catch (_err) {
      if (elements.remember) {
        elements.remember.checked = false;
      }
    }
  };

  module.resetPasswordToggle = function resetPasswordToggle() {
    ensureElements();
    if (elements.togglePassword) {
      elements.togglePassword.textContent = 'Mostrar';
      elements.togglePassword.setAttribute('aria-pressed', 'false');
      elements.togglePassword.setAttribute('aria-label', 'Mostrar contraseña');
    }
    if (elements.password) {
      elements.password.type = 'password';
    }
  };

  module.resetForm = function resetForm() {
    ensureElements();
    elements.form?.reset?.();
    module.showError('');
    module.showLoading(false);
    module.toggleButton(false);
    module.restoreRememberedEmail();
    module.resetPasswordToggle();
  };

  module.isStorageAvailable = function isStorageAvailable() {
    return storageAvailable;
  };

  Object.defineProperty(module, 'elements', {
    enumerable: true,
    get: () => {
      ensureElements();
      return elements;
    },
  });

  global.WFLoginModule = module;
})(window);
