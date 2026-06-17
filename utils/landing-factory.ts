import type { CreatorLanding, LandingPage, LandingPageStatus } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";

export const LANDING_FACTORY_SAFE_MODE = {
  active: true,
  message:
    "Landing Factory gera páginas em rascunho — publicação manual via botão Publicar Landing.",
};

export type LandingBenefit = {
  title: string;
  description: string;
};

export type LandingProofItem = {
  nome: string;
  texto: string;
  resultado?: string;
};

export type LandingProofJson = {
  testimonials?: LandingProofItem[];
  stats?: { label: string; value: string }[];
};

export type LandingOfferJson = {
  price_label?: string;
  original_price?: string;
  bonuses?: string[];
  guarantee?: string;
  urgency?: string;
  stack?: string[];
};

export type LandingFaqItem = {
  pergunta: string;
  resposta: string;
};

export type GeneratedLandingPage = {
  title: string;
  headline: string;
  subheadline: string;
  hero_copy: string;
  benefits: LandingBenefit[];
  proof: LandingProofJson;
  offer: LandingOfferJson;
  faq: LandingFaqItem[];
  cta_text: string;
};

export type LandingFactoryIntake = {
  operation_id?: string | null;
  product_id?: string | null;
  copylab_id?: string | null;
  titulo?: string;
  promessa?: string;
  avatar?: string;
  problema?: string;
  solucao?: string;
  headline?: string;
};

export type LandingFactoryDashboardMetrics = {
  total: number;
  draft: number;
  published: number;
  operationLinked: number;
};

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function buildLandingSlugBase(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "landing";
}

export function buildLandingPreviewUrl(slug: string): string {
  return `${getSiteUrl()}/api/landing-factory/${slug}`;
}

export function buildLandingPublishedUrl(slug: string): string {
  return `${getSiteUrl()}/l/${slug}`;
}

export function parseLandingBenefits(value: unknown): LandingBenefit[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { title: item, description: "" };
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return {
          title: String(row.title ?? row.headline ?? ""),
          description: String(row.description ?? row.body ?? ""),
        };
      }
      return null;
    })
    .filter((item): item is LandingBenefit => Boolean(item?.title));
}

export function parseLandingFaq(value: unknown): LandingFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const pergunta = String(row.pergunta ?? row.question ?? "").trim();
      const resposta = String(row.resposta ?? row.answer ?? "").trim();
      if (!pergunta) return null;
      return { pergunta, resposta };
    })
    .filter((item): item is LandingFaqItem => item != null);
}

export function parseLandingProof(value: unknown): LandingProofJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const testimonials = Array.isArray(row.testimonials)
    ? row.testimonials
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const t = item as Record<string, unknown>;
          const nome = String(t.nome ?? t.name ?? "").trim();
          const texto = String(t.texto ?? t.text ?? "").trim();
          if (!nome || !texto) return null;
          return {
            nome,
            texto,
            resultado: t.resultado != null ? String(t.resultado) : undefined,
          };
        })
        .filter((item) => item != null) as LandingProofItem[]
    : [];
  const stats = Array.isArray(row.stats)
    ? row.stats
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const s = item as Record<string, unknown>;
          const label = String(s.label ?? "").trim();
          const statValue = String(s.value ?? "").trim();
          if (!label || !statValue) return null;
          return { label, value: statValue };
        })
        .filter((item): item is { label: string; value: string } => item != null)
    : [];
  return { testimonials, stats };
}

export function parseLandingOffer(value: unknown): LandingOfferJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    price_label: row.price_label != null ? String(row.price_label) : undefined,
    original_price: row.original_price != null ? String(row.original_price) : undefined,
    bonuses: Array.isArray(row.bonuses) ? row.bonuses.map(String) : undefined,
    guarantee: row.guarantee != null ? String(row.guarantee) : undefined,
    urgency: row.urgency != null ? String(row.urgency) : undefined,
    stack: Array.isArray(row.stack) ? row.stack.map(String) : undefined,
  };
}

export function buildLandingPageHtml(page: Pick<
  LandingPage,
  | "title"
  | "headline"
  | "subheadline"
  | "hero_copy"
  | "benefits_json"
  | "proof_json"
  | "offer_json"
  | "faq_json"
  | "cta_text"
>): string {
  const benefits = parseLandingBenefits(page.benefits_json);
  const proof = parseLandingProof(page.proof_json);
  const offer = parseLandingOffer(page.offer_json);
  const faq = parseLandingFaq(page.faq_json);
  const title = page.title ?? page.headline ?? "Landing";
  const cta = page.cta_text ?? "Quero começar agora";

  const benefitsHtml = benefits
    .map(
      (b) =>
        `<li class="benefit"><strong>${escapeHtml(b.title)}</strong>${b.description ? `<p>${escapeHtml(b.description)}</p>` : ""}</li>`
    )
    .join("");

  const testimonialsHtml = (proof.testimonials ?? [])
    .map(
      (t) =>
        `<blockquote class="testimonial"><p>"${escapeHtml(t.texto)}"</p><footer>— ${escapeHtml(t.nome)}${t.resultado ? ` · ${escapeHtml(t.resultado)}` : ""}</footer></blockquote>`
    )
    .join("");

  const faqHtml = faq
    .map(
      (item) =>
        `<details class="faq-item"><summary>${escapeHtml(item.pergunta)}</summary><p>${escapeHtml(item.resposta)}</p></details>`
    )
    .join("");

  const offerBonuses = (offer.bonuses ?? offer.stack ?? [])
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0f; color: #f4f4f5; line-height: 1.6; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
    .hero { text-align: center; padding: 2.5rem 0 2rem; }
    .hero h1 { font-size: clamp(1.75rem, 5vw, 2.5rem); font-weight: 700; line-height: 1.15; margin-bottom: 0.75rem; }
    .hero .sub { font-size: 1.1rem; color: #a1a1aa; margin-bottom: 1.25rem; }
    .hero .copy { color: #d4d4d8; margin-bottom: 1.5rem; }
    .cta { display: inline-block; background: linear-gradient(135deg, #7c3aed, #06b6d4); color: #fff; font-weight: 600; padding: 0.9rem 1.75rem; border-radius: 0.5rem; text-decoration: none; font-size: 1rem; }
    section { margin: 2.5rem 0; }
    h2 { font-size: 1.35rem; margin-bottom: 1rem; color: #e4e4e7; }
    .benefits { list-style: none; display: grid; gap: 1rem; }
    .benefit { background: #18181b; border: 1px solid #27272a; border-radius: 0.5rem; padding: 1rem; }
    .benefit p { color: #a1a1aa; font-size: 0.9rem; margin-top: 0.35rem; }
    .testimonial { background: #18181b; border-left: 3px solid #7c3aed; padding: 1rem; margin-bottom: 1rem; border-radius: 0 0.5rem 0.5rem 0; }
    .testimonial footer { color: #71717a; font-size: 0.85rem; margin-top: 0.5rem; }
    .offer-box { background: linear-gradient(180deg, #1e1b4b 0%, #18181b 100%); border: 1px solid #4338ca; border-radius: 0.75rem; padding: 1.5rem; text-align: center; }
    .price { font-size: 1.75rem; font-weight: 700; color: #a5f3fc; margin: 0.5rem 0; }
    .faq-item { background: #18181b; border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; }
    .faq-item summary { cursor: pointer; font-weight: 500; }
    .faq-item p { color: #a1a1aa; margin-top: 0.5rem; font-size: 0.9rem; }
    footer.page { text-align: center; color: #52525b; font-size: 0.75rem; margin-top: 3rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>${escapeHtml(page.headline ?? title)}</h1>
      ${page.subheadline ? `<p class="sub">${escapeHtml(page.subheadline)}</p>` : ""}
      ${page.hero_copy ? `<p class="copy">${escapeHtml(page.hero_copy)}</p>` : ""}
      <a href="#cta" class="cta">${escapeHtml(cta)}</a>
    </header>
    ${benefits.length ? `<section><h2>O que você vai conquistar</h2><ul class="benefits">${benefitsHtml}</ul></section>` : ""}
    ${testimonialsHtml ? `<section><h2>Prova social</h2>${testimonialsHtml}</section>` : ""}
    <section class="offer-box" id="cta">
      <h2>Sua oferta</h2>
      ${offer.price_label ? `<p class="price">${escapeHtml(offer.price_label)}</p>` : ""}
      ${offer.original_price ? `<p style="color:#71717a;text-decoration:line-through">${escapeHtml(offer.original_price)}</p>` : ""}
      ${offer.guarantee ? `<p>${escapeHtml(offer.guarantee)}</p>` : ""}
      ${offer.urgency ? `<p style="color:#fbbf24;margin-top:0.5rem">${escapeHtml(offer.urgency)}</p>` : ""}
      ${offerBonuses ? `<ul style="text-align:left;margin:1rem 0;list-style:disc;padding-left:1.25rem">${offerBonuses}</ul>` : ""}
      <a href="#cta" class="cta" style="margin-top:1rem">${escapeHtml(cta)}</a>
    </section>
    ${faq.length ? `<section><h2>Perguntas frequentes</h2>${faqHtml}</section>` : ""}
    <footer class="page">Gerado pela Aura Landing Factory · Resultados individuais podem variar.</footer>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function computeLandingFactoryDashboard(pages: LandingPage[]): LandingFactoryDashboardMetrics {
  const byStatus = pages.reduce(
    (acc, page) => {
      if (page.status === "published") acc.published += 1;
      else acc.draft += 1;
      if (page.operation_id) acc.operationLinked += 1;
      return acc;
    },
    { draft: 0, published: 0, operationLinked: 0 }
  );

  return {
    total: pages.length,
    draft: byStatus.draft,
    published: byStatus.published,
    operationLinked: byStatus.operationLinked,
  };
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): LandingFactoryIntake {
  const product = bundle.product;
  return {
    product_id: product.id,
    titulo: product.nome ?? "",
    promessa: product.promessa ?? "",
    avatar: product.avatar ?? "",
    problema: product.problema ?? "",
    solucao: product.solucao ?? "",
  };
}

export function landingPageToCreatorLanding(page: LandingPage): CreatorLanding {
  const benefits = parseLandingBenefits(page.benefits_json).map((b) => b.title);
  const faq = parseLandingFaq(page.faq_json);
  const proof = parseLandingProof(page.proof_json);
  const offer = parseLandingOffer(page.offer_json);

  return {
    id: page.id,
    user_id: page.user_id,
    product_id: page.product_id,
    copylab_id: null,
    target_country: null,
    target_language: null,
    currency: null,
    modelo: "produto_digital",
    nome: page.title,
    avatar: null,
    problema: null,
    solucao: null,
    promessa: null,
    diferencial: null,
    preco: null,
    hero_section: page.hero_copy,
    headline: page.headline,
    subheadline: page.subheadline,
    beneficios: benefits,
    section_problema: null,
    section_solucao: null,
    depoimentos: proof.testimonials ?? [],
    garantia: offer.guarantee ?? null,
    bonus: offer.bonuses?.join(", ") ?? null,
    faq,
    cta: page.cta_text,
    rodape: null,
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
}

export function getLandingPageStatusLabel(status: LandingPageStatus): string {
  const labels: Record<LandingPageStatus, string> = {
    draft: "Rascunho",
    preview: "Preview",
    published: "Publicada",
  };
  return labels[status];
}
