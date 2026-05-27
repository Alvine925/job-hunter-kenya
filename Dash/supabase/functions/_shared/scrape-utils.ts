import { JOB_SOURCE_SITES } from "./job-sources.ts";

/** Hosts that list jobs — never treat as the hiring employer. */
const JOB_BOARD_HOSTS = new Set(
  Object.values(JOB_SOURCE_SITES).flatMap((s) => s.hosts),
);

const JOB_BOARD_NAMES = new Set(
  Object.keys(JOB_SOURCE_SITES).map((k) => k.toLowerCase()),
);

export function isJobBoardHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return [...JOB_BOARD_HOSTS].some((b) => h === b || h.endsWith(`.${b}`));
}

export function hostToSourceLabel(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  for (const [label, cfg] of Object.entries(JOB_SOURCE_SITES)) {
    if (cfg.hosts.some((b) => h === b || h.endsWith(`.${b}`))) return label;
  }
  return host;
}

/** Job board name from a posting URL (e.g. fuzu.com/jobs/... -> "Fuzu"). */
export function sourceLabelFromUrl(url: string, fallback = "Unknown"): string {
  try {
    const label = hostToSourceLabel(new URL(url).hostname);
    return label in JOB_SOURCE_SITES ? label : fallback;
  } catch {
    return fallback;
  }
}

export function isLinkedInHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  return h.includes("linkedin.com");
}

/** Individual LinkedIn job posting (not search/collections). */
export function isLinkedInJobViewUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return /\/jobs\/view\/\d+/i.test(path);
  } catch {
    return false;
  }
}

/** SERP-style pages that list many jobs, not one role. */
export function isAggregatedTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^\d+\+?\s+.+\bjobs?\b/i.test(t)) return true;
  if (/\bjobs?\s+in\s+(kenya|nairobi|mombasa|africa)/i.test(t)) return true;
  if (/\b(aggregated|search results|job search)\b/i.test(t)) return true;
  // "Automation Specialist jobs in Kenya - Nairobi - LinkedIn" (no "at Employer")
  if (/\s-\s+linkedin\s*$/i.test(t) && !/\bat\s+[A-Za-z]/i.test(t)) return true;
  if (/\s-\s+[A-Za-z].+\s-\s+linkedin\s*$/i.test(t) && !/\bat\s+/i.test(t)) return true;
  return false;
}

/** Bad employer label (job board / SERP / location), not merely missing. */
export function isInvalidEmployer(company: string | null | undefined): boolean {
  if (!company?.trim()) return true;
  const c = company.trim();
  const lowerC = c.toLowerCase();

  // 1. Direct regex check for job boards or aggregated/placeholder patterns
  const INVALID_BOARD_RE = /\b(linkedin|brightermonday|brighter\s+monday|myjobmag|my\s+job\s+mag|fuzu|jobwebkenya|job\s+web\s+kenya|corporatestaffing|corporate\s+staffing|indeed|glassdoor|ziprecruiter|careerjet|talent\.com|lensa|ajira|kazi|pigiame|pigia\s+me|career\s+point|star\s+jobs|kenyancareer|various|aggregated|linkedin\s+search|not\s+specified|unknown\s+employer|job\s+board|recruiter|employer)\b/i;
  if (INVALID_BOARD_RE.test(lowerC)) {
    return true;
  }

  if (/\(\s*aggregated/i.test(lowerC)) return true;

  // 2. Word-by-word check to see if the name consists ENTIRELY of locations and generic keywords
  const LOCATION_AND_GENERIC_WORDS = new Set([
    "nairobi", "mombasa", "kisumu", "nakuru", "eldoret", "kenya", "kiambu", "machakos", 
    "kajiado", "nyeri", "meru", "laikipia", "kericho", "kisii", "kakamega", "bungoma", 
    "kilifi", "kwale", "garissa", "turkana", "narok", "thika", "naivasha", "kitale", 
    "nanyuki", "malindi", "westlands", "kilimani", "karen", "ruaka", "athiriver", "athi river",
    "east africa", "eastafrica", "africa", "county", "city", "town", "province",
    "remote", "hybrid", "onsite", "on-site", "location", "locations", "various", "multiple",
    "unknown", "not", "specified", "n/a", "na", "none", "null", "employer", "recruiter", 
    "agency", "company", "hiring", "job", "jobs", "careers", "career", "posting", "postings", 
    "listing", "listings", "apply", "apply now", "hiring company", "unknown employer", 
    "and", "of", "in", "at", "for", "the", "a", "an", "to", "with", "by", "from"
  ]);

  const words = lowerC
    .replace(/[,\-\/\(\)\[\]\.\:\&]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);

  if (words.length === 0) return true;

  const allWordsInvalid = words.every(word => {
    return (
      LOCATION_AND_GENERIC_WORDS.has(word) ||
      /^\d+$/.test(word) || // digits/numbers
      word.length <= 1      // single letters
    );
  });

  return allWordsInvalid;
}

const PLACEHOLDER_RE =
  /not specified in the provided|not specified|n\/a|none listed|unknown/i;

export function isPlaceholderJobText(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  const t = text.trim();
  if (PLACEHOLDER_RE.test(t) && t.length < 120) return true;
  return false;
}

/** Drop search-result pages and jobs we cannot name a real employer for. */
export function isLowQualityJob(job: {
  title?: string | null;
  company?: string | null;
  source_url?: string | null;
  role_description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
}): boolean {
  const title = job.title ?? "";
  const url = job.source_url ?? "";

  if (isAggregatedTitle(title) || isAggregatedListing(url, title)) return true;
  if (isInvalidEmployer(job.company)) return true;

  try {
    const host = new URL(url).hostname;
    if (isLinkedInHost(host) && !isLinkedInJobViewUrl(url)) return true;
    if (isLinkedInHost(host) && (!job.company?.trim() || isInvalidEmployer(job.company))) {
      return true;
    }
  } catch {
    if (!url) return true;
  }

  return false;
}

/** Stricter checks when attaching new jobs (skip obvious SERP junk only). */
export function isLowQualityJobForAttach(job: {
  title?: string | null;
  company?: string | null;
  source_url?: string | null;
  role_description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
}): boolean {
  return isLowQualityJob(job);
}

export function isAggregatedListing(url: string, title: string): boolean {
  if (isAggregatedTitle(title)) return true;
  const t = title.trim();
  if (/^\d+\+?\s+.+\bjobs?\b/i.test(t)) return true;
  if (/\bjobs?\s+in\s+(kenya|nairobi|mombasa)/i.test(t)) return true;
  if (/\b(aggregated|search results|job search)\b/i.test(t)) return true;

  if (!url?.trim()) return false;

  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (isLinkedInHost(host)) {
      if (!isLinkedInJobViewUrl(url)) return true;
      return false;
    }

    if (path.includes("/jobs/search") || path.includes("/job-search")) return true;
    if (path.endsWith("/jobs") || path.endsWith("/jobs/")) return true;
  } catch {
    return true;
  }

  return false;
}

function cleanEmployerName(raw: string): string | null {
  let name = raw
    .replace(/\s*[\|•]\s*.*$/g, "")
    .replace(/\s*-\s*linkedin\s*$/i, "")
    .trim();

  if (!name || name.length < 2) return null;
  const lower = name.toLowerCase();
  if (JOB_BOARD_NAMES.has(lower)) return null;
  if (isInvalidEmployer(name)) return null;
  if (/\b(linkedin|brightermonday|myjobmag|fuzu|jobwebkenya|corporatestaffing|various|aggregated|recruiter|job board)\b/i.test(lower) && name.split(/\s+/).length <= 4) {
    return null;
  }
  if (/^\d+\+?\s+/.test(name)) return null;
  return name;
}

/** Best-effort employer from search result title (before full scrape). */
export function parseEmployerFromTitle(title: string): string | null {
  if (isAggregatedListing("", title)) return null;

  let t = title
    .replace(/\s*[\|]\s*linkedin\s*$/i, "")
    .replace(/\s*-\s*linkedin\s*$/i, "")
    .trim();

  const atMatch = t.match(/\bat\s+(.+?)(?:\s*[\|•\-–]|$)/i);
  if (atMatch) return cleanEmployerName(atMatch[1]);

  const dashMatch = t.match(/^[^–-]+[\-–]\s*(.+?)(?:\s*[\|•]|$)/);
  if (dashMatch) return cleanEmployerName(dashMatch[1]);

  return null;
}

export function parseEmployerFromMarkdown(markdown: string, sourceUrl: string): string | null {
  const host = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return "";
    }
  })();

  if (isLinkedInHost(host)) {
    const hiring = markdown.match(/(?:hiring company|company|employer)[:\s]+([^\n]{2,80})/i);
    if (hiring) return cleanEmployerName(hiring[1]);
    const atLine = markdown.match(/^#\s+.+?\s+at\s+(.+?)$/im);
    if (atLine) return cleanEmployerName(atLine[1]);
  }

  const companyLine = markdown.match(/(?:^|\n)#+\s*(?:about\s+)?company[:\s]+([^\n]{2,80})/im);
  if (companyLine) return cleanEmployerName(companyLine[1]);

  return null;
}

export function resolveEmployerCompany(params: {
  title: string;
  url: string;
  markdown?: string | null;
  ogSiteName?: string | null;
}): string | null {
  const fromTitle = parseEmployerFromTitle(params.title);
  if (fromTitle) return fromTitle;

  if (params.markdown) {
    const fromBody = parseEmployerFromMarkdown(params.markdown, params.url);
    if (fromBody) return fromBody;
  }

  const og = params.ogSiteName?.trim();
  if (og && !JOB_BOARD_NAMES.has(og.toLowerCase()) && !isJobBoardHost(og)) {
    return cleanEmployerName(og);
  }

  return null;
}
