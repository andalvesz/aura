export type SupabaseEnvDiagnostics = {
  url: string;
  projectRef: string | null;
  anonKeyPreview: string;
  anonKeyLength: number;
  mismatches: string[];
  sources: {
    nextPublicUrl: boolean;
    nextPublicAnonKey: boolean;
    serverUrl: boolean;
    serverAnonKey: boolean;
  };
};

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/^["']|["']$/g, "");
}

export function extractSupabaseProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function previewSecret(value: string, visible = 12): string {
  if (!value) return "";
  if (value.length <= visible) return value;
  return `${value.slice(0, visible)}…`;
}

function collectSupabaseEnvMismatches(): string[] {
  const mismatches: string[] = [];

  const publicUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serverUrl = cleanEnvValue(process.env.SUPABASE_URL);
  const publicAnon = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serverAnon = cleanEnvValue(process.env.SUPABASE_ANON_KEY);

  if (publicUrl && serverUrl && publicUrl !== serverUrl) {
    mismatches.push("SUPABASE_URL difere de NEXT_PUBLIC_SUPABASE_URL");
  }

  if (publicAnon && serverAnon && publicAnon !== serverAnon) {
    mismatches.push("SUPABASE_ANON_KEY difere de NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return mismatches;
}

export function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getSupabaseEnv() {
  const rawUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const rawAnonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!rawUrl || !rawAnonKey) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local ou na Vercel."
    );
  }

  const url = normalizeSupabaseUrl(rawUrl);
  const anonKey = rawAnonKey;

  if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL inválida. Use https://<ref>.supabase.co");
  }

  if (!anonKey.startsWith("eyJ")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY inválida. Use a chave anon public do Supabase (JWT eyJ...)."
    );
  }

  const mismatches = collectSupabaseEnvMismatches();
  if (mismatches.length) {
    console.warn("[supabase-env] possível mistura de variáveis", { mismatches });
  }

  return { url, anonKey };
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabaseEnvDiagnostics(): SupabaseEnvDiagnostics {
  const rawUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "";
  const rawAnon = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? "";
  const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : "";

  return {
    url,
    projectRef: url ? extractSupabaseProjectRef(url) : null,
    anonKeyPreview: previewSecret(rawAnon, 20),
    anonKeyLength: rawAnon.length,
    mismatches: collectSupabaseEnvMismatches(),
    sources: {
      nextPublicUrl: Boolean(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)),
      nextPublicAnonKey: Boolean(cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),
      serverUrl: Boolean(cleanEnvValue(process.env.SUPABASE_URL)),
      serverAnonKey: Boolean(cleanEnvValue(process.env.SUPABASE_ANON_KEY)),
    },
  };
}
