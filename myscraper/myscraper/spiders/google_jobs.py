"""
Google Jobs (the `ibp=htl;jobs` widget on Google search).

Google is aggressively anti-bot, so this spider uses scrapy-playwright with a
real browser. Pass the search query and location as -a args:

    scrapy crawl google_jobs -a query="software engineer" -a location="Kenya"
    scrapy crawl google_jobs -a query="accountant in Nairobi"

It scrolls the left-hand results list to load more cards (Google's "next
arrow" is an infinite-scroll list inside the widget) and for each card it
clicks through to extract the full description on the right pane.

Caveats:
- Google may serve a consent/CAPTCHA page. If that happens you'll see 0 items
  and a screenshot named `google_block.png` in the project root. Re-run from
  a different IP, or use a proxy / SerpAPI as a fallback.
- Markup changes frequently. The selectors are best-effort and documented
  inline; tune them if needed.
"""
import os
import scrapy
from urllib.parse import urlencode
from myscraper.items import JobItem
from myscraper.utils import clean_text


def _build_url(query: str, location: str | None) -> str:
    q = query if not location else f"{query} in {location}"
    params = {"q": q, "ibp": "htl;jobs", "hl": "en", "gl": "ke"}
    return "https://www.google.com/search?" + urlencode(params)


class GoogleJobsSpider(scrapy.Spider):
    name = "google_jobs"
    allowed_domains = ["google.com"]

    custom_settings = {
        # Google's robots.txt disallows /search — opt out of robots for this spider.
        "ROBOTSTXT_OBEY": False,
        "DOWNLOAD_DELAY": 2.0,
    }

    def __init__(self, query: str = "jobs", location: str = "Kenya",
                 max_cards: str = "40", *a, **kw):
        super().__init__(*a, **kw)
        self.query = query
        self.location = location
        self.max_cards = int(max_cards)

    def start_requests(self):
        url = _build_url(self.query, self.location)
        yield scrapy.Request(
            url,
            meta={
                "playwright": True,
                "playwright_include_page": True,
                "playwright_page_methods": [
                    {"method": "wait_for_load_state", "args": ["networkidle"]},
                ],
            },
            callback=self.parse,
            errback=self.errback,
        )

    async def parse(self, response):
        page = response.meta["playwright_page"]
        try:
            # Detect consent / CAPTCHA pages
            if "consent.google.com" in page.url or "sorry/index" in page.url:
                await page.screenshot(path="google_block.png", full_page=True)
                self.logger.error(
                    "Google served a consent/CAPTCHA page (%s). Screenshot saved to "
                    "google_block.png. Try a proxy or SerpAPI fallback.", page.url
                )
                return

            # Scroll the results column to load more cards
            list_selector = 'div[role="list"], ul[role="list"], div.gws-plugins-horizon-jobs__li-ed'
            await page.wait_for_selector(list_selector, timeout=15000)
            for _ in range(self.max_cards // 5):
                await page.evaluate(
                    """() => {
                        const list = document.querySelector('div[role="list"]')
                          || document.querySelector('ul[role="list"]')
                          || document.scrollingElement;
                        list.scrollBy(0, 2000);
                    }"""
                )
                await page.wait_for_timeout(800)

            # Each job card — Google rewrites class names; use role + heading
            cards = await page.query_selector_all('div[role="listitem"], li[role="listitem"]')
            self.logger.info("Found %d Google Jobs cards", len(cards))

            for idx, card in enumerate(cards[: self.max_cards]):
                try:
                    await card.click(timeout=5000)
                    await page.wait_for_timeout(500)
                    await page.wait_for_load_state("networkidle", timeout=8000)
                except Exception as exc:  # noqa: BLE001
                    self.logger.debug("Could not click card %d: %s", idx, exc)
                    continue

                # The detail pane lives under a known role
                pane = await page.query_selector('div[role="main"] div[jsname]') or \
                       await page.query_selector('div[role="main"]')
                if pane is None:
                    continue

                async def text_of(selector: str) -> str | None:
                    el = await pane.query_selector(selector)
                    if not el:
                        return None
                    return clean_text(await el.inner_text())

                item = JobItem()
                item["source"] = "google_jobs"
                item["source_url"] = page.url
                item["external_id"] = f"{self.query}::{idx}::{page.url}"
                item["title"] = await text_of("h2, h1")
                # Below the title Google shows: company • location
                meta_text = await text_of("div:has(> h2) + div, div[role='heading'] + div")
                if meta_text and "•" in meta_text:
                    parts = [p.strip() for p in meta_text.split("•")]
                    item["company"] = parts[0] if parts else None
                    item["location"] = parts[1] if len(parts) > 1 else None
                else:
                    item["company"] = meta_text
                desc_html = await pane.inner_html()
                item["description_html"] = desc_html
                item["description"] = clean_text(await pane.inner_text())

                # "Apply on …" buttons sit in a row of anchors
                apply_links = await pane.query_selector_all('a[href^="http"]')
                hrefs = []
                for a in apply_links:
                    href = await a.get_attribute("href")
                    if href and "google.com" not in href:
                        hrefs.append(href)
                if hrefs:
                    item["application_url"] = hrefs[0]
                    item["raw"] = {"apply_links": hrefs}
                else:
                    item["raw"] = {}

                yield item
        finally:
            await page.close()

    async def errback(self, failure):
        page = failure.request.meta.get("playwright_page")
        if page:
            await page.close()
        self.logger.error("Playwright failure: %s", failure)
