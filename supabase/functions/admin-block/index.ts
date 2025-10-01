import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

const allowedMethods = "POST, OPTIONS";

type JsonRecord = Record<string, unknown>;

type SupabaseAdminClient = ReturnType<typeof createClient>;

type UpsertBanArgs = {
  userId: string;
  bannedUntilISO: string;
  reason: string | null;
  actorEmail: string | null;
};

type BlockMetadataDetails = {
  banDuration: string;
  banExpires: string;
  blockedAt: string;
  reason: string | null;
};

type BanAction = "ban" | "unban";

let banLogUnavailable = false;

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

function createSupabaseClient() {
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

async function identifyActor(supabase: SupabaseAdminClient, request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return {
      id: null as string | null,
      email: null as string | null,
    };
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      if (error) {
        console.warn("admin-block actor lookup error:", error.message ?? error);
      }
      return { id: null, email: null };
    }
    return {
      id: data.user.id ?? null,
      email: data.user.email ?? null,
    };
  } catch (err) {
    console.warn("admin-block actor lookup exception:", err);
    return { id: null, email: null };
  }
}

async function upsertBannedUser(supabase: SupabaseAdminClient, args: UpsertBanArgs) {
  const row = {
    user_id: args.userId,
    banned_until: args.bannedUntilISO,
    banned_at: new Date().toISOString(),
    reason: args.reason,
    actor_email: args.actorEmail,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("banned_users").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

async function deleteBannedUser(supabase: SupabaseAdminClient, userId: string) {
  const { error } = await supabase.from("banned_users").delete().eq("user_id", userId);
  if (error) throw error;
}

async function logBanAction(
  supabase: SupabaseAdminClient,
  action: BanAction,
  details: { userId: string; banDuration?: string | null; bannedUntil?: string | null; reason?: string | null; actorEmail?: string | null },
) {
  if (banLogUnavailable) return;
  try {
    const { error } = await supabase.from("admin_ban_log").insert({
      user_id: details.userId,
      action,
      ban_duration: details.banDuration ?? null,
      banned_until: details.bannedUntil ?? null,
      reason: details.reason ?? null,
      actor_email: details.actorEmail ?? null,
    });
    if (error) {
      const message = error.message ?? String(error);
      console.warn("admin-block log insert error:", message);
      if (error.code === "42P01" || /relation .*admin_ban_log/i.test(message)) {
        banLogUnavailable = true;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("admin-block log exception:", message);
    if (/relation .*admin_ban_log/i.test(message) || /42P01/.test(message)) {
      banLogUnavailable = true;
    }
  }
}

function buildClearedMetadata(base: JsonRecord, clearedAt: string) {
  const prev = (base as JsonRecord)["ban"] ?? {};
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
      ...(prev as JsonRecord),
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

function buildBlockedMetadata(base: JsonRecord, details: BlockMetadataDetails) {
  const prev = (base as JsonRecord)["ban"] ?? {};
  const banDetails: JsonRecord = {
    ...(prev as JsonRecord),
    status: "blocked",
    active: true,
    duration: details.banDuration,
    until: details.banExpires,
    expires_at: details.banExpires,
    started_at: details.blockedAt,
    updated_at: details.blockedAt,
  };
  if (details.reason) banDetails.reason = details.reason;
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
      details.reason ??
      (typeof (base as JsonRecord)["block_reason"] === "string"
        ? ((base as JsonRecord)["block_reason"] as string)
        : null) ??
      null,
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
  const unblock = payload.unblock === true || payload.unban === true || payload.hours === 0;
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

  const baseUserMeta = { ...(currentUser.user.user_metadata ?? {}) } as JsonRecord;
  const baseAppMeta = { ...(currentUser.user.app_metadata ?? {}) } as JsonRecord;

  if (unblock) {
    const clearedAt = new Date().toISOString();

    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "none",
      user_metadata: buildClearedMetadata(baseUserMeta, clearedAt),
      app_metadata: buildClearedMetadata(baseAppMeta, clearedAt),
    });
    if (updErr) {
      console.error("admin-unblock error:", updErr);
      return jsonResponse({ error: "Failed to unblock user", details: updErr.message }, { status: 500 });
    }

    try {
      await deleteBannedUser(supabase, userId);
    } catch (dbErr) {
      console.warn("banned_users delete warning (unblock ok in auth):", dbErr);
    }

    await logBanAction(supabase, "unban", {
      userId,
      banDuration: "none",
      bannedUntil: null,
      reason: providedReason,
      actorEmail: actor.email,
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

  const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
    user_metadata: buildBlockedMetadata(baseUserMeta, {
      blockedAt,
      banDuration,
      banExpires,
      reason: providedReason,
    }),
    app_metadata: buildBlockedMetadata(baseAppMeta, {
      blockedAt,
      banDuration,
      banExpires,
      reason: providedReason,
    }),
  });
  if (updErr) {
    console.error("admin-block error:", updErr);
    return jsonResponse({ error: "Failed to block user", details: updErr.message }, { status: 500 });
  }

  try {
    await upsertBannedUser(supabase, {
      userId,
      bannedUntilISO: banExpires,
      reason: providedReason,
      actorEmail: actor.email,
    });
  } catch (dbErr) {
    console.warn("banned_users upsert warning (ban ok in auth):", dbErr);
  }

  await logBanAction(supabase, "ban", {
    userId,
    banDuration,
    bannedUntil: banExpires,
    reason: providedReason,
    actorEmail: actor.email,
  });

  return jsonResponse({ success: true, ban_duration: banDuration, ban_expires: banExpires });
}

Deno.serve(async (request: Request) => {
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
