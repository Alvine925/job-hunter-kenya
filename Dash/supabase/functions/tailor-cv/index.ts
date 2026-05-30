import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveGoogleAccessToken } from "../_shared/google-auth.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/error-sanitizer.ts";
import { runCvTailorAgent } from "../_shared/job-agents.ts";
import { upsertApplication } from "../_shared/application-engine.ts";
import { createGoogleDocFormatted } from "../_shared/drive.ts";

function sanitizeDriveName(value: string) {
  return value.replace(/[\\/:*?"<>|#{}%~&]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled Job";
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireAuth(req);
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      throw new Error("Missing jobId");
    }

    // Fetch Job and Profile
    const [{ data: job }, { data: profile }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
    ]);

    if (!job || !profile) {
      throw new Error("Missing job or profile");
    }

    // Call CV Tailor Agent
    const tailoredCvResult = await runCvTailorAgent({ profile, job });

    // Update Application Draft in DB
    const application = await upsertApplication(supabase, userId, jobId, {
      tailored_cv: tailoredCvResult.tailored_cv,
    });

    // If Google Drive folder is already set, upload tailored CV there
    if (application.drive_folder_id) {
      const googleAccessToken = await resolveGoogleAccessToken(supabase, userId);
      if (googleAccessToken) {
        try {
          await createGoogleDocFormatted(
            `Tailored CV - ${sanitizeDriveName(job.title)}`,
            tailoredCvResult.tailored_cv,
            application.drive_folder_id,
            googleAccessToken,
          );
        } catch (driveErr) {
          console.error("Failed to upload tailored CV to Google Drive:", driveErr);
        }
      }
    }

    // Track usage in usage_tracking
    await supabase.rpc("track_user_usage", {
      p_user_id: userId,
      p_action_type: "cv_tailoring",
      p_metadata: { jobId },
    });

    return new Response(JSON.stringify({ tailored_cv: tailoredCvResult.tailored_cv }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return errorResponse(err, "TailorCV", corsHeaders);
  }
});
