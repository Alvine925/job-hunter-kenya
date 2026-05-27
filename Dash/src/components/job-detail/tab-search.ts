export type JobDetailTab = "overview" | "company" | "apply";

/** Which compose panels are visible on the Apply tab. */
export type ApplyComposeView = "both" | "email" | "letter";

/** Which block is shown on the Apply tab. */
export type ApplySection = "application" | "matching" | "qualifications" | "interview";

export type JobDetailSearch = {
  tab?: JobDetailTab;
  view?: ApplyComposeView;
  section?: ApplySection;
  /** Mock interview sheet open (`interview=open`). */
  interview?: "open";
  /** Application pack preview (`preview=preview`). */
  preview?: "preview";
};

export function parseJobDetailTab(value: unknown): JobDetailTab | undefined {
  if (value === "overview" || value === "company" || value === "apply") return value;
  return undefined;
}

export function parseApplyComposeView(value: unknown): ApplyComposeView {
  if (value === "email" || value === "letter") return value;
  return "both";
}

export function parseApplySection(value: unknown): ApplySection | undefined {
  if (value === "interview") return "interview";
  if (value === "application") return "application";
  if (value === "matching") return "matching";
  if (value === "qualifications") return "qualifications";
  return undefined;
}

/** Default Apply sub-section when `section` is omitted from the URL. */
export function resolveApplySection(section: ApplySection | undefined): ApplySection {
  return section ?? "application";
}

export function parseInterviewOpen(value: unknown): boolean {
  return value === "open" || value === "1" || value === true;
}

export function parsePreviewOpen(value: unknown): boolean {
  return value === "preview" || value === "open" || value === "1" || value === true;
}

export type JobDetailSearchOpts = {
  section?: ApplySection;
  interviewOpen?: boolean;
  previewOpen?: boolean;
};

export function jobDetailSearchFromTab(
  tab: JobDetailTab,
  applyView: ApplyComposeView = "both",
  opts?: JobDetailSearchOpts,
): JobDetailSearch {
  if (tab === "overview") return {};
  if (tab !== "apply") return { tab };

  const out: JobDetailSearch = { tab };
  if (applyView !== "both") out.view = applyView;
  if (opts?.section === "interview") out.section = "interview";
  if (opts?.section === "matching") out.section = "matching";
  if (opts?.section === "qualifications") out.section = "qualifications";
  if (opts?.section === "application") out.section = "application";
  if (opts?.interviewOpen) out.interview = "open";
  if (opts?.previewOpen) out.preview = "preview";
  return out;
}

/** Normalize raw router search into a stable job-detail query. */
export function parseJobDetailSearch(search: Record<string, unknown>): JobDetailSearch {
  const section = parseApplySection(search.section);
  let tab = parseJobDetailTab(search.tab);
  if (section === "interview" || section === "matching" || section === "qualifications") tab = tab ?? "apply";
  const interview = parseInterviewOpen(search.interview) ? ("open" as const) : undefined;
  const preview = parsePreviewOpen(search.preview) ? ("preview" as const) : undefined;
  const view = tab === "apply" ? parseApplyComposeView(search.view) : undefined;

  const out: JobDetailSearch = {};
  if (tab && tab !== "overview") out.tab = tab;
  if (section) out.section = section;
  if (interview) out.interview = interview;
  if (preview) out.preview = preview;
  if (tab === "apply" && view && view !== "both") out.view = view;
  return out;
}
