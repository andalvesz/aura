import assert from "node:assert/strict";
import test from "node:test";
import type { KiwifyProduct } from "@/types/database";
import {
  matchKiwifyProductByHints,
  pickTopKiwifyCatalogProduct,
  resolveOperationProductName,
} from "./operation-product";

const products: KiwifyProduct[] = [
  {
    id: "k1",
    user_id: "u1",
    connection_id: "c1",
    external_product_id: "ext-1",
    name: "Curso Aura Premium",
    price_cents: 19700,
    currency: "BRL",
    status: "active",
    affiliate_enabled: true,
    affiliate_score: 80,
    metadata: {},
    last_synced_at: null,
    created_at: "",
    updated_at: "",
  },
  {
    id: "k2",
    user_id: "u1",
    connection_id: "c1",
    external_product_id: "ext-2",
    name: "Mentoria VIP",
    price_cents: 49700,
    currency: "BRL",
    status: "active",
    affiliate_enabled: true,
    affiliate_score: 55,
    metadata: {},
    last_synced_at: null,
    created_at: "",
    updated_at: "",
  },
];

test("matchKiwifyProductByHints finds product from CEO radar title", () => {
  const match = matchKiwifyProductByHints(products, [
    "Estratégia para Curso Aura Premium",
    "plano kiwify",
  ]);
  assert.equal(match?.id, "k1");
});

test("pickTopKiwifyCatalogProduct prefers top selling name", () => {
  const match = pickTopKiwifyCatalogProduct(products, ["Mentoria VIP"]);
  assert.equal(match?.id, "k2");
});

test("resolveOperationProductName prefers product_nome over legacy produto metadata", () => {
  const name = resolveOperationProductName(
    { product_nome: "Curso Aura Premium" },
    { produto: "Nome legado" }
  );
  assert.equal(name, "Curso Aura Premium");
});

test("resolveOperationProductName falls back to legacy produto metadata", () => {
  const name = resolveOperationProductName(
    { product_nome: null },
    { produto: "Produto CEO" }
  );
  assert.equal(name, "Produto CEO");
});
