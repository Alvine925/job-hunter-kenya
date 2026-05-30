import re
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(url, key)

response = supabase.table("scrapy_jobs").select(
    "title, company, source_url, raw"
).eq("site", "brightermonday").limit(30).execute()

def clean_company_name(title, company, page_title):
    # If we have a page title (which BrighterMonday has in raw['page_title'])
    if page_title:
        # Strip brand suffix like " | BrighterMonday", " - BrighterMonday", " | Kenya", etc.
        cleaned_pt = re.split(r'\s+[|–-]\s+', page_title)[0].strip()
        # Find the last " at " to separate job title and company
        parts = re.split(r'\s+at\s+', cleaned_pt, flags=re.IGNORECASE)
        if len(parts) > 1:
            inferred = parts[-1].strip()
            # If the inferred name is not a placeholder or recruiter itself
            if not any(kw in inferred.lower() for kw in ["brightermonday", "fuzu", "myjobmag", "myjobsinkenya", "anonymous employer"]):
                return inferred
            
    # Fallback to existing company name if not recruiter/placeholder
    if company and not any(kw in company.lower() for kw in ["brightermonday", "fuzu", "myjobmag", "myjobsinkenya"]):
        return company
        
    return company

for i, item in enumerate(response.data):
    raw = item.get("raw") or {}
    page_title = raw.get("page_title")
    title = item.get("title")
    company = item.get("company")
    inferred = clean_company_name(title, company, page_title)
    print(f"\n{i+1}: Page Title: {repr(page_title)}")
    print(f"  Orig Company: {repr(company)}")
    print(f"  Inferred Co : {repr(inferred)}")
