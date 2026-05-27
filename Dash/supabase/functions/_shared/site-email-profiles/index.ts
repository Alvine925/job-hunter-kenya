import { myJobsInKenyaProfile } from "./myjobsinkenya.ts";
import type { SiteEmailProfile } from "./types.ts";
import { pickBestApplicationEmail } from "./extract-email.ts";
import { parseJobDeadline } from "../parse-deadline.ts";
import { isLinkedInJobViewUrl, resolveEmployerCompany } from "../scrape-utils.ts";

const PROFILES: SiteEmailProfile[] = [myJobsInKenyaProfile];

export function resolveSiteEmailProfile(
  sourceUrl?: string | null,
  source?: string | null,
): SiteEmailProfile | null {
  const host = (() => {
    if (sourceUrl) {
      try {
        return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        /* ignore */
      }
    }
    return (source ?? "").replace(/^www\./, "").toLowerCase();
  })();

  if (!host) return null;

  return (
    PROFILES.find((p) =>
      p.domains.some((d) => host === d || host.endsWith(`.${d}`))
    ) ?? null
  );
}

export type EnrichedScrapedJob = {
  title: string;
  source_url: string;
  source: string;
  description: string | null;
  company?: string | null;
  location?: string | null;
  deadline?: string | null;
  deadline_text?: string | null;
};

/**
 * Deep-scrape email-apply sites and extract application email from full page text.
 */
export async function enrichScrapedJobForAnalysis(
  job: EnrichedScrapedJob,
  scrapeMarkdown: (url: string) => Promise<string>,
): Promise<EnrichedScrapedJob & { extracted_application_email: string | null; site_email_profile_id: string | null }> {
  const siteProfile = resolveSiteEmailProfile(job.source_url, job.source);
  let description = job.description ?? "";

  const hasEmailInSnippet = !!pickBestApplicationEmail(description);
  const deepScrape =
    job.source_url &&
    (
      (siteProfile?.alwaysScrapeFullPage) ||
      isLinkedInJobViewUrl(job.source_url) ||
      !hasEmailInSnippet ||
      (description?.length ?? 0) < 2500
    );

  if (deepScrape && job.source_url) {
    try {
      const full = await scrapeMarkdown(job.source_url);
      if (full.length > (description?.length ?? 0)) description = full;
    } catch (e) {
      console.error(`Full page scrape failed for ${job.source_url}:`, e);
    }
  }

  const extracted = pickBestApplicationEmail(description);
  const { deadline, deadline_text } = parseJobDeadline(description);
  const company = resolveEmployerCompany({
    title: job.title,
    url: job.source_url,
    markdown: description,
    ogSiteName: null,
  }) ?? job.company;

  return {
    ...job,
    company,
    description: description || null,
    deadline: job.deadline ?? deadline,
    deadline_text: job.deadline_text ?? deadline_text,
    extracted_application_email: extracted,
    site_email_profile_id: siteProfile?.id ?? null,
  };
}

export function mergeEmailApplicationFields(
  analysis: {
    application_email?: string | null;
    application_method?: string | null;
    application_url?: string | null;
  },
  enriched: { extracted_application_email: string | null; site_email_profile_id: string | null },
  sourceUrl: string,
) {
  const siteProfile = enriched.site_email_profile_id
    ? PROFILES.find((p) => p.id === enriched.site_email_profile_id)
    : resolveSiteEmailProfile(sourceUrl, null);

  const application_email =
    enriched.extracted_application_email ||
    analysis.application_email ||
    null;

  let application_method = analysis.application_method ?? "unknown";
  if (application_email) {
    application_method = "email";
  } else if (siteProfile?.defaultApplicationMethod === "email") {
    // Site is email-apply; keep email type so UI shows send flow (user can paste address from listing).
    application_method = "email";
  }

  return {
    application_email,
    application_method,
    application_url: analysis.application_url || sourceUrl,
  };
}

export { myJobsInKenyaProfile, pickBestApplicationEmail };
export type { SiteEmailProfile } from "./types.ts";
