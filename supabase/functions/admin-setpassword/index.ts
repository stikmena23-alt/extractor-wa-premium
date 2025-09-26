// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const REV = "admin-setpassword@rev-multi-admin-v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const HARDCODED_ADMIN_EMAILS = new Set([
  "stikmena6@gmail.com",
  "admin.kevinqt@wftools.com",
  "admin.devinsonmq@wftools.com",
  "admin.franciscojm@wftools.com",
]);

function withCORS(handler) {
  const baseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  };

  const wrap = (res) => {
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(baseHeaders)) h.set(k, v);
    h.set("X-Function-Rev", REV);
    return new Response(res.body, {
      status: res.status,
      headers: h,
    });
  };

  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: baseHeaders });
    try {
      return wrap(await handler(req));
    } catch (e) {
      return wrap(
        new Response(String(e?.message ?? e), {
          status: 500,
        }),
      );
    }
  };
}

async function isAdmin(user, srv) {
  if (!user) return false;
  const email = (user.email || "").toLowerCase();
  if (email && HARDCODED_ADMIN_EMAILS.has(email)) return true;

  {
    const { data } = await srv.from("admins").select("id").eq("id", user.id).limit(1);
    if (data && data.length) return true;
  }

  {
    const { data } = await srv.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (data?.role && String(data.role).toLowerCase() === "admin") return true;
  }

  const role = String(user.app_metadata?.role ?? user.user_metadata?.role ?? "")
    .toLowerCase()
    .trim();
  if (role === "admin") return true;
  if (user.user_metadata?.isAdmin === true) return true;
  return false;
}

Deno.serve(withCORS(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "1") {
    return new Response(
      JSON.stringify({
        ok: true,
        rev: REV,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { userId, password } = await req.json();
  if (typeof password !== "string" || password.length < 12) {
    return new Response("Password demasiado corta (mínimo 12)", { status: 400 });
  }

  const authSb = createClient(SUPABASE_URL, ANON, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
  const {
    data: { user },
  } = await authSb.auth.getUser();

  const srv = createClient(SUPABASE_URL, SRV);
  if (!(await isAdmin(user, srv))) return new Response("Forbidden", { status: 403 });

  const { error } = await srv.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) return new Response(error.message, { status: 400 });

  return new Response(
    JSON.stringify({
      ok: true,
      rev: REV,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}));
