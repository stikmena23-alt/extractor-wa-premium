import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedMethods = 'POST, OPTIONS';

function buildCorsHeaders(origin?: string | null) {
  const allowedOrigin = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': allowedMethods,
  } as const;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

function createSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function handlePost(request: Request) {
  let payload: { userId?: string; hours?: number; unblock?: boolean };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const userId = payload.userId?.trim();
  const unblock = payload.unblock === true;
  const hours = Number(payload.hours ?? 0);

  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  const { data: currentUser, error: fetchError } = await supabase.auth.admin.getUserById(
    userId,
  );

  if (fetchError || !currentUser?.user) {
    console.error('admin-block fetch error:', fetchError);
    return jsonResponse({ error: 'User not found' }, { status: 404 });
  }

  const baseUserMeta = { ...(currentUser.user.user_metadata ?? {}) } as Record<string, unknown>;
  const baseAppMeta = { ...(currentUser.user.app_metadata ?? {}) } as Record<string, unknown>;

  if (unblock) {
    const clearedAt = new Date().toISOString();
    const clearedUserMeta: Record<string, unknown> = {
      ...baseUserMeta,
      status: 'active',
      is_banned: false,
      ban_status: 'active',
      ban_duration: null,
      ban_expires: null,
      banned_until: null,
      blocked_at: null,
      ban: {
        status: 'active',
        active: false,
        duration: 'none',
        until: null,
        expires_at: null,
        updated_at: clearedAt,
      },
    };
    const clearedAppMeta: Record<string, unknown> = {
      ...baseAppMeta,
      status: 'active',
      is_banned: false,
      ban_status: 'active',
      ban_duration: null,
      ban_expires: null,
      banned_until: null,
      blocked_at: null,
      ban: {
        status: 'active',
        active: false,
        duration: 'none',
        until: null,
        expires_at: null,
        updated_at: clearedAt,
      },
    };

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
      user_metadata: clearedUserMeta,
      app_metadata: clearedAppMeta,
    });

    if (error) {
      console.error('admin-unblock error:', error);
      return jsonResponse(
        { error: 'Failed to unblock user', details: error.message },
        { status: 500 },
      );
    }

    return jsonResponse({ success: true, unblocked: true, ban_duration: 'none' });
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return jsonResponse({ error: 'hours must be a positive number' }, { status: 400 });
  }

  const durationHours = Math.ceil(hours);
  const banDuration = `${durationHours}h`;
  const blockedAt = new Date().toISOString();
  const banExpires = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
  const banDetails = {
    status: 'blocked',
    active: true,
    duration: banDuration,
    until: banExpires,
    expires_at: banExpires,
    started_at: blockedAt,
    updated_at: blockedAt,
  } as const;

  const updatedUserMeta: Record<string, unknown> = {
    ...baseUserMeta,
    status: 'banned',
    is_banned: true,
    ban_status: 'blocked',
    ban_duration: banDuration,
    ban_expires: banExpires,
    banned_until: banExpires,
    blocked_at: blockedAt,
    ban: banDetails,
  };

  const updatedAppMeta: Record<string, unknown> = {
    ...baseAppMeta,
    status: 'banned',
    is_banned: true,
    ban_status: 'blocked',
    ban_duration: banDuration,
    ban_expires: banExpires,
    banned_until: banExpires,
    blocked_at: blockedAt,
    ban: banDetails,
  };

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
    user_metadata: updatedUserMeta,
    app_metadata: updatedAppMeta,
  });

  if (error) {
    console.error('admin-block error:', error);
    return jsonResponse({ error: 'Failed to block user', details: error.message }, { status: 500 });
  }

  return jsonResponse({ success: true, ban_duration: banDuration, ban_expires: banExpires });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, Allow: allowedMethods },
    });
  }

  try {
    const response = await handlePost(request);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    console.error('Unexpected error in admin-block:', error);
    const response = jsonResponse({ error: 'Internal server error' }, { status: 500 });
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }
});
