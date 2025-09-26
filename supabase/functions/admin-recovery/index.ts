import { identifyActor } from "../../../backend/src/modules/auth/identifyActor.ts";
import {
  buildCorsHeaders,
  getRequestOrigin,
  handleHttpError,
  jsonResponse,
  methodNotAllowed,
  noContent,
} from "../../../backend/src/lib/http.ts";
import { issueAdminRecovery } from "../../../backend/src/modules/admin/recovery/index.ts";
import { createServiceClient } from "../../../backend/src/lib/supabaseClient.ts";

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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid-json", message: "No se pudo leer el cuerpo de la solicitud" }, { status: 400, headers: corsHeaders });
  }

  const email = typeof (payload as Record<string, unknown>).email === "string"
    ? ((payload as Record<string, unknown>).email as string).trim()
    : "";

  if (!email) {
    return jsonResponse({ error: "invalid-email", message: "Debes proporcionar un correo válido" }, { status: 400, headers: corsHeaders });
  }

  const client = createServiceClient();
  const actor = await identifyActor(client, request);

  const context = {
    actorEmail: actor.email,
    origin,
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? null,
    userAgent: request.headers.get("user-agent") ?? null,
  };

  try {
    const result = await issueAdminRecovery(client, email, actor.email, context);
    return jsonResponse(
      {
        data: {
          email: result.email,
          shortCode: result.shortCode,
          resetUrl: result.resetUrl,
          expiresAt: result.expiresAt,
          qrData: result.resetUrl,
        },
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    return handleHttpError(error, origin, allowedMethods);
  }
});
