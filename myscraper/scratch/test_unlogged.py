import asyncio
from playwright.async_api import async_playwright
from scrapy.selector import Selector

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # 1. Fetch home page
        print("Fetching public home page...")
        await page.goto("https://www.myjobsinkenya.com/")
        await page.wait_for_timeout(3000)
        print("URL:", page.url)
        
        html = await page.content()
        sel = Selector(text=html)
        print("Title:", sel.css("title::text").get())
        
        # Look for job links
        jobs = [a.attrib.get("href") for a in sel.xpath("//a[contains(@href, '/job/') or contains(@href, '/jobs/')]")]
        print(f"Total job links on public homepage: {len(jobs)}")
        for j in jobs[:10]:
            print("  ", j)
            
        # 2. Fetch /jobs
        print("\nFetching public /jobs page...")
        await page.goto("https://www.myjobsinkenya.com/jobs")
        await page.wait_for_timeout(3000)
        print("URL:", page.url)
        html_jobs = await page.content()
        sel_jobs = Selector(text=html_jobs)
        print("Title for /jobs:", sel_jobs.css("title::text").get())
        jobs_on_jobs = [a.attrib.get("href") for a in sel_jobs.xpath("//a[contains(@href, '/job/') or contains(@href, '/jobs/')]")]
        print(f"Total job links on public /jobs page: {len(jobs_on_jobs)}")
        for j in jobs_on_jobs[:10]:
            print("  ", j)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
