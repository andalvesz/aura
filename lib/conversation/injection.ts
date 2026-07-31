/**
 * Prompt injection guards — content never redefines policy or tool access.
 */

const BLOCK_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: "ignore_policy", re: /\bignora(?:r)?\s+(?:as\s+)?pol[ií]ticas?\b|\bignore\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|policies)\b/i },
  { id: "reveal_secret", re: /\brevel[ae]\s+(?:o\s+)?segredo|\breveal\s+(?:the\s+)?secret|\bapi[_-]?key\b|\bservice\s*role\b/i },
  { id: "execute_tool", re: /\bexecut[ae]\s+(?:a\s+)?ferramenta|\brun\s+(?:the\s+)?tool|\binvoke\s+tool\b|\bshell\b|\bpsql\b/i },
  { id: "change_workspace", re: /\bmude\s+(?:o\s+)?workspace|\bswitch\s+workspace\s+as\s+admin|\belevar\s+permiss/i },
  { id: "service_role", re: /\buse\s+service\s+role\b|\bSUPABASE_SERVICE_ROLE\b/i },
  { id: "bypass_confirm", re: /\bsem\s+confirma(?:ção|cao)\b|\bskip\s+confirmation\b|\bbypass\s+(?:policy|confirm)/i },
];

export function detectPromptInjection(text: string): {
  blocked: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(text)) reasons.push(p.id);
  }
  return { blocked: reasons.length > 0, reasons };
}

/** Mark untrusted content so the composer never follows instructions inside it. */
export function wrapUntrustedContent(label: string, body: string): string {
  return `[UNTRUSTED_CONTENT source="${label}"]\n${body}\n[/UNTRUSTED_CONTENT]`;
}

export function stripUntrustedInstructions(text: string): string {
  return text
    .replace(/\[UNTRUSTED_CONTENT[^\]]*\][\s\S]*?\[\/UNTRUSTED_CONTENT\]/gi, "[conteúdo externo omitido]")
    .trim();
}
