import { getRecoveryBaseUrl, getRecoveryExpirationMinutes } from "./config.ts";
import { AppError, NotFoundError, ValidationError } from "./errors.ts";
import { fetchAdminByEmail, normalizeEmail, updateAdminPassword } from "./adminAccounts.ts";
import type { SupabaseServiceClient } from "./supabase.ts";
import { generateRecoveryCode, generateRecoveryToken, sha256 } from "./utils/crypto.ts";

export type RecoveryIssueContext = {
  ip?: string | null;
  userAgent?: string | null;
  origin?: string | null;
  actorEmail?: string | null;
};

export type RecoveryIssueResult = {
  userId: string;
  email: string;
  shortCode: string;
  token: string;
  resetUrl: string;
  expiresAt: string;
};

export async function issueAdminRecovery(
  client: SupabaseServiceClient,
  emailInput: string,
  actorEmail: string | null,
  context: RecoveryIssueContext = {},
): Promise<RecoveryIssueResult> {
  const email = normalizeEmail(emailInput);
  if (!email) {
    throw new ValidationError("invalid-email", "Debes proporcionar un correo válido");
  }
  const user = await fetchAdminByEmail(client, email);
  const now = new Date();
  const expires = new Date(now.getTime() + getRecoveryExpirationMinutes() * 60_000);
  const token = generateRecoveryToken();
  const shortCode = generateRecoveryCode(6);
  const tokenHash = await sha256(token);
  const codeHash = await sha256(shortCode);

  // Limpiar solicitudes anteriores pendientes del mismo usuario
  try {
    await client.from("admin_password_resets").delete().eq("user_id", user.id).is("used_at", null);
  } catch (cleanupError) {
    console.warn("No se pudieron limpiar recuperaciones previas:", cleanupError);
  }

  const metadata: Record<string, unknown> = {
    actorEmail: actorEmail ?? null,
    issuedAt: now.toISOString(),
    origin: context.origin ?? null,
    actorIp: context.ip ?? null,
    actorUserAgent: context.userAgent ?? null,
  };

  const insertPayload = {
    user_id: user.id,
    email,
    token_hash: tokenHash,
    code_hash: codeHash,
    short_code: shortCode,
    actor_email: actorEmail ?? null,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    metadata,
  };

  const { error: insertError } = await client.from("admin_password_resets").insert(insertPayload);
  if (insertError) {
    const code = insertError.code ?? "";
    if (code === "42P01") {
      throw new AppError(
        "recovery-table-missing",
        500,
        "La tabla admin_password_resets no existe en la base de datos",
        insertError.message,
      );
    }
    throw new ValidationError("recovery-insert-error", insertError.message ?? "No se pudo registrar la recuperación");
  }

  const resetUrl = `${getRecoveryBaseUrl()}?token=${encodeURIComponent(token)}`;

  return {
    userId: user.id,
    email,
    shortCode,
    token,
    resetUrl,
    expiresAt: expires.toISOString(),
  };
}

export type RecoveryCompletionParams = {
  email?: string | null;
  token?: string | null;
  code?: string | null;
  password: string;
  actorEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type RecoveryCompletionResult = {
  email: string;
  userId: string;
};

function assertValidPassword(password: string) {
  if (!password || password.length < 12) {
    throw new ValidationError("weak-password", "La contraseña debe tener al menos 12 caracteres");
  }
}

export async function completeAdminRecovery(
  client: SupabaseServiceClient,
  params: RecoveryCompletionParams,
): Promise<RecoveryCompletionResult> {
  assertValidPassword(params.password);
  const byToken = typeof params.token === "string" && params.token.trim().length > 0;
  const byCode = typeof params.code === "string" && params.code.trim().length > 0;
  if (!byToken && !byCode) {
    throw new ValidationError("missing-token", "Debes proporcionar el enlace o el código de recuperación");
  }
  const hashedToken = byToken ? await sha256(params.token!.trim()) : null;
  const hashedCode = byCode ? await sha256(params.code!.trim().toUpperCase()) : null;

  let query = client
    .from("admin_password_resets")
    .select("id, user_id, email, expires_at, used_at, metadata")
    .order("created_at", { ascending: false })
    .limit(1);

  if (hashedToken) {
    query = query.eq("token_hash", hashedToken);
  }
  if (hashedCode) {
    query = query.eq("code_hash", hashedCode);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError("recovery-not-found", "No hay solicitudes de recuperación activas");
    }
    throw new ValidationError("recovery-lookup-error", error.message ?? "No se pudo consultar la recuperación");
  }
  if (!data) {
    throw new NotFoundError("recovery-not-found", "No hay solicitudes de recuperación activas");
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  if (data.used_at) {
    throw new ValidationError("recovery-used", "Este enlace o código ya fue utilizado");
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new ValidationError("recovery-expired", "El enlace o código expiró. Solicita uno nuevo");
  }

  const normalizedEmail = params.email ? normalizeEmail(params.email) : null;
  if (normalizedEmail && data.email && normalizeEmail(data.email) !== normalizedEmail) {
    throw new ValidationError("email-mismatch", "El código no corresponde a este correo");
  }

  await updateAdminPassword(client, data.user_id, params.password);

  const nowIso = new Date().toISOString();
  const baseMetadata = (data.metadata && typeof data.metadata === "object") ? data.metadata as Record<string, unknown> : {};
  const completionMetadata = {
    ...baseMetadata,
    completedAt: nowIso,
    completedWith: byToken ? "token" : "code",
    completedByEmail: normalizedEmail ?? data.email ?? null,
    completedActorEmail: params.actorEmail ?? null,
    completedIp: params.ip ?? null,
    completedUserAgent: params.userAgent ?? null,
  };

  const updatePayload: Record<string, unknown> = {
    used_at: nowIso,
    metadata: completionMetadata,
  };

  const { error: updateError } = await client.from("admin_password_resets").update(updatePayload).eq("id", data.id);
  if (updateError) {
    if (updateError.code === "42703") {
      const fallbackPayload = { used_at: nowIso };
      const { error: fallbackError } = await client
        .from("admin_password_resets")
        .update(fallbackPayload)
        .eq("id", data.id);
      if (fallbackError) {
        console.warn("No se pudo marcar como usada la recuperación:", fallbackError);
      }
    } else {
      console.warn("No se pudo actualizar metadata de recuperación:", updateError);
    }
  }

  return { email: data.email ?? normalizedEmail ?? "", userId: data.user_id };
}
