# Marketplaces — Business Expert

Registry estático de plataformas de monetização usadas pelo Business Expert B1.X.

## Plataformas

Kiwify · Hotmart · Eduzz · Braip · HeroSpark · Monetizze · Ticto · Kirvano · Gumroad · Shopify · WooCommerce · Stripe · Mercado Pago

## Campos

Cada registro inclui: nome, descrição, categoria, casos de uso, vantagens, limitações, tipos de negócio, checkout, recorrência, afiliados, produtor, API, documentação, integrações futuras e nota de orientação.

## Regras

- Não inventar taxas/ranking atuais.
- Comparações sensíveis ao tempo devem preferir o **web research provider** do Aura.
- Integrações reais (checkout, webhooks) ficam como `futureIntegrations`.

## API

```ts
import {
  listMarketplaces,
  getMarketplace,
  compareMarketplaces,
  marketplacesWithAffiliates,
} from "@/lib/business-expert";
```
