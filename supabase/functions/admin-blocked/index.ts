import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type RawBanRow = {
  profile_id: string;
  profile_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  contact_email?: string | null;
  user_email?: string | null;
  auth_email?: string | null;
  identity?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  banned_at?: string | Date | null;
  banned_until?: string | Date | null;
  reason?: string | null;
  actor_email?: string | null;
  updated_at?: string | Date | null;
  source: "v_profiles_banned" | "banned_users";
};

type NormalizedBanRow = {
  user_id: string;
  profile_id: string;
  email: string | null;
  user_email: string | null;
  contact_email: string | null;
  auth_email: string | null;
  identity: string | null;
  full_name: string | null;
  display_name: string | null;
  profile_name: string | null;
  phone: string | null;
  phone_number: string | null;
  blocked_at: string | null;
  blocked_until: string | null;
  banned_at: string | null;
  banned_until: string | null;
  updated_at: string | null;
  checked_at: string | null;
  reason: string | null;
  actor_email: string | null;
  is_banned_now: boolean;
  source: "v_profiles_banned" | "banned_users";
};

type FilterOptions = {
  userIds: string[];
  emails: string[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === "infinity") {
      return new Date(8640000000000000);
    }
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function formatDate(value: unknown): string | null {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function isActiveUntil(value: unknown): boolean {
  const date = parseDate(value);
  if (!date) return false;
  return date.valueOf() === 8640000000000000 || date.getTime() > Date.now();
}

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

async function resolveProfileIdsByEmails(emails: string[]): Promise<string[]> {
  if (!emails.length) return [];
  const normalized = Array.from(
    new Set(
      emails
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .map((value) => value.toLowerCase()),
    ),
  );
  if (!normalized.length) return [];

  const orFilters: string[] = [];
  for (const email of normalized) {
    orFilters.push(`email.ilike.${email}`);
    orFilters.push(`contact_email.ilike.${email}`);
    orFilters.push(`user_email.ilike.${email}`);
    orFilters.push(`auth_email.ilike.${email}`);
    orFilters.push(`identity.ilike.${email}`);
  }

  let query = supabase.from("profiles").select(
    "id, email, contact_email, user_email, auth_email, identity",
  );
  if (orFilters.length) {
    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    console.warn("profiles email lookup error", error?.message ?? error);
    return [];
  }

  const matches: string[] = [];
  for (const row of data) {
    if (!row || !row.id) continue;
    const id = String(row.id);
    const candidates = [row.email, row.contact_email, row.user_email, row.auth_email, row.identity]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase());
    if (candidates.some((value) => normalized.includes(value))) {
      matches.push(id);
    }
  }
  return matches;
}

async function fetchFromView(userIds: string[] | null): Promise<RawBanRow[]> {
  let query = supabase
    .from("v_profiles_banned")
    .select("*")
    .order("banned_until", { ascending: false })
    .limit(500);
  if (userIds && userIds.length) {
    query = query.in("profile_id", userIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? String(error));
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const profileId = row?.profile_id ?? row?.profileId;
      if (!profileId) return null;
      return {
        profile_id: String(profileId),
        profile_name: row?.profile_name ?? row?.profileName ?? null,
        full_name: row?.full_name ?? null,
        email: row?.email ?? null,
        contact_email: row?.contact_email ?? null,
        user_email: row?.user_email ?? null,
        auth_email: row?.auth_email ?? null,
        identity: row?.identity ?? null,
        phone: row?.phone ?? null,
        phone_number: row?.phone_number ?? null,
        banned_at: row?.banned_at ?? row?.created_at ?? null,
        banned_until: row?.banned_until ?? null,
        reason: row?.reason ?? null,
        actor_email: row?.actor_email ?? null,
        updated_at: row?.updated_at ?? null,
        source: "v_profiles_banned" as const,
      } satisfies RawBanRow;
    })
    .filter((row): row is RawBanRow => row !== null);
}

async function fetchFromTable(userIds: string[] | null): Promise<RawBanRow[]> {
  let query = supabase
    .from("banned_users")
    .select("*")
    .order("banned_until", { ascending: false })
    .limit(500);
  if (userIds && userIds.length) {
    query = query.in("user_id", userIds);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message ?? String(error));
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const userId = row?.user_id ?? row?.userId ?? row?.profile_id ?? row?.profileId;
      if (!userId) return null;
      return {
        profile_id: String(userId),
        banned_at: row?.banned_at ?? row?.blocked_at ?? row?.created_at ?? null,
        banned_until: row?.banned_until ?? row?.blocked_until ?? null,
        reason: row?.reason ?? null,
        actor_email: row?.actor_email ?? null,
        updated_at: row?.updated_at ?? null,
        source: "banned_users" as const,
      } satisfies RawBanRow;
    })
    .filter((row): row is RawBanRow => row !== null);
}

async function loadProfiles(ids: string[]): Promise<Map<string, Record<string, unknown>>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      'id, email, contact_email, user_email, auth_email, identity, phone_number, phone, full_name, display_name, "Display name"',
    )
    .in("id", ids);
  if (error || !Array.isArray(data)) {
    console.warn("profiles hydrate error", error?.message ?? error);
    return new Map();
  }
  const map = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    if (!row || !row.id) continue;
    map.set(String(row.id), row as Record<string, unknown>);
  }
  return map;
}

async function hydrateBanRows(rows: RawBanRow[]): Promise<NormalizedBanRow[]> {
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.map((row) => row.profile_id).filter((value) => value)));
  const profileMap = await loadProfiles(ids);

  return rows.map((row) => {
    const profile = profileMap.get(row.profile_id) ?? null;
    const emailCandidates = [
      row.email,
      row.user_email,
      row.contact_email,
      profile?.email,
      profile?.contact_email,
      profile?.user_email,
      profile?.auth_email,
      profile?.identity,
    ];
    const email = emailCandidates.find((value) => typeof value === "string" && value.trim() !== "") ?? null;

    const userEmail = (row.user_email ?? profile?.user_email ?? null) as string | null;
    const contactEmail = (row.contact_email ?? profile?.contact_email ?? null) as string | null;
    const authEmail = (row.auth_email ?? profile?.auth_email ?? null) as string | null;
    const identity = (row.identity ?? profile?.identity ?? null) as string | null;

    const profileNameCandidates = [
      row.profile_name,
      profile?.["Display name"],
      profile?.display_name,
      profile?.full_name,
      row.full_name,
    ];
    const profileName = profileNameCandidates.find((value) => typeof value === "string" && value.trim() !== "") ?? null;

    const fullNameCandidates = [row.full_name, profile?.full_name, profile?.display_name, profile?.["Display name"]];
    const fullName = fullNameCandidates.find((value) => typeof value === "string" && value.trim() !== "") ?? null;

    const displayNameCandidates = [profile?.display_name, profile?.["Display name"], row.profile_name, row.full_name, fullName];
    const displayName = displayNameCandidates.find((value) => typeof value === "string" && value.trim() !== "") ?? null;

    const phoneCandidates = [row.phone, row.phone_number, profile?.phone, profile?.phone_number];
    const phone = phoneCandidates.find((value) => typeof value === "string" && value.trim() !== "") ?? null;
    const phoneNumber = (row.phone_number ?? profile?.phone_number ?? null) as string | null;

    const bannedAtISO = formatDate(row.banned_at ?? row.updated_at);
    const bannedUntilISO = formatDate(row.banned_until);
    const updatedISO = formatDate(row.updated_at ?? row.banned_at ?? row.banned_until);

    return {
      user_id: row.profile_id,
      profile_id: row.profile_id,
      email: email,
      user_email: userEmail,
      contact_email: contactEmail,
      auth_email: authEmail,
      identity,
      full_name: fullName,
      display_name: displayName,
      profile_name: profileName,
      phone,
      phone_number: phoneNumber,
      blocked_at: bannedAtISO,
      banned_at: bannedAtISO,
      blocked_until: bannedUntilISO,
      banned_until: bannedUntilISO,
      updated_at: updatedISO,
      checked_at: updatedISO,
      reason: row.reason ?? null,
      actor_email: row.actor_email ?? null,
      is_banned_now: row.source === "v_profiles_banned" ? true : isActiveUntil(row.banned_until),
      source: row.source,
    } satisfies NormalizedBanRow;
  });
}

function applySearch(records: NormalizedBanRow[], term: string | null): NormalizedBanRow[] {
  if (!term) return records;
  const lowered = term.trim().toLowerCase();
  if (!lowered) return records;
  return records.filter((record) => {
    const haystack = [
      record.email,
      record.user_email,
      record.contact_email,
      record.auth_email,
      record.identity,
      record.full_name,
      record.display_name,
      record.profile_name,
      record.user_id,
    ]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase())
      .join(" ");
    return haystack.includes(lowered);
  });
}

function sortBans(records: NormalizedBanRow[]): NormalizedBanRow[] {
  const copy = [...records];
  copy.sort((a, b) => {
    const untilA = parseDate(a.blocked_until);
    const untilB = parseDate(b.blocked_until);
    if (untilA && untilB && untilA.getTime() !== untilB.getTime()) {
      return untilB.getTime() - untilA.getTime();
    }
    const sinceA = parseDate(a.blocked_at);
    const sinceB = parseDate(b.blocked_at);
    if (sinceA && sinceB && sinceA.getTime() !== sinceB.getTime()) {
      return sinceB.getTime() - sinceA.getTime();
    }
    return a.user_id.localeCompare(b.user_id);
  });
  return copy;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

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
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 200;

  const idParams = parseMultiValue(url.searchParams, "userId").map((value) => value.trim()).filter((value) => value.length > 0);
  const emailParams = parseMultiValue(url.searchParams, "email")
    .map((value) => value.toLowerCase())
    .filter((value) => value.length > 0);

  const filters: FilterOptions = {
    userIds: Array.from(new Set(idParams)),
    emails: Array.from(new Set(emailParams)),
  };

  let resolvedIds = filters.userIds.length ? [...filters.userIds] : [];
  if (filters.emails.length) {
    try {
      const extraIds = await resolveProfileIdsByEmails(filters.emails);
      resolvedIds = Array.from(new Set([...resolvedIds, ...extraIds]));
    } catch (err) {
      console.warn("No se pudieron resolver IDs desde correos", err);
    }
    if (!resolvedIds.length) {
      // Se solicitó por correo pero no se encontró ningún perfil.
      const emptyBody = {
        blockedUsers: [] as NormalizedBanRow[],
        blockedTotal: 0,
        includeExpired,
        query: search,
        source: includeExpired ? "banned_users" : "v_profiles_banned",
        generatedAt: new Date().toISOString(),
      };
      return new Response(JSON.stringify(emptyBody), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  }

  let rawRows: RawBanRow[] = [];
  let source: "v_profiles_banned" | "banned_users" = includeExpired ? "banned_users" : "v_profiles_banned";
  try {
    if (includeExpired) {
      rawRows = await fetchFromTable(resolvedIds.length ? resolvedIds : null);
      source = "banned_users";
    } else {
      rawRows = await fetchFromView(resolvedIds.length ? resolvedIds : null);
      source = "v_profiles_banned";
    }
  } catch (err) {
    console.error("Error consultando usuarios baneados", err);
    return new Response(
      JSON.stringify({ error: "No se pudo leer la lista de usuarios bloqueados" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  let normalized = await hydrateBanRows(rawRows);
  if (!includeExpired) {
    normalized = normalized.filter((row) => row.is_banned_now);
  }

  const searched = applySearch(normalized, search);
  const ordered = sortBans(searched);
  const total = ordered.length;
  const sliced = ordered.slice(0, limit);

  const body = {
    blockedUsers: sliced,
    blockedTotal: total,
    includeExpired,
    query: search,
    source,
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
