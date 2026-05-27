import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function googleOAuthCredentials() {
  const clientId = Deno.env.get("CLIENT_ID") ?? Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("CLIENT_SECRET") ?? Deno.env.get("GOOGLE_CLIENT_SECRET");
  return { clientId, clientSecret };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const { clientId, clientSecret } = googleOAuthCredentials();
  if (!clientId || !clientSecret) {
    console.error("Google OAuth client id/secret not configured (CLIENT_ID / CLIENT_SECRET)");
    return null;
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Google token refresh failed", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return (data.access_token as string) ?? null;
}

/**
 * Fresh Google access token for Drive/Gmail — always prefers refresh_token from DB.
 * Ignores stale session.provider_token from the browser.
 */
export async function resolveGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: integration, error } = await supabase
    .from("user_integrations")
    .select("google_access_token, google_refresh_token, google_connected")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("user_integrations lookup failed", error);
    throw new Error("Could not load Google integration.");
  }

  if (!integration?.google_refresh_token && !integration?.google_access_token) {
    throw new Error("Connect Google in Settings to use Gmail and Drive.");
  }

  if (integration.google_refresh_token) {
    const refreshed = await refreshGoogleAccessToken(integration.google_refresh_token);
    if (refreshed) {
      await supabase
        .from("user_integrations")
        .update({
          google_access_token: refreshed,
          google_connected: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return refreshed;
    }
  }

  if (integration?.google_access_token) {
    return integration.google_access_token;
  }

  throw new Error(
    "Google session expired. Open Settings → Integrations and reconnect Google.",
  );
}
