import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type BlockRow = {
  user_id?: string | null;
  userId?: string | null;
  profile_id?: string | null;
  profileId?: string | null;
  uid?: string | null;
  id?: string | null;
  user?: string | null;
  email?: string | null;
  user_email?: string | null;
  userEmail?: string | null;
  contact_email?: string | null;
  contactEmail?: string | null;
  auth_email?: string | null;
  authEmail?: string | null;
  identity?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  name?: string | null;
  profile_name?: string | null;
  profileName?: string | null;
  blocked_at?: string | Date | null;
  blockedAt?: string | Date | null;
  blocked_until?: string | Date | null;
  blockedUntil?: string | Date | null;
  banned_at?: string | Date | null;
  bannedAt?: string | Date | null;
  banned_until?: string | Date | null;
  bannedUntil?: string | Date | null;
  ban_duration?: string | null;
  banDuration?: string | null;
  action?: string | null;
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
  is_banned_now?: boolean | null;
  isBannedNow?: boolean | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  updated_at?: string | Date | null;
  updatedAt?: string | Date | null;
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

const EMAIL_KEYS = [
  "email",
  "user_email",
  "useremail",
  "contact_email",
  "contactemail",
  "auth_email",
  "authemail",
  "identity",
  "correo",
  "correo_electronico",
  "correo-electronico",
  "correo_electrónico",
  "correo-electrónico",
];
const EMAIL_PATTERNS = [/email/, /correo/, /identity/];
const NAME_KEYS = [
  "full_name",
  "fullname",
  "display_name",
  "displayname",
  "profile_name",
  "profilename",
  "name",
  "display name",
  "nombre",
  "nombre_completo",
  "nombre completo",
  "Display name",
];
const NAME_PATTERNS = [/name/, /nombre/, /alias/];
const PHONE_KEYS = [
  "phone",
  "phone_number",
  "phonenumber",
  "contact_phone",
  "contactphone",
  "telefono",
  "teléfono",
  "celular",
  "mobile",
  "whatsapp",
];
const PHONE_PATTERNS = [/phone/, /tel/, /cel/, /movil/, /móvil/, /whatsapp/];

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.valueOf()) ? null : value;
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

function getUserId(entry: BlockRow | Record<string, unknown>): string | null {
  const candidate =
    (entry.user_id as string | null | undefined) ||
    (entry.userId as string | null | undefined) ||
    (entry.profile_id as string | null | undefined) ||
    (entry.profileId as string | null | undefined) ||
    (entry.uid as string | null | undefined) ||
    (entry.id as string | null | undefined) ||
    (entry.user as string | null | undefined);
  return candidate ? String(candidate) : null;
}

function collectStrings(
  source: Record<string, unknown>,
  candidates: string[],
  patterns: RegExp[] = [],
): string[] {
  const results: string[] = [];
  const seen = new Set<string>();
  const loweredCandidates = new Set(candidates.map((key) => key.toLowerCase()));

  const tryAdd = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    results.push(trimmed);
  };

  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      tryAdd(source[key]);
    }
  }

  for (const key of Object.keys(source)) {
    const lowerKey = key.toLowerCase();
    if (loweredCandidates.has(lowerKey) || patterns.some((pattern) => pattern.test(lowerKey))) {
      tryAdd(source[key]);
    }
  }

  return results;
}

function extractFirstString(
  source: Record<string, unknown>,
  candidates: string[],
  patterns: RegExp[] = [],
): string | null {
  const values = collectStrings(source, candidates, patterns);
  return values.length ? values[0] : null;
}

function getEmailCandidates(entry: BlockRow): string[] {
  const base = collectStrings(entry, EMAIL_KEYS, EMAIL_PATTERNS);
  if (entry.identity && typeof entry.identity === "string") {
    const identity = entry.identity.trim();
    if (identity && !base.some((value) => value.toLowerCase() === identity.toLowerCase())) {
      base.push(identity);
    }
  }
  return base;
}

function hasName(entry: BlockRow): boolean {
  return extractFirstString(entry, NAME_KEYS, NAME_PATTERNS) !== null;
}

function hasPhone(entry: BlockRow): boolean {
  const phoneValues = collectStrings(entry, PHONE_KEYS, PHONE_PATTERNS);
  return phoneValues.length > 0;
}

function normalizeRecord(entry: BlockRow, fallbackSource: string): NormalizedBlock | null {
  if (!entry || typeof entry !== "object") return null;
  const id = getUserId(entry);
  if (!id) return null;

  const emailCandidates = getEmailCandidates(entry);
  const nameCandidate = extractFirstString(entry, NAME_KEYS, NAME_PATTERNS);
  const sinceCandidate =
    parseDate(entry.blocked_at) ||
    parseDate(entry.blockedAt) ||
    parseDate(entry.banned_at) ||
    parseDate(entry.bannedAt) ||
    parseDate(entry.created_at) ||
    parseDate(entry.createdAt) ||
    null;
  const untilCandidate =
    parseDate(entry.blocked_until) ||
    parseDate(entry.blockedUntil) ||
    parseDate(entry.banned_until) ||
    parseDate(entry.bannedUntil) ||
    null;
  const reasonCandidate =
    extractFirstString(entry, ["reason", "note", "detail", "motive", "notes"], []) || null;

  const phoneValues = collectStrings(entry, PHONE_KEYS, PHONE_PATTERNS);
  const phoneNumberValues = collectStrings(entry, ["phone_number", "phonenumber"], PHONE_PATTERNS);

  return {
    user_id: id,
    email: emailCandidates.length ? emailCandidates[0] : null,
    name: nameCandidate ? String(nameCandidate) : null,
    blocked_at: sinceCandidate ? sinceCandidate.toISOString() : null,
    blocked_until: untilCandidate ? untilCandidate.toISOString() : null,
    reason: reasonCandidate,
    source: entry.source && typeof entry.source === "string" && entry.source.trim()
      ? String(entry.source)
      : fallbackSource,
    user_email: extractFirstString(entry, ["user_email", "useremail"], []),
    contact_email: extractFirstString(entry, ["contact_email", "contactemail"], []),
    auth_email: extractFirstString(entry, ["auth_email", "authemail"], []),
    identity: extractFirstString(entry, ["identity"], []),
    phone: phoneValues.length ? phoneValues[0] : null,
    phone_number: phoneNumberValues.length ? phoneNumberValues[0] : null,
    profile_name: nameCandidate ? String(nameCandidate) : null,
  };
}

function filterActive(records: NormalizedBlock[], includeExpired: boolean): NormalizedBlock[] {
  if (includeExpired) return records;
  const now = Date.now();
  return records.filter((record) => {
    if (!record.blocked_until) return false;
    const lower = record.blocked_until.toLowerCase?.() ?? "";
    if (lower === "infinity") return true;
    const until = Date.parse(record.blocked_until);
    if (Number.isNaN(until)) return false;
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
    const untilA = a.blocked_until ? Date.parse(a.blocked_until) : Number.NEGATIVE_INFINITY;
    const untilB = b.blocked_until ? Date.parse(b.blocked_until) : Number.NEGATIVE_INFINITY;
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

async function hydrateEntries(entries: BlockRow[]): Promise<BlockRow[]> {
  if (!Array.isArray(entries) || !entries.length) return entries;

  const ids = Array.from(new Set(entries.map((entry) => getUserId(entry)).filter(Boolean))) as string[];
  if (!ids.length) return entries;

  let profileMap = new Map<string, Record<string, unknown>>();
  try {
    const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
    if (error) {
      console.warn("profiles hydrate error", error.message ?? error);
    } else if (Array.isArray(data)) {
      profileMap = new Map(
        data
          .map((row) => {
            const profileId = getUserId(row as BlockRow);
            return profileId ? [profileId, row as Record<string, unknown>] : null;
          })
          .filter((pair): pair is [string, Record<string, unknown>] => Array.isArray(pair)),
      );
    }
  } catch (err) {
    console.warn("profiles hydrate exception", err);
  }

  for (const entry of entries) {
    const id = getUserId(entry);
    if (!id) continue;
    const profile = profileMap.get(id);
    if (!profile) continue;

    if (!hasName(entry)) {
      const profileName = extractFirstString(profile, NAME_KEYS, NAME_PATTERNS);
      if (profileName) {
        entry.profile_name = entry.profile_name ?? profileName;
        entry.full_name = entry.full_name ?? profileName;
        entry.display_name = entry.display_name ?? profileName;
        entry.name = entry.name ?? profileName;
      }
    }

    const existingEmails = getEmailCandidates(entry);
    if (!existingEmails.length) {
      const profileEmails = collectStrings(profile, EMAIL_KEYS, EMAIL_PATTERNS);
      if (profileEmails.length) {
        const emailValue = profileEmails[0];
        entry.email = entry.email ?? emailValue;
        entry.user_email = entry.user_email ?? extractFirstString(profile, ["user_email", "useremail"], []);
        entry.contact_email = entry.contact_email ?? extractFirstString(profile, ["contact_email", "contactemail"], []);
        entry.auth_email = entry.auth_email ?? extractFirstString(profile, ["auth_email", "authemail"], []);
        entry.identity = entry.identity ?? extractFirstString(profile, ["identity"], []);
      }
    }

    if (!hasPhone(entry)) {
      const profilePhones = collectStrings(profile, PHONE_KEYS, PHONE_PATTERNS);
      if (profilePhones.length) {
        entry.phone = entry.phone ?? profilePhones[0];
        entry.phone_number = entry.phone_number ?? extractFirstString(profile, ["phone_number", "phonenumber"], PHONE_PATTERNS);
      }
    }
  }

  const missingEmailEntries = entries.filter((entry) => getEmailCandidates(entry).length === 0);
  for (const entry of missingEmailEntries) {
    const id = getUserId(entry);
    if (!id) continue;
    try {
      const { data, error } = await supabase.auth.admin.getUserById(id);
      if (error || !data?.user) {
        if (error) {
          console.warn("auth user lookup error", error.message ?? error);
        }
        continue;
      }
      const user = data.user;
      if (!entry.email && user.email) {
        entry.email = user.email;
        entry.user_email = entry.user_email ?? user.email;
      }
      const metaSources = [user.user_metadata, user.app_metadata].filter(
        (value): value is Record<string, unknown> => value != null && typeof value === "object",
      );
      for (const meta of metaSources) {
        if (!hasName(entry)) {
          const metaName = extractFirstString(meta, NAME_KEYS, NAME_PATTERNS);
          if (metaName) {
            entry.profile_name = entry.profile_name ?? metaName;
            entry.full_name = entry.full_name ?? metaName;
            entry.display_name = entry.display_name ?? metaName;
            entry.name = entry.name ?? metaName;
          }
        }
        if (!entry.contact_email) {
          const contactEmail = extractFirstString(meta, ["contact_email", "contactemail"], EMAIL_PATTERNS);
          if (contactEmail) entry.contact_email = contactEmail;
        }
        if (!entry.auth_email) {
          const authEmail = extractFirstString(meta, ["auth_email", "authemail"], EMAIL_PATTERNS);
          if (authEmail) entry.auth_email = authEmail;
        }
        if (!entry.identity) {
          const identity = extractFirstString(meta, ["identity"], []);
          if (identity) entry.identity = identity;
        }
        if (!hasPhone(entry)) {
          const metaPhone = extractFirstString(meta, PHONE_KEYS, PHONE_PATTERNS);
          if (metaPhone) {
            entry.phone = entry.phone ?? metaPhone;
            entry.phone_number = entry.phone_number ?? metaPhone;
          }
        }
        if (!entry.email) {
          const metaEmail = extractFirstString(meta, EMAIL_KEYS, EMAIL_PATTERNS);
          if (metaEmail) {
            entry.email = metaEmail;
            entry.user_email = entry.user_email ?? metaEmail;
          }
        }
      }
    } catch (err) {
      console.warn("auth user lookup exception", err);
    }
  }

  return entries;
}

function ensureBlockedMetadata(entry: BlockRow, fallbackSource: string): BlockRow {
  const copy: BlockRow = { ...entry };
  const id = getUserId(copy);
  if (id) copy.user_id = id;
  if (!copy.blocked_at) {
    const since =
      parseDate(copy.blockedAt) ||
      parseDate(copy.banned_at) ||
      parseDate(copy.bannedAt) ||
      parseDate(copy.created_at) ||
      parseDate(copy.createdAt);
    if (since) copy.blocked_at = since.toISOString();
  } else {
    const since = parseDate(copy.blocked_at);
    if (since) copy.blocked_at = since.toISOString();
  }
  if (!copy.blocked_until) {
    const until =
      parseDate(copy.blockedUntil) ||
      parseDate(copy.banned_until) ||
      parseDate(copy.bannedUntil);
    if (until) copy.blocked_until = until.toISOString();
  } else {
    const until = parseDate(copy.blocked_until);
    if (until) copy.blocked_until = until.toISOString();
  }
  if (!copy.source) copy.source = fallbackSource;
  if (!copy.reason) {
    const reason =
      extractFirstString(copy, ["reason", "note", "detail", "motive", "notes"], []) ||
      null;
    if (reason) copy.reason = reason;
  }
  return copy;
}

async function fetchFromView(filter: FilterOptions): Promise<NormalizedBlock[] | null> {
  const ids = Array.from(new Set(filter.userIds ?? [])).filter(Boolean);
  const emails = Array.from(new Set((filter.emails ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));

  let query = supabase.from("v_profiles_banned").select("*");
  if (ids.length) {
    query = query.in("profile_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("v_profiles_banned view error", error.message ?? error);
    return null;
  }
  if (!Array.isArray(data)) return [];

  const rows = data.map((row) => ensureBlockedMetadata(row as BlockRow, "view"));
  await hydrateEntries(rows);

  let filteredRows = rows;
  if (!ids.length && emails.length) {
    const emailSet = new Set(emails);
    filteredRows = rows.filter((row) =>
      getEmailCandidates(row).some((value) => emailSet.has(value.toLowerCase())),
    );
  }

  const normalized: NormalizedBlock[] = [];
  for (const row of filteredRows) {
    const mapped = normalizeRecord(row, "view");
    if (mapped) normalized.push(mapped);
  }
  return normalized;
}

async function fetchFromLog(filter: FilterOptions): Promise<NormalizedBlock[]> {
  const ids = Array.from(new Set(filter.userIds ?? [])).filter(Boolean);
  const emails = Array.from(new Set((filter.emails ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));

  let query = supabase
    .from("admin_ban_log")
    .select("user_id, action, ban_duration, banned_until, reason, actor_email, created_at")
    .order("created_at", { ascending: false });
  if (ids.length) {
    query = query.in("user_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("admin_ban_log fallback error", error.message ?? error);
    return [];
  }
  if (!Array.isArray(data) || !data.length) return [];

  const latestByUser = new Map<string, BlockRow>();
  for (const raw of data as BlockRow[]) {
    const id = getUserId(raw);
    if (!id || latestByUser.has(id)) continue;
    latestByUser.set(id, { ...raw });
  }

  const now = Date.now();
  const activeRows: BlockRow[] = [];
  for (const [id, row] of latestByUser.entries()) {
    const action = typeof row.action === "string" ? row.action.toLowerCase() : null;
    if (action !== "ban") continue;
    const until =
      parseDate(row.banned_until) ||
      parseDate(row.bannedUntil) ||
      parseDate(row.blocked_until) ||
      parseDate(row.blockedUntil);
    if (!until || Number.isNaN(until.valueOf()) || until.getTime() <= now) continue;
    const since =
      parseDate(row.blocked_at) ||
      parseDate(row.blockedAt) ||
      parseDate(row.banned_at) ||
      parseDate(row.bannedAt) ||
      parseDate(row.created_at) ||
      parseDate(row.createdAt) ||
      new Date();
    activeRows.push({
      ...row,
      user_id: id,
      blocked_at: since.toISOString(),
      blocked_until: until.toISOString(),
      source: row.source && typeof row.source === "string" && row.source.trim() ? row.source : "admin_ban_log",
    });
  }

  if (!activeRows.length) return [];

  await hydrateEntries(activeRows);

  let filteredRows = activeRows;
  if (emails.length) {
    const emailSet = new Set(emails);
    filteredRows = activeRows.filter((row) =>
      getEmailCandidates(row).some((value) => emailSet.has(value.toLowerCase())),
    );
  }

  const normalized: NormalizedBlock[] = [];
  for (const row of filteredRows) {
    const mapped = normalizeRecord(row, "admin_ban_log");
    if (mapped) normalized.push(mapped);
  }
  return normalized;
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
    data = await fetchFromLog(filters);
    source = "admin_ban_log";
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
