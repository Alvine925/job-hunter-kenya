import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getJob,
  toggleSaveJob,
  generateAndSaveLetter,
  generateApplicationPack,
  generateInterviewQuestions,
  updateApplicationDraft,
  sendApplicationEmail,
  saveApplicationPackToDrive,
  checkApplicationGenerationLimit,
  type UsageLimitStatus,
} from "@/lib/api";
import { JobDetailView } from "@/components/job-detail/job-detail-view";
import { parsePackAnswers } from "@/components/job-detail/parse-pack";
import { ScrapingLoaderPanel } from "@/components/ui/tellus-loader";
import { JobDetailSkeleton } from "@/components/ui/skeleton-loaders";
import { ReferralLimitModal } from "@/components/referral-limit-modal";
import { toast } from "sonner";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeApplyEmail } from "@/lib/application-email";
import { sanitizePlainDocumentText } from "@/lib/sanitize-document-text";
import { scanApplicationMethod, type ScrapedJob } from "@/lib/scraped-jobs";
import {
  type ApplyComposeView,
  type ApplySection,
  type JobDetailTab,
  jobDetailSearchFromTab,
  parseJobDetailSearch,
} from "@/components/job-detail/tab-search";
import { QUERY_STALE_DEFAULT } from "@/lib/query-client";
import { setJobDocumentMeta } from "@/lib/document-meta";

export const Route = createFileRoute("/_authenticated/jobs/$id")({
  head: () => ({
    title: "Job Details - Tellus",
    meta: [
      { title: "Job Details - Tellus" },
      { name: "description", content: "View job details, AI compatibility reports, and prepare your application with Tellus." },
    ],
  }),
  component: JobDetail,
  validateSearch: parseJobDetailSearch,
  loader: ({ params: { id }, context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: ["job", id],
      queryFn: () => getJob({ id }),
      staleTime: QUERY_STALE_DEFAULT,
    }),
  pendingMs: 0,
  pendingComponent: () => <JobDetailSkeleton />,
});

function jobSourceHaystack(job: {
  source?: string | null;
  source_url?: string | null;
  application_url?: string | null;
}) {
  return `${job.source ?? ""} ${job.source_url ?? ""} ${job.application_url ?? ""}`.toLowerCase();
}

const SITE_EMAIL_HINTS: Record<string, string> = {
  "My Jobs in Kenya":
    "Use the job title as the email subject and include your salary expectations and notice period in the body.",
};

const SITE_FORM_HINTS: Record<string, string> = {
  BrighterMonday:
    "BrighterMonday apply modal — 14 fields ready to copy. Upload your CV on their site.",
  MyJobMag:
    "MyJobMag form — copy each answer, complete reCAPTCHA, then submit.",
};

function formPackHint(
  job: { source?: string | null; source_url?: string | null; application_url?: string | null },
  siteProfileName: string | null,
) {
  const hay = jobSourceHaystack(job);
  if (siteProfileName && SITE_FORM_HINTS[siteProfileName]) return SITE_FORM_HINTS[siteProfileName];
  if (hay.includes("brightermonday.co.ke")) return SITE_FORM_HINTS.BrighterMonday;
  if (hay.includes("myjobmag.co.ke")) return SITE_FORM_HINTS.MyJobMag;
  return null;
}

function JobDetail() {
  const { id } = Route.useParams();
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const tab: JobDetailTab = urlSearch.tab ?? "overview";
  const applyView: ApplyComposeView = urlSearch.view ?? "both";
  const applySection = urlSearch.section;
  const interviewSheetOpen = urlSearch.interview === "open";
  const applyPreviewOpen = urlSearch.preview === "preview";

  const applySearchOpts = (
    section?: ApplySection,
    interviewOpen?: boolean,
    previewOpen?: boolean,
  ) => ({
    section: section ?? applySection,
    interviewOpen: interviewOpen ?? interviewSheetOpen,
    previewOpen: previewOpen ?? applyPreviewOpen,
  });

  const focusInterview = (opts?: { interviewOpen?: boolean }) => {
    void navigate({
      search: jobDetailSearchFromTab("apply", applyView, {
        section: "interview",
        interviewOpen: opts?.interviewOpen ?? interviewSheetOpen,
      }),
      replace: true,
    });
  };

  const setTab = (next: JobDetailTab) => {
    void navigate({
      search: jobDetailSearchFromTab(
        next,
        next === "apply" ? applyView : "both",
        next === "apply" ? applySearchOpts() : undefined,
      ),
      replace: true,
    });
  };
  const setApplyView = (view: ApplyComposeView) => {
    void navigate({
      search: jobDetailSearchFromTab("apply", view, applySearchOpts()),
      replace: true,
    });
  };
  const setApplySection = (section: ApplySection) => {
    void navigate({
      search: jobDetailSearchFromTab("apply", applyView, {
        section,
        interviewOpen: section === "interview" ? interviewSheetOpen : false,
        previewOpen: section === "application" ? applyPreviewOpen : false,
      }),
      replace: true,
    });
  };

  const setApplyPreviewOpen = (open: boolean) => {
    void navigate({
      search: jobDetailSearchFromTab("apply", applyView, {
        section: "application",
        interviewOpen: false,
        previewOpen: open,
      }),
      replace: true,
    });
  };

  const setInterviewSheetOpen = (open: boolean) => {
    void navigate({
      search: jobDetailSearchFromTab("apply", applyView, {
        section: "interview",
        interviewOpen: open,
      }),
      replace: true,
    });
  };
  const qc = useQueryClient();

  // ── Reactive rate-limit check ──────────────────────────────────
  const { data: limitStatus } = useQuery({
    queryKey: ["generation-limit"],
    queryFn: () => checkApplicationGenerationLimit(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const limitReached = limitStatus?.allowed === false;

  /** Run a pre-flight limit check; show toast + return status when allowed. */
  const guardLimit = useCallback(async (): Promise<UsageLimitStatus | null> => {
    try {
      const check = await checkApplicationGenerationLimit();
      if (!check.allowed) {
        toast.error(check.reason || "You've reached your generation limit.");
        qc.setQueryData(["generation-limit"], check);
        return null;
      }
      return check;
    } catch {
      // If the check itself fails, let the server-side guard handle it
    }
    return { allowed: true, reason: "" };
  }, [qc]);

  const { data: jobTitleData } = useQuery({
    queryKey: ["job-title", id],
    queryFn: async () => {
      const { data: job } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", id)
        .maybeSingle();
      return job?.title ?? "";
    },
    staleTime: Infinity,
  });

  const jobTitle = jobTitleData ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob({ id }),
    staleTime: QUERY_STALE_DEFAULT,
    retry: 1,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-skills"],
    staleTime: QUERY_STALE_DEFAULT,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("skills, full_name, email, referral_code")
        .eq("id", user.id)
        .single();
      return p;
    },
  });

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [letter, setLetter] = useState("");
  const [includeCv, setIncludeCv] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [referralPromptOpen, setReferralPromptOpen] = useState(false);
  const [referralPromptMeta, setReferralPromptMeta] = useState({
    used: 1,
    limit: 2,
    actionLabel: "application pack",
  });

  useEffect(() => {
    if (!data?.job) return;
    const email =
      normalizeApplyEmail(data.job.application_email) ??
      normalizeApplyEmail(data.application?.application_email);
    if (email) setTo(email);
  }, [data?.job?.id, data?.job?.application_email, data?.application?.application_email]);

  useEffect(() => {
    if (!data?.application) return;
    setSubject(data.application.email_subject ?? "");
    setBody(data.application.email_body ?? "");
    setLetter(sanitizePlainDocumentText(data.application.cover_letter ?? ""));
  }, [data?.application?.id]);

  const appDraft = data?.application;
  const hasUnsavedChanges = !!appDraft?.id && (
    subject !== (appDraft.email_subject ?? "") ||
    body !== (appDraft.email_body ?? "") ||
    sanitizePlainDocumentText(letter) !== sanitizePlainDocumentText(appDraft.cover_letter ?? "") ||
    to !== (appDraft.application_email ?? "")
  );

  useEffect(() => {
    if (!hasUnsavedChanges || !appDraft?.id) return;

    const timer = setTimeout(async () => {
      setIsSavingDraft(true);
      try {
        await updateApplicationDraft({
          applicationId: appDraft.id,
          email_subject: subject,
          email_body: body,
          cover_letter: sanitizePlainDocumentText(letter),
          application_email: to.trim() || undefined,
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["job", id] }),
          qc.invalidateQueries({ queryKey: ["jobs"] }),
          qc.invalidateQueries({ queryKey: ["saved-jobs"] }),
          qc.invalidateQueries({ queryKey: ["scraped_jobs"] }),
        ]);
      } catch (e) {
        console.error("Autosave draft failed:", e);
      } finally {
        setIsSavingDraft(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [subject, body, letter, to, appDraft?.id, hasUnsavedChanges, id, qc]);

  const maybeShowReferralPrompt = useCallback(
    (precheck: UsageLimitStatus | null | undefined, actionLabel: string) => {
      if (!precheck || precheck.allowed === false || precheck.usage_count !== 0) return;
      setReferralPromptMeta({
        used: 1,
        limit: precheck.limit_count ?? 2,
        actionLabel,
      });
      setReferralPromptOpen(true);
    },
    [],
  );

  const genMut = useMutation({
    mutationFn: (_precheck?: UsageLimitStatus) => generateAndSaveLetter({ jobId: id }),
    onSuccess: (r, precheck) => {
      toast.success("Application pack ready", {
        description: "Cover letter, email, interview prep, and Drive files (if Google is connected).",
      });
      setSubject(r.application.email_subject ?? "");
      setBody(r.application.email_body ?? "");
      setLetter(sanitizePlainDocumentText(r.application.cover_letter ?? ""));
      const email = normalizeApplyEmail(r.application.application_email);
      if (email) setTo(email);
      setTab("apply");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
      maybeShowReferralPrompt(precheck, "cover letter pack");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const packMut = useMutation({
    mutationFn: (_precheck?: UsageLimitStatus) => generateApplicationPack({ jobId: id }),
    onSuccess: (r: any, precheck) => {
      toast.success("Application pack ready", {
        description: "Form responses, cover letter, email, interview prep — saved to Drive when connected.",
      });
      if (r?.application) {
        setSubject(r.application.email_subject ?? "");
        setBody(r.application.email_body ?? "");
        setLetter(sanitizePlainDocumentText(r.application.cover_letter ?? ""));
        const email = normalizeApplyEmail(r.application.application_email);
        if (email) setTo(email);
      }
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
      maybeShowReferralPrompt(precheck, "application pack");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const interviewMut = useMutation({
    mutationFn: () => generateInterviewQuestions({ jobId: id }),
    onSuccess: (res) => {
      toast.success("Interview prep saved");
      focusInterview();
      qc.setQueryData(["job", id], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          application: res?.application ?? prev.application,
        };
      });
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!data?.application?.id) throw new Error("Generate the application first");
      return updateApplicationDraft({
        applicationId: data.application.id,
        email_subject: subject,
        email_body: body,
        cover_letter: sanitizePlainDocumentText(letter),
        application_email: to.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      sendApplicationEmail({
        applicationId: data!.application!.id,
        to,
        cc: cc || undefined,
        subject,
        body,
        includeCv,
      }),
    onSuccess: (res: any) => {
      toast.success("Application sent", {
        description: "Your email was sent from Gmail.",
      });
      if (res?.application) {
        qc.setQueryData(["job", id], (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            application: res.application,
          };
        });
      }
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const driveMut = useMutation({
    mutationFn: () => {
      if (!data?.application?.id) throw new Error("Generate the application first");
      return saveApplicationPackToDrive({
        applicationId: data.application.id,
        email_subject: subject,
        email_body: body,
        cover_letter: sanitizePlainDocumentText(letter),
      });
    },
    onSuccess: (r) => {
      toast.success("Application pack saved to Google Drive", {
        description: `Email, cover letter, and CV are in folder “${r.folderName}”.`,
      });
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const job = data?.job;
  const app = data?.application;
  useEffect(() => {
    setJobDocumentMeta({
      title: (job?.title as string | undefined) || jobTitle,
      company: job?.company as string | undefined,
      fallbackTitle: "Job Details - Tellus",
    });
  }, [job?.title, job?.company, jobTitle]);

  const isEmailApply = job ? scanApplicationMethod(job as ScrapedJob) === "email" : false;
  const packMeta = parsePackAnswers(app?.pack_answers);
  const hay = job ? jobSourceHaystack(job) : "";

  const toggleMethodMut = useMutation({
    mutationFn: async () => {
      const nextMethod = isEmailApply ? "form" : "email";
      console.log("[toggleMethodMut - jobs.$id] Clicked toggle. isEmailApply:", isEmailApply, "nextMethod:", nextMethod);
      console.log("[toggleMethodMut - jobs.$id] id:", id);
      
      const { data: updateData, error } = await supabase
        .from("jobs")
        .update({ application_method: nextMethod })
        .eq("id", id)
        .select();

      console.log("[toggleMethodMut - jobs.$id] Supabase update result:", { updateData, error });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Switched to ${isEmailApply ? "Form" : "Email"} application mode`);
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => {
      console.error("[toggleMethodMut - jobs.$id] Error during toggle:", e);
      toast.error(e.message);
    },
  });

  const saveBookmarkMut = useMutation({
    mutationFn: () => toggleSaveJob(id),
    onSuccess: (r) => {
      toast.success(r.saved ? "Job saved" : "Removed from saved jobs");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading && !data) {
    return <JobDetailSkeleton />;
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-lg">
        <p className="font-medium text-foreground">Could not load this job</p>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        <p className="text-xs text-muted-foreground mt-4">
          If you recently updated interview features, deploy the <code className="text-xs">jobs</code> and{" "}
          <code className="text-xs">applications</code> edge functions, then run the new database migrations.
        </p>
      </div>
    );
  }

  if (!job) {
    return <div className="p-4 sm:p-6 lg:p-8">Job not found</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
    <JobDetailView
      job={job}
      application={app ?? null}
      tab={tab}
      onTabChange={setTab}
      applyView={applyView}
      onApplyViewChange={setApplyView}
      similarJobs={(data.similar_jobs as any) ?? []}
      profileSkills={profile?.skills}
      userFirstName={profile?.full_name?.split(/\s+/)[0]}
      packMeta={packMeta}
      isEmailApply={isEmailApply}
      siteFormHint={formPackHint(job, packMeta.siteProfileName)}
      siteEmailHint={hay.includes("myjobsinkenya.com") ? SITE_EMAIL_HINTS["My Jobs in Kenya"] : null}
      to={to}
      cc={cc}
      subject={subject}
      body={body}
      letter={letter}
      includeCv={includeCv}
      onToChange={setTo}
      onCcChange={setCc}
      onSubjectChange={setSubject}
      onBodyChange={setBody}
      onLetterChange={setLetter}
      onIncludeCvChange={setIncludeCv}
      onApply={async () => {
        const precheck = await guardLimit();
        if (precheck) genMut.mutate(precheck);
      }}
      onPack={async () => {
        const precheck = await guardLimit();
        if (precheck) packMut.mutate(precheck);
      }}
      applySection={applySection}
      onApplySectionChange={setApplySection}
      applyPreviewOpen={applyPreviewOpen}
      onApplyPreviewOpenChange={setApplyPreviewOpen}
      interviewSheetOpen={interviewSheetOpen}
      onInterviewSheetOpenChange={setInterviewSheetOpen}
      onInterviewGenerate={async () => {
        if (!(await guardLimit())) return;
        focusInterview();
        interviewMut.mutate();
      }}
      onInterviewReportRefresh={() => qc.invalidateQueries({ queryKey: ["job", id] })}
      onSave={() => saveMut.mutate()}
      onSend={() => sendMut.mutate()}
      onSaveToDrive={() => driveMut.mutate()}
      applyPending={genMut.isPending}
      applyDisabled={limitReached}
      packPending={packMut.isPending}
      packDisabled={limitReached}
      interviewPending={interviewMut.isPending}
      interviewDisabled={limitReached}
      limitMessage={limitReached ? (limitStatus?.reason || "Generation limit reached") : undefined}
      savePending={saveMut.isPending}
      sendPending={sendMut.isPending}
      saveToDrivePending={driveMut.isPending}
      isSavingDraft={isSavingDraft}
      isSaved={!!job.saved_at}
      onToggleSave={() => saveBookmarkMut.mutate()}
      saveBookmarkPending={saveBookmarkMut.isPending}
      onToggleApplicationMethod={() => toggleMethodMut.mutate()}
    />
    <ReferralLimitModal
      open={referralPromptOpen}
      onOpenChange={setReferralPromptOpen}
      profile={profile}
      used={referralPromptMeta.used}
      limit={referralPromptMeta.limit}
      actionLabel={referralPromptMeta.actionLabel}
    />
    </div>
  );
}
