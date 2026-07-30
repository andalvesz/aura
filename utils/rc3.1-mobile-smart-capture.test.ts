/**
 * RC3.1 Mobile & Smart Capture — unit tests.
 * Covers: Quick Capture contracts, OCR, Links, Upload, Offline Queue,
 * Sync, Search, Preview, Attachments, Workspace/RLS mirrors, Mobile helpers,
 * executionInfluence none.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { runQuickCaptureCascade } from "@/lib/daily/cascade";
import {
  createEmptyDailyOpsState,
  type DailyFavorite,
} from "@/lib/daily/types";
import {
  toggleFavoritePure,
  updateFavoritePinsPure,
} from "@/lib/daily/engine";
import { clearDailyOpsState } from "@/lib/daily/store";
import { canViewerAccess } from "@/lib/aura-brain/visibility";
import {
  applyOcrEdit,
  extractPdfText,
  runOcr,
} from "@/lib/smart-capture/ocr";
import {
  extractUrlsFromText,
  parseLinkPreviewHtml,
} from "@/lib/smart-capture/link-preview";
import {
  mergeAcceptedTags,
  suggestTags,
} from "@/lib/smart-capture/tags";
import {
  validateCaptureFile,
  assertWorkspacePermission,
} from "@/lib/smart-capture/validation";
import {
  clearAttachmentStore,
  createAttachmentPure,
  fromCaptureInputs,
  searchAttachmentsPure,
  setAttachments,
  attachmentStoreKey,
  getAttachments,
} from "@/lib/smart-capture/attachments";
import {
  buildSyncPanelSnapshot,
  createOfflineCaptureItem,
  updateOfflineCaptureStatusPure,
} from "@/lib/smart-capture/offline-queue";
import {
  cancelUpload,
  completeUpload,
  createUploadProgress,
  failUpload,
  retryUpload,
  runParallelUploads,
  startUpload,
  tickUpload,
} from "@/lib/smart-capture/upload";
import {
  cascadeProgressFromReport,
  initialCascadeProgress,
  markCascadeStep,
} from "@/lib/smart-capture/cascade-progress";
import {
  filterFavoritesByPin,
  normalizePins,
  togglePinPure,
} from "@/lib/smart-capture/pins";
import { buildAttachmentPreview } from "@/lib/smart-capture/preview";
import { prepareVirusScan } from "@/lib/smart-capture/security";
import { estimateCompressedBytes } from "@/lib/smart-capture/compress";
import { FORM_INPUT_CLASS, ICON_BTN_CLASS } from "@/utils/dashboard-mobile";

beforeEach(() => {
  clearDailyOpsState();
  clearAttachmentStore();
});

describe("RC3.1 Quick Capture cascade", () => {
  test("Memory→Promotion→World→Cognitive→Discovery with executionInfluence none", async () => {
    const report = await runQuickCaptureCascade("mem_sc_1", {
      promoteMemory: async () => ({ error: null }),
      projectMemoryToWorld: async () => ({ error: null }),
      generateCognitive: async () => ({ error: null }),
      generateDiscoveries: async () => ({ error: null, generated: 1 }),
    });
    assert.equal(report.executionInfluence, "none");
    assert.equal(report.discoveryGenerated, 1);
    const steps = cascadeProgressFromReport(report);
    assert.equal(steps.every((s) => s.status === "done"), true);
  });

  test("cascade progress visual states", () => {
    let steps = initialCascadeProgress();
    steps = markCascadeStep(steps, "memory", "running");
    assert.equal(steps.find((s) => s.id === "memory")?.status, "running");
    steps = markCascadeStep(steps, "memory", "done");
    assert.equal(steps.find((s) => s.id === "memory")?.status, "done");
  });
});

describe("RC3.1 OCR", () => {
  test("extracts text from utf8 file buffer", async () => {
    const result = await runOcr({
      kind: "file",
      fileName: "nota.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Reunião com cliente amanhã", "utf-8"),
    });
    assert.match(result.text, /Reunião/);
    assert.equal(result.provider, "utf8");
  });

  test("pdf-parse path returns structured OcrResult", async () => {
    // Minimal invalid PDF → graceful empty, not throw
    const result = await extractPdfText(Buffer.from("%PDF-1.4 empty"));
    assert.equal(typeof result.text, "string");
    assert.equal(result.edited, false);
  });

  test("OCR edit before save", () => {
    const edited = applyOcrEdit(
      { text: "old", confidence: 0.5, provider: "utf8", edited: false },
      "texto corrigido"
    );
    assert.equal(edited.text, "texto corrigido");
    assert.equal(edited.edited, true);
  });

  test("image OCR accepts injected provider", async () => {
    const result = await runOcr({
      kind: "image",
      fileName: "scan.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      imageOcr: async () => "Contrato assinado 2026",
    });
    assert.equal(result.text, "Contrato assinado 2026");
    assert.equal(result.provider, "vision");
  });
});

describe("RC3.1 Links", () => {
  test("parses Open Graph preview", () => {
    const html = `
      <html><head>
        <title>Fallback</title>
        <meta property="og:title" content="Artigo Aura" />
        <meta property="og:description" content="Desc sobre captura" />
        <meta property="og:image" content="/img.jpg" />
        <link rel="icon" href="/favicon.ico" />
      </head></html>`;
    const preview = parseLinkPreviewHtml("https://example.com/post", html);
    assert.equal(preview.title, "Artigo Aura");
    assert.equal(preview.description, "Desc sobre captura");
    assert.ok(preview.image?.includes("img.jpg"));
    assert.ok(preview.favicon);
  });

  test("extracts urls from pasted text", () => {
    const urls = extractUrlsFromText(
      "veja https://youtu.be/abc123 e https://aura.app/docs."
    );
    assert.equal(urls.length, 2);
  });
});

describe("RC3.1 Upload", () => {
  test("progress bar, cancel, retry, error", () => {
    let p = createUploadProgress("a.pdf", 1000);
    p = startUpload(p);
    p = tickUpload(p, 400, Date.parse(p.startedAt!) + 2000);
    assert.ok(p.percent >= 40);
    assert.equal(p.status, "uploading");
    p = failUpload(p, "network");
    assert.equal(p.status, "error");
    p = retryUpload(p);
    assert.equal(p.status, "queued");
    p = startUpload(p);
    p = completeUpload(p);
    assert.equal(p.percent, 100);
    const cancelled = cancelUpload(startUpload(createUploadProgress("b.png", 10)));
    assert.equal(cancelled.status, "cancelled");
  });

  test("parallel uploads respect concurrency", async () => {
    const seen: number[] = [];
    let active = 0;
    let maxActive = 0;
    await runParallelUploads(
      [1, 2, 3, 4],
      async (n) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        seen.push(n);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      },
      2
    );
    assert.deepEqual(seen.sort(), [1, 2, 3, 4]);
    assert.ok(maxActive <= 2);
  });

  test("validates file type and size", () => {
    assert.equal(
      validateCaptureFile({
        fileName: "x.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 10,
      }).ok,
      false
    );
    assert.equal(
      validateCaptureFile({
        fileName: "foto.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1024,
      }).ok,
      true
    );
  });
});

describe("RC3.1 Offline Queue & Sync", () => {
  test("enqueue status transitions and sync panel", () => {
    let items = [
      createOfflineCaptureItem("u1", {
        description: "nota offline",
        source: "offline_sync",
      }),
    ];
    assert.equal(items[0].status, "pending");
    items = updateOfflineCaptureStatusPure(items, items[0].id, "syncing");
    items = updateOfflineCaptureStatusPure(items, items[0].id, "sent");
    const snap = buildSyncPanelSnapshot(items, new Date().toISOString());
    assert.equal(snap.sent, 1);
    assert.equal(snap.pending, 0);
    assert.ok(snap.lastSyncAt);
  });

  test("failed items counted", () => {
    let items = [
      createOfflineCaptureItem("u1", { description: "a" }),
      createOfflineCaptureItem("u1", { description: "b" }),
    ];
    items = updateOfflineCaptureStatusPure(items, items[0].id, "failed", "x");
    const snap = buildSyncPanelSnapshot(items, null);
    assert.equal(snap.failed, 1);
    assert.equal(snap.pending, 1);
  });
});

describe("RC3.1 Attachments & Search", () => {
  test("search finds OCR, links, files, tags", () => {
    const key = attachmentStoreKey("u1", null);
    const rows = [
      createAttachmentPure({
        userId: "u1",
        kind: "image",
        fileName: "recibo.png",
        mimeType: "image/png",
        sizeBytes: 10,
        ocrText: "Total R$ 120 hotel",
        tags: ["viagem"],
      }),
      createAttachmentPure({
        userId: "u1",
        kind: "link",
        fileName: "artigo",
        mimeType: "text/uri-list",
        sizeBytes: 5,
        linkPreview: {
          url: "https://example.com/deep-dive",
          title: "Deep Dive",
          description: null,
          favicon: null,
          image: null,
          fetchedAt: new Date().toISOString(),
        },
      }),
    ];
    setAttachments(key, rows);
    const byOcr = searchAttachmentsPure(getAttachments(key), "u1", "hotel");
    assert.equal(byOcr[0]?.matchField, "ocr");
    const byLink = searchAttachmentsPure(getAttachments(key), "u1", "deep-dive");
    assert.equal(byLink[0]?.matchField, "link");
    const byTag = searchAttachmentsPure(getAttachments(key), "u1", "viagem");
    assert.equal(byTag[0]?.matchField, "tags");
    const byFile = searchAttachmentsPure(getAttachments(key), "u1", "recibo");
    assert.equal(byFile[0]?.matchField, "fileName");
  });

  test("fromCaptureInputs attaches to memory", () => {
    const created = fromCaptureInputs("u1", "ws1", "mem9", [
      {
        kind: "pdf",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        ocrText: "cláusula 3",
      },
    ]);
    assert.equal(created[0].memoryId, "mem9");
    assert.equal(created[0].workspaceId, "ws1");
  });
});

describe("RC3.1 Preview", () => {
  test("builds image pdf link audio previews", () => {
    assert.equal(
      buildAttachmentPreview({
        kind: "image",
        fileName: "a.png",
        mimeType: "image/png",
        sizeBytes: 1,
        url: "data:image/png;base64,xx",
      }).kind,
      "image"
    );
    assert.equal(
      buildAttachmentPreview({
        kind: "pdf",
        fileName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        url: "blob:1",
      }).kind,
      "pdf"
    );
    assert.equal(
      buildAttachmentPreview({
        kind: "audio",
        fileName: "a.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 1,
        url: "blob:2",
      }).kind,
      "audio"
    );
    assert.equal(
      buildAttachmentPreview({
        kind: "link",
        fileName: "l",
        mimeType: "text/uri-list",
        sizeBytes: 1,
        linkPreview: {
          url: "https://x.com",
          title: "X",
          description: null,
          favicon: null,
          image: null,
          fetchedAt: new Date().toISOString(),
        },
      }).kind,
      "link"
    );
  });
});

describe("RC3.1 Tags & Pins", () => {
  test("suggests tags but merge requires acceptance", () => {
    const suggested = suggestTags({
      description: "reunião de vendas com cliente",
    });
    assert.ok(suggested.includes("reunião") || suggested.includes("negócios"));
    const merged = mergeAcceptedTags(["manual"], suggested, []);
    assert.deepEqual(merged, ["manual"]);
    const accepted = mergeAcceptedTags([], suggested, [suggested[0]]);
    assert.deepEqual(accepted, [suggested[0]]);
  });

  test("favorite pins home search feed", () => {
    let state = createEmptyDailyOpsState();
    const add = toggleFavoritePure(state, {
      userId: "u1",
      targetType: "memory",
      targetId: "m1",
      title: "Nota",
      href: "/dashboard/inbox",
      pins: ["home"],
    });
    state = add.state;
    const updated = updateFavoritePinsPure(state, {
      userId: "u1",
      targetType: "memory",
      targetId: "m1",
      pins: normalizePins(["home", "feed", "search"]),
    });
    assert.deepEqual(updated.favorite?.pins, ["home", "feed", "search"]);
    const home = filterFavoritesByPin(
      updated.state.favorites as Array<DailyFavorite & { pins?: string[] }>,
      "home"
    );
    assert.equal(home.length, 1);
    assert.deepEqual(togglePinPure(["home"], "home"), []);
  });
});

describe("RC3.1 Workspace & RLS mirrors", () => {
  test("workspace share requires workspace id", () => {
    assert.ok(
      assertWorkspacePermission({
        shareWithWorkspace: true,
        workspaceId: null,
      })
    );
    assert.equal(
      assertWorkspacePermission({
        shareWithWorkspace: true,
        workspaceId: "ws",
      }),
      null
    );
  });

  test("viewer access private vs workspace", () => {
    assert.equal(
      canViewerAccess({
        viewerUserId: "u1",
        ownerUserId: "u1",
        visibilityScope: "PRIVATE",
        workspaceId: null,
        isWorkspaceMember: false,
      }),
      true
    );
    assert.equal(
      canViewerAccess({
        viewerUserId: "u2",
        ownerUserId: "u1",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws",
        viewerWorkspaceId: "ws",
        isWorkspaceMember: true,
      }),
      true
    );
    assert.equal(
      canViewerAccess({
        viewerUserId: "u2",
        ownerUserId: "u1",
        visibilityScope: "PRIVATE",
        workspaceId: null,
        isWorkspaceMember: false,
      }),
      false
    );
  });

  test("virus scan structure prepared", () => {
    const scan = prepareVirusScan();
    assert.equal(scan.provider, "prepared");
    assert.equal(scan.status, "skipped");
  });
});

describe("RC3.1 Mobile & Performance helpers", () => {
  test("touch target classes present", () => {
    assert.match(FORM_INPUT_CLASS, /min-h-11/);
    assert.match(ICON_BTN_CLASS, /min-h-11/);
  });

  test("image compression estimate", () => {
    const est = estimateCompressedBytes(1_000_000, 0.7);
    assert.ok(est < 1_000_000);
    assert.ok(est >= 1024);
  });
});
