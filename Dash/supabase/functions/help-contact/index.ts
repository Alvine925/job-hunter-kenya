import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/supabase.ts";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject ?? "").trim().slice(0, 120);
    const message = String(body.message ?? "").trim().slice(0, 2000);

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: "Subject and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "onboarding@resend.dev";
    const supportEmail = Deno.env.get("SUPPORT_EMAIL") || "hello@tellusjobs.site";

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email provider not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName =
      user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Tellus user";
    const userEmail = user.email || "";
    const sentAt = new Date().toLocaleString("en-US", { timeZone: "Africa/Nairobi" });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Tellus Help <${senderEmail}>`,
        to: [supportEmail],
        reply_to: userEmail || undefined,
        subject: `[Tellus Help] ${subject}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <h2 style="margin: 0 0 12px; color: #fd5d28;">New help question</h2>
            <p><strong>From:</strong> ${escapeHtml(String(userName))}</p>
            <p><strong>Email:</strong> ${escapeHtml(userEmail || "Not available")}</p>
            <p><strong>Sent:</strong> ${escapeHtml(sentAt)} EAT</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <div style="margin-top: 16px; padding: 14px; border: 1px solid #fed7c2; border-radius: 10px; background: #fff7f2;">
              ${escapeHtml(message).replace(/\n/g, "<br />")}
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Help contact failed:", err);
    return new Response(JSON.stringify({ error: "Unable to send your question right now" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
