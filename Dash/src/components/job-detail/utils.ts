function isPlaceholderLine(text: string): boolean {
  return /not specified in the provided|not specified|n\/a/i.test(text.trim());
}

export function parseBulletLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const trimmed = text.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((line) => Boolean(line) && !isPlaceholderLine(line));
      }
    } catch {
      /* fall through to line split */
    }
  }

  return trimmed
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter((line) => Boolean(line) && !isPlaceholderLine(line));
}

export function companyInitials(company: string) {
  return company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function faviconUrl(source?: string | null, sourceUrl?: string | null) {
  try {
    const host = sourceUrl
      ? new URL(sourceUrl).hostname
      : source?.includes(".")
        ? source
        : `${source?.replace(/\s+/g, "").toLowerCase()}.com`;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return null;
  }
}

export function keywordMatchStats(
  profileSkills: string[] | null | undefined,
  jobText: string,
): { found: number; total: number; matched: string[] } {
  const skills = (profileSkills ?? []).map((s) => s.trim()).filter(Boolean);
  if (skills.length === 0) return { found: 0, total: 0, matched: [] };
  const hay = jobText.toLowerCase();
  const matched = skills.filter((s) => hay.includes(s.toLowerCase()));
  return { found: matched.length, total: skills.length, matched };
}

/** True when text looks like job-board chrome (nav, filters), not a job post. */
export function isJobBoardChrome(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text;
  const mdLinks = (t.match(/\]\(https?:\/\//g) || []).length;
  if (mdLinks >= 4) return true;
  if (/NairobiMombasa|Detailed Search|Post Job/i.test(t)) return true;
  if (/Administration\s*\/\s*Facilities/i.test(t) && t.length > 400) return true;
  if (t.length > 1500 && mdLinks >= 2) return true;
  return false;
}

function isAggregatedTitle(title: string): boolean {
  const t = title.trim();
  if (/^\d+\+?\s+.+\bjobs?\b/i.test(t)) return true;
  if (/\bjobs?\s+in\s+(kenya|nairobi|mombasa)/i.test(t)) return true;
  if (/\b(aggregated|various)\b/i.test(t)) return true;
  if (/\s-\s+linkedin\s*$/i.test(t) && !/\bat\s+/i.test(t)) return true;
  return false;
}

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

export function isLowQualityJobDisplay(job: {
  title?: string | null;
  company?: string | null;
  role_description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
}): boolean {
  if (job.title && isAggregatedTitle(job.title)) return true;
  if (isInvalidEmployer(job.company)) return true;
  const blob = [job.role_description, job.requirements, job.responsibilities].join(" ");
  if (/not specified in the provided/i.test(blob)) return true;
  return false;
}

export function roleDescriptionText(job: {
  role_description?: string | null;
  requirements?: string | null;
  responsibilities?: string | null;
  title?: string | null;
  company?: string | null;
}): string {
  if (isLowQualityJobDisplay(job)) return "";

  const ai = job.role_description?.trim();
  if (ai && !isPlaceholderLine(ai)) return ai;

  const req = parseBulletLines(job.requirements).filter((r) => !isPlaceholderLine(r));
  const resp = parseBulletLines(job.responsibilities).filter((r) => !isPlaceholderLine(r));
  const parts: string[] = [];

  const roleTitle = (job.title ?? "")
    .replace(/\s+at\s+.+$/i, "")
    .replace(/\s*-\s*linkedin\s*$/i, "")
    .trim();

  if (roleTitle && job.company && !isInvalidEmployer(job.company) && !isAggregatedTitle(roleTitle)) {
    parts.push(`${job.company} is seeking a ${roleTitle} to join their team.`);
  }
  if (resp.length > 0) {
    parts.push("Key responsibilities include:\n" + resp.map((r) => `• ${r}`).join("\n"));
  }
  if (req.length > 0) {
    parts.push("Ideal candidates will have:\n" + req.map((r) => `• ${r}`).join("\n"));
  }

  return parts.join("\n\n");
}

export function companyBlurb(job: {
  company_summary?: string | null;
  company?: string | null;
  title?: string | null;
  location?: string | null;
  county?: string | null;
  description?: string | null;
  source?: string | null;
}): string {
  const summary = job.company_summary?.trim();
  if (summary) return summary;

  const desc = job.description?.trim();
  if (desc && !isJobBoardChrome(desc)) {
    const cleaned = desc
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
    if (sentences.length > 0) {
      return sentences.slice(0, 3).join(" ").slice(0, 500);
    }
  }

  if (isInvalidEmployer(job.company) || (job.title && isAggregatedTitle(job.title))) {
    return "Open the original listing for full employer and role details.";
  }

  const name = job.company?.trim() || "This employer";
  const place = [job.location, job.county].filter(Boolean).join(", ") || "Kenya";
  const board = job.source ? ` (listed on ${job.source})` : "";
  return `${name} is hiring for ${job.title ?? "this role"} in ${place}${board}. Open the original listing for full role details.`;
}

export function youVoice(text: string | null | undefined) {
  if (!text) return "";
  return text
    .replace(/\bthe candidate\b/gi, "you")
    .replace(/\bthe candidate's\b/gi, "your")
    .replace(/\bcandidate\b/gi, "you");
}
