import { NotFoundError, ValidationError } from "./errors.ts";
import type { SupabaseServiceClient } from "./supabase.ts";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function fetchAdminByEmail(client: SupabaseServiceClient, email: string) {
  const { data, error } = await client.auth.admin.getUserByEmail(email);
  if (error) {
    throw new ValidationError("admin-lookup-error", error.message ?? "No se pudo consultar el usuario");
  }
  const user = data?.user ?? null;
  if (!user) {
    throw new NotFoundError("admin-not-found", "No existe un administrador con ese correo");
  }
  return user;
}

export async function updateAdminPassword(
  client: SupabaseServiceClient,
  userId: string,
  newPassword: string,
) {
  const { error } = await client.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    throw new ValidationError("password-update-error", error.message ?? "No se pudo actualizar la contraseña");
  }
}
