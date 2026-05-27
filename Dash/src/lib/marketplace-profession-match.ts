import { ROLE_CATALOG } from "@/lib/configuration-suggestions";

export type ProfessionMatchJob = {
  title?: string | null;
  description?: string | null;
  role_description?: string | null;
  requirements?: string | null;
  county?: string | null;
  experience_level?: string | null;
};

function jobHaystack(job: ProfessionMatchJob): string {
  return [job.title, job.role_description, job.description, job.requirements]
    .filter((s): s is string => Boolean(s?.trim()))
    .join(" ")
    .toLowerCase();
}

function textMatchesPhrase(haystack: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (haystack.includes(p)) return true;
  // Selected value is a longer title variant that contains this job's title
  const titlePart = haystack.split(/\s+/).slice(0, 12).join(" ");
  if (titlePart.length >= 4 && p.includes(titlePart)) return true;
  return false;
}

function entryMatchesHaystack(
  entry: (typeof ROLE_CATALOG)[number],
  haystack: string,
  titleLower: string,
): boolean {
  const labelLower = entry.label.toLowerCase();

  if (textMatchesPhrase(titleLower, labelLower) || textMatchesPhrase(haystack, labelLower)) {
    return true;
  }

  return entry.aliases.some((alias) => {
    const a = alias.toLowerCase().trim();
    if (a.length < 2) return false;
    // Avoid single-letter alias false positives (e.g. "PO" in "support")
    if (a.length < 3) {
      return titleLower === a || titleLower.startsWith(`${a} `) || titleLower.endsWith(` ${a}`);
    }
    return textMatchesPhrase(haystack, a) || textMatchesPhrase(titleLower, a);
  });
}

/** Best catalog entry for a job, or null if none fits. */
export function findRoleCatalogEntryForJob(job: ProfessionMatchJob) {
  const title = job.title?.trim() ?? "";
  if (!title) return null;

  const haystack = jobHaystack(job);
  const titleLower = title.toLowerCase();

  let best: { entry: (typeof ROLE_CATALOG)[number]; score: number } | null = null;

  for (const entry of ROLE_CATALOG) {
    if (!entryMatchesHaystack(entry, haystack, titleLower)) continue;

    const labelLower = entry.label.toLowerCase();
    let score = 10;

    if (titleLower === labelLower) score += 100;
    else if (titleLower.includes(labelLower)) score += 50;
    else if (labelLower.includes(titleLower) && titleLower.length >= 4) score += 40;

    for (const alias of entry.aliases) {
      const a = alias.toLowerCase().trim();
      if (a.length >= 2 && (titleLower.includes(a) || haystack.includes(a))) {
        score += 20;
      }
    }

    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

/** Label used in the profession filter dropdown for this job. */
export function professionBucketForJob(job: ProfessionMatchJob): string {
  const title = job.title?.trim();
  if (!title) return "";
  return findRoleCatalogEntryForJob(job)?.label ?? title;
}

/** Precompute profession buckets once per job list (avoids re-scanning catalog on every filter). */
export function buildProfessionBucketIndex(
  jobs: (ProfessionMatchJob & { id: string })[],
): Map<string, string> {
  const buckets = new Map<string, string>();
  for (const job of jobs) {
    buckets.set(job.id, professionBucketForJob(job));
  }
  return buckets;
}

/** Whether a job should appear when a profession filter value is selected. */
export function jobMatchesProfessionFilter(
  job: ProfessionMatchJob,
  professionFilter: string,
  precomputedBucket?: string,
): boolean {
  if (!professionFilter || professionFilter === "all") return true;

  const selectedLower = professionFilter.trim().toLowerCase();
  const title = job.title?.trim() ?? "";
  const titleLower = title.toLowerCase();
  const haystack = jobHaystack(job);
  const bucket = (precomputedBucket ?? professionBucketForJob(job)).toLowerCase();

  if (bucket === selectedLower) return true;
  if (titleLower === selectedLower) return true;
  if (textMatchesPhrase(titleLower, selectedLower) || textMatchesPhrase(haystack, selectedLower)) {
    return true;
  }

  const preset = ROLE_CATALOG.find((r) => r.label.toLowerCase() === selectedLower);
  if (preset) {
    return entryMatchesHaystack(preset, haystack, titleLower);
  }

  return false;
}

/** Build active/inactive profession options from a precomputed bucket index. */
export function buildProfessionOptionsFromBuckets(buckets: Map<string, string>) {
  const activeSet = new Set<string>();
  for (const bucket of buckets.values()) {
    if (bucket) activeSet.add(bucket);
  }

  const presetLabels = Array.from(new Set(ROLE_CATALOG.map((r) => r.label)));
  const activeList = Array.from(activeSet).sort((a, b) => a.localeCompare(b));
  const inactiveList = presetLabels
    .filter((label) => !activeSet.has(label))
    .sort((a, b) => a.localeCompare(b));

  return { activeList, inactiveList };
}

/** Build active/inactive profession options from jobs. */
export function buildProfessionOptions(jobs: (ProfessionMatchJob & { id: string })[]) {
  return buildProfessionOptionsFromBuckets(buildProfessionBucketIndex(jobs));
}

// --- Dynamic Client-Side Job Matching (Phase 1) ---

const SYNONYMS: Record<string, string[]> = {
  "data analyst": ["bi analyst", "business intelligence", "data scientist", "data engineer", "data analytics"],
  "business intelligence": ["bi", "power bi", "tableau", "data analyst"],
  "hr": ["human resources", "people operations", "hr officer", "hr manager", "human resource"],
  "human resources": ["hr", "people operations", "hr officer", "hr manager", "human resource"],
  "accountant": ["bookkeeper", "accounts assistant", "finance officer", "finance assistant", "cpa"],
  "finance": ["accounting", "financial", "treasury"],
  "backend engineer": ["backend developer", "software engineer", "software developer", "node.js developer"],
  "frontend engineer": ["frontend developer", "react developer", "software engineer", "web developer"],
  "software engineer": ["software developer", "fullstack developer", "programmer", "systems developer"],
  "project manager": ["project coordinator", "program manager", "project officer", "project management"],
  "marketing": ["digital marketing", "social media", "public relations", "pr manager"],
  "sales": ["business development", "account manager", "sales representative", "telesales"],
};

function matchesTerm(textLower: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;

  // Ignore single-character terms to prevent false positives (like "R") unless they are specific known technologies
  if (t.length === 1) {
    const validSingleLetters = ["c", "r"];
    if (!validSingleLetters.includes(t)) {
      return false;
    }
  }

  // Escape special regex characters except for + (for c++)
  const escaped = t.replace(/[-\/\\^$*?.()|[\]{}]/g, '\\$&');
  try {
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i');
    return regex.test(textLower);
  } catch (e) {
    return textLower.includes(t);
  }
}

export type JobMatchProfile = {
  skills?: string[] | null;
  desiredRoles?: string[] | null;
  preferredCounty?: string | null;
  experienceLevel?: string | null;
};

export function computeJobMatch(
  job: ProfessionMatchJob,
  profile: JobMatchProfile
): { percent: number; reason: string } {
  let score = 0;
  const matchedSkills: string[] = [];
  const matchedRoles: string[] = [];
  let countyMatched = false;

  const titleLower = (job.title ?? "").toLowerCase();
  const descLower = (job.description ?? "").toLowerCase();
  const reqLower = (job.requirements ?? "").toLowerCase();
  const roleDescLower = (job.role_description ?? "").toLowerCase();
  const fullTextLower = `${titleLower} ${descLower} ${reqLower} ${roleDescLower}`;

  // 1. Desired Roles matching (with synonyms)
  const desiredRoles = profile.desiredRoles ?? [];
  for (const role of desiredRoles) {
    const synonyms = [role, ...(SYNONYMS[role.toLowerCase().trim()] ?? [])];
    const isMatched = synonyms.some(syn => {
      // Check title (weight 35) or description (weight 15)
      if (matchesTerm(titleLower, syn)) {
        score += 35;
        return true;
      }
      if (matchesTerm(fullTextLower, syn)) {
        score += 20;
        return true;
      }
      return false;
    });

    if (isMatched) {
      matchedRoles.push(role);
    }
  }

  // 2. Skills matching
  const skills = profile.skills ?? [];
  for (const skill of skills) {
    if (matchesTerm(titleLower, skill)) {
      score += 15;
      matchedSkills.push(skill);
    } else if (matchesTerm(reqLower, skill)) {
      score += 10;
      matchedSkills.push(skill);
    } else if (matchesTerm(descLower, skill) || matchesTerm(roleDescLower, skill)) {
      score += 5;
      matchedSkills.push(skill);
    }
  }

  // 3. Location matching
  if (profile.preferredCounty && job.county) {
    const pCounty = profile.preferredCounty.toLowerCase().trim();
    const jCounty = job.county.toLowerCase().trim();
    if (pCounty === jCounty || jCounty.includes(pCounty) || pCounty.includes(jCounty)) {
      score += 15;
      countyMatched = true;
    }
  }

  // 4. Experience level matching (optional constraint)
  if (profile.experienceLevel && job.experience_level) {
    const pExp = profile.experienceLevel.toLowerCase().trim();
    const jExp = job.experience_level.toLowerCase().trim();
    if (pExp === jExp || jExp.includes(pExp)) {
      score += 10;
    }
  }

  // Bounds check
  const percent = Math.min(Math.max(score, 0), 100);

  // Formulate a clean reasoning string
  const reasons: string[] = [];
  if (matchedRoles.length > 0) {
    reasons.push(`Matches role: ${matchedRoles[0]}`);
  }
  if (matchedSkills.length > 0) {
    const displayedSkills = matchedSkills.slice(0, 3).join(", ");
    const remaining = matchedSkills.length - 3;
    reasons.push(`Skills: ${displayedSkills}${remaining > 0 ? ` +${remaining} more` : ""}`);
  }
  if (countyMatched && job.county) {
    reasons.push(`Location: ${job.county}`);
  }

  const reason = reasons.length > 0 ? reasons.join(" • ") : "No direct keyword match found";

  return { percent, reason };
}

