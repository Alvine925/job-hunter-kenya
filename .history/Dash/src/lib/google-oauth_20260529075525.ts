import { createClient } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvVar(env: unknown, key: string): string | undefined {
  // Cloudflare Worker env binding (preferred)
  if (env && typeof env === "object" && key in (env as Record<string, unknown>)) {
    return (env as Record<string, string>)[key];
  }
  // Fallback to process.env (server-side only — never prefix with VITE_)
  if (typeof process !== "undefined" && process.env) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
}

/**
 * Create a Supabase admin client for server-side-only operations.
 * This function is ONLY called from server routes (src/server.ts).
 * It must NEVER be bundled into the client.
 */
function getAdminClient(env: unknown) {
  const url = getEnvVar(env, "SUPABASE_URL");
  const key = getEnvVar(env, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase admin credentials");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// 1) /api/auth/google-init  –  Redirects browser to Google consent screen
// ---------------------------------------------------------------------------

export async function handleGoogleInit(
  request: Request,
  env: unknown,
): Promise<Response> {
  const clientId = getEnvVar(env, "CLIENT_ID");
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google-callback`;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "OAuth not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const refCode = url.searchParams.get("ref");

    // Generate cryptographically random state for CSRF protection
    const stateToken = crypto.randomUUID();

    // Generate PKCE code verifier
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((i) => chars[i % chars.length])
      .join("");

    // Store state + code verifier server-side (CRITICAL: never put these in the URL)
    const admin = await getAdminClient(env);
    const { error: insertErr } = await admin
      .from("pending_oauth_sessions")
      .insert({
        state_token: stateToken,
        code_verifier: codeVerifier,
        ref_code: refCode || null,
      });

    if (insertErr) {
      console.error("Failed to store OAuth state:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to initiate OAuth" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
      state: stateToken,
      access_type: "offline",
      prompt: "consent",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return new Response(null, {
      status: 302,
      headers: { Location: googleAuthUrl },
    });
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Google init error:", errorMsg, error);
    
    // Return detailed error for debugging
    const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
    const details = isDev ? ` — ${errorMsg}` : "";
    
    return new Response(JSON.stringify({ 
      error: "OAuth initialization failed" + details,
      details: isDev ? {
        message: errorMsg,
        type: error?.constructor?.name,
        supabaseUrl: getEnvVar(env, "SUPABASE_URL") ? "✓ set" : "✗ missing",
        supabaseKey: getEnvVar(env, "SUPABASE_SERVICE_ROLE_KEY") ? "✓ set" : "✗ missing",
        clientId: getEnvVar(env, "CLIENT_ID") ? "✓ set" : "✗ missing",
      } : undefined,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ---------------------------------------------------------------------------
// 2) /api/auth/google-callback  –  Google redirects here after consent
// ---------------------------------------------------------------------------

async function processReferral(admin: any, userId: string, refCode: string) {
  try {
    const { data: existingReferral } = await admin
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (existingReferral) return;

    const { data: referrerProf } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode)
      .maybeSingle();

    if (!referrerProf || referrerProf.id === userId) return;

    await admin
      .from("profiles")
      .update({ referred_by: referrerProf.id })
      .eq("id", userId);

    await admin
      .from("referrals")
      .insert({
        referrer_user_id: referrerProf.id,
        referred_user_id: userId,
        referral_code_used: refCode,
        status: "completed",
        verified_at: new Date().toISOString(),
      });

    console.log(`[Referral] Processed for user ${userId.slice(0, 8)}...`);
  } catch (err) {
    console.error("Failed to process referral:", err);
  }
}

export async function handleGoogleCallback(
  request: Request,
  env: unknown,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  // --- Handle OAuth errors from Google ---
  if (error) {
    const desc = url.searchParams.get("error_description") || error;
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/auth/callback?error=${encodeURIComponent(desc)}`,
      },
    });
  }

  if (!code || !stateParam) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/auth/callback?error=${encodeURIComponent("Missing authorization code or state")}`,
      },
    });
  }

  try {
    const admin = await getAdminClient(env);

    // ---- CSRF VERIFICATION: Validate state against server-side record ----
    const { data: oauthSession, error: lookupErr } = await admin
      .from("pending_oauth_sessions")
      .select("*")
      .eq("state_token", stateParam)
      .eq("used", false)
      .single();

    if (lookupErr || !oauthSession) {
      console.error("OAuth state verification failed — possible CSRF attack");
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/auth/callback?error=${encodeURIComponent("Invalid or expired OAuth session. Please try again.")}`,
        },
      });
    }

    // Check expiration
    if (new Date(oauthSession.expires_at) < new Date()) {
      await admin.from("pending_oauth_sessions").delete().eq("id", oauthSession.id);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/auth/callback?error=${encodeURIComponent("OAuth session expired. Please try again.")}`,
        },
      });
    }

    // Mark state as used immediately (single-use)
    await admin
      .from("pending_oauth_sessions")
      .update({ used: true })
      .eq("id", oauthSession.id);

    const refCode = oauthSession.ref_code || undefined;

    const clientId = getEnvVar(env, "CLIENT_ID");
    const clientSecret = getEnvVar(env, "CLIENT_SECRET");
    const redirectUri = `${origin}/api/auth/google-callback`;

    if (!clientId || !clientSecret) {
      throw new Error("OAuth credentials not configured");
    }

    // --- Exchange authorization code for Google tokens ---
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || "Token exchange failed");
    }

    const tokenData = await tokenResponse.json();
    const googleAccessToken = tokenData.access_token;
    const googleRefreshToken = tokenData.refresh_token;
    
    // Log for debugging — Google doesn't always return refresh_token
    if (!googleAccessToken) {
      console.error("Google token exchange failed: no access_token", tokenData);
      throw new Error("Google did not return access token");
    }
    if (!googleRefreshToken) {
      console.warn("Google did not return refresh token (may need offline access re-consent)");
    }

    // --- Sign in / up with Supabase using the Google ID token ---
    if (!tokenData.id_token) {
      throw new Error("Google OAuth response missing id_token");
    }
    const { data, error: authError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: tokenData.id_token,
    });

    let accessToken: string | undefined;
    let refreshToken: string | undefined | null;
    let userId: string | undefined;

    if (authError) {
      // Fallback: get Google user info and create a Supabase account
      const userResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${googleAccessToken}` } },
      );

      if (!userResponse.ok) throw new Error("Failed to get user info");

      const googleUser = await userResponse.json();

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: googleUser.email,
          password: crypto.randomUUID(),
          options: {
            data: {
              full_name: googleUser.name,
              avatar_url: googleUser.picture,
            },
          },
        });

      if (signUpError) throw signUpError;

      userId = signUpData.user?.id;
      accessToken = signUpData.session?.access_token;
      refreshToken = signUpData.session?.refresh_token;
    } else {
      userId = data.user?.id;
      accessToken = data.session?.access_token;
      refreshToken = data.session?.refresh_token;

      // Handle referrals for new users
      if (data.user && refCode) {
        const isNewUser = data.user.created_at && (Date.now() - new Date(data.user.created_at).getTime() < 120000);
        if (isNewUser) {
          await processReferral(admin, data.user.id, refCode);
        }
      }
    }

    if (!accessToken) throw new Error("No access token");

    if (userId && refCode && !data?.user) {
      await processReferral(admin, userId, refCode);
    }

    // --- SECURITY FIX: Store tokens server-side, pass only opaque session key ---
    const sessionKey = crypto.randomUUID();
    const { error: storeErr } = await admin
      .from("pending_oauth_sessions")
      .insert({
        state_token: sessionKey,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        google_access_token: googleAccessToken,
        google_refresh_token: googleRefreshToken || null,
        ref_code: refCode || null,
        user_id: userId || null,
        // Short TTL for token exchange
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

    if (storeErr) {
      console.error("Failed to store session tokens:", storeErr);
      console.error("Failed storing refresh_token:", refreshToken, "access_token exists:", !!accessToken);
      throw new Error("Failed to complete authentication: " + (storeErr.message || "storage error"));
    }

    // Redirect with ONLY the opaque session key — no tokens in URL
    const params = new URLSearchParams({ session_key: sessionKey });
    if (refCode) params.set("ref", refCode);

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/auth/callback?${params}`,
      },
    });
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Auth callback error:", errorMsg, err);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/auth/callback?error=${encodeURIComponent("Google OAuth failed: " + errorMsg)}`,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3) /api/auth/exchange-session — Exchange opaque session_key for tokens
// ---------------------------------------------------------------------------

export async function handleSessionExchange(
  request: Request,
  env: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const sessionKey = body.session_key;

    if (!sessionKey || typeof sessionKey !== "string") {
      return new Response(JSON.stringify({ error: "Missing session_key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = await getAdminClient(env);

    // Look up the session — must be unused and not expired
    const { data: session, error: lookupErr } = await admin
      .from("pending_oauth_sessions")
      .select("*")
      .eq("state_token", sessionKey)
      .eq("used", false)
      .single();

    if (lookupErr || !session) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await admin.from("pending_oauth_sessions").delete().eq("id", session.id);
      return new Response(JSON.stringify({ error: "Session expired" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mark as used immediately (single-use token)
    await admin
      .from("pending_oauth_sessions")
      .update({ used: true })
      .eq("id", session.id);

    // Return tokens securely via POST response body (not URL)
    return new Response(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        google_access_token: session.google_access_token,
        google_refresh_token: session.google_refresh_token,
        ref: session.ref_code,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Session exchange error:", err);
    return new Response(JSON.stringify({ error: "Exchange failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
