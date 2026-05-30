import re
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(url, key)

# Get all jobs
response = supabase.table("scrapy_jobs").select("id, site, title, company, description").execute()
jobs = response.data

RECRUITER_KEYWORDS = ["brightermonday", "fuzu", "myjobsinkenya", "myjobmag", "recruiter", "consulting"]

def extract_real_company(title, company, description):
    # Check if company is recruiter or placeholder
    is_recruiter = False
    if company:
        co_lower = company.lower()
        if any(kw in co_lower for kw in RECRUITER_KEYWORDS):
            is_recruiter = True
    else:
        is_recruiter = True

    # 1. Split from Title first (e.g., "Accountant at Zarini Naturals Ltd")
    title_company = None
    if title:
        match_title = re.search(r'\s+at\s+([^,.(|]+)', title, re.IGNORECASE)
        if match_title:
            cand = match_title.group(1).strip()
            # If the candidate from title is not a recruiter name
            if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS):
                title_company = cand

    # 2. Extract from Description
    desc_company = None
    if description:
        # Look for "Our client, [Company], is..." or "On behalf of [Company],..." or "hiring for [Company]..."
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
                # Exclude common stop phrases
                if not any(kw in cand.lower() for kw in RECRUITER_KEYWORDS + ["seeking", "hiring", "looking", "leading", "established", "our", "the", "a ", "an "]):
                    desc_company = cand
                    break

    if is_recruiter:
        resolved = title_company or desc_company or company
        status = "REPLACEMENT"
    else:
        resolved = company
        status = "ORIGINAL"
        
    return resolved, title_company, desc_company, status

print(f"Loaded {len(jobs)} jobs. Testing extraction:")
for j in jobs:
    orig_company = j.get("company")
    title = j.get("title")
    desc = j.get("description") or ""
    resolved, tc, dc, status = extract_real_company(title, orig_company, desc)
    
    if status == "REPLACEMENT" or orig_company != resolved:
        print(f"\nSite: {j.get('site')} | Title: {repr(title)}")
        print(f"  Original Company: {repr(orig_company)}")
        print(f"  Title-extracted : {repr(tc)}")
        print(f"  Desc-extracted  : {repr(dc)}")
        print(f"  => RESOLVED TO  : {repr(resolved)}")
