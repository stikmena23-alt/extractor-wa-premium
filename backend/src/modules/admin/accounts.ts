import { NotFoundError, ValidationError } from "../../lib/errors.ts";
import type { SupabaseServiceClient } from "../../lib/supabaseClient.ts";

export type AdminAccount = {
  id: string;
  email: string | null;
};

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function fetchAdminByEmail(
  client: SupabaseServiceClient,
  email: string,
): Promise<AdminAccount> {
  const normalizedEmail = normalizeEmail(email);

  const { data: directData, error: directError } = await client.auth.admin.getUserByEmail(normalizedEmail);
  if (directError) {
    const status = (directError as { status?: number }).status ?? null;
    if (status && status !== 404) {
      throw new ValidationError(
        "admin-lookup-error",
        directError.message ?? "No se pudo consultar el usuario",
        directError,
      );
    }
  }

  const directUser = directData?.user ?? null;
  if (directUser) {
    return { id: directUser.id, email: directUser.email ?? null };
  }

  const authSchema = typeof client.schema === "function" ? client.schema("auth") : null;
  const queryBuilder = authSchema
    ? authSchema.from("users")
    : client.from("auth.users");

  const { data, error } = await queryBuilder
    .select("id, email")
    .eq("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new ValidationError("admin-lookup-error", error.message ?? "No se pudo consultar el usuario", error);
  }

  if (!data) {
    throw new NotFoundError("admin-not-found", "No existe un administrador con ese correo");
  }

  const id = (data as { id?: string }).id;
  if (!id) {
    throw new ValidationError("admin-lookup-error", "La respuesta de auth.users no contiene un id válido", data);
  }

  const emailValue = (data as { email?: string | null }).email ?? null;

  return { id, email: emailValue };
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
