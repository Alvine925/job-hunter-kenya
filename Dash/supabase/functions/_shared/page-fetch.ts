/**
 * Fetch job page text: ScrapingBee first, SerpAPI fallback.
 */
import { htmlToText, scrapingBeeHtml, type ScrapingBeeOptions } from "./scrapingbee-client.ts";
import {
  hasSerpApiKey,
  serpApiDiscoverJobUrls,
  serpApiJobPageText,
  type SerpSiteId,
} from "./serpapi-client.ts";

export type PageFetchVia = "scrapingbee" | "serpapi";

export async function fetchPageText(
  url: string,
  site: SerpSiteId,
  opts: ScrapingBeeOptions,
): Promise<{ text: string; via: PageFetchVia }> {
  try {
    const html = await scrapingBeeHtml(url, opts);
    return { text: htmlToText(html), via: "scrapingbee" };
  } catch (beeErr) {
    if (!hasSerpApiKey()) throw beeErr;
    console.warn(`ScrapingBee failed for ${url}, using SerpAPI:`, beeErr);
    const text = await serpApiJobPageText(url, site);
    return { text, via: "serpapi" };
  }
}

export async function discoverJobUrlsWithFallback(
  site: SerpSiteId,
  limit: number,
  fetchListing: () => Promise<string[]>,
): Promise<{ urls: string[]; via: PageFetchVia }> {
  try {
    const urls = await fetchListing();
    if (urls.length > 0) return { urls, via: "scrapingbee" };
  } catch (listingErr) {
    console.warn(`[${site}] listing scrape failed:`, listingErr);
  }

  if (!hasSerpApiKey()) {
    throw new Error(
      `${site} listing failed and SERPAPI_API_KEY is not set for fallback`,
    );
  }

  console.log(`[${site}] discovering job URLs via SerpAPI`);
  const raw = await serpApiDiscoverJobUrls(site, limit);
  return { urls: raw, via: "serpapi" };
}
