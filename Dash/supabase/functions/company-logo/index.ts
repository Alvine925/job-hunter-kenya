import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, createAdminClient } from "../_shared/supabase.ts";
import { resolveCompanyLogo } from "../_shared/logo-utils.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRole = authHeader.replace(/^Bearer\s+/i, "") === serviceRoleKey;

    const body = await req.json();
    const { bulk, company, jobId, listingId, scrapedJobId, theme, size } = body;

    // Determine authorization mode
    let supabaseClient;
    let userId = null;

    if (isServiceRole) {
      // Bypasses user-JWT auth since it is called securely by admin/CLI
      supabaseClient = createAdminClient();
      console.log("[company-logo] Authorized via Service Role Key");
    } else {
      // Standard user auth
      const auth = await requireAuth(req);
      supabaseClient = auth.supabase;
      userId = auth.userId;
      console.log(`[company-logo] Authorized via User JWT (${userId})`);
    }

    const admin = createAdminClient();

    // -------------------------------------------------------------------------
    // BULK LOGO RESOLVER WORKFLOW
    // -------------------------------------------------------------------------
    if (bulk === true) {
      console.log("[bulk-logo] Initiating bulk logo resolution...");
      
      const stats = {
        jobsUpdated: 0,
        listingsUpdated: 0,
        scrapedUpdated: 0,
      };

      // 1. Resolve User Jobs (logo_url is null or empty)
      // If service-role, query ALL jobs with null logos; if user, query only theirs
      let jobsQuery = supabaseClient
        .from("jobs")
        .select("id, company")
        .or("logo_url.is.null,logo_url.eq.");
      
      if (!isServiceRole && userId) {
        jobsQuery = jobsQuery.eq("user_id", userId);
      }

      const { data: jobsToUpdate, error: jobsErr } = await jobsQuery.limit(100);

      if (jobsErr) {
        console.error("[bulk-logo] Failed to query user jobs:", jobsErr);
      } else if (jobsToUpdate && jobsToUpdate.length > 0) {
        console.log(`[bulk-logo] Processing ${jobsToUpdate.length} user jobs...`);
        for (const job of jobsToUpdate) {
          if (!job.company) continue;
          try {
            const { logoUrl } = await resolveCompanyLogo(job.company.trim());
            if (logoUrl) {
              await admin
                .from("jobs")
                .update({ logo_url: logoUrl })
                .eq("id", job.id);
              stats.jobsUpdated++;
            }
          } catch (e) {
            console.error(`[bulk-logo] Failed for job ${job.id}:`, e);
          }
        }
      }

      // 2. Resolve Shared Job Catalog Listings (logo_url is null or empty)
      const { data: listingsToUpdate, error: listingsErr } = await admin
        .from("job_listings")
        .select("id, company")
        .or("logo_url.is.null,logo_url.eq.")
        .limit(100);

      if (listingsErr) {
        console.error("[bulk-logo] Failed to query job listings:", listingsErr);
      } else if (listingsToUpdate && listingsToUpdate.length > 0) {
        console.log(`[bulk-logo] Processing ${listingsToUpdate.length} catalog listings...`);
        for (const listing of listingsToUpdate) {
          if (!listing.company) continue;
          try {
            const { logoUrl } = await resolveCompanyLogo(listing.company.trim());
            if (logoUrl) {
              await admin
                .from("job_listings")
                .update({ logo_url: logoUrl })
                .eq("id", listing.id);
              stats.listingsUpdated++;
            }
          } catch (e) {
            console.error(`[bulk-logo] Failed for listing ${listing.id}:`, e);
          }
        }
      }

      // 3. Resolve Scraped Marketplace Jobs (logo_url is null or empty)
      const { data: scrapedToUpdate, error: scrapedErr } = await admin
        .from("scraped_jobs")
        .select("id, company")
        .or("logo_url.is.null,logo_url.eq.")
        .limit(100);

      if (scrapedErr) {
        console.error("[bulk-logo] Failed to query scraped jobs:", scrapedErr);
      } else if (scrapedToUpdate && scrapedToUpdate.length > 0) {
        console.log(`[bulk-logo] Processing ${scrapedToUpdate.length} scraped marketplace jobs...`);
        for (const scraped of scrapedToUpdate) {
          if (!scraped.company) continue;
          try {
            const { logoUrl } = await resolveCompanyLogo(scraped.company.trim());
            if (logoUrl) {
              await admin
                .from("scraped_jobs")
                .update({ logo_url: logoUrl })
                .eq("id", scraped.id);
              stats.scrapedUpdated++;
            }
          } catch (e) {
            console.error(`[bulk-logo] Failed for scraped job ${scraped.id}:`, e);
          }
        }
      }

      console.log("[bulk-logo] Completed bulk run successfully:", stats);
      return new Response(JSON.stringify({ success: true, stats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------------
    // SINGLE LOGO RESOLVER WORKFLOW (DEFAULT)
    // -------------------------------------------------------------------------
    if (!company || !company.trim()) {
      throw new Error("Missing company name in request body");
    }

    // Use the async Brand Search resolver for accurate domain matching
    const { domain, logoUrl } = await resolveCompanyLogo(company.trim(), {
      size: size || 128,
      format: "png",
      theme: theme === "dark" ? "dark" : "light",
      retina: true,
      fallback: "monogram",
    });

    const result: Record<string, unknown> = { logoUrl, domain };

    // Update specific record if ID is provided
    if (jobId) {
      let query = supabaseClient
        .from("jobs")
        .update({ logo_url: logoUrl })
        .eq("id", jobId);
      
      if (!isServiceRole && userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.select().single();

      if (error) {
        console.error(`Failed to update logo for job ${jobId}:`, error);
        throw error;
      }
      result.job = data;
    }

    if (listingId) {
      const { data, error } = await admin
        .from("job_listings")
        .update({ logo_url: logoUrl })
        .eq("id", listingId)
        .select()
        .single();

      if (error) {
        console.error(`Failed to update logo for listing ${listingId}:`, error);
        throw error;
      }
      result.listing = data;
    }

    if (scrapedJobId) {
      const { data, error } = await admin
        .from("scraped_jobs")
        .update({ logo_url: logoUrl })
        .eq("id", scrapedJobId)
        .select()
        .single();

      if (error) {
        console.error(`Failed to update logo for scraped_job ${scrapedJobId}:`, error);
        throw error;
      }
      result.scrapedJob = data;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
