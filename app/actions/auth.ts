"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeDashboardPath } from "@/lib/redirect";
import {
  auditEmailNormalization,
  logProfileCreationCheck,
  maskEmail,
  serializeAuthError,
  summarizeAuthCookies,
  summarizeAuthUser,
} from "@/lib/supabase/auth-debug";
import {
  getAuthCallbackUrl,
  getPasswordRecoveryRedirectUrl,
  PublicSiteUrlError,
  resolvePublicSiteUrl,
  siteUrlInputFromHeaders,
} from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  success?: string;
};

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const emailRaw = String(formData.get("email") ?? "");
  const emailNorm = auditEmailNormalization(emailRaw);
  // Current behavior: trim only (no lowercase). Keep unchanged.
  const email = emailNorm.sentToSupabase;
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeDashboardPath(
    String(formData.get("redirect") ?? "/dashboard")
  );

  console.info("[auth-audit] login:attempt", {
    emailNormalization: emailNorm,
    hasPassword: Boolean(password),
    passwordLength: password.length,
    passwordHadLeadingOrTrailingWhitespace:
      password.length > 0 && password !== password.trim(),
    signInParams: {
      email: emailNorm.sentMasked,
      emailExactLength: email.length,
      // password value never logged
      passwordProvided: Boolean(password),
      passwordLength: password.length,
    },
    redirectTo,
    interceptors: {
      proxy: "lib/supabase/proxy.ts updateSession — getUser on every request; redirects /login→/dashboard if session user exists; clears bad_jwt cookies",
      authForm: "components/auth/auth-form.tsx — no email transform; posts FormData as-is",
      serverAction: "app/actions/auth.ts login — trim(email) only before signInWithPassword",
    },
  });

  if (!email || !password) {
    console.info("[auth-audit] login:validation_failed", {
      reason: "missing_email_or_password",
      uiError: "Preencha email e senha.",
    });
    return { error: "Preencha email e senha." };
  }

  const cookieStore = await cookies();
  const cookieSummary = summarizeAuthCookies(cookieStore.getAll());
  console.info("[auth-audit] login:cookies_before_signin", cookieSummary);

  const supabase = await createClient();

  const [{ data: preSession, error: preSessionError }, { data: preUser, error: preUserError }] =
    await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

  console.info("[auth-audit] login:session_before_signin", {
    hasSession: Boolean(preSession.session),
    sessionUser: summarizeAuthUser(preSession.session?.user ?? null),
    sessionError: serializeAuthError(preSessionError as never),
    getUser: summarizeAuthUser(preUser.user),
    getUserError: serializeAuthError(preUserError),
  });

  const signInPayload = { email, password };
  console.info("[auth-audit] login:signInWithPassword_payload", {
    emailMasked: maskEmail(signInPayload.email),
    emailLength: signInPayload.email.length,
    emailEqualsTrimmedRaw: signInPayload.email === emailRaw.trim(),
    emailEqualsLowercase: signInPayload.email === emailRaw.trim().toLowerCase(),
    passwordLength: signInPayload.password.length,
    keys: Object.keys(signInPayload),
  });

  const { data, error } = await supabase.auth.signInWithPassword(signInPayload);

  const returnedEmail = data.user?.email ?? null;
  console.info("[auth-audit] login:supabase_signInWithPassword", {
    supabaseError: serializeAuthError(error),
    user: summarizeAuthUser(data.user),
    hasSession: Boolean(data.session),
    emailCompare: {
      sentMasked: maskEmail(email),
      returnedMasked: maskEmail(returnedEmail),
      exactMatch: returnedEmail != null && returnedEmail === email,
      caseInsensitiveMatch:
        returnedEmail != null &&
        returnedEmail.toLowerCase() === email.toLowerCase(),
      sentLength: email.length,
      returnedLength: returnedEmail?.length ?? null,
    },
    compareHint:
      "Compare sent email with auth.users.email in SQL Editor. Supabase usually stores lowercase.",
  });

  if (error) {
    // Surface original Supabase message (do not replace with generic UI copy).
    console.info("[auth-audit] login:ui_error", {
      uiError: error.message,
      uiErrorSource: "supabase_error_message_passthrough",
      supabaseOriginalMessage: error.message,
      supabaseOriginalCode: error.code ?? null,
      supabaseOriginalStatus: (error as { status?: number }).status ?? null,
    });
    return { error: error.message };
  }

  await logProfileCreationCheck(supabase, "login", data.user?.id);

  console.info("[auth-audit] login:success", {
    userId: data.user?.id ?? null,
    emailMasked: maskEmail(data.user?.email ?? email),
    redirectTo,
  });

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  let siteUrl: string;
  let emailRedirectTo: string;
  try {
    const hdrs = await headers();
    const input = siteUrlInputFromHeaders(hdrs);
    siteUrl = resolvePublicSiteUrl(input);
    emailRedirectTo = getAuthCallbackUrl(input);
  } catch (err) {
    const message =
      err instanceof PublicSiteUrlError
        ? err.message
        : "URL pública do site não configurada para confirmação de e-mail.";
    console.error("[auth-audit] signup:site-url failed", { error: message });
    return { error: message };
  }

  console.info("[auth-audit] signup:attempt", {
    emailMasked: maskEmail(email),
    hasPassword: Boolean(password),
    passwordLength: password.length,
    hasFullName: Boolean(fullName),
    emailRedirectTo,
    siteUrl,
  });

  if (!email || !password) {
    console.info("[auth-audit] signup:validation_failed", {
      reason: "missing_email_or_password",
      uiError: "Preencha email e senha.",
    });
    return { error: "Preencha email e senha." };
  }

  if (password.length < 6) {
    console.info("[auth-audit] signup:validation_failed", {
      reason: "password_too_short",
      uiError: "A senha deve ter pelo menos 6 caracteres.",
    });
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || null },
      emailRedirectTo,
    },
  });

  console.info("[auth-audit] signup:supabase_signUp", {
    emailMasked: maskEmail(email),
    supabaseError: serializeAuthError(error),
    user: summarizeAuthUser(data.user),
    hasSession: Boolean(data.session),
    identitiesCount: data.user?.identities?.length ?? 0,
    note:
      "If email confirmation is required, session is null and user may still exist. Duplicate signup often returns user with empty identities.",
  });

  if (error) {
    console.info("[auth-audit] signup:ui_error", {
      uiError: error.message,
      uiErrorSource: "supabase_error_message_passthrough",
      supabaseOriginalMessage: error.message,
      supabaseOriginalCode: error.code ?? null,
      supabaseOriginalStatus: (error as { status?: number }).status ?? null,
    });
    return { error: error.message };
  }

  await logProfileCreationCheck(supabase, "signup", data.user?.id);

  revalidatePath("/", "layout");

  if (data.session) {
    console.info("[auth-audit] signup:success_with_session", {
      userId: data.user?.id ?? null,
      redirectTo: "/dashboard",
    });
    redirect("/dashboard");
  }

  console.info("[auth-audit] signup:success_needs_email_confirm", {
    userId: data.user?.id ?? null,
    redirectTo: "/login?message=confirm-email",
  });
  redirect("/login?message=confirm-email");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const emailRaw = String(formData.get("email") ?? "");
  const emailNorm = auditEmailNormalization(emailRaw);
  const email = emailNorm.sentToSupabase;

  if (!email) {
    return { error: "Informe seu email." };
  }

  let redirectTo: string;
  try {
    const hdrs = await headers();
    redirectTo = getPasswordRecoveryRedirectUrl(
      siteUrlInputFromHeaders(hdrs),
      "/redefinir-senha"
    );
  } catch (err) {
    const message =
      err instanceof PublicSiteUrlError
        ? err.message
        : "URL pública do site não configurada.";
    return { error: message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  console.info("[auth-audit] password_reset:request", {
    emailMasked: maskEmail(email),
    supabaseError: serializeAuthError(error),
    hasRedirectTo: Boolean(redirectTo),
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Se existir uma conta com este email, enviamos um link para redefinir a senha.",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!password || password.length < 6) {
    return { error: "A senha deve ter pelo menos 6 caracteres." };
  }
  if (password !== confirm) {
    return { error: "As senhas não coincidem." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sessão expirada. Use o link do email novamente." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  console.info("[auth-audit] password_reset:update", {
    userId: user.id,
    supabaseError: serializeAuthError(error),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.info("[auth-audit] logout:attempt", {
    userId: user?.id ?? null,
    emailMasked: maskEmail(user?.email),
  });

  // Clear active context so the next session starts in personal (no stale workspace UI).
  if (user?.id) {
    await supabase
      .from("profiles")
      .update({
        active_context: "personal",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  await supabase.auth.signOut();

  console.info("[auth-audit] logout:done", {
    userId: user?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect("/login");
}
