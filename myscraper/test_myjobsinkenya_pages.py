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
        
        # Page 1
        await page.goto("https://www.myjobsinkenya.com/my-home")
        await page.wait_for_timeout(2000)
        html1 = await page.content()
        sel1 = Selector(text=html1)
        jobs1 = [a.attrib.get("href") for a in sel1.xpath("//a[contains(@href, '/job/')]")]
        print("Page 1 Jobs:", jobs1)
        
        # Page 2
        await page.goto("https://www.myjobsinkenya.com/my-home?page=2")
        await page.wait_for_timeout(2000)
        html2 = await page.content()
        sel2 = Selector(text=html2)
        jobs2 = [a.attrib.get("href") for a in sel2.xpath("//a[contains(@href, '/job/')]")]
        print("Page 2 Jobs:", jobs2)
        
        await browser.close()

asyncio.run(main())
