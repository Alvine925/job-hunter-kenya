/** Strip markdown from cover letters for display and draft save (matches server rules). */
export function sanitizePlainDocumentText(text: string): string {
  let s = text.replace(/\r\n/g, "\n");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/^[\*\-]\s+/gm, "");
  s = s.replace(/^---+\s*$/gm, "");
  s = s.replace(/[—–]/g, "-");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
