import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

export default async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors from Google
  if (error) {
    const errorDescription = url.searchParams.get("error_description") || error;
    const returnUrl = `${url.origin}/auth/callback?error=${encodeURIComponent(errorDescription)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: returnUrl },
    });
  }

  if (!code) {
    const returnUrl = `${url.origin}/auth/callback?error=${encodeURIComponent("No authorization code")}`;
    return new Response(null, {
      status: 302,
      headers: { Location: returnUrl },
    });
  }

  try {
    // Decode state to get verifier
    let verifier = "";
    if (state) {
      const stateData = JSON.parse(atob(state));
      verifier = stateData.verifier;
    }

    const clientId = Deno.env.get("CLIENT_ID");
    const clientSecret = Deno.env.get("CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || 
      `${supabaseUrl}/functions/v1/auth-callback`;

    if (!clientId || !clientSecret) {
      throw new Error("OAuth credentials not configured");
    }

    // Exchange code for Google tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
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

    // Get user info from Google
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      }
    );

    if (!userResponse.ok) {
      throw new Error("Failed to get user info");
    }

    const googleUser = await userResponse.json();

    // Sign in/up with Supabase using Google identity
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data, error: authError } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: tokenData.id_token,
    });

    if (authError) {
      // If user doesn't exist, create them
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: googleUser.email,
        password: Math.random().toString(36), // Random password for OAuth users
        options: {
          data: {
            full_name: googleUser.name,
            avatar_url: googleUser.picture,
          },
        },
      });

      if (signUpError) throw signUpError;
      
      const accessToken = signUpData.session?.access_token;
      const refreshToken = signUpData.session?.refresh_token;

      if (!accessToken) throw new Error("No access token");

      // Redirect back to app with tokens
      const returnUrl = `${url.origin}/auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken || "")}&google_access_token=${encodeURIComponent(googleAccessToken)}&google_refresh_token=${encodeURIComponent(googleRefreshToken || "")}`;
      return new Response(null, {
        status: 302,
        headers: { Location: returnUrl },
      });
    }

    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    if (!accessToken) throw new Error("No access token");

    // Redirect back to app with tokens
    const returnUrl = `${url.origin}/auth/callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken || "")}&google_access_token=${encodeURIComponent(googleAccessToken)}&google_refresh_token=${encodeURIComponent(googleRefreshToken || "")}`;
    return new Response(null, {
      status: 302,
      headers: { Location: returnUrl },
    });
  } catch (error: any) {
    console.error("Auth callback error:", error);
    const returnUrl = `${url.origin}/auth/callback?error=${encodeURIComponent(error.message)}`;
    return new Response(null, {
      status: 302,
      headers: { Location: returnUrl },
    });
  }
};
