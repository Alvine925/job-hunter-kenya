/** Plain-text document segments for Google Docs formatting. */
export type DocSegment = { text: string; bold: boolean };

/** Remove markdown and typographic noise for professional documents. */
export function sanitizePlainDocumentText(text: string): string {
  let s = text.replace(/\r\n/g, "\n");

  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/^[\*\-]\s+/gm, "");
  s = s.replace(/^---+\s*$/gm, "");
  s = s.replace(/[—–]/g, "-");
  s = s.replace(/\u2013|\u2014/g, "-");
  s = s.replace(/_{2,}/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]+\n/g, "\n");

  return s.trim();
}

/** Section titles like "1. Introduction" — bold in Google Docs. */
function isCoverLetterSectionTitle(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/^\d+\.\s+[A-Za-z]/.test(t)) return true;
  if (/^(Dear\s|Yours\s|Sincerely|Kind\s+regards|Best\s+regards)/i.test(t)) return false;
  return false;
}

export function coverLetterToDocSegments(raw: string): DocSegment[] {
  const text = sanitizePlainDocumentText(raw);
  if (!text) return [{ text: "", bold: false }];

  const lines = text.split("\n");
  const segments: DocSegment[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) segments.push({ text: "\n", bold: false });
    const line = lines[i];
    segments.push({ text: line, bold: isCoverLetterSectionTitle(line) });
  }

  return segments;
}

/** Today's date for cover letters (Africa/Nairobi). */
export function formatKenyanLetterDate(d = new Date()): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
}

/** Replace [Date] placeholders and ensure one real letter date at the top. */
export function applyCoverLetterDate(raw: string, letterDate?: string): string {
  const dateLine = letterDate ?? formatKenyanLetterDate();
  let s = sanitizePlainDocumentText(raw);

  s = s.replace(/^\[Date\]\s*\n?/i, "");
  s = s.replace(/^\[date\]\s*\n?/i, "");

  const lines = s.split("\n");
  const firstContent = lines.findIndex((l) => l.trim().length > 0);
  if (firstContent >= 0) {
    const first = lines[firstContent].trim();
    const looksLikeDate = /^\d{1,2}[\/\-\.]\d{1,2}|^\w+\s+\d{1,2},?\s+\d{4}|^\d{1,2}\s+\w+\s+\d{4}/i.test(first);
    if (looksLikeDate && first !== dateLine) {
      lines.splice(firstContent, 1);
      s = lines.join("\n").trim();
    }
  }

  if (!s.startsWith(dateLine)) {
    s = `${dateLine}\n\n${s}`;
  }

  return s.trim();
}

export function formatCoverLetterForStorage(raw: string, letterDate?: string): string {
  return applyCoverLetterDate(raw, letterDate);
}
