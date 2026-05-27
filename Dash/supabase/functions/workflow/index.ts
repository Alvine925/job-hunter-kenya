import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/supabase.ts";

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

    // ---- LIST WORKFLOWS (presets) ----
    if (action === "list") {
      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ workflows: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- GET WORKFLOW (by id, or active, or first) ----
    if (action === "get") {
      const { id } = body;
      let data = null;
      if (id) {
        const res = await supabase
          .from("workflows")
          .select("*")
          .eq("user_id", userId)
          .eq("id", id)
          .maybeSingle();
        if (res.error) throw res.error;
        data = res.data;
      } else {
        const activeRes = await supabase
          .from("workflows")
          .select("*")
          .eq("user_id", userId)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (activeRes.error) throw activeRes.error;
        data = activeRes.data;
        if (!data) {
          const fallback = await supabase
            .from("workflows")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (fallback.error) throw fallback.error;
          data = fallback.data;
        }
      }
      return new Response(JSON.stringify({ workflow: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- SET ACTIVE PRESET (only one active for scraping) ----
    if (action === "set-active") {
      const { id } = body;
      if (!id) throw new Error("Missing workflow id");
      await supabase.from("workflows").update({ active: false }).eq("user_id", userId);
      const { data: upd, error } = await supabase
        .from("workflows")
        .update({ active: true })
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ workflow: upd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- DELETE PRESET ----
    if (action === "delete") {
      const { id } = body;
      if (!id) throw new Error("Missing workflow id");
      const { data: allBefore } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", userId);
      if ((allBefore?.length ?? 0) <= 1) {
        throw new Error("Keep at least one configuration preset");
      }
      const { error } = await supabase
        .from("workflows")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      const { data: remaining } = await supabase
        .from("workflows")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      const hasActive = (remaining ?? []).some((w: { active: boolean }) => w.active);
      if (!hasActive && remaining?.length) {
        await supabase
          .from("workflows")
          .update({ active: true })
          .eq("id", remaining[0].id)
          .eq("user_id", userId);
        remaining[0].active = true;
      }
      return new Response(JSON.stringify({ workflows: remaining ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- UPSERT WORKFLOW ----
    if (action === "upsert") {
      const {
        id,
        name = "My Workflow",
        active = true,
        run_time = "08:00",
        run_days = ["mon", "tue", "wed", "thu", "fri"],
        target_roles = [],
        target_counties = [],
        target_companies = [],
        sources = [],
        job_types = [],
        min_match_score = 70,
        max_applications = 10,
        minimum_salary = null,
        cover_letter_tone = "Formal",
        auto_apply = false,
        application_mode = auto_apply ? "automatic" : "manual",
        google_access_token = null,
        google_refresh_token = null,
      } = body;

      // Enforce upgraded plan for automatic applications
      if (application_mode === "automatic" || auto_apply) {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("current_plan")
          .eq("id", userId)
          .single();
        if (profileErr || profile?.current_plan !== "upgraded") {
          throw new Error("Automatic job application requires an Upgraded plan. Refer 10 friends to unlock this feature.");
        }
      }

      const row = {
        user_id: userId,
        name,
        active,
        run_time,
        run_days,
        target_roles,
        target_counties,
        target_companies,
        sources,
        job_types,
        min_match_score,
        max_applications,
        minimum_salary,
        cover_letter_tone,
        auto_apply: application_mode === "automatic" || auto_apply,
        application_mode,
      };

      if (google_access_token || google_refresh_token) {
        const { error: tokenError } = await supabase
          .from("user_integrations")
          .upsert({
            user_id: userId,
            google_access_token,
            google_refresh_token,
            google_connected: true,
            google_scopes: [
              "https://www.googleapis.com/auth/gmail.send",
              "https://www.googleapis.com/auth/drive.file",
            ],
          });
        if (tokenError) throw tokenError;
      }

      if (id) {
        const { data: upd, error } = await supabase
          .from("workflows")
          .update(row)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ workflow: upd }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ins, error } = await supabase
        .from("workflows")
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ workflow: ins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
