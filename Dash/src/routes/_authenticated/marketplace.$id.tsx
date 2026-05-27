import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMarketplaceJob,
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState, useMemo, useCallback } from "react";
import { normalizeApplyEmail } from "@/lib/application-email";
import { sanitizePlainDocumentText } from "@/lib/sanitize-document-text";
import { supabase } from "@/integrations/supabase/client";
import { scanApplicationMethod, type ScrapedJob } from "@/lib/scraped-jobs";
import {
  type ApplyComposeView,
  type ApplySection,
  type JobDetailTab,
  jobDetailSearchFromTab,
  parseJobDetailSearch,
} from "@/components/job-detail/tab-search";
import { setJobDocumentMeta } from "@/lib/document-meta";

export const Route = createFileRoute("/_authenticated/marketplace/$id")({
  head: () => ({
    title: "Marketplace Job Details - Tellus",
    meta: [
      { title: "Marketplace Job Details - Tellus" },
      { name: "description", content: "Verify match score and prepare your application package for this role on the Tellus Job Marketplace." },
    ],
  }),
  component: MarketplaceJobDetail,
  validateSearch: parseJobDetailSearch,
  beforeLoad: ({ params }) => {
    if (params.id.startsWith("user_")) {
      throw redirect({
        to: "/jobs/$id",
        params: { id: params.id.slice(5) },
      });
    }
  },
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

function MarketplaceJobDetail() {
  const { id: scrapedJobId } = Route.useParams();
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
    staleTime: 30_000,       // re-check every 30 s
    refetchOnWindowFocus: true,
  });
  const limitReached = limitStatus?.allowed === false;

  /** Run a pre-flight limit check; show toast + return status when allowed. */
  const guardLimit = useCallback(async (): Promise<UsageLimitStatus | null> => {
    try {
      const check = await checkApplicationGenerationLimit();
      if (!check.allowed) {
        toast.error(check.reason || "You've reached your generation limit.");
        // Refresh cached status so the UI disables immediately
        qc.setQueryData(["generation-limit"], check);
        return null;
      }
      return check;
    } catch {
      // If the check itself fails, let the server-side guard handle it
    }
    return { allowed: true, reason: "" };
  }, [qc]);

  // Pre-flight check: does the user already have a jobs row for this scraped job?
  // This lets us show "Fetching job details…" instead of "Analyzing…" for repeat visits.
  const { data: preflight } = useQuery({
    queryKey: ["marketplace-job-exists", scrapedJobId],
    queryFn: async () => {
      // Check if a scraped_jobs row exists and get its source_url and title
      const { data: scraped } = await supabase
        .from("scraped_jobs")
        .select("source_url, title")
        .eq("id", scrapedJobId)
        .maybeSingle();
      if (!scraped?.source_url) return null;

      // Check if the user already has a job row matching this source_url
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { exists: false, title: scraped.title };
      const { data: existing } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_url", scraped.source_url)
        .maybeSingle();
      return { exists: !!existing, title: scraped.title };
    },
    staleTime: Infinity, // Only check once per mount
  });

  const existsInDb = preflight?.exists ?? false;
  const jobTitle = preflight?.title ?? "";

  // Also check React Query cache — if we already fetched this job, it's cached
  const cachedData = qc.getQueryData(["marketplace-job", scrapedJobId]);
  const isRevisit = existsInDb === true || !!cachedData;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace-job", scrapedJobId],
    queryFn: () => getMarketplaceJob(scrapedJobId),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-skills"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("skills, full_name, email, referral_code")
        .eq("id", user.id)
        .single();
      return p;
    },
  });

  const jobId = data?.job?.id as string | undefined;

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
    setSubject((data.application.email_subject as string) ?? "");
    setBody((data.application.email_body as string) ?? "");
    setLetter(sanitizePlainDocumentText((data.application.cover_letter as string) ?? ""));
  }, [data?.application?.id]);

  const appDraft = data?.application;
  const hasUnsavedChanges = !!appDraft?.id && (
    subject !== ((appDraft.email_subject as string) ?? "") ||
    body !== ((appDraft.email_body as string) ?? "") ||
    sanitizePlainDocumentText(letter) !== sanitizePlainDocumentText((appDraft.cover_letter as string) ?? "") ||
    to !== ((appDraft.application_email as string) ?? "")
  );

  useEffect(() => {
    if (!hasUnsavedChanges || !appDraft?.id) return;

    const timer = setTimeout(async () => {
      setIsSavingDraft(true);
      try {
        await updateApplicationDraft({
          applicationId: appDraft.id as string,
          email_subject: subject,
          email_body: body,
          cover_letter: sanitizePlainDocumentText(letter),
          application_email: to.trim() || undefined,
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] }),
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
  }, [subject, body, letter, to, appDraft?.id, hasUnsavedChanges, scrapedJobId, qc]);

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
    mutationFn: (_precheck?: UsageLimitStatus) => generateAndSaveLetter({ jobId: jobId! }),
    onSuccess: (r, precheck) => {
      toast.success("Application draft ready");
      setSubject(r.application.email_subject ?? "");
      setBody(r.application.email_body ?? "");
      setLetter(sanitizePlainDocumentText(r.application.cover_letter ?? ""));
      const email = normalizeApplyEmail(r.application.application_email);
      if (email) setTo(email);
      setTab("apply");
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
      maybeShowReferralPrompt(precheck, "cover letter pack");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const packMut = useMutation({
    mutationFn: (_precheck?: UsageLimitStatus) => generateApplicationPack({ jobId: jobId! }),
    onSuccess: (r: any, precheck) => {
      toast.success("Application pack ready");
      if (r?.application) {
        setSubject(r.application.email_subject ?? "");
        setBody(r.application.email_body ?? "");
        setLetter(sanitizePlainDocumentText(r.application.cover_letter ?? ""));
        const email = normalizeApplyEmail(r.application.application_email);
        if (email) setTo(email);
      }
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
      maybeShowReferralPrompt(precheck, "application pack");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const interviewMut = useMutation({
    mutationFn: () => generateInterviewQuestions({ jobId: jobId! }),
    onSuccess: (res) => {
      toast.success("Interview prep saved");
      focusInterview();
      qc.setQueryData(["marketplace-job", scrapedJobId], (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          application: res?.application ?? prev.application,
        };
      });
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
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
        applicationId: data.application.id as string,
        email_subject: subject,
        email_body: body,
        cover_letter: sanitizePlainDocumentText(letter),
        application_email: to.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () =>
      sendApplicationEmail({
        applicationId: data!.application!.id as string,
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
        qc.setQueryData(["marketplace-job", scrapedJobId], (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            application: res.application,
          };
        });
      }
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
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
        applicationId: data.application.id as string,
        email_subject: subject,
        email_body: body,
        cover_letter: sanitizePlainDocumentText(letter),
      });
    },
    onSuccess: (r) => {
      toast.success("Application pack saved to Google Drive", {
        description: `Email, cover letter, and CV are in folder “${r.folderName}”.`,
      });
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
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
      fallbackTitle: "Marketplace Job Details - Tellus",
    });
  }, [job?.title, job?.company, jobTitle]);

  const isEmailApply = job ? scanApplicationMethod(job as ScrapedJob) === "email" : false;
  const packMeta = parsePackAnswers(app?.pack_answers as string | null | undefined);
  const hay = job ? jobSourceHaystack(job) : "";

  const toggleMethodMut = useMutation({
    mutationFn: async () => {
      const nextMethod = isEmailApply ? "form" : "email";
      console.log("[toggleMethodMut] Clicked toggle. isEmailApply:", isEmailApply, "nextMethod:", nextMethod);
      console.log("[toggleMethodMut] jobId:", jobId, "scrapedJobId:", scrapedJobId);
      
      if (!jobId) {
        throw new Error("Job ID not found. Please wait for the page to finish loading.");
      }

      const { data: updateData, error } = await supabase
        .from("jobs")
        .update({ application_method: nextMethod })
        .eq("id", jobId)
        .select();

      console.log("[toggleMethodMut] Supabase update result:", { updateData, error });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Switched to ${isEmailApply ? "Form" : "Email"} application mode`);
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => {
      console.error("[toggleMethodMut] Error during toggle:", e);
      toast.error(e.message);
    },
  });

  const saveBookmarkMut = useMutation({
    mutationFn: () => toggleSaveJob(jobId!),
    onSuccess: (r) => {
      toast.success(r.saved ? "Job saved" : "Removed from saved jobs");
      qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["scraped_jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    if (isRevisit) {
      return <JobDetailSkeleton />;
    }
    const titleText = jobTitle ? ` "${jobTitle}"` : "";
    return (
      <ScrapingLoaderPanel
        title={`Generating details for${titleText}`}
        description="Matching this listing to your profile and preparing the detail view. This usually takes a few seconds..."
        className="min-h-[60vh]"
      />
    );
  }

  if (isError || !job) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center">
        <p className="text-muted-foreground">
          {(error as Error)?.message ?? "Job not found"}
        </p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/marketplace">Back to marketplace</Link>
        </Button>
      </div>
    );
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
      backTo={{ to: "/marketplace", label: "Marketplace" }}
      similarJobLink="marketplace"
      similarCurrentId={scrapedJobId}
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
      onInterviewReportRefresh={() => qc.invalidateQueries({ queryKey: ["marketplace-job", scrapedJobId] })}
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
