import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyWorkflow, upsertWorkflow } from "@/lib/jobs.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuration")({ component: Config });

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const SOURCES = ["BrighterMonday","MyJobMag","Fuzu","JobwebKenya","CorporateStaffing"];
const TYPES = ["Full-time","Part-time","Contract","Internship","Remote"];

function Config() {
  const get = useServerFn(getMyWorkflow);
  const save = useServerFn(upsertWorkflow);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["workflow"], queryFn: () => get() });
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    const w = data?.workflow;
    setForm({
      id: w?.id,
      name: w?.name ?? "My Daily Job Hunt",
      active: w?.active ?? true,
      run_time: w?.run_time ?? "08:00",
      run_days: w?.run_days ?? ["mon","tue","wed","thu","fri"],
      target_roles: (w?.target_roles ?? []).join(", "),
      target_counties: (w?.target_counties ?? []).join(", "),
      target_companies: (w?.target_companies ?? []).join(", "),
      sources: w?.sources ?? SOURCES,
      job_types: w?.job_types ?? ["Full-time"],
      min_match_score: w?.min_match_score ?? 70,
      max_applications: w?.max_applications ?? 10,
      minimum_salary: w?.minimum_salary ?? "",
      cover_letter_tone: w?.cover_letter_tone ?? "Formal",
      auto_apply: w?.auto_apply ?? false,
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: () => save({ data: {
      id: form.id, name: form.name, active: form.active,
      run_time: form.run_time, run_days: form.run_days,
      target_roles: form.target_roles.split(",").map((s: string) => s.trim()).filter(Boolean),
      target_counties: form.target_counties.split(",").map((s: string) => s.trim()).filter(Boolean),
      target_companies: form.target_companies.split(",").map((s: string) => s.trim()).filter(Boolean),
      sources: form.sources, job_types: form.job_types,
      min_match_score: Number(form.min_match_score),
      max_applications: Number(form.max_applications),
      minimum_salary: form.minimum_salary ? Number(form.minimum_salary) : null,
      cover_letter_tone: form.cover_letter_tone, auto_apply: form.auto_apply,
    }}),
    onSuccess: () => { toast.success("Workflow saved"); navigate({ to: "/find-jobs" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggle = (k: string, v: string) => set(k, form[k].includes(v) ? form[k].filter((x: string) => x !== v) : [...form[k], v]);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Configuration</h1>
      <p className="text-muted-foreground text-sm mb-6">Schedule when and what to scrape, and how to apply.</p>

      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Workflow active</div>
            <p className="text-xs text-muted-foreground">Runs automatically on the schedule below</p>
          </div>
          <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
        </div>

        <div><Label>Workflow name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>

        <div className="grid grid-cols-2 gap-4">
          <div><Label>Run time (24h, EAT)</Label><Input type="time" value={form.run_time} onChange={(e) => set("run_time", e.target.value)} /></div>
          <div>
            <Label>Run days</Label>
            <div className="flex gap-1 flex-wrap mt-1.5">
              {DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggle("run_days", d)}
                  className={`px-2.5 py-1 rounded text-xs uppercase border ${form.run_days.includes(d) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div><Label>Target roles (comma-separated)</Label><Input value={form.target_roles} onChange={(e) => set("target_roles", e.target.value)} placeholder="Software Engineer, Data Analyst" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Counties</Label><Input value={form.target_counties} onChange={(e) => set("target_counties", e.target.value)} placeholder="Nairobi, Mombasa" /></div>
          <div><Label>Target companies (optional)</Label><Input value={form.target_companies} onChange={(e) => set("target_companies", e.target.value)} placeholder="Safaricom, Equity Bank" /></div>
        </div>

        <div>
          <Label>Sources</Label>
          <div className="flex gap-2 flex-wrap mt-1.5">
            {SOURCES.map(s => (
              <button key={s} type="button" onClick={() => toggle("sources", s)}
                className={`px-3 py-1 rounded text-xs border ${form.sources.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Job types</Label>
          <div className="flex gap-2 flex-wrap mt-1.5">
            {TYPES.map(t => (
              <button key={t} type="button" onClick={() => toggle("job_types", t)}
                className={`px-3 py-1 rounded text-xs border ${form.job_types.includes(t) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div><Label>Min match %</Label><Input type="number" min={0} max={100} value={form.min_match_score} onChange={(e) => set("min_match_score", e.target.value)} /></div>
          <div><Label>Max applications/run</Label><Input type="number" min={1} value={form.max_applications} onChange={(e) => set("max_applications", e.target.value)} /></div>
          <div><Label>Min salary (KES)</Label><Input type="number" value={form.minimum_salary} onChange={(e) => set("minimum_salary", e.target.value)} placeholder="optional" /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><Label>Cover letter tone</Label>
            <select value={form.cover_letter_tone} onChange={(e) => set("cover_letter_tone", e.target.value)} className="w-full h-9 border rounded-md px-2 bg-background">
              <option>Formal</option><option>Friendly</option><option>Confident</option><option>Concise</option>
            </select>
          </div>
          <div className="flex items-end justify-between">
            <div><Label>Auto-generate letters</Label><p className="text-xs text-muted-foreground">For top matches each run</p></div>
            <Switch checked={form.auto_apply} onCheckedChange={(v) => set("auto_apply", v)} />
          </div>
        </div>

        <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="w-full">
          {mut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save workflow & continue
        </Button>
      </Card>
    </div>
  );
}
