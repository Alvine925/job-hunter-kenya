# Data Flow Analysis: Raw Unprocessed Data on Marketplace

## Executive Summary

Your Tellus system has **two separate job tables** with a deliberate pipeline design to separate raw scraping from AI enrichment:

1. **`scrapy_jobs`** — Raw staging table (Python Scrapy spider output)
2. **`scraped_jobs`** — Production enriched table (after AI processing)

The marketplace **should** read from `scraped_jobs` only. However, raw unprocessed data is appearing, suggesting:
- The `process-scrapy-jobs` edge function (added May 28) is not successfully running or processing jobs
- Raw jobs are being seen before AI enrichment occurs, or
- There's a bypass where data skips enrichment

---

## Architecture Overview

### Three-Layer Data Pipeline

```
Python Scrapy (myjobsinkenya, brightermonday, fuzu, etc.)
         ↓
    [scrapy_jobs] ← Raw extraction with status tracking
    (status: pending/processed/error)
         ↓
process-scrapy-jobs Edge Fn (runs every 10 min)
   - Reads: 5 pending rows from scrapy_jobs
   - Calls: Mistral/Gemini AI for analysis
   - Writes: Enriched data → scraped_jobs (upsert on source_url)
   - Updates: scrapy_jobs row status → "processed"
         ↓
   [scraped_jobs] ← AI-enriched, ready for display
         ↓
Marketplace Frontend
   - Query: listScrapedJobs() → reads scraped_jobs only
   - Renders: job cards with enriched fields
```

---

## Database Table Structures

### 1. `scrapy_jobs` (Staging Table)

**Purpose:** Receive raw Scrapy spider output; act as a queue for AI processing

**Recent Changes (May 28, 2026):**
- Added `status TEXT NOT NULL DEFAULT 'pending'` — tracks processing state
- Added `processed_at TIMESTAMPTZ` — when the row was processed
- Added `error_message TEXT` — captures AI processing errors
- Added index: `scrapy_jobs_status_idx ON (status) WHERE status='pending'` — fast lookup for pending rows

**Raw Fields (from spiders):**
```sql
id, title, company, location, salary_text, job_type
description, summary, requirements
source_url, source, site
raw (JSONB), scraped_at, created_at, updated_at
STATUS TRACKING COLS: status, processed_at, error_message
```

**Fields That Are Raw/Unprocessed:**
- `title` — may be missing, truncated, or generic ("Job Vacancy", "Untitled")
- `company` — may be null or contain job-board name (not real employer)
- `description` — raw HTML-extracted text, may contain formatting noise
- `requirements` — unstructured, may be concatenated without boundaries
- No `company_summary`, `role_description`, or `sector` fields yet
- No county inference

### 2. `scraped_jobs` (Production Table)

**Purpose:** Hold AI-enriched, marketplace-ready job data

**Core Fields:**
```sql
id, source, source_url, title, company, location, county
description, description_summary, requirements, responsibilities
job_type, work_type, salary_text
application_url, application_email, application_method
contact_person, contact_phone, deadline, deadline_text
sector, experience_level, education_level
logo_url
scraped_at, updated_at
```

**AI-Added Fields** (from migration 20260521260000):
- `company_summary TEXT` — AI-written 2–4 sentence overview of employer
- `role_description TEXT` — AI-written 3–5 paragraph role narrative
- `sector TEXT` — inferred by AI (e.g., "Finance", "Technology", "Manufacturing")
- `experience_level TEXT` — normalized by AI (e.g., "Entry-level", "Mid-level", "Senior")
- `education_level TEXT` — inferred by AI (e.g., "Diploma", "Bachelor's", "Master's")

**Unique Constraint:** `UNIQUE (source_url)` — deduplication by real-world URL

---

## The AI Processing Pipeline: `process-scrapy-jobs`

**File:** [Dash/supabase/functions/process-scrapy-jobs/index.ts](../Dash/supabase/functions/process-scrapy-jobs/index.ts)

**Schedule:** Every 10 minutes (`*/10 * * * *`) via migration 20260528130100

**Authorization:** Requires `scrape_cron_auth` secret from Vault (created in setup-scrape-cron-vault.sql)

### Processing Flow

#### Step 1: Fetch Pending Rows
```typescript
const { data: pendingRows } = await admin
  .from("scrapy_jobs")
  .select("*")
  .eq("status", "pending")
  .order("scraped_at", { ascending: true })
  .limit(5);
```
Batches 5 jobs at a time from the staging queue.

#### Step 2: AI Analysis per Job
**AI Provider Cascade:**
1. **Primary:** Mistral API (`open-mistral-7b`)
   - Uses env vars: `MISTRAL_API_KEY`, `MISTRAL_KEY`, or `LOVABLE_MISTRAL_KEY`
   - Endpoint: `https://api.mistral.ai/v1/chat/completions`
   - Model: `open-mistral-7b` with `temperature: 0.1` (deterministic)

2. **Fallback:** Gemini via `aiJson()` helper (Cloudflare Workers AI or Lovable Gateway)
   - Defined in [job-agents.ts](../Dash/supabase/functions/_shared/job-agents.ts)
   - Uses `LOVABLE_API_KEY` → `ai.gateway.lovable.dev`

**System Prompt Rules (Critical):**
```
1. TITLE RESOLUTION: If title is missing/blank/"Untitled"/"N/A",
   extract/synthesize from description and metadata.

2. NO JOB BOARDS AS COMPANY: Must be the real employer (Safaricom, Equity Bank).
   Never return LinkedIn/BrighterMonday/MyJobMag/Fuzu as company name.

3. DETAIL EXTRACTION:
   - Extract clean application_email (hr@employer.com, not job-board email)
   - Infer Kenyan county from location or description
   - Extract company summary (What do they do? Sector? Scale in Kenya?)
   - Extract role description (role overview, key duties, who should apply)
   - Parse requirements and responsibilities as pipe-separated lists

4. NORMALIZE: job_type = "Full-time"|"Part-time"|"Contract"|"Internship"
              work_type = "On-site"|"Hybrid"|"Remote"

5. REMOVE PLACEHOLDERS: Replace "N/A", "Not specified", "unknown" with ""

6. PRESERVE CONTEXT: Never fabricate. Stay 100% faithful to original details.
```

#### Step 3: Assemble Production Payload
Combines AI result with fallback to staging values:
```typescript
const productionPayload = {
  source: sourceKey,                          // from staging.source
  site: sourceLabel,                          // from staging.site
  source_url: stagingRow.source_url,          // DEDUP KEY
  title: aiResult.title || stagingRow.title,  // AI-fixed title or original
  company: aiResult.company,                  // AI-cleaned, MUST be real employer
  company_summary: aiResult.company_summary,  // NEW: AI-written
  role_description: aiResult.role_description, // NEW: AI-written
  location: aiResult.location || stagingRow.location,
  county: aiResult.county,                    // NEW: AI-inferred
  description: stagingRow.description,        // KEEP original raw
  description_summary: aiResult.description_summary, // NEW: AI-written
  requirements: cleanRequirements,            // AI, normalized to newline-separated
  responsibilities: cleanResponsibilities,    // AI, normalized to newline-separated
  job_type: aiResult.job_type,
  work_type: aiResult.work_type,
  salary_text: aiResult.salary_text,
  sector: aiResult.sector,                    // NEW: AI-inferred
  experience_level: aiResult.experience_level, // NEW: AI-normalized
  education_level: aiResult.education_level,  // NEW: AI-inferred
  deadline: parseJobDeadline(...),            // NEW: parsed from deadline_text
  deadline_text: aiResult.deadline_text,
  // ... rest of fields
};
```

#### Step 4: Upsert to `scraped_jobs`
```typescript
const { error: upsertError } = await admin
  .from("scraped_jobs")
  .upsert(productionPayload, { onConflict: "source_url" });
```
Merges by `source_url` (one real job = one row, deduped).

#### Step 5: Mark Staging Row as Processed
```typescript
const { error: updateError } = await admin
  .from("scrapy_jobs")
  .update({
    status: "processed",
    processed_at: new Date().toISOString(),
    error_message: null,
  })
  .eq("id", stagingRow.id);
```
Prevents re-processing the same job.

**Error Handling:** If any step fails, the status remains "pending" and `error_message` is populated. The job retries in the next 10-minute cycle.

---

## Marketplace Display Layer

### Code Path

**Route Entry:** [src/routes/_authenticated/marketplace/index.tsx:22](../Dash/src/routes/_authenticated/marketplace/index.tsx:22)
```typescript
queryFn: () => listScrapedJobs({ limit: 200 })
```

**Query Function:** [src/lib/scraped-jobs.ts:91](../Dash/src/lib/scraped-jobs.ts:91)
```typescript
export async function listScrapedJobs(opts?: {
  source?: string;
  search?: string;
  limit?: number;
}): Promise<ScrapedJob[]> {
  let q = supabase
    .from("scraped_jobs")  // ← MUST read from scraped_jobs, not scrapy_jobs
    .select(SCRAPED_JOB_LIST_SELECT)
    .order("scraped_at", { ascending: false })
    .limit(opts?.limit ?? 500);

  if (opts?.source && opts.source !== "all") {
    q = q.or(`source.eq.${opts.source},site.eq.${opts.source}`);
  }

  const { data, error } = await q;
  // ...
}
```

**Fields Returned:**
```typescript
const SCRAPED_JOB_LIST_SELECT = [
  "id", "source", "site", "source_url", "title", "company", "location", "county",
  "description_summary",  // ← AI-enriched short summary, NOT raw description
  "job_type", "work_type", "salary_text",
  "application_url", "application_email", "application_method",
  "deadline", "deadline_text", "sector", "experience_level", "education_level",
  "scraped_at", "logo_url",
].join(", ");
```

**Display Component:** [src/components/marketplace/marketplace-page-content.tsx](../Dash/src/components/marketplace/marketplace-page-content.tsx)

Renders each job with enriched fields (sector, experience_level, role matching).

---

## Why Raw Data Might Be Showing

### Root Cause Hypothesis #1: `process-scrapy-jobs` Not Running

**Evidence to Check:**
1. Are there rows in `scrapy_jobs` with `status = 'pending'`?
   - If yes, and they're old (> 20 min), the cron is not executing.

2. Is the Vault secret `scrape_cron_auth` set correctly?
   ```sql
   SELECT name, decrypted_secret FROM vault.decrypted_secrets 
   WHERE name = 'scrape_cron_auth';
   ```
   - If missing or empty, the function logs and returns early:
     ```
     "scrape_cron_auth missing in Vault — process-scrapy-jobs skipped."
     ```

3. Is the pg_cron job scheduled?
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-scrapy-jobs-every-10m';
   ```
   - If not present, migration 20260528130100 did not apply correctly.

### Root Cause Hypothesis #2: AI Processing Failing Silently

**Evidence to Check:**
1. Are `scrapy_jobs` rows showing `error_message` values?
   ```sql
   SELECT id, status, error_message FROM scrapy_jobs WHERE status IN ('pending', 'error') LIMIT 10;
   ```

2. Are Mistral/Gemini env vars set?
   - `MISTRAL_API_KEY` or `MISTRAL_KEY` or `LOVABLE_MISTRAL_KEY`
   - Fallback requires `LOVABLE_API_KEY` for Gemini via Lovable Gateway

3. Check edge function logs (Supabase Dashboard → Functions → process-scrapy-jobs → Logs)
   - Look for:
     - `"Mistral API call failed..."`
     - `"MISTRAL_API_KEY is not set..."`
     - `"Failed to upsert into scraped_jobs: ..."`

### Root Cause Hypothesis #3: Staging Pipeline Writing Raw to `scraped_jobs`

**Evidence to Check:**
1. Are the daily board scrapers (scrape-brightermonday, scrape-fuzu, etc.) writing directly to `scraped_jobs`?
   - Search [Dash/supabase/functions/scrape-*/index.ts](../Dash/supabase/functions) for:
     ```typescript
     .from("scraped_jobs").upsert(...)
     ```
   - They should **only** upsert to `scraped_jobs` **after** calling `runJobListingAnalyst()` (AI enrichment).
   - They should **NOT** write raw data to `scraped_jobs` without AI processing.

2. Verify the old daily cron (before May 28 refactor) is not running:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE 'scrape_%';
   ```
   - Should see: 5 jobs for fuzu, brightermonday, myjobmag, myjobsinkenya, linkedin (at 08:00 EAT each)
   - These call the `/functions/scrape-*` endpoints, which DO call AI.
   - BUT then there's ALSO `process-scrapy-jobs-every-10m` for the Mistral/staging pipeline.
   - **Conflict possible:** Maybe the old `scrape-*` functions are writing raw to `scraped_jobs` AND the `process-scrapy-jobs` is ALSO writing?

### Root Cause Hypothesis #4: `scraped_jobs` Has Stale/Raw Rows

**Evidence to Check:**
1. Compare a sample `scraped_jobs` row with the equivalent `scrapy_jobs` row (by source_url):
   ```sql
   SELECT s1.id, s1.title, s1.company, s1.company_summary, s1.sector
   FROM scraped_jobs s1
   WHERE s1.company_summary IS NULL
      OR s1.role_description IS NULL
      OR s1.sector IS NULL
   LIMIT 5;
   ```
   - If AI-enriched fields (`company_summary`, `role_description`, `sector`, `experience_level`, `education_level`) are NULL or empty, the row was never AI-processed.
   - Compare `title` and `company` — if they look identical to raw values in `scrapy_jobs`, they bypassed enrichment.

---

## Where Raw Data Enters the System

### Entry Point 1: Python Scrapy Spider (Intentional)

**File:** [myscraper/myscraper/pipelines.py:144](../myscraper/myscraper/pipelines.py#L144)
- Upserts extracted data into `scrapy_jobs` table
- Fields: raw title, company (as extracted), location, description, requirements
- Expected: this is **staging data**, should be cleaned before surfacing

**Configuration:**
```python
SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "scrapy_jobs")
```
- Correctly defaults to `scrapy_jobs` (not `scraped_jobs`)

### Entry Point 2: Daily Board Scrapers (Should Call AI)

**Files:**
- [Dash/supabase/functions/scrape-brightermonday/index.ts](../Dash/supabase/functions/scrape-brightermonday/index.ts)
- [Dash/supabase/functions/scrape-fuzu/index.ts](../Dash/supabase/functions/scrape-fuzu/index.ts)
- [Dash/supabase/functions/scrape-linkedin/index.ts](../Dash/supabase/functions/scrape-linkedin/index.ts)
- (etc. for myjobmag, myjobsinkenya)

**Expected Flow:**
1. Fetch HTML via ScrapingBee
2. Extract basic fields (title, company, description)
3. Call `runJobListingAnalyst()` for AI enrichment
4. Upsert enriched row into `scraped_jobs`

**Status:** These functions do call AI (via `analyzeBoardJobListing()` in [_shared/scraped-job-analyst.ts](../Dash/supabase/functions/_shared/scraped-job-analyst.ts)). But they write directly to `scraped_jobs`, skipping the `scrapy_jobs` staging table.

### The Dual Pipeline Problem

**Old Pipeline (still active):**
```
scrape-brightermonday/fuzu/etc edge fns (08:00 EAT each)
  → fetch HTML
  → AI analyst (runJobListingAnalyst)
  → upsert to scraped_jobs ✓ ENRICHED
```

**New Pipeline (as of May 28):**
```
myscraper spider (anytime)
  → extract raw → scrapy_jobs
    └─ status: pending
    
process-scrapy-jobs (every 10 min)
  → read pending from scrapy_jobs
  → AI analyst (Mistral/Gemini) 
  → upsert to scraped_jobs ✓ ENRICHED
  → update status: processed
```

**Conflict:** If the old pipeline bypassed `scrapy_jobs` and wrote raw data directly to `scraped_jobs`, **or** if the `process-scrapy-jobs` cron is failing while the old pipeline still runs, then raw data can appear in the marketplace.

---

## Client-Side Matching (Not the Issue, But Relevant)

The marketplace also has a **client-side matching layer** that applies heuristics on top of AI-enriched data:

**File:** [src/lib/marketplace-profession-match.ts:199](../Dash/src/lib/marketplace-profession-match.ts#L199)

```typescript
export function computeJobMatch(
  job: ProfessionMatchJob,
  profile: JobMatchProfile
): { percent: number; reason: string }
```

**How it works:**
- Tokenizes user skills and desired roles (with synonyms for Kenyan roles)
- Matches against job title, description, requirements, role_description
- Assigns weighted scores: title (35) > description (15–20) > requirements (10) > description (5)
- Returns `percent` (0–100) and `reason` string

**Important:** This is **client-side scoring only**. It doesn't store anything. The data it scores is already enriched from `scraped_jobs`.

**BUT** — if the data in `scraped_jobs` is raw (missing `role_description`, `sector`, `experience_level`), this matching will perform poorly.

---

## Verification Checklist

### 1. Is `process-scrapy-jobs` Running?
```sql
-- Check for pending rows (should be empty if cron runs regularly)
SELECT COUNT(*) FROM scrapy_jobs WHERE status = 'pending';

-- Check the last processed time
SELECT MAX(processed_at) FROM scrapy_jobs WHERE status = 'processed';

-- Check for errors
SELECT COUNT(*) FROM scrapy_jobs WHERE status = 'error';
SELECT DISTINCT error_message FROM scrapy_jobs WHERE error_message IS NOT NULL;
```

### 2. Is the Vault Secret Set?
```sql
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'scrape_cron_auth' LIMIT 1;
```
- Should be non-empty string (your CRON_SECRET from environment)

### 3. Is the pg_cron Job Registered?
```sql
SELECT * FROM cron.job WHERE jobname = 'process-scrapy-jobs-every-10m';
```
- Should have schedule `*/10 * * * *`

### 4. Check AI Provider Configuration
In Supabase Edge Function secrets (Project Settings → Edge Functions → Secrets):
- Is `MISTRAL_API_KEY` set? (or `MISTRAL_KEY` / `LOVABLE_MISTRAL_KEY`)
- Is `LOVABLE_API_KEY` set as fallback?
- If missing, Gemini via fallback won't work either.

### 5. Inspect Data in Both Tables
```sql
-- Sample raw staging data
SELECT id, title, company, created_at, status FROM scrapy_jobs 
  WHERE created_at > NOW() - INTERVAL '1 hour' LIMIT 5;

-- Sample enriched production data
SELECT id, title, company, company_summary, sector, experience_level 
  FROM scraped_jobs 
  WHERE scraped_at > NOW() - INTERVAL '1 hour' LIMIT 5;

-- Check for raw-looking data in scraped_jobs (null enriched fields)
SELECT COUNT(*) FROM scraped_jobs 
  WHERE company_summary IS NULL AND sector IS NULL 
  AND experience_level IS NULL;
```

### 6. Check Marketplace Query Logs
- Does `listScrapedJobs()` see rows from `scraped_jobs`?
- Are the rows missing enriched fields?

---

## Recommended Fix Path (If Confirmed)

### Short Term: Enable Visibility
1. Add error logging/monitoring to `process-scrapy-jobs`
2. Query Vault secret and cron job status
3. Check edge function logs for failures
4. Verify AI provider keys are set

### Medium Term: Sync Pipeline
1. Ensure only the **new pipeline** (Python Scrapy → `scrapy_jobs` → AI → `scraped_jobs`) is active
2. Deprecate the old **daily board scrapers** writing directly to `scraped_jobs`
3. Ensure all raw data goes through `scrapy_jobs` staging first
4. Confirm `process-scrapy-jobs` runs successfully on schedule

### Long Term: Unify Tables
- Consolidate `jobs` and `scraped_jobs` into one canonical inventory
- Use `user_job_interactions` table for per-user matches (see SYSTEM_ANALYSIS.md)
- Remove duplicate AI analyst spending

---

## Files to Review/Check

| File | Purpose | Check For |
|------|---------|-----------|
| [Dash/supabase/migrations/20260528130000_scrapy_jobs_staging_status.sql](../Dash/supabase/migrations/20260528130000_scrapy_jobs_staging_status.sql) | Add status tracking to staging table | Applied? Index created? |
| [Dash/supabase/migrations/20260528130100_schedule_scrapy_ai_ingestion.sql](../Dash/supabase/migrations/20260528130100_schedule_scrapy_ai_ingestion.sql) | Schedule `process-scrapy-jobs` cron | Vault secret set? Cron registered? |
| [Dash/supabase/functions/process-scrapy-jobs/index.ts](../Dash/supabase/functions/process-scrapy-jobs/index.ts) | Main AI processing pipeline | Logs? Errors? Is it being invoked? |
| [Dash/supabase/functions/_shared/job-agents.ts](../Dash/supabase/functions/_shared/job-agents.ts) | AI analysis functions | Are LLM keys configured? |
| [Dash/src/lib/scraped-jobs.ts:91](../Dash/src/lib/scraped-jobs.ts#L91) | Marketplace data fetcher | Correct table (`scraped_jobs`)? |
| [Dash/supabase/functions/scrape-brightermonday/index.ts](../Dash/supabase/functions/scrape-brightermonday/index.ts) | Old daily board scraper | Still active? Bypassing staging? |
| [myscraper/myscraper/pipelines.py:144](../myscraper/myscraper/pipelines.py#L144) | Scrapy → Supabase pipeline | Correctly uses `scrapy_jobs`? |

---

## Summary

**The system is designed correctly** — raw data is intentionally isolated in `scrapy_jobs`, passed through AI enrichment via `process-scrapy-jobs`, and only production-ready data reaches `scraped_jobs` and the marketplace.

**Raw data is showing because:**
1. `process-scrapy-jobs` cron is likely **not running** (Vault secret missing or cron not registered)
2. **OR** the AI processing is **failing** (Mistral/Gemini keys not set or API errors)
3. **OR** the old daily scrapers are still **writing raw data** directly to `scraped_jobs` without enrichment
4. **OR** (least likely) the marketplace is accidentally reading from `scrapy_jobs` instead of `scraped_jobs`

**Next step:** Run the verification checklist above to pinpoint which layer is broken, then focus the fix there.
