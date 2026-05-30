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
        
        # Go to /search
        await page.goto("https://www.myjobsinkenya.com/search")
        await page.wait_for_timeout(2000)
        print("URL:", page.url)
        html = await page.content()
        sel = Selector(text=html)
        print("Page Title for /search:", sel.css("title::text").get())
        
        # See if there are job links on /search
        jobs = [a.attrib.get("href") for a in sel.xpath("//a[contains(@href, '/job/')]")]
        print("Jobs on /search:", len(jobs))
        for j in jobs[:5]:
            print("  ", j)
            
        await browser.close()

asyncio.run(main())
