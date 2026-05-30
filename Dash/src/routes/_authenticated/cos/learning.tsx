import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GraduationCap,
  BookOpen,
  Clock,
  PlayCircle,
  Sparkles,
  Award,
  Brain,
  Loader2,
  CheckCircle2,
  Circle,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/cos/learning")({
  head: () => ({
    title: "Learning Roadmap - Tellus",
    meta: [
      { title: "Learning Roadmap - Tellus" },
      { name: "description", content: "Personalized learning roadmaps to bridge your professional skill gaps based on your CV profile data." },
    ],
  }),
  component: LearningPage,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Course {
  id: string;
  title: string;
  source: string;
  duration: string;
  skill: string;
  url: string;
}

/* ------------------------------------------------------------------ */
/* Detect industry from role / summary / skills                        */
/* ------------------------------------------------------------------ */
function detectIndustry(role: string, summary: string): string {
  const combined = `${role} ${summary}`.toLowerCase();
  const m = (words: string[]) => words.some((w) => combined.includes(w));

  if (m(["engineer", "developer", "programmer", "architect", "tech", "data", "analyst", "product", "design", "software"])) return "tech";
  if (m(["operations", "ops", "business", "admin", "entrepreneur", "management", "coordinator", "officer", "assistant", "logistics", "project"])) return "ops";
  if (m(["finance", "account", "audit", "tax", "billing", "treasury"])) return "finance";
  if (m(["marketing", "sales", "customer", "growth", "relations", "support"])) return "marketing";
  return "general";
}

/* ------------------------------------------------------------------ */
/* Course catalogue per industry — user gets ones they DON'T have yet  */
/* ------------------------------------------------------------------ */
const COURSE_LIBRARY: Record<string, Course[]> = {
  tech: [
    { id: "t1", title: "Advanced React Patterns & Performance", source: "Frontend Masters", duration: "14 hrs", skill: "React", url: "https://frontendmasters.com" },
    { id: "t2", title: "TypeScript Deep Dive", source: "Udemy", duration: "12 hrs", skill: "TypeScript", url: "https://udemy.com" },
    { id: "t3", title: "Node.js Microservices Architecture", source: "Pluralsight", duration: "18 hrs", skill: "Node.js", url: "https://pluralsight.com" },
    { id: "t4", title: "SQL & Database Design Mastery", source: "Coursera", duration: "16 hrs", skill: "SQL Databases", url: "https://coursera.org" },
    { id: "t5", title: "Docker & Kubernetes in Production", source: "Linux Foundation", duration: "24 hrs", skill: "Docker", url: "https://training.linuxfoundation.org" },
    { id: "t6", title: "CI/CD with GitHub Actions", source: "GitHub Learning", duration: "6 hrs", skill: "CI/CD", url: "https://github.com" },
    { id: "t7", title: "System Design for Senior Engineers", source: "Educative", duration: "20 hrs", skill: "System Design", url: "https://educative.io" },
    { id: "t8", title: "Cloud Architecture with AWS", source: "AWS Training", duration: "30 hrs", skill: "Cloud Architecture", url: "https://aws.amazon.com/training" },
    { id: "t9", title: "Python for Data Engineering", source: "DataCamp", duration: "22 hrs", skill: "Python", url: "https://datacamp.com" },
    { id: "t10", title: "GraphQL API Design", source: "Apollo Academy", duration: "8 hrs", skill: "GraphQL", url: "https://apollographql.com" },
  ],
  ops: [
    { id: "o1", title: "Operations Management Fundamentals", source: "Coursera", duration: "16 hrs", skill: "Operations Management", url: "https://coursera.org" },
    { id: "o2", title: "Project Management Professional (PMP) Prep", source: "PMI", duration: "35 hrs", skill: "Project Management", url: "https://pmi.org" },
    { id: "o3", title: "Lean Six Sigma Green Belt", source: "Udemy", duration: "20 hrs", skill: "Process Optimization", url: "https://udemy.com" },
    { id: "o4", title: "Supply Chain & Logistics Management", source: "edX", duration: "24 hrs", skill: "Logistics", url: "https://edx.org" },
    { id: "o5", title: "Business Analytics with Excel & Power BI", source: "LinkedIn Learning", duration: "18 hrs", skill: "Data Analytics", url: "https://linkedin.com/learning" },
    { id: "o6", title: "Agile & Scrum for Operations Teams", source: "Scrum.org", duration: "10 hrs", skill: "Agile/Scrum", url: "https://scrum.org" },
    { id: "o7", title: "Strategic Resource Planning", source: "Coursera", duration: "14 hrs", skill: "Resource Planning", url: "https://coursera.org" },
    { id: "o8", title: "Budgeting & Financial Planning", source: "CFI", duration: "12 hrs", skill: "Budgeting", url: "https://corporatefinanceinstitute.com" },
    { id: "o9", title: "Stakeholder Communication & Reporting", source: "Udemy", duration: "8 hrs", skill: "Stakeholder Management", url: "https://udemy.com" },
    { id: "o10", title: "Risk Assessment & Mitigation", source: "edX", duration: "16 hrs", skill: "Risk Management", url: "https://edx.org" },
  ],
  finance: [
    { id: "f1", title: "Financial Analysis & Valuation", source: "CFI", duration: "20 hrs", skill: "Financial Analysis", url: "https://corporatefinanceinstitute.com" },
    { id: "f2", title: "Advanced Excel for Finance", source: "Udemy", duration: "12 hrs", skill: "Excel", url: "https://udemy.com" },
    { id: "f3", title: "ACCA / CPA Exam Preparation", source: "Kaplan", duration: "40 hrs", skill: "Accounting", url: "https://kaplan.com" },
    { id: "f4", title: "Tax Compliance & Regulatory Frameworks", source: "Coursera", duration: "16 hrs", skill: "Tax Compliance", url: "https://coursera.org" },
    { id: "f5", title: "Financial Modeling & Forecasting", source: "Wall Street Prep", duration: "24 hrs", skill: "Financial Modeling", url: "https://wallstreetprep.com" },
    { id: "f6", title: "Corporate Finance Essentials", source: "edX", duration: "18 hrs", skill: "Corporate Finance", url: "https://edx.org" },
    { id: "f7", title: "Risk Management Certification", source: "GARP", duration: "30 hrs", skill: "Risk Management", url: "https://garp.org" },
    { id: "f8", title: "Budgeting for Business Leaders", source: "LinkedIn Learning", duration: "10 hrs", skill: "Budgeting", url: "https://linkedin.com/learning" },
  ],
  marketing: [
    { id: "m1", title: "Digital Marketing Strategy", source: "Google Digital Garage", duration: "40 hrs", skill: "Digital Marketing", url: "https://learndigital.withgoogle.com" },
    { id: "m2", title: "SEO & Content Marketing Mastery", source: "HubSpot Academy", duration: "12 hrs", skill: "SEO & Content", url: "https://academy.hubspot.com" },
    { id: "m3", title: "Sales Management & Strategy", source: "Coursera", duration: "18 hrs", skill: "Sales Strategy", url: "https://coursera.org" },
    { id: "m4", title: "Brand Strategy & Positioning", source: "Udemy", duration: "14 hrs", skill: "Brand Strategy", url: "https://udemy.com" },
    { id: "m5", title: "Social Media Marketing Professional", source: "Meta Blueprint", duration: "20 hrs", skill: "Social Media Marketing", url: "https://facebook.com/business/learn" },
    { id: "m6", title: "Google Analytics Certification", source: "Google Skillshop", duration: "8 hrs", skill: "Data Analytics", url: "https://skillshop.withgoogle.com" },
    { id: "m7", title: "Email Marketing Automation", source: "Mailchimp Academy", duration: "6 hrs", skill: "Email Marketing", url: "https://mailchimp.com" },
    { id: "m8", title: "Account Management Essentials", source: "LinkedIn Learning", duration: "10 hrs", skill: "Account Management", url: "https://linkedin.com/learning" },
  ],
  general: [
    { id: "g1", title: "Professional Communication Skills", source: "Coursera", duration: "12 hrs", skill: "Communication", url: "https://coursera.org" },
    { id: "g2", title: "Leadership & Team Management", source: "edX", duration: "16 hrs", skill: "Team Leadership", url: "https://edx.org" },
    { id: "g3", title: "Problem Solving & Critical Thinking", source: "Udemy", duration: "10 hrs", skill: "Problem Solving", url: "https://udemy.com" },
    { id: "g4", title: "Strategic Planning Frameworks", source: "LinkedIn Learning", duration: "14 hrs", skill: "Strategic Planning", url: "https://linkedin.com/learning" },
    { id: "g5", title: "Data Analysis with Excel", source: "Coursera", duration: "18 hrs", skill: "Data Analysis", url: "https://coursera.org" },
    { id: "g6", title: "Project Management Fundamentals", source: "PMI", duration: "20 hrs", skill: "Project Management", url: "https://pmi.org" },
  ],
};

/* ------------------------------------------------------------------ */
/* Build personalized course list based on user profile                */
/* ------------------------------------------------------------------ */
function LearningPage() {
  const queryClient = useQueryClient();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // 1. Profile Query (user skills, education, desired roles, projects)
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile-learning"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await (supabase
        .from("profiles") as any)
        .select("skills, work_history, professional_summary, desired_roles, education, projects")
        .eq("id", data.user.id)
        .single();
      return prof;
    },
  });

  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [projName, setProjName] = useState("");
  const [projUrl, setProjUrl] = useState("");
  const [projSkill, setProjSkill] = useState("");
  const [projDesc, setProjDesc] = useState("");

  const userSkills: string[] = useMemo(() => (profile as any)?.skills || [], [profile]);

  const verifiedProjects = useMemo(() => {
    return (profile as any)?.projects || [];
  }, [profile]);

  // Mutation to verify project
  const verifyProjectMutation = useMutation({
    mutationFn: async (newProj: { title: string; url: string; skill: string; description: string; verifiedAt: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");

      const { data: currentProf } = await (supabase
        .from("profiles") as any)
        .select("projects")
        .eq("id", user.id)
        .single();

      const currentProjects = (currentProf as any)?.projects || [];
      const updated = [...currentProjects, newProj];

      const { error } = await (supabase
        .from("profiles") as any)
        .update({ projects: updated })
        .eq("id", user.id);

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-learning"] });
      toast.success("Capstone project verified and saved to your CV profile!");
      setIsVerifyOpen(false);
      // Reset form
      setProjName("");
      setProjUrl("");
      setProjSkill("");
      setProjDesc("");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to save project verification");
    }
  });

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !projUrl.trim() || !projSkill || !projDesc.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    verifyProjectMutation.mutate({
      title: projName.trim(),
      url: projUrl.trim(),
      skill: projSkill,
      description: projDesc.trim(),
      verifiedAt: new Date().toISOString()
    });
  };

  // 2. Saved Tracker Jobs Query (to extract actual match_gaps)
  const { data: savedJobs, isLoading: isSavedJobsLoading } = useQuery({
    queryKey: ["saved-jobs-gaps"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("jobs")
        .select("title, match_gaps")
        .eq("user_id", user.id);
      if (error) {
        console.error("Error fetching saved jobs for gaps:", error);
        return [];
      }
      return data || [];
    },
  });

  // 3. Scraped Jobs Query (Live Market Scan)
  const { data: marketAnalysis, isLoading: isMarketLoading } = useQuery({
    queryKey: ["market-learning-analysis", userSkills],
    queryFn: async () => {
      const { data: jobs, error } = await supabase
        .from("scraped_jobs")
        .select("title, description, requirements, responsibilities")
        .order("scraped_at", { ascending: false })
        .limit(150);

      if (error) {
        console.error("Error fetching scraped jobs for learning scan:", error);
        return { marketGaps: [] };
      }

      const totalJobs = jobs?.length || 0;
      if (totalJobs === 0) return { marketGaps: [] };

      // Predefined list of standard skills matching COURSE_LIBRARY
      const skillsToScan = [
        "React", "TypeScript", "Node.js", "SQL Databases", "Docker", "CI/CD", 
        "System Design", "Cloud Architecture", "Python", "GraphQL", 
        "Operations Management", "Project Management", "Process Optimization", 
        "Logistics", "Data Analytics", "Agile/Scrum", "Resource Planning", 
        "Budgeting", "Stakeholder Management", "Risk Management", 
        "Financial Analysis", "Excel", "Accounting", "Tax Compliance", 
        "Financial Modeling", "Corporate Finance", "Digital Marketing", 
        "SEO & Content", "Sales Strategy", "Brand Strategy", 
        "Social Media Marketing", "Email Marketing", "Account Management", 
        "Communication", "Team Leadership", "Problem Solving", 
        "Strategic Planning", "Data Analysis"
      ];

      const frequencyMap: Record<string, number> = {};
      skillsToScan.forEach(skill => {
        frequencyMap[skill] = 0;
      });

      jobs.forEach(job => {
        const text = `${job.title || ""} ${job.description || ""} ${job.requirements || ""} ${job.responsibilities || ""}`.toLowerCase();
        skillsToScan.forEach(skill => {
          const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          let regexStr = `\\b${escaped}\\b`;
          if (skill.endsWith("#") || skill.endsWith("+") || skill.startsWith(".")) {
            regexStr = escaped;
          }
          const regex = new RegExp(regexStr, "i");
          if (regex.test(text)) {
            frequencyMap[skill] = (frequencyMap[skill] || 0) + 1;
          }
        });
      });

      const userSkillsLower = new Set(userSkills.map(s => s.toLowerCase().trim()));
      const marketGaps = skillsToScan
        .map(skill => ({
          name: skill,
          frequency: Math.round((frequencyMap[skill] || 0) / totalJobs * 100),
          count: frequencyMap[skill] || 0
        }))
        .filter(s => s.count > 0 && !userSkillsLower.has(s.name.toLowerCase().trim()))
        .sort((a, b) => b.frequency - a.frequency);

      return { marketGaps };
    }
  });

  // Extract gaps from user's saved/tracked jobs
  const parsedTrackerGaps = useMemo(() => {
    if (!savedJobs) return [];
    const gapsSet = new Set<string>();
    const skillsToScan = [
      "React", "TypeScript", "Node.js", "SQL Databases", "Docker", "CI/CD", 
      "System Design", "Cloud Architecture", "Python", "GraphQL", 
      "Operations Management", "Project Management", "Process Optimization", 
      "Logistics", "Data Analytics", "Agile/Scrum", "Resource Planning", 
      "Budgeting", "Stakeholder Management", "Risk Management", 
      "Financial Analysis", "Excel", "Accounting", "Tax Compliance", 
      "Financial Modeling", "Corporate Finance", "Digital Marketing", 
      "SEO & Content", "Sales Strategy", "Brand Strategy", 
      "Social Media Marketing", "Email Marketing", "Account Management", 
      "Communication", "Team Leadership", "Problem Solving", 
      "Strategic Planning", "Data Analysis"
    ];

    savedJobs.forEach((job: any) => {
      if (!job.match_gaps) return;
      const text = job.match_gaps.toLowerCase();
      skillsToScan.forEach(skill => {
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        let regexStr = `\\b${escaped}\\b`;
        if (skill.endsWith("#") || skill.endsWith("+") || skill.startsWith(".")) {
          regexStr = escaped;
        }
        const regex = new RegExp(regexStr, "i");
        if (regex.test(text)) {
          gapsSet.add(skill);
        }
      });
    });

    return Array.from(gapsSet);
  }, [savedJobs]);

  // Combine gaps from saved tracker jobs and market scan gaps
  const actualGaps = useMemo(() => {
    const combined = new Set<string>();
    
    // 1. Add gaps from saved/tracked jobs first (high priority)
    parsedTrackerGaps.forEach(g => combined.add(g));

    // 2. Add gaps from the market scan (up to top 5 gaps)
    const mGaps = marketAnalysis?.marketGaps || [];
    mGaps.slice(0, 5).forEach(g => combined.add(g.name));

    // Filter out skills the user already has (in case of race conditions/updates)
    const userSkillsLower = new Set(userSkills.map(s => s.toLowerCase().trim()));
    return Array.from(combined).filter(skill => !userSkillsLower.has(skill.toLowerCase().trim()));
  }, [parsedTrackerGaps, marketAnalysis, userSkills]);

  // Map to Course objects
  const { courses, industry } = useMemo(() => {
    const allCourses = Object.values(COURSE_LIBRARY).flat();

    // Map each actual gap to its corresponding course
    const recommended = allCourses.filter(course => 
      actualGaps.some(gap => gap.toLowerCase() === course.skill.toLowerCase())
    );

    const workHistory: string = profile?.work_history || "";
    const summary: string = profile?.professional_summary || "";
    const desiredRoles: string[] = profile?.desired_roles || [];
    const roleHint = desiredRoles[0] || workHistory.split("\n")[0] || "";
    const detectedInd = detectIndustry(roleHint, summary);

    // If we have fewer than 4 recommended courses, let's fill the rest with baseline courses
    // matching the user's detected industry, excluding skills they already have.
    if (recommended.length < 4) {
      const industryCourses = COURSE_LIBRARY[detectedInd] || COURSE_LIBRARY.general;
      const userSkillsLower = new Set(userSkills.map(s => s.toLowerCase().trim()));

      const extraCourses = industryCourses.filter(course => {
        if (recommended.some(r => r.id === course.id)) return false;
        return !userSkillsLower.has(course.skill.toLowerCase().trim());
      });

      const combined = [...recommended, ...extraCourses];

      if (combined.length < 4) {
        const remaining = allCourses.filter(course => !combined.some(c => c.id === course.id));
        return { courses: combined.concat(remaining).slice(0, 4), industry: detectedInd };
      }
      return { courses: combined, industry: detectedInd };
    }

    return { courses: recommended, industry: detectedInd };
  }, [actualGaps, profile, userSkills]);

  const availableSkillsForProject = useMemo(() => {
    const set = new Set<string>();
    userSkills.forEach(s => set.add(s));
    courses.forEach(c => set.add(c.skill));
    return Array.from(set).sort();
  }, [userSkills, courses]);

  // Mutation — mark skill as acquired
  const addSkillMutation = useMutation({
    mutationFn: async (skillName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user session");
      const { data: currentProf } = await supabase.from("profiles").select("skills").eq("id", user.id).single();
      const currentSkills: string[] = currentProf?.skills || [];
      if (currentSkills.some((s) => s.toLowerCase() === skillName.toLowerCase())) return currentSkills;
      const updated = [...currentSkills, skillName];
      const { error } = await supabase.from("profiles").update({ skills: updated }).eq("id", user.id);
      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-skills"] });
      queryClient.invalidateQueries({ queryKey: ["profile-learning"] });
      queryClient.invalidateQueries({ queryKey: ["market-learning-analysis"] });
      toast.success("Skill added to your CV profile!");
    },
    onError: () => {
      toast.error("Failed to update skills");
    },
  });

  const toggleComplete = (course: Course) => {
    const next = new Set(completedIds);
    if (next.has(course.id)) {
      next.delete(course.id);
    } else {
      next.add(course.id);
      addSkillMutation.mutate(course.skill);
    }
    setCompletedIds(next);
  };

  const isSkillAcquired = (skill: string) =>
    userSkills.some((s) => s.toLowerCase().includes(skill.toLowerCase()) || skill.toLowerCase().includes(s.toLowerCase()));

  const completedCount = courses.filter((c) => completedIds.has(c.id) || isSkillAcquired(c.skill)).length;
  const progressPct = courses.length > 0 ? Math.round((completedCount / courses.length) * 100) : 0;

  const INDUSTRY_LABELS: Record<string, string> = {
    tech: "Technology & Engineering",
    ops: "Operations & Business",
    finance: "Finance & Accounting",
    marketing: "Marketing & Sales",
    general: "Professional Development",
  };

  /* Loading */
  if (isProfileLoading || isSavedJobsLoading || isMarketLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FD5D28]" />
      </div>
    );
  }

  const liveScanCount = (savedJobs?.length || 0) + (marketAnalysis?.marketGaps?.length || 0);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5 sm:space-y-8 animate-in fade-in duration-300">
      {/* ═══ HEADER ═══ */}
      <div className="space-y-2 border-b border-slate-200/40 dark:border-border/10 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#FD5D28] to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
              <GraduationCap className="w-5 h-5 sm:w-7 sm:h-7 text-[#FD5D28] shrink-0" />
              Learning Roadmap
            </h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Skill-gap courses based on your CV profile.</span>
              <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <Badge variant="secondary" className="font-extrabold text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Scan: {liveScanCount} Sources
            </Badge>
            <Badge className="bg-[#FD5D28]/10 text-[#FD5D28] border-none font-bold text-[10px] sm:text-xs px-2.5 py-1">
              {INDUSTRY_LABELS[industry] || "Professional"}
            </Badge>
          </div>
        </div>
      </div>

      {/* ═══ PROGRESS BAR — mobile-first, shown at top on small screens ═══ */}
      <div className="lg:hidden space-y-3 p-3 rounded-xl border border-slate-200/40 dark:border-border/10 bg-slate-50/50 dark:bg-slate-900/30">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-500">Progress</span>
          <span className="text-foreground font-black">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2.5 rounded-full" />
        <p className="text-[10px] text-muted-foreground font-semibold leading-relaxed">
          {completedCount} of {courses.length} courses completed. Finishing a course adds the skill to your CV.
        </p>
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Course list */}
        <div className="lg:col-span-2 space-y-3 lg:border-r border-slate-200/20 dark:border-border/5 lg:pr-6 text-left">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/30 dark:border-border/5">
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Recommended Courses</h3>
            <span className="text-[10px] font-bold text-slate-400">{completedCount}/{courses.length}</span>
          </div>

          {courses.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground">Your skills cover all recommended courses for your industry.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {courses.map((course) => {
                const acquired = isSkillAcquired(course.skill);
                const done = completedIds.has(course.id) || acquired;

                return (
                  <div
                    key={course.id}
                    className={cn(
                      "py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100/80 dark:border-border/5 last:border-b-0 transition-all",
                      done && "opacity-60",
                    )}
                  >
                    {/* Course info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => !acquired && toggleComplete(course)}
                          disabled={acquired || addSkillMutation.isPending}
                          className="mt-0.5 shrink-0"
                        >
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-[#FD5D28] transition-colors" />
                          )}
                        </button>
                        <div className="min-w-0 space-y-1">
                          <h4 className={cn(
                            "font-bold text-xs sm:text-sm text-foreground leading-snug break-words",
                            done && "line-through text-muted-foreground",
                          )}>
                            {course.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-border/50 text-slate-400 px-1.5 py-0">
                              {course.source}
                            </Badge>
                            {acquired && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[7px] sm:text-[8px] font-black tracking-wider uppercase px-1.5 py-0">
                                Acquired
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs text-muted-foreground font-medium pl-6">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {course.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Brain className="w-3 h-3 text-[#FD5D28] shrink-0" />
                          {course.skill}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                      <a
                        href={course.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-foreground rounded-lg transition-colors border border-slate-200/40 dark:border-border/10"
                        title="Open course"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </a>
                      <Button
                        onClick={() => toggleComplete(course)}
                        disabled={acquired || addSkillMutation.isPending}
                        variant={done ? "default" : "outline"}
                        className={cn(
                          "text-[10px] sm:text-[11px] font-bold px-2.5 py-1.5 h-auto rounded-lg",
                          done
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "border-slate-200/60 dark:border-border/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {done ? "Completed" : "Mark Done"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6 text-left border-t lg:border-t-0 pt-6 lg:pt-0 border-slate-200/20 dark:border-border/5">
          {/* Milestone Achievement - Hidden on mobile, shown on desktop */}
          <div className="hidden lg:block space-y-6">
            <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Curriculum Progress</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Milestone Achievement</span>
                <span className="text-foreground font-black">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-3.5 rounded-full" />
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-semibold">
                Completing courses automatically adds the skill to your CV profile, boosting your match score on job applications.
              </p>
            </div>
          </div>

          {/* Your current skills snapshot - Visible on all viewports */}
          <div className="space-y-3">
            <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Skills ({userSkills.length})</h4>
            </div>
            {userSkills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No skills on your profile yet. Complete courses to add them!</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {userSkills.slice(0, 12).map((skill, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/15"
                  >
                    {skill}
                  </span>
                ))}
                {userSkills.length > 12 && (
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-muted-foreground">
                    +{userSkills.length - 12} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Capstone projects */}
          <div className="pt-4 space-y-3">
            <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <BookOpen className="w-5 h-5 text-[#FD5D28] shrink-0" />
                Build Capstone Projects
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-semibold pt-1">
              Apply your new skills in real-world projects to strengthen your CV and demonstrate practical expertise to employers.
            </p>
            <Button
              onClick={() => setIsVerifyOpen(true)}
              className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              Verify Project
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Your Verified Projects */}
          {verifiedProjects.length > 0 && (
            <div className="pt-4 space-y-3">
              <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-500 shrink-0" />
                  Your Verified Projects ({verifiedProjects.length})
                </h4>
              </div>
              <div className="space-y-3 pt-1">
                {verifiedProjects.map((proj: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-200/40 dark:border-border/10 bg-slate-50/30 dark:bg-slate-900/10 space-y-1.5 text-xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-foreground leading-tight break-words">{proj.title}</span>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15 text-[8px] font-black uppercase tracking-wider px-1.5 py-0 shrink-0">
                        {proj.skill}
                      </Badge>
                    </div>
                    {proj.description && (
                      <p className="text-[11px] text-muted-foreground/90 font-medium leading-normal">{proj.description}</p>
                    )}
                    {proj.url && (
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-[#FD5D28] hover:underline flex items-center gap-0.5"
                      >
                        View Repository / Link
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ VERIFY PROJECT DIALOG ═══ */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className="w-[92%] sm:w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-border/10 rounded-2xl shadow-xl p-5 sm:p-6 text-left">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FD5D28]" />
              Verify Capstone Project
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              Submit details of a project you built to demonstrate practical expertise. This will be added to your profile.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifySubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Project Title
              </label>
              <input
                type="text"
                required
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                placeholder="e.g. React Task Dashboard"
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#FD5D28] focus:ring-1 focus:ring-[#FD5D28] text-foreground transition-all duration-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Project/Repository URL
              </label>
              <input
                type="url"
                required
                value={projUrl}
                onChange={(e) => setProjUrl(e.target.value)}
                placeholder="e.g. https://github.com/yourusername/project"
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#FD5D28] focus:ring-1 focus:ring-[#FD5D28] text-foreground transition-all duration-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Demonstrated Skill
              </label>
              <select
                required
                value={projSkill}
                onChange={(e) => setProjSkill(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 pr-10 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#FD5D28] focus:ring-1 focus:ring-[#FD5D28] text-foreground transition-all duration-200 truncate"
              >
                <option value="">Select a skill...</option>
                {availableSkillsForProject.map((skill) => (
                  <option key={skill} value={skill}>
                    {skill}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Description / Technologies Used
              </label>
              <textarea
                required
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                placeholder="Briefly describe what you built, how you implemented the skill, and the main challenges solved."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-[#FD5D28] focus:ring-1 focus:ring-[#FD5D28] text-foreground resize-none transition-all duration-200"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVerifyOpen(false)}
                className="text-xs h-9.5 font-bold rounded-xl border-slate-200 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={verifyProjectMutation.isPending}
                className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white text-xs h-9.5 font-bold rounded-xl flex items-center gap-1.5 shadow-sm justify-center"
              >
                {verifyProjectMutation.isPending ? "Verifying..." : "Verify & Add to Profile"}
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LearnMoreSlider
        pageId="learning"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
