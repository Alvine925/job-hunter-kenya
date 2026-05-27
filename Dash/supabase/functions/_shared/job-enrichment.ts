import { scrapeUrlMarkdown } from "./firecrawl.ts";
import { parseJobDeadline } from "./parse-deadline.ts";
import {
  isJobBoardHost,
  isInvalidEmployer,
  isPlaceholderJobText,
  parseEmployerFromMarkdown,
  resolveEmployerCompany,
} from "./scrape-utils.ts";

function stripPlaceholderFields<T extends Record<string, unknown>>(analysis: T): T {
  const out = { ...analysis };
  for (const key of ["requirements", "responsibilities", "role_description", "company_summary"] as const) {
    const v = out[key];
    if (typeof v === "string" && isPlaceholderJobText(v)) out[key] = "" as T[typeof key];
  }
  if (typeof out.company === "string" && isInvalidEmployer(out.company)) {
    out.company = "" as T["company"];
  }
  return out;
}
import {
  enrichScrapedJobForAnalysis,
  mergeEmailApplicationFields,
  resolveSiteEmailProfile,
} from "./site-email-profiles/index.ts";
import { runJobMatchingAgent } from "./job-agents.ts";

export async function analyzeScrapedJob(params: {
  profileSummary: string;
  job: {
    title: string;
    source_url: string;
    source: string;
    description?: string | null;
    company?: string | null;
    location?: string | null;
  };
  matchingTemplate?: string | null;
}) {
  const enriched = await enrichScrapedJobForAnalysis(
    {
      title: params.job.title,
      source_url: params.job.source_url,
      source: params.job.source,
      description: params.job.description ?? null,
      company: params.job.company,
      location: params.job.location,
    },
    scrapeUrlMarkdown,
  );

  const siteProfile = resolveSiteEmailProfile(enriched.source_url, enriched.source);
  const siteBlock = siteProfile
    ? `\nSITE (${siteProfile.name}): ${siteProfile.emailExtractionNote}\nDefault application method on this site: email.\n`
    : "";

  const preExtracted = enriched.extracted_application_email
    ? `\nREGEX-EXTRACTED APPLICATION EMAIL (prefer if valid): ${enriched.extracted_application_email}\n`
    : "";

  const employerHint = enriched.company
    ? `\nPARSED EMPLOYER (use this for company field): ${enriched.company}\n`
    : "";

  let analysis = await runJobMatchingAgent({
    profileSummary: params.profileSummary,
    job: {
      title: enriched.title,
      source_url: enriched.source_url,
      description: enriched.description,
    },
    template: params.matchingTemplate,
    siteEmailHint: siteBlock + preExtracted + employerHint,
  });

  analysis = stripPlaceholderFields(analysis);

  const merged = mergeEmailApplicationFields(analysis, enriched, enriched.source_url);

  let host = "";
  try {
    host = new URL(enriched.source_url).hostname;
  } catch { /* ignore */ }

  const boardCompany = isJobBoardHost(host) ||
    /^(linkedin|brightermonday|myjobmag|fuzu|various|aggregated)/i.test(analysis.company ?? "");
  const employerFromPage = parseEmployerFromMarkdown(enriched.description ?? "", enriched.source_url);
  const employerFromTitle = resolveEmployerCompany({
    title: enriched.title,
    url: enriched.source_url,
    markdown: enriched.description,
    ogSiteName: null,
  });
  const company = boardCompany
    ? (employerFromPage || employerFromTitle || enriched.company || "")
    : (analysis.company || employerFromPage || employerFromTitle || enriched.company || "");

  const parsedDeadline = parseJobDeadline(enriched.description ?? "");

  return {
    ...analysis,
    ...merged,
    company: company || analysis.company,
    company_summary: analysis.company_summary ?? "",
    role_description: analysis.role_description ?? "",
    description: enriched.description,
    deadline: enriched.deadline ?? parsedDeadline.deadline ?? null,
    deadline_text: enriched.deadline_text ?? parsedDeadline.deadline_text ?? null,
  };
}
