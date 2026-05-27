/**
 * Shared error sanitizer for all edge functions.
 * Never leak raw internal error messages / stack traces to the client in production.
 *
 * Known "user-friendly" patterns are forwarded as-is; everything else is replaced
 * with a generic message while the raw detail is logged server-side only.
 */

/** Patterns that are safe to show end-users (case-insensitive substring match). */
const USER_FRIENDLY_PATTERNS = [
  "Missing",
  "not found",
  "limit",
  "Unauthorized",
  "Invalid",
  "required",
  "Complete your profile",
  "Keep at least one",
  "Upgraded plan",
  "locked",
  "Too many",
  "Unsupported file",
  "No readable text",
  "exceeds the maximum",
  "must start with",
  "Unknown action",
  "Email and password",
  "Security check",
  "Unauthorized recipient",
  "Failed to delete",
];

/** Check if an error message is safe to return to the client. */
function isUserFriendlyMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return USER_FRIENDLY_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

const GENERIC_ERROR = "An unexpected server error occurred. Please try again later.";

/**
 * Sanitize an error for client-facing responses.
 * Always returns a safe display message. Raw message is logged server-side.
 *
 * @param err The caught error
 * @param functionName Name of the edge function (for server-side logging)
 * @returns `{ displayMessage, rawMessage, status }` — use `displayMessage` in the response body
 */
export function sanitizeError(
  err: unknown,
  functionName: string,
): { displayMessage: string; rawMessage: string; status: number } {
  const rawMessage = err instanceof Error ? err.message : String(err);

  // Always log the raw error server-side for debugging
  console.error(`${functionName} error:`, err);

  // Rate-limit errors
  if (rawMessage.toLowerCase().includes("limit") || rawMessage.toLowerCase().includes("too many")) {
    return { displayMessage: rawMessage, rawMessage, status: 429 };
  }

  // Auth errors
  if (rawMessage.includes("Unauthorized")) {
    return { displayMessage: rawMessage, rawMessage, status: 401 };
  }

  // User-friendly errors pass through
  if (isUserFriendlyMessage(rawMessage)) {
    return { displayMessage: rawMessage, rawMessage, status: 400 };
  }

  // Everything else gets the generic message
  return { displayMessage: GENERIC_ERROR, rawMessage, status: 500 };
}

/**
 * Build a sanitized JSON error Response.
 * Drop-in replacement for the catch block in every edge function.
 */
export function errorResponse(
  err: unknown,
  functionName: string,
  corsHeaders: Record<string, string>,
): Response {
  const { displayMessage, status } = sanitizeError(err, functionName);
  return new Response(JSON.stringify({ error: displayMessage }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
