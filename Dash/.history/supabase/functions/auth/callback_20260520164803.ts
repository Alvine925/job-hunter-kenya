import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export default async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response(JSON.stringify({ error: "No authorization code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) throw error;

    const accessToken = data.session?.access_token;
    const refreshToken = data.session?.refresh_token;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token received" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the origin from request
    const origin = url.origin;

    // Set cookies for the session
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: `${origin}/auth/session?access_token=${accessToken}&refresh_token=${refreshToken || ""}`,
        "Set-Cookie": [
          `sb-access-token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`,
          `sb-refresh-token=${refreshToken || ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
        ].join(", "),
      },
    });

    return response;
  } catch (error: any) {
    console.error("Auth callback error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Authentication failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
