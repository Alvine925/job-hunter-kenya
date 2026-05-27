/** Valid employer apply-to address for display and sending. */
export function normalizeApplyEmail(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return null;
  if (!s.includes("@") || s.length < 5) return null;
  return s;
}

export function hasApplicationRecipientEmail(
  jobEmail?: unknown,
  applicationEmail?: unknown,
  draftTo?: unknown,
): boolean {
  return !!(
    normalizeApplyEmail(jobEmail) ??
    normalizeApplyEmail(applicationEmail) ??
    normalizeApplyEmail(draftTo)
  );
}

export function driveFolderUrl(folderId?: string | null): string | null {
  if (!folderId?.trim()) return null;
  return `https://drive.google.com/drive/folders/${folderId.trim()}`;
}

/** Full pack (email + letter + CV) was saved via Save to Drive — one-time only. */
export function isPackSavedToDrive(application?: {
  drive_pack_saved_at?: string | null;
} | null): boolean {
  return !!application?.drive_pack_saved_at;
}
