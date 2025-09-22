import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders,
  });
  const existing = init.headers ? new Headers(init.headers) : null;
  if (existing) {
    existing.forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

type ClientPayload = {
  email?: string;
  password?: string;
  full_name?: string;
  contact_email?: string;
  phone?: string;
  metadata?: Record<string, unknown> | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL env");
}

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env");
}

const adminClient = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  : null;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: { message: "Método no permitido" } }, { status: 405 });
  }

  if (!adminClient) {
    return jsonResponse({ error: { message: "Servicio no configurado" } }, { status: 500 });
  }

  let payload: ClientPayload;
  try {
    payload = await req.json();
  } catch (_err) {
    return jsonResponse({ error: { message: "Cuerpo JSON inválido" } }, { status: 400 });
  }

  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password;

  if (!email || !password) {
    return jsonResponse({
      error: { message: "Faltan credenciales obligatorias" },
    }, { status: 400 });
  }

  const allowedPattern = /^clien\.[^@]+@wftools\.com$/i;
  if (!allowedPattern.test(email)) {
    return jsonResponse({
      error: { message: "Correo no autorizado" },
    }, { status: 403 });
  }

  const fullName = payload?.full_name?.trim() || null;
  const contactEmail = payload?.contact_email?.trim() || null;
  const phone = payload?.phone?.trim() || null;

  const userMetadata = {
    ...(payload?.metadata ?? {}),
    full_name: fullName,
    contact_email: contactEmail,
    phone,
    source: "client-self-service",
  } as Record<string, unknown>;

  try {
    const existing = await adminClient.auth.admin.getUserByEmail(email);
    if (existing.error && existing.error.message && existing.error.message !== "User not found") {
      return jsonResponse({ error: { message: existing.error.message } }, { status: 400 });
    }

    if (existing.data?.user) {
      const update = await adminClient.auth.admin.updateUserById(existing.data.user.id, {
        email_confirm: true,
        password,
        user_metadata: userMetadata,
      });

      if (update.error) {
        return jsonResponse({ error: { message: update.error.message } }, { status: 400 });
      }

      return jsonResponse({
        data: {
          user: update.data.user,
          session: null,
          action: "updated",
        },
        error: null,
      });
    }

    const created = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (created.error) {
      return jsonResponse({ error: { message: created.error.message } }, { status: 400 });
    }

    return jsonResponse({
      data: {
        user: created.data.user,
        session: created.data.session ?? null,
        action: "created",
      },
      error: null,
    });
  } catch (err) {
    console.error("client-account function error", err);
    return jsonResponse({ error: { message: "Error interno" } }, { status: 500 });
  }
});
