import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listJobs } from "@/lib/jobs.functions";
import { Card } from "@/components/ui/card";
import { Briefcase, Sparkles, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const fetchJobs = useServerFn(listJobs);
  const { data } = useQuery({ queryKey: ["jobs"], queryFn: () => fetchJobs() });
  const jobs = data?.jobs ?? [];
  const high = jobs.filter((j: any) => (j.match_score ?? 0) >= 80);

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm mb-6">Your Kenyan job hunt at a glance</p>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card className="p-5"><div className="flex items-center gap-3"><Search className="w-5 h-5 text-primary" /><div><div className="text-2xl font-bold">{jobs.length}</div><div className="text-xs text-muted-foreground">Jobs scraped</div></div></div></Card>
        <Card className="p-5"><div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-primary" /><div><div className="text-2xl font-bold">{high.length}</div><div className="text-xs text-muted-foreground">High matches (80+)</div></div></div></Card>
        <Card className="p-5"><div className="flex items-center gap-3"><Briefcase className="w-5 h-5 text-primary" /><div><div className="text-2xl font-bold">{jobs.filter((j: any) => j.tracker_status !== "new").length}</div><div className="text-xs text-muted-foreground">In tracker</div></div></div></Card>
      </div>

      <h2 className="font-semibold mb-3">Top matches</h2>
      <div className="space-y-2">
        {high.slice(0, 5).map((j: any) => (
          <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
            <Card className="p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div><div className="font-medium">{j.title}</div><div className="text-xs text-muted-foreground">{j.company} · {j.location}</div></div>
                <div className="text-sm font-semibold text-primary">{j.match_score}%</div>
              </div>
            </Card>
          </Link>
        ))}
        {high.length === 0 && <p className="text-sm text-muted-foreground">No matches yet. Go to <Link to="/find-jobs" className="text-primary">Find Jobs</Link> to scrape.</p>}
      </div>
    </div>
  );
}
