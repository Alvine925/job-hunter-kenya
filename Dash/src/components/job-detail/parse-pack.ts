export type PackQa = { question: string; answer: string };

export function parsePackQuestions(raw: string | null | undefined): PackQa[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parsePackAnswers(raw: string | null | undefined): {
  keyFacts: { label: string; value: string }[];
  siteProfileName: string | null;
} {
  if (!raw) return { keyFacts: [], siteProfileName: null };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { keyFacts: parsed, siteProfileName: null };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.key_facts)) {
      return {
        keyFacts: parsed.key_facts,
        siteProfileName: parsed.site_profile_name ?? null,
      };
    }
  } catch {
    /* ignore */
  }
  return { keyFacts: [], siteProfileName: null };
}
