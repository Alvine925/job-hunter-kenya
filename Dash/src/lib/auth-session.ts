import { redirect } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const AUTH_STORAGE_KEY = "tellus-auth";

/** Auth checks must run in the browser — session is stored in localStorage (`tellus-auth`). */
export function isBrowser() {
  return typeof window !== "undefined";
}

function storedValueHasAccessToken(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const o = value as { access_token?: string; currentSession?: { access_token?: string } };
  if (typeof o.access_token === "string" && o.access_token.length > 0) return true;
  if (typeof o.currentSession?.access_token === "string") return true;
  return false;
}

/** Fast sync check — avoids blocking the UI while Supabase finishes init on refresh. */
export function hasLikelyStoredSession(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (storedValueHasAccessToken(parsed)) return true;
    if (Array.isArray(parsed) && storedValueHasAccessToken(parsed[1])) return true;
    return false;
  } catch {
    return false;
  }
}

let authReadyPromise: Promise<Session | null> | null = null;
let authListenerAttached = false;
/** Latest session seen via onAuthStateChange — keeps `waitForAuthSession` instant after sign-in. */
let cachedSession: Session | null = null;
let localOnboardingPassed = false;

export function getCachedSession(): Session | null {
  return cachedSession;
}

export function hasPassedOnboarding(): boolean {
  return localOnboardingPassed;
}

export function setPassedOnboarding(passed: boolean) {
  localOnboardingPassed = passed;
}

export function resetAuthReady() {
  authReadyPromise = null;
}

/** Manually persist session to localStorage and update cache. */
export function persistSessionToStorage(session: Session) {
  if (!isBrowser()) return;
  try {
    // Store the full session object in the expected format
    const sessionData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
      type: session.type,
      user: session.user,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
    cachedSession = session;
    // Set cookie for server-side SSR route protection (FIX 13)
    document.cookie = `tellus-session-active=true; path=/; max-age=31536000; SameSite=Lax; Secure`;
    console.log("[auth] Session persisted to localStorage");
  } catch (e) {
    console.error("[auth] Failed to persist session:", e);
  }
}

function attachAuthCacheInvalidation() {
  if (!isBrowser() || authListenerAttached) return;
  authListenerAttached = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      cachedSession = null;
      authReadyPromise = Promise.resolve(null);
      localOnboardingPassed = false;
      // Clear cookie for server-side SSR route protection (FIX 13)
      document.cookie = "tellus-session-active=; path=/; max-age=0; SameSite=Lax; Secure";
      return;
    }
    if (
      event === "SIGNED_IN" ||
      event === "TOKEN_REFRESHED" ||
      event === "INITIAL_SESSION" ||
      event === "USER_UPDATED"
    ) {
      cachedSession = session ?? cachedSession;
      if (cachedSession) {
        document.cookie = `tellus-session-active=true; path=/; max-age=31536000; SameSite=Lax; Secure`;
      }
      // Resolve any pending waiters and seed future calls with the live session.
      authReadyPromise = Promise.resolve(cachedSession);
    }
  });
}

attachAuthCacheInvalidation();

/** Wait until Supabase has read the session from localStorage (fixes hard-refresh login redirect). */
export function waitForAuthSession(): Promise<Session | null> {
  if (!isBrowser()) return Promise.resolve(null);

  // Fast path: listener already gave us the live session.
  if (cachedSession) return Promise.resolve(cachedSession);

  if (!authReadyPromise) {
    authReadyPromise = (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) console.error("[auth] getSession", error);
      if (session) {
        cachedSession = session;
        return session;
      }

      return new Promise<Session | null>((resolve) => {
        let settled = false;
        const finish = (s: Session | null) => {
          if (settled) return;
          settled = true;
          if (s) cachedSession = s;
          resolve(s);
        };

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
            subscription.unsubscribe();
            finish(s);
          }
        });

        setTimeout(async () => {
          subscription.unsubscribe();
          const { data: { session: retry } } = await supabase.auth.getSession();
          finish(retry);
        }, 500);
      });
    })();
  }

  return authReadyPromise;
}

/** Call after sign-in/sign-up before navigating to a protected route. */
export async function ensureAuthSessionReady(): Promise<Session | null> {
  // Don't blow away the cache — the SIGNED_IN listener has already populated it.
  return waitForAuthSession();
}

export async function getSessionUser() {
  const session = await waitForAuthSession();
  return session?.user ?? null;
}

export async function requireSessionUser() {
  if (!isBrowser()) return null;

  let session = await waitForAuthSession();
  if (!session?.user) {
    resetAuthReady();
    session = await waitForAuthSession();
  }
  if (!session?.user) throw redirect({ to: "/login" });
  return session.user;
}

const ONBOARDING_CACHE_KEY = "tellus-onboarding-v1";
const ONBOARDING_TTL_MS = 10 * 60 * 1000;

type OnboardingCache = {
  userId: string;
  savedAt: number;
  googleConnected: boolean;
  hasCv: boolean;
  hasSetPassword: boolean;
  onboardingCompleted: boolean;
};

function readOnboardingCache(userId: string): OnboardingCache | null {
  if (!isBrowser()) return null;
  try {
    const raw = sessionStorage.getItem(ONBOARDING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingCache;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.savedAt > ONBOARDING_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeOnboardingCache(entry: OnboardingCache) {
  if (!isBrowser()) return;
  try {
    sessionStorage.setItem(ONBOARDING_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function clearOnboardingCache() {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ONBOARDING_CACHE_KEY);
}

/** Cached onboarding gate — avoids two DB round-trips on every navigation. */
export async function getOnboardingStatus(userId: string) {
  const cached = readOnboardingCache(userId);
  if (cached) {
    return {
      googleConnected: cached.googleConnected,
      hasCv: cached.hasCv,
      hasSetPassword: cached.hasSetPassword,
      onboardingCompleted: cached.onboardingCompleted,
    };
  }

  const [{ data: prof }, { data: integration }] = await Promise.all([
    supabase.from("profiles").select("cv_storage_path, has_set_password, onboarding_completed").eq("id", userId).maybeSingle(),
    supabase
      .from("user_integrations")
      .select("google_connected")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const status = {
    googleConnected: !!integration?.google_connected,
    hasCv: !!prof?.cv_storage_path,
    hasSetPassword: !!prof?.has_set_password,
    onboardingCompleted: !!prof?.onboarding_completed,
  };

  writeOnboardingCache({
    userId,
    savedAt: Date.now(),
    ...status,
  });

  return status;
}

export type PostAuthPath =
  | "/marketplace"
  | "/integrations"
  | "/onboarding/cv"
  | "/auth/create-password";

/** Where to send the user right after sign-in — matches authenticated route guards. */
export async function resolvePostAuthDestination(userId: string): Promise<PostAuthPath> {
  clearOnboardingCache();
  const { googleConnected, hasCv, hasSetPassword } = await getOnboardingStatus(userId);
  if (!hasSetPassword) return "/auth/create-password";
  if (!googleConnected) return "/integrations";
  if (!hasCv) return "/onboarding/cv";
  return "/marketplace";
}
