import scrapy
from scrapy.crawler import CrawlerProcess
from dotenv import load_dotenv
import os

load_dotenv()

class TestSearchSpider(scrapy.Spider):
    name = "test_search"
    start_urls = ["https://www.myjobsinkenya.com/login"]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.email = os.getenv("MYJOBSINKENYA_EMAIL", "")
        self.password = os.getenv("MYJOBSINKENYA_PASSWORD", "")
        
    def parse(self, response):
        print("\n--- Parsing Login Page ---")
        token = response.css('input[name="_token"]::attr(value)').get()
        print(f"CSRF Token on login: {token}")
        yield scrapy.FormRequest.from_response(
            response,
            formdata={"_token": token or "", "email": self.email, "password": self.password},
            callback=self.after_login,
        )
        
    def after_login(self, response):
        print(f"\n--- After Login (URL: {response.url}) ---")
        if "login" in response.url:
            print("Login failed!")
            return
            
        # Let's extract the CSRF token on the dashboard/home page to use for the search POST request
        token = response.css('input[name="_token"]::attr(value)').get()
        print(f"CSRF Token on dashboard: {token}")
        
        # Test 1: POST to /search with keyword "Accountant"
        yield scrapy.FormRequest(
            "https://www.myjobsinkenya.com/search",
            formdata={"_token": token or "", "search": "Accountant"},
            callback=self.parse_search_results,
            cb_kwargs={"query": "Accountant"}
        )

        # Test 2: POST to /search with keyword ""
        yield scrapy.FormRequest(
            "https://www.myjobsinkenya.com/search",
            formdata={"_token": token or "", "search": ""},
            callback=self.parse_search_results,
            cb_kwargs={"query": "empty"}
        )

    def parse_search_results(self, response, query):
        print(f"\n--- Search Results for '{query}' (URL: {response.url}) ---")
        job_links = response.css("a[href*='/job/']::attr(href), a[href*='/jobs/']::attr(href)").getall()
        print(f"Found {len(job_links)} job/jobs links on search results for '{query}':")
        for i, link in enumerate(job_links[:20]):
            print(f"  {i+1}: {link}")
            
        # Check all form tokens or pagination links on search page
        pag_links = response.css("a[href*='page=']::attr(href), a[rel='next']::attr(href)").getall()
        print(f"Pagination links found: {pag_links}")

process = CrawlerProcess(settings={
    "USER_AGENT": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "LOG_LEVEL": "INFO"
})
process.crawl(TestSearchSpider)
process.start()
