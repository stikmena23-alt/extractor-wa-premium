import { AppError, isAppError } from "./errors.ts";

export const DEFAULT_ALLOWED_METHODS = "GET,POST,OPTIONS";

export function getRequestOrigin(request: Request): string | null {
  return request.headers.get("origin") ?? request.headers.get("Origin");
}

export function buildCorsHeaders(origin: string | null, allowedMethods = DEFAULT_ALLOWED_METHODS): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": allowedMethods,
    Vary: "Origin",
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function noContent(headers: HeadersInit = {}): Response {
  return new Response(null, { status: 204, headers });
}

export function methodNotAllowed(origin: string | null, allowedMethods = DEFAULT_ALLOWED_METHODS): Response {
  const headers = buildCorsHeaders(origin, allowedMethods);
  headers["Allow"] = allowedMethods;
  return new Response(null, { status: 405, headers });
}

export function handleHttpError(error: unknown, origin: string | null, allowedMethods = DEFAULT_ALLOWED_METHODS): Response {
  const headers = buildCorsHeaders(origin, allowedMethods);
  if (isAppError(error)) {
    const payload = { error: error.code, message: error.message, details: error.details ?? null };
    return jsonResponse(payload, { status: error.status, headers });
  }
  console.error("Unexpected error:", error);
  return jsonResponse({ error: "internal-error", message: "Ocurrió un error inesperado" }, { status: 500, headers });
}
