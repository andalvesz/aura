/**
 * Link preview — title, description, favicon, image (Open Graph / meta).
 */

import {
  detectVideoLink,
  isHttpUrl,
  type LinkPreview,
} from "@/lib/smart-capture/types";

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitle(html: string): string | null {
  const og = metaContent(html, "og:title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
}

function absoluteUrl(base: string, maybeRelative: string | null): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

export function parseLinkPreviewHtml(url: string, html: string): LinkPreview {
  const favicon =
    absoluteUrl(
      url,
      metaContent(html, "og:image:favicon") ??
        html.match(
          /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
        )?.[1] ??
        "/favicon.ico"
    ) ?? null;

  return {
    url,
    title: extractTitle(html),
    description:
      metaContent(html, "og:description") ??
      metaContent(html, "description"),
    favicon: absoluteUrl(url, favicon?.startsWith("/") ? favicon : favicon),
    image: absoluteUrl(url, metaContent(html, "og:image")),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchLinkPreview(
  rawUrl: string,
  deps?: {
    fetchFn?: typeof fetch;
    timeoutMs?: number;
  }
): Promise<LinkPreview | null> {
  const url = rawUrl.trim();
  if (!isHttpUrl(url)) return null;

  const fetchFn = deps?.fetchFn ?? fetch;
  const timeoutMs = deps?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AuraSmartCapture/1.0 (+link-preview)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      return {
        url,
        title: detectVideoLink(url) ? "Vídeo" : new URL(url).hostname,
        description: null,
        favicon: absoluteUrl(url, "/favicon.ico"),
        image: null,
        fetchedAt: new Date().toISOString(),
      };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        url,
        title: new URL(url).hostname,
        description: contentType,
        favicon: absoluteUrl(url, "/favicon.ico"),
        image: null,
        fetchedAt: new Date().toISOString(),
      };
    }
    const html = (await res.text()).slice(0, 400_000);
    return parseLinkPreviewHtml(url, html);
  } catch {
    return {
      url,
      title: new URL(url).hostname,
      description: null,
      favicon: null,
      image: null,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s<>"')\]]+/gi;
  const found = text.match(re) ?? [];
  const unique = new Set(found.map((u) => u.replace(/[.,;!?]+$/, "")));
  return [...unique].filter(isHttpUrl);
}
