import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs, scrapeJobsForMe } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, MapPin, Building2, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/find-jobs")({ component: FindJobs });

function FindJobs() {
  const fetchJobs = useServerFn(listJobs);
  const scrape = useServerFn(scrapeJobsForMe);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });

  const scrapeMut = useMutation({
    mutationFn: () => scrape({ data: { limit: 20 } }),
    onSuccess: (r) => { toast.success(`Found ${r.count} new jobs`); qc.invalidateQueries({ queryKey: ["jobs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const jobs = (data?.jobs ?? []).filter((j: any) =>
    !filter || j.title?.toLowerCase().includes(filter.toLowerCase()) || j.company?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Find Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">Scraped from BrighterMonday, MyJobMag, Fuzu, JobwebKenya & more</p>
        </div>
        <Button onClick={() => scrapeMut.mutate()} disabled={scrapeMut.isPending}>
          {scrapeMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          Scrape now
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Filter by title or company..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No jobs yet. Click "Scrape now" to fetch jobs matched to your profile.</p>
          <p className="text-xs text-muted-foreground">Make sure your profile has desired roles and skills filled in.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <Card key={job.id} className="p-5 hover:shadow-md transition cursor-pointer" onClick={() => navigate({ to: "/jobs/$id", params: { id: job.id } })}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{job.title}</h3>
                    <Badge variant={job.match_score >= 80 ? "default" : job.match_score >= 60 ? "secondary" : "outline"}>
                      {job.match_score}% match
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                    {job.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{job.company}</span>}
                    {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                    {job.job_type && <Badge variant="outline" className="text-xs">{job.job_type}</Badge>}
                    {job.source && <span className="text-xs">via {job.source}</span>}
                  </div>
                  {job.match_reason && (
                    <p className="text-sm text-foreground/80 mt-3 line-clamp-2"><span className="font-medium">Why: </span>{job.match_reason}</p>
                  )}
                </div>
                <a href={job.source_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary"><ExternalLink className="w-4 h-4" /></a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
