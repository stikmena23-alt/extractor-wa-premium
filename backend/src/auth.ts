import type { SupabaseServiceClient } from "./supabase.ts";

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.*)$/i);
  return match ? match[1].trim() || null : null;
}

export async function identifyActor(client: SupabaseServiceClient, request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return { id: null as string | null, email: null as string | null };
  }
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      if (error) {
        console.warn("identifyActor error:", error.message ?? error);
      }
      return { id: null, email: null };
    }
    return { id: data.user.id ?? null, email: data.user.email ?? null };
  } catch (err) {
    console.warn("identifyActor exception:", err);
    return { id: null, email: null };
  }
}
