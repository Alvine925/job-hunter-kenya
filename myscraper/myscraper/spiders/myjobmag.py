"""
MyJobMag Kenya spider
Listing: https://www.myjobmag.co.ke/jobs
Detail:  https://www.myjobmag.co.ke/job/<id>/<slug>
"""
import re
import scrapy
from urllib.parse import urljoin
from myscraper.items import JobItem
from myscraper.utils import (
    clean_text, first_text, joined_html,
    extract_email, extract_phone, parse_date, parse_datetime,
)


class MyJobMagSpider(scrapy.Spider):
    name = "myjobmag"
    allowed_domains = ["myjobmag.co.ke"]
    start_urls = ["https://www.myjobmag.co.ke/jobs"]

    LISTING_LINK = (
        'li.job-list-li h2 a::attr(href), '
        'ul.job-list li a[href*="/job/"]::attr(href), '
        'a[href*="/job/"]::attr(href)'
    )
    NEXT_PAGE = 'a[rel="next"]::attr(href), li.next a::attr(href)'

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._page = 0

    def parse(self, response):
        self._page += 1
        seen = set()
        for href in response.css(self.LISTING_LINK).getall():
            if not href or "/job/" not in href:
                continue
            url = urljoin(response.url, href.split("?")[0])
            if url in seen:
                continue
            seen.add(url)
            yield response.follow(url, callback=self.parse_detail)

        max_pages = self.settings.getint("MAX_PAGES", 0)
        if max_pages and self._page >= max_pages:
            return
        next_href = response.css(self.NEXT_PAGE).get()
        if next_href:
            yield response.follow(next_href, callback=self.parse)

    def parse_detail(self, response):
        item = JobItem()
        item["site"]       = "myjobmag"
        item["source"]     = "myjobmag"
        item["source_url"] = response.url

        # ── Title & company ───────────────────────────────────────────────
        item["title"] = first_text(response.css("h1::text, h1 *::text"))
        
        company_from_link = first_text(response.css(
            'p.company-name a::text, .company-name a::text, '
            'a[href*="/company/"]::text, h2.company::text'
        ))
        if company_from_link and "linkedin" not in company_from_link.lower() and "myjobmag" not in company_from_link.lower():
            item["company"] = company_from_link
        else:
            # Fallback to Title: "Title at Company"
            title_val = item["title"] or ""
            if " at " in title_val:
                _, comp = title_val.rsplit(" at ", 1)
                item["company"] = comp.strip()
            else:
                item["company"] = None

        # Logo URL
        logo_url = response.css(
            '.company-logo img::attr(src), img[alt*="logo"]::attr(src)'
        ).get()
        if logo_url:
            logo_url = urljoin(response.url, logo_url)
            if "myjobmag" in logo_url or "logo" in logo_url.lower():
                logo_url = None
        item["logo_url"] = logo_url

        # About company paragraph
        about_co = response.css(
            'div.about-company *::text, section.company-info *::text'
        ).getall()
        item["company_summary"] = clean_text(" ".join(about_co)) or None

        # ── Job metadata (from job-key-info) ──────────────────────────────
        metadata = {}
        for li in response.css('.job-key-info li'):
            title_node = li.css('.jkey-title::text').get()
            if title_node:
                key = title_node.strip().lower()
                val = clean_text(" ".join(li.css('.jkey-info *::text').getall()))
                if not val:
                    val = clean_text(" ".join(li.css('::text').getall()))
                    if val and val.lower().startswith(key):
                        val = val[len(key):].strip()
                metadata[key] = val

        item["location"] = metadata.get("location")
        item["job_type"] = metadata.get("job type")
        item["experience_level"] = metadata.get("experience")
        item["education_level"] = metadata.get("qualification")
        
        # Clean sector trailing &nbsp or spaces
        sec = metadata.get("job field")
        if sec:
            sec = sec.replace("\u00a0", " ").replace("&nbsp", " ").strip()
            sec = re.sub(r"\s+", " ", sec)
        item["sector"] = sec or None

        item["salary_text"] = metadata.get("salary")

        # ── Dates ─────────────────────────────────────────────────────────
        item["posted_at"] = None
        item["deadline_text"] = None
        item["deadline"] = None

        for div in response.css('.read-date-sec-li'):
            text = clean_text(" ".join(div.css('*::text').getall()))
            if text:
                if text.lower().startswith("posted:"):
                    item["posted_at"] = parse_datetime(text.replace("Posted:", "").strip())
                elif text.lower().startswith("deadline:"):
                    deadline_raw = text.replace("Deadline:", "").strip()
                    item["deadline_text"] = deadline_raw
                    if "not specified" not in deadline_raw.lower():
                        item["deadline"] = parse_date(deadline_raw)

        # ── Description blocks ────────────────────────────────────────────
        desc_block = response.css('div.job-details')
        if not desc_block:
            desc_block = response.css('li.job-description#printable, #printable-area, article.job')
        
        full_text = clean_text(" ".join(desc_block.css("*::text").getall()))
        item["description"] = full_text

        # Sub-sections (scoped to desc_block using relative XPath)
        for heading, key in [
            ("responsibilities",     "responsibilities"),
            ("requirements",         "requirements"),
            ("qualifications",       "requirements"),
            ("how to apply",         "_how_apply"),
            ("method of application","_how_apply"),
        ]:
            block = desc_block.xpath(
                f'.//*[self::h2 or self::h3 or self::h4 or self::strong]'
                f'[contains(translate(.,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"{heading}")]'
                f'/following-sibling::*[position()<=5]'
            )
            text = clean_text(" ".join(block.css("*::text").getall()))
            if text:
                if key == "_how_apply":
                    # not a real field, use for email/phone extraction only
                    item["application_email"] = (
                        item.get("application_email") or extract_email(text)
                    )
                    item["contact_phone"] = (
                        item.get("contact_phone") or extract_phone(text)
                    )
                elif not item.get(key):
                    item[key] = text

        # Fallback email/phone from full description
        if not item.get("application_email"):
            item["application_email"] = extract_email(full_text)
        if not item.get("contact_phone"):
            item["contact_phone"] = extract_phone(full_text)

        # ── Application URL ───────────────────────────────────────────────
        item["application_url"] = (
            response.css('a:contains("Apply")::attr(href)').get() or response.url
        )

        item["raw"] = {
            "page_title": response.css("title::text").get(),
            "tags": [
                clean_text(t) for t in
                response.css('a[href*="/tag/"]::text, a[href*="/jobs-by-field/"]::text').getall()
                if t
            ],
        }
        yield item
