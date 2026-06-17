import type { LandingPage } from "@/types/database";
import {
  parseLandingBenefits,
  parseLandingFaq,
  parseLandingOffer,
  parseLandingProof,
} from "@/utils/landing-factory";

type LandingPagePublicProps = {
  page: LandingPage;
};

export function LandingPagePublic({ page }: LandingPagePublicProps) {
  if (page.html?.trim()) {
    return (
      <div
        className="landing-page-html"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    );
  }

  const benefits = parseLandingBenefits(page.benefits_json);
  const proof = parseLandingProof(page.proof_json);
  const offer = parseLandingOffer(page.offer_json);
  const faq = parseLandingFaq(page.faq_json);
  const cta = page.cta_text ?? "Quero começar agora";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <header className="py-8 text-center">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            {page.headline ?? page.title}
          </h1>
          {page.subheadline && (
            <p className="mt-3 text-lg text-zinc-400">{page.subheadline}</p>
          )}
          {page.hero_copy && (
            <p className="mt-4 text-zinc-300">{page.hero_copy}</p>
          )}
          <a
            href="#cta"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 font-semibold text-white"
          >
            {cta}
          </a>
        </header>

        {benefits.length > 0 && (
          <section className="my-10">
            <h2 className="mb-4 text-xl font-semibold text-zinc-200">
              O que você vai conquistar
            </h2>
            <ul className="grid gap-3">
              {benefits.map((benefit) => (
                <li
                  key={benefit.title}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <p className="font-medium">{benefit.title}</p>
                  {benefit.description && (
                    <p className="mt-1 text-sm text-zinc-400">{benefit.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(proof.testimonials ?? []).length > 0 && (
          <section className="my-10">
            <h2 className="mb-4 text-xl font-semibold text-zinc-200">Prova social</h2>
            <div className="space-y-3">
              {(proof.testimonials ?? []).map((item) => (
                <blockquote
                  key={`${item.nome}-${item.texto.slice(0, 24)}`}
                  className="rounded-lg border-l-4 border-violet-500 bg-zinc-900/60 p-4"
                >
                  <p className="text-zinc-300">&ldquo;{item.texto}&rdquo;</p>
                  <footer className="mt-2 text-sm text-zinc-500">
                    — {item.nome}
                    {item.resultado ? ` · ${item.resultado}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        )}

        <section
          id="cta"
          className="my-10 rounded-xl border border-indigo-500/40 bg-gradient-to-b from-indigo-950/50 to-zinc-900/60 p-6 text-center"
        >
          <h2 className="text-xl font-semibold">Sua oferta</h2>
          {offer.price_label && (
            <p className="mt-2 text-2xl font-bold text-cyan-300">{offer.price_label}</p>
          )}
          {offer.original_price && (
            <p className="text-sm text-zinc-500 line-through">{offer.original_price}</p>
          )}
          {offer.guarantee && <p className="mt-3 text-zinc-300">{offer.guarantee}</p>}
          {offer.urgency && (
            <p className="mt-2 text-sm text-amber-300">{offer.urgency}</p>
          )}
          {(offer.bonuses ?? offer.stack ?? []).length > 0 && (
            <ul className="mx-auto mt-4 max-w-md list-disc text-left text-sm text-zinc-300">
              {(offer.bonuses ?? offer.stack ?? []).map((bonus) => (
                <li key={bonus}>{bonus}</li>
              ))}
            </ul>
          )}
          <a
            href="#cta"
            className="mt-6 inline-block rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 font-semibold text-white"
          >
            {cta}
          </a>
        </section>

        {faq.length > 0 && (
          <section className="my-10">
            <h2 className="mb-4 text-xl font-semibold text-zinc-200">
              Perguntas frequentes
            </h2>
            <div className="space-y-2">
              {faq.map((item) => (
                <details
                  key={item.pergunta}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <summary className="cursor-pointer font-medium">{item.pergunta}</summary>
                  <p className="mt-2 text-sm text-zinc-400">{item.resposta}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-12 text-center text-xs text-zinc-600">
          Gerado pela Aura Landing Factory · Resultados individuais podem variar.
        </footer>
      </div>
    </div>
  );
}
