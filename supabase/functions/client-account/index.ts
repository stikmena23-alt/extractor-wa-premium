// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================
// CORS global
// =============================
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// =============================
// Type guard: ¿init tiene headers?
// =============================
function hasHeaders(
  x: unknown,
): x is ResponseInit & { headers?: HeadersInit } {
  return !!x && typeof x === "object" && "headers" in x;
}

// =============================
// Helper JSON (renombrado)
// =============================
function respondJSONEdge(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders,
  });

  const incoming = hasHeaders(init) ? init.headers : undefined;
  if (incoming) {
    new Headers(incoming).forEach((value, key) => headers.set(key, value));
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

// =============================
// Config Supabase
// =============================
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL) console.error("Missing SUPABASE_URL env");
if (!SERVICE_ROLE_KEY) console.error("Missing SUPABASE_SERVICE_ROLE_KEY env");

const adminClient = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
    },
  })
  : null;

// =============================
// Helpers Admin API
// =============================
// Busca usuario por email usando listUsers (v2 no tiene getUserByEmail)
async function findUserByEmail(email: string) {
  if (!adminClient) {
    return { user: null, error: new Error("Servicio no configurado") };
  }

  const { data, error } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    email,
  });

  if (error) {
    return { user: null, error };
  }

  const user =
    data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ??
      null;

  return { user, error: null };
}

// =============================
// Handler principal
// =============================
serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respondJSONEdge({
      error: { message: "Método no permitido" },
    }, {
      status: 405,
    });
  }

  if (!adminClient) {
    return respondJSONEdge({
      error: { message: "Servicio no configurado" },
    }, {
      status: 500,
    });
  }

  // Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return respondJSONEdge({
      error: { message: "Cuerpo JSON inválido" },
    }, {
      status: 400,
    });
  }

  const payload = raw as Record<string, unknown>;
  const email = typeof payload.email === "string"
    ? payload.email.trim().toLowerCase()
    : "";
  const password = typeof payload.password === "string"
    ? payload.password
    : "";

  if (!email || !password) {
    return respondJSONEdge({
      error: { message: "Faltan credenciales obligatorias" },
    }, {
      status: 400,
    });
  }

  // Ajusta el patrón a tu política real
  const allowedPattern = /^client\.[^@]+@wftools\.com$/i;
  if (!allowedPattern.test(email)) {
    return respondJSONEdge({
      error: { message: "Correo no autorizado" },
    }, {
      status: 403,
    });
  }

  const userMetadata = {
    ...((payload.metadata ?? {}) as Record<string, unknown>),
    full_name: typeof payload.full_name === "string"
      ? payload.full_name.toString().trim()
      : null,
    contact_email: typeof payload.contact_email === "string"
      ? payload.contact_email.toString().trim()
      : null,
    phone: typeof payload.phone === "string"
      ? payload.phone.toString().trim()
      : null,
    source: "client-self-service",
  } as Record<string, unknown>;

  const fullName =
    typeof payload.full_name === "string"
      ? payload.full_name.toString().trim()
      : null;
  const contactEmail =
    typeof payload.contact_email === "string"
      ? payload.contact_email.toString().trim()
      : null;
  const phone = typeof payload.phone === "string"
    ? payload.phone.toString().trim()
    : null;

  try {
    // === Buscar por email (con listUsers) ===
    const { user: existingUser, error: findErr } = await findUserByEmail(email);
    if (findErr) {
      return respondJSONEdge({
        error: { message: findErr.message || "Error buscando usuario" },
      }, {
        status: 400,
      });
    }

    if (existingUser) {
      // === Actualizar ===
      const update = await adminClient.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true,
        password,
        user_metadata: userMetadata,
      });

      if (update.error) {
        return respondJSONEdge({
          error: { message: update.error.message },
        }, {
          status: 400,
        });
      }

      return respondJSONEdge({
        data: {
          user: update.data.user,
          session: null,
          action: "updated",
          profile: {
            full_name: fullName,
            contact_email: contactEmail,
            phone,
          },
        },
        error: null,
      });
    }

    // === Crear ===
    const created = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (created.error) {
      return respondJSONEdge({
        error: { message: created.error.message },
      }, {
        status: 400,
      });
    }

    return respondJSONEdge({
      data: {
        user: created.data.user,
        session: created.data.session ?? null,
        action: "created",
        profile: {
          full_name: fullName,
          contact_email: contactEmail,
          phone,
        },
      },
      error: null,
    });
  } catch (err) {
    console.error("client-account function error", err);
    return respondJSONEdge({
      error: { message: "Error interno" },
    }, {
      status: 500,
    });
  }
});
