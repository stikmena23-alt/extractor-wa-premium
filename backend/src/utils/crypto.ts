const HEX_TABLE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
const encoder = new TextEncoder();

export async function sha256(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const view = new Uint8Array(hashBuffer);
  return view.reduce((acc, byte) => acc + HEX_TABLE[byte], "");
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
