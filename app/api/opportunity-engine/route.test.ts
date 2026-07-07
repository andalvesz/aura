import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POST } from "@/app/api/opportunity-engine/route";

describe("opportunity engine API", () => {
  it("returns 400 when goal is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/opportunity-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: string };
    assert.ok(body.error?.includes("goal"));
  });

  it("returns top 3 opportunities as JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/opportunity-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Quero ganhar R$30.000 por mês" }),
      })
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      opportunities?: Array<{ opportunityScore: { total: number }; niche: string }>;
      reality?: { realityScore: number };
      totalCandidates?: number;
    };

    assert.equal(body.opportunities?.length, 3);
    assert.ok(body.reality?.realityScore !== undefined);
    assert.ok((body.totalCandidates ?? 0) >= 3);
    assert.ok(body.opportunities?.[0]?.niche);
    assert.ok(typeof body.opportunities?.[0]?.opportunityScore.total === "number");
  });

  it("never returns HTML", async () => {
    const response = await POST(
      new Request("http://localhost/api/opportunity-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "Quero faturar R$20.000 por mês" }),
      })
    );

    const contentType = response.headers.get("content-type") ?? "";
    assert.ok(contentType.includes("application/json"));
    const text = await response.text();
    assert.ok(!text.includes("<!DOCTYPE"));
    assert.ok(!text.includes("<html"));
  });
});
