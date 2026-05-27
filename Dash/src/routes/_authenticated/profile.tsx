import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyProfile,
  updateMyProfile,
  saveCvAndExtract,
  checkCvUploadLimit,
  type UsageLimitStatus,
} from "@/lib/api";
import { extractCvText } from "@/lib/cv-extract";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReferralLimitModal } from "@/components/referral-limit-modal";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProfileSkeleton } from "@/components/ui/skeleton-loaders";
import type { LucideIcon } from "lucide-react";
import {
  Loader2,
  FileText,
  ArrowRight,
  Upload,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Globe,
  GraduationCap,
  Award,
  PenSquare,
  Check,
  X,
  Briefcase,
  Sparkles,
  ExternalLink,
  UploadCloud,
  ShieldCheck,
  CheckCircle2,
  ArrowUp,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    title: "My Profile - Tellus",
    meta: [
      { title: "My Profile - Tellus" },
      { name: "description", content: "Manage your resume, profile details, and skills catalog to ensure high-accuracy AI matching." },
    ],
  }),
  component: Profile,
});

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  skills: string;
  professional_summary: string;
  work_history: string;
  education: string;
  desired_roles: string;
  preferred_county: string;
  linkedin_url: string;
  certifications: string;
  languages: string;
};

type CvSuggestions = {
  skills: string[];
  recommended_skills: string[];
  desired_roles: string[];
  recommended_roles: string[];
};

const EMPTY_FORM: ProfileForm = {
  full_name: "",
  email: "",
  phone: "",
  skills: "",
  professional_summary: "",
  work_history: "",
  education: "",
  desired_roles: "",
  preferred_county: "",
  linkedin_url: "",
  certifications: "",
  languages: "",
};

function profileToForm(p: Record<string, unknown>): ProfileForm {
  return {
    full_name: (p.full_name as string) ?? "",
    email: (p.email as string) ?? "",
    phone: (p.phone as string) ?? "",
    skills: ((p.skills as string[]) ?? []).join(", "),
    professional_summary: (p.professional_summary as string) ?? "",
    work_history: (p.work_history as string) ?? "",
    education: (p.education as string) ?? "",
    desired_roles: ((p.desired_roles as string[]) ?? []).join(", "),
    preferred_county: (p.preferred_county as string) ?? "",
    linkedin_url: (p.linkedin_url as string) ?? "",
    certifications: (p.certifications as string) ?? "",
    languages: (p.languages as string) ?? "",
  };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      {children}
    </h3>
  );
}

function LineTimeline({ lines, dotClass }: { lines: string[]; dotClass: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="space-y-0">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className="relative pl-5 sm:pl-6 pb-4 last:pb-0 border-l border-border/50 last:border-l-0"
        >
          <div
            className={cn(
              "absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-background",
              dotClass,
            )}
          />
          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{line}</p>
        </div>
      ))}
    </div>
  );
}

function splitLines(text: string) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function splitTags(text: string) {
  return text.split(",").map((s) => s.trim()).filter(Boolean);
}

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const cvUploadsUsed: number = data?.cv_uploads_this_month ?? 0;
  const cvUploadsLimit: number = data?.cv_uploads_limit ?? 2;
  const cvLimitBlocked = data != null && cvUploadsUsed >= cvUploadsLimit;
  const { data: authUser } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      return auth.user;
    },
  });

  const [form, setForm] = useState<ProfileForm>({ ...EMPTY_FORM });
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState<CvSuggestions | null>(null);

  const [cvDialogOpen, setCvDialogOpen] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvDragActive, setCvDragActive] = useState(false);
  const [cvStep, setCvStep] = useState<"idle" | "extract" | "upload" | "ai" | "done">("idle");
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [referralPromptOpen, setReferralPromptOpen] = useState(false);
  const [referralPromptMeta, setReferralPromptMeta] = useState({
    used: 1,
    limit: 2,
    actionLabel: "CV upload",
  });
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  const handleCvFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      toast.error("Only PDF and DOCX files are allowed");
      return;
    }
    setCvFile(selectedFile);
  };

  const handleCvDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setCvDragActive(true);
    } else if (e.type === "dragleave") {
      setCvDragActive(false);
    }
  };

  const handleCvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCvDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCvFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleOpenCvDialog = async () => {
    try {
      const limit = await checkCvUploadLimit();
      if (!limit.allowed) {
        toast.error(limit.reason);
        return;
      }
    } catch {
      // If the check itself fails, still allow the dialog to open (server will catch it)
    }
    setCvFile(null);
    setCvStep("idle");
    setAiConsentChecked(false);
    setCvDialogOpen(true);
  };

  const handleCvUpload = async () => {
    if (!cvFile) return;
    setCvBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    let precheck: UsageLimitStatus | null = null;
    try {
      precheck = await checkCvUploadLimit();
      if (!precheck.allowed) throw new Error(precheck.reason);

      // Record user consent for AI processing (FIX 8)
      if (userId) {
        await supabase
          .from("profiles")
          .update({ ai_processing_consent_at: new Date().toISOString() })
          .eq("id", userId);
      }

      setCvStep("extract");
      const text = await extractCvText(cvFile);
      if (text.trim().length < 30) throw new Error("Could not read text from this file. Try a different export.");

      setCvStep("upload");
      const path = `${userId}/${Date.now()}-${cvFile.name}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, cvFile, { upsert: true });
      if (upErr) throw upErr;

      setCvStep("ai");
      const res = await saveCvAndExtract({ storage_path: path, file_name: cvFile.name, cv_text: text });
      if (res && res.extracted) {
        localStorage.setItem("cv_suggestions", JSON.stringify({
          skills: res.extracted.skills ?? [],
          recommended_skills: res.extracted.recommended_skills ?? [],
          desired_roles: res.extracted.desired_roles ?? [],
          recommended_roles: res.extracted.recommended_roles ?? [],
        }));
        setSuggestions({
          skills: res.extracted.skills ?? [],
          recommended_skills: res.extracted.recommended_skills ?? [],
          desired_roles: res.extracted.desired_roles ?? [],
          recommended_roles: res.extracted.recommended_roles ?? [],
        });
      }
      setCvStep("done");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("CV parsed and profile pre-filled");
      setCvDialogOpen(false);
      setCvFile(null);
      setCvStep("idle");
      setIsEditing(true);
      if (precheck.usage_count === 0) {
        setReferralPromptMeta({
          used: 1,
          limit: precheck.limit_count ?? cvUploadsLimit,
          actionLabel: "CV upload",
        });
        setReferralPromptOpen(true);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setCvStep("idle");
    } finally {
      setCvBusy(false);
    }
  };

  const cvStepLabels: Record<string, string> = {
    extract: "Reading your CV…",
    upload: "Uploading securely…",
    ai: "Extracting your profile…",
    done: "Done",
  };

  const avatarUrl = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture || "";
  const nameVal = form.full_name || (data?.profile?.full_name as string | undefined) || "Your Name";
  const initials = nameVal
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const syncFormFromProfile = useCallback((p: Record<string, unknown>) => {
    setForm(profileToForm(p));
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("cv_suggestions");
    if (!raw) return;
    try {
      setSuggestions(JSON.parse(raw));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!data?.profile) return;
    syncFormFromProfile(data.profile);
    if (!data.profile.full_name) setIsEditing(true);
  }, [data, syncFormFromProfile]);

  const addSuggestion = (field: "skills" | "desired_roles", value: string) => {
    const currentVal = form[field] || "";
    const items = splitTags(currentVal);
    if (!items.map((s) => s.toLowerCase()).includes(value.toLowerCase())) {
      items.push(value);
      setForm((f) => ({ ...f, [field]: items.join(", ") }));
      toast.success(`Added "${value}"`);
    }
  };

  const handleCancel = () => {
    if (data?.profile) syncFormFromProfile(data.profile);
    setIsEditing(false);
  };

  const mut = useMutation({
    mutationFn: (_vars: { continueToJobs?: boolean } = {}) =>
      updateMyProfile({
        ...form,
        skills: splitTags(form.skills),
        desired_roles: splitTags(form.desired_roles),
      }),
    onSuccess: (_res, vars) => {
      toast.success("Profile saved");
      localStorage.removeItem("cv_suggestions");
      setSuggestions(null);
      setIsEditing(false);
      if (vars?.continueToJobs) navigate({ to: "/marketplace" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof ProfileForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  const hasCv = !!data?.profile?.cv_storage_path;
  const roleTags = splitTags(form.desired_roles);
  const skillTags = splitTags(form.skills);

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
          <div className="space-y-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">My profile</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Personal details, CV data, and match preferences used across Tellus Hire.
              </p>
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:ml-auto">
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm border-border/60"
                >
                  <PenSquare className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
                  <span className="truncate">Edit profile</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 w-full font-semibold text-xs sm:text-sm border-border/60"
                  onClick={handleOpenCvDialog}
                  disabled={cvLimitBlocked}
                  title={cvLimitBlocked ? "Monthly upload limit reached" : undefined}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5 text-primary shrink-0" />
                  <span className="truncate">{hasCv ? "Re-upload CV" : "Upload CV"}</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:ml-auto sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={mut.isPending}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm border-border/60"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => mut.mutate({})}
                  disabled={mut.isPending}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm shadow-sm"
                >
                  {mut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* CV status */}
        <section
          className="flex flex-col gap-3 pb-6 border-b border-border/60 min-w-0"
          aria-label="CV status"
        >
          <div className="flex items-start gap-3">
            <FileText
              className={cn("w-5 h-5 shrink-0 mt-0.5", hasCv ? "text-primary" : "text-amber-600")}
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {hasCv ? "CV synchronized" : "No CV uploaded"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {hasCv
                  ? "Profile fields are populated from your CV for matching and applications."
                  : "Upload a CV to extract skills, experience, and roles automatically."}
              </p>
            </div>
          </div>

          {data != null && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              <AlertTriangle className={cn("w-3 h-3 shrink-0", cvLimitBlocked ? "text-amber-500" : "hidden")} />
              <span className={cvLimitBlocked ? "text-amber-700 font-medium" : ""}>
                {cvUploadsUsed}/{cvUploadsLimit} CV uploads used this month.
              </span>
              {cvLimitBlocked && (
                <Link to="/settings" search={{ tab: "referral" } as never} className="text-primary font-semibold hover:underline underline-offset-2">
                  Invite friends to unlock more →
                </Link>
              )}
            </p>
          )}
        </section>

        {!isEditing ? (
          <ProfilePreview
            form={form}
            avatarUrl={avatarUrl}
            initials={initials}
            roleTags={roleTags}
            skillTags={skillTags}
          />
        ) : (
          <ProfileEditForm
            form={form}
            set={set}
            avatarUrl={avatarUrl}
            initials={initials}
            suggestions={suggestions}
            addSuggestion={addSuggestion}
            isSaving={mut.isPending}
            onSave={() => mut.mutate({})}
            onSaveAndJobs={() => mut.mutate({ continueToJobs: true })}
            onCancel={handleCancel}
          />
        )}
      </main>

      <Dialog open={cvDialogOpen} onOpenChange={(open) => { if (!cvBusy) setCvDialogOpen(open); }}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="relative">
                <FileText className="w-5 h-5 text-slate-700" />
                <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5 flex items-center justify-center">
                  <ArrowUp className="w-2.5 h-2.5 stroke-[3px]" />
                </div>
              </div>
              {hasCv ? "Re-upload CV" : "Upload your CV"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Upload your CV and we'll automatically extract your details to update your profile.
            </p>

            <div
              onDragEnter={handleCvDrag}
              onDragOver={handleCvDrag}
              onDragLeave={handleCvDrag}
              onDrop={handleCvDrop}
              onClick={() => cvFileInputRef.current?.click()}
              className={cn(
                "w-full border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[150px] select-none",
                cvDragActive
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-slate-200 bg-slate-50/10 hover:bg-slate-50/40 hover:border-primary/40"
              )}
            >
              <input
                type="file"
                ref={cvFileInputRef}
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleCvFileChange(e.target.files?.[0] ?? null)}
              />

              {cvFile ? (
                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-sm max-w-[220px] truncate px-2">{cvFile.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {(cvFile.size / 1024).toFixed(0)} KB · Click or drag to change
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <UploadCloud className="w-8 h-8 text-blue-500" />
                  <div className="font-semibold text-sm">Drag & drop your file here</div>
                  <span className="text-[10px] text-slate-400">or</span>
                  <button
                    type="button"
                    className="px-3 py-1 border border-slate-200 rounded-md text-[10px] font-semibold text-blue-600 bg-white shadow-sm hover:bg-slate-50"
                  >
                    Choose file
                  </button>
                  <div className="text-[10px] text-slate-400 mt-1">PDF, DOCX — max 10 MB</div>
                </div>
              )}
            </div>

            <div className="bg-emerald-50/80 border border-emerald-100 text-emerald-800 py-2 px-3 rounded-lg flex items-center gap-1.5 text-[10px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Your data is secure and private. We'll never share your CV.</span>
            </div>

            {/* AI Consent Checkbox (FIX 8) */}
            <label className="flex items-start gap-2.5 p-3 bg-primary/5 border border-primary/10 cursor-pointer select-none text-[11px] sm:text-xs text-slate-700 rounded-lg text-left mt-2">
              <input
                id="ai-consent-checkbox"
                type="checkbox"
                checked={aiConsentChecked}
                onChange={(e) => setAiConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-0 accent-primary"
              />
              <span className="leading-tight font-medium">
                I consent to having my CV parsed by third-party AI APIs (Google Gemini) to automatically pre-fill/update my Tellus profile.
              </span>
            </label>

            {cvBusy && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>{cvStepLabels[cvStep] ?? "Processing your CV…"}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-9 text-xs font-semibold border-border/60"
                onClick={() => setCvDialogOpen(false)}
                disabled={cvBusy}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-9 text-xs font-semibold"
                onClick={handleCvUpload}
                disabled={!cvFile || cvBusy || !aiConsentChecked}
              >
                {cvStep === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                ) : cvBusy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : null}
                Upload & analyse
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ReferralLimitModal
        open={referralPromptOpen}
        onOpenChange={setReferralPromptOpen}
        profile={data?.profile}
        used={referralPromptMeta.used}
        limit={referralPromptMeta.limit}
        actionLabel={referralPromptMeta.actionLabel}
      />
    </div>
  );
}

function ProfilePreview({
  form,
  avatarUrl,
  initials,
  roleTags,
  skillTags,
}: {
  form: ProfileForm;
  avatarUrl: string;
  initials: string;
  roleTags: string[];
  skillTags: string[];
}) {
  const linkedinHref = form.linkedin_url
    ? form.linkedin_url.startsWith("http")
      ? form.linkedin_url
      : `https://${form.linkedin_url}`
    : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Identity */}
      <section className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4 sm:gap-5">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary/20 shrink-0">
          <AvatarImage src={avatarUrl} alt={form.full_name || "Profile photo"} />
          <AvatarFallback className="bg-primary/5 text-primary text-lg font-bold">
            {initials || "US"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {form.full_name || "Your name"}
          </h2>
          {form.email && <p className="text-sm text-muted-foreground">{form.email}</p>}
          {roleTags.length > 0 && (
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5">
              {roleTags.map((role) => (
                <Badge
                  key={role}
                  variant="secondary"
                  className="text-[10px] sm:text-xs font-medium"
                >
                  {role}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact */}
      {(form.email || form.phone || form.preferred_county || linkedinHref || form.languages) && (
        <section className="pb-6 border-b border-border/60 space-y-3">
          <SectionTitle icon={Mail}>Contact</SectionTitle>
          <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 text-sm">
            {form.phone && (
              <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <dd className="text-foreground">{form.phone}</dd>
              </div>
            )}
            {form.preferred_county && (
              <div className="flex items-center gap-2 min-w-0 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" />
                <dd className="text-foreground">{form.preferred_county} County</dd>
              </div>
            )}
            {linkedinHref && (
              <div className="flex items-center gap-2 min-w-0">
                <Linkedin className="w-4 h-4 shrink-0 text-muted-foreground" />
                <dd>
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    LinkedIn
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </dd>
              </div>
            )}
            {form.languages && (
              <div className="flex items-center gap-2 min-w-0 text-muted-foreground min-[400px]:col-span-2">
                <Globe className="w-4 h-4 shrink-0" />
                <dd className="text-foreground">{form.languages}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {form.professional_summary && (
        <section className="pb-6 border-b border-border/60 space-y-3">
          <SectionTitle icon={Sparkles}>Professional summary</SectionTitle>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {form.professional_summary}
          </p>
        </section>
      )}

      {skillTags.length > 0 && (
        <section className="pb-6 border-b border-border/60 space-y-3">
          <SectionTitle icon={Award}>Skills</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {skillTags.map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs font-medium">
                {skill}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {form.work_history && (
          <section className="space-y-3">
            <SectionTitle icon={Briefcase}>Work history</SectionTitle>
            <LineTimeline lines={splitLines(form.work_history)} dotClass="bg-primary/70" />
          </section>
        )}

        <div className="space-y-6 sm:space-y-8">
          {form.education && (
            <section className="space-y-3">
              <SectionTitle icon={GraduationCap}>Education</SectionTitle>
              <LineTimeline lines={splitLines(form.education)} dotClass="bg-muted-foreground/40" />
            </section>
          )}
          {form.certifications && (
            <section className="space-y-3">
              <SectionTitle icon={Award}>Certifications</SectionTitle>
              <LineTimeline lines={splitLines(form.certifications)} dotClass="bg-amber-500/70" />
            </section>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pt-2 border-t border-border/60">
        <Link to="/marketplace" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto font-semibold h-10 sm:h-9">
            Browse marketplace
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
        <Link to="/configuration" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto h-10 sm:h-9 border-border/60 font-semibold">
            Configure automation
          </Button>
        </Link>
      </section>
    </div>
  );
}

function ProfileEditForm({
  form,
  set,
  avatarUrl,
  initials,
  suggestions,
  addSuggestion,
  isSaving,
  onSave,
  onSaveAndJobs,
  onCancel,
}: {
  form: ProfileForm;
  set: (k: keyof ProfileForm, v: string) => void;
  avatarUrl: string;
  initials: string;
  suggestions: CvSuggestions | null;
  addSuggestion: (field: "skills" | "desired_roles", value: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onSaveAndJobs: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 pb-6 border-b border-border/60">
        <Avatar className="h-12 w-12 border border-primary/20 shrink-0">
          <AvatarImage src={avatarUrl} alt={form.full_name || "Profile photo"} />
          <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
            {initials || "US"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold text-foreground truncate">{form.full_name || "Your name"}</p>
          <p className="text-xs text-muted-foreground">Editing profile details</p>
        </div>
      </div>

      <fieldset className="space-y-8 border-0 p-0 m-0 min-w-0">
        <section className="space-y-4 pb-8 border-b border-border/60">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Personal details
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">LinkedIn URL</Label>
              <Input
                value={form.linkedin_url}
                onChange={(e) => set("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="h-10 sm:h-9"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 pb-8 border-b border-border/60">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Preferences & skills
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preferred county</Label>
              <Input
                value={form.preferred_county}
                onChange={(e) => set("preferred_county", e.target.value)}
                placeholder="Nairobi"
                className="h-10 sm:h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Languages</Label>
              <Input
                value={form.languages}
                onChange={(e) => set("languages", e.target.value)}
                placeholder="English, Swahili"
                className="h-10 sm:h-9"
              />
            </div>
          </div>

          <SuggestionField
            label="Desired roles (comma-separated)"
            value={form.desired_roles}
            onChange={(v) => set("desired_roles", v)}
            placeholder="Software Engineer, Data Analyst"
            suggestions={suggestions}
            field="desired_roles"
            onAdd={addSuggestion}
          />

          <SuggestionField
            label="Skills (comma-separated)"
            value={form.skills}
            onChange={(v) => set("skills", v)}
            placeholder="React, Python, SQL"
            suggestions={suggestions}
            field="skills"
            onAdd={addSuggestion}
          />
        </section>

        <section className="space-y-4">
          <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Professional background
          </legend>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Professional summary</Label>
            <Textarea
              rows={4}
              value={form.professional_summary}
              onChange={(e) => set("professional_summary", e.target.value)}
              className="resize-y text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Work history (one entry per line)</Label>
            <Textarea
              rows={5}
              value={form.work_history}
              onChange={(e) => set("work_history", e.target.value)}
              placeholder="Role, Company (Date range)"
              className="resize-y text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Education (one entry per line)</Label>
            <Textarea
              rows={4}
              value={form.education}
              onChange={(e) => set("education", e.target.value)}
              placeholder="Degree, Institution (Year)"
              className="resize-y text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Certifications (one entry per line)</Label>
            <Textarea
              rows={3}
              value={form.certifications}
              onChange={(e) => set("certifications", e.target.value)}
              placeholder="Certification, Issuer (Year)"
              className="resize-y text-sm font-mono"
            />
          </div>
        </section>
      </fieldset>

      <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap pt-6 border-t border-border/60">
        <Button onClick={onSave} disabled={isSaving} className="h-10 sm:h-9 w-full sm:w-auto font-semibold">
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save profile
        </Button>
        <Button
          onClick={onSaveAndJobs}
          disabled={isSaving}
          variant="secondary"
          className="h-10 sm:h-9 w-full sm:w-auto font-semibold"
        >
          Save & find jobs
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isSaving}
          className="h-10 sm:h-9 w-full sm:w-auto border-border/60"
        >
          Cancel
        </Button>
      </section>
    </div>
  );
}

function SuggestionField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  field,
  onAdd,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: CvSuggestions | null;
  field: "skills" | "desired_roles";
  onAdd: (field: "skills" | "desired_roles", value: string) => void;
}) {
  const extracted = field === "skills" ? suggestions?.skills : suggestions?.desired_roles;
  const recommended =
    field === "skills" ? suggestions?.recommended_skills : suggestions?.recommended_roles;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 sm:h-9"
      />
      {suggestions && ((extracted?.length ?? 0) > 0 || (recommended?.length ?? 0) > 0) && (
        <div className="space-y-2 pt-1">
          {extracted && extracted.length > 0 && (
            <SuggestionChips
              title={field === "skills" ? "From CV" : "From CV"}
              items={extracted}
              onPick={(v) => onAdd(field, v)}
            />
          )}
          {recommended && recommended.length > 0 && (
            <SuggestionChips
              title="Suggested"
              items={recommended}
              onPick={(v) => onAdd(field, v)}
              variant="emerald"
            />
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionChips({
  title,
  items,
  onPick,
  variant = "primary",
}: {
  title: string;
  items: string[];
  onPick: (v: string) => void;
  variant?: "primary" | "emerald";
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full sm:w-auto sm:mr-1">
        {title}
      </span>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onPick(item)}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full font-medium transition",
            variant === "primary"
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/15",
          )}
        >
          + {item}
        </button>
      ))}
    </div>
  );
}
