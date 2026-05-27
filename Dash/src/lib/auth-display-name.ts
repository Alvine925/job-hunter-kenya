import type { User } from "@supabase/supabase-js";

function formatNamePart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed.charAt(0) + trimmed.slice(1).toLowerCase();
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** First name for greetings — always title case (never “ALVINE” from profile/email). */
export function formatAuthGreetingName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0];
  return first ? formatNamePart(first) : "there";
}

/** First name (or email local-part) for greetings on auth screens. */
export function resolveAuthGreetingName(
  user: User | null | undefined,
  profileFullName?: string | null,
): string {
  const fromProfile = profileFullName?.trim();
  if (fromProfile) {
    return formatAuthGreetingName(fromProfile);
  }

  const meta = user?.user_metadata?.full_name;
  if (typeof meta === "string" && meta.trim()) {
    return formatAuthGreetingName(meta);
  }

  const email = user?.email;
  if (email) {
    const local = email.split("@")[0]?.replace(/[._+0-9]/g, " ").trim();
    const word = local?.split(/\s+/).filter(Boolean)[0];
    if (word) return formatAuthGreetingName(word);
  }

  return "there";
}
