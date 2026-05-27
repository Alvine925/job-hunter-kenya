/**
 * ScrapingBee helpers used ONLY by job-scraper.ts (site scrapers).
 * Existing user flows use firecrawl.ts — do not import this from job-catalog / jobs / applications.
 */
export { htmlToText, scrapingBeeHtml, type ScrapingBeeOptions } from "./scrapingbee-client.ts";
