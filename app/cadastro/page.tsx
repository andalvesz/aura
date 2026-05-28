import { signup } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CadastroPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <AuthForm mode="signup" action={signup} />
    </main>
  );
}
