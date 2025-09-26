import { identifyActor } from "../../../backend/src/modules/auth/identifyActor.ts";
import {
  buildCorsHeaders,
  getRequestOrigin,
  handleHttpError,
  jsonResponse,
  methodNotAllowed,
  noContent,
} from "../../../backend/src/lib/http.ts";
import { completeAdminRecovery } from "../../../backend/src/modules/admin/recovery/index.ts";
import { updateAdminPassword } from "../../../backend/src/modules/admin/accounts.ts";
import { createServiceClient } from "../../../backend/src/lib/supabaseClient.ts";
import { ValidationError } from "../../../backend/src/lib/errors.ts";

const allowedMethods = "POST, OPTIONS";

Deno.serve(async (request) => {
  const origin = getRequestOrigin(request);
  const corsHeaders = buildCorsHeaders(origin, allowedMethods);

  if (request.method === "OPTIONS") {
    return noContent(corsHeaders);
  }

  if (request.method !== "POST") {
    return methodNotAllowed(origin, allowedMethods);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid-json", message: "No se pudo leer el cuerpo de la solicitud" }, { status: 400, headers: corsHeaders });
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password || password.length < 12) {
    return jsonResponse({ error: "weak-password", message: "La contraseña debe tener al menos 12 caracteres" }, { status: 400, headers: corsHeaders });
  }

  const client = createServiceClient();
  const actor = await identifyActor(client, request);

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  if (userId) {
    if (!actor.id) {
      return jsonResponse({ error: "unauthorized", message: "No autorizado" }, { status: 401, headers: corsHeaders });
    }
    try {
      await updateAdminPassword(client, userId, password);
      return jsonResponse({ ok: true }, { status: 200, headers: corsHeaders });
    } catch (error) {
      return handleHttpError(error, origin, allowedMethods);
    }
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : null;

  if (!token && !code) {
    return jsonResponse({ error: "missing-token", message: "Debes proporcionar el enlace o el código de recuperación" }, { status: 400, headers: corsHeaders });
  }

  try {
    const result = await completeAdminRecovery(client, {
      token: token || null,
      code: code || null,
      email,
      password,
      actorEmail: actor.email,
      ip: request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
    });
    return jsonResponse({ data: { email: result.email } }, { status: 200, headers: corsHeaders });
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonResponse({ error: error.code, message: error.message }, { status: error.status, headers: corsHeaders });
    }
    return handleHttpError(error, origin, allowedMethods);
  }
});
