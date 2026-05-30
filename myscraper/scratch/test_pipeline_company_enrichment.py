import re
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(url, key)

response = supabase.table("scrapy_jobs").select(
    "site, title, company, description, raw"
).limit(100).execute()

def extract_hiring_company(title, company, description, raw_metadata):
    RECRUITER_KEYWORDS = ["brightermonday", "brighter monday", "fuzu", "myjobsinkenya", "my jobs in kenya", "myjobmag", "my job mag", "anonymous employer", "anonymous", "employer", "recruiter", "consulting", "recruitment", "client", "our client"]
    
    is_recruiter = False
    if company:
        co_lower = company.lower()
        if any(kw in co_lower for kw in RECRUITER_KEYWORDS):
            is_recruiter = True
    else:
        is_recruiter = True

    title_company = None
    desc_company = None
    page_title_company = None

    # 1. Try to extract from page_title (found in raw_metadata)
    page_title = raw_metadata.get("page_title") if raw_metadata else None
    if page_title:
        # Strip brand suffix
        cleaned_pt = re.split(r'\s+[|–-]\s+', page_title)[0].strip()
        # Find the last " at "
        parts = re.split(r'\s+at\s+', cleaned_pt, flags=re.IGNORECASE)
        if len(parts) > 1:
            cand = parts[-1].strip()
            if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS):
                page_title_company = cand

    # 2. Try to extract from title
    if title:
        parts = re.split(r'\s+at\s+', title, flags=re.IGNORECASE)
        if len(parts) > 1:
            cand = parts[-1].strip()
            if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS):
                title_company = cand

    # 3. Try to extract from description text
    if description:
        patterns = [
            r'our client,?\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'on behalf of\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'recruiting for\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
            r'hiring for\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
        ]
        for pattern in patterns:
            match = re.search(pattern, description)
            if match:
                cand = match.group(1).strip()
                stop_words = RECRUITER_KEYWORDS + ["seeking", "hiring", "looking", "leading", "established", "our", "the", "a ", "an ", "in "]
                if not any(kw in cand.lower() for kw in stop_words):
                    desc_company = cand
                    break

    if is_recruiter:
        resolved = page_title_company or title_company or desc_company or company
        if not resolved or any(kw in resolved.lower() for kw in ["brightermonday", "fuzu", "myjobsinkenya", "myjobmag"]):
            resolved = company
    else:
        resolved = company

    return resolved

print("Testing extract_hiring_company on DB rows:")
changes_count = 0
for i, item in enumerate(response.data):
    site = item.get("site")
    title = item.get("title")
    company = item.get("company")
    description = item.get("description") or ""
    raw = item.get("raw") or {}
    
    resolved = extract_hiring_company(title, company, description, raw)
    if resolved != company:
        changes_count += 1
        print(f"\n[{site.upper()}] Change {changes_count}:")
        print(f"  Title: {repr(title)}")
        print(f"  Page Title: {repr(raw.get('page_title'))}")
        print(f"  Original Company: {repr(company)}")
        print(f"  Resolved Company: {repr(resolved)}")
