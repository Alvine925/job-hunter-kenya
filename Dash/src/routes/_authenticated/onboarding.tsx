import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearOnboardingCache, resetAuthReady, ensureAuthSessionReady } from "@/lib/auth-session";
import {
  getMyProfile,
  updateMyProfile,
  saveCvAndExtract,
  checkCvUploadLimit,
  type UsageLimitStatus,
} from "@/lib/api";
import { extractCvText } from "@/lib/cv-extract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReferralLimitModal } from "@/components/referral-limit-modal";
import { 
  Loader2, Lock, ArrowRight, Eye, EyeOff, FileText, UploadCloud, 
  ShieldCheck, ArrowUp, CheckCircle2, Link2, Mail, FolderOpen, AlertTriangle, CheckSquare
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import googleWarningMasked from "@/assets/google_warning_masked.png";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    title: "Onboarding - Tellus",
    meta: [
      { title: "Onboarding - Tellus" },
      { name: "description", content: "Set up your profile, upload your resume, and configure preferences to start matching roles." },
    ],
  }),
  component: OnboardingWizard,
});

function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // App Query Data
  const { data: user } = useQuery({
    queryKey: ["onboarding_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });

  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ["user_integrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("google_connected")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // State Management
  const [currentStep, setCurrentStep] = useState<"password" | "cv" | "integrations" | "profile">("cv");
  
  // Step 1 (Password) State
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2 (CV Upload) State
  const [file, setFile] = useState<File | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [cvStep, setCvStep] = useState<"idle" | "extract" | "upload" | "ai" | "done">("idle");
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [referralPromptOpen, setReferralPromptOpen] = useState(false);
  const [referralPromptMeta, setReferralPromptMeta] = useState({
    used: 1,
    limit: 2,
    actionLabel: "CV upload",
  });

  // CV upload limit — derived from the already-loaded profile query (no extra round-trip)
  const cvUploadsUsed: number = profileData?.cv_uploads_this_month ?? 0;
  const cvUploadsLimit: number = profileData?.cv_uploads_limit ?? 2;
  const cvLimitBlocked = profileData != null && cvUploadsUsed >= cvUploadsLimit;

  // Step 3 (Integrations) State
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Initialize correct active step based on user status
  useEffect(() => {
    if (profileLoading || integrationLoading) return;
    
    const hasPassword = profileData?.profile?.has_set_password;
    const hasCv = !!profileData?.profile?.cv_storage_path;
    const googleConnected = !!integration?.google_connected;

    if (!hasPassword) {
      setCurrentStep("password");
    } else if (!hasCv && localStorage.getItem("onboarding_skipped_cv") !== "true") {
      setCurrentStep("cv");
    } else if (!googleConnected && localStorage.getItem("onboarding_skipped_integrations") !== "true") {
      setCurrentStep("integrations");
    } else {
      setCurrentStep("profile");
    }
  }, [profileData, integration, profileLoading, integrationLoading]);

  // Google OAuth callback detection
  const isGoogleConnected = user?.identities?.some(i => i.provider === "google") ?? false;
  useEffect(() => {
    if (!isGoogleConnected || !user?.id || integration?.google_connected) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session?.provider_token && !session?.provider_refresh_token) return;
      await supabase.from("user_integrations").upsert({
        user_id: user.id,
        google_access_token: session.provider_token,
        google_refresh_token: session.provider_refresh_token,
        google_connected: true,
        google_scopes: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/documents",
        ],
      });
      clearOnboardingCache();
      queryClient.invalidateQueries({ queryKey: ["user_integrations"] });
      toast.success("Google connected!");
      setCurrentStep("profile");
    });
  }, [isGoogleConnected, user?.id, integration?.google_connected, queryClient]);

  // Stepper steps definition
  const steps = [];
  const startWithPassword = !profileData?.profile?.has_set_password;
  if (startWithPassword) {
    steps.push({ id: "password", label: "Password" });
  }
  steps.push({ id: "cv", label: "Upload CV" });
  steps.push({ id: "integrations", label: "Integrations" });
  steps.push({ id: "profile", label: "Profile" });

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Loading state
  if (profileLoading || integrationLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-[#F4986C]" />
      </div>
    );
  }

  // --- Handlers ---
  
  // Step 1: Password submit handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ has_set_password: true })
        .eq("id", user!.id);
      if (profileError) throw profileError;

      clearOnboardingCache();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Password secured!");
      setCurrentStep("cv");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPwLoading(false);
    }
  };

  // Step 2: CV file handlers
  const handleFileChange = (selectedFile: File | null) => {
    if (!selectedFile) return;
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      toast.error("Only PDF and DOCX files are allowed");
      return;
    }
    setFile(selectedFile);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleCvUpload = async () => {
    if (!file) return;
    setCvBusy(true);
    let precheck: UsageLimitStatus | null = null;
    try {
      precheck = await checkCvUploadLimit();
      if (!precheck.allowed) throw new Error(precheck.reason);

      // Record user consent for AI processing (FIX 8)
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({ ai_processing_consent_at: new Date().toISOString() })
          .eq("id", user.id);
      }

      setCvStep("extract");
      const text = await extractCvText(file);
      if (text.trim().length < 30) throw new Error("Could not read text from this file. Try a different export.");

      setCvStep("upload");
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      setCvStep("ai");
      const res = await saveCvAndExtract({ storage_path: path, file_name: file.name, cv_text: text });
      if (res && res.extracted) {
        localStorage.setItem("cv_suggestions", JSON.stringify({
          skills: res.extracted.skills ?? [],
          recommended_skills: res.extracted.recommended_skills ?? [],
          desired_roles: res.extracted.desired_roles ?? [],
          recommended_roles: res.extracted.recommended_roles ?? []
        }));
      }
      setCvStep("done");
      clearOnboardingCache();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("CV parsed and profile pre-filled");
      if (precheck.usage_count === 0) {
        setReferralPromptMeta({
          used: 1,
          limit: precheck.limit_count ?? cvUploadsLimit,
          actionLabel: "CV upload",
        });
        setReferralPromptOpen(true);
      }
      setCurrentStep("integrations");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
      setCvStep("idle");
    } finally {
      setCvBusy(false);
    }
  };

  const handleSkipCv = () => {
    localStorage.setItem("onboarding_skipped_cv", "true");
    setCurrentStep("integrations");
  };

  // Step 3: Integrations connect handler
  const handleConnectGoogle = async () => {
    setConnecting(true);
    window.location.href = "/api/auth/google-init?connect=1";
  };

  const handleSkipIntegrations = () => {
    localStorage.setItem("onboarding_skipped_integrations", "true");
    setCurrentStep("profile");
  };

  // Step 4: Finish onboarding handler
  const handleFinishOnboarding = async () => {
    try {
      if (user?.id) {
        await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
        clearOnboardingCache();
      }
      localStorage.setItem("onboarding_completed", "true");
      const target = localStorage.getItem("post_auth_redirect") || "/marketplace";
      localStorage.removeItem("post_auth_redirect");
      navigate({ to: target, replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update onboarding status");
    }
  };

  const handleFillProfileManually = async () => {
    try {
      if (user?.id) {
        await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
        clearOnboardingCache();
      }
      localStorage.setItem("onboarding_completed", "true");
      const target = localStorage.getItem("post_auth_redirect") || "/profile";
      localStorage.removeItem("post_auth_redirect");
      navigate({ to: target, replace: true });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update onboarding status");
    }
  };

  // Password strength calculation
  const passwordStrength =
    password.length === 0
      ? null
      : password.length < 6
        ? "weak"
        : password.length < 10
          ? "fair"
          : "strong";

  const cvLabels: Record<string, string> = {
    extract: "Reading your CV…",
    upload: "Uploading securely…",
    ai: "Extracting your profile…",
    done: "Done",
  };

  return (
    <div className="min-h-[100svh] flex flex-col bg-transparent px-4 py-6 sm:px-6 lg:px-8 overflow-y-auto">
      
      {/* ── Stepper progress indicator header ── */}
      <div className="w-full max-w-md mx-auto mb-6 sm:mb-10">
        <div className="flex items-center justify-between relative px-2">
          {steps.map((stepItem, index) => {
            const isActive = stepItem.id === currentStep;
            const isCompleted = index < currentStepIndex;
            return (
              <div key={stepItem.id} className="flex flex-col items-center relative z-10 flex-1 last:flex-none">
                <div className="flex items-center w-full">
                  {/* Step circle */}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border shadow-sm",
                      isActive
                        ? "bg-[#F4986C] text-white border-[#F4986C] scale-105"
                        : isCompleted
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-400 border-slate-200"
                    )}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  
                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-[2px] mx-2 bg-slate-100 dark:bg-muted/20 relative">
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300"
                        style={{ width: isCompleted ? "100%" : "0%" }}
                      />
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-semibold mt-2 whitespace-nowrap absolute top-8",
                    isActive
                      ? "text-slate-800 dark:text-white"
                      : isCompleted
                        ? "text-emerald-600"
                        : "text-slate-400"
                  )}
                >
                  {stepItem.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main wizard content panel ── */}
      <div className="flex-1 flex items-start justify-start md:items-center md:justify-center w-full max-w-md mx-auto py-2 sm:py-4">
        
        {/* STEP 1: SET PASSWORD */}
        {currentStep === "password" && (
          <div className="w-full space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFF5F0] flex items-center justify-center border border-orange-100/50 shadow-sm mx-auto mb-3">
                <Lock className="w-6 h-6 text-[#F4986C]" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Secure your account
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Create a password so you can also sign in with your email address anytime.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pw" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="pw"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-10 pl-10 pr-10 bg-white/70"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-800 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Strength */}
                {passwordStrength && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="flex gap-1 flex-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors duration-300",
                            passwordStrength === "weak" && i === 1
                              ? "bg-destructive"
                              : passwordStrength === "fair" && i <= 2
                                ? "bg-amber-400"
                                : passwordStrength === "strong"
                                  ? "bg-emerald-500"
                                  : "bg-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 capitalize">
                      {passwordStrength}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-semibold text-slate-700">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-10 pl-10 pr-10 bg-white/70"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-800 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={pwLoading || password.length < 6 || password !== confirmPassword}
                className="w-full h-10 bg-[#F4986C] hover:bg-[#F38E5B] text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 mt-2"
              >
                {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>Set password & continue</span>
              </Button>
            </form>
          </div>
        )}

        {/* STEP 2: UPLOAD CV */}
        {currentStep === "cv" && (
          <div className="w-full space-y-5 animate-in fade-in duration-300">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#FFF5F0] flex items-center justify-center border border-orange-100/50 shadow-sm mx-auto mb-3">
                <div className="relative">
                  <FileText className="w-7 h-7 text-slate-700" />
                  <div className="absolute -bottom-1 -right-1 bg-[#F4986C] text-white rounded-full p-0.5 border border-white flex items-center justify-center">
                    <ArrowUp className="w-3 h-3 stroke-[3px]" />
                  </div>
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Upload your CV
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                Upload your CV and we'll automatically extract your details to build your profile.
              </p>
            </div>

            {/* Limit notice */}
            {cvLimitBlocked && (
              <p className="text-xs text-center flex items-center justify-center gap-1 flex-wrap">
                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" />
                <span className="text-amber-700 font-medium">
                  {cvUploadsUsed}/{cvUploadsLimit} CV uploads used this month.
                </span>
                <button
                  onClick={handleSkipCv}
                  className="text-[#F4986C] font-semibold hover:underline underline-offset-2"
                >
                  Continue without uploading →
                </button>
              </p>
            )}

            {/* Drag Zone */}
            {!cvLimitBlocked && <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full border-2 border-dashed rounded-xl p-6 sm:p-8 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[170px] select-none",
                dragActive
                  ? "border-[#F4986C] bg-orange-50/10 scale-[1.01]"
                  : "border-slate-200 bg-slate-50/10 hover:bg-slate-50/40 hover:border-[#F4986C]/40"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />

              {file ? (
                <div className="flex flex-col items-center gap-2 animate-in fade-in duration-200">
                  <div className="w-10 h-10 rounded-lg bg-orange-50/50 flex items-center justify-center text-[#F4986C] border border-orange-100/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-slate-800 text-xs sm:text-sm max-w-[200px] sm:max-w-xs truncate px-2">
                    {file.name}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · Click or drag to change
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <UploadCloud className="w-8 h-8 text-blue-500 animate-pulse" />
                  <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                    Drag & drop your file here
                  </div>
                  <span className="text-[10px] text-slate-400">or</span>
                  <button
                    type="button"
                    className="px-3 py-1 border border-slate-200 rounded-md text-[10px] sm:text-xs font-semibold text-blue-600 bg-white shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Choose file
                  </button>
                  <div className="text-[10px] text-slate-400 mt-1">
                    PDF, DOCX — max 10 MB
                  </div>
                </div>
              )}
            </div>}

            {!cvLimitBlocked && (
              <>
                {/* Privacy */}
                <div className="w-full max-w-sm mx-auto bg-emerald-50/80 border border-emerald-100 text-emerald-800 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Your data is secure and private. We'll never share your CV.</span>
                </div>

                {/* AI Consent Checkbox (FIX 8) */}
                <label className="flex items-start gap-2.5 p-3 bg-[#FFF5F0]/30 border border-orange-100/30 cursor-pointer select-none text-[11px] sm:text-xs text-slate-700 rounded-lg text-left mt-2">
                  <input
                    id="ai-consent-checkbox"
                    type="checkbox"
                    checked={aiConsentChecked}
                    onChange={(e) => setAiConsentChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#F4986C] focus:ring-0 accent-[#F4986C]"
                  />
                  <span className="leading-tight font-medium">
                    I consent to having my CV parsed by third-party AI APIs (Google Gemini) to automatically pre-fill my Tellus profile.
                  </span>
                </label>

                {/* Loader */}
                {cvBusy && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground animate-pulse mt-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F4986C]" />
                    <span>{cvLabels[cvStep] ?? "Processing your CV…"}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-1">
                  <Button
                    onClick={handleCvUpload}
                    disabled={!file || cvBusy || !aiConsentChecked}
                    className="w-full h-10 bg-[#F4986C] hover:bg-[#F38E5B] active:bg-[#E38150] text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all"
                  >
                    {cvStep === "done" ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                    <span>Upload & analyze</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>

                  <button
                    onClick={handleSkipCv}
                    disabled={cvBusy}
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors py-1.5"
                  >
                    Skip CV upload for now
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: GOOGLE INTEGRATIONS */}
        {currentStep === "integrations" && (
          <div className="w-full space-y-5 animate-in fade-in duration-300">
            
            {/* Connected view */}
            {integration?.google_connected ? (
              <div className="text-center space-y-5">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500 animate-bounce" />
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Google Workspace Connected!
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Your Google account is linked. Tellus can now generate and store applications in your Drive and send emails directly.
                </p>
                <div className="pt-2">
                  <Button
                    onClick={() => setCurrentStep("profile")}
                    className="w-full h-10 bg-[#F4986C] hover:bg-[#F38E5B] text-white font-semibold rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <span>Proceed to Profile Completion</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Link view */
              <>
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm mx-auto mb-3">
                    <Link2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                    Link Google Workspace
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                    Allows Tellus to write cover letters to your Drive and send applications from your email.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <Mail className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-xs text-slate-800">Gmail Integration</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Drafts and sends application emails from your address.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <FolderOpen className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-xs text-slate-800">Google Drive & Docs</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Saves tailored CV modifications and draft portfolios.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <Button
                    onClick={() => {
                      setConsentChecked(false);
                      setModalOpen(true);
                    }}
                    className="w-full h-10 bg-[#F4986C] hover:bg-[#F38E5B] text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm transition-all"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Link Google Account</span>
                  </Button>

                  <button
                    onClick={handleSkipIntegrations}
                    className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors py-1.5"
                  >
                    Skip Google integration for now
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4: PROFILE COMPLETION PROMPT */}
        {currentStep === "profile" && (
          <div className="w-full space-y-6 animate-in fade-in duration-300">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center border border-orange-100 shadow-sm mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-[#F4986C] animate-pulse" />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Complete your profile
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
                You can upload a CV to parse details automatically, or fill out your summary, roles, and skills manually.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 max-w-sm mx-auto">
              {/* If skipped CV earlier, provide a quick upload CV prompt */}
              {!profileData?.profile?.cv_storage_path && (
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem("onboarding_skipped_cv");
                    setCurrentStep("cv");
                  }}
                  className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                >
                  <FileText className="w-4 h-4 text-[#F4986C]" />
                  <span>Upload CV Now</span>
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleFillProfileManually}
                className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 text-xs sm:text-sm"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Fill Details Manually</span>
              </Button>

              <Button
                onClick={handleFinishOnboarding}
                className="w-full h-11 bg-[#F4986C] hover:bg-[#F38E5B] active:bg-[#E38150] text-white font-bold rounded-xl shadow-md shadow-orange-500/10 flex items-center justify-center gap-1.5 text-sm transition-all"
              >
                <span>Go to Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* ── Google permissions warn modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-card w-full max-w-lg p-4 sm:p-5 rounded-none border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-none bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-base sm:text-lg text-foreground">Google OAuth Notice</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Secure Workspace Integration</p>
              </div>
            </div>
 
            {/* Warning Text */}
            <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed text-left">
              <p>
                To allow Tellus to draft letters in your Drive and send emails directly, Google will show a warning screen saying: <strong className="text-slate-800 dark:text-white">"Google hasn't verified this app"</strong> because our OAuth screen is currently in developer testing.
              </p>
              <p className="font-semibold text-slate-800 dark:text-white">
                ⚠️ Do not be alarmed by this warning.
              </p>
              <p>
                To bypass it, click <span className="font-bold text-slate-800 dark:text-white">"Advanced"</span> (on the bottom left) and then click <span className="font-bold text-blue-600 underline">"Go to Tellus (unsafe)"</span> to allow the secure OAuth login.
              </p>
            </div>
 
            {/* Warning image visualization with hidden email */}
            <div className="border border-slate-200/80 rounded-none overflow-hidden shadow-inner bg-slate-50/50 p-2 relative group select-none">
              <div className="absolute top-2 left-2 bg-[#F4986C] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-none shadow-sm">Help Guide Screenshot</div>
              <img 
                src={googleWarningMasked} 
                alt="Google Unverified Warning Walkthrough" 
                className="w-full h-auto object-contain rounded-none max-h-[220px]" 
                draggable={false}
              />
            </div>
 
            {/* Security checkboxes */}
            <div className="bg-slate-50 p-3.5 rounded-none space-y-2 border border-slate-100 text-[10px] sm:text-xs text-left">
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Direct integration (No third-party middleware used)</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>You can revoke this access at any time in your Google Settings</span>
              </div>
            </div>

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2.5 p-3 bg-[#FFF5F0]/50 border border-orange-100/50 cursor-pointer select-none text-[11px] sm:text-xs text-slate-700 rounded-none text-left">
              <input
                id="consent-checkbox"
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-none border-slate-300 text-[#F4986C] focus:ring-0 accent-[#F4986C]"
              />
              <span className="leading-tight font-medium">
                I understand Google will display an "unverified app" screen and agree to click <strong className="text-slate-900 font-semibold">"Advanced"</strong> ➔ <strong className="text-blue-600 font-semibold">"Go to Tellus (unsafe)"</strong> to proceed.
              </span>
            </label>
 
            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setModalOpen(false)} 
                disabled={connecting} 
                className="rounded-none text-xs font-semibold h-9"
              >
                Cancel
              </Button>
              
              <Button 
                onClick={handleConnectGoogle} 
                disabled={connecting || !consentChecked} 
                className="bg-[#F4986C] hover:bg-[#F38E5B] active:bg-[#E38150] text-white rounded-none gap-2 text-xs font-semibold h-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
                  </>
                ) : (
                  "Allow Access"
                )}
              </Button>
            </div>
            
          </div>
        </div>
      )}
      <ReferralLimitModal
        open={referralPromptOpen}
        onOpenChange={setReferralPromptOpen}
        profile={profileData?.profile}
        used={referralPromptMeta.used}
        limit={referralPromptMeta.limit}
        actionLabel={referralPromptMeta.actionLabel}
      />
      
    </div>
  );
}
