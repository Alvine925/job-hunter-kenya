// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.
// Also automatically logs all client-side exceptions to the database.

import { supabase } from "../integrations/supabase/client";

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;
let isReporting = false; // Prevent infinite error reporting recursion

async function reportErrorToDatabase(error: unknown) {
  if (typeof window === "undefined" || isReporting) return;
  isReporting = true;

  try {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    const currentUrl = window.location.href;

    // Fetch user details silently
    const authUser = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const userId = authUser?.data?.user ? authUser.data.user.id : null;

    // Silently log error to Supabase
    await supabase.from("error_reports" as any).insert({
      user_id: userId,
      error_message: errMessage,
      error_stack: errStack || null,
      section: "Browser Interface",
      action_context: `Triggered at ${currentUrl}`,
      user_description: "Automatically captured global browser exception."
    });
  } catch (reportingErr) {
    // Fail silently in background to avoid any console loops or user disruption
  } finally {
    isReporting = false;
  }
}

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };

  // Background report client-side runtime errors
  if (typeof window !== "undefined" && error) {
    void reportErrorToDatabase(error);
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
