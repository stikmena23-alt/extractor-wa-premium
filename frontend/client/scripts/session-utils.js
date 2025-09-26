(function(global){
  const helper = {};

  helper.hasActiveSession = async function hasActiveSession(client){
    if(!client || !client.auth || typeof client.auth.getSession !== 'function'){
      return false;
    }
    try {
      const { data, error } = await client.auth.getSession();
      if(error){
        console.warn('No se pudo verificar la sesión actual:', error.message || error);
        return false;
      }
      return !!(data && data.session);
    } catch (err){
      console.warn('Fallo verificando la sesión activa', err);
      return false;
    }
  };

  helper.logout = async function logout(client){
    if(!client || !client.auth || typeof client.auth.signOut !== 'function'){
      return { ok:false, error:new Error('Cliente de Supabase inválido') };
    }
    try {
      const { error } = await client.auth.signOut();
      if(error){
        return { ok:false, error };
      }
      return { ok:true };
    } catch (err){
      return { ok:false, error:err };
    }
  };

  helper.ensureLogout = async function ensureLogout(client){
    const active = await helper.hasActiveSession(client);
    if(!active){
      return { ok:false, reason:'no-session' };
    }
    const res = await helper.logout(client);
    if(res.ok){
      return { ok:true };
    }
    return res;
  };

  global.WFSessionHelper = Object.freeze(helper);
})(window);
