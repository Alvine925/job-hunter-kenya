/** ScrapingBee HTML fetch — https://www.scrapingbee.com/documentation/ */

export type ScrapingBeeOptions = {
  renderJs?: boolean;
  premiumProxy?: boolean;
  waitMs?: number;
  /** Cookie header value, e.g. li_at=xxx */
  cookies?: string;
  countryCode?: string;
  blockAds?: boolean;
};

function apiKey(): string {
  const key = Deno.env.get("SCRAPINGBEE_API_KEY");
  if (!key) throw new Error("SCRAPINGBEE_API_KEY missing");
  return key;
}

export async function scrapingBeeHtml(
  url: string,
  opts: ScrapingBeeOptions = {},
): Promise<string> {
  const params = new URLSearchParams({
    api_key: apiKey(),
    url,
  });
  if (opts.renderJs) params.set("render_js", "true");
  if (opts.premiumProxy) params.set("premium_proxy", "true");
  if (opts.waitMs) params.set("wait", String(Math.min(opts.waitMs, 15000)));
  if (opts.cookies) params.set("cookies", opts.cookies);
  if (opts.countryCode) params.set("country_code", opts.countryCode);
  if (opts.blockAds !== false) params.set("block_ads", "true");

  const endpoint = `https://app.scrapingbee.com/api/v1?${params.toString()}`;
  const res = await fetch(endpoint);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`ScrapingBee ${res.status}: ${body.slice(0, 400)}`);
  }
  return body;
}

/** Strip HTML to plain text for AI extraction (keeps link URLs inline). */
export function htmlToText(html: string, maxLen = 120_000): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  t = t.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
    const text = String(label).replace(/<[^>]+>/g, "").trim();
    return text ? `${text} (${href})` : href;
  });
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > maxLen) t = t.slice(0, maxLen) + "…";
  return t;
}
