import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Create a Supabase client scoped to the calling user's JWT.
 * Use this for all user-authenticated operations (respects RLS).
 */
export function createUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/**
 * Create a Supabase admin client with service role key — bypasses RLS.
 * Only use for trusted server-side operations (e.g., scrape-cron).
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

/**
 * Extract the authenticated user ID from a request.
 * Throws if the token is invalid.
 */
export async function requireAuth(req: Request) {
  const supabase = createUserClient(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return { supabase, userId: user.id, user };
}
