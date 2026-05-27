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
  "software engineer",
  "marketing manager",
  "finance analyst",
  "civil engineer",
  "project manager",
  "human resources",
  "sales representative",
  "operations manager",
  "data scientist",
  "accountant",
  "remote developer"
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
    const apifyToken = Deno.env.get("APIFY_API_KEY")?.trim();
    const firecrawlKey = Deno.env.get("FIRECRAWL2")?.trim();

    if (!apifyToken) {
      throw new Error("APIFY_API_KEY missing in Supabase Edge Secrets");
    }
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL2 missing in Supabase Edge Secrets");
    }

    const url = new URL(req.url);
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 5)));

    const supabaseAdmin = createAdminClient();

    // 1. Keyword rotation
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const query = SEARCH_KEYWORDS[dayOfYear % SEARCH_KEYWORDS.length];
    console.log(`[LinkedIn Apify] Rotated search query: "${query}", limit cap: ${limit}`);

    // 2. Trigger Apify LinkedIn Jobs Scraper Actor
    console.log(`[LinkedIn Apify] Running actor apify/linkedin-jobs-scraper...`);
    const apifyPayload = {
      keywords: query,
      location: "Kenya",
      maxRows: limit,
      limit: limit,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    };

    const apifyRunRes = await fetch(
      `https://api.apify.com/v2/acts/apify~linkedin-jobs-scraper/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyPayload),
      }
    );

    if (!apifyRunRes.ok) {
      throw new Error(`Apify Actor Run failed: ${apifyRunRes.status} ${await apifyRunRes.text()}`);
    }

    const runDetails = await apifyRunRes.json();
    const runId = runDetails?.data?.id;
    const datasetId = runDetails?.data?.defaultDatasetId;

    if (!runId || !datasetId) {
      throw new Error(`Apify response missing runId or datasetId: ${JSON.stringify(runDetails)}`);
    }

    console.log(`[LinkedIn Apify] Run started. ID: ${runId}, Dataset ID: ${datasetId}`);

    // 3. Poll Apify Actor status until completion (max 90 seconds)
    let status = "RUNNING";
    const startTime = Date.now();
    const maxPollTimeMs = 90 * 1000;

    while (status === "RUNNING" || status === "READY") {
      if (Date.now() - startTime > maxPollTimeMs) {
        throw new Error(`Apify actor run timed out after ${maxPollTimeMs / 1000} seconds`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`);
      if (!statusRes.ok) {
        console.warn(`[LinkedIn Apify] Status check failed: ${statusRes.status}. Retrying...`);
        continue;
      }

      const statusDetails = await statusRes.json();
      status = statusDetails?.data?.status || "FAILED";
      console.log(`[LinkedIn Apify] Poll status: ${status}`);
    }

    if (status !== "SUCCEEDED") {
      throw new Error(`Apify scraper run completed with non-success status: ${status}`);
    }

    // 4. Retrieve Dataset Items
    console.log(`[LinkedIn Apify] Fetching dataset items...`);
    const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}`);
    if (!datasetRes.ok) {
      throw new Error(`Apify Dataset fetch failed: ${datasetRes.status} ${await datasetRes.text()}`);
    }

    const rawItems = (await datasetRes.json()) as Array<Record<string, any>>;
    jobsFetched = rawItems.length;
    console.log(`[LinkedIn Apify] Scraped ${jobsFetched} items from Apify dataset.`);

    if (jobsFetched === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No jobs returned from Apify LinkedIn Scraper",
          jobs_fetched: 0,
          jobs_inserted: 0,
          jobs_skipped: 0,
          errors: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Clean, map and deduplicate urls
    const jobUrlMap = new Map<string, Record<string, any>>();
    const urlsToProcess: string[] = [];

    for (const item of rawItems) {
      const rawUrl = (
        item.applyUrl ??
        item.jobUrl ??
        item.job_url ??
        item.url ??
        (item.id ? `https://www.linkedin.com/jobs/view/${item.id}` : "")
      )?.trim();

      if (rawUrl && rawUrl.startsWith("http")) {
        // Strip query parameters to normalize LinkedIn URLs
        const normalizedUrl = rawUrl.split("?")[0];
        if (!jobUrlMap.has(normalizedUrl)) {
          jobUrlMap.set(normalizedUrl, item);
          urlsToProcess.push(normalizedUrl);
        }
      }
    }

    console.log(`[LinkedIn Apify] Unique LinkedIn URLs found: ${urlsToProcess.length}`);

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
    console.log(`[LinkedIn Apify] Unique new jobs to enrich: ${uniqueNewUrls.length}`);

    jobsSkipped = rawItems.length - uniqueNewUrls.length;

    // 6. Process each unique new job
    for (const jobUrl of uniqueNewUrls) {
      const basicInfo = jobUrlMap.get(jobUrl)!;
      try {
        // Fetch full description using Firecrawl
        const markdown = await fetchFirecrawlScrape(jobUrl, firecrawlKey);
        if (!markdown.trim()) {
          console.warn(`[LinkedIn Apify] Scraped empty content for URL: ${jobUrl}. Skipping.`);
          errors.push(`${jobUrl}: Firecrawl returned empty markdown`);
          jobsSkipped++;
          continue;
        }

        // AI Enrichment Layer
        console.log(`[LinkedIn Apify] Enriching job: ${basicInfo.title} at ${basicInfo.companyName}`);
        const aiPrompt = `Analyze this job posting from Kenya and extract structured job catalog information.
JOB TITLE: ${basicInfo.title}
COMPANY: ${basicInfo.companyName || "unknown"}
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
          "You are an expert LinkedIn job description analyzer. Extract accurate, structured metadata. JSON only."
        );

        // Parse deadline dates
        const { deadline, deadline_text: parsedDeadlineText } = parseJobDeadline(
          enriched.deadline_text || markdown.slice(0, 8000)
        );

        // Normalize lists
        const requirementsFormatted = enriched.requirements
          ? enriched.requirements.split("|").map((s) => s.trim()).filter(Boolean).join("\n")
          : null;
        const responsibilitiesFormatted = enriched.responsibilities
          ? enriched.responsibilities.split("|").map((s) => s.trim()).filter(Boolean).join("\n")
          : null;

        // Validate and resolve company name
        let finalCompany = basicInfo.companyName || enriched.company_name;
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

        // Store in database
        const dbPayload = {
          title: basicInfo.title,
          company: finalCompany,
          location: basicInfo.location || enriched.role_summary?.slice(0, 50) || "Kenya",
          source_url: jobUrl,
          source: "linkedin_apify",
          site: "LinkedIn",
          description: markdown,
          role_description: enriched.role_description || enriched.role_summary,
          description_summary: enriched.role_summary?.slice(0, 300) || null,
          requirements: requirementsFormatted,
          responsibilities: responsibilitiesFormatted,
          experience_level: enriched.experience_level || basicInfo.seniorityLevel || null,
          sector: enriched.job_category || basicInfo.industry || null,
          education_level: enriched.education_requirements || null,
          salary_text: enriched.salary_info || basicInfo.salary || null,
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
            source: "linkedin_apify",
            description_raw: markdown,
            description_enriched: enriched.role_description,
            required_skills: enriched.required_skills,
            experience_level: enriched.experience_level,
            category: enriched.job_category,
            salary_info: enriched.salary_info,
            education_requirements: enriched.education_requirements,
            role_summary: enriched.role_summary,
            seniority_level_apify: basicInfo.seniorityLevel,
            employment_type_apify: basicInfo.employmentType,
          },
        };

        const { error: insertError } = await supabaseAdmin
          .from("scraped_jobs")
          .upsert(dbPayload, { onConflict: "source_url" });

        if (insertError) {
          throw insertError;
        }

        jobsInserted++;
        console.log(`[LinkedIn Apify] Successfully inserted job: ${basicInfo.title}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[LinkedIn Apify] Failed processing URL ${jobUrl}:`, e);
        errors.push(`${jobUrl}: ${msg}`);
      }
    }

  } catch (fatalError) {
    const msg = fatalError instanceof Error ? fatalError.message : String(fatalError);
    console.error("[LinkedIn Apify] Fatal error in edge function:", fatalError);
    errors.push(`FATAL: ${msg}`);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Return metrics
  console.log(`[LinkedIn Apify] Finished. Fetched: ${jobsFetched}, Inserted: ${jobsInserted}, Skipped: ${jobsSkipped}, Errors: ${errors.length}`);
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
