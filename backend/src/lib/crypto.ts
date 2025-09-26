const encoder = new TextEncoder();

export async function sha256(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function generateRecoveryToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRecoveryCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const base = RECOVERY_CODE_ALPHABET.length;
  let result = "";
  for (let i = 0; i < length; i++) {
    result += RECOVERY_CODE_ALPHABET[bytes[i] % base];
  }
  return result;
}
