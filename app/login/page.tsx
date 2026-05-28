import { login } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { getUser } from "@/lib/auth";
import { safeDashboardPath } from "@/lib/redirect";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string; error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const redirectTo = params.redirect
    ? safeDashboardPath(params.redirect)
    : undefined;

  const notice =
    params.message === "confirm-email"
      ? "Confirme seu email antes de entrar."
      : params.error === "auth"
        ? "Falha na autenticação. Tente novamente."
        : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <AuthForm
        mode="login"
        action={login}
        redirectTo={redirectTo}
        notice={notice}
      />
    </main>
  );
}
