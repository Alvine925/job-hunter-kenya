import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WEBHOOK_SECRET = "tellus_secret_webhook_token_2026";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
      },
    });
  }

  try {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));
    const profile = payload.record || payload;

    const name = profile.full_name || "New Candidate";
    const email = profile.email || "No Email Provided";
    const userId = profile.id || "N/A";
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" }) + " (EAT)";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "onboarding@resend.dev";
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "admin@tellusjobs.site";

    if (!resendKey) {
      console.warn("RESEND_API_KEY environment secret is not configured.");
      return new Response(JSON.stringify({ error: "Email provider not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subject = `[Tellus Admin] New Signup: ${name} (${email})`;

    const htmlBody = `
      <div style="font-family: monospace, Courier, monospace; font-size: 14px; line-height: 1.5; color: #000000; max-width: 600px; margin: 0; padding: 20px 0;">
        ==================================================
        TELLUS ADMIN — NEW SIGNUP NOTIFICATION
        ==================================================
        
        A new user has just registered on the Tellus Kenya platform.
        
        User Details:
        - Full Name: ${name}
        - Email Address: ${email}
        - User ID: ${userId}
        - Registration Date: ${timestamp}
        
        ==================================================
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Tellus Admin <${senderEmail}>`,
        to: [adminEmail],
        subject,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API failed: ${errText}`);
    }

    const resData = await res.json();
    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Admin signup notification failed:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
