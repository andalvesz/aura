"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import {
  requestPasswordReset,
  type AuthState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function RecuperarSenhaPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    {} as AuthState
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md" data-testid="password-recovery-page">
        <Card className="p-1">
          <CardHeader className="text-center">
            <Link
              href="/"
              className="mb-2 inline-block text-2xl font-semibold tracking-tight text-white"
            >
              Aura Brain
            </Link>
            <CardTitle className="text-xl">Recuperar senha</CardTitle>
            <CardDescription>
              Enviaremos um link seguro para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              {state.error ? (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </p>
              ) : null}
              {state.success ? (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
                >
                  {state.success}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Enviar link
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-400">
              <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
                Voltar ao login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
