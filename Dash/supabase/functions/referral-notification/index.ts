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
        <title>${referrerSubject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Header Banner with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px; text-align: center; border-bottom: 4px solid #f97316;">
              <table align="center" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
                    Tellus<span style="color: #f97316;">.</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; padding-top: 6px;">
                    Job Intelligence Platform
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 32px 32px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                🎉 Referral Upgrade Progress!
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Hi <strong>${referrerName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #334155; line-height: 1.6;">
                Great news! Someone has just registered on Tellus using your personal referral link. 
              </p>

              <!-- Progress Highlight Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px;">
                      🚀 One Step Closer to Upgrade
                    </h3>
                    <p style="margin: 0; font-size: 14.5px; color: #431407; line-height: 1.5;">
                      This registration brings you one step closer to upgrading your workspace—which unlocks the <strong>Career Site Monitors</strong> dashboard and grants deeper CV upload limits!
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 32px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                Keep sharing your link with friends, cohort groups, or professional contacts. You can check your completed referrals and active progress anytime under settings.
              </p>

              <!-- Action Button -->
              <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 32px auto;">
                <tr>
                  <td align="center" style="background-color: #f97316; border-radius: 8px;">
                    <a href="https://myjobs.tellusjobs.site/settings" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; border: 1px solid #ea580c;">
                      View Referral Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 14.5px; color: #64748b; line-height: 1.5;">
                Thanks for helping our Kenyan job-hunting community grow!
              </p>
              <p style="margin: 4px 0 0 0; font-size: 14.5px; font-weight: 700; color: #0f172a;">
                The Tellus Kenya Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This notification was sent to ${referrerEmail} in response to an account creation on Tellus.
              </p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">
                © 2026 Tellus Job Intelligence. All rights reserved.
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
        <title>${adminSubject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <tr style="background-color: #0f172a; padding: 24px; text-align: center;">
            <td style="padding: 20px 32px; border-bottom: 3px solid #64748b; text-align: center;">
              <span style="font-size: 14px; font-weight: 800; color: #ffffff; letter-spacing: 1px; text-transform: uppercase;">
                Tellus Admin Alert
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                New Referral Registration
              </h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.5;">
                A new user has successfully signed up using a personal referral link. The referral details are below:
              </p>

              <!-- Data Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px; width: 100%;">
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #64748b; width: 160px; text-transform: uppercase;">Referred User</td>
                  <td style="padding: 12px 0; font-size: 14.5px; font-weight: 700; color: #0f172a;">
                    ${referredName} <span style="font-weight: 400; color: #64748b; font-size: 13.5px;">(${referredEmail})</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase;">Referring User</td>
                  <td style="padding: 12px 0; font-size: 14.5px; font-weight: 700; color: #0f172a;">
                    ${referrerName} <span style="font-weight: 400; color: #64748b; font-size: 13.5px;">(${referrerEmail})</span>
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase;">Referral Code</td>
                  <td style="padding: 12px 0; font-size: 14.5px; font-family: monospace; color: #ea580c; font-weight: 700;">
                    ${referralCode}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase;">Timestamp</td>
                  <td style="padding: 12px 0; font-size: 14px; color: #334155;">
                    ${timestamp}
                  </td>
                </tr>
              </table>
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
