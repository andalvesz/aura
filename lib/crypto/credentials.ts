import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "aura-platform-credentials-v1";

function resolveKey(): Buffer {
  const envKey = process.env.PLATFORM_CREDENTIALS_KEY?.trim();
  if (envKey) {
    if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    const decoded = Buffer.from(envKey, "base64");
    if (decoded.length === 32) return decoded;
    return scryptSync(envKey, SALT, 32);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLATFORM_CREDENTIALS_KEY não configurada. Defina uma chave de 32 bytes (base64 ou hex)."
    );
  }

  return scryptSync("aura-platform-dev-key", SALT, 32);
}

export function encryptCredentials(payload: Record<string, string>): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptCredentials(encrypted: string): Record<string, string> {
  const key = resolveKey();
  const [ivB64, tagB64, dataB64] = encrypted.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Credencial criptografada inválida.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(decrypted) as Record<string, string>;
  return parsed;
}

export function maskCredential(value: string | undefined): string {
  if (!value) return "—";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
