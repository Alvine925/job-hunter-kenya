// Firecrawl wrapper (server-only)
const FC = "https://api.firecrawl.dev/v2";

export type ScrapedJob = {
  title: string;
  company: string | null;
  location: string | null;
  description: string | null;
  source_url: string;
  source: string;
};

async function fc(path: string, body: any) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch(`${FC}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
  return res.json();
}

const KE_SITES = [
  "site:brightermonday.co.ke",
  "site:myjobmag.co.ke",
  "site:fuzu.com",
  "site:jobwebkenya.com",
  "site:corporatestaffing.co.ke",
];

export async function searchKenyaJobs(roles: string[], counties: string[], limit = 20): Promise<ScrapedJob[]> {
  const role = roles.join(" OR ") || "jobs";
  const loc = counties.join(" OR ") || "Kenya";
  const siteFilter = `(${KE_SITES.join(" OR ")})`;
  const query = `${role} ${loc} ${siteFilter}`;

  const data = await fc("/search", {
    query,
    limit,
    scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
  });

  const results = (data?.data?.web ?? data?.data ?? []) as any[];
  return results
    .filter((r) => r?.url)
    .map((r) => {
      const url: string = r.url;
      const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "web"; } })();
      return {
        title: r.title || "Untitled role",
        company: r.metadata?.ogSiteName || null,
        location: null,
        description: r.markdown || r.description || r.snippet || null,
        source_url: url,
        source: host,
      };
    });
}
