import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Navbar } from "@/components/landing/navbar";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-500">
        © <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
        Aura. Todos os direitos reservados.
      </footer>
    </main>
  );
}
