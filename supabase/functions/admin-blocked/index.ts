import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

type BlockRow = {
  user_id?: string;
  userId?: string;
  profile_id?: string;
  profileId?: string;
  uid?: string;
  id?: string;
  email?: string;
  user_email?: string;
  contact_email?: string;
  full_name?: string;
  display_name?: string;
  name?: string;
  blocked_at?: string | Date | null;
  blocked_until?: string | Date | null;
  reason?: string | null;
  note?: string | null;
  detail?: string | null;
  motive?: string | null;
  notes?: string | null;
  source?: string | null;
};

type NormalizedBlock = {
  user_id: string;
  email: string | null;
  name: string | null;
  blocked_at: string | null;
  blocked_until: string | null;
  reason: string | null;
  source: string;
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
    entry.id;
  if (!id) return null;

  const email =
    entry.email ||
    entry.user_email ||
    entry.contact_email ||
    null;
  const name =
    entry.full_name ||
    entry.display_name ||
    entry.name ||
    null;
  const since =
    parseDate(entry.blocked_at) ||
    parseDate((entry as Record<string, unknown>)["blockedAt"]);
  const until =
    parseDate(entry.blocked_until) ||
    parseDate((entry as Record<string, unknown>)["blockedUntil"]);
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
    name: name ? String(name) : null,
    blocked_at: since ? since.toISOString() : null,
    blocked_until: until ? until.toISOString() : null,
    reason: reason ? String(reason) : null,
    source: entry.source ? String(entry.source) : fallbackSource,
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

async function fetchViaRpc(userIds: string[] | null): Promise<NormalizedBlock[] | null> {
  const payload = userIds && userIds.length ? { user_ids: userIds } : { user_ids: null };
  const { data, error } = await supabase.rpc("admin_list_active_blocks", payload as Record<string, unknown>);
  if (error || !Array.isArray(data)) {
    console.warn("admin_list_active_blocks RPC fallback", error?.message || error);
    return null;
  }
  const normalized: NormalizedBlock[] = [];
  for (const row of data as BlockRow[]) {
    const mapped = normalizeRecord(row, "rpc");
    if (mapped) normalized.push(mapped);
  }
  return normalized;
}

async function fetchFromProfiles(userIds: string[] | null): Promise<NormalizedBlock[]> {
  let query = supabase.from("profiles").select("*");
  if (userIds && userIds.length) {
    query = query.in("id", userIds);
  }
  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    console.error("profiles fallback error", error?.message || error);
    return [];
  }
  const results: NormalizedBlock[] = [];
  for (const row of data as Record<string, unknown>[]) {
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

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "GET" } });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const includeExpired = url.searchParams.get("includeExpired") === "true";
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 500) : 200;
  const idParams = url.searchParams.getAll("userId").map((value) => value.trim()).filter(Boolean);
  const userIds = idParams.length ? Array.from(new Set(idParams)) : null;

  let data = await fetchViaRpc(userIds);
  let source = "rpc";
  if (!data) {
    data = await fetchFromProfiles(userIds);
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
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
