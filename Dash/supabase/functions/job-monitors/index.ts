import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, createAdminClient } from "../_shared/supabase.ts";
import { errorResponse } from "../_shared/error-sanitizer.ts";
import {
  isMonitorDueForScrape,
  scrapeJobMonitor,
  type JobMonitorRow,
} from "../_shared/scrape-monitors.ts";

function normalizeUrlInput(url: string) {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("URL must start with http:// or https://");
  }
  return trimmed;
}

async function getTemplate(supabase: any, userId: string, type: string) {
  const { data } = await supabase
    .from("templates")
    .select("content")
    .eq("user_id", userId)
    .eq("type", type)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.content ?? null;
}

async function profileSummaryForUser(supabase: any, userId: string, workflow: any) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!profile) throw new Error("Profile not found");

  const roles = workflow?.target_roles?.length
    ? workflow.target_roles
    : profile.desired_roles?.length
    ? profile.desired_roles
    : ["jobs"];

  return {
    profile,
    profileSummary: `Skills: ${(profile.skills ?? []).join(", ")}. Roles: ${roles.join(", ")}. Summary: ${profile.professional_summary ?? ""}.`,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    // ---- CRON: scrape all due monitors (service role) ----
    if (action === "cron-scrape-due") {
      const authHeader = req.headers.get("Authorization");
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (authHeader !== `Bearer ${anonKey}`) {
          throw new Error("Unauthorized");
        }
      }

      const admin = createAdminClient();
      const { data: monitors } = await admin
        .from("job_monitors")
        .select("*")
        .eq("active", true)
        .neq("scrape_frequency", "manual");

      let scraped = 0;
      let errors = 0;

      for (const monitor of monitors ?? []) {
        if (!isMonitorDueForScrape(monitor as JobMonitorRow)) continue;

        const { data: workflow } = await admin
          .from("workflows")
          .select("*")
          .eq("user_id", monitor.user_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        try {
          const { profileSummary } = await profileSummaryForUser(admin, monitor.user_id, workflow);
          const matchingTemplate = await getTemplate(admin, monitor.user_id, "job_matching");
          const result = await scrapeJobMonitor({
            catalogAdmin: admin,
            userSupabase: admin,
            userId: monitor.user_id,
            monitor: monitor as JobMonitorRow,
            profileSummary,
            matchingTemplate,
          });
          if (result.ok) scraped++;
          else errors++;
        } catch {
          errors++;
        }
      }

      return new Response(JSON.stringify({ ok: true, scraped, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabase, userId } = await requireAuth(req);
    const admin = createAdminClient();

    if (action === "list") {
      const { data, error } = await supabase
        .from("job_monitors")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ monitors: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { name, url, notes, scrape_frequency = "manual", active = true } = body;
      if (!name?.trim()) throw new Error("Name is required");
      const normalizedUrl = normalizeUrlInput(url);

      const { data, error } = await supabase
        .from("job_monitors")
        .insert({
          user_id: userId,
          name: name.trim(),
          url: normalizedUrl,
          notes: notes?.trim() || null,
          scrape_frequency,
          active,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ monitor: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { id, name, url, notes, scrape_frequency, active } = body;
      if (!id) throw new Error("Missing monitor id");

      const patch: Record<string, unknown> = {};
      if (name !== undefined) patch.name = String(name).trim();
      if (url !== undefined) patch.url = normalizeUrlInput(url);
      if (notes !== undefined) patch.notes = notes?.trim() || null;
      if (scrape_frequency !== undefined) patch.scrape_frequency = scrape_frequency;
      if (active !== undefined) patch.active = active;

      const { data, error } = await supabase
        .from("job_monitors")
        .update(patch)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ monitor: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { id } = body;
      if (!id) throw new Error("Missing monitor id");
      const { error } = await supabase
        .from("job_monitors")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "scrape" || action === "scrape-all") {
      const { monitorId } = body;
      const { data: workflow } = await supabase
        .from("workflows")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { profileSummary } = await profileSummaryForUser(supabase, userId, workflow);
      const matchingTemplate = await getTemplate(supabase, userId, "job_matching");

      let monitorsQuery = supabase
        .from("job_monitors")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true);

      if (action === "scrape" && monitorId) {
        monitorsQuery = monitorsQuery.eq("id", monitorId);
      }

      const { data: monitors, error: listErr } = await monitorsQuery;
      if (listErr) throw listErr;
      if (!monitors?.length) {
        throw new Error(monitorId ? "Monitor not found" : "No active monitors to scrape");
      }

      const results = [];
      for (const monitor of monitors) {
        results.push({
          monitorId: monitor.id,
          monitorName: monitor.name,
          ...(await scrapeJobMonitor({
            catalogAdmin: admin,
            userSupabase: supabase,
            userId,
            monitor: monitor as JobMonitorRow,
            profileSummary,
            matchingTemplate,
          })),
        });
      }

      const totalFound = results.reduce((s, r) => s + r.jobsFound, 0);
      const totalAttached = results.reduce((s, r) => s + r.jobsAttached, 0);

      return new Response(
        JSON.stringify({
          results,
          totalFound,
          totalAttached,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return errorResponse(err, "JobMonitors", corsHeaders);
  }
});
