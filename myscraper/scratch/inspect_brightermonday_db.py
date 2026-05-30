import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase = create_client(url, key)

response = supabase.table("scrapy_jobs").select(
    "title, company, source_url, raw"
).eq("site", "brightermonday").limit(20).execute()

for i, item in enumerate(response.data):
    raw = item.get("raw") or {}
    print(f"{i+1}: Title: {repr(item.get('title'))} | Company: {repr(item.get('company'))} | Page Title: {repr(raw.get('page_title'))}")
