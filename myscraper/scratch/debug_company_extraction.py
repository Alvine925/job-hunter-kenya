import re
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(url, key)

response = supabase.table("scrapy_jobs").select(
    "title, company, description, raw"
).eq("site", "myjobsinkenya").execute()

from myscraper.utils import extract_hiring_company

print("Debugging company extraction for myjobsinkenya:")
for i, item in enumerate(response.data):
    title = item.get("title")
    company = item.get("company")
    description = item.get("description") or ""
    raw = item.get("raw") or {}
    
    resolved = extract_hiring_company(title, company, description, raw)
    print(f"\nJob {i+1}: {repr(title)}")
    print(f"  Orig: {repr(company)}")
    print(f"  Resolved: {repr(resolved)}")
    
    # Let's test the regex directly
    patterns = [
        r'our client,?\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
        r'on behalf of\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
        r'recruiting for\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
        r'hiring for\s+([A-Z][A-Za-z0-9&,\']+(?:\s+[A-Z][A-Za-z0-9&,\']+){0,4})',
    ]
    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, description)
        if match:
            print(f"  Pattern {idx+1} Match: {repr(match.group(0))} | Group 1: {repr(match.group(1))}")
        else:
            print(f"  Pattern {idx+1} Match: None")
