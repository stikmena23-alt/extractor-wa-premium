import { getRecoveryBaseUrl, getRecoveryExpirationMinutes } from "./config.ts";
import { AppError, NotFoundError, ValidationError } from "./errors.ts";
import { fetchAdminByEmail, normalizeEmail, updateAdminPassword } from "./adminAccounts.ts";
import type { SupabaseServiceClient } from "./supabase.ts";
import { generateRecoveryCode, generateRecoveryToken, sha256 } from "./utils/crypto.ts";

const SHORT_CODE_LENGTH = 6;
const MAX_SHORT_CODE_ATTEMPTS = 8;

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
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + getRecoveryExpirationMinutes() * 60_000);
  const expiresIso = expires.toISOString();
  const token = generateRecoveryToken();
  const tokenHash = await sha256(token);

  await markExistingResetsAsConsumed(client, user.id, email);

  const metadata: Record<string, unknown> = {
    requested_at: nowIso,
    requested_from_origin: context.origin ?? null,
    requested_by_actor_email: actorEmail ?? null,
    actor_ip: context.ip ?? null,
    actor_user_agent: context.userAgent ?? null,
  };

  const insertResult = await insertResetWithRetry(client, {
    user_id: user.id,
    admin_email: email,
    token_hash: tokenHash,
    expires_at: expiresIso,
    requested_by_email: actorEmail ? normalizeEmail(actorEmail) : null,
    ip_address: context.ip ?? null,
    user_agent: context.userAgent ?? null,
    meta: metadata,
  });

  const { short_code: shortCode, expires_at: insertedExpiresAt } = insertResult;
  const resetUrl = `${getRecoveryBaseUrl()}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  return {
    userId: user.id,
    email,
    shortCode,
    token,
    resetUrl,
    expiresAt: insertedExpiresAt,
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
    .select("id, user_id, admin_email, expires_at, consumed_at, meta")
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
  if (data.consumed_at) {
    throw new ValidationError("recovery-used", "Este enlace o código ya fue utilizado");
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new ValidationError("recovery-expired", "El enlace o código expiró. Solicita uno nuevo");
  }

  const normalizedEmail = params.email ? normalizeEmail(params.email) : null;
  const recordEmail = typeof data.admin_email === "string" ? normalizeEmail(data.admin_email) : null;
  if (normalizedEmail && recordEmail && recordEmail !== normalizedEmail) {
    throw new ValidationError("email-mismatch", "El código no corresponde a este correo");
  }

  const fallbackEmail = recordEmail ?? normalizedEmail;
  if (!fallbackEmail) {
    throw new AppError(
      "recovery-email-missing",
      500,
      "No se pudo determinar el correo asociado a la recuperación",
    );
  }
  const resolvedUserId = data.user_id ?? (await fetchAdminByEmail(client, fallbackEmail)).id;

  await updateAdminPassword(client, resolvedUserId, params.password);

  const nowIso = new Date().toISOString();
  const baseMeta = (data.meta && typeof data.meta === "object") ? data.meta as Record<string, unknown> : {};
  const completionMeta = {
    ...baseMeta,
    completed_at: nowIso,
    completed_with: byToken ? "token" : "code",
    completed_email: normalizedEmail ?? recordEmail ?? null,
    completed_actor_email: params.actorEmail ?? null,
    completed_ip: params.ip ?? null,
    completed_user_agent: params.userAgent ?? null,
  };

  const updatePayload: Record<string, unknown> = {
    consumed_at: nowIso,
    meta: completionMeta,
  };

  const { error: updateError } = await client.from("admin_password_resets").update(updatePayload).eq("id", data.id);
  if (updateError) {
    console.warn("No se pudo actualizar metadata de recuperación:", updateError);
  }

  return { email: recordEmail ?? normalizedEmail ?? "", userId: resolvedUserId };
}

type ResetInsertBase = {
  user_id: string;
  admin_email: string;
  token_hash: string;
  expires_at: string;
  requested_by_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
};

async function insertResetWithRetry(
  client: SupabaseServiceClient,
  basePayload: ResetInsertBase,
): Promise<{ id: string; short_code: string; expires_at: string }> {
  for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt++) {
    const shortCode = generateRecoveryCode(SHORT_CODE_LENGTH).toUpperCase();
    const codeHash = await sha256(shortCode);
    const payload = {
      ...basePayload,
      short_code: shortCode,
      code_hash: codeHash,
    };
    const { data, error } = await client
      .from("admin_password_resets")
      .insert(payload)
      .select("id, short_code, expires_at")
      .single();
    if (!error && data) {
      return data;
    }
    const errorCode = error?.code ?? "";
    if (errorCode === "23505" || (error?.message ?? "").toLowerCase().includes("duplicate")) {
      continue;
    }
    if (errorCode === "42P01") {
      throw new AppError(
        "recovery-table-missing",
        500,
        "La tabla admin_password_resets no existe en la base de datos",
        error?.message,
      );
    }
    throw new AppError(
      "recovery-insert-error",
      500,
      error?.message ?? "No se pudo registrar la recuperación",
      error,
    );
  }
  throw new AppError(
    "recovery-shortcode-exhausted",
    500,
    "No se pudo generar un código corto único después de varios intentos",
  );
}

async function markExistingResetsAsConsumed(
  client: SupabaseServiceClient,
  userId: string,
  email: string,
) {
  const nowIso = new Date().toISOString();
  try {
    await client
      .from("admin_password_resets")
      .update({ consumed_at: nowIso })
      .is("consumed_at", null)
      .eq("user_id", userId);
  } catch (error) {
    console.warn("No se pudieron cerrar recuperaciones previas por user_id:", error);
  }

  try {
    await client
      .from("admin_password_resets")
      .update({ consumed_at: nowIso })
      .is("consumed_at", null)
      .eq("admin_email", email);
  } catch (error) {
    console.warn("No se pudieron cerrar recuperaciones previas por admin_email:", error);
  }
}
