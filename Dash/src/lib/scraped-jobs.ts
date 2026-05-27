import { supabase } from "@/integrations/supabase/client";
import type { JobApplicationStatus } from "./job-list-utils";

export type ScrapedJob = {
  id: string;
  source: string | null;
  site: string | null;
  source_url: string;
  title: string;
  company: string | null;
  company_summary: string | null;
  role_description: string | null;
  location: string | null;
  county: string | null;
  description: string | null;
  description_summary: string | null;
  requirements: string | null;
  responsibilities: string | null;
  job_type: string | null;
  work_type: string | null;
  salary_text: string | null;
  application_url: string | null;
  application_email: string | null;
  application_method: string | null;
  deadline: string | null;
  deadline_text: string | null;
  sector: string | null;
  experience_level: string | null;
  education_level: string | null;
  scraped_at: string | null;
  application_status?: JobApplicationStatus | null;
  logo_url?: string | null;
  match_score?: number;
  match_reason?: string;
};

export const MARKETPLACE_BOARDS = [
  { id: "all", label: "All boards" },
  { id: "Fuzu", label: "Fuzu" },
  { id: "BrighterMonday", label: "BrighterMonday" },
  { id: "MyJobMag", label: "MyJobMag" },
  { id: "MyJobsInKenya", label: "MyJobsInKenya" },
  { id: "LinkedIn", label: "LinkedIn" },
] as const;

export type MarketplaceBoardId = (typeof MARKETPLACE_BOARDS)[number]["id"];

const SCRAPED_JOB_LIST_SELECT = [
  "id",
  "source",
  "site",
  "source_url",
  "title",
  "company",
  "location",
  "county",
  "description_summary",
  "job_type",
  "work_type",
  "salary_text",
  "application_url",
  "application_email",
  "application_method",
  "deadline",
  "deadline_text",
  "sector",
  "experience_level",
  "education_level",
  "scraped_at",
  "logo_url",
].join(", ");

export function boardLabel(job: ScrapedJob): string {
  const src = job.source?.trim();
  if (src === "serpapi_google_jobs") {
    return job.site?.trim() || "Google Jobs";
  }
  if (src === "linkedin_apify") {
    return "LinkedIn";
  }
  // Standardize naming conventions and casings
  if (src === "fuzu") return "Fuzu";
  if (src === "brightermonday") return "BrighterMonday";
  if (src === "myjobmag") return "MyJobMag";
  if (src === "myjobsinkenya") return "MyJobsInKenya";
  if (src === "linkedin") return "LinkedIn";

  return job.site?.trim() || src || "Unknown";
}

export async function listScrapedJobs(opts?: {
  source?: string;
  search?: string;
  limit?: number;
}): Promise<ScrapedJob[]> {
  let q = supabase
    .from("scraped_jobs")
    .select(SCRAPED_JOB_LIST_SELECT)
    .order("scraped_at", { ascending: false })
    .limit(opts?.limit ?? 500);

  if (opts?.source && opts.source !== "all") {
    q = q.or(`source.eq.${opts.source},site.eq.${opts.source}`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as ScrapedJob[];
  const term = opts?.search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter(
      (j) =>
        j.title?.toLowerCase().includes(term) ||
        j.company?.toLowerCase().includes(term) ||
        boardLabel(j).toLowerCase().includes(term),
    );
  }
  return rows;
}

export async function getScrapedJob(id: string): Promise<ScrapedJob | null> {
  const { data, error } = await supabase
    .from("scraped_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ScrapedJob | null;
}

/** Scans a job to determine if it is a Form Application or an Email Application */
export function scanApplicationMethod(job: {
  application_method?: string | null;
  application_email?: string | null;
  application_url?: string | null;
  description?: string | null;
  role_description?: string | null;
  requirements?: string | null;
  source?: string | null;
  site?: string | null;
}): "email" | "form" {
  // 1. Check direct fields first
  if (job.application_method) {
    const method = job.application_method.toLowerCase();
    if (method.includes("email")) return "email";
    if (
      method.includes("form") ||
      method.includes("online") ||
      method.includes("link") ||
      method.includes("web") ||
      method.includes("portal")
    ) {
      return "form";
    }
  }

  if (job.application_email) {
    return "email";
  }

  if (job.application_url) {
    const url = job.application_url.toLowerCase();
    if (url.startsWith("mailto:")) return "email";
    return "form";
  }

  // 2. Scan text fields: description, role_description, requirements
  const combinedText = [
    job.description,
    job.role_description,
    job.requirements,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Check for email keywords
  const emailKeywords = [
    "send your cv to",
    "send your resume to",
    "email your cv",
    "email your resume",
    "send cv",
    "send resume",
    "email to:",
    "apply via email",
    "applications to",
    "submit cv to",
    "submit resume to",
    "sent to cv",
    "cv sent to",
    "recruitment@",
    "careers@",
    "jobs@"
  ];

  if (emailKeywords.some((keyword) => combinedText.includes(keyword))) {
    return "email";
  }

  // Check for email address pattern (e.g. user@domain.com)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(combinedText)) {
    return "email";
  }

  const formKeywords = [
    "apply online",
    "application form",
    "online application",
    "apply through",
    "apply via the link",
    "career portal",
    "careers portal",
    "recruitment portal",
    "google form",
    "submit your application online",
    "click here to apply"
  ];

  if (formKeywords.some((keyword) => combinedText.includes(keyword))) {
    return "form";
  }

  // Default fallback: check if source_url exists and looks like a form, or fallback to form
  const board = (job.source || job.site || "").toLowerCase();
  if (board.includes("fuzu") || board.includes("brightermonday") || board.includes("linkedin")) {
    return "form";
  }

  return "form";
}

