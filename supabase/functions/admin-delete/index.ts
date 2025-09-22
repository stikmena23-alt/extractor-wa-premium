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
  let payload: { userId?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const userId = payload.userId?.trim();
  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error('admin-delete error:', error);
    return jsonResponse({ error: 'Failed to delete user', details: error.message }, { status: 500 });
  }

  return jsonResponse({ success: true });
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
    console.error('Unexpected error in admin-delete:', error);
    const response = jsonResponse({ error: 'Internal server error' }, { status: 500 });
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }
});
