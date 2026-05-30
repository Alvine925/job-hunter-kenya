"""
MyJobsInKenya spider (requires login)
Set MYJOBSINKENYA_EMAIL and MYJOBSINKENYA_PASSWORD in .env
"""
import os
import scrapy
from urllib.parse import urljoin
from myscraper.items import JobItem
from myscraper.utils import (
    clean_text, first_text, joined_html,
    extract_email, extract_phone, parse_date, parse_datetime,
)


class MyJobsInKenyaSpider(scrapy.Spider):
    name = "myjobsinkenya"
    allowed_domains = ["myjobsinkenya.com"]
    start_urls = ["https://www.myjobsinkenya.com/login"]

    LISTING_LINK = 'a[href*="/job/"]::attr(href), a[href*="/jobs/"]::attr(href)'
    NEXT_PAGE    = (
        'a[rel="next"]::attr(href), '
        'li.page-item.active + li.page-item a::attr(href)'
    )

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._page = 0
        self.email    = os.environ.get("MYJOBSINKENYA_EMAIL", "")
        self.password = os.environ.get("MYJOBSINKENYA_PASSWORD", "")

    def parse(self, response):
        if not self.email or not self.password:
            self.logger.error("MYJOBSINKENYA_EMAIL / _PASSWORD missing — skipping.")
            return
        token = response.css('input[name="_token"]::attr(value)').get()
        yield scrapy.FormRequest.from_response(
            response,
            formdata={"_token": token or "", "email": self.email, "password": self.password},
            callback=self.after_login,
        )

    def after_login(self, response):
        if "login" in response.url:
            self.logger.error("Login failed — check credentials.")
            return
        if "my-home" in response.url:
            yield from self.parse_listing(response)
        else:
            yield scrapy.Request("https://www.myjobsinkenya.com/my-home", callback=self.parse_listing, dont_filter=True)

    def parse_listing(self, response):
        self._page += 1
        seen = set()
        for href in response.css(self.LISTING_LINK).getall():
            if not href:
                continue
            if "/job/" not in href and "/jobs/" not in href:
                continue
            if href.endswith(("/jobs", "/jobs/", "/job", "/job/")):
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
            yield response.follow(next_href, callback=self.parse_listing)

    def parse_detail(self, response):
        item = JobItem()
        item["site"]       = "myjobsinkenya"
        item["source"]     = "myjobsinkenya"
        item["source_url"] = response.url

        # ── Title & company ───────────────────────────────────────────────
        item["title"] = first_text(response.css(
            'div.profile-left h5::text'
        ))
        item["company"] = first_text(response.css(
            'div.profile-left p.mb-0.text-muted a.mr-2.font-weight-bold::text, div.profile-box h5::text'
        ))
        item["logo_url"] = response.css(
            'div.profile-box img::attr(src)'
        ).get()

        # ── Metadata table ────────────────────────────────────────────────
        metadata = {}
        for tr in response.css('table.mb-0 tr'):
            cells = tr.css('th, td')
            if len(cells) >= 2:
                key = clean_text(" ".join(cells[0].css("*::text").getall())).strip().lower()
                val = clean_text(" ".join(cells[1].css("*::text").getall())).strip()
                if key:
                    metadata[key] = val

        item["location"] = metadata.get("job location")
        item["job_type"] = metadata.get("employment type")
        item["salary_text"] = metadata.get("salary")
        item["sector"] = metadata.get("industry")
        item["experience_level"] = metadata.get("experience")

        # ── Dates ─────────────────────────────────────────────────────────
        deadline_raw = metadata.get("application deadline")
        item["deadline_text"] = deadline_raw
        item["deadline"]      = parse_date(deadline_raw) if deadline_raw else None
        item["posted_at"]     = parse_datetime(
            first_text(response.css('time::attr(datetime), time::text'))
        )

        # ── Description & details ─────────────────────────────────────────
        summary = None
        description = None
        education = None
        experience = None
        skills = None
        terms = None

        for box in response.css("div.box"):
            box_title = first_text(box.css("div.box-title h6::text"))
            if not box_title:
                continue
            box_title = box_title.strip().lower()
            body_text = clean_text(" ".join(box.css("div.box-body *::text").getall()))
            if not body_text:
                continue
                
            if box_title == "summary":
                summary = body_text
            elif box_title == "description":
                description = body_text
            elif box_title == "education":
                education = body_text
            elif box_title == "more details on experience":
                experience = body_text
            elif box_title == "more details on skills":
                skills = body_text
            elif box_title == "terms and conditions":
                terms = body_text

        item["summary"] = summary
        item["responsibilities"] = description

        req_parts = []
        if education:
            req_parts.append(f"Education:\n{education}")
        if experience:
            req_parts.append(f"Experience:\n{experience}")
        if skills:
            req_parts.append(f"Skills:\n{skills}")
        item["requirements"] = "\n\n".join(req_parts) or None

        # Combine all sections to create the full description
        desc_parts = []
        if summary:
            desc_parts.append(f"Summary:\n{summary}")
        if description:
            desc_parts.append(f"Responsibilities & Description:\n{description}")
        if education:
            desc_parts.append(f"Education:\n{education}")
        if experience:
            desc_parts.append(f"Experience:\n{experience}")
        if skills:
            desc_parts.append(f"Skills:\n{skills}")
        if terms:
            desc_parts.append(f"Terms & Conditions:\n{terms}")

        item["description"] = "\n\n".join(desc_parts) or None

        # ── Contact details extraction ────────────────────────────────────
        full_desc = item["description"] or ""
        item["application_email"] = extract_email(full_desc)
        item["contact_phone"]     = extract_phone(full_desc)

        # ── Application URL ───────────────────────────────────────────────
        apply_href = response.css('a[href*="/survey/"]::attr(href)').get()
        if not apply_href:
            apply_href = response.css('a:contains("Apply")::attr(href), a:contains("apply")::attr(href)').get()
        item["application_url"] = response.urljoin(apply_href) if apply_href else response.url

        item["raw"] = {"page_title": response.css("title::text").get()}
        yield item
