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
        return
        
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Login
        await page.goto("https://www.myjobsinkenya.com/login")
        await page.fill('input[name="email"]', email)
        await page.fill('input[name="password"]', password)
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)
        
        # On dashboard, locate the search form
        # We can fill the input 'Search jobs' and press Enter/Submit
        await page.fill('input[placeholder="Search jobs"]', "a")
        print("Submitting search for 'a'...")
        await page.press('input[placeholder="Search jobs"]', "Enter")
        await page.wait_for_timeout(3000)
        
        print("URL after search submit:", page.url)
        html = await page.content()
        sel = Selector(text=html)
        print("Page Title for search results:", sel.css("title::text").get())
        
        jobs = [a.attrib.get("href") for a in sel.xpath("//a[contains(@href, '/job/')]")]
        print("Jobs found:", len(jobs))
        for j in jobs[:10]:
            print("  ", j)
            
        print("\nAll links containing 'page' on search results:")
        for a in sel.css("a"):
            href = a.attrib.get("href") or ""
            text = " ".join(a.css("*::text").getall()).strip()
            if "page" in href.lower() or "next" in href.lower() or "page" in text.lower():
                print(f"  Text: '{text}' | Href: '{href}'")
                
        await browser.close()

asyncio.run(main())
