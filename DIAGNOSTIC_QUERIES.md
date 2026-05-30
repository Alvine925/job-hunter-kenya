# Diagnostic Queries — Data Flow Troubleshooting

Run these SQL queries in the Supabase SQL editor to identify where raw data is leaking into the marketplace.

---

## 1. Check If Cron Is Running

### Check Vault Secret
```sql
-- Is the scrape_cron_auth secret set?
SELECT 
  name,
  CASE 
    WHEN decrypted_secret IS NULL OR decrypted_secret = '' THEN '❌ EMPTY/NULL'
    ELSE '✅ SET (length: ' || LENGTH(decrypted_secret) || ')'
  END AS status
FROM vault.decrypted_secrets 
WHERE name = 'scrape_cron_auth';
```
**Expected:** `✅ SET` with a non-empty value
**If NULL/EMPTY:** The cron function will fail with "scrape_cron_auth missing in Vault"

### Check Cron Job Registration
```sql
-- Is the 10-minute cron job registered?
SELECT 
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'process-scrapy-jobs-every-10m';
```
**Expected:** 1 row with:
- `schedule`: `*/10 * * * *`
- `active`: `true`
- `command`: Should reference `invoke_process_scrapy_jobs_edge()`

**If no rows:** Migration 20260528130100 did not apply. Run it manually.

---

## 2. Check If Jobs Are Being Staged

### Count Pending Jobs
```sql
-- How many jobs are waiting to be processed?
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_created,
  MAX(processed_at) as newest_processed
FROM scrapy_jobs
GROUP BY status
ORDER BY count DESC;
```

**Expected Output (healthy):**
```
status     | count | oldest_created | newest_processed
-----------|-------|--------|----------------
processed  | 250   | 2 days ago | 5 minutes ago
pending    | 0     | NULL | NULL
error      | 0     | NULL | NULL
```

**If many pending (> 10) and old (> 20 min):**
- Cron is not running
- OR AI processing is failing and jobs are not transitioning to processed

**If error count > 0:**
- AI processing is failing
- Check the `error_message` column

### Check Error Details
```sql
-- What errors are occurring?
SELECT 
  id,
  title,
  company,
  status,
  error_message,
  updated_at
FROM scrapy_jobs
WHERE status = 'error'
ORDER BY updated_at DESC
LIMIT 10;
```

**Common errors:**
- `"Mistral API returned status 401..."` → API key invalid
- `"MISTRAL_API_KEY is not set..."` → Missing env var (should fallback to Gemini)
- `"Failed to upsert into scraped_jobs: ..."` → DB write error

### Check Last Processing Time
```sql
-- When was the last job processed?
SELECT 
  MAX(processed_at) as last_processed,
  NOW() - MAX(processed_at) as time_ago,
  COUNT(*) as total_processed
FROM scrapy_jobs
WHERE status = 'processed';
```

**Expected:** `time_ago` should be < 20 minutes
**If NULL or > 1 hour:** Cron has never run or not running recently

---

## 3. Check If Data Is Being Enriched

### Compare Fields in Both Tables
```sql
-- Sample one job in scrapy_jobs and see if a matching scraped_jobs row exists
WITH staging_sample AS (
  SELECT id, source_url, title, company, description, status
  FROM scrapy_jobs
  WHERE status = 'processed'
  LIMIT 1
)
SELECT 
  'STAGING (scrapy_jobs)' as table_name,
  s.id,
  s.title as title,
  s.company as company,
  s.description as description,
  NULL::text as company_summary,
  NULL::text as role_description,
  NULL::text as sector
FROM staging_sample s
UNION ALL
SELECT 
  'PRODUCTION (scraped_jobs)' as table_name,
  p.id,
  p.title,
  p.company,
  p.description,
  p.company_summary,
  p.role_description,
  p.sector
FROM scraped_jobs p
WHERE p.source_url = (SELECT source_url FROM staging_sample LIMIT 1);
```

**Expected:**
- Staging row: `title`, `company`, `description` may be raw/incomplete; NO `company_summary`, `role_description`, `sector`
- Production row (same URL): `title` cleaned, `company` is real employer, `description` same, BUT `company_summary`, `role_description`, `sector` are populated

**If production row has NULL values:**
- Job was never AI-enriched
- Check if `error_message` in staging row

---

## 4. Check If Marketplace Is Reading Enriched Data

### Count Raw vs Enriched in Scraped_Jobs
```sql
-- How many jobs in scraped_jobs are missing AI enrichment?
SELECT 
  CASE 
    WHEN company_summary IS NOT NULL AND role_description IS NOT NULL AND sector IS NOT NULL THEN 'Enriched'
    ELSE 'Missing Enrichment'
  END as enrichment_status,
  COUNT(*) as count,
  COUNT(DISTINCT source) as unique_sources
FROM scraped_jobs
GROUP BY enrichment_status
ORDER BY count DESC;
```

**Expected:**
```
enrichment_status | count | unique_sources
------------------|-------|----------------
Enriched          | ~60   | 5
```

**If many "Missing Enrichment":**
- Data was inserted without going through `process-scrapy-jobs`
- OR `process-scrapy-jobs` never ran

### Find Raw-Looking Data
```sql
-- Find jobs that look like they skipped AI processing
SELECT 
  id,
  source,
  title,
  company,
  CASE 
    WHEN company_summary IS NULL THEN 'NULL'
    WHEN LENGTH(company_summary) < 20 THEN 'TOO SHORT'
    ELSE 'OK'
  END as company_summary_status,
  CASE 
    WHEN role_description IS NULL THEN 'NULL'
    WHEN LENGTH(role_description) < 50 THEN 'TOO SHORT'
    ELSE 'OK'
  END as role_desc_status,
  COALESCE(sector, '(empty)') as sector,
  updated_at
FROM scraped_jobs
WHERE 
  (company_summary IS NULL OR LENGTH(company_summary) < 20)
  OR (role_description IS NULL OR LENGTH(role_description) < 50)
  OR sector IS NULL
ORDER BY updated_at DESC
LIMIT 20;
```

---

## 5. Check Data Path from Staging to Production

### Trace One Job Through the Pipeline
```sql
-- Replace '...' with a recent job title from marketplace
WITH staging AS (
  SELECT id, source_url, title, company, status, error_message, processed_at
  FROM scrapy_jobs
  WHERE title ILIKE '%..title snippet..%'
  ORDER BY created_at DESC
  LIMIT 1
),
produced AS (
  SELECT id, source_url, title, company, company_summary, role_description, sector, updated_at
  FROM scraped_jobs
  WHERE source_url = (SELECT source_url FROM staging LIMIT 1)
)
SELECT 
  'STAGED' as stage,
  s.id as id,
  s.title,
  s.company,
  s.status,
  s.error_message,
  s.processed_at
FROM staging s
UNION ALL
SELECT 
  'PRODUCED' as stage,
  p.id,
  p.title,
  p.company,
  CASE WHEN p.company_summary IS NOT NULL THEN 'Enriched' ELSE 'Missing' END,
  p.role_description,
  p.updated_at
FROM produced p;
```

**Expected:**
- If STAGED status is `processed` → PRODUCED row exists with non-NULL enrichment fields
- If STAGED status is `pending` → No PRODUCED row yet (waiting for next cron run)
- If STAGED status is `error` → Check error_message for why enrichment failed

---

## 6. Check Edge Function Logs

```sql
-- In Supabase Dashboard, go to:
-- Project → Edge Functions → process-scrapy-jobs → Logs
-- 
-- Look for these messages:
-- ✅ "Fetching up to 5 pending staging rows from scrapy_jobs..."
-- ✅ "Found X pending jobs to process."
-- ✅ "Processing job ID: ... | Source URL: ..."
-- ✅ "Upserting refined job into public.scraped_jobs..."
-- ✅ "Marking staging row X as processed..."
--
-- ❌ "scrape_cron_auth missing in Vault — process-scrapy-jobs skipped."
-- ❌ "Mistral API call failed..."
-- ❌ "MISTRAL_API_KEY is not set..."
-- ❌ "Failed to upsert into scraped_jobs: ..."
```

---

## 7. Check If Old Pipeline Is Bypassing Staging

### Find Jobs Not in Staging Table
```sql
-- Are there scraped_jobs without corresponding scrapy_jobs?
-- (This suggests they were inserted by old pipeline, skipping staging)
SELECT 
  sj.id,
  sj.source_url,
  sj.title,
  sj.company,
  sj.company_summary,
  sj.sector,
  sj.updated_at,
  CASE WHEN stj.id IS NULL THEN 'NO STAGING ROW' ELSE 'has staging' END as pipeline
FROM scraped_jobs sj
LEFT JOIN scrapy_jobs stj ON stj.source_url = sj.source_url
WHERE stj.id IS NULL
  AND sj.source NOT IN ('linkedin_apify', 'serpapi_google_jobs')  -- these might have old flow
ORDER BY sj.updated_at DESC
LIMIT 10;
```

**If results > 0:**
- Old daily scrapers (scrape-brightermonday, etc.) are still writing directly to `scraped_jobs`
- They may or may not be calling AI enrichment
- Check if `company_summary` and `role_description` are populated (if yes, AI ran; if NULL, raw data)

---

## 8. Quick Health Check Script

```sql
-- Run all checks at once
WITH vault_check AS (
  SELECT 
    CASE WHEN decrypted_secret IS NOT NULL AND decrypted_secret != '' THEN 'PASS' ELSE 'FAIL' END as vault_secret,
    'scrape_cron_auth'::text as check_name
  FROM vault.decrypted_secrets 
  WHERE name = 'scrape_cron_auth'
  LIMIT 1
),
cron_check AS (
  SELECT 
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as cron_job,
    'process-scrapy-jobs-every-10m'::text as check_name
  FROM cron.job 
  WHERE jobname = 'process-scrapy-jobs-every-10m' AND active = true
),
pending_check AS (
  SELECT 
    CASE WHEN COUNT(*) = 0 THEN 'PASS' WHEN COUNT(*) < 5 THEN 'WARN' ELSE 'FAIL' END as pending_jobs,
    'scrapy_jobs.status=pending'::text as check_name
  FROM scrapy_jobs
  WHERE status = 'pending' AND created_at > NOW() - INTERVAL '30 minutes'
),
enrichment_check AS (
  SELECT 
    CASE 
      WHEN SUM(CASE WHEN company_summary IS NOT NULL AND sector IS NOT NULL THEN 1 ELSE 0 END) > 0.8 * COUNT(*) 
        THEN 'PASS' 
      ELSE 'FAIL' 
    END as enriched_ratio,
    'scraped_jobs enriched'::text as check_name
  FROM scraped_jobs
  WHERE updated_at > NOW() - INTERVAL '1 day'
),
table_check AS (
  SELECT 
    CASE 
      WHEN (SELECT COUNT(*) FROM scraped_jobs) > 0 THEN 'PASS'
      ELSE 'FAIL'
    END as scraped_jobs_populated,
    'scraped_jobs has data'::text as check_name
)
SELECT 
  COALESCE(vault_check.vault_secret, cron_check.cron_job, pending_check.pending_jobs, enrichment_check.enriched_ratio, table_check.scraped_jobs_populated) as status,
  COALESCE(vault_check.check_name, cron_check.check_name, pending_check.check_name, enrichment_check.check_name, table_check.check_name) as check_name
FROM vault_check
FULL OUTER JOIN cron_check ON 1=1
FULL OUTER JOIN pending_check ON 1=1
FULL OUTER JOIN enrichment_check ON 1=1
FULL OUTER JOIN table_check ON 1=1
ORDER BY status DESC;
```

**Expected Output:**
```
status | check_name
-------|----------------------------------
PASS   | scrape_cron_auth
PASS   | process-scrapy-jobs-every-10m
PASS   | scrapy_jobs.status=pending
PASS   | scraped_jobs enriched
PASS   | scraped_jobs has data
```

If any are `FAIL`, focus the fix there.

---

## Interpretation Guide

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Vault secret is NULL/EMPTY | Vault not initialized | Run [setup-scrape-cron-vault.sql](../Dash/scripts/setup-scrape-cron-vault.sql) |
| Cron job doesn't exist | Migration didn't apply | Run [20260528130100_schedule_scrapy_ai_ingestion.sql](../Dash/supabase/migrations/20260528130100_schedule_scrapy_ai_ingestion.sql) manually |
| Many pending jobs, all old | Cron never ran or failed | Check vault secret + edge function logs |
| Error count > 0 | AI processing failing | Check Mistral/Gemini API keys in Function secrets |
| Scraped_jobs missing enrichment fields | Data inserted without AI | Check if old scrape-* functions are bypassing |
| No staging rows exist | Python Scrapy not running | Check myscraper cron/scheduler |

---

## Next Steps

1. **Run the Quick Health Check** (Section 8) to get a status snapshot
2. **For each FAIL status**, dig deeper with the specific diagnostic query
3. **Once you identify the broken layer**, refer to the fix recommendations in `DATA_FLOW_ANALYSIS_COMPLETE.md`
4. **Monitor logs** after applying fixes to confirm data is flowing correctly

