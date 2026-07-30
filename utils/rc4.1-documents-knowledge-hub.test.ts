/**
 * RC4.1 Documents & Knowledge Hub — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  clearKnowledgeState,
  getKnowledgeState,
  setKnowledgeState,
  knowledgeStoreKey,
} from "@/lib/knowledge/store";
import { createEmptyKnowledgeState, KNOWLEDGE_EXECUTION_INFLUENCE } from "@/lib/knowledge/types";
import {
  addCommentPure,
  addToCollectionPure,
  applyOcrPure,
  compareVersionsPure,
  createCollectionPure,
  createDocumentPure,
  deleteCommentPure,
  editCommentPure,
  getDocumentPure,
  getHomeKnowledgeWidgetPure,
  linkRelationPure,
  listActivityPure,
  listCommentsPure,
  listDocumentsForBusinessPure,
  listDocumentsForProjectPure,
  listDocumentsPure,
  listVersionsPure,
  restoreVersionPure,
  updateDocumentPure,
} from "@/lib/knowledge/engine";
import { searchKnowledgePure } from "@/lib/knowledge/search";
import { exportDocumentPure } from "@/lib/knowledge/export";
import { canViewerAccess } from "@/lib/aura-brain/visibility";

beforeEach(() => {
  clearKnowledgeState();
});

function base() {
  return createEmptyKnowledgeState();
}

const viewer = {
  userId: "u1",
  workspaceId: "ws1" as string | null,
  isWorkspaceMember: true,
};

describe("RC4.1 Documents", () => {
  test("create document with required fields", () => {
    const res = createDocumentPure(base(), "u1", {
      title: "Contrato Alvesz",
      description: "MSA",
      type: "contract",
      tags: ["contrato"],
      workspaceId: "ws1",
      shareWithWorkspace: true,
    });
    assert.equal(res.error, null);
    assert.ok(res.document);
    assert.equal(res.document!.title, "Contrato Alvesz");
    assert.equal(res.document!.type, "contract");
    assert.equal(res.document!.authorUserId, "u1");
    assert.equal(res.document!.visibility, "WORKSPACE");
    assert.equal(res.document!.currentVersion, 1);
    assert.equal(res.document!.ocrStatus, "pending");
    assert.ok(res.state.activity.some((a) => a.kind === "upload"));
  });

  test("list pagination and cache stamp", () => {
    let state = base();
    for (let i = 0; i < 5; i++) {
      state = createDocumentPure(state, "u1", {
        title: `Doc ${i}`,
        type: "file",
      }).state;
    }
    const page = listDocumentsPure(state, viewer, { limit: 2, offset: 0 });
    assert.equal(page.items.length, 2);
    assert.equal(page.total, 5);
    assert.ok(state.cache.listUpdatedAt || state.searchIndex);
  });
});

describe("RC4.1 OCR", () => {
  test("index OCR and reprocess", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Scan",
      type: "pdf",
      fileName: "scan.pdf",
      mimeType: "application/pdf",
    });
    state = created.state;
    const ocr = applyOcrPure(state, "u1", created.document!.id, {
      ocrText: "texto extraído do pdf sobre aura brain",
      confidence: 0.91,
      status: "ready",
    });
    assert.equal(ocr.error, null);
    assert.equal(ocr.document!.ocrStatus, "ready");
    assert.ok(ocr.document!.searchableText.includes("texto extraído"));
    state = ocr.state;
    const again = applyOcrPure(state, "u1", created.document!.id, {
      ocrText: "reprocessado com mais contexto",
      reprocess: true,
    });
    assert.ok(again.document!.searchableText.includes("reprocessado"));
    assert.ok(again.state.activity.some((a) => a.kind === "ocr"));
  });
});

describe("RC4.1 Notes", () => {
  test("markdown note autosave soft + version checkpoint", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Diário",
      type: "note",
      content: "# Hello",
    });
    state = created.state;
    const soft = updateDocumentPure(state, "u1", {
      documentId: created.document!.id,
      content: "# Hello\n\nparágrafo",
      softSave: true,
    });
    assert.equal(soft.document!.currentVersion, 1);
    state = soft.state;
    const hard = updateDocumentPure(state, "u1", {
      documentId: created.document!.id,
      content: "# Final",
      softSave: false,
      versionNote: "checkpoint",
    });
    assert.equal(hard.document!.currentVersion, 2);
    assert.equal(listVersionsPure(hard.state, created.document!.id).length, 2);
  });
});

describe("RC4.1 Versioning", () => {
  test("compare and restore versions securely", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "V1",
      type: "note",
      content: "alpha",
    });
    state = created.state;
    const id = created.document!.id;
    state = updateDocumentPure(state, "u1", {
      documentId: id,
      title: "V2",
      content: "beta",
    }).state;
    const cmp = compareVersionsPure(state, id, 1, 2);
    assert.ok(cmp.diff.some((d) => d.field === "content"));
    const denied = restoreVersionPure(state, "hacker", id, 1);
    assert.ok(denied.error);
    const restored = restoreVersionPure(state, "u1", id, 1);
    assert.equal(restored.error, null);
    assert.equal(restored.document!.content, "alpha");
    assert.ok(restored.state.activity.some((a) => a.kind === "restore"));
  });
});

describe("RC4.1 Comments", () => {
  test("add reply edit delete with history", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Doc",
      type: "file",
    });
    state = created.state;
    const id = created.document!.id;
    const c1 = addCommentPure(state, {
      userId: "u1",
      documentId: id,
      body: "raiz",
    });
    state = c1.state;
    const c2 = addCommentPure(state, {
      userId: "u1",
      documentId: id,
      body: "resposta",
      parentId: c1.comment!.id,
    });
    state = c2.state;
    assert.equal(c2.comment!.parentId, c1.comment!.id);
    const edited = editCommentPure(state, {
      userId: "u1",
      commentId: c1.comment!.id,
      body: "raiz editada",
    });
    state = edited.state;
    assert.equal(state.commentHistory.length, 1);
    const deleted = deleteCommentPure(state, {
      userId: "u1",
      commentId: c2.comment!.id,
    });
    state = deleted.state;
    assert.equal(listCommentsPure(state, id).length, 1);
  });
});

describe("RC4.1 Search", () => {
  test("finds OCR notes documents links comments tags", () => {
    let state = base();
    state = createDocumentPure(state, "u1", {
      title: "Guia",
      type: "note",
      content: "markdown especial",
      tags: ["playbook"],
    }).state;
    const pdf = createDocumentPure(state, "u1", {
      title: "PDF",
      type: "pdf",
    });
    state = pdf.state;
    state = applyOcrPure(state, "u1", pdf.document!.id, {
      ocrText: "conteudo ocr unico",
    }).state;
    state = createDocumentPure(state, "u1", {
      title: "Site",
      type: "link",
      linkPreview: {
        url: "https://example.com",
        title: "Example",
        description: "preview permanente",
        favicon: null,
        image: null,
        fetchedAt: new Date().toISOString(),
      },
    }).state;
    const commented = createDocumentPure(state, "u1", {
      title: "Comentado",
      type: "file",
    });
    state = commented.state;
    state = addCommentPure(state, {
      userId: "u1",
      documentId: commented.document!.id,
      body: "frase secreta no comentario",
    }).state;

    assert.equal(
      searchKnowledgePure(state, viewer, "ocr unico").hits.length,
      1
    );
    assert.equal(
      searchKnowledgePure(state, viewer, "markdown especial").hits.length,
      1
    );
    assert.equal(
      searchKnowledgePure(state, viewer, "playbook").hits.length,
      1
    );
    assert.equal(
      searchKnowledgePure(state, viewer, "preview permanente").hits.length,
      1
    );
    assert.equal(
      searchKnowledgePure(state, viewer, "frase secreta").hits.length,
      1
    );
  });
});

describe("RC4.1 Collections", () => {
  test("collections folders favorites archived", () => {
    let state = base();
    const doc = createDocumentPure(state, "u1", {
      title: "A",
      type: "note",
    });
    state = doc.state;
    const col = createCollectionPure(state, {
      userId: "u1",
      name: "Playbooks",
      kind: "folder",
    });
    state = col.state;
    state = addToCollectionPure(
      state,
      "u1",
      col.collection!.id,
      doc.document!.id
    ).state;
    assert.ok(
      state.documents[0].collectionIds.includes(col.collection!.id)
    );
    state = updateDocumentPure(state, "u1", {
      documentId: doc.document!.id,
      favorite: true,
      softSave: true,
    }).state;
    assert.equal(
      listDocumentsPure(state, viewer, { favoriteOnly: true }).total,
      1
    );
    state = updateDocumentPure(state, "u1", {
      documentId: doc.document!.id,
      archived: true,
      softSave: true,
    }).state;
    assert.equal(listDocumentsPure(state, viewer).total, 0);
    assert.equal(
      listDocumentsPure(state, viewer, { includeArchived: true }).total,
      1
    );
  });
});

describe("RC4.1 Projects & Business", () => {
  test("documents linked to project and business", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Spec",
      type: "note",
      projectId: "proj1",
      businessId: "biz1",
    });
    state = created.state;
    state = linkRelationPure(state, "u1", {
      documentId: created.document!.id,
      relationType: "memory",
      targetId: "mem1",
    }).state;
    assert.equal(listDocumentsForProjectPure(state, viewer, "proj1").length, 1);
    assert.equal(
      listDocumentsForBusinessPure(state, viewer, "biz1").length,
      1
    );
  });
});

describe("RC4.1 Workspace & RLS mirrors", () => {
  test("PRIVATE not visible to other workspace member", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Segredo",
      type: "note",
      visibility: "PRIVATE",
      workspaceId: "ws1",
    });
    state = created.state;
    const other = getDocumentPure(
      state,
      { userId: "u2", workspaceId: "ws1", isWorkspaceMember: true },
      created.document!.id
    );
    assert.equal(other, null);
    assert.equal(
      canViewerAccess({
        viewerUserId: "u2",
        ownerUserId: "u1",
        visibilityScope: "PRIVATE",
        workspaceId: "ws1",
        viewerWorkspaceId: "ws1",
        isWorkspaceMember: true,
      }),
      false
    );
  });

  test("WORKSPACE visible to members", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Shared",
      type: "note",
      workspaceId: "ws1",
      shareWithWorkspace: true,
    });
    state = created.state;
    const seen = getDocumentPure(
      state,
      { userId: "u2", workspaceId: "ws1", isWorkspaceMember: true },
      created.document!.id
    );
    assert.ok(seen);
  });
});

describe("RC4.1 Export & Home & executionInfluence", () => {
  test("export markdown json pdf and home widget", () => {
    let state = base();
    const created = createDocumentPure(state, "u1", {
      title: "Exportável",
      type: "note",
      content: "## corpo",
    });
    state = created.state;
    const md = exportDocumentPure(state, created.document!.id, "markdown");
    const json = exportDocumentPure(state, created.document!.id, "json");
    const pdf = exportDocumentPure(state, created.document!.id, "pdf");
    assert.ok(md?.content.includes("# Exportável"));
    assert.equal(json?.executionInfluence, "none");
    assert.ok(pdf?.content.includes("executionInfluence: none"));
    assert.equal(KNOWLEDGE_EXECUTION_INFLUENCE, "none");
    const home = getHomeKnowledgeWidgetPure(state, viewer);
    assert.equal(home.recentNotes.length, 1);
    assert.ok(listActivityPure(state, { documentId: created.document!.id }).length);
  });

  test("store key isolates workspace", () => {
    const k1 = knowledgeStoreKey("u1", null);
    const k2 = knowledgeStoreKey("u1", "ws1");
    assert.notEqual(k1, k2);
    setKnowledgeState(k1, createEmptyKnowledgeState());
    assert.equal(getKnowledgeState(k1).documents.length, 0);
  });
});
