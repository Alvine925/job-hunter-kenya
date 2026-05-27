import { brighterMondayProfile } from "./brightermonday.ts";
import { myJobMagProfile } from "./myjobmag.ts";
import type { SiteFormProfile } from "./types.ts";

const PROFILES: SiteFormProfile[] = [brighterMondayProfile, myJobMagProfile];

export function resolveSiteFormProfile(sourceUrl?: string | null, source?: string | null): SiteFormProfile | null {
  const host = (() => {
    if (sourceUrl) {
      try {
        return new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        /* ignore */
      }
    }
    return (source ?? "").replace(/^www\./, "").toLowerCase();
  })();

  if (!host) return null;

  return (
    PROFILES.find((p) =>
      p.domains.some((d) => host === d || host.endsWith(`.${d}`))
    ) ?? null
  );
}

export function siteProfileFieldSpec(profile: SiteFormProfile) {
  return profile.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required ?? false,
    source: f.source,
    options: f.options,
    staticValue: f.staticValue,
    hint: f.hint,
    profileKey: f.profileKey,
  }));
}

export { brighterMondayProfile, myJobMagProfile };
export type { SiteFormProfile, SiteFormField } from "./types.ts";
