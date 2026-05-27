/** User-facing source names mapped to Firecrawl site: filters and DB source hosts. */
export const JOB_SOURCE_SITES: Record<string, { siteFilter: string; hosts: string[] }> = {
  BrighterMonday: {
    siteFilter: "site:brightermonday.co.ke",
    hosts: ["brightermonday.co.ke"],
  },
  MyJobMag: {
    siteFilter: "site:myjobmag.co.ke",
    hosts: ["myjobmag.co.ke"],
  },
  MyJobsInKenya: {
    siteFilter: "site:myjobsinkenya.com",
    hosts: ["myjobsinkenya.com"],
  },
  Fuzu: {
    siteFilter: "site:fuzu.com",
    hosts: ["fuzu.com"],
  },
  LinkedIn: {
    /** Search only individual postings, not "N jobs in Kenya" SERP pages. */
    siteFilter: "site:linkedin.com/jobs/view",
    hosts: ["linkedin.com", "ke.linkedin.com", "www.linkedin.com"],
  },
  JobwebKenya: {
    siteFilter: "site:jobwebkenya.com",
    hosts: ["jobwebkenya.com"],
  },
  CorporateStaffing: {
    siteFilter: "site:corporatestaffing.co.ke",
    hosts: ["corporatestaffing.co.ke"],
  },
};

/** LinkedIn omitted by default — only individual /jobs/view/ postings are kept when enabled in Configuration. */
export const DEFAULT_JOB_SOURCES = [
  "BrighterMonday",
  "MyJobMag",
  "MyJobsInKenya",
  "Fuzu",
];

export function resolveSourceFilters(sources?: string[] | null): string[] {
  const keys = sources?.length ? sources : DEFAULT_JOB_SOURCES;
  return keys
    .map((k) => JOB_SOURCE_SITES[k]?.siteFilter)
    .filter((s): s is string => !!s);
}

export function resolveSourceHosts(sources?: string[] | null): string[] {
  const keys = sources?.length ? sources : DEFAULT_JOB_SOURCES;
  const hosts = new Set<string>();
  for (const k of keys) {
    for (const h of JOB_SOURCE_SITES[k]?.hosts ?? []) hosts.add(h);
  }
  return [...hosts];
}

export function hostMatchesSources(host: string, sources?: string[] | null): boolean {
  const normalized = host.replace(/^www\./, "").toLowerCase();
  const allowed = resolveSourceHosts(sources);
  return allowed.some((h) => normalized === h || normalized.endsWith(`.${h}`));
}
