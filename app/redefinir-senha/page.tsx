"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { updatePassword, type AuthState } from "@/app/actions/auth";
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

export default function RedefinirSenhaPage() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    {} as AuthState
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md" data-testid="password-update-page">
        <Card className="p-1">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Nova senha</CardTitle>
            <CardDescription>
              Defina uma nova senha para sua conta Aura Brain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              {state.error ? (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {state.error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Salvar senha
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-400">
              <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
                Ir ao login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
