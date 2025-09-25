// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const allowedMethods = "POST, OPTIONS";
const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY") ?? "";

function buildCorsHeaders(origin: string | null) {
  const allowedOrigin = origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": allowedMethods,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function isAuthorized(req: Request) {
  const bearer = req.headers.get("authorization") || "";
  const token = bearer.replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") || "").trim();
  return !!ADMIN_API_KEY && (token === ADMIN_API_KEY || apikey === ADMIN_API_KEY);
}

function createSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type BackfillInput = {
  perPage?: number;
  startPage?: number;
  maxPages?: number;
  deleteStale?: boolean;
  dryRun?: boolean;
};

function isBannedActive(user: Record<string, unknown>, nowMs: number) {
  const untilRaw = user?.banned_until ?? user?.bannedUntil ?? null;
  const until = typeof untilRaw === "string" || untilRaw instanceof Date ? new Date(untilRaw) : null;
  return !!until && !Number.isNaN(until.valueOf()) && until.getTime() > nowMs;
}

async function handlePost(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BackfillInput = {};
  try {
    body = await request.json();
  } catch {
    // Ignorar, se usan valores por defecto
  }

  const perPage = Math.max(1, Math.min(body.perPage ?? 1000, 1000));
  const startPage = Math.max(1, body.startPage ?? 1);
  const maxPages = Math.max(1, body.maxPages ?? 100);
  const deleteStale = body.deleteStale ?? true;
  const dryRun = body.dryRun ?? false;

  const supabase = createSupabaseClient();
  const nowMs = Date.now();

  const upserts: Array<{ user_id: string; banned_until: string; banned_at: string; updated_at: string }> = [];
  const visitedUserIds = new Set<string>();

  let page = startPage;
  let scanned = 0;
  let bannedFound = 0;

  while (page < startPage + maxPages) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return jsonResponse({ error: `listUsers failed on page ${page}`, details: error.message }, { status: 400 });
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      scanned++;
      if (!user?.id) continue;
      visitedUserIds.add(user.id);
      if (isBannedActive(user as Record<string, unknown>, nowMs)) {
        bannedFound++;
        const bannedUntilISO = new Date(String(user.banned_until ?? user.bannedUntil)).toISOString();
        const nowISO = new Date().toISOString();
        upserts.push({
          user_id: user.id,
          banned_until: bannedUntilISO,
          banned_at: nowISO,
          updated_at: nowISO,
        });
      }
    }

    if (users.length < perPage) break;
    page++;
  }

  let upserted = 0;
  if (!dryRun && upserts.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < upserts.length; i += chunkSize) {
      const chunk = upserts.slice(i, i + chunkSize);
      const { error } = await supabase.from("banned_users").upsert(chunk, { onConflict: "user_id" });
      if (error) {
        return jsonResponse(
          { error: "upsert to banned_users failed", details: error.message, at: { i, chunkSize } },
          { status: 400 },
        );
      }
      upserted += chunk.length;
    }
  }

  let deleted = 0;
  if (deleteStale && !dryRun) {
    const { data: current, error: currentErr } = await supabase.from("banned_users").select("user_id, banned_until");
    if (currentErr) {
      return jsonResponse({ error: "fetch banned_users failed", details: currentErr.message }, { status: 400 });
    }
    const toDelete: string[] = [];
    for (const row of current ?? []) {
      const uid = row?.user_id;
      if (!uid) continue;
      if (!visitedUserIds.has(uid) || !upserts.find((item) => item.user_id === uid)) {
        toDelete.push(uid);
      }
    }
    const chunkSize = 500;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      const chunk = toDelete.slice(i, i + chunkSize);
      const { error } = await supabase.from("banned_users").delete().in("user_id", chunk);
      if (error) {
        return jsonResponse(
          { error: "cleanup banned_users failed", details: error.message, at: { i, chunkSize } },
          { status: 400 },
        );
      }
      deleted += chunk.length;
    }
  }

  return jsonResponse({
    success: true,
    dryRun,
    scannedUsers: scanned,
    bannedDetected: upserts.length,
    upserted,
    deletedStale: deleted,
    pagesScanned: page - startPage + 1,
    perPage,
    startPage,
    maxPages,
    deleteStale,
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...corsHeaders, Allow: allowedMethods } });
  }

  try {
    const response = await handlePost(request);
    for (const [k, v] of Object.entries(corsHeaders)) response.headers.set(k, v as string);
    return response;
  } catch (err) {
    console.error("admin-banned-backfill error:", err);
    const response = jsonResponse({ error: "Internal server error" }, { status: 500 });
    for (const [k, v] of Object.entries(corsHeaders)) response.headers.set(k, v as string);
    return response;
  }
});
