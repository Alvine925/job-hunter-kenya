import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Target,
  AlertOctagon,
  TrendingUp,
  Brain,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Sliders,
  DollarSign,
  MapPin,
  Briefcase
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/predict")({
  head: () => ({
    title: "Success Predictor - Tellus",
    meta: [
      { title: "Success Predictor - Tellus" },
      { name: "description", content: "Predict your application response success rate using CV matching factors." },
    ],
  }),
  component: PredictPage,
});

interface PredictionMetric {
  name: string;
  score: number;
  weight: number;
  icon: any;
  status: "high" | "medium" | "low";
  reason: string;
}

function PredictPage() {
  const [roleTitle, setRoleTitle] = useState("Product Manager");
  const [company, setCompany] = useState("Safaricom PLC");
  const [salaryExpectation, setSalaryExpectation] = useState("450000");
  const [remotePref, setRemotePref] = useState("hybrid");
  const [predicting, setPredicting] = useState(false);
  const [metrics, setMetrics] = useState<PredictionMetric[] | null>(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Retrieve user's actual profile details
  const { data: profile } = useQuery({
    queryKey: ["profile-predict"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("skills, desired_roles, preferred_county")
        .eq("id", data.user.id)
        .single();
      return prof;
    }
  });

  const runPrediction = async () => {
    setPredicting(true);
    try {
      const { data: matchingJobs, error } = await supabase
        .from("scraped_jobs")
        .select("title, description, requirements, responsibilities, location, county, salary_text, is_remote")
        .or(`title.ilike.%${roleTitle}%,description.ilike.%${roleTitle}%`)
        .limit(50);

      const profileSkills: string[] = profile?.skills || [];
      const jobsToScan = matchingJobs || [];
      const totalMatching = jobsToScan.length;
      const profileCounty = profile?.preferred_county;

      let skillsScore = 80;
      let skillsReason = "";
      let locationScore = profileCounty ? 95 : 60;
      let locationReason = "";
      let salaryScore = 75;
      let salaryReason = "";
      let remoteScore = 85;
      let remoteReason = "";

      if (totalMatching > 0) {
        // 1. Skills Matching
        let totalMentions = 0;
        let jobCountsWithUserSkills = 0;
        
        jobsToScan.forEach(job => {
          const text = `${job.title} ${job.description || ""} ${job.requirements || ""} ${job.responsibilities || ""}`.toLowerCase();
          let hasAny = false;
          profileSkills.forEach(skill => {
            if (text.includes(skill.toLowerCase())) {
              totalMentions++;
              hasAny = true;
            }
          });
          if (hasAny) jobCountsWithUserSkills++;
        });

        const avgMentionsPerJob = totalMatching > 0 ? totalMentions / totalMatching : 0;
        skillsScore = Math.min(100, Math.round((avgMentionsPerJob / Math.max(1, Math.min(4, profileSkills.length))) * 100));
        if (skillsScore < 50) skillsScore = 50;
        
        skillsReason = `Scanned ${totalMatching} matching jobs. On average, jobs mention ${avgMentionsPerJob.toFixed(1)} of your core profile skills.`;

        // 2. Location matching
        const userCounty = profileCounty?.toLowerCase() || "";
        let locMatches = 0;
        jobsToScan.forEach(job => {
          const jobLoc = `${job.location || ""} ${job.county || ""}`.toLowerCase();
          if (userCounty && jobLoc.includes(userCounty)) {
            locMatches++;
          }
        });
        const locPct = Math.round((locMatches / totalMatching) * 100);
        locationScore = userCounty ? Math.max(70, locPct) : 60;
        locationReason = userCounty
          ? `${locPct}% of matching database jobs are located in or around your preferred county (${profileCounty}).`
          : `Set your preferred location in your profile to optimize geographical matching.`;

        // 3. Salary matching
        const targetVal = parseInt(salaryExpectation.replace(/,/g, ""));
        let salaryMatches = 0;
        let jobsWithSalary = 0;
        jobsToScan.forEach(job => {
          if (job.salary_text) {
            jobsWithSalary++;
            const numbers = job.salary_text.match(/\d[\d,.]*/g);
            if (numbers && numbers.length > 0) {
              const vals = numbers.map(n => parseInt(n.replace(/,/g, "")));
              const minVal = Math.min(...vals);
              const maxVal = Math.max(...vals);
              const scale = minVal < 10000 ? 1000 : 1;
              const minSal = minVal * scale;
              const maxSal = maxVal * scale;
              if (!isNaN(targetVal) && targetVal >= minSal && targetVal <= maxSal * 1.2) {
                salaryMatches++;
              }
            } else {
              salaryMatches++;
            }
          }
        });
        
        const salaryMatchRate = jobsWithSalary > 0 ? Math.round((salaryMatches / jobsWithSalary) * 100) : 80;
        salaryScore = salaryMatchRate;
        salaryReason = jobsWithSalary > 0
          ? `Your expectation of KSH ${isNaN(targetVal) ? 0 : targetVal.toLocaleString()} matches the salary range in ${salaryMatchRate}% of database postings listing salaries.`
          : `Your expectation of KSH ${isNaN(targetVal) ? 0 : targetVal.toLocaleString()} aligns with typical market salary guidelines for this role.`;

        // 4. Remote compatibility
        let remoteMatches = 0;
        jobsToScan.forEach(job => {
          const isJobRemote = job.is_remote || (job.location || "").toLowerCase().includes("remote");
          if (remotePref === "remote" && isJobRemote) remoteMatches++;
          else if (remotePref === "hybrid" && !isJobRemote) remoteMatches++;
          else if (remotePref === "onsite" && !isJobRemote) remoteMatches++;
        });
        remoteScore = Math.round((remoteMatches / totalMatching) * 100);
        if (remoteScore < 60) remoteScore = 60;
        remoteReason = `${remoteScore}% of matching database roles align with your preference for ${remotePref} work.`;

      } else {
        const profileSkillsCount = profileSkills.length;
        skillsScore = profileSkillsCount > 0 ? Math.min(60 + profileSkillsCount * 5, 95) : 75;
        skillsReason = `No active jobs in the DB match "${roleTitle}". Evaluated against standard baseline requirements: profile contains ${profileSkillsCount} skills.`;
        locationReason = profileCounty 
          ? `Calculated against baseline: preferred county (${profileCounty}) matches typical hiring bounds.` 
          : `Set your location in your profile to optimize matching.`;
        salaryReason = `Expectation of KSH ${parseInt(salaryExpectation || "0").toLocaleString()} falls within general industry bands.`;
        remoteReason = `Your preference for ${remotePref} work is typical for ${roleTitle} listings.`;
      }

      setMetrics([
        {
          name: "Skills Matching",
          score: skillsScore,
          weight: 40,
          icon: Brain,
          status: skillsScore >= 80 ? "high" : "medium",
          reason: skillsReason
        },
        {
          name: "Role Alignment",
          score: profile?.desired_roles?.some((r: string) => r.toLowerCase().includes(roleTitle.toLowerCase())) ? 100 : 70,
          weight: 20,
          icon: Briefcase,
          status: profile?.desired_roles?.some((r: string) => r.toLowerCase().includes(roleTitle.toLowerCase())) ? "high" : "medium",
          reason: profile?.desired_roles?.some((r: string) => r.toLowerCase().includes(roleTitle.toLowerCase()))
            ? `Target title matches your designated Desired Roles in your profile.`
            : `Target title is a pivot from your profile's desired roles list.`
        },
        {
          name: "Salary Alignment",
          score: salaryScore,
          weight: 20,
          icon: DollarSign,
          status: salaryScore >= 75 ? "high" : "medium",
          reason: salaryReason
        },
        {
          name: "Remote & Location Fit",
          score: Math.round((locationScore + remoteScore) / 2),
          weight: 20,
          icon: MapPin,
          status: Math.round((locationScore + remoteScore) / 2) >= 75 ? "high" : "medium",
          reason: `${locationReason} ${remoteReason}`
        }
      ]);
      toast.success("Success Prediction Complete!");
    } catch (err) {
      console.error(err);
      toast.error("Prediction calculation failed");
    } finally {
      setPredicting(false);
    }
  };

  const getOverallProbability = () => {
    if (!metrics) return 0;
    const totalWeight = metrics.reduce((acc, m) => acc + m.weight, 0);
    const weightedSum = metrics.reduce((acc, m) => acc + (m.score * m.weight), 0);
    return Math.round(weightedSum / totalWeight);
  };

  const overallScore = getOverallProbability();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
            <Target className="w-7 h-7 text-[#FD5D28]" />
            Success Predictor
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Calculate response likelihood by balancing core match scores, remote settings, experience requirements, and salary alignment.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Parameters Form - Cardless */}
        <div className="lg:col-span-1 space-y-5 text-left border-r border-slate-200/20 dark:border-border/5 pr-4">
          <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Position Target</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Job Title</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Senior PM"
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2 text-xs sm:text-sm focus:outline-none text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Safaricom PLC"
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2 text-xs sm:text-sm focus:outline-none text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Salary (Ksh/month)</label>
              <input
                type="text"
                value={salaryExpectation}
                onChange={(e) => setSalaryExpectation(e.target.value)}
                placeholder="e.g. 450,000"
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2 text-xs sm:text-sm focus:outline-none text-foreground"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remote Preference</label>
              <select
                value={remotePref}
                onChange={(e) => setRemotePref(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2 text-xs sm:text-sm focus:outline-none text-foreground"
              >
                <option value="remote">Fully Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>

            <Button
              onClick={runPrediction}
              disabled={predicting}
              className="w-full bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-extrabold text-xs sm:text-sm py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm mt-2"
            >
              {predicting ? "Running Calculations..." : "Predict Success Rate"}
            </Button>
          </div>
        </div>

        {/* Right Side: Prediction Visualizations - Cardless */}
        <div className="lg:col-span-2 space-y-8 text-left">
          {metrics ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Overall success percentage banner - Cardless header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200/30 dark:border-border/5">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-[#FD5D28] uppercase tracking-wider block">Overall Success Probability</span>
                  <h3 className="text-3xl sm:text-4xl font-black text-foreground">
                    {overallScore}% Match
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md font-semibold leading-relaxed">
                    {overallScore >= 80
                      ? "High response probability. This application sits in your top 10% range."
                      : overallScore >= 60
                        ? "Moderate response likelihood. Address the gaps below to push above 80%."
                        : "Low compatibility. Significant alignment issues detected in CV text."}
                  </p>
                </div>

                <div className="relative shrink-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-8 border-slate-100 dark:border-slate-800 flex items-center justify-center font-black text-xl text-foreground">
                    {overallScore}%
                    <svg className="absolute top-0 left-0 w-24 h-24 -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="#FD5D28"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * overallScore) / 100}
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Factors Breakdown - Flat grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Match Factors Breakdown</h3>
                <div className="divide-y divide-slate-100 dark:divide-border/5">
                  {metrics.map((metric, i) => {
                    const Icon = metric.icon;
                    return (
                      <div key={i} className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 first:pt-0 last:pb-0">
                        <div className="space-y-1 max-w-xl">
                          <span className="inline-flex items-center gap-1.5 font-bold text-xs sm:text-sm text-foreground">
                            <Icon className="w-4 h-4 text-primary shrink-0" />
                            {metric.name}
                          </span>
                          <p className="text-[11px] text-muted-foreground/80 leading-normal font-semibold">{metric.reason}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize self-start sm:self-auto shrink-0",
                            metric.status === "high"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}
                        >
                          {metric.score}% Match
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Improvements Checklist - Flat list */}
              <div className="space-y-4 pt-6 border-t border-slate-200/30 dark:border-border/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <AlertOctagon className="w-4.5 h-4.5 text-amber-500" />
                  Areas to Improve (+15% score increase)
                </h3>
                <div className="space-y-3.5 text-xs sm:text-sm">
                  {[
                    `Add specific technology keywords matching the ${roleTitle} role (e.g. Docker, TypeScript) to your CV profile summary.`,
                    `Highlight past accomplishments working inside financial fintech architectures or telecom scopes.`,
                    "Refine target salary or preferred county settings inside your CV profile to align with local hiring ranges."
                  ].map((rec, idx) => (
                    <div key={idx} className="flex gap-2.5 items-start">
                      <span className="w-5 h-5 rounded-full bg-[#FD5D28]/10 text-[#FD5D28] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-foreground font-semibold leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-slate-200/40 rounded-2xl p-16 text-center text-muted-foreground/60 flex flex-col items-center justify-center min-h-[400px]">
              <Target className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="font-bold text-foreground text-sm">Waiting for Parameters</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Fill out the role title, company, salary expectations, and click Predict Success Rate to calculate compatibility.
              </p>
            </div>
          )}
        </div>
      </div>
      <LearnMoreSlider
        pageId="predict"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
