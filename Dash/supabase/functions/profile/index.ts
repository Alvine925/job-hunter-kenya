import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/error-sanitizer.ts";
import { aiJson } from "../_shared/ai.ts";
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

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

    // ---- GET PROFILE ----
    if (action === "get") {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const [profileRes, usageRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase
          .from("usage_tracking")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("action_type", "cv_upload")
          .gte("created_at", startOfMonth),
      ]);
      if (profileRes.error) throw profileRes.error;
      const plan = profileRes.data?.current_plan;
      const cvUploadsLimit = plan === "upgraded" ? 4 : 2;
      return new Response(
        JSON.stringify({
          profile: profileRes.data,
          cv_uploads_this_month: usageRes.count ?? 0,
          cv_uploads_limit: cvUploadsLimit,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- UPDATE PROFILE ----
    if (action === "update") {
      const {
        full_name, phone, email, skills, professional_summary,
        work_history, education, desired_roles, preferred_county,
        linkedin_url, certifications, languages,
        notice_period, years_of_experience, minimum_salary,
      } = body;

      const patch: Record<string, any> = {};
      if (full_name !== undefined) patch.full_name = full_name;
      if (phone !== undefined) patch.phone = phone;
      if (email !== undefined) patch.email = email;
      if (skills !== undefined) patch.skills = skills;
      if (professional_summary !== undefined) patch.professional_summary = professional_summary;
      if (work_history !== undefined) patch.work_history = work_history;
      if (education !== undefined) patch.education = education;
      if (desired_roles !== undefined) patch.desired_roles = desired_roles;
      if (preferred_county !== undefined) patch.preferred_county = preferred_county;
      if (linkedin_url !== undefined) patch.linkedin_url = linkedin_url;
      if (certifications !== undefined) patch.certifications = certifications;
      if (languages !== undefined) patch.languages = languages;
      if (notice_period !== undefined) patch.notice_period = notice_period;
      if (years_of_experience !== undefined) patch.years_of_experience = years_of_experience;
      if (minimum_salary !== undefined) patch.minimum_salary = minimum_salary;

      const { data: upd, error } = await supabase
         .from("profiles")
         .update(patch)
         .eq("id", userId)
         .select()
         .single();
      if (error) throw error;
      return new Response(JSON.stringify({ profile: upd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- PARSE CV ----
    if (action === "parse-cv") {
      const { storage_path, file_name, cv_text } = body;
      if (!storage_path || !file_name) {
        throw new Error("Missing or invalid CV data");
      }

      // Check limits first!
      const { data: limitCheck, error: limitErr } = await supabase.rpc("check_user_limits", {
        p_user_id: userId,
        p_action_type: "cv_upload",
      });

      if (limitErr) {
        console.error("Limit check error:", limitErr);
      } else if (limitCheck && !limitCheck.allowed) {
        return new Response(JSON.stringify({ error: limitCheck.reason }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download the file from storage
      let parsedText = "";
      let ocrMethod = "none";

      try {
        console.log(`Downloading CV file from storage: ${storage_path}`);
        const { data: fileBlob, error: dlErr } = await supabase.storage
          .from("cvs")
          .download(storage_path);
        
        if (dlErr) throw dlErr;

        const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

        // 1. Enforce file size limit (10MB max)
        const maxFileSize = 10 * 1024 * 1024;
        if (fileBytes.length > maxFileSize) {
          await supabase.storage.from("cvs").remove([storage_path]);
          throw new Error("File exceeds the maximum size limit of 10MB");
        }

        // 2. Validate file signature (magic bytes)
        const header = fileBytes.slice(0, 4);
        const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46; // %PDF
        const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47; // PNG
        const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF; // JPEG
        const isZipOrDocx = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04; // PK (ZIP/DOCX)

        let mimeType = "application/octet-stream";
        if (isPdf) mimeType = "application/pdf";
        else if (isPng) mimeType = "image/png";
        else if (isJpeg) mimeType = "image/jpeg";
        else if (isZipOrDocx) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else {
          await supabase.storage.from("cvs").remove([storage_path]);
          throw new Error("Unsupported file type. Only PDF, DOCX, PNG, and JPEG formats are allowed.");
        }

        const base64 = encodeBase64(fileBytes);

        // --- FALLBACK 1: Google Cloud Vision OCR ---
        const visionKey = Deno.env.get("GOOGLE_VISION_API_KEY");
        if (visionKey && (mimeType.startsWith("image/") || mimeType === "application/pdf")) {
          try {
            console.log(`Running Fallback 1: Google Vision OCR for ${file_name} (${mimeType})...`);
            if (mimeType.startsWith("image/")) {
              const ocrRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  requests: [{
                    image: { content: base64 },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
                  }]
                })
              });
              if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                parsedText = ocrData.responses?.[0]?.fullTextAnnotation?.text ?? "";
                if (parsedText) ocrMethod = "google-vision-image";
                console.log(`Google Vision Image OCR extracted ${parsedText.length} characters.`);
              } else {
                console.warn(`Google Vision OCR failed: ${ocrRes.status} ${await ocrRes.text()}`);
              }
            } else if (mimeType === "application/pdf") {
              const ocrRes = await fetch(`https://vision.googleapis.com/v1/files:annotate?key=${visionKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  requests: [{
                    inputConfig: { content: base64, mimeType: "application/pdf" },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                    pages: [1, 2, 3, 4, 5]
                  }]
                })
              });
              if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                const texts = ocrData.responses?.[0]?.responses?.map((r: any) => r.fullTextAnnotation?.text).filter(Boolean);
                parsedText = texts?.join("\n") ?? "";
                if (parsedText) ocrMethod = "google-vision-pdf";
                console.log(`Google Vision PDF OCR extracted ${parsedText.length} characters.`);
              } else {
                console.warn(`Google Vision PDF OCR failed: ${ocrRes.status} ${await ocrRes.text()}`);
              }
            }
          } catch (e) {
            console.warn("Google Vision OCR exception occurred, proceeding to next fallback:", e);
          }
        }

        // --- FALLBACK 2: Client-side Extracted Text ---
        if (!parsedText || parsedText.trim().length < 20) {
          console.log("Fallback 1 skipped or failed. Trying Fallback 2: Client-side extracted text...");
          parsedText = cv_text || "";
          if (parsedText) ocrMethod = "client-extracted";
        }

        // --- FALLBACK 3: Multimodal AI Parsing (Gemini Flash) ---
        if (!parsedText || parsedText.trim().length < 20) {
          const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
          if (geminiKey && (mimeType.startsWith("image/") || mimeType === "application/pdf")) {
            try {
              console.log("Fallback 2 skipped or failed. Trying Fallback 3: Multimodal AI (Gemini) direct extraction...");
              const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
              const aiRes = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      { text: "Extract and write down all readable text from this document. Output only the extracted plain text verbatim, preserving headings and layout where possible. Do not add commentaries, explanations, or summaries." },
                      {
                        inlineData: {
                          mimeType: mimeType,
                          data: base64
                        }
                      }
                    ]
                  }]
                })
              });
              if (aiRes.ok) {
                const data = await aiRes.json();
                parsedText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
                if (parsedText) ocrMethod = "gemini-multimodal";
                console.log(`Gemini Multimodal OCR extracted ${parsedText.length} characters.`);
              } else {
                console.warn(`Gemini Multimodal OCR failed: ${aiRes.status} ${await aiRes.text()}`);
              }
            } catch (e) {
              console.warn("Gemini Multimodal OCR exception occurred, proceeding to next fallback:", e);
            }
          }
        }

        // --- FALLBACK 4: Remote Tesseract OCR (OCR.space API) ---
        if (!parsedText || parsedText.trim().length < 20) {
          try {
            console.log("Fallback 3 skipped or failed. Trying Fallback 4: Remote Tesseract (OCR.space API)...");
            const ocrSpaceKey = Deno.env.get("OCR_SPACE_API_KEY") || "helloworld";
            const dataUrl = `data:${mimeType};base64,${base64}`;
            
            const formData = new FormData();
            formData.append("apikey", ocrSpaceKey);
            formData.append("base64Image", dataUrl);
            formData.append("scale", "true");
            formData.append("detectOrientation", "true");
            
            const ocrSpaceRes = await fetch("https://api.ocr.space/parse/image", {
              method: "POST",
              body: formData
            });
            
            if (ocrSpaceRes.ok) {
              const data = await ocrSpaceRes.json();
              const textResult = data.ParsedResults?.map((r: any) => r.ParsedText).join("\n") ?? "";
              parsedText = textResult;
              if (parsedText) ocrMethod = "ocr-space-tesseract";
              console.log(`OCR.space Tesseract extracted ${parsedText.length} characters.`);
            } else {
              console.warn(`OCR.space Tesseract API failed: ${ocrSpaceRes.status} ${await ocrSpaceRes.text()}`);
            }
          } catch (e) {
            console.warn("OCR.space Tesseract exception occurred:", e);
          }
        }
      } catch (err) {
        console.warn("Storage download or OCR extraction error, will fallback:", err);
      }

      if (!parsedText || parsedText.length < 20) {
        throw new Error("No readable text found in CV file.");
      }

      // Sign URL for display
      const { data: signed } = await supabase.storage
        .from("cvs")
        .createSignedUrl(storage_path, 60 * 60 * 24 * 7);

      console.log(`Analyzing CV with AI (OCR Method: ${ocrMethod})...`);
      const extracted = await aiJson<{
        full_name?: string; email?: string; phone?: string; linkedin_url?: string;
        preferred_county?: string; skills?: string[]; recommended_skills?: string[];
        desired_roles?: string[]; recommended_roles?: string[];
        professional_summary?: string; work_history?: string; education?: string;
        certifications?: string; languages?: string;
      }>(
        `Extract structured profile data and matching suggestions from this CV/resume text.\n\nCV TEXT:\n${parsedText.slice(0, 30000)}\n\nReturn JSON with keys: full_name, email, phone, linkedin_url, preferred_county (Kenyan county if mentioned), skills (array of skills explicitly found in text), recommended_skills (array of 5-8 related skills they might also have but are not explicitly listed), desired_roles (array of probable target roles/job titles based on their experience), recommended_roles (array of 3-5 similar/related job titles they could apply for), professional_summary (2-3 sentence summary), work_history (multi-line string of roles), education (multi-line string), certifications (string), languages (string, formatted cleanly as a comma-separated list with proficiencies e.g., "English (Fluent), Kiswahili (Fluent)"). Use empty values if unknown.`,
        "You are a CV parser and career recommender. Return strict JSON only."
      );

      const update: Record<string, any> = {
        cv_storage_path: storage_path,
        cv_url: signed?.signedUrl ?? null,
        parsed_cv_text: parsedText.slice(0, 50000),
        cv_parsed_at: new Date().toISOString(),
      };

      // Only set extracted fields that have values
      const extractedFields = [
        "full_name", "email", "phone", "linkedin_url", "preferred_county",
        "professional_summary", "work_history", "education", "certifications", "languages",
      ];
      for (const key of extractedFields) {
        const val = (extracted as any)[key];
        if (val) update[key] = val;
      }
      if (extracted.skills?.length) update.skills = extracted.skills;
      if (extracted.desired_roles?.length) update.desired_roles = extracted.desired_roles;

      const { data: prof, error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Track usage log
      await supabase.rpc("track_user_usage", {
        p_user_id: userId,
        p_action_type: "cv_upload",
        p_metadata: { file_name, storage_path }
      });
      
      return new Response(JSON.stringify({ profile: prof, extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return errorResponse(err, "Profile", corsHeaders);
  }
});
