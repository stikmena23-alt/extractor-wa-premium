const DEFAULT_INTERVAL_MS = 60000;
let timer = null;
let currentInterval = DEFAULT_INTERVAL_MS;
let minimumValidity = 90000;
let forceOnWake = true;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function sendEnsure(forceRefresh) {
  postMessage({
    type: 'ensure-session',
    forceRefresh: !!forceRefresh,
    minimumValidityMs: minimumValidity,
  });
}

function startTimer() {
  clearTimer();
  timer = setInterval(() => {
    sendEnsure(false);
  }, Math.max(15000, currentInterval));
}

self.addEventListener('message', (event) => {
  const data = event?.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'configure') {
    if (Number.isFinite(data.intervalMs) && data.intervalMs > 0) {
      currentInterval = data.intervalMs;
    }
    if (Number.isFinite(data.minimumValidityMs) && data.minimumValidityMs >= 0) {
      minimumValidity = data.minimumValidityMs;
    }
    forceOnWake = data.forceOnWake !== false;
    if (data.active === false) {
      clearTimer();
      return;
    }
    if (forceOnWake) {
      sendEnsure(true);
    } else {
      sendEnsure(false);
    }
    startTimer();
  } else if (data.type === 'ping-now') {
    sendEnsure(!!data.forceRefresh);
  } else if (data.type === 'terminate') {
    clearTimer();
    close();
  } else if (data.type === 'pause') {
    clearTimer();
  } else if (data.type === 'resume') {
    startTimer();
  }
});
