import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { aiJson } from "../_shared/ai.ts";
import { parseJobDeadline } from "../_shared/parse-deadline.ts";
import { authorizeRequest } from "../_shared/job-scraper.ts";

type StagingJobRow = {
  id: string;
  site: string;
  title: string;
  company: string | null;
  location: string | null;
  job_type: string | null;
  is_remote: boolean | null;
  description: string | null;
  summary: string | null;
  requirements: string | null;
  salary_text: string | null;
  posted_at: string | null;
  source_url: string;
  raw: any;
  scraped_at: string;
  created_at: string;
  source: string | null;
  county: string | null;
  description_summary: string | null;
  responsibilities: string | null;
  work_type: string | null;
  application_url: string | null;
  application_email: string | null;
  application_method: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  deadline: string | null;
  deadline_text: string | null;
  updated_at: string;
  company_summary: string | null;
  role_description: string | null;
  sector: string | null;
  experience_level: string | null;
  education_level: string | null;
  logo_url: string | null;
};

type AIAnalysisResult = {
  title: string;
  company: string;
  company_summary: string;
  role_description: string;
  location: string;
  county: string;
  description_summary: string;
  requirements: string;
  responsibilities: string;
  job_type: string;
  work_type: string;
  salary_text: string;
  application_url: string;
  application_email: string;
  application_method: "email" | "form" | "unknown";
  contact_person: string;
  contact_phone: string;
  deadline_text: string;
  sector: string;
  experience_level: string;
  education_level: string;
  logo_url: string;
};

function normalizeBulletField(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (value.includes("|")) {
    return value.split("|").map((s) => s.trim()).filter(Boolean).join("\n");
  }
  return value.trim();
}

/**
 * Call the Mistral API with fallback to standard aiJson (Cloudflare Workers AI).
 */
async function callAIJsonWithFallback<T>(prompt: string, system: string): Promise<T> {
  const mistralKey =
    Deno.env.get("MISTRAL_API_KEY") ||
    Deno.env.get("MISTRAL_KEY") ||
    Deno.env.get("LOVABLE_MISTRAL_KEY");

  if (mistralKey) {
    try {
      console.log("AI: Attempting primary Mistral API...");
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mistralKey.trim()}`,
        },
        body: JSON.stringify({
          model: "open-mistral-7b",
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        throw new Error(`Mistral API returned status ${res.status}: ${await res.text()}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content ?? "{}";
      return JSON.parse(rawContent) as T;
    } catch (err) {
      console.warn("Mistral API call failed. Falling back to Cloudflare/Gemini:", err);
    }
  } else {
    console.warn("MISTRAL_API_KEY is not set. Falling back to Cloudflare/Gemini.");
  }

  // Fallback to the existing system's robust aiJson helper
  console.log("AI: Executing fallback to Workers AI / Gemini via aiJson...");
  return await aiJson<T>(prompt, system);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authorize request via cron secret or admin key
  const unauthorized = authorizeRequest(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  try {
    // 1. Fetch exactly 5 pending staging rows
    console.log("Fetching up to 5 pending staging rows from scrapy_jobs...");
    const { data: pendingRows, error: fetchError } = await admin
      .from("scrapy_jobs")
      .select("*")
      .eq("status", "pending")
      .order("scraped_at", { ascending: true })
      .limit(5);

    if (fetchError) {
      throw new Error(`Failed to fetch pending staging rows: ${fetchError.message}`);
    }

    if (!pendingRows || pendingRows.length === 0) {
      console.log("No pending jobs to process.");
      return new Response(JSON.stringify({ ok: true, processed: 0, message: "No pending jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${pendingRows.length} pending jobs to process.`);
    const results = [];

    for (const stagingRow of pendingRows as StagingJobRow[]) {
      console.log(`Processing job ID: ${stagingRow.id} | Source URL: ${stagingRow.source_url}`);

      try {
        // Construct prompt for AI analysis
        const prompt = `Extract and clean this Kenyan job posting.
Staging Title: ${stagingRow.title || ""}
Staging Company: ${stagingRow.company || ""}
Staging Location: ${stagingRow.location || ""}
Staging Salary: ${stagingRow.salary_text || ""}
Staging Source: ${stagingRow.site || stagingRow.source || "Unknown"}
Staging URL: ${stagingRow.source_url}
Staging Logo URL: ${stagingRow.logo_url || ""}
Staging Description: ${stagingRow.description || stagingRow.summary || ""}
Staging Raw Metadata: ${JSON.stringify(stagingRow.raw || {})}

Analyze the description and metadata context carefully. Return JSON in the requested format.`;

        const systemPrompt = `You are a Kenyan job market data cleaning analyst. Output strict JSON only.
CRITICAL RULES:
1. TITLE RESOLUTION: If the Staging Title is missing, blank, empty string "", or generic (e.g. "Untitled", "N/A", "Job Vacancy"), analyze the description/metadata to extract or synthesize a highly accurate, professional, and clear job title.
2. NO JOB BOARDS AS COMPANY: The company name MUST be the actual hiring company/employer (e.g. Safaricom, Equity Bank, Uber, Sidian Bank). NEVER output a job board name (do NOT output LinkedIn, BrighterMonday, MyJobMag, Fuzu, JobwebKenya, Corporate Staffing, or similar) or geographical names (Nairobi, Kenya) as the company. If the company name is missing, use empty string "".
3. DETAIL EXTRACTION:
   - Extract a clean application_email (e.g. hr@employer.com) from the description. Never use support/contact emails of job boards.
   - Extract/infer a valid Kenyan county (e.g. Nairobi, Kiambu, Mombasa, Kisumu, Nakuru, Uasin Gishu) from the location or description.
   - Extract the hiring company summary, role description, and a short description summary.
   - Requirements and responsibilities must be lists of clean, concise items separated by pipes (e.g. "Requirement 1 | Requirement 2 | Requirement 3"). Do not use JSON arrays.
   - Extract and normalize job_type ("Full-time" | "Part-time" | "Contract" | "Internship") and work_type ("On-site" | "Hybrid" | "Remote").
   - Extract sector, experience_level, and education_level.
   - Keep staging logo_url or extract a valid external logo_url if found.
   - Extract and standardize the deadline_text. Convert all deadlines to a 'Month Day, Year' format (e.g., 'May 28, 2026') or 'YYYY-MM-DD' if an exact date is not provided but implied (e.g., 'applications close end of May' -> '2026-05-31'). If no deadline is found, use an empty string.
4. REMOVE RAW/BAD DATA: Replace placeholders like "N/A", "Not specified", "unknown" with empty strings "".
5. PRESERVE CONTEXT: Never fabricate, alter, or summarize away job requirements or qualifications. Stay 100% faithful to the original details.

Return JSON with these exact keys:
{
  "title": "string",
  "company": "string",
  "company_summary": "string",
  "role_description": "string",
  "location": "string",
  "county": "string",
  "description_summary": "string",
  "requirements": "string (pipe-separated)",
  "responsibilities": "string (pipe-separated)",
  "job_type": "string",
  "work_type": "string",
  "salary_text": "string",
  "application_url": "string",
  "application_email": "string",
  "application_method": "email | form | unknown",
  "contact_person": "string",
  "contact_phone": "string",
  "deadline_text": "string",
  "sector": "string",
  "experience_level": "string",
  "education_level": "string",
  "logo_url": "string"
}`;

        // Call Mistral with Fallback
        const aiResult = await callAIJsonWithFallback<AIAnalysisResult>(prompt, systemPrompt);

        // Normalize lists to newline format for the database
        const cleanRequirements = normalizeBulletField(aiResult.requirements);
        const cleanResponsibilities = normalizeBulletField(aiResult.responsibilities);

        // Parse deadline using standard parser
        const textToParseDeadline = aiResult.deadline_text || stagingRow.deadline_text || stagingRow.description || "";
        const { deadline, deadline_text } = parseJobDeadline(textToParseDeadline);

        // Derive source label and key
        const sourceKey = (stagingRow.source || stagingRow.site || "Unknown").toLowerCase().replace(/\s+/g, "");
        const sourceLabel = stagingRow.site || stagingRow.source || "Unknown";

        // Assemble production payload
        const productionPayload = {
          source: sourceKey,
          site: sourceLabel,
          source_url: stagingRow.source_url,
          title: (aiResult.title || stagingRow.title || "Untitled").trim(),
          company: (aiResult.company || stagingRow.company || null)?.trim(),
          company_summary: aiResult.company_summary || null,
          role_description: aiResult.role_description || null,
          location: aiResult.location || stagingRow.location || null,
          county: aiResult.county || stagingRow.county || null,
          description: stagingRow.description || aiResult.role_description || "",
          description_summary: (
            aiResult.description_summary?.trim() ||
            stagingRow.description_summary?.trim() ||
            aiResult.role_description?.trim()?.slice(0, 350) ||
            stagingRow.summary?.trim() ||
            (stagingRow.description || "")?.trim()?.slice(0, 350) ||
            null
          ),
          requirements: cleanRequirements,
          responsibilities: cleanResponsibilities,
          job_type: aiResult.job_type || stagingRow.job_type || null,
          work_type: aiResult.work_type || stagingRow.work_type || null,
          salary_text: aiResult.salary_text || stagingRow.salary_text || null,
          application_url: aiResult.application_url || stagingRow.application_url || stagingRow.source_url,
          application_email: aiResult.application_email || stagingRow.application_email || null,
          application_method: aiResult.application_method || stagingRow.application_method || "unknown",
          contact_person: aiResult.contact_person || stagingRow.contact_person || null,
          contact_phone: aiResult.contact_phone || stagingRow.contact_phone || null,
          deadline: deadline || (stagingRow.deadline ? String(stagingRow.deadline) : null),
          deadline_text: deadline_text || aiResult.deadline_text || stagingRow.deadline_text || null,
          sector: aiResult.sector || stagingRow.sector || null,
          experience_level: aiResult.experience_level || stagingRow.experience_level || null,
          education_level: aiResult.education_level || stagingRow.education_level || null,
          logo_url: aiResult.logo_url || stagingRow.logo_url || null,
          scraped_at: stagingRow.scraped_at,
          updated_at: new Date().toISOString(),
        };

        // Upsert into public.scraped_jobs
        console.log(`Upserting refined job into public.scraped_jobs...`);
        const { error: upsertError } = await admin
          .from("scraped_jobs")
          .upsert(productionPayload, { onConflict: "source_url" });

        if (upsertError) {
          throw new Error(`Failed to upsert into scraped_jobs: ${upsertError.message}`);
        }

        // Update status of staging row to 'processed'
        console.log(`Marking staging row ${stagingRow.id} as processed...`);
        const { error: updateError } = await admin
          .from("scrapy_jobs")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", stagingRow.id);

        if (updateError) {
          throw new Error(`Failed to mark staging row as processed: ${updateError.message}`);
        }

        results.push({ id: stagingRow.id, status: "processed", title: productionPayload.title });

      } catch (innerError) {
        const msg = innerError instanceof Error ? innerError.message : String(innerError);
        console.error(`Error refining staging row ${stagingRow.id}:`, innerError);

        // Mark staging row as failed
        await admin
          .from("scrapy_jobs")
          .update({
            status: "failed",
            error_message: msg,
          })
          .eq("id", stagingRow.id);

        results.push({ id: stagingRow.id, status: "failed", error: msg });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: pendingRows.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("process-scrapy-jobs execution failed:", error);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
