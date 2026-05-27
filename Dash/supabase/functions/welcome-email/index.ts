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

    const toEmail = profile.email;
    const name = profile.full_name || "there";

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "onboarding@resend.dev";
    const dashboardUrl = Deno.env.get("DASHBOARD_URL") || "http://localhost:3001";

    if (!resendKey) {
      console.warn("RESEND_API_KEY environment secret is not configured.");
      return new Response(JSON.stringify({ error: "Email provider not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subject = "Welcome to Tellus Kenya! Let's automate your career search ⚡";

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0; padding: 20px 0;">
        <div style="font-size: 20px; font-weight: 800; color: #fd5d28; letter-spacing: -0.5px; margin-bottom: 24px; border-bottom: 2px solid #fd5d28; padding-bottom: 8px;">
          TELLUS KENYA — SMART JOB APPLICATION WORKSPACE
        </div>
        
        <p style="margin-top: 0; margin-bottom: 16px;">Hi ${name},</p>
        
        <p style="margin-bottom: 16px;">
          Welcome to Tellus! We are thrilled to support you on your career journey.
        </p>
        
        <p style="margin-bottom: 16px;">
          Tellus is a smart workspace designed to completely automate and elevate your job search on Kenya's top career portals (including Fuzu, BrighterMonday, and MyJobsInKenya).
        </p>
        
        <p style="margin-bottom: 16px; font-weight: bold; color: #fd5d28;">
          Here is a quick overview of what you can do right now:
        </p>
        
        <ul style="margin-top: 0; margin-bottom: 24px; padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Match Your CV</strong>: Upload your CV to check compatibility and receive a semantic match score (0-100%) against any Kenyan vacancy instantly.</li>
          <li style="margin-bottom: 8px;"><strong>Tailored Application Packs</strong>: Instantly generate completely customized cover letters, email introductions, and interview prep guides matching your milestones.</li>
          <li style="margin-bottom: 8px;"><strong>Background Staging</strong>: Automate draft creation directly inside your connected Google Drive and Gmail drafts folder.</li>
          <li style="margin-bottom: 8px;"><strong>Referrals & Upgrades</strong>: Invite friends to instantly scale up your daily matching, CV parsing, and staging volumes.</li>
        </ul>
        
        <p style="margin-bottom: 24px;">
          Click the button below to log in and access your workspace dashboard:
        </p>
        
        <div style="margin-top: 32px; margin-bottom: 32px;">
          <a href="${dashboardUrl}/login" style="background-color: #fd5d28; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(253, 93, 40, 0.15);">
            Go to Dashboard
          </a>
        </div>
        
        <p style="margin-bottom: 0; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          Warm regards,<br />
          The Tellus Kenya Team
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Tellus Kenya <${senderEmail}>`,
        to: [toEmail],
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
    console.error("Welcome email execution failed:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
