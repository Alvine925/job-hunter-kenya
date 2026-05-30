import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not url or not key:
    print("Credentials missing in .env")
    exit(1)

supabase = create_client(url, key)

response = supabase.table("scrapy_jobs").select(
    "id, site, title, company, location, job_type, salary_text, deadline, application_url, description"
).eq("site", "myjobsinkenya").execute()

print(f"Total jobs for 'myjobsinkenya' in DB: {len(response.data)}")
for i, item in enumerate(response.data):
    print(f"\n--- Job {i+1} ---")
    print(f"Title: {item.get('title')}")
    print(f"Company: {item.get('company')}")
    print(f"Location: {item.get('location')}")
    print(f"Job Type: {item.get('job_type')}")
    print(f"Salary: {item.get('salary_text')}")
    print(f"Deadline: {item.get('deadline')}")
    print(f"Application URL: {item.get('application_url')}")
    desc = item.get('description') or ""
    print(f"Description (first 200 chars): {repr(desc[:200])}")
