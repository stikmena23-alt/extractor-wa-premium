import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const allowedMethods = "POST, OPTIONS";

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin ?? "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": allowedMethods,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers ?? {});
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function createSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function sanitizeReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  return match ? match[1].trim() || null : null;
}

async function identifyActor(
  supabase: SupabaseClient,
  request: Request,
): Promise<{ id: string | null; email: string | null }> {
  const token = getBearerToken(request);
  if (!token) return { id: null, email: null };
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      if (error) console.warn("admin-block actor lookup error:", error.message ?? error);
      return { id: null, email: null };
    }
    return { id: data.user.id ?? null, email: data.user.email ?? null };
  } catch (err) {
    console.warn("admin-block actor lookup exception:", err);
    return { id: null, email: null };
  }
}

type BanLogAction = {
  userId: string;
  action: "ban" | "unban";
  banDuration?: string | null;
  bannedUntil?: string | null;
  reason?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
};

async function logBanAction(supabase: SupabaseClient, entry: BanLogAction): Promise<void> {
  try {
    const payload = {
      user_id: entry.userId,
      action: entry.action,
      ban_duration: entry.banDuration ?? null,
      banned_until: entry.bannedUntil ?? null,
      reason: entry.reason ?? null,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
    };
    const { error } = await supabase.from("admin_ban_log").insert(payload);
    if (error) {
      console.warn("admin-block log insert error:", error.message ?? error);
    }
  } catch (err) {
    console.warn("admin-block log insert exception:", err);
  }
}

function buildClearedMetadata(base: Record<string, unknown>, clearedAt: string) {
  const previousBan = (base["ban"] as Record<string, unknown> | undefined) ?? {};
  return {
    ...base,
    status: "active",
    is_banned: false,
    ban_status: "active",
    ban_duration: null,
    ban_expires: null,
    banned_until: null,
    blocked_at: null,
    block_reason: null,
    ban: {
      ...previousBan,
      status: "active",
      active: false,
      duration: "none",
      until: null,
      expires_at: null,
      reason: null,
      updated_at: clearedAt,
    },
  };
}

function buildBlockedMetadata(
  base: Record<string, unknown>,
  details: {
    blockedAt: string;
    banDuration: string;
    banExpires: string;
    reason: string | null;
  },
) {
  const previousBan = (base["ban"] as Record<string, unknown> | undefined) ?? {};
  const banDetails = {
    ...previousBan,
    status: "blocked",
    active: true,
    duration: details.banDuration,
    until: details.banExpires,
    expires_at: details.banExpires,
    started_at: details.blockedAt,
    updated_at: details.blockedAt,
  } as Record<string, unknown>;
  if (details.reason) {
    banDetails.reason = details.reason;
  }
  return {
    ...base,
    status: "banned",
    is_banned: true,
    ban_status: "blocked",
    ban_duration: details.banDuration,
    ban_expires: details.banExpires,
    banned_until: details.banExpires,
    blocked_at: details.blockedAt,
    block_reason:
      details.reason ?? (typeof base["block_reason"] === "string" ? (base["block_reason"] as string) : null) ?? null,
    ban: banDetails,
  };
}

async function handlePost(request: Request): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
  const unblock = payload.unblock === true;
  const hours = Number(payload.hours ?? 0);
  const providedReason = sanitizeReason(payload.reason);

  if (!userId) {
    return jsonResponse({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const actor = await identifyActor(supabase, request);

  const { data: currentUser, error: fetchError } = await supabase.auth.admin.getUserById(userId);
  if (fetchError || !currentUser?.user) {
    console.error("admin-block fetch error:", fetchError);
    return jsonResponse({ error: "User not found" }, { status: 404 });
  }

  const baseUserMeta = { ...(currentUser.user.user_metadata ?? {}) } as Record<string, unknown>;
  const baseAppMeta = { ...(currentUser.user.app_metadata ?? {}) } as Record<string, unknown>;

  if (unblock) {
    const clearedAt = new Date().toISOString();
    const clearedUserMeta = buildClearedMetadata(baseUserMeta, clearedAt);
    const clearedAppMeta = buildClearedMetadata(baseAppMeta, clearedAt);

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "none",
      user_metadata: clearedUserMeta,
      app_metadata: clearedAppMeta,
    });
    if (error) {
      console.error("admin-unblock error:", error);
      return jsonResponse({ error: "Failed to unblock user", details: error.message }, { status: 500 });
    }

    await logBanAction(supabase, {
      userId,
      action: "unban",
      banDuration: "none",
      bannedUntil: null,
      reason: providedReason,
      actorId: actor.id ?? null,
      actorEmail: actor.email ?? null,
    });

    return jsonResponse({ success: true, unblocked: true, ban_duration: "none" });
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return jsonResponse({ error: "hours must be a positive number" }, { status: 400 });
  }

  const durationHours = Math.ceil(hours);
  const banDuration = `${durationHours}h`;
  const blockedAt = new Date().toISOString();
  const banExpires = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const userMeta = buildBlockedMetadata(baseUserMeta, {
    blockedAt,
    banDuration,
    banExpires,
    reason: providedReason,
  });
  const appMeta = buildBlockedMetadata(baseAppMeta, {
    blockedAt,
    banDuration,
    banExpires,
    reason: providedReason,
  });

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
    user_metadata: userMeta,
    app_metadata: appMeta,
  });
  if (error) {
    console.error("admin-block error:", error);
    return jsonResponse({ error: "Failed to block user", details: error.message }, { status: 500 });
  }

  await logBanAction(supabase, {
    userId,
    action: "ban",
    banDuration,
    bannedUntil: banExpires,
    reason: providedReason,
    actorId: actor.id ?? null,
    actorEmail: actor.email ?? null,
  });

  return jsonResponse({ success: true, ban_duration: banDuration, ban_expires: banExpires });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
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
    console.error("Unexpected error in admin-block:", error);
    const response = jsonResponse({ error: "Internal server error" }, { status: 500 });
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }
});
