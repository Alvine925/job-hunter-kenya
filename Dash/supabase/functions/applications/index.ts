import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveGoogleAccessToken } from "../_shared/google-auth.ts";
import { requireAuth } from "../_shared/supabase.ts";
import {
  generateEmailApplication,
  generateFormApplicationPack,
  generateInterviewQuestions,
  saveApplicationPackToDrive,
  sendPreparedEmailApplication,
} from "../_shared/application-engine.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireAuth(req);
    const body = await req.json();
    const action = body.action;

    if (action === "generate-letter") {
      const { jobId, tone = "Formal", google_access_token, mode = "manual" } = body;
      if (!jobId) throw new Error("Missing jobId");

      // Check limits first!
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "pack_generation",
      });
      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: job }, { data: profile }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
        supabase.from("profiles").select("*").eq("id", userId).single(),
      ]);
      if (!job || !profile) throw new Error("Missing job or profile");

      const googleAccessToken = await resolveGoogleAccessToken(supabase, userId);

      const result = await generateEmailApplication({
        supabase,
        userId,
        job,
        profile,
        tone,
        mode,
        googleAccessToken,
      });

      // Track usage log
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "pack_generation",
        p_metadata: { jobId, action }
      });

      return new Response(JSON.stringify({ application: result.application }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-pack") {
      const { jobId, google_access_token, mode = "manual" } = body;
      if (!jobId) throw new Error("Missing jobId");

      // Check limits first!
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "pack_generation",
      });
      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: job }, { data: profile }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
        supabase.from("profiles").select("*").eq("id", userId).single(),
      ]);
      if (!job || !profile) throw new Error("Missing job or profile");

      const googleAccessToken = await resolveGoogleAccessToken(supabase, userId);

      const result = await generateFormApplicationPack({
        supabase,
        userId,
        job,
        profile,
        mode,
        googleAccessToken,
      });

      // Track usage log
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "pack_generation",
        p_metadata: { jobId, action }
      });

      return new Response(JSON.stringify({ application: result.application, pack: result.pack }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-interview-questions") {
      const { jobId } = body;
      if (!jobId) throw new Error("Missing jobId");

      // Check limits first!
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "pack_generation",
      });
      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [{ data: job }, { data: profile }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
        supabase.from("profiles").select("*").eq("id", userId).single(),
      ]);
      if (!job || !profile) throw new Error("Missing job or profile");

      const result = await generateInterviewQuestions({
        supabase,
        userId,
        job,
        profile,
      });

      // Track usage log
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "pack_generation",
        p_metadata: { jobId, action }
      });

      return new Response(JSON.stringify({ application: result.application }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-draft") {
      const { applicationId, email_subject, email_body, cover_letter, application_email } = body;
      if (!applicationId) throw new Error("Missing applicationId");
      const patch: Record<string, unknown> = { status: "draft" };
      if (email_subject !== undefined) patch.email_subject = email_subject;
      if (email_body !== undefined) patch.email_body = email_body;
      if (cover_letter !== undefined) patch.cover_letter = cover_letter;
      if (application_email !== undefined) {
        const email =
          typeof application_email === "string" && application_email.includes("@") &&
            application_email.toLowerCase() !== "null"
            ? application_email.trim()
            : null;
        patch.application_email = email;
      }

      const { data: upd, error } = await supabase
        .from("applications")
        .update(patch)
        .eq("id", applicationId)
        .eq("user_id", userId)
        .select("*, job_id")
        .single();
      if (error) throw error;

      if (patch.application_email && upd?.job_id) {
        await supabase
          .from("jobs")
          .update({
            application_email: patch.application_email,
            application_method: "email",
          })
          .eq("id", upd.job_id)
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ application: upd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save-pack-to-drive") {
      const {
        applicationId,
        email_subject,
        email_body,
        cover_letter,
        google_access_token,
      } = body;
      if (!applicationId) throw new Error("Missing applicationId");

      const googleAccessToken = await resolveGoogleAccessToken(supabase, userId);

      const { data: app, error: appErr } = await supabase
        .from("applications")
        .select("*")
        .eq("id", applicationId)
        .eq("user_id", userId)
        .single();
      if (appErr || !app) throw new Error("Application not found");

      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", app.job_id)
        .eq("user_id", userId)
        .single();
      if (jobErr || !job) throw new Error("Job not found");

      const result = await saveApplicationPackToDrive({
        supabase,
        userId,
        job,
        application: app,
        email_subject: email_subject ?? app.email_subject ?? "",
        email_body: email_body ?? app.email_body ?? "",
        cover_letter: cover_letter ?? app.cover_letter ?? "",
        googleAccessToken,
      });

      return new Response(
        JSON.stringify({
          application: result.application,
          folderUrl: result.folderUrl,
          folderName: result.folderName,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "send-email") {
      const {
        applicationId,
        to,
        cc,
        bcc,
        subject,
        body: emailBody,
        includeCv = true,
        google_access_token,
      } = body;
      if (!applicationId || !to || !subject || !emailBody) {
        throw new Error("Missing required fields");
      }
      const googleAccessToken = await resolveGoogleAccessToken(supabase, userId);

      const { data: app, error: appErr } = await supabase
        .from("applications")
        .select("*")
        .eq("id", applicationId)
        .eq("user_id", userId)
        .single();
      if (appErr || !app) throw new Error("Application not found");

      // Verify recipient matches job application_email (FIX 7: Anti-relay/spam protection)
      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .select("application_email")
        .eq("id", app.job_id)
        .single();
      if (jobErr || !job) throw new Error("Associated job not found");

      const allowedEmail = job.application_email?.trim().toLowerCase();
      const requestedEmail = to.trim().toLowerCase();
      if (!allowedEmail || requestedEmail !== allowedEmail) {
        throw new Error(`Unauthorized recipient: emails can only be sent to the job's application email (${allowedEmail || "not specified"})`);
      }

      // Check daily email sending rate limits (FIX 7)
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "email_send",
      });

      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sent = await sendPreparedEmailApplication({
        supabase,
        userId,
        application: { ...app, application_email: to },
        to,
        cc,
        bcc,
        subject,
        body: emailBody,
        includeCv,
        googleAccessToken,
      });

      // Log usage in usage_tracking (FIX 7)
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "email_send",
        p_metadata: { applicationId, to },
      });

      // Audit log in sent_emails table (FIX 20)
      await supabase.from("sent_emails").insert({
        user_id: userId,
        application_id: applicationId,
        recipient: to,
        subject,
        body_preview: emailBody.slice(0, 500),
        gmail_message_id: sent.gmailMessageId,
      });

      return new Response(
        JSON.stringify({
          application: sent.application,
          gmailMessageId: sent.gmailMessageId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("Applications edge function error:", err);
    // Sanitize error messages (FIX 16) - return custom message if not a known user error
    const isUserFriendly =
      rawMessage.includes("Missing") ||
      rawMessage.includes("not found") ||
      rawMessage.includes("limit") ||
      rawMessage.includes("Unauthorized recipient") ||
      rawMessage.includes("Invalid");
    const displayMessage = isUserFriendly ? rawMessage : "An unexpected server error occurred.";
    return new Response(JSON.stringify({ error: displayMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
