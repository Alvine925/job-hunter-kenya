import { scrapeUrlMarkdown } from "./firecrawl.ts";
import { pickBestApplicationEmail } from "./site-email-profiles/extract-email.ts";

type JobLike = {
  source_url?: string | null;
  application_url?: string | null;
  description?: string | null;
  application_email?: string | null;
  application_method?: string | null;
};

/**
 * Resolve apply-to email from listing text; deep-scrape job page when missing.
 */
export async function resolveApplicationEmailFromListing(
  job: JobLike,
  scrapeMarkdown: (url: string) => Promise<string> = scrapeUrlMarkdown,
  options?: { allowDeepScrape?: boolean },
): Promise<{
  application_email: string | null;
  application_method: string;
  description: string | null;
}> {
  const listingUrl = job.source_url || job.application_url || null;
  let description = job.description ?? "";

  let email =
    (job.application_email?.trim() && job.application_email.includes("@")
      ? job.application_email.trim().toLowerCase()
      : null) || pickBestApplicationEmail(description);

  const needsFullPage =
    options?.allowDeepScrape !== false &&
    listingUrl &&
    (!email || description.length < 2500);

  if (needsFullPage && listingUrl) {
    try {
      const full = await scrapeMarkdown(listingUrl);
      if (full.length > description.length) description = full;
      email = email || pickBestApplicationEmail(full);
    } catch (e) {
      console.error(`Application email scrape failed for ${listingUrl}:`, e);
    }
  }

  if (!email && description) {
    email = pickBestApplicationEmail(description);
  }

  const application_method = email
    ? "email"
    : job.application_method === "form"
    ? "form"
    : job.application_method ?? "unknown";

  return {
    application_email: email,
    application_method,
    description: description || null,
  };
}
