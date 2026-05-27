import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuth, createAdminClient } from "../_shared/supabase.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      throw new Error("Action is required");
    }

    const admin = createAdminClient();

    if (action === "export") {
      const dataExport: Record<string, unknown> = {};
      const tables = [
        "profiles",
        "jobs",
        "applications",
        "templates",
        "workflows",
        "notifications",
        "user_integrations",
        "job_monitors",
        "sent_emails",
      ];

      for (const table of tables) {
        let query = admin.from(table).select("*");
        if (table === "profiles") {
          query = query.eq("id", userId);
        } else {
          query = query.eq("user_id", userId);
        }
        const { data, error } = await query;
        if (error) {
          console.error(`Error exporting table ${table}:`, error);
        } else {
          dataExport[table] = data || [];
        }
      }

      return new Response(JSON.stringify(dataExport), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // 1. Delete CV files from storage
      console.log(`Deleting files for user ${userId} from storage...`);
      const { data: files, error: listErr } = await admin.storage
        .from("cvs")
        .list(userId);

      if (listErr) {
        console.error(`Error listing CV files for user ${userId}:`, listErr);
      } else if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        const { error: removeErr } = await admin.storage
          .from("cvs")
          .remove(filePaths);
        if (removeErr) {
          console.error(`Error deleting files for user ${userId}:`, removeErr);
        }
      }

      // 2. Delete user from auth (this cascades to tables with ON DELETE CASCADE)
      console.log(`Deleting user auth record for ${userId}...`);
      const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
      if (deleteErr) {
        throw new Error(`Failed to delete account: ${deleteErr.message}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("Account edge function error:", err);
    // Sanitize error messages
    const isUserFriendly =
      rawMessage.includes("Missing") ||
      rawMessage.includes("not found") ||
      rawMessage.includes("Unauthorized") ||
      rawMessage.includes("Failed to delete");
    const displayMessage = isUserFriendly ? rawMessage : "An unexpected server error occurred.";
    return new Response(JSON.stringify({ error: displayMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
