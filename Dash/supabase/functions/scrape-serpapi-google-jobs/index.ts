import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorizeRequest, corsHeaders } from "../_shared/job-scraper.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { aiJson } from "../_shared/ai.ts";
import { parseJobDeadline } from "../_shared/parse-deadline.ts";
import { isInvalidEmployer, resolveEmployerCompany } from "../_shared/scrape-utils.ts";

interface JobEnrichment {
  company_name: string;
  required_skills: string[];
  experience_level: "entry" | "mid" | "senior";
  job_category: string;
  education_requirements: string;
  role_summary: string;
  requirements: string;
  responsibilities: string;
  salary_info: string;
  role_description: string;
  company_summary: string;
  application_email: string;
  application_method: "email" | "form" | "unknown";
  deadline_text: string;
}

const SEARCH_KEYWORDS = [
  "software engineer jobs Kenya",
  "marketing manager jobs Kenya",
  "finance analyst jobs Kenya",
  "civil engineer jobs Kenya",
  "project manager jobs Kenya",
  "human resources jobs Kenya",
  "sales representative jobs Kenya",
  "operations manager jobs Kenya",
  "data scientist jobs Kenya",
  "accounting jobs Kenya",
  "remote developer jobs Kenya"
];

async function fetchFirecrawlScrape(url: string, apiKey: string, retries = 2): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Firecrawl] Scraping ${url} (Attempt ${attempt}/${retries})...`);
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Status ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const markdown = data?.data?.markdown || data?.markdown || data?.data?.content || "";
      if (markdown.trim()) return markdown;
      throw new Error("Empty page markdown returned from Firecrawl");
    } catch (e) {
      console.warn(`[Firecrawl] Attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
      if (attempt === retries) throw e;
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const unauthorized = authorizeRequest(req);
  if (unauthorized) return unauthorized;

  const errors: string[] = [];
  let jobsFetched = 0;
  let jobsInserted = 0;
  let jobsSkipped = 0;

  try {
    const serpApiKey = Deno.env.get("SERPAPI2_KEY")?.trim();
    const firecrawlKey = Deno.env.get("FIRECRAWL2")?.trim();

    if (!serpApiKey) {
      throw new Error("SERPAPI2_KEY missing in Supabase Edge Secrets");
    }
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL2 missing in Supabase Edge Secrets");
    }

    const supabaseAdmin = createAdminClient();

    // 1. Daily Cap Enforcement Check
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayISO = startOfToday.toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("scraped_jobs")
      .select("id", { count: "exact", head: true })
      .eq("source", "serpapi_google_jobs")
      .gte("scraped_at", todayISO);

    if (countError) {
      console.warn("Could not query daily limit count:", countError.message);
    }

    const alreadyScraped = count ?? 0;
    const dailyCap = 9;
    const budget = Math.max(0, dailyCap - alreadyScraped);

    console.log(`[Google Jobs] Already scraped today: ${alreadyScraped}/${dailyCap}. Budget remaining: ${budget}`);

    if (budget <= 0) {
      console.log("[Google Jobs] Daily cap reached. Stopping execution.");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Daily cap of 9 jobs reached",
          jobs_fetched: 0,
          jobs_inserted: 0,
          jobs_skipped: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Query Rotation
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const query = SEARCH_KEYWORDS[dayOfYear % SEARCH_KEYWORDS.length];
    console.log(`[Google Jobs] Running rotated keyword search: "${query}"`);

    // 3. Fetch listings from SerpAPI
    const serpUrl = new URL("https://serpapi.com/search.json");
    serpUrl.searchParams.set("engine", "google_jobs");
    serpUrl.searchParams.set("q", query);
    serpUrl.searchParams.set("location", "Kenya");
    serpUrl.searchParams.set("google_domain", "google.com");
    serpUrl.searchParams.set("hl", "en");
    serpUrl.searchParams.set("gl", "ke");
    serpUrl.searchParams.set("api_key", serpApiKey);

    const serpRes = await fetch(serpUrl.toString());
    if (!serpRes.ok) {
      throw new Error(`SerpAPI HTTP ${serpRes.status}: ${await serpRes.text()}`);
    }

    const serpData = await serpRes.json();
    const googleJobs = (serpData.jobs_results ?? []) as Array<Record<string, any>>;
    jobsFetched = googleJobs.length;
    console.log(`[Google Jobs] Fetched ${jobsFetched} listings from SerpAPI.`);

    if (jobsFetched === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No jobs returned from SerpAPI",
          jobs_fetched: 0,
          jobs_inserted: 0,
          jobs_skipped: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Filter out items and prepare deduplication
    const jobUrlMap = new Map<string, Record<string, any>>();
    const urlsToProcess: string[] = [];

    for (const job of googleJobs) {
      const jobUrl = (
        job.apply_options?.[0]?.link ??
        job.related_links?.[0]?.link ??
        job.share_link ??
        job.link
      )?.trim();

      if (jobUrl && jobUrl.startsWith("http")) {
        // LinkedIn URLs should be normalized to avoid minor query param mismatches
        const normalizedUrl = jobUrl.includes("linkedin.com") 
          ? jobUrl.split("?")[0]
          : jobUrl;

        if (!jobUrlMap.has(normalizedUrl)) {
          jobUrlMap.set(normalizedUrl, job);
          urlsToProcess.push(normalizedUrl);
        }
      }
    }

    console.log(`[Google Jobs] Distinct job URLs to check: ${urlsToProcess.length}`);

    // Deduplicate against database
    const { data: existingJobs, error: dbError } = await supabaseAdmin
      .from("scraped_jobs")
      .select("source_url")
      .in("source_url", urlsToProcess);

    if (dbError) {
      throw dbError;
    }

    const existingUrls = new Set((existingJobs ?? []).map((j) => j.source_url));
    const uniqueNewUrls = urlsToProcess.filter((url) => !existingUrls.has(url));
    console.log(`[Google Jobs] Unique new jobs to scrape: ${uniqueNewUrls.length}`);

    // Cap the jobs we will scrape to the remaining budget
    const targetUrls = uniqueNewUrls.slice(0, budget);
    jobsSkipped = googleJobs.length - targetUrls.length;

    console.log(`[Google Jobs] Processing ${targetUrls.length} jobs within budget of ${budget}.`);

    for (const jobUrl of targetUrls) {
      const basicInfo = jobUrlMap.get(jobUrl)!;
      try {
        // 5. Scrape full content using Firecrawl
        const markdown = await fetchFirecrawlScrape(jobUrl, firecrawlKey);
        if (!markdown.trim()) {
          console.warn(`[Google Jobs] Skip ${jobUrl} due to empty content fetched.`);
          errors.push(`${jobUrl}: Firecrawl scraped empty markdown`);
          jobsSkipped++;
          continue;
        }

        // 6. AI Enrichment Layer
        console.log(`[Google Jobs] Running AI enrichment for: ${basicInfo.title} at ${basicInfo.company_name}`);
        const aiPrompt = `Analyze this job posting from Kenya and extract structured job catalog information.
JOB TITLE: ${basicInfo.title}
COMPANY: ${basicInfo.company_name || "unknown"}
LOCATION: ${basicInfo.location || "Kenya"}
SOURCE URL: ${jobUrl}

JOB DESCRIPTION/PAGE TEXT:
${markdown.slice(0, 15000)}

Return JSON with these exact keys:
1. "company_name": the name of the actual hiring company/employer (e.g. Solar Panda, Safaricom). Analyze the entire job description page text to identify the actual employer. NEVER use a location name (like Nairobi, Mombasa, Kenya) or a job board name (like LinkedIn, BrighterMonday). If the company name is not in the text, use the provided COMPANY parameter value if valid, otherwise "Unknown".
2. "required_skills": an array of strings representing key skills or technical abilities required.
3. "experience_level": one of: "entry", "mid", "senior" (based on years of experience or role seniority).
4. "job_category": standard category (e.g. "tech", "finance", "marketing", "engineering", "sales", "healthcare", "operations", "other").
5. "education_requirements": short description of education requirements (e.g. "Bachelor's degree in Business", "Diploma", "None specified").
6. "role_summary": 2-3 sentence structured summary of the role.
7. "requirements": a bullet-pointed list of requirements/qualifications separated by pipe characters (|) (e.g. "5+ years experience | Python | React").
8. "responsibilities": a bullet-pointed list of key responsibilities separated by pipe characters (|) (e.g. "Develop features | Lead team").
9. "salary_info": any visible salary/remuneration details, or empty string if not mentioned.
10. "role_description": a cohesive plain text role description (2-4 paragraphs) synthesized from the content. Do not include HTML.
11. "company_summary": a 2-3 sentence prose description of the hiring employer (what they do, sector). Do not include job board details.
12. "application_email": specific recruiter/employer email if applications should be sent via email, else empty string.
13. "application_method": "email" if candidates should send their CV/apply by email, "form" if they apply via an online form/link, or "unknown".
14. "deadline_text": raw application deadline date or text if mentioned, else empty string.

Ensure all keys are populated. Return STRICT JSON ONLY. Do not wrap in markdown code blocks.`;

        const enriched = await aiJson<JobEnrichment>(
          aiPrompt,
          "You are an expert Kenyan job market analyst. Extract accurate, structured metadata. JSON only."
        );

        // Parse deadline
        const { deadline, deadline_text: parsedDeadlineText } = parseJobDeadline(
          enriched.deadline_text || markdown.slice(0, 8000)
        );

        // Normalize lists
        const requirementsFormatted = enriched.requirements
          ? enriched.requirements.split("|").map(s => s.trim()).filter(Boolean).join("\n")
          : null;
        const responsibilitiesFormatted = enriched.responsibilities
          ? enriched.responsibilities.split("|").map(s => s.trim()).filter(Boolean).join("\n")
          : null;

        // Validate and resolve company name
        let finalCompany = basicInfo.company_name || enriched.company_name;
        if (!finalCompany || isInvalidEmployer(finalCompany)) {
          finalCompany = enriched.company_name || "Unknown";
        }
        if (isInvalidEmployer(finalCompany)) {
          const parsed = resolveEmployerCompany({
            title: basicInfo.title,
            url: jobUrl,
            markdown: markdown,
            ogSiteName: null,
          });
          if (parsed && !isInvalidEmployer(parsed)) {
            finalCompany = parsed;
          } else {
            finalCompany = "Unknown";
          }
        }

        // 7. Store in database
        const dbPayload = {
          title: basicInfo.title,
          company: finalCompany,
          location: basicInfo.location || enriched.role_summary?.slice(0, 50) || "Kenya",
          source_url: jobUrl,
          source: "serpapi_google_jobs",
          site: (() => {
            const rawVia = (basicInfo.via || "").trim();
            let parsedSite = rawVia ? rawVia.replace(/^via\s+/i, "").trim() : "Google Jobs";
            const lowerSite = parsedSite.toLowerCase();
            if (lowerSite.includes("linkedin")) return "LinkedIn";
            if (lowerSite.includes("fuzu")) return "Fuzu";
            if (lowerSite.includes("brightermonday") || lowerSite.includes("brighter monday")) return "BrighterMonday";
            if (lowerSite.includes("myjobmag") || lowerSite.includes("my job mag")) return "MyJobMag";
            if (lowerSite.includes("myjobsinkenya") || lowerSite.includes("my jobs in kenya")) return "MyJobsInKenya";
            return parsedSite;
          })(),
          description: markdown,
          role_description: enriched.role_description || enriched.role_summary,
          description_summary: enriched.role_summary?.slice(0, 300) || null,
          requirements: requirementsFormatted,
          responsibilities: responsibilitiesFormatted,
          experience_level: enriched.experience_level || null,
          sector: enriched.job_category || null,
          education_level: enriched.education_requirements || null,
          salary_text: enriched.salary_info || null,
          application_email: enriched.application_email || null,
          application_method: enriched.application_method || "unknown",
          application_url: jobUrl,
          deadline,
          deadline_text: parsedDeadlineText || enriched.deadline_text || null,
          scraped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          raw: {
            title: basicInfo.title,
            company: finalCompany,
            location: basicInfo.location,
            job_url: jobUrl,
            source: "serpapi_google_jobs",
            description_raw: markdown,
            description_enriched: enriched.role_description,
            required_skills: enriched.required_skills,
            experience_level: enriched.experience_level,
            category: enriched.job_category,
            salary_info: enriched.salary_info,
            education_requirements: enriched.education_requirements,
            role_summary: enriched.role_summary,
            original_via: basicInfo.via
          }
        };

        const { error: insertError } = await supabaseAdmin
          .from("scraped_jobs")
          .upsert(dbPayload, { onConflict: "source_url" });

        if (insertError) {
          throw insertError;
        }

        jobsInserted++;
        console.log(`[Google Jobs] Successfully inserted job: ${basicInfo.title}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Google Jobs] Failed processing url ${jobUrl}:`, e);
        errors.push(`${jobUrl}: ${msg}`);
      }
    }

  } catch (fatalError) {
    const msg = fatalError instanceof Error ? fatalError.message : String(fatalError);
    console.error("[Google Jobs] Fatal error during execution:", fatalError);
    errors.push(`FATAL: ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 8. Return metrics
  console.log(`[Google Jobs] Finished execution. Fetched: ${jobsFetched}, Inserted: ${jobsInserted}, Skipped: ${jobsSkipped}, Errors: ${errors.length}`);
  return new Response(
    JSON.stringify({
      ok: errors.length === 0 || jobsInserted > 0,
      jobs_fetched: jobsFetched,
      jobs_inserted: jobsInserted,
      jobs_skipped: jobsSkipped,
      errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
