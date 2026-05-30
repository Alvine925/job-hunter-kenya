import asyncio
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright

load_dotenv()

email = os.environ.get("MYJOBSINKENYA_EMAIL", "")
password = os.environ.get("MYJOBSINKENYA_PASSWORD", "")

async def main():
    if not email or not password:
        return
        
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Login
        print("Logging in...")
        await page.goto("https://www.myjobsinkenya.com/login")
        await page.fill('input[name="email"]', email)
        await page.fill('input[name="password"]', password)
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
        
        url = "https://www.myjobsinkenya.com/job/full-time-accountant"
        print(f"Navigating to job detail: {url}")
        await page.goto(url)
        await page.wait_for_timeout(3000)
        
        html = await page.content()
        with open("job_detail.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Saved job_detail.html")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
