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
        
        # Fetch singular /job/ link
        url_singular = "https://www.myjobsinkenya.com/job/full-time-accountant"
        print(f"Fetching singular: {url_singular}")
        await page.goto(url_singular)
        await page.wait_for_timeout(2000)
        html_s = await page.content()
        sel_s = Selector(text=html_s)
        print("Singular Title:", sel_s.css("h1::text, h1 *::text, h2.job-title::text").getall())
        print("Singular Company:", sel_s.css('a[href*="/company/"]::text, .company-name::text, h4.company::text').getall())
        print("Singular Description block length:", len(sel_s.css('div.job-description, div.job-content, article, div.job-body')))

        # Fetch plural /jobs/.../view link
        url_plural = "https://www.myjobsinkenya.com/jobs/full-time-accountant/view"
        print(f"\nFetching plural: {url_plural}")
        await page.goto(url_plural)
        await page.wait_for_timeout(2000)
        html_p = await page.content()
        sel_p = Selector(text=html_p)
        print("Plural Title:", sel_p.css("h1::text, h1 *::text, h2.job-title::text").getall())
        print("Plural Company:", sel_p.css('a[href*="/company/"]::text, .company-name::text, h4.company::text').getall())
        print("Plural Description block length:", len(sel_p.css('div.job-description, div.job-content, article, div.job-body')))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
