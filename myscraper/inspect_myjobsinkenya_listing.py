import asyncio
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from scrapy.selector import Selector

load_dotenv()

email = os.environ.get("MYJOBSINKENYA_EMAIL", "")
password = os.environ.get("MYJOBSINKENYA_PASSWORD", "")

async def main():
    if not email or not password:
        print("Missing credentials.")
        return
        
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Navigate to login
        print("Navigating to login...")
        await page.goto("https://www.myjobsinkenya.com/login")
        await page.wait_for_selector('input[name="email"]')
        
        # Fill credentials
        await page.fill('input[name="email"]', email)
        await page.fill('input[name="password"]', password)
        
        # Submit
        print("Submitting login form...")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
        
        print("Final URL after login:", page.url)
        
        # Navigate to jobs
        print("Navigating to jobs list...")
        await page.goto("https://www.myjobsinkenya.com/jobs")
        await page.wait_for_timeout(3000)
        
        html = await page.content()
        with open("myjobsinkenya_list.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Saved myjobsinkenya_list.html")
        
        sel = Selector(text=html)
        
        # Check all links containing /jobs/ or /job/
        print("\nAll links containing /jobs/ or /job/ on the listing page:")
        for a in sel.css("a"):
            href = a.attrib.get("href") or ""
            text = " ".join(a.css("*::text").getall()).strip()
            if "/job/" in href.lower() or "/jobs/" in href.lower():
                print(f"  Link Text: '{text}' | Href: '{href}'")
                
        await browser.close()

asyncio.run(main())
