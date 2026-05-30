import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { analyzeAts, AtsAnalysisResult } from "@/lib/api";
import {
  ShieldCheck,
  Zap,
  Info,
  CheckCircle,
  AlertTriangle,
  FileText,
  Briefcase,
  ListPlus,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  Copy,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/cos/ats-score")({
  head: () => ({
    title: "ATS Optimizer - Tellus",
    meta: [
      { title: "ATS Optimizer - Tellus" },
      { name: "description", content: "Optimize your resume against target ATS systems to increase response rates." },
    ],
  }),
  component: AtsScorePage,
});

function AtsScorePage() {
  const [cvText, setCvText] = useState("");
  const [jdText, setJdText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AtsAnalysisResult | null>(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const cvWordCount = getWordCount(cvText);
  const jdWordCount = getWordCount(jdText);
  const isButtonDisabled = analyzing || cvWordCount < 10 || jdWordCount < 10;

  // Pre-fill CV text from profile summary and original parsed CV
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile-ats"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("professional_summary, skills, work_history, parsed_cv_text")
        .eq("id", data.user.id)
        .single();
      return prof;
    }
  });

  // Auto-prefill the CV text field with original parsed CV once profile finishes loading
  useEffect(() => {
    if (profile && !cvText) {
      if (profile.parsed_cv_text) {
        setCvText(profile.parsed_cv_text);
      } else {
        const skillsStr = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";
        const text = `${profile.professional_summary || ""}\n\nKey Skills: ${skillsStr}\n\nWork History:\n${profile.work_history || ""}`;
        setCvText(text);
      }
    }
  }, [profile, cvText]);

  const handlePrefillCV = () => {
    if (profile) {
      if (profile.parsed_cv_text) {
        setCvText(profile.parsed_cv_text);
        toast.success("Loaded original parsed CV text!");
      } else {
        const skillsStr = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";
        const text = `${profile.professional_summary || ""}\n\nKey Skills: ${skillsStr}\n\nWork History:\n${profile.work_history || ""}`;
        setCvText(text);
        toast.success("Loaded CV details from profile!");
      }
    } else {
      toast.error("No profile summary found. Please fill your CV details first.");
    }
  };

  const runAnalysis = async () => {
    if (!cvText.trim() || !jdText.trim()) {
      toast.error("Please provide both your CV text and the target Job Description");
      return;
    }

    setAnalyzing(true);
    setResult(null); // Clear previous scan results to provide dynamic feedback
    try {
      const res = await analyzeAts(cvText, jdText);
      if (res?.analysis) {
        setResult(res.analysis);
        toast.success("Resume ATS Scan Complete!");
      } else {
        throw new Error("Invalid scan result returned");
      }
    } catch (err: any) {
      console.error("ATS optimization error:", err);
      toast.error(err.message || "Failed to analyze CV compatibility. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied optimization draft for ${section}!`);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div className="text-left">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
            <ShieldCheck className="w-7 h-7 text-[#FD5D28] shrink-0" />
            ATS Optimizer
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>Compare your resume directly with the target job posting to scan for missing keywords, formatting flags, and word counts.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
      </div>

      {/* Editor Grid - Cardless */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: CV text */}
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between border-b border-slate-200/30 dark:border-border/5 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              My Resume Text
            </span>
            <Button
              variant="outline"
              onClick={handlePrefillCV}
              disabled={isProfileLoading}
              className="text-[10px] font-bold px-2 py-1 h-auto border-border/60 rounded-lg flex items-center gap-1 text-slate-500 hover:text-primary transition-all duration-200"
            >
              <RefreshCw className="w-3 h-3 shrink-0" />
              Reset to Original CV
            </Button>
          </div>
          <Textarea
            placeholder="Paste the text of your CV / resume here..."
            rows={12}
            value={cvText}
            onChange={(e) => setCvText(e.target.value)}
            className="bg-slate-100/30 dark:bg-slate-900/10 border-slate-200/50 dark:border-border/15 text-xs sm:text-sm rounded-xl leading-relaxed resize-none h-[300px] focus-visible:ring-[#FD5D28]/35 transition-shadow"
          />
        </div>

        {/* Right: Job Description text */}
        <div className="space-y-3 text-left">
          <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Briefcase className="w-4 h-4 text-primary shrink-0" />
              Job Description
            </span>
          </div>
          <Textarea
            placeholder="Paste the target job description details here..."
            rows={12}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            className="bg-slate-100/30 dark:bg-slate-900/10 border-slate-200/50 dark:border-border/15 text-xs sm:text-sm rounded-xl leading-relaxed resize-none h-[300px] focus-visible:ring-[#FD5D28]/35 transition-shadow"
          />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-2">
        <Button
          onClick={runAnalysis}
          disabled={isButtonDisabled}
          className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-extrabold text-xs sm:text-sm px-8 py-3 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 disabled:transform-none disabled:shadow-none"
        >
          <Search className={cn("w-5 h-5 shrink-0", analyzing && "animate-spin")} />
          {analyzing ? "Analyzing Resume..." : "Run ATS Analysis"}
        </Button>
        {isButtonDisabled && !analyzing && (
          <p className="text-[10px] text-muted-foreground font-semibold select-none">
            Please enter at least 10 words in both fields to run analysis (Current: CV: {cvWordCount} words, JD: {jdWordCount} words).
          </p>
        )}
      </div>

      {/* Results Workspace - Premium UI */}
      {result && (
        <div className="space-y-8 border-t border-slate-200/30 dark:border-border/5 pt-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
          
          {/* Low Score Warning Callout */}
          {result.score < 75 && (
            <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 items-start text-left shadow-[0_2px_8px_-4px_rgba(239,68,68,0.1)]">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-400">ATS Score is low</h4>
                <p className="text-[11px] sm:text-xs text-rose-600/90 dark:text-rose-300/80 leading-relaxed">
                  A match score below 75% indicates significant gaps between your resume and this job's core criteria. Review the highlighted keyword gaps and use the copyable section recommendations below to customize your CV before applying.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Match Dial & Diagnostic Checks */}
            <div className="lg:col-span-1 space-y-6 text-left">
              {/* Score card */}
              <div className="bg-slate-50/40 dark:bg-slate-900/20 border border-slate-200/40 dark:border-border/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">ATS Compatibility</span>
                <div className="flex items-center gap-5">
                  <div className="relative w-24 h-24 flex items-center justify-center rounded-full border-4 border-slate-100 dark:border-slate-800 shrink-0 select-none">
                    <div className={cn(
                      "absolute inset-0 rounded-full border-4 border-transparent transition-all duration-1000",
                      result.score >= 80 
                        ? "border-t-emerald-500 border-r-emerald-500 border-b-emerald-500/40" 
                        : result.score >= 60 
                          ? "border-t-amber-500 border-r-amber-500 border-b-amber-500/40" 
                          : "border-t-rose-500 border-r-rose-500 border-b-rose-500/40"
                    )} />
                    <span className="text-3xl font-black text-foreground leading-none">{result.score}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className={cn(
                      "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border uppercase leading-none",
                      result.score >= 80
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                        : result.score >= 60
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                          : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400"
                    )}>
                      {result.score >= 80 ? "High Match" : result.score >= 60 ? "Average Match" : "Gap Alert"}
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                      {result.summary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Formatting and Structural Checklist */}
              <div className="bg-slate-50/40 dark:bg-slate-900/20 border border-slate-200/40 dark:border-border/10 rounded-2xl p-5 sm:p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Formatting Diagnostics</h3>
                <div className="space-y-4">
                  {result.checks.map((check, idx) => (
                    <div key={idx} className="flex gap-3 items-start text-xs leading-normal">
                      {check.status === "pass" ? (
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : check.status === "warning" ? (
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className="font-bold text-foreground block">{check.name}</span>
                        <span className="text-muted-foreground text-[10.5px] block leading-relaxed">{check.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Keyword Gaps & Improvement Sections */}
            <div className="lg:col-span-2 space-y-8">
              {/* Keyword Coverage Analysis */}
              <div className="bg-slate-50/40 dark:bg-slate-900/20 border border-slate-200/40 dark:border-border/10 rounded-2xl p-5 sm:p-6 text-left space-y-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5 pb-2 border-b border-slate-200/20 dark:border-border/5">
                  <ListPlus className="w-4.5 h-4.5 text-primary shrink-0" />
                  Keyword Coverage Analysis
                </h3>

                {/* Missing Keywords */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-[#FD5D28] uppercase tracking-wider flex items-center gap-1 select-none">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Missing / Weak Keywords ({result.missing.length})
                  </span>
                  {result.missing.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {result.missing.map((word) => (
                        <span key={word} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FD5D28]/5 text-[#FD5D28] border border-[#FD5D28]/15 capitalize hover:bg-[#FD5D28]/10 transition-colors duration-200">
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-semibold">Perfect keyword alignment! Your CV fully covers key terms from this job post.</p>
                  )}
                </div>

                {/* Matched Keywords */}
                <div className="space-y-2 border-t border-slate-200/20 dark:border-border/5 pt-4">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1 select-none">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Successfully Matched Keywords ({result.matched.length})
                  </span>
                  {result.matched.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {result.matched.map((word) => (
                        <span key={word} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/10 hover:bg-emerald-500/10 transition-colors duration-200">
                          {word}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No key matching terms detected yet.</p>
                  )}
                </div>
              </div>

              {/* Sections to Improve & Suggestions */}
              <div className="space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    Sections to Improve
                  </h3>
                  <Badge variant="outline" className="text-[9px] font-bold tracking-wider px-2 py-0.5 border-[#FD5D28]/20 text-[#FD5D28] uppercase select-none">
                    AI agent recommendations
                  </Badge>
                </div>

                <div className="space-y-4">
                  {result.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="bg-slate-50/40 dark:bg-slate-900/20 border border-slate-200/40 dark:border-border/10 rounded-2xl p-5 sm:p-6 space-y-4 hover:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      {/* Top bar: label + copy */}
                      <div className="flex items-center justify-between border-b border-slate-200/25 dark:border-border/5 pb-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                          {rec.section}
                        </span>
                        <Button
                          variant="ghost"
                          onClick={() => handleCopy(rec.suggestion, rec.section)}
                          className="h-auto p-1.5 text-[10px] font-extrabold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-primary transition-colors cursor-pointer select-none"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy Draft
                        </Button>
                      </div>

                      {/* Content panel */}
                      <div className="space-y-3.5">
                        {/* Findings */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Gap / Finding</span>
                          <p className="text-xs text-muted-foreground leading-relaxed italic bg-amber-500/5 dark:bg-amber-500/10 border-l-2 border-amber-500/40 p-2 rounded-r-lg">
                            {rec.current}
                          </p>
                        </div>

                        {/* Rewrite Draft */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Optimized Rewrite Draft</span>
                          <p className="text-xs text-foreground bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-border/10 p-3 rounded-xl leading-relaxed whitespace-pre-wrap font-medium">
                            {rec.suggestion}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      <LearnMoreSlider
        pageId="ats-score"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
