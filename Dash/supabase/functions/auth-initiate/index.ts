import { getCorsHeaders } from "../_shared/cors.ts";

export default async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const clientId = Deno.env.get("CLIENT_ID");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || 
    `${supabaseUrl}/functions/v1/auth-callback`;

  if (!clientId) {
    return new Response(JSON.stringify({ error: "Client ID not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Read referral code forwarded from the login page
    const reqUrl = new URL(req.url);
    const refCode = reqUrl.searchParams.get("ref") || null;

    // Generate PKCE
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((i) => chars[i % chars.length])
      .join("");

    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Embed referral code in state so auth-callback can retrieve it
    const statePayload: Record<string, string> = { verifier: codeVerifier };
    if (refCode) statePayload.ref = refCode;
    const state = btoa(JSON.stringify(statePayload));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents",
      state: state,
      access_type: "offline",
      prompt: "consent",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: googleAuthUrl,
      },
    });
  } catch (error: any) {
    console.error("Auth initiate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
