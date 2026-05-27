# Site scrapers (ScrapingBee) — separate from user job flow

These functions populate **`scraped_jobs`** only. They do **not** modify `jobs`, `job_listings`, or the Find Jobs / Rescrape user flow.

**Pipeline per job:** ScrapingBee HTML (SerpAPI fallback) → **`runJobListingAnalyst`** via **Lovable API** (`LOVABLE_API_KEY` → `ai.gateway.lovable.dev`, Gemini fallback) → upsert `scraped_jobs`. `site`/`source` derived from `source_url` hostname.

| Root file | Edge function | Site |
|-----------|---------------|------|
| `index (1).ts` | `scrape-brightermonday` | BrighterMonday |
| `index (2).ts` | `scrape-fuzu` | Fuzu |
| `index (3).ts` | `scrape-linkedin` | LinkedIn |
| `index (4).ts` | `scrape-myjobmag` | MyJobMag |
| `index (5).ts` | `scrape-myjobsinkenya` | MyJobsInKenya |

Orchestrator: **`scrape-all-sites`** — one POST runs all five boards in-process (writes to `scraped_jobs`).

Individual functions (same logic, one board each): `scrape-fuzu`, `scrape-brightermonday`, `scrape-myjobmag`, `scrape-myjobsinkenya`, `scrape-linkedin`.

**Scheduled runs (08:00 EAT):** five separate `pg_cron` jobs — one per edge function (`scrape-fuzu`, `scrape-brightermonday`, `scrape-myjobmag`, `scrape-myjobsinkenya`, `scrape-linkedin`). **Not** `scrape-all-sites` or `scrape-cron`. One-time: `scripts/setup-scrape-cron-vault.sql` (Vault `scrape_cron_auth` = `CRON_SECRET`).

**Local test script:** `scripts/test-site-scrapers.ps1` or `npm run test:scrapers` (set `SUPABASE_SERVICE_ROLE_KEY` first).

## Env

- `SCRAPINGBEE_API_KEY` — primary HTML fetch for site scrapers
- `SERPAPI_API_KEY` — fallback when ScrapingBee fails (quota/401); Google Search + Google Jobs
- `LINKEDIN_LI_AT` — optional, for `scrape-linkedin`
- `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` — manual/cron auth

## Auth (important)

Use **Project Settings → API → `service_role` (secret)** — the long JWT starting with `eyJ...`.

Do **not** use `sb_publishable_*` keys. Supabase returns `Invalid JWT` before the function runs.

In the Supabase function tester, set **both** headers:

- `Authorization`: `Bearer eyJ...` (service_role)
- `apikey`: same `eyJ...` value (no `Bearer` prefix on apikey)

Body: `{"limit": 3}` (not `{"name":"Functions"}`).

## Manual trigger (recommended — runs all 5)

```bash
curl -X POST "https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/scrape-all-sites" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"limit": 3}'
```

**Windows PowerShell** — use `curl.exe` (one line), not `curl` (that is `Invoke-WebRequest`):

```powershell
$key = "<paste service_role JWT from Supabase dashboard>"
curl.exe -X POST "https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/scrape-all-sites" `
  -H "Authorization: Bearer $key" `
  -H "apikey: $key" `
  -H "Content-Type: application/json" `
  -d "{\"limit\": 3}"
```

A **200** response includes per-board `results` (even if some boards scrape 0 jobs). **500** with `SCRAPINGBEE_API_KEY is not set` means add that secret and redeploy.

Or one board only:

```bash
curl -X POST "https://eqkctzjyqmafpytvdepf.supabase.co/functions/v1/scrape-fuzu?limit=15" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## Daily 08:00 EAT (five cron jobs in DB)

| Cron job | Edge function | UTC cron (EAT) |
|----------|---------------|----------------|
| `scrape-fuzu-8am-eat` | `scrape-fuzu` | `0 5 * * *` (08:00) |
| `scrape-brightermonday-8am-eat` | `scrape-brightermonday` | `5 5 * * *` (08:05) |
| `scrape-myjobmag-8am-eat` | `scrape-myjobmag` | `10 5 * * *` (08:10) |
| `scrape-myjobsinkenya-8am-eat` | `scrape-myjobsinkenya` | `15 5 * * *` (08:15) |
| `scrape-linkedin-8am-eat` | `scrape-linkedin` | `20 5 * * *` (08:20) |

Each run uses `?limit=12`. **Required once:** `scripts/setup-scrape-cron-vault.sql`. Test: `SELECT public.invoke_site_scraper_edge('scrape-fuzu', 2);`

## Existing app flow (unchanged)

- **`jobs`** scrape → `discoverJobListings` → Firecrawl / `job_listings` / user `jobs` table
- **`scrape-cron`** → user workflows (unchanged)
