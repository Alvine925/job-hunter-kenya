# Tellus — System Analysis, Flow Gap & Recommendation

> Repo: `tanstack_start_ts` (TanStack Start + Vite + React 19 + Supabase Edge Functions, deployed to Cloudflare via `wrangler.jsonc`).
> Brand: **Tellus** (Kenya-focused AI job-application assistant).

---

## 1. What the system does

Tellus is an AI job-search copilot for the Kenyan market. It scrapes 5 job boards (Fuzu, BrighterMonday, MyJobMag, MyJobsInKenya, LinkedIn), AI-matches them to the user's CV/profile, and generates a complete "Application Pack" (cover letter, tailored CV blurb, email draft, interview prep) — optionally auto-sending via the user's Gmail and saving to Google Drive.

### Architecture at a glance

| Layer | Tech |
|---|---|
| Frontend | TanStack Router/Start, React 19, TanStack Query, Tailwind 4, shadcn/ui (Radix), [src/](src) |
| Auth | Supabase Auth + custom `login` edge fn for lockout/rate-limit, Google OAuth for Gmail/Drive scope |
| Data | Supabase Postgres (41 migrations in [supabase/migrations/](supabase/migrations)) |
| Compute | 20 Supabase Edge Functions in [supabase/functions/](supabase/functions) |
| Scraping | ScrapingBee (primary) → SerpAPI (fallback); Apify for LinkedIn; Firecrawl for job-monitor URLs |
| AI | Lovable Gateway (`ai.gateway.lovable.dev`) with Gemini fallback for analyst + matching + content generation |
| Scheduling | `pg_cron` — five daily jobs at 08:00–08:20 EAT, one per board |

### Two parallel "job universes" (this matters for §3)

The system maintains **two separate job tables** populated by **two separate pipelines**:

| Table | Pipeline | Trigger | Has match_score? | Surfaces in |
|---|---|---|---|---|
| `jobs` | `jobs` edge fn → `discoverJobListings` → AI analyst + AI matching → upsert | User clicks **Rescrape** on [find-jobs.tsx:122](src/routes/_authenticated/find-jobs.tsx:122) | **Yes** — real AI match score & `match_reason` | Dashboard, Find Jobs, Applications, `/jobs/$id` |
| `scraped_jobs` | `scrape-{board}` edge fns → AI analyst → upsert | Daily `pg_cron` at 08:00 EAT, one per board ([SITE_SCRAPERS.md](supabase/functions/SITE_SCRAPERS.md)) | **No** — AI analyst fields only, no match | Marketplace ([marketplace.tsx](src/routes/_authenticated/marketplace.tsx), [marketplace.$id.tsx](src/routes/_authenticated/marketplace.$id.tsx)) |

The two pipelines were intentionally split for safety — the [SITE_SCRAPERS.md:1](supabase/functions/SITE_SCRAPERS.md:1) doc literally says: *"They do not modify `jobs`. They populate `scraped_jobs` only."*

### User journey (happy path)

```
Onboarding → upload CV → AI extracts skills/roles → profile
   │
   ├─► Find Jobs ── Rescrape ──► jobs edge fn (live scrape + AI match) ─► jobs table (scored)
   │                                                                       │
   │                                                                       ├─► Dashboard "Top matches" (score ≥ 80)
   │                                                                       └─► /jobs/$id → Application Pack → Gmail / Drive
   │
   └─► Marketplace ──► reads scraped_jobs (daily-cron'd) ──► naive keyword match in JS ──► /marketplace/$id
                                                                                            │
                                                                                            └─► getMarketplaceJob() copies row into `jobs`, then same pack flow
```

---

## 2. The flow (traced end-to-end)

I walked the **Marketplace → Apply** flow because it is the largest surface area and the most exposed to scaled, daily data.

1. **Daily cron (08:00 EAT)** runs `scrape-fuzu`, `scrape-brightermonday`, etc. Each fetches HTML via ScrapingBee → runs `runJobListingAnalyst` (LLM) → upserts into `scraped_jobs`. **`?limit=12`** per board per day.
2. User opens **`/marketplace`** → route loader fires `listScrapedJobs({ limit: 200 })` at [marketplace/index.tsx:28](src/routes/_authenticated/marketplace/index.tsx:28).
3. Marketplace page also pulls the user's **profile** (skills + desired_roles) via a separate query [marketplace-page.tsx:283](src/components/marketplace/marketplace-page.tsx:283).
4. **"Match"** is computed *client-side in JavaScript* by lowercase-substring matching skills/roles against the concatenated job text:

   ```ts
   // src/components/marketplace/marketplace-page.tsx:351
   const userSkills = (profile?.skills || []).map((s) => s.toLowerCase().trim());
   const userRoles  = (profile?.desired_roles || []).map((r) => r.toLowerCase().trim());
   for (const job of allJobs) {
     const text = `${job.title} ${job.description} ${job.role_description} ${job.requirements}`.toLowerCase();
     const skillMatch = userSkills.some((s) => text.includes(s));
     const roleMatch  = userRoles.some((r)  => text.includes(r));
     if (skillMatch || roleMatch) matchedCount++;
   }
   ```

5. User clicks a marketplace job → `/marketplace/$id` → `getMarketplaceJob()` invokes `jobs` edge fn with `action: "get-scraped"` ([api.ts:483](src/lib/api.ts:483)) — this *copies* the scraped row into the user's `jobs` table and now runs the real AI matcher.
6. From there: Application Pack → Gmail draft → send → tracked in `applications`.

I verified the schema: [supabase/migrations/20260521260000_scraped_jobs_analyst_fields.sql](supabase/migrations/20260521260000_scraped_jobs_analyst_fields.sql) adds `company_summary`, `role_description`, `sector`, `experience_level`, `education_level` to `scraped_jobs` — but **no `match_score`, `match_reason`, or per-user match data**. Confirmed.

---

## 3. The opportunity (the gap)

> **Marketplace is the system's biggest funnel, and it's the only major surface that doesn't use the AI matcher.**

### The problem, concretely

- **Cron deposits ~60 fresh jobs into `scraped_jobs` every morning** (12 per board × 5 boards) — this is the freshest, broadest inventory in the system.
- But the Marketplace ranks/filters them with a **`String.includes()` substring match** computed *in the browser*, against `profile.skills` and `profile.desired_roles`.
- Meanwhile, the `jobs` pipeline — which already exists and works — runs a proper LLM matcher with a `match_score` (0-100) and a `match_reason` string. `Dashboard` and `Find Jobs` use it. `Marketplace` doesn't.

### Why the keyword match is broken

It conflates substring presence with semantic fit. Real failure modes from the code:

| User profile | Job title | `text.includes()` says | Truth |
|---|---|---|---|
| skill = `"R"` | "HR Officer", "PR Manager", "Senior Manager" | ✅ match | False positives — "r" is in almost every word |
| skill = `"react"` | "Reactor Operator at KenGen" | ✅ match | False positive |
| role = `"data analyst"` | "Senior Data Scientist" | ❌ no match | False negative — semantically very close |
| role = `"backend engineer"` | "Software Developer (Node.js, APIs)" | ❌ no match | False negative |
| skill = `"sql"` | "MySQL DBA", "PostgreSQL Admin" | ✅ match (substring) | True, but accidental |
| profile has no skills yet | any | always 0% | New users see an empty marketplace |

The lowercased substring scan is also case-sensitive to typos in the CV-parsed skill list — e.g. `"Node.js"` vs `"nodejs"` are different strings.

### Why this hurts the business

1. **Wasted scrape budget.** ScrapingBee + SerpAPI + Apify are paid per request. ~60 fresh jobs land daily, but users see them through a noisy filter. The cron pays the cost; the matcher captures none of the value.
2. **The funnel collapses at the widest point.** Marketplace is the front door to a 5-board, daily-refreshed inventory. If the relevance signal is wrong, users either (a) bounce or (b) hand-pick — which defeats the product premise of "AI does the matching for you".
3. **Duplicate work + duplicate spend.** When a marketplace job *does* get clicked, `getMarketplaceJob` re-runs scrape/analyst/match because the row is copied into `jobs`. The system is paying the analyst LLM twice for the same row — once on cron ingestion, once on user click. Yet it never paid the *matcher* LLM the one time it would actually help triage.
4. **Cron limit of 12/board is set defensively** — likely because nothing downstream uses the data efficiently, so increasing it would just amplify noise.
5. **Dashboard "Top matches" score ≥ 80 only reads from `jobs`** — meaning users only see top matches from boards they manually Rescraped, never from the daily cron's scraped_jobs harvest.

### Why this is the single highest-leverage gap

| Gap | Surface | User impact | Cost to fix |
|---|---|---|---|
| **Marketplace has no AI match score** ← this one | Marketplace (highest-volume, daily fresh) | Every user, every visit, every day | Medium — reuses existing matcher |
| Bulk logo fetch fires on every Dashboard mount ([dashboard.tsx:43](src/routes/_authenticated/dashboard.tsx:43)) | Dashboard | Wasted edge-fn invocations | Tiny |
| `listJobs` runs two sequential queries instead of one join | Find Jobs / Dashboard | 1 extra round-trip | Small |
| `query-client` cache may not persist across tabs | All pages | Cold loads | Small |

The marketplace-match gap is the only one that touches **revenue (cron spend), retention (Day-1 experience), and product positioning (the "AI" promise) simultaneously**.

---

## 4. Recommendation — fix in 3 phases

### Phase 1 (1–2 days) — Stop the bleeding: replace `text.includes()` with a real similarity score (still client-side)

Lowest-risk, no infra changes. Use the same fields you already have plus a sane similarity function.

```ts
// src/components/marketplace/marketplace-page.tsx — replace lines 343-368

import { computeJobMatch } from "@/lib/marketplace-profession-match"; // already exists in repo

const scoredJobs = useMemo(() => {
  if (!profile || allJobs.length === 0) return allJobs.map(j => ({ ...j, _score: 0 }));

  return allJobs.map(job => {
    const score = computeJobMatch(job, {
      skills: profile.skills ?? [],
      desiredRoles: profile.desired_roles ?? [],
      preferredCounty: profile.preferred_county,
      experienceLevel: profile.experience_level,
    });
    return { ...job, _score: score.percent, _reason: score.reason };
  }).sort((a, b) => b._score - a._score);
}, [allJobs, profile]);
```

Inside `computeJobMatch`:
- **Token-based** match, not substring. Tokenize skills (`"node.js"` → `["node","js","nodejs"]`) and require **whole-word** boundary hits.
- Weighted scoring: title hit (3×) > requirements hit (2×) > description hit (1×).
- Synonym table for the top 30 Kenyan job roles (`accountant` ⇔ `bookkeeper`, `data analyst` ⇔ `business intelligence analyst`).
- County match adds +10, mismatch −5.
- Cap at 100, floor at 0, return both `percent` and a human `reason` ("3 of your skills + role match").

Show the score as a badge on every marketplace row, and sort by it. **Single-PR impact** — turns the marketplace from "random list" into "ranked feed".

### Phase 2 (3–5 days) — Move matching server-side and persist it

This is the real fix. Three parts:

1. **Schema** — add columns to `scraped_jobs`:
   ```sql
   ALTER TABLE public.scraped_jobs
     ADD COLUMN match_score_cache JSONB DEFAULT '{}'::jsonb;
   -- shape: { "<user_id>": { score, reason, scored_at } }
   CREATE INDEX idx_scraped_jobs_match_cache ON public.scraped_jobs USING GIN (match_score_cache);
   ```
2. **Edge function** — new `scrape-match-cron` that runs after the 5 board crons (08:30 EAT):
   - For each active user, pull their profile once
   - For each user × the day's freshly-scraped jobs, call the **existing matcher** in [supabase/functions/_shared/](supabase/functions/_shared) (already used by `jobs` edge fn)
   - Batch the LLM calls (10–20 jobs per prompt, ask for JSON array of `{job_id, score, reason}`)
   - Write the result into `match_score_cache[user_id]`
3. **Marketplace query** — change [listScrapedJobs()](src/lib/scraped-jobs.ts:50) to select `match_score_cache->'<my_user_id>'` and order by it server-side. Removes all client-side scoring.

Operational notes:
- Gate by `profile.onboarding_completed = true` to avoid wasting calls on dead accounts.
- Cap to most-recent 7 days of scraped jobs per user (limits LLM spend).
- Re-score on profile update (cheap, just enqueue for that one user).
- Estimated cost: ~60 jobs/day × N active users × ~$0.0002 per job (Gemini Flash batched). 1000 active users ≈ \$12/day, far less than the wasted ScrapingBee budget today.

### Phase 3 (1 week) — Unify the two job universes

The split between `jobs` and `scraped_jobs` made sense as a safety wall during development, but it's now duplicating storage and AI spend. Long-term:

- Treat `scraped_jobs` as the **canonical inventory** (one row per real-world listing, dedup key = `source_url`).
- Replace the `jobs` table with a thin `user_job_interactions` table: `(user_id, scraped_job_id, saved_at, match_score, match_reason, tracker_status, application_id)`.
- `getMarketplaceJob`'s "copy into jobs on click" disappears — clicking just inserts a `user_job_interactions` row referencing the existing `scraped_jobs.id`.
- Removes ~3 of the 41 migrations' worth of duplicated columns, eliminates the double-LLM-analyst spend, and lets the Dashboard "Top matches" surface daily-cron jobs natively.

---

## 5. Suggested success metrics

Wire these from Phase 2 onward so you can prove the fix worked:

| Metric | Today (estimated) | Target after Phase 2 |
|---|---|---|
| % of marketplace visits where user clicks a job in top-10 | <20% (random-ish ordering) | >50% |
| Marketplace → Application Pack generation rate | low | 2–4× higher |
| Daily scraped jobs surfaced on Dashboard "Top matches" | 0 (only Rescrape feeds dashboard) | ~60 |
| Avg. cron jobs needed to find one ≥80% match per user | infinite (no score exists) | <10 |
| User Rescrape clicks per week (proxy for marketplace failing) | high | should drop |

---

## TL;DR

**System:** AI job-application assistant for Kenya. Two parallel job pipelines — a *daily cron* into `scraped_jobs` (marketplace), and a *user-triggered Rescrape* into `jobs` (find-jobs / dashboard).

**Flow:** Marketplace is the largest, freshest surface but ranks jobs with a naive `text.includes()` keyword scan in the browser — no AI matching, no real score, no `match_reason`. The AI matcher only runs on the manual-Rescrape path.

**Opportunity:** Reuse the existing matcher against `scraped_jobs` on a daily cron and persist a per-user score. Turns the marketplace from "random list" into a ranked feed, unlocks the value of every scrape spend, and unifies the Dashboard top-matches signal across both pipelines.

**Fix path:** Phase 1 — replace client substring with weighted token+synonym scoring (1–2 days). Phase 2 — server-side cron matcher with `match_score_cache` jsonb column (3–5 days). Phase 3 — collapse `jobs` and `scraped_jobs` into one canonical inventory with a `user_job_interactions` join (1 week).
