import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type ProfileRow = {
  id: string;
  email?: string | null;
  contact_email?: string | null;
  user_email?: string | null;
  auth_email?: string | null;
  identity?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  "Display name"?: string | null;
};

type ViewRow = {
  profile_id?: string | null;
  profileId?: string | null;
  profile_name?: string | null;
  profileName?: string | null;
  banned_at?: string | Date | null;
  bannedAt?: string | Date | null;
  banned_until?: string | Date | null;
  bannedUntil?: string | Date | null;
  reason?: string | null;
  actor_email?: string | null;
  actorEmail?: string | null;
  updated_at?: string | Date | null;
  updatedAt?: string | Date | null;
  is_banned_now?: boolean | null;
};

type BlockedPayloadRow = Record<string, unknown>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PROFILE_COLUMNS =
  'id, email, contact_email, user_email, auth_email, identity, phone_number, phone, full_name, display_name, "Display name"';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function parseMultiValue(params: URLSearchParams, key: string): string[] {
  const collected = new Set<string>();
  const values = params.getAll(key);
  for (const raw of values) {
    if (!raw) continue;
    raw
      .split(",")
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0)
      .forEach((piece) => collected.add(piece));
  }
  return Array.from(collected);
}

function isoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString();
}

function pickProfileName(row: ViewRow, profile: ProfileRow | null): string | null {
  const candidates = [
    row.profile_name,
    row.profileName,
    profile?.["Display name"],
    profile?.display_name,
    profile?.full_name,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function pickFullName(row: ViewRow, profile: ProfileRow | null): string | null {
  const candidates = [
    profile?.full_name,
    profile?.display_name,
    profile?.["Display name"],
    row.profile_name,
    row.profileName,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function pickEmail(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  const candidates = [
    profile.contact_email,
    profile.email,
    profile.user_email,
    profile.auth_email,
    profile.identity,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function pickPhone(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  const candidates = [profile.phone, profile.phone_number];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function matchesSearch(row: BlockedPayloadRow, lowered: string): boolean {
  const pieces: string[] = [];
  const fields = [
    row.email,
    row.contact_email,
    row.user_email,
    row.auth_email,
    row.identity,
    row.full_name,
    row.profile_name,
    row.name,
    row.user_id,
  ];
  for (const value of fields) {
    if (typeof value === "string" && value.trim()) {
      pieces.push(value.trim().toLowerCase());
    }
  }
  return pieces.some((piece) => piece.includes(lowered));
}

async function loadProfiles(ids: string[], emails: string[]): Promise<{ profileMap: Map<string, ProfileRow>; resolvedIds: string[] }> {
  const profileMap = new Map<string, ProfileRow>();
  const idSet = new Set<string>(ids.map((value) => value.trim()).filter((value) => value.length > 0));
  const emailSet = new Set<string>(emails.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0));

  if (emailSet.size) {
    const orFilters: string[] = [];
    for (const email of emailSet) {
      orFilters.push(`email.ilike.${email}`);
      orFilters.push(`contact_email.ilike.${email}`);
      orFilters.push(`user_email.ilike.${email}`);
      orFilters.push(`auth_email.ilike.${email}`);
      orFilters.push(`identity.ilike.${email}`);
    }
    let query = supabase.from("profiles").select(PROFILE_COLUMNS);
    if (orFilters.length) {
      query = query.or(orFilters.join(","));
    }
    const { data, error } = await query;
    if (error) {
      console.warn("profiles email lookup error", error.message ?? error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (!row || !row.id) continue;
        const key = String(row.id);
        profileMap.set(key, row as ProfileRow);
        idSet.add(key);
      }
    }
  }

  const missingIds = Array.from(idSet).filter((id) => !profileMap.has(id));
  if (missingIds.length) {
    const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", missingIds);
    if (error) {
      console.warn("profiles id lookup error", error.message ?? error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (!row || !row.id) continue;
        const key = String(row.id);
        if (!profileMap.has(key)) {
          profileMap.set(key, row as ProfileRow);
        }
      }
    }
  }

  return { profileMap, resolvedIds: Array.from(idSet) };
}

async function fetchBannedRows(resolvedIds: string[] | null): Promise<ViewRow[]> {
  let query = supabase
    .from("v_profiles_banned")
    .select("*")
    .order("banned_until", { ascending: false })
    .limit(500);
  if (resolvedIds && resolvedIds.length) {
    query = query.in("profile_id", resolvedIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? String(error));
  }
  if (!Array.isArray(data)) return [];
  return data as ViewRow[];
}

function buildPayloadRows(rows: ViewRow[], profileMap: Map<string, ProfileRow>): BlockedPayloadRow[] {
  return rows
    .map((row) => {
      const rawId = row.profile_id ?? row.profileId;
      if (!rawId) return null;
      const userId = String(rawId);
      const profile = profileMap.get(userId) ?? null;
      const email = pickEmail(profile);
      const fullName = pickFullName(row, profile);
      const profileName = pickProfileName(row, profile);
      const phone = pickPhone(profile);
      const bannedAt = isoString(row.banned_at ?? row.bannedAt);
      const bannedUntil = isoString(row.banned_until ?? row.bannedUntil);
      const updatedAt = isoString(row.updated_at ?? row.updatedAt ?? bannedAt ?? bannedUntil);

      const payload: BlockedPayloadRow = {
        user_id: userId,
        profile_id: userId,
        email,
        contact_email: profile?.contact_email ?? null,
        user_email: profile?.user_email ?? null,
        auth_email: profile?.auth_email ?? null,
        identity: profile?.identity ?? null,
        full_name: fullName,
        profile_name: profileName,
        display_name: profileName,
        name: profileName ?? fullName ?? null,
        phone,
        phone_number: profile?.phone_number ?? null,
        blocked_at: bannedAt,
        banned_at: bannedAt,
        blocked_until: bannedUntil,
        banned_until: bannedUntil,
        reason: row.reason ?? null,
        actor_email: row.actor_email ?? row.actorEmail ?? null,
        updated_at: updatedAt,
        checked_at: updatedAt,
        is_banned_now: row.is_banned_now ?? true,
        source: "v_profiles_banned",
      };

      return payload;
    })
    .filter((row): row is BlockedPayloadRow => row !== null);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, Allow: "GET" },
    });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 200;

  const requestedIds = parseMultiValue(url.searchParams, "userId");
  const requestedEmails = parseMultiValue(url.searchParams, "email");

  const { profileMap, resolvedIds } = await loadProfiles(requestedIds, requestedEmails);

  if (requestedEmails.length && !resolvedIds.length) {
    const emptyBody = {
      blockedUsers: [] as BlockedPayloadRow[],
      blockedTotal: 0,
      includeExpired: false,
      query: search,
      source: "v_profiles_banned",
      generatedAt: new Date().toISOString(),
    };
    return new Response(JSON.stringify(emptyBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  let viewRows: ViewRow[] = [];
  try {
    viewRows = await fetchBannedRows(resolvedIds.length ? resolvedIds : null);
  } catch (err) {
    console.error("v_profiles_banned view error", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "No se pudo leer la vista v_profiles_banned. Verifica que exista y que el servicio tenga acceso." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const payloadRows = buildPayloadRows(viewRows, profileMap);
  const lowered = typeof search === "string" ? search.trim().toLowerCase() : "";
  const filtered = lowered ? payloadRows.filter((row) => matchesSearch(row, lowered)) : payloadRows;
  const total = filtered.length;
  const sliced = filtered.slice(0, limit);

  const body = {
    blockedUsers: sliced,
    blockedTotal: total,
    includeExpired: false,
    query: search,
    source: "v_profiles_banned",
    generatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
