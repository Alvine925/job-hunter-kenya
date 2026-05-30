"""
BrighterMonday Kenya spider
Listing: https://www.brightermonday.co.ke/jobs?page=N
Detail:  https://www.brightermonday.co.ke/listings/<slug>
"""
import scrapy
from urllib.parse import urljoin
from myscraper.items import JobItem
from myscraper.utils import (
    clean_text, first_text, joined_html,
    extract_email, extract_phone, parse_date, parse_datetime,
)


class BrighterMondaySpider(scrapy.Spider):
    name = "brightermonday"
    allowed_domains = ["brightermonday.co.ke"]
    start_urls = ["https://www.brightermonday.co.ke/jobs"]

    LISTING_LINK = 'a[href*="/listings/"]::attr(href)'
    NEXT_PAGE    = 'a[aria-label="Next"]::attr(href), a[rel="next"]::attr(href)'

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._page = 0

    def parse(self, response):
        self._page += 1
        seen = set()
        for href in response.css(self.LISTING_LINK).getall():
            if not href or "/listings/" not in href:
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
        item["site"]       = "brightermonday"
        item["source"]     = "brightermonday"
        item["source_url"] = response.url

        # ── Title & company ───────────────────────────────────────────────
        item["title"] = first_text(response.css("h1::text, h1 *::text"))
        item["company"] = first_text(response.css(
            'a[href*="/company/"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"])::text, '
            'a[href*="/company/"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"]) img::attr(alt), '
            'a[href*="/companies/"]::text, [data-cy="company-name"]::text, '
            'span.company-name::text'
        ))

        # Company logo
        item["logo_url"] = (
            response.css('a[href*="/company/"]:not([href*="linkedin"]):not([href*="facebook"]):not([href*="twitter"]) img::attr(src)').get()
            or response.css('img[alt*="logo"]::attr(src)').get()
            or response.css('.company-logo img::attr(src)').get()
        )

        # About the company block
        about_co = response.css(
            'div[data-cy="company-description"] *::text, '
            'section.company-overview *::text'
        ).getall()
        item["company_summary"] = clean_text(" ".join(about_co)) or None

        # ── Location ──────────────────────────────────────────────────────
        item["location"] = first_text(response.css(
            '[data-cy="location"] *::text, '
            'span:contains("Location") + *::text, '
            'li[class*="location"]::text'
        ))

        # ── Job metadata ──────────────────────────────────────────────────
        item["job_type"] = first_text(response.css(
            '[data-cy="job-type"] *::text, '
            'span:contains("Job Type") + *::text, '
            'li[class*="type"]::text'
        ))
        item["salary_text"] = first_text(response.css(
            '[data-cy="salary"] *::text, '
            'span:contains("Salary") + *::text, '
            'li[class*="salary"]::text'
        ))
        item["sector"] = first_text(response.css(
            'a[href*="/jobs/"][href*="industry"]::text, '
            '[data-cy="category"]::text'
        ))
        item["education_level"] = first_text(response.css(
            '[data-cy="education"] *::text, '
            'span:contains("Education") + *::text'
        ))

        # ── Dates ─────────────────────────────────────────────────────────
        deadline_raw = first_text(response.css(
            '[data-cy="deadline"] *::text, '
            '*:contains("Deadline") + *::text, '
            'span:contains("Closing") + *::text'
        ))
        item["deadline_text"] = deadline_raw
        item["deadline"]      = parse_date(deadline_raw)

        posted_raw = first_text(response.css(
            'time::text, time::attr(datetime), [data-cy="posted-date"]::text'
        ))
        item["posted_at"] = parse_datetime(posted_raw)

        # ── Description & sub-sections ────────────────────────────────────
        desc_block = None
        for sel in [
            'div[data-cy="job-description"]',
            'div[data-cy="description"]',
            'div.prose',
            '.prose',
            'div[itemprop="description"]',
            'div.job-description',
            'div[class*="description"]',
        ]:
            candidate = response.css(sel)
            if candidate:
                text_len = len(clean_text(" ".join(candidate.css("*::text").getall())) or "")
                if text_len > 100:
                    desc_block = candidate[0]
                    break

        if desc_block is not None:
            full_text = clean_text(" ".join(desc_block.css("*::text").getall()))
            item["description"] = full_text
        else:
            # Fallback if no container matches
            full_text = clean_text(" ".join(response.css("main *::text").getall()))
            item["description"] = full_text
            desc_block = response

        # Role description (often a first paragraph)
        role_para = response.css(
            'div[data-cy="role-description"] *::text, '
            'section.role-overview *::text'
        ).getall()
        item["role_description"] = clean_text(" ".join(role_para)) or None

        # Sub-sections parsed by heading relative to description block
        for keywords, key in [
            (["responsibilities", "roles", "duties", "expectations"], "responsibilities"),
            (["requirements", "qualifications", "competencies", "skills"], "requirements"),
        ]:
            for keyword in keywords:
                if item.get(key):
                    break
                block = desc_block.xpath(
                    f'.//*[self::h2 or self::h3 or self::h4 or self::strong or self::b or self::p]'
                    f'[contains(translate(.,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"{keyword}")]'
                    f'/following-sibling::*[position()<=5]'
                )
                text = clean_text(" ".join(block.css("*::text").getall()))
                if text:
                    item[key] = text

        # ── Application ───────────────────────────────────────────────────
        apply_href = (
            response.css('a:contains("Apply Now")::attr(href), a:contains("Apply")::attr(href)').get()
            or response.url
        )
        item["application_url"] = apply_href

        # How-to-apply block for email / phone / contact name
        how_block = response.xpath(
            '//*[self::h2 or self::h3 or self::h4 or self::strong]'
            '[contains(translate(.,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"how to apply")]'
            '/following-sibling::*[position()<=6]'
        )
        how_text = clean_text(" ".join(how_block.css("*::text").getall()))
        item["application_email"] = extract_email(how_text) or extract_email(full_text)
        item["contact_phone"]     = extract_phone(how_text) or extract_phone(full_text)

        # Tags / keywords
        tags = [
            clean_text(t) for t in
            response.css('a[href*="/jobs/keyword/"]::text').getall() if t
        ]
        raw_extra = {
            "page_title": response.css("title::text").get(),
            "tags": tags or [],
        }
        item["raw"] = raw_extra

        yield item
