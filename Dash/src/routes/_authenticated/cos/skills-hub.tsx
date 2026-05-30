import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Brain,
  Plus,
  Trash2,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Sliders,
  ChevronRight,
  BookOpen,
  Search,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/skills-hub")({
  head: () => ({
    title: "Skills Hub - Tellus",
    meta: [
      { title: "Skills Hub - Tellus" },
      { name: "description", content: "Inventory of your professional skills and automated gap analysis based on target jobs." },
    ],
  }),
  component: SkillsHubPage,
});

interface SkillGap {
  name: string;
  frequency: number;
  count: number;
  level: "High" | "Medium" | "Low";
}

const FALLBACK_SOUGHT_AFTER: SkillGap[] = [
  { name: "TypeScript", frequency: 92, count: 184, level: "High" },
  { name: "React", frequency: 88, count: 176, level: "High" },
  { name: "Docker", frequency: 84, count: 168, level: "High" },
  { name: "CI/CD", frequency: 78, count: 156, level: "High" },
  { name: "Kubernetes", frequency: 65, count: 130, level: "Medium" },
  { name: "GraphQL", frequency: 45, count: 90, level: "Low" },
  { name: "Python", frequency: 38, count: 76, level: "Low" },
];

function SkillsHubPage() {
  const queryClient = useQueryClient();
  const [newSkillName, setNewSkillName] = useState("");
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Load actual skills from user profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile-skills"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("skills")
        .eq("id", data.user.id)
        .single();
      return prof;
    }
  });

  const skillsList: string[] = profile?.skills || [];

  // Query and parse scraped jobs to compute real-time sought-after skills and gaps
  const { data: marketData, isLoading: isMarketLoading } = useQuery({
    queryKey: ["market-skills-analysis", skillsList],
    queryFn: async () => {
      const { data: jobs, error } = await supabase
        .from("scraped_jobs")
        .select("title, description, requirements, responsibilities")
        .order("scraped_at", { ascending: false })
        .limit(250);

      if (error) {
        console.error("Error fetching scraped jobs for skills parsing:", error);
        return { soughtAfter: [], gaps: [], scannedCount: 0, isReal: false };
      }

      const totalJobs = jobs?.length || 0;
      if (totalJobs === 0) {
        return { soughtAfter: [], gaps: [], scannedCount: 0, isReal: false };
      }

      // Predefined list of standard skills to search for
      const skillsToScan = [
        "React", "TypeScript", "Node.js", "Python", "Docker", "Kubernetes", "AWS", "SQL",
        "GraphQL", "CI/CD", "Scrum", "Agile", "DevOps", "Java", "Go", "Git", "PHP", "C#",
        "Linux", "UI/UX", "Product Management", "Project Management", "Data Analysis",
        "Finance", "Excel", "System Design", "REST APIs", "Microservices", "Cloud",
        "Automation", "Security", "HTML", "CSS"
      ];

      const uniqueSkillsToScan = Array.from(new Set(skillsToScan));
      const frequencyMap: Record<string, number> = {};
      uniqueSkillsToScan.forEach(skill => {
        frequencyMap[skill] = 0;
      });

      jobs.forEach(job => {
        const textToScan = `${job.title || ""} ${job.description || ""} ${job.requirements || ""} ${job.responsibilities || ""}`.toLowerCase();
        
        uniqueSkillsToScan.forEach(skill => {
          const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          let regexStr = `\\b${escapedSkill}\\b`;
          if (skill.endsWith("#") || skill.endsWith("+") || skill.startsWith(".")) {
            regexStr = escapedSkill;
          }
          const regex = new RegExp(regexStr, "i");
          if (regex.test(textToScan)) {
            frequencyMap[skill] = (frequencyMap[skill] || 0) + 1;
          }
        });
      });

      const soughtAfter: SkillGap[] = uniqueSkillsToScan
        .map(skill => {
          const count = frequencyMap[skill] || 0;
          const pct = Math.round((count / totalJobs) * 100);
          let level: "High" | "Medium" | "Low" = "Low";
          if (pct >= 40) level = "High";
          else if (pct >= 15) level = "Medium";

          return { name: skill, frequency: pct, count, level };
        })
        .filter(s => s.count > 0)
        .sort((a, b) => b.frequency - a.frequency);

      // Gaps: sought after skills that are NOT in the user's profile
      const userSkillsLower = new Set(skillsList.map(s => s.toLowerCase()));
      const gaps = soughtAfter
        .filter(s => !userSkillsLower.has(s.name.toLowerCase()))
        .slice(0, 5); // top 5 gaps

      return { soughtAfter, gaps, scannedCount: totalJobs, isReal: true };
    }
  });

  const isReal = marketData?.isReal ?? false;
  const scannedCount = marketData?.scannedCount ?? 0;
  
  const soughtAfterSkills = isReal && marketData?.soughtAfter && marketData.soughtAfter.length > 0
    ? marketData.soughtAfter.slice(0, 7)
    : FALLBACK_SOUGHT_AFTER;

  const skillGaps = isReal && marketData?.gaps && marketData.gaps.length > 0
    ? marketData.gaps
    : FALLBACK_SOUGHT_AFTER.filter(s => !new Set(skillsList.map(item => item.toLowerCase())).has(s.name.toLowerCase())).slice(0, 5);

  // Update profile skills in Supabase
  const updateSkillsMutation = useMutation({
    mutationFn: async (updatedList: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { error } = await supabase
        .from("profiles")
        .update({ skills: updatedList })
        .eq("id", user.id);
      if (error) throw error;
      return updatedList;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-skills"] });
      queryClient.invalidateQueries({ queryKey: ["profile-learning-skills"] });
      queryClient.invalidateQueries({ queryKey: ["market-skills-analysis"] });
      toast.success("Skills inventory updated!");
    },
    onError: () => {
      toast.error("Failed to update skills");
    }
  });

  const handleAddSkill = () => {
    const cleanName = newSkillName.trim();
    if (!cleanName) return;
    if (skillsList.some(s => s.toLowerCase() === cleanName.toLowerCase())) {
      toast.error("Skill already exists in inventory");
      return;
    }
    const updated = [...skillsList, cleanName];
    updateSkillsMutation.mutate(updated);
    setNewSkillName("");
  };

  const handleRemoveSkill = (name: string) => {
    const updated = skillsList.filter(s => s !== name);
    updateSkillsMutation.mutate(updated);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
            <Brain className="w-7 h-7 text-[#FD5D28]" />
            Skills Hub
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
            <span>Aggregate gap analyzer. Tracks your current core skills, highlights high-frequency market gaps, and charts your progress.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-extrabold text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-border/40">
            {isReal ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Scan: {scannedCount} Jobs
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Industry Baseline Data
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        {/* Current Skills List - Cardless flat panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/30 dark:border-border/5 pb-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">My Skill Inventory</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Core skills saved to your CV profile.</p>
            </div>
            <Badge variant="secondary" className="font-extrabold text-[10px] bg-primary/10 text-primary">
              {skillsList.length} Total
            </Badge>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-border/5">
            {isProfileLoading ? (
              <p className="text-xs text-muted-foreground py-4">Loading skills inventory...</p>
            ) : skillsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">No skills registered yet. Add some below!</p>
            ) : (
              skillsList.map((skill, index) => (
                <div key={index} className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
                  <div className="flex-1">
                    <span className="font-bold text-xs sm:text-sm text-foreground">{skill}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="p-1.5 hover:bg-rose-500/5 hover:text-rose-500 rounded-lg text-slate-400 transition-colors"
                    title="Delete skill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Skill Panel - Cardless */}
          <div className="pt-6 border-t border-slate-200/30 dark:border-border/5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Plus className="w-4.5 h-4.5 text-primary" />
              Add Skill to Profile
            </h4>
            <div className="flex gap-3 max-w-sm items-end text-xs">
              <div className="space-y-1 text-left flex-1">
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Docker, TypeScript"
                  className="w-full rounded-xl border border-slate-200 dark:border-border/10 bg-background px-3 py-2 text-xs sm:text-sm focus:outline-none text-foreground"
                />
              </div>
              <Button
                onClick={handleAddSkill}
                disabled={!newSkillName.trim() || updateSkillsMutation.isPending}
                className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-bold h-9.5 px-4 rounded-xl shadow-sm"
              >
                {updateSkillsMutation.isPending ? "Adding..." : "Add Skill"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Skills Gap Analysis - Cardless */}
        <div className="lg:col-span-1 space-y-8">
          {/* Section 1: Aggregate Gaps */}
          <div className="space-y-4">
            <div className="border-b border-slate-200/30 dark:border-border/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Aggregate Skill Gaps
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Top required skills missing from your CV profile.</p>
            </div>

            {isMarketLoading ? (
              <p className="text-xs text-muted-foreground">Calculating gaps...</p>
            ) : skillGaps.length === 0 ? (
              <p className="text-xs text-muted-foreground font-semibold">Fantastic! You have zero detected skill gaps in this market.</p>
            ) : (
              <div className="space-y-4">
                {skillGaps.map((gap, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">{gap.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.2 rounded-full",
                          gap.level === "High" ? "bg-rose-500/10 text-rose-600 border-rose-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}
                      >
                        {gap.level} Priority
                      </Badge>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${gap.frequency}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground/80 font-medium block">Appears in {gap.frequency}% of matching job posts.</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Highly Sought-After Skills Overall */}
          <div className="space-y-4 pt-6 border-t border-slate-200/30 dark:border-border/5">
            <div className="pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="w-4.5 h-4.5 text-primary" />
                Highly Sought-After Skills
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Most common requirements across all active market listings.</p>
            </div>

            {isMarketLoading ? (
              <p className="text-xs text-muted-foreground">Calculating demand...</p>
            ) : soughtAfterSkills.length === 0 ? (
              <p className="text-xs text-muted-foreground">No market demand metrics available.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {soughtAfterSkills.map((skill, i) => {
                  const hasIt = skillsList.some(s => s.toLowerCase() === skill.name.toLowerCase());
                  return (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-border/5 last:border-0">
                      <span className={cn("font-semibold text-foreground", hasIt && "text-slate-400 line-through")}>
                        {skill.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">{skill.frequency}% demand</span>
                        {hasIt ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[8px] font-black uppercase tracking-wider px-1">
                            Acquired
                          </Badge>
                        ) : (
                          <Badge className="bg-[#FD5D28]/10 text-[#FD5D28] border border-[#FD5D28]/20 text-[8px] font-black uppercase tracking-wider px-1">
                            Gap
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick learning trigger banner */}
          <div className="pt-6 border-t border-slate-200/30 dark:border-border/5 space-y-2">
            <BookOpen className="w-6.5 h-6.5 text-primary" />
            <h4 className="font-bold text-sm text-foreground">Bridge Gaps Instantly</h4>
            <p className="text-xs text-muted-foreground leading-normal font-semibold">
              Close your identified gaps using customized training tracks.
            </p>
            <a
              href="/cos/learning"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/90 mt-1"
            >
              Launch Learning Roadmaps
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
      <LearnMoreSlider
        pageId="skills-hub"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
