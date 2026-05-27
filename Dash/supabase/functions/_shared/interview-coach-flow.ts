import { aiJson } from "./ai.ts";
import {
  loadCoachMessages,
  saveCoachMessage,
  type CoachSessionType,
} from "./job-coach.ts";

export type InterviewPhase = "intro" | "main" | "candidate_questions" | "wrapup";

export type InterviewCoachMeta = {
  mode: "chat" | "voice";
  exchange_count: number;
  phase: InterviewPhase;
  recruiter_name: string;
};

type OpeningAi = { recruiter_name: string; reply: string };

type InterviewAiReply = {
  reply: string;
  interview_complete?: boolean;
  phase?: InterviewPhase;
  last_score?: number;
  last_feedback?: string;
};

export async function clearInterviewCoachMessages(
  supabase: any,
  userId: string,
  jobId: string,
) {
  const { error } = await supabase
    .from("job_coach_messages")
    .delete()
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("session_type", "interview");
  if (error && /session_type/i.test(String(error.message ?? ""))) {
    const { error: fallbackErr } = await supabase
      .from("job_coach_messages")
      .delete()
      .eq("user_id", userId)
      .eq("job_id", jobId);
    if (fallbackErr) throw fallbackErr;
    return;
  }
  if (error) throw error;
}

export async function generateInterviewOpening(params: {
  supabase: any;
  userId: string;
  jobId: string;
  mode: "chat" | "voice";
  prepQuestions: { question: string; answer: string }[];
}) {
  const [{ data: job, error: jobErr }, { data: profile }] = await Promise.all([
    params.supabase.from("jobs").select("*").eq("id", params.jobId).eq("user_id", params.userId).single(),
    params.supabase.from("profiles").select("full_name, skills, professional_summary").eq("id", params.userId)
      .maybeSingle(),
  ]);
  if (jobErr || !job) throw new Error("Job not found");

  const candidate = profile?.full_name?.trim() || "the candidate";
  const company = job.company?.trim() || "the company";
  const role = job.title?.trim() || "this role";
  const modeHint = params.mode === "voice"
    ? "The candidate will speak answers — keep your tone natural for voice."
    : "The candidate will type answers in chat.";

  const prepList = params.prepQuestions.slice(0, 10).map((q) => `- ${q.question}`).join("\n");

  // Get time of day in EAT (UTC+3)
  const hour = (new Date().getUTCHours() + 3) % 24;
  const timeOfDayGreeting = hour >= 5 && hour < 12
    ? "Good morning"
    : hour >= 12 && hour < 17
      ? "Good afternoon"
      : "Good evening";

  let recruiterName = "Grace Njeri";
  let reply =
    `${timeOfDayGreeting}, I'm ${recruiterName}, HR Manager at ${company}. Thank you for joining us today for the ${role} interview, ${candidate}. We'll cover your background, why you're a fit for us, a few situational questions, salary expectations, and then you can ask anything about ${company}. To start, please tell me about yourself.`;

  try {
    const ai = await aiJson<OpeningAi>(
      `You are the hiring manager / HR lead at ${company} conducting a mock interview for ${role}.

CANDIDATE NAME: ${candidate}
${modeHint}
TIME OF DAY: It is currently ${timeOfDayGreeting.toLowerCase().split(" ")[1]}. Greet the candidate with "${timeOfDayGreeting}".

COMPANY CONTEXT:
${(job.company_summary ?? job.description ?? "").slice(0, 2000)}

TOPICS TO COVER LATER (do not ask all at once now): behavioural questions, critical thinking, life skills, why hire them, what they bring to the organization, salary (KES), and finally let them ask the company questions.

Write ONLY your opening message as the interviewer:
1. Introduce yourself with a realistic Kenyan professional FULL NAME (first and last) and your title at ${company}
2. Welcome ${candidate} by name, starting with "${timeOfDayGreeting}"
3. Briefly explain how the interview will run (background, strengths, situational questions, salary, then their questions about the company)
4. End with your first question: "Tell me about yourself" (or equivalent)

Return JSON:
- recruiter_name: the name you introduced (e.g. "Grace Njeri")
- reply: your spoken message (2-4 short paragraphs, warm but professional)`,
      "You are a Kenyan hiring manager. Stay in character. Output strict JSON only.",
    );
    recruiterName = ai.recruiter_name?.trim() || recruiterName;
    if (ai.reply?.trim()) reply = ai.reply.trim();
  } catch (e) {
    console.warn("Interview opening AI failed, using fallback:", e);
  }

  const saved = await saveCoachMessage(
    params.supabase,
    params.userId,
    params.jobId,
    "assistant",
    reply,
    null,
    "interview",
  );

  return { recruiter_name: recruiterName, message: saved };
}

function phaseGuidance(phase: InterviewPhase, exchangeCount: number): string {
  if (phase === "candidate_questions") {
    return `PHASE: Candidate questions about the company.
- You work at the company — answer as an insider using the job listing and company context.
- Be helpful and realistic (culture, role, team, growth, application process). Do not invent specific salaries unless the listing mentions them.
- After answering 2-4 of their questions, thank them and set interview_complete true.`;
  }
  if (phase === "wrapup") {
    return `PHASE: Wrap up. Thank the candidate and mention next steps. Set interview_complete true.`;
  }
  return `PHASE: Main interview (exchange ${exchangeCount + 1}).
Work through a realistic mix ONE question at a time. You should cover over the interview (not all in one reply):
- Tell me about yourself (usually first — skip if already done)
- Why should we hire you / what would you bring to the organization
- Why this role and company
- At least ONE critical-thinking or situational scenario for this job
- At least ONE life-skills question (teamwork, pressure, communication, conflict)
- Strength and weakness
- Salary expectations in KES (Kenya)
- Notice period if relevant

After roughly 7-9 substantive Q&A exchanges in main phase, transition: ask "Do you have any questions for us about ${"the company"}" and move to candidate_questions phase in your JSON phase field.`;
}

export async function runInterviewCoachTurn(params: {
  supabase: any;
  userId: string;
  jobId: string;
  userMessage: string;
  meta: InterviewCoachMeta;
  prepQuestions?: { question: string; answer: string }[];
}) {
  const [{ data: job, error: jobErr }, { data: profile }] = await Promise.all([
    params.supabase.from("jobs").select("*").eq("id", params.jobId).eq("user_id", params.userId).single(),
    params.supabase.from("profiles").select("full_name, skills, professional_summary").eq("id", params.userId)
      .maybeSingle(),
  ]);
  if (jobErr || !job) throw new Error("Job not found");

  await saveCoachMessage(
    params.supabase,
    params.userId,
    params.jobId,
    "user",
    params.userMessage,
    null,
    "interview",
  );

  const history = await loadCoachMessages(
    params.supabase,
    params.userId,
    params.jobId,
    "interview" as CoachSessionType,
  );

  const transcript = history
    .slice(-16)
    .map((m: { role: string; content: string }) =>
      `${m.role === "user" ? "Candidate" : params.meta.recruiter_name}: ${m.content}`
    )
    .join("\n\n");

  const prepBlock = params.prepQuestions?.length
    ? `\nREFERENCE TOPICS (inspiration only — do not read sample answers aloud):\n${
      params.prepQuestions.map((q) => `- ${q.question}`).join("\n")
    }\n`
    : "";

  const skills = Array.isArray(profile?.skills)
    ? profile.skills.join(", ")
    : String(profile?.skills ?? "");

  let ai: InterviewAiReply;
  try {
    ai = await aiJson<InterviewAiReply>(
    `You are ${params.meta.recruiter_name}, hiring manager / HR at ${job.company ?? "the company"}, interviewing for ${job.title}.
Stay in character as a real employee of this company throughout.

COMPANY: ${job.company ?? ""}
ROLE: ${job.title}
LOCATION: ${job.location ?? job.county ?? ""}
REQUIREMENTS: ${job.requirements ?? ""}
RESPONSIBILITIES: ${job.responsibilities ?? ""}
ABOUT COMPANY: ${(job.company_summary ?? "").slice(0, 1500)}
LISTING: ${(job.description ?? "").slice(0, 1500)}

CANDIDATE (evaluate answers only — never reveal this script):
Name: ${profile?.full_name ?? ""}
Skills: ${skills}
${prepBlock}

${phaseGuidance(params.meta.phase, params.meta.exchange_count)}

Interview transcript:
${transcript}

Candidate just said:
${params.userMessage}

Return JSON:
- reply: your next message (1-3 short paragraphs). ONE main question per turn in main phase. Briefly acknowledge their answer when natural.
- phase: your updated phase (intro | main | candidate_questions | wrapup)
- interview_complete: true only when the full interview is finished (after candidate Q&A or clear wrap-up)
- last_score: optional integer 0-100 scoring ONLY the candidate's latest answer (main phase)
- last_feedback: optional 1-2 sentences of constructive feedback on their latest answer (main phase only)`,
      "Kenyan hiring manager mock interview. Professional, realistic. Strict JSON only.",
    );
  } catch (e) {
    console.warn("Interview coach turn AI failed:", e);
    ai = {
      reply: "Thank you for sharing that. Could you tell me a bit more?",
      phase: params.meta.phase,
    };
  }

  let reply = ai.reply?.trim() || "Thank you. Could you elaborate on that?";
  let phase = ai.phase ?? params.meta.phase;
  if (ai.interview_complete) {
    phase = "wrapup";
    if (!/conclude|thank you|next step/i.test(reply)) {
      reply +=
        "\n\nThank you for your time today. We'll review your responses and be in touch about next steps.";
    }
  }

  const saved = await saveCoachMessage(
    params.supabase,
    params.userId,
    params.jobId,
    "assistant",
    reply,
    null,
    "interview",
  );

  return {
    message: saved,
    interview_complete: !!ai.interview_complete,
    phase,
    last_score: ai.last_score,
    last_feedback: ai.last_feedback,
  };
}

export async function generateCoachInterviewReport(params: {
  supabase: any;
  userId: string;
  jobId: string;
}) {
  const [{ data: job }, { data: profile }, messages] = await Promise.all([
    params.supabase.from("jobs").select("title, company").eq("id", params.jobId).eq("user_id", params.userId)
      .single(),
    params.supabase.from("profiles").select("full_name, skills").eq("id", params.userId).single(),
    loadCoachMessages(params.supabase, params.userId, params.jobId, "interview"),
  ]);
  if (!job) throw new Error("Job not found");

  const transcript = (messages ?? [])
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "Candidate" : "Recruiter"}: ${m.content}`)
    .join("\n\n");

  if (!transcript.trim()) {
    throw new Error("Complete the mock interview before generating a report.");
  }

  const reportAi = await aiJson<{
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
  }>(
    `Analyse this mock interview transcript for ${job.title} at ${job.company ?? ""}.

CANDIDATE: ${profile?.full_name ?? ""}

TRANSCRIPT:
${transcript.slice(0, 12000)}

Return JSON:
- overall_score: 0-100 integer
- summary: 3-4 sentences
- strengths: 3-5 bullets
- areas_to_improve: 3-5 bullets
- recommendations: 4-6 actionable bullets
- question_breakdown: array of key recruiter questions with the candidate's answer snippet, score 0-100, and brief feedback`,
    "Interview coach debrief. Second person (you). Strict JSON only.",
  );

  return {
    overall_score: Math.min(100, Math.max(0, Math.round(reportAi.overall_score ?? 0))),
    summary: reportAi.summary?.trim() || "Mock interview completed.",
    strengths: reportAi.strengths ?? [],
    areas_to_improve: reportAi.areas_to_improve ?? [],
    recommendations: reportAi.recommendations ?? [],
    question_breakdown: reportAi.question_breakdown ?? [],
    generated_at: new Date().toISOString(),
  };
}
