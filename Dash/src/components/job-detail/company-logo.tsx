import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { companyInitials, isInvalidEmployer } from "./utils";
import { Building2 } from "lucide-react";

const LOGODEV_TOKEN = import.meta.env.VITE_LOGODEV_PUBLISHABLE_KEY || "pk_DYu7Chy4So2s61Omny6PQA";

import { DOMAIN_OVERRIDES } from "./domain-overrides";

function guessCompanyDomain(companyName: string): string {
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
// Logo.dev URL builder (client-side, uses publishable key)
// ---------------------------------------------------------------------------

interface LogoDevUrlOptions {
  domain: string;
  size: number;
  format?: "png" | "jpg" | "webp";
  theme?: "light" | "dark";
  retina?: boolean;
  /** "404" returns HTTP 404 for missing logos (we handle with onError).
   *  "monogram" returns a generated letter-icon. */
  fallback?: "monogram" | "404";
}

function buildLogoDevUrl(opts: LogoDevUrlOptions): string {
  const { domain, size, format = "png", theme = "light", retina = true, fallback = "404" } = opts;
  if (!domain || !LOGODEV_TOKEN) return "";

  const params = new URLSearchParams();
  params.set("token", LOGODEV_TOKEN);
  params.set("size", String(size));
  params.set("format", format);
  if (retina) params.set("retina", "true");
  if (theme === "dark") params.set("theme", "dark");
  if (fallback === "404") params.set("fallback", "404");

  return `https://img.logo.dev/${domain}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Size mapping
// ---------------------------------------------------------------------------

const SIZE_CONFIG = {
  sm: { dim: "w-8 h-8", text: "text-xs", px: 32 },
  md: { dim: "w-12 h-12", text: "text-sm", px: 48 },
  lg: { dim: "w-16 h-16", text: "text-lg", px: 64 },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyLogo({
  company,
  source,
  sourceUrl,
  logoUrl,
  size = "md",
  theme = "light",
}: {
  company: string;
  source?: string | null;
  sourceUrl?: string | null;
  /** Pre-resolved logo URL from the database */
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  /** Logo theme — use "dark" on dark backgrounds for better contrast */
  theme?: "light" | "dark";
}) {
  const isCompanyInvalid = useMemo(() => {
    if (!company) return true;
    return isInvalidEmployer(company);
  }, [company]);

  const isLogoUrlJobBoard = useMemo(() => {
    if (!logoUrl) return false;
    const JOB_BOARD_DOMAINS_RE = /(brightermonday|myjobmag|fuzu|jobwebkenya|corporatestaffing|indeed|glassdoor|ziprecruiter|careerjet|talent\.com|lensa|pigiame|kenyancareer)/i;
    return JOB_BOARD_DOMAINS_RE.test(logoUrl);
  }, [logoUrl]);

  const startStage = useMemo(() => {
    if (isCompanyInvalid) {
      return 2; // Skip all image stages, go straight to monogram/placeholder stage
    }
    if (logoUrl && !isLogoUrlJobBoard) {
      return 0; // Database logo is valid, start there
    }
    return 1; // Logo.dev direct
  }, [isCompanyInvalid, logoUrl, isLogoUrlJobBoard]);

  const [stage, setStage] = useState(startStage);

  useEffect(() => {
    setStage(startStage);
  }, [startStage]);

  const { dim, text, px } = SIZE_CONFIG[size];
  const domain = useMemo(() => guessCompanyDomain(company), [company]);

  // Build URLs for Logo.dev
  const logoDevUrl = useMemo(
    () =>
      buildLogoDevUrl({
        domain,
        size: px * 2, // request 2x for retina displays
        format: "png",
        theme,
        retina: true,
        fallback: "404", // so we can detect failure and fall through to monogram
      }),
    [domain, px, theme],
  );

  const handleError = () => setStage((prev) => prev + 1);

  const imgClass = cn(
    dim,
    "rounded-lg border bg-white dark:bg-white/95 object-contain p-1 shrink-0",
  );

  // Stage 0: Database-stored URL (resolved server-side via Brand Search)
  if (stage === 0 && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${company} logo`}
        className={imgClass}
        loading="lazy"
        decoding="async"
        onError={handleError}
      />
    );
  }

  // Stage 1: Logo.dev direct (client-side with publishable token)
  if (stage === 1 && logoDevUrl) {
    return (
      <img
        src={logoDevUrl}
        alt={`${company} logo`}
        className={imgClass}
        loading="lazy"
        decoding="async"
        onError={handleError}
      />
    );
  }

  // Stage 2: Initials monogram (final fallback — never fails) or Generic building placeholder
  if (stage >= 2) {
    if (isCompanyInvalid) {
      const Icon = Building2;
      const iconSize = size === "sm" ? "w-4 h-4" : size === "md" ? "w-6 h-6" : "w-8 h-8";
      return (
        <div
          className={cn(
            dim,
            "rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 text-white flex items-center justify-center shrink-0 border border-slate-200/20 dark:border-white/10 shadow-sm",
          )}
        >
          <Icon className={cn(iconSize, "text-white/90")} />
        </div>
      );
    }

    return (
      <div
        className={cn(
          dim,
          text,
          "rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center shrink-0 border border-slate-200/20 dark:border-white/10 shadow-sm",
        )}
      >
        {companyInitials(company || "Co")}
      </div>
    );
  }
  return null;
}
