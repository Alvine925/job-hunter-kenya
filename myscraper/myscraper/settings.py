import os
from dotenv import load_dotenv

load_dotenv()

BOT_NAME = "myscraper"
SPIDER_MODULES = ["myscraper.spiders"]
NEWSPIDER_MODULE = "myscraper.spiders"

ROBOTSTXT_OBEY = True

CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 2
DOWNLOAD_DELAY = 1.5
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1
AUTOTHROTTLE_MAX_DELAY = 15
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
RETRY_TIMES = 3

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (myscraper)"
)

DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

ITEM_PIPELINES = {
    "myscraper.pipelines.ValidationPipeline":  100,
    "myscraper.pipelines.EnrichmentPipeline":  200,
    "myscraper.pipelines.ScrapedAtPipeline":   300,
    "myscraper.pipelines.SupabasePipeline":    400,
}

SUPABASE_TABLE = os.environ.get("SUPABASE_TABLE", "scrapy_jobs")
MAX_PAGES      = int(os.environ.get("MAX_PAGES", "0"))
LOG_LEVEL      = os.environ.get("LOG_LEVEL", "INFO")

DOWNLOAD_HANDLERS = {
    "http":  "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
    "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
}
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
PLAYWRIGHT_BROWSER_TYPE = "chromium"
PLAYWRIGHT_LAUNCH_OPTIONS = {"headless": True}
PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT = 45_000

FEED_EXPORT_ENCODING = "utf-8"
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
