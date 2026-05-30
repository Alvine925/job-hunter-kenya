from scrapy.selector import Selector
from myscraper.utils import (
    clean_text, first_text, joined_html,
    extract_email, extract_phone, parse_date, parse_datetime,
)
import re

with open("job_detail.html", "r", encoding="utf-8") as f:
    html = f.read()

sel = Selector(text=html)

item = {}
item["site"] = "myjobsinkenya"
item["source"] = "myjobsinkenya"

# ── Title, company & logo ─────────────────────────────────────────
item["title"] = first_text(sel.css('div.profile-left h5::text'))
item["company"] = first_text(sel.css('div.profile-left p.mb-0.text-muted a.mr-2.font-weight-bold::text, div.profile-box h5::text'))
item["logo_url"] = sel.css('div.profile-box img::attr(src)').get()

# ── Extract metadata table ─────────────────────────────────────────
metadata = {}
for tr in sel.css('table.mb-0 tr'):
    cells = tr.css('th, td')
    if len(cells) >= 2:
        key = clean_text(" ".join(cells[0].css("*::text").getall())).strip().lower()
        val = clean_text(" ".join(cells[1].css("*::text").getall())).strip()
        if key:
            metadata[key] = val

print("Extracted Metadata:", metadata)

item["location"] = metadata.get("job location")
item["job_type"] = metadata.get("employment type")
item["salary_text"] = metadata.get("salary")
item["sector"] = metadata.get("industry")
item["experience_level"] = metadata.get("experience")

# ── Dates ─────────────────────────────────────────────────────────
deadline_raw = metadata.get("application deadline")
item["deadline_text"] = deadline_raw
item["deadline"] = parse_date(deadline_raw) if deadline_raw else None
# Let's see if we can find posted_at. There is no time/datetime in the table,
# but maybe there's a time tag or we can extract it.
posted_raw = first_text(sel.css('time::attr(datetime), time::text'))
item["posted_at"] = parse_datetime(posted_raw) if posted_raw else None

# ── Description & details ─────────────────────────────────────────
summary = None
description = None
education = None
experience = None
skills = None
terms = None

for box in sel.css("div.box"):
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

# ── Application URL ────────────────────────────────────────────────
apply_href = sel.css('a[href*="/survey/"]::attr(href)').get()
if not apply_href:
    apply_href = sel.css('a:contains("Apply")::attr(href), a:contains("apply")::attr(href)').get()
item["application_url"] = apply_href if apply_href else "https://www.myjobsinkenya.com/job/full-time-accountant"

# Contact details extraction from description
full_desc = item["description"] or ""
item["application_email"] = extract_email(full_desc)
item["contact_phone"] = extract_phone(full_desc)

print("\n=== Parsed Job Item ===")
for k, v in item.items():
    print(f"{k}: {repr(v)}")
