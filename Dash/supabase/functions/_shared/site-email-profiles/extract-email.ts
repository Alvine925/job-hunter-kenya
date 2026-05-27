const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const IGNORE_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "newsletter",
  "webmaster",
]);

export const IGNORE_DOMAINS = new Set([
  "myjobsinkenya.com",
  "brightermonday.co.ke",
  "myjobmag.co.ke",
  "fuzu.com",
  "linkedin.com",
  "jobwebkenya.com",
  "corporatestaffing.co.ke",
]);

/** Phrases that suggest the next token or line contains the apply-to email. */
const APPLY_CONTEXT =
  /(?:send|submit|email|forward|apply|mail|forwarding)\s+(?:your\s+)?(?:application|cv|resume|curriculum\s+vitae|documents?|details?|profile)?\s*(?:to|at|via|on|through|using)\s*:?\s*|(?:applications?|cvs?|resumes?)\s+(?:should\s+be\s+)?(?:sent|submitted|emailed)\s+(?:to|at)\s*:?\s*|(?:email|e-mail)\s*(?:address\s*)?:\s*/gi;

function normalizeEmail(raw: string) {
  return raw.replace(/^mailto:/i, "").trim().toLowerCase();
}

function scoreEmail(email: string, text: string, index: number): number {
  const [local, domain] = email.split("@");
  if (!local || !domain) return -1;
  if (IGNORE_LOCAL_PARTS.has(local)) return -1;
  if (IGNORE_DOMAINS.has(domain)) return -1;

  let score = 10;
  const window = text.slice(Math.max(0, index - 120), index + 120).toLowerCase();
  if (/apply|application|cv|resume|submit|send|how to apply|closing date/.test(window)) score += 30;
  if (/gmail\.com|yahoo\.com|outlook\.com|\.co\.ke/.test(email) && /apply|application|send|submit/.test(window)) {
    score += 20;
  }
  if (/terms and conditions|how to apply|application instructions/.test(window)) score += 25;
  if (local.includes("job") || local.includes("hr") || local.includes("career") || local.includes("recruit")) {
    score += 15;
  }
  if (domain.endsWith(".co.ke") || domain.endsWith(".ke")) score += 10;
  return score;
}

export function extractApplicationEmails(text: string): string[] {
  if (!text) return [];

  const found = new Map<string, number>();

  for (const m of text.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)) {
    const email = normalizeEmail(m[1]);
    const idx = m.index ?? 0;
    const s = scoreEmail(email, text, idx);
    if (s >= 0) found.set(email, Math.max(found.get(email) ?? 0, s + 20));
  }

  for (const m of text.matchAll(EMAIL_RE)) {
    const email = normalizeEmail(m[0]);
    const idx = m.index ?? 0;
    const s = scoreEmail(email, text, idx);
    if (s >= 0) found.set(email, Math.max(found.get(email) ?? 0, s));
  }

  // Boost emails appearing after apply-context phrases
  let ctx: RegExpExecArray | null;
  const ctxRe = new RegExp(APPLY_CONTEXT.source, "gi");
  while ((ctx = ctxRe.exec(text)) !== null) {
    const slice = text.slice(ctx.index, ctx.index + 200);
    const near = slice.match(EMAIL_RE);
    if (near) {
      const email = normalizeEmail(near[0]);
      const s = scoreEmail(email, text, ctx.index);
      if (s >= 0) found.set(email, Math.max(found.get(email) ?? 0, s + 40));
    }
  }

  return [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);
}

export function pickBestApplicationEmail(text: string): string | null {
  const list = extractApplicationEmails(text);
  return list[0] ?? null;
}
