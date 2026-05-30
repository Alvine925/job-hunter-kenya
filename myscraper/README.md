# Kenyan Jobs Scraper — Scrapy + Supabase

Scrapes job listings from Kenyan job boards and stores them in a Supabase `jobs` table. Your frontend reads from that table — no expensive API calls needed.

## Sources

| Spider | Site | JS required |
|--------|------|------------|
| `brightermonday` | brightermonday.co.ke | No |
| `myjobmag` | myjobmag.co.ke | No |
| `fuzu` | fuzu.com/kenya/jobs | Yes (Playwright) |
| `myjobsinkenya` | myjobsinkenya.com | No (requires login) |
| `google_jobs` | Google Jobs widget | Yes (Playwright) |

## Project structure

```
myscraper/
  spiders/
    brightermonday.py   ← BrighterMonday Kenya
    fuzu.py             ← Fuzu Kenya (React SPA)
    google_jobs.py      ← Google Jobs search widget
    myjobmag.py         ← MyJobMag Kenya
    myjobsinkenya.py    ← MyJobsInKenya (login required)
  items.py              ← JobItem field definitions
  pipelines.py          ← Validation → timestamp → Supabase upsert
  settings.py           ← Scrapy settings (throttle, concurrency, etc.)
  utils.py              ← clean_text / first_text helpers
scheduler.py            ← APScheduler: runs all spiders every N hours
run.py                  ← One-shot runner (no scheduling)
supabase_schema.sql     ← Run once in Supabase SQL editor
requirements.txt
.env.example
```

## 1. Install

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium      # only needed for fuzu + google_jobs
```

## 2. Create the Supabase table

In **Supabase → SQL Editor**, paste and run `supabase_schema.sql`.

## 3. Configure credentials

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

Use the **service_role** key (found in Supabase → Settings → API). Never commit `.env`.

## 4. Run once (manual)

```bash
# All spiders
python run.py

# Specific spiders
python run.py brightermonday myjobmag

# Limit pages while testing
MAX_PAGES=2 python run.py brightermonday

# Raw scrapy command
scrapy crawl brightermonday -s MAX_PAGES=2
```

## 5. Run on a schedule

```bash
# Runs every 6 hours by default (first run is immediate)
python scheduler.py

# Change interval
SCRAPE_INTERVAL_HOURS=12 python scheduler.py
```

### Production: run as a background service

**systemd (Linux VPS / Ubuntu server):**

Create `/etc/systemd/system/job-scraper.service`:
```ini
[Unit]
Description=Job Scraper Scheduler
After=network.target

[Service]
WorkingDirectory=/path/to/myscraper
ExecStart=/path/to/.venv/bin/python scheduler.py
EnvironmentFile=/path/to/myscraper/.env
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now job-scraper
sudo journalctl -u job-scraper -f   # follow logs
```

**Simple cron (runs every 6 hours):**
```cron
0 */6 * * * cd /path/to/myscraper && .venv/bin/python run.py >> /var/log/scraper.log 2>&1
```

## 6. Read jobs from your frontend

In your TanStack/React app use the Supabase **anon** key (public, safe for client):

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Fetch latest jobs
const { data: jobs } = await supabase
  .from('jobs')
  .select('id,title,company,location,job_type,salary,application_url,scraped_at')
  .order('scraped_at', { ascending: false })
  .limit(20)
```

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the anon key, not service_role) to the frontend `.env`.

## Pipeline stages

```
Spider yields JobItem
    │
    ▼
ValidationPipeline (100)  — drops items without title or source_url
    │
    ▼
ScrapedAtPipeline (200)   — stamps scraped_at = UTC now
    │
    ▼
SupabasePipeline (300)    — upserts on (source, source_url); safe to re-run
```

## Tuning selectors

Selectors are documented inline in each spider file. If a site changes its markup, update the CSS selectors at the top of the relevant spider and re-test with:

```bash
scrapy crawl brightermonday -s MAX_PAGES=1 -O test.json
```

## Be a polite scraper

- `ROBOTSTXT_OBEY = True`
- AutoThrottle enabled (1–15s delay, 2 concurrent)
- Always check each site's Terms of Service before scraping at scale
