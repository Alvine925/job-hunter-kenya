"""
Fuzu Kenya spider — React SPA, uses scrapy-playwright.
Listing: https://www.fuzu.com/kenya/jobs
"""
import scrapy
from urllib.parse import urljoin
from myscraper.items import JobItem
from myscraper.utils import (
    clean_text, first_text, joined_html,
    extract_email, extract_phone, parse_date, parse_datetime,
)

from scrapy_playwright.page import PageMethod

PAGE_ACTIONS = [PageMethod("wait_for_load_state", "networkidle")]


class FuzuSpider(scrapy.Spider):
    name = "fuzu"
    allowed_domains = ["fuzu.com"]
    start_urls = ["https://www.fuzu.com/kenya/jobs"]

    LISTING_LINK = 'a[href*="/kenya/jobs/"]::attr(href), a[href*="/jobs/"]::attr(href)'
    NEXT_PAGE    = (
        'a[rel="next"]::attr(href), '
        'a[aria-label="Next page"]::attr(href)'
    )

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._page = 0

    def start_requests(self):
        for url in self.start_urls:
            yield scrapy.Request(
                url,
                meta={"playwright": True, "playwright_page_methods": PAGE_ACTIONS},
                callback=self.parse,
            )

    def parse(self, response):
        self._page += 1
        seen = set()
        for href in response.css(self.LISTING_LINK).getall():
            if not href or "/jobs/" not in href or href.endswith(("/jobs", "/jobs/")):
                continue
            url = urljoin(response.url, href.split("?")[0])
            if url in seen:
                continue
            seen.add(url)
            yield scrapy.Request(
                url,
                meta={"playwright": True, "playwright_page_methods": PAGE_ACTIONS},
                callback=self.parse_detail,
            )

        max_pages = self.settings.getint("MAX_PAGES", 0)
        if max_pages and self._page >= max_pages:
            return
        next_href = response.css(self.NEXT_PAGE).get()
        if next_href:
            yield response.follow(
                next_href,
                meta={"playwright": True, "playwright_page_methods": PAGE_ACTIONS},
                callback=self.parse,
            )

    def parse_detail(self, response):
        item = JobItem()
        item["site"]       = "fuzu"
        item["source"]     = "fuzu"
        item["source_url"] = response.url

        # ── Title & company ───────────────────────────────────────────────
        item["title"] = first_text(response.css("h1::text, h1 *::text"))
        
        company = first_text(response.css(
            'p[class*="egqekU"]::text, a[href*="/company/"]::text, span.company-name::text'
        ))
        if not company:
            company = first_text(response.xpath("//*[contains(@class, 'company-name') or contains(@class, 'egqekU')]//text()"))
        item["company"] = company

        # Logo URL
        logo_url = response.css('img[alt*="logo"]::attr(src), .company-logo img::attr(src)').get()
        if logo_url and ("fuzu" in logo_url.lower() or "logo" in logo_url.lower() and "fuzu" in logo_url.lower()):
            logo_url = None
        item["logo_url"] = logo_url

        # Company Summary
        about_co = response.css('[data-test*="company-description"] *::text, div.company-overview *::text').getall()
        item["company_summary"] = clean_text(" ".join(about_co)) or None

        # ── Location ──────────────────────────────────────────────────────
        location = None
        for p in response.xpath("//p[contains(text(), 'Location')]"):
            val = clean_text(" ".join(p.xpath("following-sibling::p[1]//text()").getall()))
            if val:
                location = val
        if not location:
            location = first_text(response.css('[data-test*="location"] *::text'))
        item["location"] = location

        # ── Job metadata (tags and metadata cards) ────────────────────────
        job_type = None
        experience_level = None
        sector = None

        # Try tags
        for a in response.css(".view-summary-content a"):
            href = a.attrib.get("href") or ""
            txt = clean_text(" ".join(a.css("*::text").getall()))
            if not txt:
                continue
            if "/job/" in href:
                path_part = href.split("/job/")[-1].lower()
                if "basic" in path_part or "entry" in path_part:
                    experience_level = "Entry / Basic"
                    job_type = "Full Time"
                elif "middle" in path_part or "mid" in path_part:
                    experience_level = "Mid-level"
                elif "senior" in path_part:
                    experience_level = "Senior-level"
                else:
                    sector = txt

        # Try metadata cards fallback
        for p in response.xpath("//p[following-sibling::p]"):
            lbl = clean_text(" ".join(p.xpath("text()").getall()))
            if not lbl:
                continue
            lbl = lbl.strip().lower()
            val_node = p.xpath("following-sibling::p[1]")
            val = clean_text(" ".join(val_node.xpath(".//text()").getall()))
            if val and "view" not in val.lower():
                if "type" in lbl or "employment" in lbl:
                    job_type = val
                elif "experience" in lbl:
                    experience_level = val
                elif "category" in lbl or "sector" in lbl or "industry" in lbl:
                    sector = val

        item["job_type"] = job_type
        item["experience_level"] = experience_level
        item["sector"] = sector

        # Salary text
        salary_text = None
        for p in response.xpath("//p[contains(text(), 'Salary') or contains(text(), 'Compensation')]"):
            val = clean_text(" ".join(p.xpath("following-sibling::p[1]//text()").getall()))
            if val and "view" not in val.lower():
                salary_text = val
        item["salary_text"] = salary_text

        # Education
        education_level = None
        for p in response.xpath("//p[contains(text(), 'Education') or contains(text(), 'Qualification')]"):
            val = clean_text(" ".join(p.xpath("following-sibling::p[1]//text()").getall()))
            if val and "view" not in val.lower():
                education_level = val
        item["education_level"] = education_level

        # ── Dates ─────────────────────────────────────────────────────────
        deadline_text = first_text(response.css('p[class*="HHSFy"]::text, span[class*="HHSFy"]::text'))
        item["deadline_text"] = deadline_text
        item["deadline"]      = parse_date(deadline_text)

        # Fallback post date from metadata cards
        posted_raw = first_text(response.css('time::attr(datetime), time::text'))
        item["posted_at"] = parse_datetime(posted_raw)

        # ── Description & Sub-sections ────────────────────────────────────
        desc_blocks = response.css(".view-summary-content")
        desc_texts = []
        for block in desc_blocks:
            if "view-summary-content_tag" in (block.attrib.get("class") or ""):
                continue
            txt = clean_text(" ".join(block.css("*::text").getall()))
            if txt:
                desc_texts.append(txt)

        full_text = "\n\n".join(desc_texts) if desc_texts else None
        item["description"] = full_text

        requirements = None
        responsibilities = None

        for block in desc_blocks:
            if "view-summary-content_tag" in (block.attrib.get("class") or ""):
                continue
            for heading, key in [
                ("responsibilities", "responsibilities"),
                ("requirements",     "requirements"),
                ("qualifications",   "requirements"),
                ("the job",          "responsibilities"),
                ("minimum requirements", "requirements"),
            ]:
                sub_block = block.xpath(
                    f'.//*[self::h2 or self::h3 or self::h4 or self::strong or self::b]'
                    f'[contains(translate(.,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"{heading}")]'
                    f'/following-sibling::*[position()<=5]'
                )
                text = clean_text(" ".join(sub_block.css("*::text").getall()))
                if text:
                    if key == "requirements" and not requirements:
                        requirements = text
                    elif key == "responsibilities" and not responsibilities:
                        responsibilities = text

        # Fallbacks: if they are still None, check if we have distinct blocks
        if not requirements or not responsibilities:
            texts = [clean_text(" ".join(b.css("*::text").getall())) for b in desc_blocks if "view-summary-content_tag" not in (b.attrib.get("class") or "")]
            if len(texts) >= 2:
                if not requirements:
                    requirements = texts[0]
                if not responsibilities:
                    responsibilities = texts[1]

        item["requirements"] = requirements
        item["responsibilities"] = responsibilities

        if not item.get("application_email"):
            item["application_email"] = extract_email(full_text)
        if not item.get("contact_phone"):
            item["contact_phone"] = extract_phone(full_text)

        # ── Application URL ───────────────────────────────────────────────
        item["application_url"] = (
            response.css('a:contains("Apply")::attr(href)').get() or response.url
        )

        item["raw"] = {"page_title": response.css("title::text").get()}
        yield item
