import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Compass,
  TrendingUp,
  Brain,
  Loader2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/career-path")({
  head: () => ({
    title: "Career Path - Tellus",
    meta: [
      { title: "Career Path - Tellus" },
      { name: "description", content: "Interactive career path progression planner based on your CV and profile data." },
    ],
  }),
  component: CareerPathPage,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface PathNode {
  level: string;
  title: string;
  avgTime: string;
  skillsRequired: string[];
  description: string;
}

/* ------------------------------------------------------------------ */
/* Parse current role from work_history text                           */
/* ------------------------------------------------------------------ */
function parseCurrentRole(workHistory: string, desiredRoles: string[], summary: string): string {
  if (workHistory) {
    const lines = workHistory.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      let cleaned = lines[0]
        .split(/[,;|\\/]/)[0]
        .split(/\s+(?:at|for|in|from|@)\s+/i)[0]
        .split("(")[0]
        .trim();

      cleaned = cleaned
        .replace(/\b(?:Kisumu|Nairobi|Mombasa|Nakuru|Eldoret|Kenya|County|Branch|Office|Ltd|Limited|Hub)\b/gi, "")
        .trim();

      const seen = new Set<string>();
      cleaned = cleaned
        .split(/\s+/)
        .filter(Boolean)
        .filter((w) => {
          const low = w.toLowerCase();
          if (seen.has(low) && low.length > 2) return false;
          seen.add(low);
          return true;
        })
        .join(" ")
        .replace(/[^a-zA-Z0-9\s]$/g, "")
        .trim();

      if (cleaned.length > 3 && cleaned.length < 50) return cleaned;
    }
  }

  if (desiredRoles.length > 0 && desiredRoles[0]) return desiredRoles[0];

  const s = summary.toLowerCase();
  if (s.includes("operations")) return "Operations Professional";
  if (s.includes("marketing")) return "Marketing Specialist";
  if (s.includes("sales")) return "Sales Consultant";
  if (s.includes("finance") || s.includes("account")) return "Financial Officer";
  if (s.includes("engineer") || s.includes("developer")) return "Software Engineer";
  if (s.includes("consultant")) return "Professional Consultant";

  return "Professional";
}

/* ------------------------------------------------------------------ */
/* Detect industry from role title                                     */
/* ------------------------------------------------------------------ */
function detectIndustry(role: string): string {
  const r = role.toLowerCase();
  const m = (words: string[]) => words.some((w) => r.includes(w));

  if (m(["engineer", "developer", "programmer", "architect", "tech", "data", "analyst", "product", "design"])) return "tech";
  if (m(["operations", "ops", "business", "admin", "entrepreneur", "management", "coordinator", "officer", "assistant", "logistics", "project"])) return "ops";
  if (m(["finance", "account", "audit", "tax", "billing", "treasury"])) return "finance";
  if (m(["marketing", "sales", "customer", "growth", "relations", "support"])) return "marketing";
  return "general";
}

/* ------------------------------------------------------------------ */
/* Build dynamic career tracks from profile data                       */
/* ------------------------------------------------------------------ */
function buildTracks(profile: any): { specialist: PathNode[]; leadership: PathNode[]; industry: string } {
  const workHistory: string = profile?.work_history || "";
  const desiredRoles: string[] = profile?.desired_roles || [];
  const skills: string[] = profile?.skills || [];
  const summary: string = profile?.professional_summary || "";

  const currentRole = parseCurrentRole(workHistory, desiredRoles, summary);
  const industry = detectIndustry(currentRole);

  const core = currentRole.replace(/^(?:junior|associate|senior|lead|head of|chief|assistant|trainee)\s+/i, "").trim();

  const industryDefaultSkills: Record<string, string[]> = {
    tech: ["React", "TypeScript", "SQL Databases", "System Design", "Docker", "CI/CD"],
    ops: ["Operations Management", "Process Optimization", "Budgeting", "Project Coordination", "Resource Planning", "Stakeholder Management"],
    finance: ["Financial Analysis", "Accounting", "Tax Compliance", "Budgeting", "Risk Management", "Corporate Finance"],
    marketing: ["Digital Marketing", "SEO & Content", "Sales Strategy", "Account Management", "Brand Strategy", "Data Analytics"],
    general: ["Project Management", "Strategic Planning", "Communication", "Problem Solving", "Team Leadership", "Data Analysis"],
  };

  const pool = skills.length > 0 ? skills : (industryDefaultSkills[industry] || industryDefaultSkills.general);
  const s1 = pool.slice(0, 4);
  const s2Base = pool.slice(2, 4);

  const s2Adv: Record<string, string[]> = {
    tech: ["System Design", "Team Mentorship"],
    ops: ["Resource Allocation", "Process Redesign"],
    finance: ["Financial Modeling", "Strategic Planning"],
    marketing: ["Campaign Architecture", "Growth Strategy"],
    general: ["Stakeholder Management", "Resource Planning"],
  };
  const s3Spec: Record<string, string[]> = {
    tech: ["Distributed Systems", "Technology Strategy"],
    ops: ["Operations Audits", "P&L Management"],
    finance: ["Capital Allocation", "Enterprise Risk"],
    marketing: ["Brand Governance", "Revenue Operations"],
    general: ["Performance Management", "Change Management"],
  };
  const s3Mgmt: Record<string, string[]> = {
    tech: ["Talent Acquisition", "Roadmap Delivery"],
    ops: ["Operations Audits", "P&L Management"],
    finance: ["Capital Allocation", "Enterprise Risk"],
    marketing: ["Brand Governance", "Revenue Operations"],
    general: ["Performance Management", "Change Management"],
  };

  const specTitles: Record<string, [string, string, string]> = {
    tech: [`Senior ${core}`, `Staff ${core} / Architect`, "Principal Architect / Fellow"],
    ops: [`Senior ${core}`, "Head of Operations", "Chief Operating Officer"],
    finance: [`Senior ${core}`, "Finance Director", "Chief Financial Officer"],
    marketing: [`Senior ${core}`, "Head of Brand / Senior Planner", "Chief Marketing Officer"],
    general: [`Senior ${core}`, `Lead ${core}`, "Principal Consultant"],
  };
  const mgmtTitles: Record<string, [string, string, string]> = {
    tech: ["Technical Team Lead", "Engineering Manager", "Director / CTO"],
    ops: ["Operations Team Lead", "General Manager", "CEO / MD"],
    finance: ["Finance Manager", "Director of Finance", "CFO"],
    marketing: ["Marketing Manager", "VP of Sales", "CCO"],
    general: [`${core} Team Lead`, "Department Director", "Executive Director"],
  };

  const st = specTitles[industry] || specTitles.general;
  const mt = mgmtTitles[industry] || mgmtTitles.general;

  const specialist: PathNode[] = [
    {
      level: "Step 1 — Current",
      title: currentRole,
      avgTime: "Current Role",
      skillsRequired: s1,
      description: `Focus on core execution, developing deep expertise in ${s1.slice(0, 2).join(" and ") || "key areas"}, and achieving excellent project delivery.`,
    },
    {
      level: "Step 2 — 1-2 Years",
      title: st[0],
      avgTime: "18 – 24 months",
      skillsRequired: [...s2Base, ...(s2Adv[industry] || s2Adv.general)],
      description: "Owning key specialized deliverables, designing standard workflows, mentoring colleagues, and leading high-impact initiatives.",
    },
    {
      level: "Step 3 — 3-5 Years",
      title: st[1],
      avgTime: "3 – 5 years",
      skillsRequired: [...(s3Spec[industry] || s3Spec.general), "Strategic Advisory", "Risk Planning"],
      description: "Providing domain guidance, solving complex structural challenges, and aligning department tactics with long-term company roadmap.",
    },
    {
      level: "Step 4 — 6+ Years",
      title: st[2],
      avgTime: "6+ years",
      skillsRequired: ["Enterprise Governance", "Innovation Strategy", "Executive Alignment", "R&D Advisory"],
      description: "Guiding enterprise-wide domain governance, defining industry frameworks, and advising the executive board.",
    },
  ];

  const leadership: PathNode[] = [
    {
      level: "Step 1 — Current",
      title: currentRole,
      avgTime: "Current Role",
      skillsRequired: s1,
      description: "Focus on core execution, developing competence in workflows, and delivering consistent team output.",
    },
    {
      level: "Step 2 — 1-2 Years",
      title: mt[0],
      avgTime: "12 – 18 months",
      skillsRequired: [...s2Base, "Agile/Scrum", "Conflict Resolution"],
      description: "Balancing hands-on contributions with team coordination, tracking deliveries, and resolving blockers.",
    },
    {
      level: "Step 3 — 3-5 Years",
      title: mt[1],
      avgTime: "3 – 4 years",
      skillsRequired: [...(s3Mgmt[industry] || s3Mgmt.general), "Performance Tracking", "Budget Management"],
      description: "Direct management of staff, hiring, resource allocation, budgeting, and leading key business initiatives.",
    },
    {
      level: "Step 4 — 6+ Years",
      title: mt[2],
      avgTime: "5+ years",
      skillsRequired: ["Board Communications", "Executive Leadership", "Strategic Scaling", "Corporate Stewardship"],
      description: "Strategic steering, cross-departmental scaling, and aligning operations with C-level goals.",
    },
  ];

  return { specialist, leadership, industry };
}

/* ------------------------------------------------------------------ */
/* Dynamic tab labels                                                  */
/* ------------------------------------------------------------------ */
const TAB_LABELS: Record<string, { spec: string; lead: string }> = {
  tech: { spec: "Technical Track", lead: "Management Track" },
  ops: { spec: "Operations Track", lead: "Leadership Track" },
  finance: { spec: "Finance Track", lead: "Leadership Track" },
  marketing: { spec: "Marketing Track", lead: "Leadership Track" },
  general: { spec: "Specialist Track", lead: "Leadership Track" },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
function CareerPathPage() {
  const [track, setTrack] = useState<"spec" | "lead">("spec");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-career-path"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, professional_summary, skills, work_history, desired_roles, education")
        .eq("id", data.user.id)
        .single();
      return prof;
    },
  });

  const { specialist, leadership, industry } = buildTracks(profile);
  const activeTrack = track === "spec" ? specialist : leadership;
  const node = activeTrack[selectedIdx] || activeTrack[0];
  const labels = TAB_LABELS[industry] || TAB_LABELS.general;

  /* Loading */
  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FD5D28]" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5 sm:space-y-8 animate-in fade-in duration-300">
      {/* ═══ HEADER ═══ */}
      <div className="space-y-3 border-b border-slate-200/40 dark:border-border/10 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#FD5D28] to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
              <Compass className="w-5 h-5 sm:w-7 sm:h-7 text-[#FD5D28] shrink-0" />
              Career Path Tracker
            </h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Personalized progression based on your CV data.</span>
              <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
            </p>
          </div>
        </div>

        {/* Track toggle — full width on mobile */}
        <div className="bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200/50 dark:border-border/10 flex gap-1 shadow-sm">
          <Button
            onClick={() => { setTrack("spec"); setSelectedIdx(0); }}
            variant={track === "spec" ? "default" : "ghost"}
            className={cn(
              "text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-2 h-auto rounded-lg flex-1 text-center justify-center transition-all",
              track === "spec"
                ? "bg-[#FD5D28] text-white hover:bg-[#FD5D28]/95 shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {labels.spec}
          </Button>
          <Button
            onClick={() => { setTrack("lead"); setSelectedIdx(0); }}
            variant={track === "lead" ? "default" : "ghost"}
            className={cn(
              "text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-2 h-auto rounded-lg flex-1 text-center justify-center transition-all",
              track === "lead"
                ? "bg-[#FD5D28] text-white hover:bg-[#FD5D28]/95 shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {labels.lead}
          </Button>
        </div>
      </div>

      {/* ═══ MOBILE STEP CHIPS ═══ */}
      <div className="lg:hidden space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progression</h3>
          <span className="text-[9px] font-black text-[#FD5D28] bg-[#FD5D28]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            {selectedIdx + 1} / {activeTrack.length}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {activeTrack.map((n, idx) => {
            const sel = selectedIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  "py-2 px-1 rounded-xl transition-all duration-200 flex flex-col items-center gap-1 select-none border",
                  sel
                    ? "bg-[#FD5D28] text-white shadow-md border-[#FD5D28]"
                    : "bg-slate-50 dark:bg-slate-900/40 text-muted-foreground border-slate-200/50 dark:border-border/10 hover:bg-slate-100 dark:hover:bg-slate-800/30",
                )}
              >
                <span className={cn("text-xs font-black leading-none", sel ? "text-white" : "text-foreground")}>
                  0{idx + 1}
                </span>
                <span className="text-[7px] font-bold uppercase tracking-wider opacity-80 leading-tight text-center line-clamp-1 w-full px-0.5">
                  {idx === 0 ? "Now" : `${idx + 1}-${idx * 2}yr`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Desktop sidebar timeline — hidden on mobile */}
        <div className="hidden lg:block lg:col-span-1 space-y-4 border-r border-slate-200/20 dark:border-border/5 pr-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Progression Nodes</h3>
          <div className="relative pl-6 space-y-3 border-l border-slate-200 dark:border-border/10 ml-3 pt-2">
            {activeTrack.map((n, idx) => {
              const sel = selectedIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "relative py-3 transition-all cursor-pointer space-y-1 px-3 rounded-xl",
                    sel && "bg-slate-100/60 dark:bg-slate-900/35",
                  )}
                >
                  <span
                    className={cn(
                      "absolute -left-[28px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-background transition-colors",
                      sel ? "bg-[#FD5D28]" : "bg-slate-300 dark:bg-slate-700",
                    )}
                  />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{n.level}</span>
                  <h4 className="font-bold text-sm text-foreground break-words">{n.title}</h4>
                  <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {n.avgTime}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Details panel */}
        <div className="lg:col-span-2 text-left space-y-5">
          {node && (
            <div className="space-y-5">
              {/* Title */}
              <div className="border-b border-slate-200/30 dark:border-border/5 pb-4 space-y-2">
                <Badge variant="secondary" className="font-extrabold text-[10px] bg-[#FD5D28]/10 text-[#FD5D28] border-none">
                  {node.level}
                </Badge>
                <h2 className="font-extrabold text-base sm:text-xl text-foreground break-words leading-snug">
                  {node.title}
                </h2>
                <div className="text-[11px] sm:text-xs font-bold text-[#FD5D28] flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  Timeline: {node.avgTime}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role Focus</span>
                <p className="text-xs sm:text-sm text-foreground font-medium leading-relaxed">{node.description}</p>
              </div>

              {/* Skills */}
              <div className="space-y-3 pt-4 border-t border-slate-200/30 dark:border-border/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Required Skills</span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {node.skillsRequired.map((skill, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-border/10 bg-slate-50/50 dark:bg-slate-900/30 text-[11px] sm:text-xs text-foreground font-bold shadow-sm"
                    >
                      <Brain className="w-3.5 h-3.5 text-[#FD5D28] shrink-0" />
                      <span className="whitespace-nowrap">{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <LearnMoreSlider
        pageId="career-path"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
