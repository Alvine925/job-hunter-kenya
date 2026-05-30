-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase schema for the jobs scraper
-- Run this once in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id                   uuid        primary key default gen_random_uuid(),

  -- Source identification & deduplication
  source               text        not null,   -- 'brightermonday' | 'fuzu' | 'myjobmag' | 'myjobsinkenya' | 'google_jobs'
  source_url           text        not null,   -- canonical URL of the job detail page
  external_id          text,                   -- site-specific id/slug

  -- Core job fields
  title                text,
  company              text,
  location             text,
  job_type             text,                   -- full-time | part-time | contract | internship
  category             text,
  salary               text,
  experience           text,
  education            text,

  -- Description
  description          text,                   -- plain-text version
  description_html     text,                   -- raw HTML (preserved for rich display)
  requirements         text,
  responsibilities     text,
  how_to_apply         text,

  -- Application info
  application_url      text,
  application_deadline text,
  posted_at            text,                   -- raw string from the source site
  tags                 text[]      default '{}',

  -- Metadata
  raw                  jsonb,                  -- any extra fields the spider picked up
  scraped_at           timestamptz not null default now(),

  -- Deduplication constraint
  unique (source, source_url)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists jobs_source_idx      on public.jobs (source);
create index if not exists jobs_scraped_at_idx  on public.jobs (scraped_at desc);
create index if not exists jobs_company_idx     on public.jobs (company);
create index if not exists jobs_location_idx    on public.jobs (location);
create index if not exists jobs_title_search_idx on public.jobs using gin (to_tsvector('english', coalesce(title, '')));

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.jobs enable row level security;

-- Allow anyone (anon + authenticated) to READ jobs — your frontend will use the anon key
create policy "Public read access"
  on public.jobs for select
  using (true);

-- The scraper uses the service_role key which bypasses RLS for writes.
-- No extra INSERT/UPDATE policy needed for the scraper.

-- ── Useful views ─────────────────────────────────────────────────────────────
create or replace view public.recent_jobs as
  select
    id, source, title, company, location, job_type,
    category, salary, application_deadline, application_url,
    posted_at, scraped_at, tags
  from public.jobs
  order by scraped_at desc;
