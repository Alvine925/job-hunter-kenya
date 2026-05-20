import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { searchKenyaJobs } from "@/lib/firecrawl.server";
import { aiJson } from "@/lib/ai.server";

export const Route = createFileRoute("/api/public/hooks/scrape-cron")({
  server: {
    handlers: {
      POST: async () => {
        const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
        let total = 0;
        for (const profile of profiles ?? []) {
          try {
            const roles = profile.desired_roles?.length ? profile.desired_roles : null;
            if (!roles) continue;
            const counties = profile.preferred_county ? [profile.preferred_county] : ["Kenya"];
            const scraped = await searchKenyaJobs(roles, counties, 15);
            const urls = scraped.map((s) => s.source_url);
            const { data: existing } = await supabaseAdmin.from("jobs").select("source_url").eq("user_id", profile.id).in("source_url", urls);
            const have = new Set((existing ?? []).map((e: any) => e.source_url));
            const fresh = scraped.filter((s) => !have.has(s.source_url));
            const profileSummary = `Skills: ${(profile.skills ?? []).join(", ")}. Roles: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}.`;

            for (const job of fresh) {
              try {
                const analysis = await aiJson<any>(
                  `Analyze for candidate.\nCANDIDATE: ${profileSummary}\nJOB: ${job.title}\nCONTENT: ${(job.description ?? "").slice(0, 5000)}\nReturn JSON: match_score (0-100), match_reason, match_strengths, match_gaps, requirements, responsibilities, salary_text, job_type, company, location, county, application_email, contact_person, contact_phone.`,
                  "Output strict JSON."
                );
                await supabaseAdmin.from("jobs").insert({
                  user_id: profile.id,
                  title: job.title,
                  company: analysis.company ?? job.company,
                  location: analysis.location ?? job.location,
                  county: analysis.county ?? null,
                  description: job.description,
                  requirements: analysis.requirements ?? null,
                  responsibilities: analysis.responsibilities ?? null,
                  salary_text: analysis.salary_text ?? null,
                  job_type: analysis.job_type ?? null,
                  source: job.source,
                  source_url: job.source_url,
                  application_email: analysis.application_email ?? null,
                  contact_person: analysis.contact_person ?? null,
                  contact_phone: analysis.contact_phone ?? null,
                  match_score: analysis.match_score ?? 50,
                  match_reason: analysis.match_reason ?? null,
                  match_strengths: analysis.match_strengths ?? null,
                  match_gaps: analysis.match_gaps ?? null,
                  tracker_status: "new",
                });
                total++;
              } catch (e) { console.error("job analyze fail", e); }
            }
          } catch (e) { console.error("profile scrape fail", profile.id, e); }
        }
        return Response.json({ ok: true, inserted: total });
      },
    },
  },
});
