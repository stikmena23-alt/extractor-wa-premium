const DEFAULT_EXPIRATION_MINUTES = 45;
const DEFAULT_APP_URL = "https://wf-tools-admin.example.com";

export function getRecoveryExpirationMinutes(): number {
  const raw = Deno.env.get("ADMIN_RECOVERY_EXP_MINUTES");
  if (!raw) return DEFAULT_EXPIRATION_MINUTES;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EXPIRATION_MINUTES;
}

export function getAdminAppUrl(): string {
  const base = Deno.env.get("ADMIN_APP_URL")?.trim();
  if (base && base.length > 0) {
    return base.replace(/\/$/, "");
  }
  return DEFAULT_APP_URL;
}

export function getRecoveryBaseUrl(): string {
  const override = Deno.env.get("ADMIN_RECOVERY_BASE_URL")?.trim();
  if (override && override.length > 0) {
    return override.replace(/\/$/, "");
  }
  return `${getAdminAppUrl()}/reset-password`;
}

export const config = {
  getAdminAppUrl,
  getRecoveryBaseUrl,
  getRecoveryExpirationMinutes,
};

export type Config = typeof config;
