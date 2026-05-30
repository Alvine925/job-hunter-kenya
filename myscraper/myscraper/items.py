"""
JobItem — fields map 1-to-1 with the public.scrapy_jobs table.

Column mapping:
  site                ← spider name  (e.g. "brightermonday")
  title               ← h1 on detail page
  company             ← company name text
  location            ← city / area string
  job_type            ← full-time / part-time / contract / internship
  is_remote           ← bool derived from text  (default False)
  description         ← full plain-text description
  summary             ← first ~300 chars of description (auto-filled by pipeline)
  requirements        ← requirements / qualifications block
  salary_text         ← raw salary string e.g. "KES 50,000 – 80,000"
  posted_at           ← parsed datetime or None
  source_url          ← canonical detail-page URL  (unique key)
  raw                 ← jsonb blob for anything extra
  scraped_at          ← set by ScrapedAtPipeline
  source              ← same as site (kept for backward compat)
  county              ← Kenyan county extracted from location
  description_summary ← longer AI-ready summary (pipeline can fill later)
  responsibilities    ← responsibilities block
  work_type           ← on-site / hybrid / remote
  application_url     ← direct apply link
  application_email   ← email found in how-to-apply text
  application_method  ← "url" | "email" | "unknown"
  contact_person      ← contact name if found
  contact_phone       ← phone number if found
  deadline            ← parsed date (YYYY-MM-DD) or None
  deadline_text       ← raw deadline string from the page
  company_summary     ← "About the company" paragraph
  role_description    ← "About the role" paragraph (separate from full desc)
  sector              ← industry / sector category
  experience_level    ← junior / mid / senior / executive
  education_level     ← degree requirement string
  logo_url            ← company logo image URL
"""
import scrapy


class JobItem(scrapy.Item):
    # ── Core (required by DB) ──────────────────────────────────────────────
    site            = scrapy.Field()   # maps to DB `site`
    title           = scrapy.Field()
    source_url      = scrapy.Field()

    # ── Company & role ────────────────────────────────────────────────────
    company         = scrapy.Field()
    company_summary = scrapy.Field()
    logo_url        = scrapy.Field()
    role_description= scrapy.Field()
    sector          = scrapy.Field()

    # ── Location ──────────────────────────────────────────────────────────
    location        = scrapy.Field()
    county          = scrapy.Field()
    is_remote       = scrapy.Field()   # bool
    work_type       = scrapy.Field()   # on-site | hybrid | remote

    # ── Job details ───────────────────────────────────────────────────────
    job_type        = scrapy.Field()   # full-time | part-time | contract | internship
    experience_level= scrapy.Field()   # junior | mid | senior | executive
    education_level = scrapy.Field()
    salary_text     = scrapy.Field()

    # ── Description blocks ────────────────────────────────────────────────
    description         = scrapy.Field()
    summary             = scrapy.Field()   # first ~300 chars, filled by pipeline
    description_summary = scrapy.Field()   # longer version for AI use
    requirements        = scrapy.Field()
    responsibilities    = scrapy.Field()

    # ── Application ───────────────────────────────────────────────────────
    application_url     = scrapy.Field()
    application_email   = scrapy.Field()
    application_method  = scrapy.Field()   # url | email | unknown
    contact_person      = scrapy.Field()
    contact_phone       = scrapy.Field()
    deadline            = scrapy.Field()   # date string YYYY-MM-DD
    deadline_text       = scrapy.Field()   # raw text from page

    # ── Timestamps & meta ─────────────────────────────────────────────────
    posted_at       = scrapy.Field()   # ISO datetime string or None
    scraped_at      = scrapy.Field()   # set by ScrapedAtPipeline
    source          = scrapy.Field()   # same value as site

    # ── Extra ─────────────────────────────────────────────────────────────
    raw             = scrapy.Field()   # jsonb catch-all
