import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type JsonRecord = Record<string, unknown>;

type ViewRow = {
  profile_id?: string | null;
  profileId?: string | null;
  banned_until?: string | Date | null;
  bannedUntil?: string | Date | null;
  banned_at?: string | Date | null;
  bannedAt?: string | Date | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  reason?: string | null;
  actor_email?: string | null;
  actorEmail?: string | null;
  profile_name?: string | null;
  profileName?: string | null;
  is_banned_now?: boolean | null;
  isBannedNow?: boolean | null;
};

type ProfileRow = ({ id?: string | null } & JsonRecord) | null;

type BlockedPayloadRow = JsonRecord;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const MAX_FETCH = 500;
const VIEW_NAME = "v_profiles_banned";
const EMAIL_LOOKUP_COLUMNS = ["email", "contact_email", "user_email", "auth_email", "identity"] as const;

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

function safeString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function isoString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.valueOf()) ? trimmed : parsed.toISOString();
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString();
}

function getProfileValue(profile: ProfileRow, keys: string[]): string | null {
  if (!profile) return null;
  const record = profile as JsonRecord;
  for (const key of keys) {
    const candidate = safeString(record[key]);
    if (candidate) return candidate;
  }
  return null;
}

function pickProfileName(profile: ProfileRow): string | null {
  return (
    getProfileValue(profile, [
      "profile_name",
      "profileName",
      "full_name",
      "fullName",
      "display_name",
      "Display name",
      "name",
    ]) ?? null
  );
}

function pickProfileEmail(profile: ProfileRow): string | null {
  return (
    getProfileValue(profile, [
      "email",
      "contact_email",
      "user_email",
      "auth_email",
      "identity",
    ]) ?? null
  );
}

function pickProfilePhone(profile: ProfileRow): string | null {
  return getProfileValue(profile, ["phone", "phone_number", "contact_phone"]);
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
    row.profile_id,
  ];
  for (const value of fields) {
    if (typeof value === "string" && value.trim()) {
      pieces.push(value.trim().toLowerCase());
    }
  }
  return pieces.some((piece) => piece.includes(lowered));
}

function matchesEmails(row: BlockedPayloadRow, emailSet: Set<string>): boolean {
  if (!emailSet.size) return true;
  const candidates = [
    row.email,
    row.contact_email,
    row.user_email,
    row.auth_email,
    row.identity,
  ];
  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (emailSet.has(value.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
}

async function resolveProfileIdsByEmails(emails: string[]): Promise<string[]> {
  const normalized = Array.from(new Set(emails.map((value) => value.trim().toLowerCase()).filter(Boolean)));
  if (!normalized.length) return [];
  const normalizedSet = new Set(normalized);
  const found = new Set<string>();
  const missingColumns = new Set<string>();

  for (const column of EMAIL_LOOKUP_COLUMNS) {
    if (missingColumns.has(column)) continue;
    const filters = normalized.map((email) => `${column}.ilike.${email}`).join(",");
    if (!filters) continue;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`id, ${column}`)
        .or(filters);
      if (error) {
        const message = error.message ?? String(error);
        if (error.code === "42703" || /column .* does not exist/i.test(message)) {
          missingColumns.add(column);
          continue;
        }
        console.warn(`profiles lookup error on ${column}`, message);
        continue;
      }
      if (!Array.isArray(data)) continue;
      for (const row of data) {
        if (!row || typeof row !== "object") continue;
        const id = safeString((row as JsonRecord)["id"]);
        const value = safeString((row as JsonRecord)[column]);
        if (!id || !value) continue;
        if (normalizedSet.has(value.trim().toLowerCase())) {
          found.add(id);
        }
      }
    } catch (err) {
      console.warn(`profiles lookup exception on ${column}`, err);
    }
  }

  return Array.from(found);
}

function isActiveBan(bannedUntil: unknown): boolean {
  if (!bannedUntil) return true;
  if (bannedUntil instanceof Date) {
    return !Number.isNaN(bannedUntil.valueOf()) && bannedUntil.valueOf() > Date.now();
  }
  const iso = isoString(bannedUntil);
  if (!iso) return true;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return true;
  return ts > Date.now();
}

async function fetchViewRows(userIds: string[] | null, limit: number): Promise<ViewRow[]> {
  let query = supabase
    .from(VIEW_NAME)
    .select("*")
    .order("banned_until", { ascending: false })
    .limit(limit);
  if (userIds && userIds.length) {
    query = query.in("profile_id", userIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? String(error));
  }
  if (!Array.isArray(data)) return [];
  return data as ViewRow[];
}

async function fetchProfiles(ids: string[]): Promise<Map<string, JsonRecord>> {
  const map = new Map<string, JsonRecord>();
  const uniqueIds = Array.from(new Set(ids.map((value) => value.trim()).filter((value) => value.length > 0)));
  if (!uniqueIds.length) return map;
  const { data, error } = await supabase.from("profiles").select("*").in("id", uniqueIds);
  if (error) {
    console.warn("profiles lookup error", error.message ?? error);
    return map;
  }
  if (!Array.isArray(data)) return map;
  for (const row of data) {
    if (!row || typeof row !== "object" || !("id" in row)) continue;
    const id = safeString((row as JsonRecord)["id"]);
    if (!id) continue;
    map.set(id, row as JsonRecord);
  }
  return map;
}

function buildPayloadRow(row: ViewRow, profile: ProfileRow): BlockedPayloadRow | null {
  const idCandidate = row.profile_id ?? row.profileId;
  if (!idCandidate) return null;
  const userId = String(idCandidate);
  const profileRecord = profile as JsonRecord | null;
  const rowRecord = row as JsonRecord;

  const profileName = pickProfileName(profile) ??
    safeString(rowRecord["profile_name"]) ??
    safeString(rowRecord["profileName"]);
  const profileEmail = pickProfileEmail(profile);
  const profilePhone = pickProfilePhone(profile);
  const rowEmail = safeString(rowRecord["email"]) ?? null;

  const bannedAt =
    isoString(row.banned_at ?? row.bannedAt ?? row.created_at ?? row.createdAt) ?? null;
  const bannedUntil = isoString(row.banned_until ?? row.bannedUntil) ?? null;
  const updatedAt = isoString(bannedAt ?? bannedUntil ?? rowRecord["updated_at"] ?? rowRecord["updatedAt"]) ?? null;

  const contactEmail = profileRecord ? safeString(profileRecord["contact_email"]) : null;
  const userEmail = profileRecord ? safeString(profileRecord["user_email"]) : null;
  const authEmail = profileRecord ? safeString(profileRecord["auth_email"]) : null;
  const identity = profileRecord ? safeString(profileRecord["identity"]) : null;
  const phoneNumber = profileRecord ? safeString(profileRecord["phone_number"]) : null;

  const reason = safeString(row.reason);
  const actorEmail = safeString(row.actor_email ?? row.actorEmail);

  const payload: BlockedPayloadRow = {
    user_id: userId,
    profile_id: userId,
    email: rowEmail ?? profileEmail ?? contactEmail ?? userEmail ?? authEmail ?? identity ?? null,
    contact_email: contactEmail,
    user_email: userEmail,
    auth_email: authEmail,
    identity,
    full_name: profileName,
    profile_name: profileName,
    display_name: profileName,
    name: profileName,
    phone: profilePhone,
    phone_number: phoneNumber ?? profilePhone,
    blocked_at: bannedAt,
    banned_at: bannedAt,
    blocked_until: bannedUntil,
    banned_until: bannedUntil,
    reason,
    actor_email: actorEmail,
    updated_at: updatedAt,
    checked_at: updatedAt,
    source: VIEW_NAME,
    view: VIEW_NAME,
    is_banned_now:
      typeof rowRecord["is_banned_now"] === "boolean"
        ? (rowRecord["is_banned_now"] as boolean)
        : typeof rowRecord["isBannedNow"] === "boolean"
          ? (rowRecord["isBannedNow"] as boolean)
          : isActiveBan(bannedUntil),
  };

  return payload;
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
  const includeExpired = url.searchParams.get("includeExpired") === "true";
  const requestedIds = parseMultiValue(url.searchParams, "userId").map((value) => value.trim()).filter(Boolean);
  const requestedEmails = parseMultiValue(url.searchParams, "email")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const limitParamRaw = Number(url.searchParams.get("limit") ?? "200");
  const effectiveLimit = Number.isFinite(limitParamRaw)
    ? Math.min(Math.max(Math.trunc(limitParamRaw), 1), MAX_FETCH)
    : 200;

  let resolvedEmailIds: string[] = [];
  if (requestedEmails.length) {
    try {
      resolvedEmailIds = await resolveProfileIdsByEmails(requestedEmails);
    } catch (err) {
      console.warn("No se pudieron resolver IDs desde correos", err);
    }
  }
  const lookupIds = Array.from(new Set([...requestedIds, ...resolvedEmailIds]));

  const userFilter = lookupIds.length ? lookupIds : null;
  const fetchLimit = Math.min(
    MAX_FETCH,
    userFilter && userFilter.length > effectiveLimit ? userFilter.length : effectiveLimit,
  );
  let viewRows: ViewRow[] = [];
  try {
    viewRows = await fetchViewRows(userFilter, fetchLimit);
  } catch (err) {
    console.error(
      `${VIEW_NAME} query error`,
      err instanceof Error ? err.message : err,
    );
    return new Response(
      JSON.stringify({
        error: "No se pudo leer la vista v_profiles_banned. Verifica que exista y que el servicio tenga acceso.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const allProfileIds = new Set<string>();
  for (const row of viewRows) {
    const candidate = row.profile_id ?? row.profileId;
    if (candidate) {
      allProfileIds.add(String(candidate));
    }
  }
  requestedIds.forEach((id) => allProfileIds.add(id));
  resolvedEmailIds.forEach((id) => allProfileIds.add(id));

  const profileMap = await fetchProfiles(Array.from(allProfileIds));

  const payloadRows: BlockedPayloadRow[] = [];
  viewRows.forEach((row) => {
    const candidate = row.profile_id ?? row.profileId;
    if (!candidate) return;
    const key = String(candidate);
    const profile = profileMap.get(key) ?? null;
    const mapped = buildPayloadRow(row, profile);
    if (mapped) {
      if (!mapped.email && profile) {
        const fallbackEmail = pickProfileEmail(profile);
        if (fallbackEmail) mapped.email = fallbackEmail;
      }
      payloadRows.push(mapped);
    }
  });

  const emailSet = new Set(requestedEmails);
  const filteredByEmail = payloadRows.filter((row) => matchesEmails(row, emailSet));
  const effectiveRows = emailSet.size ? filteredByEmail : payloadRows;

  const activeFiltered = includeExpired
    ? effectiveRows
    : effectiveRows.filter((row) => isActiveBan(row.blocked_until ?? row.banned_until ?? null));

  const lowered = typeof search === "string" ? search.trim().toLowerCase() : "";
  const searched = lowered ? activeFiltered.filter((row) => matchesSearch(row, lowered)) : activeFiltered;

  searched.sort((a, b) => {
    const untilA = isoString(a.blocked_until ?? a.banned_until);
    const untilB = isoString(b.blocked_until ?? b.banned_until);
    const untilTsA = untilA ? Date.parse(untilA) : Number.POSITIVE_INFINITY;
    const untilTsB = untilB ? Date.parse(untilB) : Number.POSITIVE_INFINITY;
    if (untilTsA !== untilTsB) {
      return untilTsB - untilTsA;
    }
    const sinceA = isoString(a.blocked_at ?? a.banned_at);
    const sinceB = isoString(b.blocked_at ?? b.banned_at);
    const sinceTsA = sinceA ? Date.parse(sinceA) : 0;
    const sinceTsB = sinceB ? Date.parse(sinceB) : 0;
    return sinceTsB - sinceTsA;
  });

  const total = searched.length;
  const sliceLimit = userFilter && userFilter.length > effectiveLimit ? Math.min(MAX_FETCH, userFilter.length) : effectiveLimit;
  const sliced = searched.slice(0, sliceLimit);

  const body = {
    blockedUsers: sliced,
    blockedTotal: total,
    includeExpired,
    query: search,
    source: VIEW_NAME,
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
