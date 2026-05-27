/** Application summary attached to job list rows from the API. */
export type JobApplicationStatus = {
  has_pack: boolean;
  has_interview_prep: boolean;
  status: string | null;
  label: string | null;
};

export function applicationStatusFromRow(app: {
  status?: string | null;
  cover_letter?: string | null;
  pack_questions?: string | null;
  email_body?: string | null;
  email_subject?: string | null;
  interview_questions?: string | null;
  prepared_at?: string | null;
  drive_url?: string | null;
} | null | undefined): JobApplicationStatus | null {
  if (!app) return null;

  const hasContent = !!(
    app.cover_letter?.trim() ||
    app.pack_questions ||
    (app.email_body?.trim() && app.email_subject?.trim())
  );
  const hasPack = hasContent && !!(app.prepared_at || app.drive_url || app.status);
  const hasInterview = !!app.interview_questions;

  let label: string | null = null;
  if (app.status === "sent") label = "Applied";
  else if (hasPack) label = "Pack ready";
  else if (app.status === "draft" || app.status === "needs_review") label = "Draft";

  return {
    has_pack: hasPack,
    has_interview_prep: hasInterview,
    status: app.status ?? null,
    label,
  };
}

export function jobHasApplicationPack(job: {
  application_status?: JobApplicationStatus | null;
}): boolean {
  return !!job.application_status?.has_pack;
}
