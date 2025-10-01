(function(global){
  if(!global) return;

  var DEFAULT_INTERVAL_MS = 180000; // 3 minutes
  var DEFAULT_THRESHOLD_MS = 90000; // 1.5 minutes

  var client = null;
  var config = null;
  var keepAliveTimer = null;
  var ensuring = null;
  var lastSession = null;
  var lastError = null;
  var listeners = new Set();

  function logWarn(){
    if(typeof console !== 'undefined' && console.warn){
      console.warn.apply(console, arguments);
    }
  }

  function logError(){
    if(typeof console !== 'undefined' && console.error){
      console.error.apply(console, arguments);
    }
  }

  function notify(event, session, details){
    listeners.forEach(function(listener){
      try {
        listener(event, session, details || null);
      } catch(err){
        logWarn('WFSupabase listener failed', err);
      }
    });
  }

  function clearTimer(){
    if(keepAliveTimer){
      global.clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  function scheduleTimer(){
    clearTimer();
    if(!client || !config) return;
    var interval = Number(config.refreshIntervalMs);
    if(!Number.isFinite(interval) || interval <= 0){
      interval = DEFAULT_INTERVAL_MS;
    }
    keepAliveTimer = global.setInterval(function(){
      ensureSession({ minimumValidityMs: config.refreshThresholdMs }).catch(function(err){
        logWarn('WFSupabase keepalive failed', err);
      });
    }, Math.max(interval, 15000));
  }

  function captureError(scope, error, session){
    lastError = error || null;
    notify('error', session || null, { scope: scope, error: error });
  }

  function sanitizeConfig(options, previous){
    var base = Object.assign({}, previous || {});
    if(options && typeof options === 'object'){
      if(options.url) base.url = options.url;
      if(options.anonKey) base.anonKey = options.anonKey;
      if(options.clientOptions) base.clientOptions = options.clientOptions;
      if(Object.prototype.hasOwnProperty.call(options, 'refreshIntervalMs')){
        base.refreshIntervalMs = Number(options.refreshIntervalMs);
      }
      if(Object.prototype.hasOwnProperty.call(options, 'refreshThresholdMs')){
        base.refreshThresholdMs = Number(options.refreshThresholdMs);
      }
    }
    if(!Number.isFinite(base.refreshIntervalMs) || base.refreshIntervalMs <= 0){
      base.refreshIntervalMs = DEFAULT_INTERVAL_MS;
    }
    if(!Number.isFinite(base.refreshThresholdMs) || base.refreshThresholdMs < 0){
      base.refreshThresholdMs = DEFAULT_THRESHOLD_MS;
    }
    return base;
  }

  async function ensureSession(options){
    if(!client) return null;

    var minimumValidityMs = DEFAULT_THRESHOLD_MS;
    if(options && Number.isFinite(options.minimumValidityMs)){
      minimumValidityMs = Math.max(0, Number(options.minimumValidityMs));
    } else if(config && Number.isFinite(config.refreshThresholdMs)){
      minimumValidityMs = Math.max(0, Number(config.refreshThresholdMs));
    }
    var forceRefresh = !!(options && options.forceRefresh);

    if(ensuring) return ensuring;

    ensuring = (async function(){
      var session = null;
      try {
        var result = await client.auth.getSession();
        if(result && result.data && result.data.session){
          session = result.data.session;
        }
        if(result && result.error){
          captureError('getSession', result.error, session);
        }
      } catch(err){
        captureError('getSession', err, session);
        session = null;
      }

      lastSession = session;

      if(!session){
        clearTimer();
        return null;
      }

      scheduleTimer();

      var expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
      var shouldRefresh = forceRefresh;
      if(!shouldRefresh && expiresAtMs){
        shouldRefresh = expiresAtMs - Date.now() <= minimumValidityMs;
      }

      if(!shouldRefresh) return session;

      try {
        var refreshResult = await client.auth.refreshSession({ refresh_token: session.refresh_token });
        if(refreshResult && refreshResult.error){
          captureError('refreshSession', refreshResult.error, session);
          return session;
        }
        if(refreshResult && refreshResult.data && refreshResult.data.session){
          lastSession = refreshResult.data.session;
          notify('TOKEN_REFRESHED', lastSession, null);
          scheduleTimer();
          return lastSession;
        }
        return session;
      } catch(err){
        captureError('refreshSession', err, session);
        return session;
      }
    })();

    try {
      return await ensuring;
    } finally {
      ensuring = null;
    }
  }

  function attachAuthListener(){
    if(!client || !client.auth || typeof client.auth.onAuthStateChange !== 'function') return;
    client.auth.onAuthStateChange(function(event, session){
      lastSession = session || null;
      if(session){
        scheduleTimer();
      } else {
        clearTimer();
      }
      notify(event || 'UNKNOWN', lastSession, null);
    });
  }

  var api = {
    init: function init(options){
      if(client){
        config = sanitizeConfig(options, config);
        return client;
      }
      if(!global.supabase || typeof global.supabase.createClient !== 'function'){
        logError('WFSupabase: supabase-js is not available on window');
        return null;
      }
      var desired = sanitizeConfig(options, config);
      if(!desired.url || !desired.anonKey){
        logWarn('WFSupabase: init requires url and anonKey');
        return null;
      }
      config = desired;
      client = global.supabase.createClient(config.url, config.anonKey, config.clientOptions);
      attachAuthListener();
      ensureSession().catch(function(err){
        captureError('initialEnsure', err, null);
      });
      return client;
    },
    getClient: function getClient(){
      return client;
    },
    ensureSession: function ensure(options){
      return ensureSession(options || null);
    },
    forceRefresh: function forceRefresh(){
      return ensureSession({ forceRefresh: true, minimumValidityMs: 0 });
    },
    getLastSession: function getLastSession(){
      return lastSession;
    },
    getLastError: function getLastError(){
      return lastError;
    },
    onSession: function onSession(listener){
      if(typeof listener !== 'function') return function(){};
      listeners.add(listener);
      return function(){ listeners.delete(listener); };
    },
    removeListener: function removeListener(listener){
      listeners.delete(listener);
    },
    getConfig: function getConfig(){
      return config ? Object.assign({}, config) : null;
    },
    get isInitialized(){
      return !!client;
    }
  };

  global.WFSupabase = api;
})(typeof window !== 'undefined' ? window : this);