"use client";

import Link from "next/link";
import { useActionState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { AuthState } from "@/app/actions/auth";
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

type AuthFormProps = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  redirectTo?: string;
  notice?: string;
};

export function AuthForm({ mode, action, redirectTo, notice }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";
  const message = state.error ?? notice;

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md"
    >
      <Card className="p-1">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mb-2 inline-block text-2xl font-semibold tracking-tight text-white"
          >
            Aura
          </Link>
          <CardTitle className="text-xl">
            {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Entre para acessar seu dashboard"
              : "Comece a usar o Aura em segundos"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {redirectTo && (
              <input type="hidden" name="redirect" value={redirectTo} />
            )}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>
            )}
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
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
            </div>
            {message && (
              <p
                role="alert"
                className={`rounded-lg px-3 py-2 text-sm ${
                  state.error
                    ? "bg-red-500/10 text-red-300"
                    : "bg-violet-500/10 text-violet-200"
                }`}
              >
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-400">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <Link
              href={isLogin ? "/cadastro" : "/login"}
              className="font-medium text-violet-300 hover:text-violet-200"
            >
              {isLogin ? "Cadastre-se" : "Faça login"}
            </Link>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
