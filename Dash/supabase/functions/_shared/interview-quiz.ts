import {
  clearInterviewCoachMessages,
  generateCoachInterviewReport,
  generateInterviewOpening,
  runInterviewCoachTurn,
  type InterviewPhase,
} from "./interview-coach-flow.ts";
import { loadCoachMessages } from "./job-coach.ts";

export type InterviewQa = { question: string; answer: string };

export type InterviewSession = {
  mode: "chat" | "voice";
  status: "in_progress" | "complete";
  flow: "coach";
  phase: InterviewPhase;
  exchange_count: number;
  recruiter_name: string;
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

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function getApplicationForJob(supabase: any, userId: string, jobId: string) {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveApplicationInterviewFields(
  supabase: any,
  applicationId: string,
  userId: string,
  fields: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("applications")
    .update(fields)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) {
    const msg = String(error.message ?? error);
    if (
      /interview_session|interview_report|interview_questions/i.test(msg)
    ) {
      throw new Error(
        "Interview columns are missing on applications. Run migrations 20260522000000_interview_questions.sql and 20260522100000_interview_session_report.sql in the Supabase SQL editor.",
      );
    }
    throw new Error(msg || "Could not save interview data");
  }
  return data;
}

export async function loadInterviewQuizState(supabase: any, userId: string, jobId: string) {
  const app = await getApplicationForJob(supabase, userId, jobId);
  const prepQuestions = parseJson<InterviewQa[]>(app?.interview_questions, []);
  const session = parseJson<InterviewSession | null>(app?.interview_session, null);
  const report = parseJson<InterviewReport | null>(app?.interview_report, null);

  const messages = session
    ? await loadCoachMessages(supabase, userId, jobId, "interview")
    : [];

  const currentQuestion = session?.status === "in_progress" && session.questions?.length
    ? session.questions[session.current_index ?? 0] ?? null
    : null;

  return {
    prep_questions: prepQuestions,
    session,
    report,
    messages,
    current_question: currentQuestion,
    question_number: session?.exchange_count ?? 0,
    total_questions: session?.questions?.length ?? 0,
    recruiter_name: session?.recruiter_name ?? null,
  };
}

export async function startInterviewQuiz(params: {
  supabase: any;
  userId: string;
  jobId: string;
  mode: "chat" | "voice";
}) {
  const { supabase, userId, jobId, mode } = params;
  const app = await getApplicationForJob(supabase, userId, jobId);
  if (!app?.id) {
    throw new Error(
      "No application for this job yet. Open Apply → draft interview prep first (that creates your application record).",
    );
  }

  const prepQuestions = parseJson<InterviewQa[]>(app.interview_questions, []).filter(
    (q) => typeof q?.question === "string" && q.question.trim().length > 0,
  );

  if (prepQuestions.length < 3) {
    throw new Error(
      `Generate interview prep first — need at least 3 practice questions (found ${prepQuestions.length}). Use "Draft interview prep" on the Apply tab.`,
    );
  }

  await clearInterviewCoachMessages(supabase, userId, jobId);

  const opening = await generateInterviewOpening({
    supabase,
    userId,
    jobId,
    mode,
    prepQuestions,
  });

  const session: InterviewSession = {
    mode,
    status: "in_progress",
    flow: "coach",
    phase: "main",
    exchange_count: 0,
    recruiter_name: opening.recruiter_name,
    answers: [],
    started_at: new Date().toISOString(),
  };

  await saveApplicationInterviewFields(supabase, app.id, userId, {
    interview_session: JSON.stringify(session),
    interview_report: null,
  });

  const messages = await loadCoachMessages(supabase, userId, jobId, "interview");

  return {
    session,
    messages,
    opening_message: opening.message,
    recruiter_name: opening.recruiter_name,
    interview_complete: false,
    current_question: null,
    question_number: 0,
    total_questions: 0,
  };
}

export async function submitInterviewAnswer(params: {
  supabase: any;
  userId: string;
  jobId: string;
  answer: string;
}) {
  const { supabase, userId, jobId, answer } = params;
  const trimmed = answer?.trim();
  if (!trimmed) {
    throw new Error("Type or say your answer before continuing — empty responses cannot be submitted.");
  }

  const app = await getApplicationForJob(supabase, userId, jobId);
  if (!app?.id) throw new Error("No application found");

  let session = parseJson<InterviewSession | null>(app.interview_session, null);
  if (!session || session.status !== "in_progress") {
    throw new Error("No interview in progress. Start a new mock interview.");
  }

  if (session.flow !== "coach") {
    session = {
      ...session,
      flow: "coach",
      phase: "main",
      exchange_count: session.exchange_count ?? 0,
      recruiter_name: session.recruiter_name ?? "the recruiter",
      answers: session.answers ?? [],
    };
  }

  const prepQuestions = parseJson<InterviewQa[]>(app.interview_questions, []);

  const turn = await runInterviewCoachTurn({
    supabase,
    userId,
    jobId,
    userMessage: trimmed,
    meta: {
      mode: session.mode,
      exchange_count: session.exchange_count ?? 0,
      phase: session.phase ?? "main",
      recruiter_name: session.recruiter_name ?? "the recruiter",
    },
    prepQuestions,
  });

  session.exchange_count += 1;
  session.phase = turn.phase;

  if (typeof turn.last_score === "number" && turn.last_feedback) {
    session.answers.push({
      question: "Interview exchange",
      user_answer: trimmed,
      score: Math.min(100, Math.max(0, Math.round(turn.last_score))),
      feedback: turn.last_feedback.trim(),
    });
  }

  if (turn.interview_complete) {
    session.status = "complete";
    session.completed_at = new Date().toISOString();
    session.phase = "wrapup";
  }

  await saveApplicationInterviewFields(supabase, app.id, userId, {
    interview_session: JSON.stringify(session),
  });

  const messages = await loadCoachMessages(supabase, userId, jobId, "interview");

  const lastScored = session.answers.length > 0
    ? session.answers[session.answers.length - 1]
    : {
      question: "",
      user_answer: trimmed,
      score: turn.last_score ?? 0,
      feedback: turn.last_feedback ?? "",
    };

  return {
    session,
    message: turn.message,
    messages,
    scored: lastScored,
    interview_complete: turn.interview_complete,
    current_question: null,
    question_number: session.exchange_count,
    total_questions: 0,
  };
}

export async function generateInterviewReport(params: {
  supabase: any;
  userId: string;
  jobId: string;
}) {
  const { supabase, userId, jobId } = params;

  const [{ data: job }, { data: profile }, app] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).eq("user_id", userId).single(),
    supabase.from("profiles").select("full_name, skills, professional_summary").eq("id", userId).single(),
    getApplicationForJob(supabase, userId, jobId),
  ]);
  if (!job) throw new Error("Job not found");
  if (!app?.id) throw new Error("No application found");

  const existing = parseJson<InterviewReport | null>(app.interview_report, null);
  const session = parseJson<InterviewSession | null>(app.interview_session, null);

  if (existing && session?.status === "complete") {
    return { report: existing, session };
  }

  const coachReport = await generateCoachInterviewReport({ supabase, userId, jobId });

  const report: InterviewReport = {
    overall_score: coachReport.overall_score,
    summary: coachReport.summary,
    strengths: coachReport.strengths,
    areas_to_improve: coachReport.areas_to_improve,
    recommendations: coachReport.recommendations,
    question_breakdown: coachReport.question_breakdown,
    generated_at: coachReport.generated_at,
  };

  if (session) {
    if (session.status !== "complete") {
      session.status = "complete";
      session.completed_at = session.completed_at ?? new Date().toISOString();
    }
    await saveApplicationInterviewFields(supabase, app.id, userId, {
      interview_session: JSON.stringify(session),
      interview_report: JSON.stringify(report),
    });
  } else {
    await saveApplicationInterviewFields(supabase, app.id, userId, {
      interview_report: JSON.stringify(report),
    });
  }

  return { report, session };
}

export async function resetInterviewQuiz(supabase: any, userId: string, jobId: string) {
  const app = await getApplicationForJob(supabase, userId, jobId);
  if (!app?.id) return;

  await saveApplicationInterviewFields(supabase, app.id, userId, {
    interview_session: null,
    interview_report: null,
  });

  await clearInterviewCoachMessages(supabase, userId, jobId);
}
