import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { JobListSkeleton } from "@/components/ui/skeleton-loaders";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MapPin,
  Calendar,
  Briefcase,
  CircleDollarSign,
  ExternalLink,
  Video,
  ChevronRight,
  FileCheck,
  Clock,
  Search,
  Building2
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    title: "Applications - Tellus",
    meta: [
      { title: "Applications - Tellus" },
      { name: "description", content: "Track and manage your drafted materials, interview preps, and automated submissions." },
    ],
  }),
  component: Apps,
});

function Apps() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data: res, error } = await supabase
        .from("applications")
        .select(`
          *,
          jobs (
            location,
            county,
            salary_text,
            job_type,
            match_score,
            tracker_status,
            source,
            description,
            role_description,
            deadline,
            match_reason
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { apps: res ?? [] };
    },
  });
  const apps = data?.apps ?? [];

  const filteredApps = apps.filter((a: any) => {
    const title = (a.job_title ?? "").toLowerCase();
    const company = (a.company ?? "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return title.includes(term) || company.includes(term);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/20 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Applications</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Track and manage your drafted materials, interview preps, and automated submissions.
          </p>
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium bg-muted/40 px-3 py-1.5 rounded-full border border-border/20 self-start md:self-auto">
          {apps.length} {apps.length === 1 ? "Application" : "Applications"} Total
        </div>
      </div>

      {apps.length > 0 && (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs sm:text-sm bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
          />
        </div>
      )}

      {isLoading ? (
        <JobListSkeleton hideHeader />
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/45 mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">No applications yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mt-1 mb-6">
            Run a match workflow or open any job and generate a draft to start tracking.
          </p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/95 rounded-lg transition-colors shadow-sm"
          >
            Browse Job Marketplace
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground text-sm">No applications matching &ldquo;{searchTerm}&rdquo;</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {filteredApps.map((a: any) => {
            const jobDetails = a.jobs;
            const location = [jobDetails?.location, jobDetails?.county].filter(Boolean).join(", ");
            const salary = jobDetails?.salary_text;
            const jobType = jobDetails?.job_type;
            const score = a.match_score ?? jobDetails?.match_score ?? null;
            const snippet = jobDetails?.role_description || jobDetails?.description;

            return (
              <div
                key={a.id}
                className="group relative py-6 px-4 -mx-4 hover:bg-muted/15 transition-colors rounded-xl flex flex-col lg:flex-row lg:items-start justify-between gap-6"
              >
                {/* Left Side: Job Info & Metadata */}
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        to="/jobs/$id"
                        params={{ id: a.job_id }}
                        className="group/title inline-flex items-center gap-1"
                      >
                        <h3 className="font-bold text-sm sm:text-base lg:text-lg text-foreground group-hover/title:text-primary transition-colors tracking-tight">
                          {a.job_title}
                        </h3>
                        <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-primary" />
                      </Link>

                      {score !== null && (
                        <span className={cn(
                          "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border tracking-wide",
                          score >= 80
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20"
                            : score >= 60
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20"
                              : "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400 dark:bg-red-500/20"
                        )}>
                          {score}% Match
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground/80">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{a.company}</span>
                    </div>
                  </div>

                  {/* Job Details snippet */}
                  {snippet && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 max-w-3xl leading-relaxed font-normal">
                      {snippet}
                    </p>
                  )}

                  {/* Match Reason highlight */}
                  {jobDetails?.match_reason && (
                    <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/10 font-medium">
                      <span>{jobDetails.match_reason}</span>
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] sm:text-xs text-muted-foreground font-medium pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                      Applied {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/80" />
                        {location}
                      </span>
                    )}
                    {jobType && (
                      <span className="flex items-center gap-1.5 capitalize">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground/80" />
                        {jobType}
                      </span>
                    )}
                    {salary && (
                      <span className="flex items-center gap-1.5">
                        <CircleDollarSign className="w-3.5 h-3.5 text-muted-foreground/80" />
                        {salary}
                      </span>
                    )}
                    {jobDetails?.deadline && (
                      <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                        <Clock className="w-3.5 h-3.5 text-rose-500" />
                        Deadline {new Date(jobDetails.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* Automation error banner */}
                  {a.automation_error && (
                    <div className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg mt-1 inline-flex items-center gap-2 max-w-full">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{a.automation_error}</span>
                    </div>
                  )}
                </div>

                {/* Right Side: Status Badges & Quick Action Links */}
                <div className="flex flex-row flex-wrap lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-4 shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-border/10">
                  {/* Status & Mode badges */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-muted/30 text-muted-foreground border-border/30 capitalize"
                    >
                      {a.application_mode ?? "manual"}
                    </Badge>

                    {a.status === "sent" ? (
                      <Badge className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/20 gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Sent
                      </Badge>
                    ) : a.status === "needs_review" ? (
                      <Badge className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/20 gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        Needs Review
                      </Badge>
                    ) : (
                      <Badge className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400 dark:bg-blue-500/20 capitalize">
                        {a.status ?? "draft"}
                      </Badge>
                    )}
                  </div>

                  {/* Action Link Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Interview Prep Link */}
                    {a.interview_questions && (
                      <Link
                        to="/jobs/$id"
                        params={{ id: a.job_id }}
                        search={{ tab: "apply" as const, section: "interview" as const }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors border border-border/50 hover:border-border rounded-lg px-2.5 py-1.5 bg-background hover:bg-muted/10 shadow-sm"
                      >
                        <Video className="w-3.5 h-3.5 text-primary" />
                        Prep
                      </Link>
                    )}

                    {/* Application Pack Link */}
                    {(a.cover_letter || a.pack_questions) && (
                      <Link
                        to="/jobs/$id"
                        params={{ id: a.job_id }}
                        search={{ tab: "apply" as const, section: "application" as const }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors border border-border/50 hover:border-border rounded-lg px-2.5 py-1.5 bg-background hover:bg-muted/10 shadow-sm"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-primary" />
                        Pack
                      </Link>
                    )}

                    {/* Google Doc Link */}
                    {a.drive_url && (
                      <a
                        href={a.drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-primary hover:text-primary/95 inline-flex items-center gap-1.5 transition-colors border border-primary/20 hover:border-primary/45 rounded-lg px-2.5 py-1.5 bg-primary/5 shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Google Doc
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
