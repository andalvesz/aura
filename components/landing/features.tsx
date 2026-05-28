"use client";

import { motion } from "framer-motion";
import { BarChart3, LayoutDashboard, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard intuitivo",
    description:
      "Layout SaaS moderno com sidebar, métricas e perfil em um só lugar.",
  },
  {
    icon: Shield,
    title: "Autenticação segura",
    description:
      "Login com Supabase, sessão persistente e rotas protegidas via proxy.",
  },
  {
    icon: BarChart3,
    title: "Insights visuais",
    description:
      "Cards estatísticos e visualizações pensadas para decisões rápidas.",
  },
];

export function Features() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-3xl font-semibold text-white sm:text-4xl"
        >
          Tudo que você precisa
        </motion.h2>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full transition-colors hover:border-violet-500/30">
                <CardHeader>
                  <feature.icon className="mb-2 size-8 text-violet-400" />
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-zinc-400">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
