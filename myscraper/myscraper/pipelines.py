"""
Scrapy pipelines (in priority order):

  100  ValidationPipeline  — drop items with no title or source_url
  200  EnrichmentPipeline  — fill derived fields (summary, county, remote, method…)
  300  ScrapedAtPipeline   — stamp scraped_at / ensure source mirrors site
  400  SupabasePipeline    — upsert into public.scrapy_jobs
"""
import json
import logging
import os
from datetime import datetime, timezone

from itemadapter import ItemAdapter
from scrapy.exceptions import DropItem

from myscraper.utils import (
    detect_application_method,
    detect_experience_level,
    detect_remote,
    detect_work_type,
    extract_county,
    extract_email,
    extract_phone,
    extract_hiring_company,
    make_summary,
)

logger = logging.getLogger(__name__)


# ── 100: Validation ────────────────────────────────────────────────────────
class ValidationPipeline:
    def process_item(self, item, spider):
        a = ItemAdapter(item)
        if not a.get("title"):
            raise DropItem(f"No title — {a.get('source_url')}")
        if not a.get("source_url"):
            raise DropItem(f"No source_url — {a.get('title')}")
        return item


# ── 200: Enrichment ────────────────────────────────────────────────────────
class EnrichmentPipeline:
    """
    Derives all the computed/cleaned fields so spiders stay simple.
    Every field in scrapy_jobs that needs more than a raw CSS extraction
    is handled here.
    """

    def process_item(self, item, spider):
        a = ItemAdapter(item)

        # Extract/clean company name to get the actual hiring company rather than recruiter
        a["company"] = extract_hiring_company(
            a.get("title"),
            a.get("company"),
            a.get("description"),
            a.get("raw")
        )

        # summary — first ~300 chars of description
        if not a.get("summary"):
            a["summary"] = make_summary(a.get("description"))

        # description_summary — slightly longer for AI use
        if not a.get("description_summary"):
            desc = a.get("description") or ""
            a["description_summary"] = (desc[:800] + "…") if len(desc) > 800 else desc or None

        # county — extracted from location string
        if not a.get("county"):
            a["county"] = extract_county(a.get("location"))

        # remote / work_type
        probe_fields = [a.get("location"), a.get("job_type"), a.get("description"), a.get("work_type")]
        if a.get("is_remote") is None:
            a["is_remote"] = detect_remote(probe_fields)
        if not a.get("work_type"):
            a["work_type"] = detect_work_type(probe_fields)

        # application_email — scan description + deadline_text
        if not a.get("application_email"):
            for field in ["description", "requirements", "deadline_text"]:
                email = extract_email(a.get(field))
                if email:
                    a["application_email"] = email
                    break

        # contact_phone — scan same fields
        if not a.get("contact_phone"):
            for field in ["description", "requirements", "deadline_text"]:
                phone = extract_phone(a.get(field))
                if phone:
                    a["contact_phone"] = phone
                    break

        # application_method
        if not a.get("application_method") or a.get("application_method") == "unknown":
            a["application_method"] = detect_application_method(
                a.get("application_url"), a.get("application_email")
            )

        # experience_level — scan title + description
        if not a.get("experience_level"):
            combined = " ".join(filter(None, [a.get("title"), (a.get("description") or "")[:400]]))
            a["experience_level"] = detect_experience_level(combined)

        # ensure source mirrors site
        if not a.get("source"):
            a["source"] = a.get("site")

        return item


# ── 300: Timestamps ────────────────────────────────────────────────────────
class ScrapedAtPipeline:
    def process_item(self, item, spider):
        a = ItemAdapter(item)
        now = datetime.now(timezone.utc).isoformat()
        a["scraped_at"] = now
        if not a.get("source"):
            a["source"] = a.get("site")
        return item


# ── 400: Supabase ──────────────────────────────────────────────────────────

# Fields that exist in scrapy_jobs — anything else goes into `raw`
_DB_COLUMNS = {
    "site", "title", "company", "location", "job_type", "is_remote",
    "description", "summary", "requirements", "salary_text", "posted_at",
    "source_url", "raw", "scraped_at", "source", "county",
    "description_summary", "responsibilities", "work_type",
    "application_url", "application_email", "application_method",
    "contact_person", "contact_phone", "deadline", "deadline_text",
    "company_summary", "role_description", "sector",
    "experience_level", "education_level", "logo_url",
}


class SupabasePipeline:
    """
    Upserts into public.scrapy_jobs.
    Deduplication: UNIQUE (site, source_url) and UNIQUE (source_url).
    """

    def __init__(self, url: str, key: str, table: str):
        self.url = url
        self.key = key
        self.table = table
        self.client = None
        self._ok = 0
        self._fail = 0

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            url=os.environ.get("SUPABASE_URL", ""),
            key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
            table=crawler.settings.get("SUPABASE_TABLE", "scrapy_jobs"),
        )

    def open_spider(self, spider):
        if not self.url or not self.key:
            spider.logger.warning(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — "
                "items will NOT be saved. Fill in your .env file."
            )
            return
        try:
            from supabase import create_client
            self.client = create_client(self.url, self.key)
            spider.logger.info("Supabase ready → %s", self.table)
        except ImportError:
            spider.logger.error("supabase-py not installed: pip install supabase")

    def process_item(self, item, spider):
        if self.client is None:
            return item

        a = ItemAdapter(item)
        # Get all keys defined in the Item class as well as instance keys
        all_fields = set(a.keys())
        if hasattr(item, "fields"):
            all_fields.update(item.fields.keys())

        # Split into DB columns and overflow → raw
        payload = {}
        overflow = {}
        for k in all_fields:
            v = a.get(k)
            if k in _DB_COLUMNS:
                payload[k] = v
            else:
                if v is not None:
                    overflow[k] = v

        # Merge overflow into raw jsonb
        existing_raw = payload.get("raw") or {}
        if isinstance(existing_raw, str):
            try:
                existing_raw = json.loads(existing_raw)
            except Exception:
                existing_raw = {"_raw_str": existing_raw}
        merged_raw = {**existing_raw, **overflow}
        payload["raw"] = json.loads(json.dumps(merged_raw, default=str)) if merged_raw else None

        # Remove None values only for fields that have DB default values,
        # keeping None for others so upsert will clear/overwrite old values.
        _DB_DEFAULTS = {"id", "created_at", "updated_at", "tags"}
        payload = {k: v for k, v in payload.items() if v is not None or k not in _DB_DEFAULTS}

        # Ensure required fields
        payload.setdefault("site", payload.get("source", "unknown"))
        payload.setdefault("application_method", "unknown")
        payload.setdefault("is_remote", False)

        try:
            (
                self.client.table(self.table)
                .upsert(payload, on_conflict="source_url")
                .execute()
            )
            self._ok += 1
        except Exception as exc:
            spider.logger.error("Upsert failed %s: %s", payload.get("source_url"), exc)
            self._fail += 1

        return item

    def close_spider(self, spider):
        spider.logger.info(
            "Supabase done — %d upserted, %d failed", self._ok, self._fail
        )
