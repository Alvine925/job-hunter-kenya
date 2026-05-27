import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight fast
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { email, password, turnstileToken } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CAPTCHA verification (Cloudflare Turnstile)
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (turnstileSecret) {
      if (!turnstileToken) {
        return new Response(JSON.stringify({ error: "Security check failed: missing CAPTCHA token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return new Response(JSON.stringify({ error: "Security check failed: invalid CAPTCHA token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Check if email is currently locked
    const { data: attemptData, error: attemptFetchError } = await supabaseAdmin
      .from("login_attempts")
      .select("attempts, locked_until")
      .eq("email", email)
      .maybeSingle();

    if (attemptFetchError) {
      console.error("Error fetching login attempts:", attemptFetchError);
    }

    if (attemptData) {
      const lockedUntil = attemptData.locked_until ? new Date(attemptData.locked_until) : null;
      if (lockedUntil && lockedUntil > new Date()) {
        const remainingMs = lockedUntil.getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return new Response(
          JSON.stringify({
            error: `Too many failed attempts. Account is locked. Try again in ${remainingMins} minute(s).`,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 2. Attempt login using standard Anon client
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Login failed - increment attempts
      const currentAttempts = (attemptData?.attempts ?? 0) + 1;
      let lockedUntil: string | null = null;

      if (currentAttempts >= 5) {
        // Lock for 10 minutes
        lockedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      }

      await supabaseAdmin.from("login_attempts").upsert(
        {
          email,
          attempts: currentAttempts,
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "email",
        },
      );

      const attemptsLeft = Math.max(0, 5 - currentAttempts);
      const errMsg =
        attemptsLeft > 0
          ? `Invalid login credentials (${attemptsLeft} attempt(s) left before lock)`
          : `Too many failed attempts. Account is locked for 10 minutes.`;

      return new Response(
        JSON.stringify({
          error: errMsg,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Login succeeded - reset attempts
    if (attemptData) {
      await supabaseAdmin.from("login_attempts").delete().eq("email", email);
    }

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Login edge function error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during login." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
