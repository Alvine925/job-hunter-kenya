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
    const report = payload.record || payload;

    const id = report.id || "N/A";
    const userId = report.user_id || "Guest / Anonymous User";
    const errorMessage = report.error_message || "Unknown error occurred.";
    const errorStack = report.error_stack || "No stack trace provided.";
    const section = report.section || "General Application";
    const actionContext = report.action_context || "Background Operation";
    const userDescription = report.user_description || null;
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

    const subject = `[Tellus System Alert] Error in ${section}: ${errorMessage.slice(0, 50)}`;

    const userDescSection = userDescription 
      ? `
        User Description:
        "${userDescription}"
        `
      : "";

    const htmlBody = `
      <div style="font-family: monospace, Courier, monospace; font-size: 14px; line-height: 1.5; color: #ff3333; max-width: 700px; margin: 0; padding: 20px 0;">
        ==================================================
        TELLUS KENYA — CRITICAL SYSTEM EXCEPTION ALERT
        ==================================================
        
        An unhandled system exception occurred and was captured.
        
        Failure Summary:
        - Report ID: ${id}
        - Platform Section: ${section}
        - Attempted Action: ${actionContext}
        - User Account: ${userId}
        - Event Time: ${timestamp}
        
        Error Message:
        >>> ${errorMessage}
        ${userDescSection}
        ==================================================
        CAPTURED ERROR STACK TRACE:
        ==================================================
        <pre style="background: #111111; color: #ff5555; padding: 15px; border-left: 4px solid #ff3333; font-family: monospace; font-size: 11px; white-space: pre-wrap; overflow-x: auto; margin-top: 15px;">
${errorStack}
        </pre>
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
        from: `Tellus Alerts <${senderEmail}>`,
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
    console.error("Admin error notification failed:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
