/**
 * AI analyst pass for board scrapers (ScrapingBee HTML -> structured scraped_jobs row).
 */
import { runJobListingAnalyst, type JobListingAnalysis } from "./job-agents.ts";
import { parseJobDeadline } from "./parse-deadline.ts";
import { pickBestApplicationEmail } from "./site-email-profiles/extract-email.ts";
import { resolveSiteEmailProfile } from "./site-email-profiles/index.ts";
import {
  isAggregatedTitle,
  isInvalidEmployer,
  isJobBoardHost,
  isPlaceholderJobText,
  parseEmployerFromMarkdown,
  resolveEmployerCompany,
  sourceLabelFromUrl,
} from "./scrape-utils.ts";
export type ScrapedJobCatalogRow = {
  source: string;
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
  application_method: string;
  contact_person: string | null;
  contact_phone: string | null;
  deadline: string | null;
  deadline_text: string | null;
  sector: string | null;
  experience_level: string | null;
  education_level: string | null;
};

function emptyIfPlaceholder(v: string | undefined | null): string | null {
  if (!v?.trim() || isPlaceholderJobText(v)) return null;
  return v.trim();
}

function stripAnalysisPlaceholders(a: JobListingAnalysis): JobListingAnalysis {
  const out = { ...a };
  for (const key of [
    "requirements",
    "responsibilities",
    "role_description",
    "company_summary",
    "description_summary",
    "description",
  ] as const) {
    const v = out[key];
    if (typeof v === "string" && isPlaceholderJobText(v)) out[key] = "";
  }
  if (isInvalidEmployer(out.company)) out.company = "";
  return out;
}

/** Pipe-separated AI lists -> newline bullets for storage. */
function normalizeBulletField(value: string | null | undefined): string | null {
  const v = emptyIfPlaceholder(value);
  if (!v) return null;
  if (v.includes("|")) {
    return v.split("|").map((s) => s.trim()).filter(Boolean).join("\n");
  }
  return v;
}

function cleanScrapedDescription(pageText: string): string {
  const lines = pageText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 12)
    .filter((l) => !/^(home|jobs|login|register|menu|search|share|cookie)/i.test(l))
    .filter((l) => !/^https?:\/\//i.test(l));
  const body = lines.join("\n").trim();
  return body.slice(0, 15_000) || pageText.slice(0, 15_000);
}

function resolveApplicationMethod(
  method: string | undefined,
  email: string | null,
  sourceUrl: string,
  appUrl: string | null,
): ScrapedJobCatalogRow["application_method"] {
  const m = (method ?? "").toLowerCase();
  
  if (email && email.trim().length > 0) {
    const isListingUrl = !appUrl || appUrl.trim() === "" || appUrl === sourceUrl;
    if (isListingUrl || m === "email") {
      return "email";
    }
  }

  if (m === "email" || m === "form") return m;
  return email ? "email" : "unknown";
}

export async function analyzeBoardJobListing(params: {
  sourceUrl: string;
  pageText: string;
  fallbackSource?: string;
}): Promise<ScrapedJobCatalogRow | null> {
  const source = sourceLabelFromUrl(params.sourceUrl, params.fallbackSource ?? "Unknown");
  const siteProfile = resolveSiteEmailProfile(params.sourceUrl, source);
  const regexEmail = pickBestApplicationEmail(params.pageText);

  const siteBlock = siteProfile
    ? `\nSITE (${siteProfile.name}): ${siteProfile.emailExtractionNote}\n`
    : "";
  const emailHint = regexEmail
    ? `\nREGEX APPLICATION EMAIL (prefer if valid): ${regexEmail}\n`
    : "";

  let analysis: JobListingAnalysis;
  try {
    analysis = await runJobListingAnalyst({
      source_url: params.sourceUrl,
      source,
      pageText: params.pageText,
      siteEmailHint: siteBlock + emailHint,
    });
  } catch (e) {
    console.error("AI analyst failed for", params.sourceUrl, e);
    return null;
  }

  analysis = stripAnalysisPlaceholders(analysis);

  if (analysis.is_valid_job === false) return null;
  if (!analysis.title?.trim() || isAggregatedTitle(analysis.title)) return null;

  let host = "";
  try {
    host = new URL(params.sourceUrl).hostname;
  } catch { /* ignore */ }

  const pageDescription = cleanScrapedDescription(params.pageText);

  const employerFromPage = parseEmployerFromMarkdown(
    pageDescription,
    params.sourceUrl,
  );
  const employerFromTitle = resolveEmployerCompany({
    title: analysis.title,
    url: params.sourceUrl,
    markdown: params.pageText,
    ogSiteName: null,
  });

  const boardCompany = isJobBoardHost(host) ||
    /^(linkedin|brightermonday|myjobmag|fuzu|various|aggregated)/i.test(analysis.company ?? "");
  let company = boardCompany
    ? (employerFromPage || employerFromTitle || emptyIfPlaceholder(analysis.company))
    : (emptyIfPlaceholder(analysis.company) || employerFromPage || employerFromTitle);

  if (company && isInvalidEmployer(company)) {
    company = null;
  }

  const application_email = emptyIfPlaceholder(analysis.application_email) ?? regexEmail;
  const { deadline, deadline_text } = parseJobDeadline(
    analysis.deadline_text || params.pageText.slice(0, 8000),
  );

  const description = pageDescription;

  return {
    source,
    source_url: params.sourceUrl,
    title: analysis.title.trim(),
    company,
    company_summary: emptyIfPlaceholder(analysis.company_summary),
    role_description: emptyIfPlaceholder(analysis.role_description),
    location: emptyIfPlaceholder(analysis.location),
    county: emptyIfPlaceholder(analysis.county),
    description,
    description_summary: emptyIfPlaceholder(analysis.description_summary) ??
      emptyIfPlaceholder(analysis.role_description)?.slice(0, 1200) ??
      null,
    requirements: normalizeBulletField(analysis.requirements),
    responsibilities: normalizeBulletField(analysis.responsibilities),
    job_type: emptyIfPlaceholder(analysis.job_type),
    work_type: emptyIfPlaceholder(analysis.work_type),
    salary_text: emptyIfPlaceholder(analysis.salary_text),
    application_url: emptyIfPlaceholder(analysis.application_url) ?? params.sourceUrl,
    application_email,
    application_method: resolveApplicationMethod(
      analysis.application_method,
      application_email,
      params.sourceUrl,
      emptyIfPlaceholder(analysis.application_url)
    ),
    contact_person: emptyIfPlaceholder(analysis.contact_person),
    contact_phone: emptyIfPlaceholder(analysis.contact_phone),
    deadline,
    deadline_text: deadline_text || emptyIfPlaceholder(analysis.deadline_text),
    sector: emptyIfPlaceholder(analysis.sector),
    experience_level: emptyIfPlaceholder(analysis.experience_level),
    education_level: emptyIfPlaceholder(analysis.education_level),
  };
}
