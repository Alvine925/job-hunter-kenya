import { supabase } from "@/integrations/supabase/client";
import { applicationStatusFromRow } from "@/lib/job-list-utils";
import { resetAuthReady, waitForAuthSession, persistSessionToStorage } from "@/lib/auth-session";

function invokeErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const ctx = (error as { context?: { status?: number; Response?: { status?: number } } }).context;
  if (typeof ctx?.status === "number") return ctx.status;
  if (typeof ctx?.Response?.status === "number") return ctx.Response.status;
  return undefined;
}

function formatInvokeError(functionName: string, error: unknown): Error {
  const status = invokeErrorStatus(error);
  if (status === 404) {
    return new Error(
      `Edge function "${functionName}" returned 404. Redeploy it: supabase functions deploy ${functionName} --project-ref eqkctzjyqmafpytvdepf --no-verify-jwt`,
    );
  }
  if (status != null) {
    return new Error(
      `Edge function "${functionName}" failed (${status}). Check Supabase → Edge Functions → Logs.`,
    );
  }
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function parseInvokePayload(data: unknown): { error?: string; message?: string } | null {
  if (!data || typeof data !== "object") return null;
  return data as { error?: string; message?: string };
}

async function readInvokeErrorBody(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const ctx = (error as { context?: Response | { json?: () => Promise<unknown> } }).context;
  if (!ctx) return null;

  const parsePayload = (parsed: unknown): string | null => {
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as { error?: string; message?: string };
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    return null;
  };

  if (ctx instanceof Response) {
    try {
      return parsePayload(await ctx.json());
    } catch {
      try {
        const text = await ctx.text();
        if (!text) return null;
        try {
          return parsePayload(JSON.parse(text));
        } catch {
          return text.slice(0, 500);
        }
      } catch {
        return null;
      }
    }
  }

  if (typeof ctx.json === "function") {
    try {
      return parsePayload(await ctx.json());
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function invokeFunction<T = unknown>(functionName: string, body: Record<string, unknown>) {
  const action = typeof body.action === "string" ? body.action : "";
  const session = await ensureSession();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  const res = parseInvokePayload(data);

  if (error) {
    const fromBody = await readInvokeErrorBody(error);
    const serverMessage =
      fromBody ?? (typeof res?.error === "string" ? res.error : null);
    if (serverMessage) {
      const label = action ? `${functionName}/${action}` : functionName;
      console.error(`[${label}] ${serverMessage}`);
      throw new Error(serverMessage);
    }
    throw formatInvokeError(functionName, error);
  }

  if (typeof res?.error === "string") throw new Error(res.error);

  return data as T;
}

async function invokePublicFunction<T = unknown>(functionName: string, body: Record<string, unknown>) {
  const action = typeof body.action === "string" ? body.action : "";
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });
  const res = parseInvokePayload(data);

  if (error) {
    const fromBody = await readInvokeErrorBody(error);
    const serverMessage =
      fromBody ?? (typeof res?.error === "string" ? res.error : null);
    if (serverMessage) {
      const label = action ? `${functionName}/${action}` : functionName;
      console.error(`[${label}] ${serverMessage}`);
      throw new Error(serverMessage);
    }
    throw formatInvokeError(functionName, error);
  }

  if (typeof res?.error === "string") throw new Error(res.error);

  return data as T;
}

async function ensureSession() {
  // Fast path
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    console.error("[auth] getSession error:", error);
    throw error;
  }
  
  if (session?.access_token) {
    try {
      // Decode JWT payload to check expiration
      const payload = JSON.parse(atob(session.access_token.split(".")[1]));
      const isExpired = payload.exp * 1000 < Date.now() + 10000; // 10s buffer
      if (!isExpired) {
        return session;
      }
      console.log("[auth] Access token expired or close to expiration, forcing refresh...");
    } catch (e) {
      console.warn("[auth] Failed to parse JWT payload:", e);
    }
  } else {
    console.warn("[auth] No session or access_token found");
  }

  // Force token refresh by calling refreshSession
  try {
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("[auth] refreshSession failed:", refreshError);
    } else if (refreshedSession?.access_token) {
      console.log("[auth] Token refreshed successfully");
      return refreshedSession;
    }
  } catch (e) {
    console.error("[auth] Exception during refreshSession:", e);
  }

  // Fallback: try getUser() which also refreshes
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("[auth] getUser failed:", userError);
    } else if (user) {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (freshSession?.access_token) {
        console.log("[auth] Got fresh session via getUser");
        return freshSession;
      }
    }
  } catch (e) {
    console.error("[auth] Exception during getUser:", e);
  }

  // One-time re-sync: occasionally hydration lags right after setSession
  resetAuthReady();
  try {
    const s = await waitForAuthSession();
    if (s?.access_token) {
      console.log("[auth] Got session via waitForAuthSession");
      return s;
    }
  } catch (e) {
    console.error("[auth] waitForAuthSession failed:", e);
  }

  throw new Error("Your session expired. Please sign in again.");
}


// ---- AUTH ----
/**
 * Sign in via Edge Function to enforce lockout/rate limiting.
 * Falls back to native signInWithPassword if the Edge Function is
 * unavailable (not deployed, cold-start resource limit, etc.).
 */
export async function loginWithPassword(email: string, password: string) {
  let edgeFnAvailable = true;
  let res: any;

  try {
    res = await invokePublicFunction<any>("login", { email, password });
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    // 546 = WORKER_RESOURCE_LIMIT, 404 = not deployed, FetchError = network issue
    const isFunctionDown =
      msg.includes("546") ||
      msg.includes("404") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("not deployed") ||
      msg.includes("WORKER_RESOURCE_LIMIT");
    if (!isFunctionDown) throw err; // re-throw real errors (wrong password etc)
    edgeFnAvailable = false;
  }

  if (edgeFnAvailable) {
    const session = res?.session;
    if (!session?.access_token || !session?.refresh_token) {
      throw new Error("Login failed: No session returned");
    }
    const { error: setErr } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setErr) throw setErr;
    
    // Wait for the session listener to fire and cache the session
    await new Promise(resolve => setTimeout(resolve, 50));
    resetAuthReady();
    return { user: res?.user } as { user: unknown };
  }

  // Fallback: Edge Function unavailable — use native Supabase auth
  // (rate limiting / lockout won't apply in this path)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  
  // Wait for the session listener to fire and cache the session
  await new Promise(resolve => setTimeout(resolve, 50));
  resetAuthReady();
  return { user: data.user } as { user: unknown };
}

// Helper to get Google access token from the session
async function getGoogleToken(): Promise<string | null> {
  const session = await ensureSession();
  return session.provider_token ?? null;
}

async function getGoogleRefreshToken(): Promise<string | null> {
  const session = await ensureSession();
  return session.provider_refresh_token ?? null;
}

// ---- JOBS ----
export async function scrapeJobsForMe(args: { limit?: number; data?: { limit?: number } } = {}) {
  const limit = args.data?.limit ?? args.limit;
  const token = await getGoogleToken();
  return invokeFunction("jobs", { action: "scrape", limit, google_access_token: token });
}

/**
 * Drop search-result/LinkedIn-aggregator junk. Mirrors the `isLowQualityJob`
 * check used by the `jobs` edge function so client and server agree on what
 * shows up in the marketplace.
 */
function isLowQualityJob(job: {
  title?: string | null;
  company?: string | null;
  source_url?: string | null;
}): boolean {
  const title = (job.title ?? "").trim();
  const company = (job.company ?? "").trim();
  const url = job.source_url ?? "";

  if (!title) return true;
  if (/^\d+\+?\s+.+\bjobs?\b/i.test(title)) return true;
  if (/\bjobs?\s+in\s+(kenya|nairobi|mombasa)/i.test(title)) return true;
  if (/\b(aggregated|various)\b/i.test(title)) return true;
  if (/\s-\s+linkedin\s*$/i.test(title) && !/\bat\s+/i.test(title)) return true;

  if (company && /various|aggregated|linkedin search|not specified|unknown employer/i.test(company)) {
    return true;
  }

  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes("linkedin.com")) {
        const path = new URL(url).pathname;
        const isJobView = /\/jobs\/view\/\d+/i.test(path);
        if (!isJobView) return true;
        if (!company) return true;
      }
    } catch {
      return true;
    }
  } else {
    return true;
  }

  return false;
}

/**
 * Load jobs saved/matched for this user. Direct PostgREST query — replaces the
 * previous edge-function call, which had multi-second cold starts.
 */
export async function listJobs(): Promise<{ jobs: Record<string, unknown>[] }> {
  const session = await ensureSession();
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  const [jobsRes, appsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .eq("user_id", userId)
      .or(`deadline.is.null,deadline.gte.${today}`)
      .order("match_score", { ascending: false })
      .limit(200),
    supabase
      .from("applications")
      .select(
        "job_id, status, cover_letter, pack_questions, interview_questions, email_body, email_subject, prepared_at, drive_url",
      )
      .eq("user_id", userId),
  ]);

  if (jobsRes.error) throw new Error(jobsRes.error.message);
  if (appsRes.error) throw new Error(appsRes.error.message);

  const appByJob = new Map<string, Record<string, unknown>>();
  for (const a of (appsRes.data ?? []) as Array<Record<string, unknown>>) {
    appByJob.set(String(a.job_id), a);
  }

  const filtered = (jobsRes.data ?? []).filter((j: Record<string, unknown>) =>
    !isLowQualityJob({
      title: j.title as string | null,
      company: j.company as string | null,
      source_url: j.source_url as string | null,
    }),
  );

  const jobs = filtered.map((j: Record<string, unknown>) => ({
    ...j,
    application_status: applicationStatusFromRow(
      (appByJob.get(String(j.id)) ?? null) as Parameters<typeof applicationStatusFromRow>[0],
    ),
  }));

  return { jobs };
}

export async function getJob(args: { id: string; data?: { id: string } }) {
  const id = args.data?.id ?? args.id;
  return invokeFunction<{
    job: Record<string, any>;
    application: Record<string, any> | null;
    similar_jobs: Record<string, any>[];
  }>("jobs", { action: "get", id });
}

export async function loadJobCoachChat(jobId: string) {
  await ensureSession();
  const { data: res, error } = await supabase.functions.invoke("jobs", {
    body: { action: "job-coach-load", jobId },
  });
  if (error) throw error;
  if (res?.error) throw new Error(res.error);
  return res as {
    messages: {
      id: string;
      role: "user" | "assistant";
      content: string;
      similar_jobs?: { id: string; title: string; company: string | null; match_score: number | null }[] | null;
      created_at: string;
    }[];
    greeting: string;
  };
}

export type InterviewQa = { question: string; answer: string };

export type InterviewSession = {
  mode: "chat" | "voice";
  status: "in_progress" | "complete";
  flow?: "coach";
  phase?: string;
  exchange_count?: number;
  recruiter_name?: string;
  current_index?: number;
  questions?: InterviewQa[];
  answers: {
    question: string;
    user_answer: string;
    score: number;
    feedback: string;
  }[];
  started_at: string;
  completed_at?: string;
};

export type InterviewReport = {
  overall_score: number;
  summary: string;
  strengths: string[];
  areas_to_improve: string[];
  recommendations: string[];
  question_breakdown: {
    question: string;
    score: number;
    feedback: string;
    user_answer: string;
  }[];
  generated_at: string;
};

export async function loadInterviewState(jobId: string) {
  await ensureSession();
  return invokeFunction<{
    prep_questions: InterviewQa[];
    session: InterviewSession | null;
    report: InterviewReport | null;
    messages?: { id?: string; role: string; content: string }[];
    recruiter_name?: string | null;
    current_question: InterviewQa | null;
    question_number: number;
    total_questions: number;
  }>("jobs", { action: "interview-load", jobId });
}

export async function startInterviewQuiz(args: { jobId: string; mode: "chat" | "voice" }) {
  await ensureSession();
  return invokeFunction<{
    session: InterviewSession;
    messages: { id?: string; role: string; content: string }[];
    opening_message?: { role: string; content: string };
    recruiter_name: string;
    interview_complete: boolean;
    current_question: InterviewQa | null;
    question_number: number;
    total_questions: number;
  }>("jobs", { action: "interview-start", jobId: args.jobId, mode: args.mode });
}

export async function submitInterviewAnswer(args: { jobId: string; answer: string }) {
  await ensureSession();
  return invokeFunction<{
    session: InterviewSession;
    message: { role: string; content: string };
    messages: { id?: string; role: string; content: string }[];
    scored: { question: string; user_answer: string; score: number; feedback: string };
    interview_complete: boolean;
    current_question: InterviewQa | null;
    question_number: number;
    total_questions: number;
  }>("jobs", { action: "interview-submit-answer", jobId: args.jobId, answer: args.answer });
}

export async function generateInterviewReport(jobId: string) {
  await ensureSession();
  return invokeFunction<{ report: InterviewReport; session: InterviewSession }>("jobs", {
    action: "interview-generate-report",
    jobId,
  });
}

export async function resetInterviewQuiz(jobId: string) {
  await ensureSession();
  return invokeFunction("jobs", { action: "interview-reset", jobId });
}

export async function jobCoachChat(args: {
  jobId: string;
  userMessage: string;
  messages: { role: "user" | "assistant"; content: string }[];
}) {
  await ensureSession();
  const { data: res, error } = await supabase.functions.invoke("jobs", {
    body: {
      action: "job-coach-chat",
      jobId: args.jobId,
      userMessage: args.userMessage,
      messages: args.messages,
    },
  });
  if (error) throw error;
  if (res?.error) throw new Error(res.error);
  return res as {
    message: {
      id: string;
      role: string;
      content: string;
      similar_jobs?: { id: string; title: string; company: string | null; match_score: number | null }[] | null;
    };
    similar_jobs: { id: string; title: string; company: string | null; match_score: number | null }[];
  };
}

/** Toggle bookmark on a user job (sets or clears saved_at). */
export async function toggleSaveJob(jobId: string) {
  await ensureSession();
  const { data: row, error: fetchErr } = await supabase
    .from("jobs")
    .select("saved_at")
    .eq("id", jobId)
    .single();
  if (fetchErr) throw fetchErr;
  const saving = !row?.saved_at;
  const { error } = await supabase
    .from("jobs")
    .update({ saved_at: saving ? new Date().toISOString() : null })
    .eq("id", jobId);
  if (error) throw error;
  return { saved: saving };
}

/** Jobs the user bookmarked via Save on the detail page. */
export async function listSavedJobs() {
  await ensureSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const [{ data, error }, { data: applications }] = await Promise.all([
    supabase
      .from("jobs")
      .select("*")
      .not("saved_at", "is", null)
      .order("saved_at", { ascending: false })
      .limit(200),
    supabase
      .from("applications")
      .select(
        "job_id, status, cover_letter, pack_questions, interview_questions, email_body, email_subject, prepared_at, drive_url",
      )
      .eq("user_id", user.id),
  ]);
  if (error) throw error;

  const appByJob = new Map((applications ?? []).map((a) => [a.job_id, a]));

  const jobs = (data ?? []).map((j) => ({
    ...j,
    application_status: applicationStatusFromRow(appByJob.get(j.id) ?? null),
  }));

  return { jobs };
}

/** Marketplace listing → import/match into user jobs, same payload shape as getJob. */
export async function getMarketplaceJob(scrapedJobId: string) {
  return invokeFunction<{
    job: Record<string, unknown>;
    application: Record<string, unknown> | null;
    similar_jobs: Record<string, unknown>[];
    scraped_job_id: string;
  }>("jobs", { action: "get-scraped", scrapedJobId });
}

/** Signed URL to preview the user's uploaded CV in storage. */
export async function getCvPreviewUrl(): Promise<{ url: string; fileName: string } | null> {
  await ensureSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("cv_storage_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!prof?.cv_storage_path) return null;
  const fileName = prof.cv_storage_path.split("/").pop() ?? "CV";
  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(prof.cv_storage_path, 3600);
  if (error || !data?.signedUrl) return null;
  return { url: data.signedUrl, fileName };
}

// ---- APPLICATIONS ----
export async function generateAndSaveLetter(args: { jobId: string; tone?: string; data?: { jobId: string; tone?: string } }) {
  const payload = args.data ?? args;
  const token = await getGoogleToken();
  return invokeFunction<{ application: Record<string, any> }>("applications", {
    action: "generate-letter",
    jobId: payload.jobId,
    tone: payload.tone,
    google_access_token: token,
  });
}

export type InterviewPrepResult = {
  application: {
    id: string;
    interview_questions: string | null;
    job_id?: string | null;
    [key: string]: unknown;
  };
};

export async function generateInterviewQuestions(args: { jobId: string; data?: { jobId: string } }) {
  const payload = args.data ?? args;
  return invokeFunction<InterviewPrepResult>("applications", {
    action: "generate-interview-questions",
    jobId: payload.jobId,
  });
}

export async function generateApplicationPack(args: { jobId: string; data?: { jobId: string } }) {
  const payload = args.data ?? args;
  const token = await getGoogleToken();
  return invokeFunction("applications", {
    action: "generate-pack",
    jobId: payload.jobId,
    google_access_token: token,
  });
}

export async function updateApplicationDraft(args: {
  applicationId: string;
  email_subject?: string;
  email_body?: string;
  cover_letter?: string;
  application_email?: string;
  data?: {
    applicationId: string;
    email_subject?: string;
    email_body?: string;
    cover_letter?: string;
    application_email?: string;
  };
}) {
  const payload = args.data ?? args;
  return invokeFunction("applications", { action: "update-draft", ...payload });
}

export async function saveApplicationPackToDrive(args: {
  applicationId: string;
  email_subject?: string;
  email_body?: string;
  cover_letter?: string;
  data?: {
    applicationId: string;
    email_subject?: string;
    email_body?: string;
    cover_letter?: string;
  };
}) {
  const payload = args.data ?? args;
  const token = await getGoogleToken();
  return invokeFunction<{
    application: Record<string, unknown>;
    folderUrl: string;
    folderName: string;
  }>("applications", {
    action: "save-pack-to-drive",
    google_access_token: token,
    ...payload,
  });
}

export async function sendApplicationEmail(args: {
  applicationId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  includeCv?: boolean;
  data?: {
    applicationId: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    includeCv?: boolean;
  };
}) {
  const payload = args.data ?? args;
  const token = await getGoogleToken();
  return invokeFunction("applications", {
    action: "send-email",
    ...payload,
    google_access_token: token,
  });
}

// ---- PROFILE ----
export async function getMyProfile() {
  return invokeFunction<{
    profile: Record<string, unknown>;
    cv_uploads_this_month: number;
    cv_uploads_limit: number;
  }>("profile", { action: "get" });
}

export async function updateMyProfile(args: {
  full_name?: string;
  phone?: string;
  email?: string;
  skills?: string[];
  professional_summary?: string;
  work_history?: string;
  education?: string;
  desired_roles?: string[];
  preferred_county?: string;
  linkedin_url?: string;
  certifications?: string;
  languages?: string;
  notice_period?: string | null;
  years_of_experience?: string | null;
  minimum_salary?: number | null;
  data?: {
    full_name?: string;
    phone?: string;
    email?: string;
    skills?: string[];
    professional_summary?: string;
    work_history?: string;
    education?: string;
    desired_roles?: string[];
    preferred_county?: string;
    linkedin_url?: string;
    certifications?: string;
    languages?: string;
    notice_period?: string | null;
    years_of_experience?: string | null;
    minimum_salary?: number | null;
  };
}) {
  const payload = args.data ?? args;
  return invokeFunction("profile", { action: "update", ...payload });
}

export interface CvExtracted {
  skills?: string[];
  recommended_skills?: string[];
  desired_roles?: string[];
  recommended_roles?: string[];
  full_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  preferred_county?: string;
  professional_summary?: string;
  work_history?: string;
  education?: string;
  certifications?: string;
  languages?: string;
}

export async function saveCvAndExtract(args: {
  storage_path: string;
  file_name: string;
  cv_text: string;
  data?: {
    storage_path: string;
    file_name: string;
    cv_text: string;
  };
}) {
  const payload = args.data ?? args;
  return invokeFunction<{ profile: Record<string, unknown>; extracted: CvExtracted }>(
    "profile",
    { action: "parse-cv", ...payload }
  );
}

export async function checkCvUploadLimit(): Promise<{ allowed: boolean; reason: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("check_user_limits", {
    p_user_id: user.id,
    p_action_type: "cv_upload",
  });
  if (error) throw error;
  return (data ?? { allowed: true, reason: "" }) as { allowed: boolean; reason: string };
}

// ---- JOB MONITORS ----
export type JobMonitorFrequency = "manual" | "daily" | "weekly";

export async function listJobMonitors() {
  return invokeFunction("job-monitors", { action: "list" });
}

export async function createJobMonitor(args: {
  name: string;
  url: string;
  notes?: string;
  scrape_frequency?: JobMonitorFrequency;
  active?: boolean;
}) {
  return invokeFunction("job-monitors", { action: "create", ...args });
}

export async function updateJobMonitor(args: {
  id: string;
  name?: string;
  url?: string;
  notes?: string;
  scrape_frequency?: JobMonitorFrequency;
  active?: boolean;
}) {
  return invokeFunction("job-monitors", { action: "update", ...args });
}

export async function deleteJobMonitor(id: string) {
  return invokeFunction("job-monitors", { action: "delete", id });
}

export async function scrapeJobMonitors() {
  return invokeFunction("job-monitors", { action: "scrape-all" });
}

export async function scrapeOneJobMonitor(monitorId: string) {
  return invokeFunction("job-monitors", { action: "scrape", monitorId });
}

// ---- WORKFLOW ----
export async function listWorkflows() {
  return invokeFunction<{ workflows: Record<string, unknown>[] }>("workflow", { action: "list" });
}

export async function getMyWorkflow(id?: string) {
  return invokeFunction("workflow", { action: "get", id });
}

export async function setActiveWorkflow(id: string) {
  return invokeFunction("workflow", { action: "set-active", id });
}

export async function deleteWorkflow(id: string) {
  return invokeFunction<{ workflows: Record<string, unknown>[] }>("workflow", { action: "delete", id });
}

export async function upsertWorkflow(args: { data: {
  id?: string;
  name?: string;
  active?: boolean;
  run_time?: string;
  run_days?: string[];
  target_roles?: string[];
  target_counties?: string[];
  target_companies?: string[];
  sources?: string[];
  job_types?: string[];
  min_match_score?: number;
  max_applications?: number;
  minimum_salary?: number | null;
  cover_letter_tone?: string;
  auto_apply?: boolean;
  application_mode?: "manual" | "automatic";
}}) {
  const google_access_token = await getGoogleToken();
  const google_refresh_token = await getGoogleRefreshToken();
  return invokeFunction("workflow", {
    action: "upsert",
    ...args.data,
    google_access_token,
    google_refresh_token,
  });
}

// ---- TEMPLATES ----
export type AgentTemplateType =
  | "job_matching"
  | "cover_letter"
  | "email_body"
  | "form_response";

export async function listAgentTemplates() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  // RLS also restricts rows to auth.uid(); explicit user_id is defense in depth.
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", user.id)
    .in("type", ["job_matching", "cover_letter", "email_body", "form_response"])
    .order("type", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { templates: data ?? [] };
}

export async function saveAgentTemplate(args: {
  type: AgentTemplateType;
  name: string;
  content: string;
  data?: {
    type: AgentTemplateType;
    name: string;
    content: string;
  };
}) {
  const payload = args.data ?? args;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const { data: existing, error: findError } = await supabase
    .from("templates")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", payload.type)
    .eq("is_default", true)
    .maybeSingle();
  if (findError) throw findError;

  const row = {
    user_id: user.id,
    name: payload.name,
    type: payload.type,
    category: "Agent",
    tone: "Default",
    content: payload.content,
    is_default: true,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("templates")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return { template: data };
  }

  const { data, error } = await supabase
    .from("templates")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return { template: data };
}
