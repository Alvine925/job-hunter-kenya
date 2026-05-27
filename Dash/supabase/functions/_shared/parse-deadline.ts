/** Parse application deadlines from Kenyan job board markdown/text. */
export function parseJobDeadline(text: string): { deadline: string | null; deadline_text: string | null } {
  if (!text) return { deadline: null, deadline_text: null };

  const patterns: RegExp[] = [
    /(?:contract\s+)?deadline\s*:?\s*([A-Za-z]{3},?\s+[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i,
    /(?:closing|closes|apply\s+by|applications?\s+close)\s*(?:on|by|:)?\s*([A-Za-z]{3},?\s+[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/i,
    /(?:deadline|closing|expires?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(?:deadline|closing)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const raw = m[0].trim();
    const datePart = m[1].trim();
    const iso = parseDateToIso(datePart);
    if (iso) return { deadline: iso, deadline_text: raw };
  }

  return { deadline: null, deadline_text: null };
}

function parseDateToIso(input: string): string | null {
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slash) {
    let y = parseInt(slash[3], 10);
    if (y < 100) y += 2000;
    const m = slash[1].padStart(2, "0");
    const d = slash[2].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const cleaned = input
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/,/g, "");

  const parsed = Date.parse(cleaned);
  if (Number.isNaN(parsed)) return null;

  const dt = new Date(parsed);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDeadlineActive(deadline: string | null | undefined, todayIso?: string): boolean {
  if (!deadline) return true;
  const today = todayIso ?? new Date().toISOString().slice(0, 10);
  return deadline >= today;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
