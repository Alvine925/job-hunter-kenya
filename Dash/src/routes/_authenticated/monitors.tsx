import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listJobMonitors,
  createJobMonitor,
  updateJobMonitor,
  deleteJobMonitor,
  scrapeJobMonitors,
  scrapeOneJobMonitor,
  getMyProfile,
  type JobMonitorFrequency,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2, RefreshCw, Globe, ExternalLink, PenSquare, Check, Lock, Gift, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type JobMonitor = {
  id: string;
  name: string;
  url: string;
  notes: string | null;
  active: boolean;
  scrape_frequency: string;
  last_scraped_at: string | null;
  last_jobs_found: number | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
};

export const Route = createFileRoute("/_authenticated/monitors")({
  head: () => ({
    title: "Career Site Monitors - Tellus",
    meta: [
      { title: "Career Site Monitors - Tellus" },
      { name: "description", content: "Monitor careers pages and job sites for new vacancies matching your configuration." },
    ],
  }),
  component: Monitors,
});

function Monitors() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["job-monitors"],
    queryFn: () => listJobMonitors(),
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
  });

  const profile = profileData?.profile as any;
  const isPremium = profile?.current_plan === "upgraded" || (profile?.active_referrals ?? 0) >= 10;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [frequency, setFrequency] = useState<JobMonitorFrequency>("manual");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code ?? "";
  const referralLink = referralCode
    ? `${window.location.origin}/login?ref=${referralCode}`
    : window.location.origin;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const activeReferrals = profile?.active_referrals ?? 0;
  const progressPercent = Math.min((activeReferrals / 10) * 100, 100);

  const createMut = useMutation({
    mutationFn: () =>
      createJobMonitor({
        name,
        url,
        notes: notes || undefined,
        scrape_frequency: frequency,
      }),
    onSuccess: () => {
      toast.success("Monitor added");
      setName("");
      setUrl("");
      setNotes("");
      setFrequency("manual");
      qc.invalidateQueries({ queryKey: ["job-monitors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scrapeAllMut = useMutation({
    mutationFn: () => scrapeJobMonitors(),
    onSuccess: (r) => {
      toast.success(`Scrape done — ${r.totalFound} jobs found, ${r.totalAttached} added to your list`);
      qc.invalidateQueries({ queryKey: ["job-monitors"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monitors = (data?.monitors ?? []) as JobMonitor[];

  const resetAddForm = () => {
    setName("");
    setUrl("");
    setNotes("");
    setFrequency("manual");
  };

  if (isLoading || profileLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
          {!isPremium && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Upgraded plan is required to add career site monitors, edit schedules, and trigger page scraping. Refer 10 friends to upgrade your account and unlock it!
              </p>
              <Button
                size="sm"
                onClick={() => navigate({ to: "/settings", search: { tab: "referral" } as any })}
                className="font-semibold text-xs shrink-0 w-full sm:w-auto shadow-sm h-9"
              >
                Refer Friends to Upgrade
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Monitored sites
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Add exact career page URLs to check for new jobs. Scrape on demand or set daily/weekly
                checks.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap sm:shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isPremium) {
                    toast.error("Upgraded plan required. Refer 10 friends to unlock Career Site Monitors.");
                    return;
                  }
                  scrapeAllMut.mutate();
                }}
                disabled={scrapeAllMut.isPending || monitors.length === 0}
                className={cn(
                  "h-10 sm:h-9 w-full sm:w-auto border-border/60 font-semibold text-xs sm:text-sm",
                  !isPremium && "opacity-60 cursor-not-allowed"
                )}
              >
                {scrapeAllMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                <span className="sm:hidden">Scrape</span>
                <span className="hidden sm:inline">Scrape all</span>
              </Button>

              {!isEditing ? (
                <Button
                  onClick={() => {
                    if (!isPremium) {
                      toast.error("Upgraded plan required. Refer 10 friends to unlock Career Site Monitors.");
                      return;
                    }
                    setIsEditing(true);
                  }}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-10 sm:h-9 w-full sm:w-auto border-border/60 font-semibold text-xs sm:text-sm",
                    !isPremium && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <PenSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  {!isPremium && <Lock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />}
                  <span className="sm:hidden">Edit</span>
                  <span className="hidden sm:inline">Edit monitors</span>
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    resetAddForm();
                  }}
                  variant="default"
                  size="sm"
                  className="h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 sm:mr-1.5" />
                  Done
                </Button>
              )}
            </div>
          </div>

          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Edit mode: add sites below, toggle active, scrape individually, or remove monitors.
            </p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 animate-in fade-in duration-300">
        {isEditing && (
          <section
            aria-label="Add site to monitor"
            className="space-y-4 pb-5 sm:pb-6 border-b border-border/60"
          >
            <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2 text-foreground">
              <Plus className="w-4 h-4 text-primary shrink-0" />
              Add site to monitor
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  placeholder="e.g. Safaricom careers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 sm:h-9 border-border/80"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Exact URL path</Label>
                <Input
                  placeholder="https://company.co.ke/careers/jobs"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-10 sm:h-9 border-border/80"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Scroll page lists NGO roles; email apply in footer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border-border/80 text-sm resize-none"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5 w-full sm:max-w-[220px]">
                <Label className="text-xs text-muted-foreground">Schedule</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as JobMonitorFrequency)}
                >
                  <SelectTrigger className="h-10 sm:h-9 w-full border-border/80 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual" className="text-xs">
                      Manual only
                    </SelectItem>
                    <SelectItem value="daily" className="text-xs">
                      Daily (with cron)
                    </SelectItem>
                    <SelectItem value="weekly" className="text-xs">
                      Weekly (with cron)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="h-10 sm:h-9 w-full sm:w-auto font-semibold shrink-0"
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !name.trim() || !url.trim()}
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1.5" />
                )}
                Save monitor
              </Button>
            </div>
          </section>
        )}

        {monitors.length === 0 ? (
          <p className="py-12 sm:py-16 text-center text-muted-foreground text-sm">
            No monitors yet. Tap <span className="font-medium text-foreground">Edit</span>, then add
            the full URL of a careers page, jobs listing, or a single job post.
          </p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="Monitored sites list">
            {monitors.map((m) => (
              <li key={m.id}>
                <MonitorRow
                  monitor={m}
                  isEditing={isEditing}
                  onChange={() => {
                    qc.invalidateQueries({ queryKey: ["job-monitors"] });
                    qc.invalidateQueries({ queryKey: ["jobs"] });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function MonitorRow({
  monitor,
  isEditing,
  onChange,
}: {
  monitor: JobMonitor;
  isEditing: boolean;
  onChange: () => void;
}) {
  const scrapeMut = useMutation({
    mutationFn: () => scrapeOneJobMonitor(monitor.id),
    onSuccess: (r) => {
      const row = r.results?.[0];
      if (row?.error) toast.error(row.error);
      else toast.success(`Found ${row?.jobsFound ?? 0} jobs, ${row?.jobsAttached ?? 0} added`);
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (active: boolean) => updateJobMonitor({ id: monitor.id, active }),
    onSuccess: onChange,
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteJobMonitor(monitor.id),
    onSuccess: () => {
      toast.success("Removed");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lastScrapeLabel = monitor.last_scraped_at
    ? new Date(monitor.last_scraped_at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

  return (
    <article className="py-4 sm:py-5">
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Title + status */}
        <div className="flex items-start gap-2 min-w-0">
          {!isEditing ? (
            <span
              className={cn(
                "w-2 h-2 rounded-full shrink-0 mt-1.5",
                monitor.active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30",
              )}
              title={monitor.active ? "Active" : "Inactive"}
              aria-hidden
            />
          ) : (
            <Globe className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" aria-hidden />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                {monitor.name}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-xs capitalize shrink-0"
              >
                {monitor.scrape_frequency}
              </Badge>
              {!monitor.active && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                  Paused
                </Badge>
              )}
              {monitor.last_scrape_status === "error" && (
                <Badge variant="destructive" className="text-[10px] sm:text-xs shrink-0">
                  Last scrape failed
                </Badge>
              )}
            </div>

            <a
              href={monitor.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-start gap-1 break-all leading-relaxed"
            >
              <span className="min-w-0">{monitor.url}</span>
              <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" aria-hidden />
            </a>

            {monitor.notes && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">{monitor.notes}</p>
            )}

            <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-1.5 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
              <div>
                <dt className="inline font-medium text-foreground/80">Last scrape: </dt>
                <dd className="inline">{lastScrapeLabel}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground/80">Jobs found: </dt>
                <dd className="inline tabular-nums">{monitor.last_jobs_found ?? 0}</dd>
              </div>
            </dl>

            {monitor.last_scrape_error && (
              <p className="text-xs text-destructive font-mono break-words leading-relaxed">
                {monitor.last_scrape_error}
              </p>
            )}
          </div>
        </div>

        {isEditing && (
          <div
            className={cn(
              "flex flex-col gap-2 pt-3 border-t border-border/60",
              "sm:flex-row sm:items-center sm:justify-end sm:gap-3",
            )}
          >
            <div className="flex items-center gap-2 sm:mr-auto">
              <Switch
                checked={monitor.active}
                onCheckedChange={(v) => toggleMut.mutate(v)}
                id={`active-${monitor.id}`}
              />
              <Label
                htmlFor={`active-${monitor.id}`}
                className="text-xs font-medium text-foreground cursor-pointer select-none"
              >
                Active
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => scrapeMut.mutate()}
                disabled={scrapeMut.isPending || !monitor.active}
                className="h-10 sm:h-9 border-border/60 font-medium"
              >
                {scrapeMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Scrape</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="h-10 sm:h-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive font-medium"
              >
                {deleteMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span className="ml-2">Remove</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
