import { aiJson } from "./ai.ts";
import { createAdminClient } from "./supabase.ts";
import { discoverJobListings, type JobListingRow } from "./job-catalog.ts";
import { DEFAULT_JOB_SOURCES } from "./job-sources.ts";
import { todayIsoDate } from "./parse-deadline.ts";

export type CoachSimilarJob = {
  id: string;
  title: string;
  company: string | null;
  match_score: number | null;
};

type CoachAiReply = {
  reply: string;
  find_similar?: boolean;
  search_terms?: string;
};

function wantsSimilarJobs(text: string): boolean {
  return /\b(similar|other|more|find|search|scrape|vacanc|roles? like|jobs? like|alternatives?|elsewhere)\b/i.test(
    text,
  );
}

function titleKeywords(title: string): string[] {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
}

export type CoachSessionType = "coach" | "interview";

function isMissingSessionTypeColumn(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? "");
  return /session_type/i.test(msg) &&
    (/does not exist|schema cache|column/i.test(msg));
}

export async function loadCoachMessages(
  supabase: any,
  userId: string,
  jobId: string,
  sessionType: CoachSessionType = "coach",
) {
  const base = supabase
    .from("job_coach_messages")
    .select("id, role, content, similar_jobs, created_at")
    .eq("user_id", userId)
    .eq("job_id", jobId);

  if (sessionType === "interview") {
    const { data, error } = await base
      .eq("session_type", "interview")
      .order("created_at", { ascending: true })
      .limit(80);
    if (error) {
      if (isMissingSessionTypeColumn(error)) return [];
      throw error;
    }
    return data ?? [];
  }

  const { data, error } = await base
    .or("session_type.eq.coach,session_type.is.null")
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) {
    if (isMissingSessionTypeColumn(error)) {
      const { data: legacy, error: legacyErr } = await base
        .order("created_at", { ascending: true })
        .limit(80);
      if (legacyErr) throw legacyErr;
      return legacy ?? [];
    }
    throw error;
  }
  return data ?? [];
}

export async function saveCoachMessage(
  supabase: any,
  userId: string,
  jobId: string,
  role: "user" | "assistant",
  content: string,
  similar_jobs?: CoachSimilarJob[] | null,
  sessionType: CoachSessionType = "coach",
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    job_id: jobId,
    role,
    content,
    similar_jobs: similar_jobs?.length ? similar_jobs : null,
    session_type: sessionType,
  };

  let result = await supabase
    .from("job_coach_messages")
    .insert(row)
    .select("id, role, content, similar_jobs, created_at")
    .single();

  if (result.error && isMissingSessionTypeColumn(result.error)) {
    if (sessionType === "interview") {
      throw new Error(
        "job_coach_messages.session_type is missing. Run migration 20260522000000_interview_questions.sql in the Supabase SQL editor.",
      );
    }
    delete row.session_type;
    result = await supabase
      .from("job_coach_messages")
      .insert(row)
      .select("id, role, content, similar_jobs, created_at")
      .single();
  }

  if (result.error) {
    throw new Error(String(result.error.message ?? result.error));
  }
  return result.data;
}

async function findSimilarInUserJobs(
  supabase: any,
  userId: string,
  currentJobId: string,
  job: any,
  searchTerms: string,
  limit = 8,
): Promise<CoachSimilarJob[]> {
  const today = todayIsoDate();
  const keywords = searchTerms
    ? searchTerms.split(/\s+/).filter((w) => w.length > 2)
    : titleKeywords(job.title ?? "");

  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company, match_score")
    .eq("user_id", userId)
    .neq("id", currentJobId)
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("match_score", { ascending: false })
    .limit(40);
  if (error) throw error;

  const rows = (data ?? []) as CoachSimilarJob[];
  if (keywords.length === 0) return rows.slice(0, limit);

  const hay = keywords.map((k) => k.toLowerCase());
  const filtered = rows.filter((r) => {
    const t = `${r.title} ${r.company ?? ""}`.toLowerCase();
    return hay.some((k) => t.includes(k));
  });

  return (filtered.length > 0 ? filtered : rows).slice(0, limit);
}

async function ensureUserJobFromListing(
  supabase: any,
  userId: string,
  listing: JobListingRow,
): Promise<CoachSimilarJob | null> {
  const { data: existing } = await supabase
    .from("jobs")
    .select("id, title, company, match_score")
    .eq("user_id", userId)
    .eq("source_url", listing.source_url)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      company: existing.company,
      match_score: existing.match_score,
    };
  }

  const { data: inserted, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      listing_id: listing.id,
      title: listing.title,
      company: listing.company,
      company_summary: listing.company_summary,
      role_description: listing.role_description,
      location: listing.location,
      county: listing.county,
      description: listing.description,
      requirements: listing.requirements,
      responsibilities: listing.responsibilities,
      salary_text: listing.salary_text,
      job_type: listing.job_type,
      source: listing.source,
      source_url: listing.source_url,
      application_email: listing.application_email,
      application_url: listing.application_url || listing.source_url,
      application_method: listing.application_method ?? "unknown",
      contact_person: listing.contact_person,
      contact_phone: listing.contact_phone,
      deadline: listing.deadline,
      match_score: 50,
      match_reason: "Imported from Tellus job search",
    })
    .select("id, title, company, match_score")
    .single();
  if (error) {
    console.error("ensureUserJobFromListing", error);
    return null;
  }
  return inserted;
}

async function discoverSimilarJobs(
  supabase: any,
  userId: string,
  currentJobId: string,
  job: any,
  profile: any,
  searchTerms: string,
): Promise<CoachSimilarJob[]> {
  const fromDb = await findSimilarInUserJobs(supabase, userId, currentJobId, job, searchTerms, 6);
  const terms = searchTerms || job.title || "jobs";
  const roles = profile.desired_roles?.length
    ? profile.desired_roles.slice(0, 3)
    : [terms.split(/\s+/).slice(0, 3).join(" ") || job.title];

  try {
    const admin = createAdminClient();
    const discovery = await discoverJobListings(admin, {
      roles,
      counties: profile.preferred_counties?.length ? profile.preferred_counties : ["Kenya"],
      sources: DEFAULT_JOB_SOURCES,
      limit: 5,
      linkedinLiAt: null,
      linkedinTimeFilter: null,
    });

    const seen = new Set(fromDb.map((j) => j.id));
    for (const listing of discovery.listings) {
      if (listing.source_url === job.source_url) continue;
      const row = await ensureUserJobFromListing(supabase, userId, listing);
      if (row && !seen.has(row.id)) {
        fromDb.push(row);
        seen.add(row.id);
      }
      if (fromDb.length >= 8) break;
    }
  } catch (e) {
    console.error("discoverSimilarJobs scrape failed:", e);
  }

  return fromDb.slice(0, 8);
}

export async function runJobCoachTurn(params: {
  supabase: any;
  userId: string;
  jobId: string;
  userMessage: string;
  transcript: { role: string; content: string }[];
}) {
  const [{ data: job, error: jobErr }, { data: profile, error: profErr }] = await Promise.all([
    params.supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
    params.supabase.from("profiles").select("*").eq("id", userId).single(),
  ]);
  if (jobErr || !job) throw new Error("Job not found");
  if (profErr || !profile) throw new Error("Profile not found");

  await saveCoachMessage(params.supabase, userId, jobId, "user", userMessage);

  const skills = Array.isArray(profile.skills)
    ? profile.skills.join(", ")
    : String(profile.skills ?? "");

  const context = `JOB
Title: ${job.title}
Company: ${job.company ?? ""}
Location: ${job.location ?? job.county ?? ""}
Match score: ${job.match_score ?? 0}%
Match summary: ${job.match_reason ?? ""}
Strengths: ${job.match_strengths ?? ""}
Gaps: ${job.match_gaps ?? ""}

CANDIDATE
Name: ${profile.full_name ?? ""}
Skills: ${skills}
`;

  const transcript = params.transcript
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
    .join("\n\n");

  const ai = await aiJson<CoachAiReply>(
    `${context}\n\nConversation:\n${transcript}\n\nUser: ${userMessage}\n\nReturn JSON with:
- reply: your coaching answer (plain text, 2-4 short paragraphs, use "you")
- find_similar: true only if the user wants similar/other job listings to explore
- search_terms: short job title or role keywords to search (e.g. "waitress Nairobi") when find_similar is true`,
    "You are Tellus career coach. Output strict JSON only.",
  );

  let similar_jobs: CoachSimilarJob[] | null = null;
  const shouldFind = ai.find_similar || wantsSimilarJobs(userMessage);

  if (shouldFind) {
    similar_jobs = await discoverSimilarJobs(
      params.supabase,
      userId,
      jobId,
      job,
      profile,
      ai.search_terms?.trim() || job.title || "",
    );
  }

  let reply = ai.reply?.trim() || "I could not generate a reply. Please try again.";
  if (similar_jobs?.length) {
    reply +=
      "\n\nI found similar roles you can open below — tap a listing to view the full job page.";
  } else if (shouldFind) {
    reply +=
      "\n\nI searched but did not find additional similar listings right now. Try adjusting your desired roles in Configuration.";
  }

  const saved = await saveCoachMessage(
    params.supabase,
    userId,
    jobId,
    "assistant",
    reply,
    similar_jobs,
  );

  return { message: saved, similar_jobs: similar_jobs ?? [] };
}

export function coachGreeting(firstName: string, jobTitle: string) {
  const name = firstName?.trim() || "there";
  const role = jobTitle?.trim() || "this role";
  return `Hi ${name}, you can ask me any question about "${role}" — your fit, interview prep, or similar jobs to explore.`;
}

type InterviewAiReply = {
  reply: string;
  interview_complete?: boolean;
};

export function interviewGreeting(firstName: string, jobTitle: string, company: string) {
  const name = firstName?.trim() || "there";
  const role = jobTitle?.trim() || "this role";
  const org = company?.trim() || "the company";
  return `Hi ${name}, I'm the recruiter for ${org} interviewing you for ${role}. Turn on your microphone when you're ready — I'll ask one question at a time.`;
}

export async function runInterviewCoachTurn(params: {
  supabase: any;
  userId: string;
  jobId: string;
  userMessage: string;
  transcript: { role: string; content: string }[];
  interviewQuestions?: { question: string; answer: string }[];
}) {
  const [{ data: job, error: jobErr }, { data: profile, error: profErr }] = await Promise.all([
    params.supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
    params.supabase.from("profiles").select("*").eq("id", userId).single(),
  ]);
  if (jobErr || !job) throw new Error("Job not found");
  if (profErr || !profile) throw new Error("Profile not found");

  await saveCoachMessage(
    params.supabase,
    userId,
    jobId,
    "user",
    userMessage,
    null,
    "interview",
  );

  const skills = Array.isArray(profile.skills)
    ? profile.skills.join(", ")
    : String(profile.skills ?? "");

  const prepBlock = params.interviewQuestions?.length
    ? `\nSUGGESTED INTERVIEW TOPICS (use as inspiration, do not read answers aloud):\n${
      params.interviewQuestions.map((q) => `- ${q.question}`).join("\n")
    }\n`
    : "";

  const context = `You are conducting a realistic job interview as the hiring manager / recruiter for this specific role.

COMPANY: ${job.company ?? "the employer"}
ROLE: ${job.title}
LOCATION: ${job.location ?? job.county ?? ""}
REQUIREMENTS: ${job.requirements ?? ""}
RESPONSIBILITIES: ${job.responsibilities ?? ""}

CANDIDATE (for your reference only — evaluate their spoken answers, do not reveal this script):
Name: ${profile.full_name ?? ""}
Skills: ${skills}
${prepBlock}
`;

  const transcript = params.transcript
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Candidate" : "Recruiter"}: ${m.content}`)
    .join("\n\n");

  const ai = await aiJson<InterviewAiReply>(
    `${context}\n\nInterview so far:\n${transcript}\n\nCandidate: ${userMessage}\n\nReturn JSON with:
- reply: your next spoken turn as the recruiter (1-3 short paragraphs). Ask ONE clear question at a time unless wrapping up. Be professional, specific to ${job.company ?? "the company"} and ${job.title}. Briefly acknowledge their last answer when natural.
- interview_complete: true only after 6+ substantive exchanges when you would end the interview; then thank them and mention next steps.`,
    "You are a Kenyan hiring manager running a voice interview. Stay in character. Output strict JSON only.",
  );

  let reply = ai.reply?.trim() || "Thank you. Could you tell me more about your experience for this role?";
  if (ai.interview_complete) {
    reply +=
      "\n\nThat concludes our interview for today. Thank you for your time — we'll be in touch about next steps.";
  }

  const saved = await saveCoachMessage(
    params.supabase,
    userId,
    jobId,
    "assistant",
    reply,
    null,
    "interview",
  );

  return { message: saved, interview_complete: !!ai.interview_complete };
}
