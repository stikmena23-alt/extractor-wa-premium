import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type BlockRow = {
  user_id?: string;
  userId?: string;
  profile_id?: string;
  profileId?: string;
  uid?: string;
  id?: string;
  user?: string;
  email?: string;
  user_email?: string;
  contact_email?: string;
  auth_email?: string;
  authEmail?: string;
  identity?: string;
  full_name?: string;
  fullName?: string;
  display_name?: string;
  name?: string;
  profile_name?: string;
  profileName?: string;
  blocked_at?: string | Date | null;
  blocked_until?: string | Date | null;
  blockedAt?: string | Date | null;
  blockedUntil?: string | Date | null;
  banned_at?: string | Date | null;
  bannedAt?: string | Date | null;
  banned_until?: string | Date | null;
  bannedUntil?: string | Date | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  reason?: string | null;
  note?: string | null;
  detail?: string | null;
  motive?: string | null;
  notes?: string | null;
  actor_email?: string | null;
  actorEmail?: string | null;
  source?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  phoneNumber?: string | null;
  contact_phone?: string | null;
  contactPhone?: string | null;
  is_banned_now?: boolean;
  isBannedNow?: boolean;
  [key: string]: unknown;
};

type NormalizedBlock = {
  user_id: string;
  email: string | null;
  name: string | null;
  blocked_at: string | null;
  blocked_until: string | null;
  reason: string | null;
  source: string;
  user_email?: string | null;
  contact_email?: string | null;
  auth_email?: string | null;
  identity?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  profile_name?: string | null;
};

type FilterOptions = {
  userIds: string[] | null;
  emails: string[] | null;
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
  if (value instanceof Date) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function normalizeRecord(entry: BlockRow, fallbackSource: string): NormalizedBlock | null {
  if (!entry || typeof entry !== "object") return null;
  const id =
    entry.user_id ||
    entry.userId ||
    entry.profile_id ||
    entry.profileId ||
    entry.uid ||
    entry.id ||
    entry.user;
  if (!id) return null;

  const contactEmail = entry.contact_email || entry.contactEmail || null;
  const userEmail = entry.user_email || entry.userEmail || null;
  const authEmail = entry.auth_email || entry.authEmail || null;
  const identity = entry.identity || null;
  const email = entry.email || userEmail || contactEmail || authEmail || identity || null;
  const displayName =
    entry.full_name ||
    entry.fullName ||
    entry.display_name ||
    entry.profile_name ||
    entry.profileName ||
    entry.name ||
    null;
  const since =
    parseDate(entry.blocked_at) ||
    parseDate(entry.blockedAt) ||
    parseDate(entry.banned_at) ||
    parseDate(entry.bannedAt) ||
    parseDate(entry.created_at) ||
    parseDate(entry.createdAt);
  const until =
    parseDate(entry.blocked_until) ||
    parseDate(entry.blockedUntil) ||
    parseDate(entry.banned_until) ||
    parseDate(entry.bannedUntil);
  const reason =
    entry.reason ||
    entry.note ||
    entry.detail ||
    entry.motive ||
    entry.notes ||
    null;

  return {
    user_id: String(id),
    email: email ? String(email) : null,
    name: displayName ? String(displayName) : null,
    blocked_at: since ? since.toISOString() : null,
    blocked_until: until ? until.toISOString() : null,
    reason: reason ? String(reason) : null,
    source: entry.source ? String(entry.source) : fallbackSource,
    user_email: userEmail ? String(userEmail) : null,
    contact_email: contactEmail ? String(contactEmail) : null,
    auth_email: authEmail ? String(authEmail) : null,
    identity: identity ? String(identity) : null,
    phone:
      (entry.phone as string | undefined | null) ||
      (entry.phone_number as string | undefined | null) ||
      (entry.phoneNumber as string | undefined | null) ||
      (entry.contact_phone as string | undefined | null) ||
      (entry.contactPhone as string | undefined | null) ||
      null,
    phone_number:
      (entry.phone_number as string | undefined | null) ||
      (entry.phoneNumber as string | undefined | null) ||
      null,
    profile_name: displayName ? String(displayName) : null,
  };
}

function filterActive(records: NormalizedBlock[], includeExpired: boolean): NormalizedBlock[] {
  if (includeExpired) return records;
  const now = Date.now();
  return records.filter((record) => {
    if (!record.blocked_until) return true;
    const until = Date.parse(record.blocked_until);
    if (Number.isNaN(until)) return true;
    return until > now;
  });
}

function applySearch(records: NormalizedBlock[], term: string | null): NormalizedBlock[] {
  if (!term) return records;
  const value = term.trim().toLowerCase();
  if (!value) return records;
  return records.filter((record) => {
    const haystack = [record.email, record.name, record.user_id]
      .filter(Boolean)
      .map((piece) => piece!.toLowerCase())
      .join(" ");
    return haystack.includes(value);
  });
}

function sortBlocks(records: NormalizedBlock[]): NormalizedBlock[] {
  const copy = [...records];
  copy.sort((a, b) => {
    const untilA = a.blocked_until ? Date.parse(a.blocked_until) : Number.POSITIVE_INFINITY;
    const untilB = b.blocked_until ? Date.parse(b.blocked_until) : Number.POSITIVE_INFINITY;
    if (untilA !== untilB) {
      return untilB - untilA;
    }
    const sinceA = a.blocked_at ? Date.parse(a.blocked_at) : 0;
    const sinceB = b.blocked_at ? Date.parse(b.blocked_at) : 0;
    return sinceB - sinceA;
  });
  return copy;
}

function parseMultiValue(params: URLSearchParams, key: string): string[] {
  const collected = new Set<string>();
  const values = params.getAll(key);
  for (const raw of values) {
    if (!raw) continue;
    const pieces = raw
      .split(",")
      .map((piece) => piece.trim())
      .filter(Boolean);
    for (const piece of pieces) {
      collected.add(piece);
    }
  }
  return Array.from(collected);
}

async function resolveProfileIdsByEmails(emails: string[]): Promise<string[]> {
  const normalized = Array.from(
    new Set(
      emails
        .map((value) => value.trim())
        .filter(Boolean)
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

  let query = supabase
    .from("profiles")
    .select("id, email, contact_email, user_email, auth_email, identity");
  if (orFilters.length) {
    query = query.or(orFilters.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.warn("profiles email lookup error", error.message ?? error);
    return [];
  }

  if (!Array.isArray(data)) return [];

  const candidates = new Set<string>();
  for (const row of data as BlockRow[]) {
    const idCandidate = row.id;
    if (!idCandidate) continue;
    const id = String(idCandidate);
    const emailCandidates = [
      row.email,
      row.contact_email,
      row.user_email,
      row.auth_email,
      row.identity,
    ]
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase());
    if (emailCandidates.some((value) => normalized.includes(value))) {
      candidates.add(id);
    }
  }

  return Array.from(candidates);
}

async function hydrateViewEntries(entries: BlockRow[]): Promise<BlockRow[]> {
  if (!Array.isArray(entries) || !entries.length) return entries;

  const needProfileInfo = entries.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const hasEmail =
      entry.email ||
      entry.user_email ||
      entry.contact_email ||
      entry.auth_email ||
      entry.authEmail ||
      entry.identity;
    const hasPhone = entry.phone || entry.phone_number || entry.phoneNumber || entry.contact_phone || entry.contactPhone;
    const hasName =
      entry.full_name ||
      entry.fullName ||
      entry.display_name ||
      entry.profile_name ||
      entry.profileName ||
      entry.name;
    return !hasEmail || !hasPhone || !hasName;
  });

  if (!needProfileInfo.length) return entries;

  const ids = Array.from(
    new Set(
      needProfileInfo
        .map((entry) =>
          entry.profile_id ||
          entry.profileId ||
          entry.user_id ||
          entry.userId ||
          entry.uid ||
          entry.id,
        )
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );

  if (!ids.length) return entries;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, user_email, contact_email, auth_email, identity, phone_number, phone, full_name, display_name, \"Display name\"",
    )
    .in("id", ids);

  if (error) {
    console.warn("profiles hydrate error", error.message ?? error);
    return entries;
  }

  if (!Array.isArray(data) || !data.length) return entries;

  const profileMap = new Map<string, BlockRow>(
    (data as BlockRow[]).map((row) => [String(row.id), row]),
  );

  needProfileInfo.forEach((entry) => {
    const key =
      entry.profile_id ||
      entry.profileId ||
      entry.user_id ||
      entry.userId ||
      entry.uid ||
      entry.id;
    if (!key) return;
    const profile = profileMap.get(String(key));
    if (!profile) return;

    const displayName =
      profile.profile_name ||
      profile.profileName ||
      profile.full_name ||
      profile.fullName ||
      profile.display_name ||
      profile.name ||
      (profile["Display name"] as string | undefined) ||
      null;
    if (displayName) {
      if (!entry.profile_name) entry.profile_name = displayName;
      if (!entry.full_name) entry.full_name = displayName;
      if (!entry.display_name) entry.display_name = displayName;
      if (!entry.name) entry.name = displayName;
    }

    const resolvedEmail =
      entry.email ||
      entry.user_email ||
      entry.contact_email ||
      entry.auth_email ||
      entry.authEmail ||
      entry.identity;

    if (!resolvedEmail) {
      entry.contact_email = (profile.contact_email as string | null | undefined) ?? entry.contact_email ?? null;
      entry.user_email =
        (profile.user_email as string | null | undefined) ||
        (profile.email as string | null | undefined) ||
        entry.user_email ||
        null;
      entry.auth_email = (profile.auth_email as string | null | undefined) ?? entry.auth_email ?? null;
      entry.identity = (profile.identity as string | null | undefined) ?? entry.identity ?? null;
      entry.email =
        (profile.email as string | null | undefined) ||
        (profile.contact_email as string | null | undefined) ||
        (profile.user_email as string | null | undefined) ||
        (profile.auth_email as string | null | undefined) ||
        (profile.identity as string | null | undefined) ||
        null;
    }

    if (!entry.phone && !entry.phone_number && !entry.phoneNumber && !entry.contact_phone && !entry.contactPhone) {
      entry.phone_number =
        (profile.phone_number as string | null | undefined) ||
        (profile.phone as string | null | undefined) ||
        entry.phone_number ||
        null;
    }
  });

  return entries;
}

async function fetchFromView(filter: FilterOptions): Promise<NormalizedBlock[] | null> {
  const ids = Array.from(new Set(filter.userIds ?? []));
  const emails = Array.from(
    new Set((filter.emails ?? []).map((value) => value.trim()).filter(Boolean)),
  );

  let resolvedIds = [...ids];
  if (emails.length) {
    try {
      const extraIds = await resolveProfileIdsByEmails(emails);
      if (extraIds.length) {
        resolvedIds = Array.from(new Set([...resolvedIds, ...extraIds]));
      }
    } catch (lookupError) {
      console.warn("No se pudieron resolver IDs desde correos", lookupError);
    }
  }

  let query = supabase.from("v_profiles_banned").select("*");
  if (resolvedIds.length) {
    query = query.in("profile_id", resolvedIds);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("v_profiles_banned view error", error.message ?? error);
    return null;
  }

  if (!Array.isArray(data)) return [];

  let viewRows = await hydrateViewEntries(data as BlockRow[]);

  if (emails.length && !ids.length) {
    const emailSet = new Set(emails.map((value) => value.toLowerCase()));
    viewRows = viewRows.filter((row) => {
      const candidates = [
        row.email,
        row.user_email,
        row.contact_email,
        row.auth_email,
        row.authEmail,
        row.identity,
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase());
      return candidates.some((value) => emailSet.has(value));
    });
  }

  const normalized: NormalizedBlock[] = [];
  for (const row of viewRows) {
    const candidate: BlockRow = { ...row };
    const idCandidate =
      candidate.user_id ||
      candidate.profile_id ||
      candidate.profileId ||
      candidate.userId ||
      candidate.uid ||
      candidate.id;
    if (!idCandidate) continue;
    candidate.user_id = String(idCandidate);

    if (!candidate.blocked_at) {
      candidate.blocked_at =
        candidate.banned_at ||
        candidate.bannedAt ||
        candidate.blockedAt ||
        candidate.created_at ||
        candidate.createdAt ||
        null;
    }

    if (!candidate.blocked_until) {
      candidate.blocked_until = candidate.banned_until || candidate.bannedUntil || candidate.blockedUntil || null;
    }

    if (!candidate.source) candidate.source = "view";

    if (!candidate.reason) {
      candidate.reason = candidate.note || candidate.detail || candidate.motive || candidate.notes || null;
    }

    const mapped = normalizeRecord(candidate, "view");
    if (mapped) normalized.push(mapped);
  }

  return normalized;
}

async function fetchFromProfiles(filter: FilterOptions): Promise<NormalizedBlock[]> {
  const ids = Array.from(new Set(filter.userIds ?? []));
  const emails = Array.from(
    new Set((filter.emails ?? []).map((value) => value.trim()).filter(Boolean)),
  );

  let query = supabase.from("profiles").select("*");
  if (ids.length) {
    query = query.in("id", ids);
  } else if (emails.length) {
    const orFilters: string[] = [];
    for (const email of emails) {
      orFilters.push(`email.ilike.${email}`);
      orFilters.push(`contact_email.ilike.${email}`);
      orFilters.push(`user_email.ilike.${email}`);
      orFilters.push(`auth_email.ilike.${email}`);
      orFilters.push(`identity.ilike.${email}`);
    }
    if (orFilters.length) {
      query = query.or(orFilters.join(","));
    }
  }
  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    console.error("profiles fallback error", error?.message || error);
    return [];
  }
  const results: NormalizedBlock[] = [];
  const emailSet = new Set(emails.map((value) => value.toLowerCase()));
  for (const row of data as Record<string, unknown>[]) {
    if (emailSet.size) {
      const candidates = [
        row["email"],
        row["contact_email"],
        row["user_email"],
        row["auth_email"],
        row["identity"],
      ]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase());
      if (!candidates.some((value) => emailSet.has(value))) {
        continue;
      }
    }
    const mapped = normalizeRecord(
      {
        id: row["id"] as string | undefined,
        email: (row["contact_email"] as string | undefined) || (row["email"] as string | undefined) || null,
        full_name: (row["full_name"] as string | undefined) || (row["display_name"] as string | undefined) || null,
        blocked_at: row["blocked_at"] as string | undefined,
        blocked_until: row["blocked_until"] as string | undefined,
        reason: (row["block_reason"] as string | undefined) || null,
        source: "profiles",
      },
      "profiles",
    );
    if (mapped) results.push(mapped);
  }
  return results;
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
      headers: { ...corsHeaders, "Allow": "GET" },
    });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const includeExpired = url.searchParams.get("includeExpired") === "true";
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 200;
  const userIds = (() => {
    const values = parseMultiValue(url.searchParams, "userId");
    return values.length ? values : null;
  })();
  const emails = (() => {
    const values = parseMultiValue(url.searchParams, "email").map((value) => value.toLowerCase());
    return values.length ? values : null;
  })();

  const filters: FilterOptions = { userIds, emails };

  let data = await fetchFromView(filters);
  let source = "view";
  if (!data) {
    data = await fetchFromProfiles(filters);
    source = "profiles";
  }

  const active = filterActive(data ?? [], includeExpired);
  const filtered = applySearch(active, search);
  const ordered = sortBlocks(filtered);
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
