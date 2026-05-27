-- One-time manual pack save to Google Drive (email + cover letter + CV).
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS drive_pack_saved_at timestamptz;

COMMENT ON COLUMN public.applications.drive_pack_saved_at IS
  'Set once when the user saves the full application pack to Drive; blocks duplicate saves.';
