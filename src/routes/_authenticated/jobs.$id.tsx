import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getJob, generateAndSaveLetter } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Loader2, Sparkles, Mail, Phone, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs/$id")({ component: JobDetail });

function JobDetail() {
  const { id } = Route.useParams();
  const fetchJob = useServerFn(getJob);
  const gen = useServerFn(generateAndSaveLetter);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["job", id], queryFn: () => fetchJob({ data: { id } }) });

  const genMut = useMutation({
    mutationFn: () => gen({ data: { jobId: id } }),
    onSuccess: () => { toast.success("Cover letter generated and saved to Drive"); qc.invalidateQueries({ queryKey: ["job", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data?.job) return <div className="p-8">Job not found</div>;

  const job = data.job;
  const app = data.application;

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/find-jobs" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
            {job.company && <span>{job.company}</span>}
            {job.location && <span>· {job.location}</span>}
            {job.job_type && <Badge variant="outline">{job.job_type}</Badge>}
          </div>
        </div>
        <Badge variant={job.match_score >= 80 ? "default" : "secondary"} className="text-base px-3 py-1">{job.match_score}% match</Badge>
      </div>

      <Card className="p-5 mb-4 border-primary/40 bg-primary-soft/30">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Match Analysis</h2>
        <p className="text-sm mb-3">{job.match_reason}</p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {job.match_strengths && (
            <div><div className="font-medium mb-1 text-green-700">Strengths</div><div className="whitespace-pre-wrap text-foreground/80">{job.match_strengths}</div></div>
          )}
          {job.match_gaps && (
            <div><div className="font-medium mb-1 text-amber-700">Gaps</div><div className="whitespace-pre-wrap text-foreground/80">{job.match_gaps}</div></div>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {job.description && (
            <Card className="p-5"><h2 className="font-semibold mb-2">Description</h2>
              <div className="text-sm whitespace-pre-wrap text-foreground/80 max-h-96 overflow-auto">{job.description}</div></Card>
          )}
          {job.requirements && (
            <Card className="p-5"><h2 className="font-semibold mb-2">Qualifications</h2>
              <div className="text-sm whitespace-pre-wrap text-foreground/80">{job.requirements}</div></Card>
          )}
          {job.responsibilities && (
            <Card className="p-5"><h2 className="font-semibold mb-2">Responsibilities</h2>
              <div className="text-sm whitespace-pre-wrap text-foreground/80">{job.responsibilities}</div></Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold mb-3">Contacts</h2>
            <div className="space-y-2 text-sm">
              {job.contact_person && <div>{job.contact_person}</div>}
              {job.application_email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /><a className="text-primary" href={`mailto:${job.application_email}`}>{job.application_email}</a></div>}
              {job.contact_phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{job.contact_phone}</div>}
              {job.source_url && <a href={job.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="w-3.5 h-3.5" /> View source</a>}
              {!job.application_email && !job.contact_phone && !job.contact_person && <p className="text-muted-foreground text-xs">No direct contact extracted — apply via source link.</p>}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-3">Apply</h2>
            <Button onClick={() => genMut.mutate()} disabled={genMut.isPending} className="w-full">
              {genMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {app ? "Regenerate" : "Generate"} cover letter
            </Button>
            {app?.drive_url && (
              <a href={app.drive_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                <FileText className="w-3.5 h-3.5" /> Open in Google Drive
              </a>
            )}
          </Card>
        </div>
      </div>

      {app && (
        <Card className="p-5 mt-4">
          <h2 className="font-semibold mb-3">Generated cover letter</h2>
          <Textarea value={app.cover_letter ?? ""} readOnly rows={12} className="text-sm" />
          <h3 className="font-medium mt-4 mb-1">Email subject</h3>
          <div className="text-sm bg-muted rounded p-2">{app.email_subject}</div>
          <h3 className="font-medium mt-3 mb-1">Email body</h3>
          <Textarea value={app.email_body ?? ""} readOnly rows={6} className="text-sm" />
        </Card>
      )}
    </div>
  );
}
