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
    const referrerSubject = "🎉 Your Tellus  referral link was used!";
    const referrerHtml = `
      <div style="font-family: monospace, Courier, monospace; font-size: 14px; line-height: 1.5; color: #000000; max-width: 600px; margin: 0; padding: 20px 0;">
        ==================================================
        TELLUS KENYA — REFERRAL UPGRADE PROGRESS
        ==================================================
        
        Hi ${referrerName},
        
        Great news! Someone has just registered on Tellus using your personal referral link.
        
        This brings you one step closer to upgrading your workspace (which unlocks the Career Site Monitors dashboard and grants deeper CV upload limits)!
        
        Keep sharing your link with friends, cohort groups, or professional contacts. You can check your completed referrals and active progress anytime under settings.
        
        Thanks for helping our Kenyan job-hunting community grow!
        
        ==================================================
        Tellus Kenya Team
      </div>
    `;

    // ── Email 2: To Admin ────────────────────────────────────────
    const adminSubject = `[Tellus Admin] New Referral Signup: ${referredName} via ${referrerName}`;
    const adminHtml = `
      <div style="font-family: monospace, Courier, monospace; font-size: 14px; line-height: 1.5; color: #000000; max-width: 600px; margin: 0; padding: 20px 0;">
        ==================================================
        TELLUS ADMIN — NEW REFERRAL SIGNUP
        ==================================================
        
        A new user has registered using a referral link!
        
        Referral Breakdown:
        - Referred User (New Signup): ${referredName} (${referredEmail})
        - Referring User (Referrer): ${referrerName} (${referrerEmail})
        - Referral Code Used: ${referralCode}
        - Timestamp: ${timestamp}
        
        ==================================================
      </div>
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
