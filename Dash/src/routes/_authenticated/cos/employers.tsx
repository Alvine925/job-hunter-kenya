import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Building,
  Search,
  MapPin,
  Layers,
  ChevronLeft,
  ExternalLink,
  Briefcase,
  TrendingUp,
  Users,
  Loader2,
  Award,
  Sparkles,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cos/employers")({
  head: () => ({
    title: "Employer Intel - Tellus",
    meta: [
      { title: "Employer Intel - Tellus" },
      { name: "description", content: "Dynamic directory of employers actively hiring, built from real market data." },
    ],
  }),
  component: EmployersPage,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface EmployerProfile {
  name: string;
  sector: string;
  location: string;
  jobCount: number;
  roles: string[];
  topSkills: string[];
  companySummary: string;
  hiringTier: "High" | "Medium" | "Low";
  hiringTierColor: string;
  hasUserApp: boolean;
}

/* ------------------------------------------------------------------ */
/* Employer name validation — filter out job boards & junk             */
/* ------------------------------------------------------------------ */
function isInvalidEmployer(company: string | null | undefined): boolean {
  if (!company?.trim()) return true;
  const lowerC = company.trim().toLowerCase();

  const INVALID_BOARD_RE = /\b(linkedin|brightermonday|brighter\s+monday|myjobmag|my\s+job\s+mag|fuzu|jobwebkenya|job\s+web\s+kenya|corporatestaffing|corporate\s+staffing|indeed|glassdoor|ziprecruiter|careerjet|talent\.com|lensa|ajira|kazi|pigiame|pigia\s+me|career\s+point|star\s+jobs|kenyancareer|various|aggregated|linkedin\s+search|not\s+specified|unknown\s+employer|job\s+board|recruiter|employer)\b/i;
  if (INVALID_BOARD_RE.test(lowerC)) return true;
  if (/\(\s*aggregated/i.test(lowerC)) return true;

  const GENERIC_WORDS = new Set([
    "nairobi", "mombasa", "kisumu", "nakuru", "eldoret", "kenya", "kiambu",
    "remote", "hybrid", "onsite", "on-site", "location", "various", "multiple",
    "unknown", "not", "specified", "n/a", "na", "none", "null", "employer",
    "recruiter", "agency", "company", "hiring", "job", "jobs", "careers",
    "career", "posting", "postings", "listing", "listings", "apply",
    "and", "of", "in", "at", "for", "the", "a", "an", "to", "with", "by", "from",
  ]);

  const words = lowerC
    .replace(/[,\-\/\(\)\[\]\.\:\&]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (words.length === 0) return true;
  return words.every((word) => GENERIC_WORDS.has(word) || /^\d+$/.test(word) || word.length <= 1);
}

/* ------------------------------------------------------------------ */
/* Skill extraction from requirements/responsibilities text            */
/* ------------------------------------------------------------------ */
const SKILL_KEYWORDS = [
  "React", "TypeScript", "JavaScript", "Node.js", "Python", "Java", "SQL",
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "GraphQL", "REST",
  "Agile", "Scrum", "Project Management", "CI/CD", "Git", "Linux",
  "Excel", "Power BI", "Tableau", "Data Analysis", "Machine Learning",
  "Communication", "Leadership", "Stakeholder Management",
  "Financial Analysis", "Budgeting", "Accounting", "Audit",
  "Marketing", "SEO", "Sales", "Customer Service",
  "Supply Chain", "Logistics", "Operations", "Procurement",
  "Monitoring", "Evaluation", "Research", "Reporting",
  "HR", "Recruitment", "Training", "Compliance",
  "Design", "UX", "UI", "Figma", "Adobe",
  "SAP", "ERP", "CRM", "Salesforce",
  "M-Pesa", "Mobile Money", "Fintech", "Banking",
];

function extractSkills(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((skill) => {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(lower);
  });
}

/* ------------------------------------------------------------------ */
/* Normalise company name for grouping                                 */
/* ------------------------------------------------------------------ */
function normaliseCompany(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(ltd|limited|plc|inc|corp|co|llc|group|kenya|ke)\b\.?$/gi, "")
    .trim()
    .toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Mode function helper — returns the most frequent value              */
/* ------------------------------------------------------------------ */
function mode(arr: string[]): string {
  const freq: Record<string, number> = {};
  arr.forEach((v) => {
    const k = v.trim();
    if (k) freq[k] = (freq[k] || 0) + 1;
  });
  let best = "";
  let max = 0;
  for (const [k, v] of Object.entries(freq)) {
    if (v > max) { best = k; max = v; }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */
function EmployersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // 1. Fetch scraped jobs with relevant fields for employer aggregation
  const { data: scrapedJobs, isLoading: isScrapedLoading } = useQuery({
    queryKey: ["employer-intel-scraped"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scraped_jobs")
        .select("company, title, location, sector, requirements, responsibilities, company_summary")
        .order("scraped_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("Error fetching scraped jobs for employer intel:", error);
        return [];
      }
      return data || [];
    },
  });

  // 1b. Fetch job_listings (shared catalog) as a second data source
  const { data: jobListings, isLoading: isListingsLoading } = useQuery({
    queryKey: ["employer-intel-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("job_listings") as any)
        .select("company, title, location, requirements, responsibilities, company_summary")
        .order("scraped_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("Error fetching job_listings for employer intel:", error);
        return [];
      }
      return data || [];
    },
  });

  // 2. Fetch user's tracked jobs to mark "Active App"
  const { data: userJobs = [], isLoading: isUserJobsLoading } = useQuery({
    queryKey: ["employer-intel-user-jobs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("jobs")
        .select("company, tracker_status")
        .eq("user_id", user.id);
      return data ?? [];
    },
  });

  // Total listing count for header badge
  const totalListingsScanned = (scrapedJobs?.length || 0) + (jobListings?.length || 0);

  // 3. Build employer profiles from scraped_jobs + job_listings combined
  const employers: EmployerProfile[] = useMemo(() => {
    // Merge both data sources into a unified array
    const allJobs: any[] = [];

    (scrapedJobs || []).forEach((job: any) => {
      allJobs.push({ ...job, _source: "scraped" });
    });
    (jobListings || []).forEach((job: any) => {
      // job_listings doesn't have sector, set it to null so aggregation handles it
      allJobs.push({ ...job, sector: null, _source: "listing" });
    });

    if (allJobs.length === 0) return [];

    // Group by normalised company name
    const groups: Record<string, any[]> = {};
    allJobs.forEach((job: any) => {
      if (isInvalidEmployer(job.company)) return;
      const key = normaliseCompany(job.company);
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(job);
    });

    // Build user app lookup
    const userCompanySet = new Set(
      (userJobs || [])
        .filter((j: any) => j.company?.trim())
        .map((j: any) => normaliseCompany(j.company))
    );

    // Build employer profiles from groups
    const profiles: EmployerProfile[] = [];

    for (const [key, jobs] of Object.entries(groups)) {
      if (jobs.length < 1) continue; // need at least 1 listing

      // Best display name — most frequent original casing
      const displayName = mode(jobs.map((j: any) => j.company?.trim()).filter(Boolean));
      if (!displayName) continue;

      // Sector
      const sectors = jobs.map((j: any) => j.sector).filter(Boolean);
      const sectorVal = mode(sectors) || "General";

      // Location
      const locations = jobs.map((j: any) => j.location).filter(Boolean);
      const locationVal = mode(locations) || "Kenya";

      // Unique roles (titles)
      const titlesSet = new Set<string>();
      jobs.forEach((j: any) => {
        if (j.title?.trim()) titlesSet.add(j.title.trim());
      });
      const roles = Array.from(titlesSet).slice(0, 5);

      // Top skills from requirements & responsibilities
      const allSkills: Record<string, number> = {};
      jobs.forEach((j: any) => {
        const text = `${j.requirements || ""} ${j.responsibilities || ""}`;
        extractSkills(text).forEach((s) => {
          allSkills[s] = (allSkills[s] || 0) + 1;
        });
      });
      const topSkills = Object.entries(allSkills)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([s]) => s);

      // Company summary — use the first non-empty one
      const summaries = jobs.map((j: any) => j.company_summary).filter(Boolean);
      const companySummary = summaries[0] || "";

      // Hiring tier based on job count
      const jobCount = jobs.length;
      let hiringTier: "High" | "Medium" | "Low" = "Low";
      let hiringTierColor = "bg-slate-500/10 text-slate-500 border-slate-500/20";
      if (jobCount >= 5) {
        hiringTier = "High";
        hiringTierColor = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
      } else if (jobCount >= 2) {
        hiringTier = "Medium";
        hiringTierColor = "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";
      }

      profiles.push({
        name: displayName,
        sector: sectorVal,
        location: locationVal,
        jobCount,
        roles,
        topSkills,
        companySummary,
        hiringTier,
        hiringTierColor,
        hasUserApp: userCompanySet.has(key),
      });
    }

    // Sort by job count desc
    profiles.sort((a, b) => b.jobCount - a.jobCount);
    return profiles;
  }, [scrapedJobs, jobListings, userJobs]);

  // Filter
  const filteredEmployers = useMemo(() => {
    if (!searchTerm.trim()) return employers;
    const q = searchTerm.toLowerCase();
    return employers.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.sector.toLowerCase().includes(q) ||
        emp.location.toLowerCase().includes(q)
    );
  }, [employers, searchTerm]);

  const selectedEmployer = useMemo(() => {
    if (!selectedName) return filteredEmployers[0] || null;
    return employers.find((e) => e.name === selectedName) || filteredEmployers[0] || null;
  }, [selectedName, employers, filteredEmployers]);

  /* Loading */
  if (isScrapedLoading || isListingsLoading || isUserJobsLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FD5D28]" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-5 sm:space-y-8 animate-in fade-in duration-300">
      {/* ═══ HEADER ═══ */}
      <div className="space-y-2 border-b border-slate-200/40 dark:border-border/10 pb-4 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#FD5D28] to-orange-500 bg-clip-text text-transparent flex items-center gap-2 select-none">
              <Building className="w-5 h-5 sm:w-7 sm:h-7 text-[#FD5D28] shrink-0" />
              Employer Intelligence
            </h1>
            <p className="text-muted-foreground text-[11px] sm:text-sm mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Live employer profiles built from real market data.</span>
              <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <Badge variant="secondary" className="font-extrabold text-[10px] bg-slate-100 dark:bg-slate-900 text-slate-500 flex items-center gap-1.5 py-1 px-2.5 rounded-lg border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {employers.length} Companies
            </Badge>
            <Badge className="bg-[#FD5D28]/10 text-[#FD5D28] border-none font-bold text-[10px] sm:text-xs px-2.5 py-1">
              {totalListingsScanned} Listings Scanned
            </Badge>
          </div>
        </div>
      </div>

      {employers.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Building className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-foreground">No employer data yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Employer profiles are built from scraped job listings. Once listings are scraped, companies will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* ═══ LEFT: Directory List ═══ */}
          <div className={cn(
            "lg:col-span-1 space-y-3 lg:border-r border-slate-200/20 dark:border-border/5 lg:pr-4 text-left",
            selectedName && "hidden lg:block"  // hide list on mobile when detail is selected
          )}>
            {/* Search */}
            <div className="flex items-center gap-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search companies or sectors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-xs sm:text-sm text-foreground placeholder-muted-foreground/60 focus:ring-0 focus:outline-none"
              />
            </div>

            {/* Company cards */}
            <div className="divide-y divide-slate-200/30 dark:divide-border/5">
              {filteredEmployers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-muted-foreground">No companies match your search.</p>
                </div>
              ) : (
                filteredEmployers.map((emp) => {
                  const isSelected = selectedEmployer?.name === emp.name;
                  return (
                    <div
                      key={emp.name}
                      onClick={() => setSelectedName(emp.name)}
                      className={cn(
                        "py-3.5 transition-all cursor-pointer text-left space-y-1.5 px-2 rounded-xl",
                        isSelected && "bg-slate-100/60 dark:bg-slate-900/35"
                      )}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground leading-tight break-words">{emp.name}</h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {emp.hasUserApp && (
                            <Badge className="bg-[#FD5D28]/10 text-[#FD5D28] border-none text-[8px] font-black uppercase tracking-wider py-0 px-1.5 rounded">
                              Applied
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold block">{emp.sector}</span>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-0.5">
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {emp.location.split(",")[0]}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5">
                            <Briefcase className="w-3 h-3 shrink-0" />
                            {emp.jobCount} {emp.jobCount === 1 ? "listing" : "listings"}
                          </span>
                          <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 rounded-full capitalize", emp.hiringTierColor)}>
                            {emp.hiringTier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Detail Panel ═══ */}
          <div className={cn(
            "lg:col-span-2 text-left space-y-5",
            !selectedName && "hidden lg:block"  // hide detail on mobile when nothing selected
          )}>
            {selectedEmployer ? (
              <div className="space-y-5">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedName(null)}
                  className="lg:hidden flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to directory
                </button>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200/30 dark:border-border/5 pb-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-extrabold text-[10px] bg-primary/10 text-primary">
                        {selectedEmployer.sector}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0 rounded-full capitalize", selectedEmployer.hiringTierColor)}>
                        {selectedEmployer.hiringTier} Hiring
                      </Badge>
                      {selectedEmployer.hasUserApp && (
                        <Badge className="bg-[#FD5D28]/10 text-[#FD5D28] border-none text-[8px] font-black uppercase tracking-wider py-0 px-1.5 rounded">
                          You've Applied
                        </Badge>
                      )}
                    </div>
                    <h2 className="font-extrabold text-base sm:text-xl text-foreground break-words">
                      {selectedEmployer.name}
                    </h2>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {selectedEmployer.location}
                    </span>
                  </div>

                  <Link
                    to="/marketplace"
                    search={{ search: selectedEmployer.name } as any}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-bold rounded-xl text-xs shadow-sm transition-all shrink-0 self-start"
                  >
                    Search Active Jobs
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-slate-200/40 dark:border-border/10 bg-slate-50/30 dark:bg-slate-900/10 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Active Listings
                    </span>
                    <p className="text-lg font-black text-foreground">{selectedEmployer.jobCount}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200/40 dark:border-border/10 bg-slate-50/30 dark:bg-slate-900/10 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Unique Roles
                    </span>
                    <p className="text-lg font-black text-foreground">{selectedEmployer.roles.length}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200/40 dark:border-border/10 bg-slate-50/30 dark:bg-slate-900/10 space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Hiring Activity
                    </span>
                    <p className={cn("text-lg font-black", selectedEmployer.hiringTier === "High" ? "text-emerald-600" : selectedEmployer.hiringTier === "Medium" ? "text-amber-600" : "text-slate-500")}>
                      {selectedEmployer.hiringTier}
                    </p>
                  </div>
                </div>

                {/* Company Summary */}
                {selectedEmployer.companySummary && (
                  <div className="space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> Company Overview
                    </span>
                    <p className="text-foreground/80 font-medium leading-relaxed">
                      {selectedEmployer.companySummary}
                    </p>
                  </div>
                )}

                {/* Active Roles */}
                {selectedEmployer.roles.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-200/30 dark:border-border/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> Active Roles Being Hired
                    </span>
                    <div className="space-y-2">
                      {selectedEmployer.roles.map((role, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <Briefcase className="w-3.5 h-3.5 text-[#FD5D28] shrink-0 mt-0.5" />
                          <span className="text-foreground font-semibold leading-snug break-words">{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Required Skills */}
                {selectedEmployer.topSkills.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-200/30 dark:border-border/5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> Top Required Skills
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEmployer.topSkills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-primary/5 text-primary border border-primary/10"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Intel Tip */}
                <div className="space-y-2 text-xs border-t border-slate-200/30 dark:border-border/5 pt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Preparation Tip
                  </span>
                  <div className="flex gap-2 text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    <p>
                      {selectedEmployer.topSkills.length > 0
                        ? `Focus your preparation on ${selectedEmployer.topSkills.slice(0, 3).join(", ")}${selectedEmployer.topSkills.length > 3 ? ` and ${selectedEmployer.topSkills.length - 3} more key skills` : ""}. ${selectedEmployer.sector !== "General" ? `This company operates in ${selectedEmployer.sector} — tailor your answers to this domain.` : "Demonstrate versatile, cross-functional expertise."}`
                        : `Research ${selectedEmployer.name}'s mission and recent projects. Tailor your application to demonstrate domain knowledge in ${selectedEmployer.sector}.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/60 bg-muted/10 p-16 text-center text-muted-foreground/60 min-h-[300px] flex items-center justify-center">
                Select an employer from the directory to view profiling intelligence.
              </div>
            )}
          </div>
        </div>
      )}

      <LearnMoreSlider
        pageId="employers"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
