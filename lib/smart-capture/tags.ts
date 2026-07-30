/**
 * Automatic tag suggestions — never mandatory.
 */

const KEYWORD_TAGS: Array<{ re: RegExp; tag: string }> = [
  { re: /\b(reuni[aã]o|meeting|call)\b/i, tag: "reunião" },
  { re: /\b(viagem|flight|hotel|passagem)\b/i, tag: "viagem" },
  { re: /\b(finan[cç]|pagamento|fatura|orcamento|orçamento)\b/i, tag: "finanças" },
  { re: /\b(sa[uú]de|m[eé]dico|treino|academia)\b/i, tag: "saúde" },
  { re: /\b(ideia|insight|brainstorm)\b/i, tag: "ideia" },
  { re: /\b(cliente|lead|venda|proposta)\b/i, tag: "negócios" },
  { re: /\b(familia|família|pessoal)\b/i, tag: "pessoal" },
  { re: /\b(pdf|documento|contrato)\b/i, tag: "documento" },
  { re: /\b(foto|imagem|print|screenshot)\b/i, tag: "imagem" },
  { re: /\b(audio|áudio|grava[cç][aã]o|podcast)\b/i, tag: "áudio" },
  { re: /\b(v[ií]deo|youtube|vimeo)\b/i, tag: "vídeo" },
  { re: /\b(link|url|artigo)\b/i, tag: "link" },
];

export function suggestTags(input: {
  title?: string;
  description?: string;
  ocrText?: string;
  links?: string[];
  fileNames?: string[];
  existingTags?: string[];
  max?: number;
}): string[] {
  const blob = [
    input.title ?? "",
    input.description ?? "",
    input.ocrText ?? "",
    ...(input.links ?? []),
    ...(input.fileNames ?? []),
  ]
    .join("\n")
    .toLowerCase();

  const existing = new Set(
    (input.existingTags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const out: string[] = [];
  const max = input.max ?? 8;

  for (const { re, tag } of KEYWORD_TAGS) {
    if (out.length >= max) break;
    if (existing.has(tag.toLowerCase())) continue;
    if (re.test(blob)) {
      out.push(tag);
      existing.add(tag.toLowerCase());
    }
  }

  // Hashtag-like tokens already typed
  const hashTags = blob.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  for (const h of hashTags) {
    if (out.length >= max) break;
    const tag = h.slice(1).toLowerCase();
    if (!existing.has(tag)) {
      out.push(tag);
      existing.add(tag);
    }
  }

  return out;
}

export function mergeAcceptedTags(
  manual: string[],
  suggested: string[],
  acceptedSuggested: string[]
): string[] {
  const accepted = new Set(
    acceptedSuggested.map((t) => t.trim().toLowerCase()).filter(Boolean)
  );
  const fromSuggested = suggested.filter((t) =>
    accepted.has(t.trim().toLowerCase())
  );
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const t of [...manual, ...fromSuggested]) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(t.trim());
  }
  return merged;
}
