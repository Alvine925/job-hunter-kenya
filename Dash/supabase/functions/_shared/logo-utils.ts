/**
 * Logo.dev integration utilities
 * Uses Brand Search API (secret key) for accurate domain resolution,
 * and img.logo.dev for logo image delivery.
 *
 * Docs: https://docs.logo.dev
 */

import { DOMAIN_OVERRIDES } from "./domain-overrides.ts";

/**
 * Clean a company name and guess its domain. Used as fallback when Brand Search is unavailable.
 */
export function guessCompanyDomain(companyName: string): string {
  if (!companyName) return "";

  const clean = companyName
    .toLowerCase()
    .replace(
      /\b(ltd|limited|co|corp|corporation|group|plc|llc|kenya|east africa|africa|inc|international)\b/g,
      "",
    )
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "");

  if (!clean) return "";
  return DOMAIN_OVERRIDES[clean] || `${clean}.com`;
}

// ---------------------------------------------------------------------------
// Brand Search API (server-side only — requires secret key)
// ---------------------------------------------------------------------------

interface BrandSearchResult {
  name: string;
  domain: string;
  claimed?: boolean;
  logo_url?: string;
}

/**
 * Search for a company domain using the Logo.dev Brand Search API.
 * Requires LOGODEV_SECRET_KEY in environment.
 *
 * @see https://docs.logo.dev/brand-search-api
 */
export async function searchBrandDomain(
  companyName: string,
): Promise<string | null> {
  const secretKey =
    Deno.env.get("LOGODEV_SECRET_KEY") ||
    Deno.env.get("LOGODEV_API_KEY") ||
    Deno.env.get("LOGO_DEV_API_KEY");

  if (!secretKey?.trim()) {
    console.warn("[logo-utils] No LOGODEV_SECRET_KEY configured — skipping Brand Search");
    return null;
  }

  try {
    const url = `https://api.logo.dev/search?q=${encodeURIComponent(companyName)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${secretKey.trim()}`,
      },
    });

    if (!response.ok) {
      console.warn(
        `[logo-utils] Brand Search returned ${response.status} for "${companyName}"`,
      );
      return null;
    }

    const results: BrandSearchResult[] = await response.json();

    if (results.length === 0) {
      return null;
    }

    // Prefer claimed/verified domains, then take the first result
    const claimed = results.find((r) => r.claimed);
    const best = claimed || results[0];

    console.log(
      `[logo-utils] Brand Search resolved "${companyName}" → ${best.domain} (${results.length} results)`,
    );

    return best.domain;
  } catch (err) {
    console.error("[logo-utils] Brand Search error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Logo URL construction
// ---------------------------------------------------------------------------

export interface LogoUrlOptions {
  /** Image size in px (square). Default 128 */
  size?: number;
  /** Image format. Default "png" for transparency support */
  format?: "png" | "jpg" | "webp";
  /** Invert for dark backgrounds. Default "light" */
  theme?: "light" | "dark";
  /** Enable retina (2x) resolution. Default true */
  retina?: boolean;
  /** Whether to use monogram fallback or return 404. Default "monogram" */
  fallback?: "monogram" | "404";
}

/**
 * Build a Logo.dev image URL for a given domain.
 * Uses the secret/publishable token from environment.
 */
export function buildLogoUrl(
  domain: string,
  options: LogoUrlOptions = {},
): string {
  const {
    size = 128,
    format = "png",
    theme = "light",
    retina = true,
    fallback = "monogram",
  } = options;

  const token =
    Deno.env.get("LOGODEV_SECRET_KEY") ||
    Deno.env.get("LOGODEV_API_KEY") ||
    Deno.env.get("LOGO_DEV_API_KEY") ||
    "";

  const params = new URLSearchParams();
  params.set("token", token.trim());
  params.set("size", String(size));
  params.set("format", format);
  if (retina) params.set("retina", "true");
  if (theme === "dark") params.set("theme", "dark");
  if (fallback === "404") params.set("fallback", "404");

  return `https://img.logo.dev/${domain}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// High-level resolver (combines Brand Search + URL construction)
// ---------------------------------------------------------------------------

/**
 * Resolve a company name to a fully-authenticated Logo.dev image URL.
 * 1. Try Brand Search API for accurate domain resolution
 * 2. Fall back to domain guessing from company name
 * 3. Construct authenticated logo URL with proper params
 */
export async function resolveCompanyLogo(
  companyName: string,
  options?: LogoUrlOptions,
): Promise<{ domain: string; logoUrl: string }> {
  // Try Brand Search first
  const searchedDomain = await searchBrandDomain(companyName);
  const domain = searchedDomain || guessCompanyDomain(companyName);

  if (!domain) {
    return { domain: "", logoUrl: "" };
  }

  const logoUrl = buildLogoUrl(domain, options);
  return { domain, logoUrl };
}

/**
 * Synchronous fallback that just guesses the domain (no API call).
 * Kept for backward compatibility with code that can't await.
 */
export function resolveCompanyLogoUrl(companyName: string): string {
  const domain = guessCompanyDomain(companyName);
  if (!domain) return "";

  const token =
    Deno.env.get("LOGODEV_SECRET_KEY") ||
    Deno.env.get("LOGODEV_API_KEY") ||
    Deno.env.get("LOGO_DEV_API_KEY") ||
    "";

  if (token.trim()) {
    return `https://img.logo.dev/${domain}?token=${token.trim()}&size=128&format=png`;
  }

  return `https://img.logo.dev/${domain}?size=128&format=png`;
}
