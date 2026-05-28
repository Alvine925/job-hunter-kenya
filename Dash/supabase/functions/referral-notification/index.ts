import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase.ts";

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
    const referral = payload.record || payload;

    const referrerUserId = referral.referrer_user_id;
    const referredUserId = referral.referred_user_id;
    const referralCode = referral.referral_code_used || "N/A";

    if (!referrerUserId || !referredUserId) {
      return new Response(JSON.stringify({ error: "Referrer and Referred user IDs are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createAdminClient();

    // Query profiles for referrer and referred user
    const { data: referrer, error: referrerErr } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", referrerUserId)
      .maybeSingle();

    const { data: referred, error: referredErr } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", referredUserId)
      .maybeSingle();

    if (referrerErr || !referrer) {
      throw new Error(`Referrer profile not found: ${referrerErr?.message}`);
    }

    if (referredErr || !referred) {
      throw new Error(`Referred profile not found: ${referredErr?.message}`);
    }

    const referrerName = referrer.full_name || "Partner";
    const referrerEmail = referrer.email;
    const referredName = referred.full_name || "A friend";
    const referredEmail = referred.email;
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

    // ── Email 1: To Referrer/Referee ─────────────────────────────
    const referrerSubject = "🎉 Your Tellus referral link was used!";
    const referrerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 40px 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto;">
          <tr>
            <td style="padding-bottom: 32px;">
              <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">Tellus</span><span style="font-size: 26px; font-weight: 800; color: #f97316;">.</span>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #334155; line-height: 1.7;">
                Hi <strong>${referrerName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.7;">
                Great news — someone just registered on Tellus using your personal referral link! 🎉
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.7;">
                This brings you one step closer to upgrading your workspace, which unlocks the <strong style="color: #0f172a;">Career Site Monitors</strong> dashboard and deeper CV upload limits.
              </p>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #334155; line-height: 1.7;">
                Keep sharing your link with friends, cohort groups, or professional contacts. You can check your progress anytime under settings.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 36px;">
              <a href="https://myjobs.tellusjobs.site/settings" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; background-color: #f97316; border-radius: 8px;">
                View Referral Progress
              </a>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin: 0 0 4px 0; font-size: 15px; color: #64748b; line-height: 1.6;">
                Thanks for helping our community grow!
              </p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">
                — The Tellus Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 40px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This email was sent to ${referrerEmail} because a referral was completed on your account.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // ── Email 2: To Admin ────────────────────────────────────────
    const adminSubject = `[Tellus Admin] New Referral Signup: ${referredName} via ${referrerName}`;
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 40px 20px; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; margin: 0 auto;">
          <tr>
            <td style="padding-bottom: 24px;">
              <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a;">Tellus</span><span style="font-size: 22px; font-weight: 800; color: #f97316;">.</span>
              <span style="font-size: 13px; font-weight: 600; color: #64748b; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Admin</span>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
                New Referral Registration
              </p>
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155; line-height: 1.7;">
                <strong style="color: #64748b; font-weight: 500;">New user:</strong> ${referredName} (${referredEmail})
              </p>
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155; line-height: 1.7;">
                <strong style="color: #64748b; font-weight: 500;">Referred by:</strong> ${referrerName} (${referrerEmail})
              </p>
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155; line-height: 1.7;">
                <strong style="color: #64748b; font-weight: 500;">Code used:</strong> <span style="color: #ea580c; font-weight: 600;">${referralCode}</span>
              </p>
              <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.7;">
                <strong style="color: #64748b; font-weight: 500;">Time:</strong> ${timestamp}
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Fire both emails
    const [resReferrer, resAdmin] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `Tellus Kenya <${senderEmail}>`,
          to: [referrerEmail],
          subject: referrerSubject,
          html: referrerHtml,
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: `Tellus Admin <${senderEmail}>`,
          to: [adminEmail],
          subject: adminSubject,
          html: adminHtml,
        }),
      }),
    ]);

    if (!resReferrer.ok) {
      const errText = await resReferrer.text();
      console.error(`Referrer email failed: ${errText}`);
    }

    if (!resAdmin.ok) {
      const errText = await resAdmin.text();
      console.error(`Admin email failed: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Referral email triggers failed:", err);
    return new Response(JSON.stringify({ error: "An unexpected server error occurred." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
