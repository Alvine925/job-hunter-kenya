import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyWorkflow,
  listWorkflows,
  upsertWorkflow,
  setActiveWorkflow,
  deleteWorkflow,
  listJobs,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  X,
  Star,
  Trash2,
  Building2,
  Landmark,
  Cpu,
  HeartHandshake,
  PenSquare,
  Check,
  Clock,
  Filter,
  Lock,
} from "lucide-react";
import { ConfigSkeleton } from "@/components/ui/skeleton-loaders";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { RoleSearchField } from "@/components/configuration/role-search-field";
import { CompanySectorChips } from "@/components/configuration/company-sector-chips";
import { listScrapedJobs } from "@/lib/scraped-jobs";
import {
  INDUSTRY_PRESETS,
  COUNTY_SUGGESTIONS,
  type CompanySectorId,
  type IndustryPresetId,
  joinCsv,
  parseCsv,
} from "@/lib/configuration-suggestions";

export const Route = createFileRoute("/_authenticated/configuration")({
  head: () => ({
    title: "Scraper Configuration - Tellus",
    meta: [
      { title: "Scraper Configuration - Tellus" },
      { name: "description", content: "Configure target roles, locations, companies, and settings for your automated job search." },
    ],
  }),
  component: Config,
});

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SOURCES = [
  "BrighterMonday",
  "MyJobMag",
  "MyJobsInKenya",
  "Fuzu",
  "LinkedIn",
  "JobwebKenya",
  "CorporateStaffing",
];
const TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Remote"];

const INDUSTRY_ICONS: Record<IndustryPresetId, typeof Building2> = {
  NGO: HeartHandshake,
  Finance: Landmark,
  Tech: Cpu,
  Government: Building2,
};

type WorkflowForm = {
  id?: string;
  name: string;
  active: boolean;
  run_time: string;
  run_days: string[];
  target_roles: string;
  target_counties: string;
  target_companies: string;
  sources: string[];
  job_types: string[];
  min_match_score: number | string;
  max_applications: number | string;
  minimum_salary: string;
  cover_letter_tone: string;
  application_mode: string;
};

function workflowToForm(w: Record<string, unknown> | null | undefined): WorkflowForm {
  return {
    id: w?.id as string | undefined,
    name: (w?.name as string) ?? "My Daily Job Hunt",
    active: (w?.active as boolean) ?? true,
    run_time: (w?.run_time as string) ?? "08:00",
    run_days: (w?.run_days as string[]) ?? ["mon", "tue", "wed", "thu", "fri"],
    target_roles: ((w?.target_roles as string[]) ?? []).join(", "),
    target_counties: ((w?.target_counties as string[]) ?? []).join(", "),
    target_companies: ((w?.target_companies as string[]) ?? []).join(", "),
    sources: (w?.sources as string[])?.length ? (w?.sources as string[]) : [...SOURCES],
    job_types: (w?.job_types as string[])?.length ? (w?.job_types as string[]) : ["Full-time"],
    min_match_score: (w?.min_match_score as number) ?? 70,
    max_applications: (w?.max_applications as number) ?? 10,
    minimum_salary: w?.minimum_salary != null ? String(w.minimum_salary) : "",
    cover_letter_tone: (w?.cover_letter_tone as string) ?? "Formal",
    application_mode:
      (w?.application_mode as string) ?? ((w?.auto_apply as boolean) ? "automatic" : "manual"),
  };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      {children}
    </h3>
  );
}

function PreviewBadges({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="text-sm text-muted-foreground italic">{emptyLabel}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="text-xs font-medium">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function Config() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [form, setForm] = useState<WorkflowForm | null>(null);
  const [companySectors, setCompanySectors] = useState<CompanySectorId[]>([]);
  const [industryApplied, setIndustryApplied] = useState<IndustryPresetId | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: listWorkflows,
  });

  const { data: integration } = useQuery({
    queryKey: ["user_integration"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_integrations")
        .select("google_connected")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const isGoogleConnected = integration?.google_connected ?? false;

  const { data: profileRow } = useQuery({
    queryKey: ["profile_plan"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("current_plan")
        .eq("id", user.id)
        .single();
      return data;
    },
  });

  const isUpgraded = (profileRow as any)?.current_plan === "upgraded";

  const presets = listData?.workflows ?? [];

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["workflow", selectedId ?? "new"],
    queryFn: () => getMyWorkflow(selectedId),
    enabled: !listLoading && (!!selectedId || presets.length === 0),
  });

  const { data: scrapedJobs = [] } = useQuery({
    queryKey: ["scraped_jobs", "all"],
    queryFn: () => listScrapedJobs({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: userJobsData } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
    staleTime: 60_000,
  });

  const userJobs = userJobsData?.jobs ?? [];

  const { dynamicCompanies, dynamicSectors, dynamicRoles } = useMemo(() => {
    const companies = new Set<string>();
    const sectors = new Set<string>();
    const roles = new Set<string>();

    for (const j of scrapedJobs) {
      if (j.company?.trim()) companies.add(j.company.trim());
      if (j.sector?.trim()) sectors.add(j.sector.trim());
      if (j.title?.trim()) roles.add(j.title.trim());
    }

    for (const j of userJobs) {
      const companyStr = j.company as string | undefined;
      const sectorStr = j.sector as string | undefined;
      const titleStr = j.title as string | undefined;

      if (companyStr?.trim()) companies.add(companyStr.trim());
      if (sectorStr?.trim()) sectors.add(sectorStr.trim());
      if (titleStr?.trim()) roles.add(titleStr.trim());
    }

    return {
      dynamicCompanies: Array.from(companies).sort((a, b) => a.localeCompare(b)),
      dynamicSectors: Array.from(sectors).sort((a, b) => a.localeCompare(b)),
      dynamicRoles: Array.from(roles).sort((a, b) => a.localeCompare(b)),
    };
  }, [scrapedJobs, userJobs]);

  useEffect(() => {
    if (presets.length && !selectedId) {
      const active = presets.find((p) => p.active) ?? presets[0];
      setSelectedId(active.id as string);
    }
  }, [presets, selectedId]);

  useEffect(() => {
    if (detailLoading || listLoading) return;
    const w = detailData?.workflow;
    if (w && (w as { id?: string }).id === selectedId) {
      if (!form || form.id !== selectedId) {
        setForm(workflowToForm(w as Record<string, unknown>));
        setIndustryApplied(null);
        setCompanySectors([]);
      }
    } else if (presets.length === 0 && !form) {
      setForm(workflowToForm(null));
    }
  }, [detailData, detailLoading, listLoading, selectedId, presets.length, form]);

  const loadPreset = useCallback((id: string) => {
    setSelectedId(id);
    setIndustryApplied(null);
    setIsEditing(false);
  }, []);

  const handleCancel = () => {
    const w = detailData?.workflow;
    if (w) {
      setForm(workflowToForm(w as Record<string, unknown>));
      setIndustryApplied(null);
      setCompanySectors([]);
    } else {
      setForm(workflowToForm(null));
    }
    setIsEditing(false);
  };

  const set = (k: keyof WorkflowForm, v: unknown) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const toggle = (k: "run_days" | "sources" | "job_types", v: string) => {
    if (!form) return;
    const arr = form[k];
    set(
      k,
      arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
    );
  };

  const toggleCounty = (county: string) => {
    if (!form) return;
    const arr = parseCsv(form.target_counties);
    const exists = arr.find((x) => x.toLowerCase() === county.toLowerCase());
    set(
      "target_counties",
      joinCsv(
        exists ? arr.filter((x) => x.toLowerCase() !== county.toLowerCase()) : [...arr, county],
      ),
    );
  };

  const applyIndustryPreset = (presetId: IndustryPresetId) => {
    const preset = INDUSTRY_PRESETS.find((p) => p.id === presetId);
    if (!preset || !form) return;
    setForm({
      ...form,
      target_roles: joinCsv(preset.roles),
      target_counties: joinCsv(preset.counties),
      target_companies: joinCsv(preset.companies),
      job_types: preset.jobTypes ?? form.job_types,
    });
    setCompanySectors([...preset.sectors]);
    setIndustryApplied(presetId);
    toast.success(`Applied ${preset.label} preset`);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("No form");
      return upsertWorkflow({
        data: {
          id: form.id,
          name: form.name,
          active: form.active,
          run_time: form.run_time,
          run_days: form.run_days,
          target_roles: parseCsv(form.target_roles),
          target_counties: parseCsv(form.target_counties),
          target_companies: parseCsv(form.target_companies),
          sources: form.sources,
          job_types: form.job_types,
          min_match_score: Number(form.min_match_score),
          max_applications: Number(form.max_applications),
          minimum_salary: form.minimum_salary ? Number(form.minimum_salary) : null,
          cover_letter_tone: form.cover_letter_tone,
          application_mode: form.application_mode as "manual" | "automatic",
          auto_apply: form.application_mode === "automatic",
        },
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow"] });
      if (res?.workflow?.id) setSelectedId(res.workflow.id);
      toast.success("Configuration saved");
      setIsEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const newPresetMut = useMutation({
    mutationFn: () =>
      upsertWorkflow({
        data: {
          name: `Preset ${(presets.length || 0) + 1}`,
          active: presets.length === 0,
          target_roles: [],
          target_counties: ["Nairobi"],
          target_companies: [],
          sources: SOURCES.filter((s) => s !== "LinkedIn"),
          job_types: ["Full-time"],
          run_days: ["mon", "tue", "wed", "thu", "fri"],
        },
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      if (res?.workflow?.id) {
        setSelectedId(res.workflow.id);
        setForm(workflowToForm(res.workflow));
      }
      toast.success("New preset created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => setActiveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflow"] });
      toast.success("Active preset updated — scraping uses this setup");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      const next = res.workflows?.find((w) => w.active) ?? res.workflows?.[0];
      setSelectedId(next?.id as string | undefined);
      toast.success("Preset deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = listLoading || detailLoading || !form;
  if (isLoading) {
    return <ConfigSkeleton />;
  }

  const currentPreset = presets.find((p) => p.id === selectedId);
  const isActivePreset = currentPreset?.active === true;
  const roleTags = parseCsv(form.target_roles);
  const countyTags = parseCsv(form.target_counties);
  const companyTags = parseCsv(form.target_companies);

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
          <div className="space-y-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Configuration</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Save presets, apply industry templates, and tune what gets scraped and matched.
              </p>
            </div>

            {!isUpgraded && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
                <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                  Upgraded plan is required to edit configuration settings, switch presets, and manage your automated search filters.
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

            {!isEditing ? (
              <Button
                onClick={() => {
                  if (!isUpgraded) {
                    toast.error("Upgraded plan required. Refer 10 friends to unlock editing configuration presets.");
                    return;
                  }
                  setIsEditing(true);
                }}
                variant="outline"
                size="sm"
                className={cn(
                  "h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm border-border/60",
                  !isUpgraded && "opacity-60 cursor-not-allowed"
                )}
              >
                <PenSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                {!isUpgraded && <Lock className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />}
                Edit configuration
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:ml-auto sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm border-border/60"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="h-10 sm:h-9 font-semibold text-xs sm:text-sm shadow-sm"
                >
                  {saveMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8 animate-in fade-in duration-300">
        {/* Preset selector */}
        <section className="pb-6 border-b border-border/60 space-y-3" aria-label="Configuration preset">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Configuration preset
          </Label>
          <div className="space-y-2">
            <Select value={selectedId} onValueChange={loadPreset}>
              <SelectTrigger className="w-full h-10 sm:h-9 border-border/80">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id as string} value={p.id as string}>
                    {p.name as string}
                    {p.active ? " ★" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isUpgraded) {
                    toast.error("Upgraded plan required. Refer 10 friends to unlock preset management.");
                    return;
                  }
                  newPresetMut.mutate();
                }}
                disabled={newPresetMut.isPending}
                className={cn(
                  "h-10 sm:h-9 font-semibold text-xs border-border/60",
                  !isUpgraded && "opacity-60 cursor-not-allowed"
                )}
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-primary shrink-0" />
                New preset
              </Button>
              {selectedId && !isActivePreset ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!isUpgraded) {
                      toast.error("Upgraded plan required. Refer 10 friends to switch configuration presets.");
                      return;
                    }
                    activateMut.mutate(selectedId);
                  }}
                  disabled={activateMut.isPending}
                  className={cn(
                    "h-10 sm:h-9 font-semibold text-xs",
                    !isUpgraded && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <Star className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
                  <span className="truncate">Set active</span>
                </Button>
              ) : isActivePreset ? (
                <span className="h-10 sm:h-9 flex items-center justify-center text-xs text-primary font-medium gap-1 col-span-2 sm:col-span-1">
                  <Star className="w-3.5 h-3.5 fill-primary shrink-0" />
                  Active for scraping
                </span>
              ) : (
                <span className="hidden sm:block" />
              )}
            </div>

             {presets.length > 1 && selectedId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
                onClick={() => {
                  if (!isUpgraded) {
                    toast.error("Upgraded plan required. Refer 10 friends to delete presets.");
                    return;
                  }
                  if (confirm("Delete this preset?")) deleteMut.mutate(selectedId);
                }}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete preset
              </Button>
            )}
          </div>
        </section>

        {!isEditing ? (
          <div className="divide-y divide-border/60">
            <section className="py-5 sm:py-6 first:pt-0 space-y-4">
              <SectionTitle icon={Clock}>Schedule & runs</SectionTitle>
              <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Scraper status
                  </dt>
                  <dd className="flex items-center gap-2 mt-1 font-medium text-foreground">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        form.active ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40",
                      )}
                    />
                    {form.active ? "Scheduled & active" : "Paused"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Run time (EAT)
                  </dt>
                  <dd className="mt-1 font-medium text-foreground">{form.run_time}</dd>
                  <dd className="text-xs text-muted-foreground mt-0.5">
                    {form.run_days.map((d) => d.toUpperCase()).join(", ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="py-5 sm:py-6 space-y-4">
              <SectionTitle icon={Building2}>Search criteria</SectionTitle>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Target roles
                  </p>
                  <PreviewBadges items={roleTags} emptyLabel="Any role" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Counties
                  </p>
                  <PreviewBadges items={countyTags} emptyLabel="Any county" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Companies
                  </p>
                  <PreviewBadges items={companyTags} emptyLabel="Any company" />
                </div>
                {companySectors.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sectors
                    </p>
                    <PreviewBadges items={companySectors} emptyLabel="Any sector" />
                  </div>
                )}
              </div>
            </section>

            <section className="py-5 sm:py-6 space-y-4">
              <SectionTitle icon={Landmark}>Sources & job types</SectionTitle>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Sources
                  </p>
                  <PreviewBadges items={form.sources} emptyLabel="None" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Job types
                  </p>
                  <PreviewBadges items={form.job_types} emptyLabel="None" />
                </div>
              </div>
            </section>

            <section className="py-5 sm:py-6 space-y-4">
              <SectionTitle icon={Filter}>AI & limits</SectionTitle>
              <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Min match
                  </dt>
                  <dd className="mt-1 font-medium">{form.min_match_score}%</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Max applications / run
                  </dt>
                  <dd className="mt-1 font-medium">{form.max_applications}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Min salary
                  </dt>
                  <dd className="mt-1 font-medium">
                    {form.minimum_salary
                      ? `${Number(form.minimum_salary).toLocaleString()} KES`
                      : "Not specified"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cover letter tone
                  </dt>
                  <dd className="mt-1 font-medium">{form.cover_letter_tone}</dd>
                </div>
                <div className="min-[400px]:col-span-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Application mode
                  </dt>
                  <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        form.application_mode === "automatic" && "border-primary/40 text-primary",
                      )}
                    >
                      {form.application_mode === "automatic" ? "Automatic" : "Manual"}
                    </Badge>
                    {form.application_mode === "automatic" && !isUpgraded && (
                      <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                        ⚠️ Upgraded plan required
                      </span>
                    )}
                    {form.application_mode === "automatic" && isUpgraded && !isGoogleConnected && (
                      <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                        ⚠️ Google integration required (disconnected)
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3 pb-8 border-b border-border/60">
              <div>
                <Label className="text-sm font-semibold">Industry preset</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fills roles, counties, companies, and sectors together.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {INDUSTRY_PRESETS.map((preset) => {
                  const Icon = INDUSTRY_ICONS[preset.id];
                  const applied = industryApplied === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyIndustryPreset(preset.id)}
                      className={cn(
                        "flex flex-col items-start p-3 rounded-lg border text-left transition-colors min-h-[88px]",
                        applied
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border/80 hover:bg-muted/30",
                      )}
                    >
                      <Icon className="w-4 h-4 mb-1 text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-medium leading-tight">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 pb-8 border-b border-border/60">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Scheduled runs</p>
                  <p className="text-xs text-muted-foreground">Active preset is used by the scraper cron</p>
                </div>
                <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Preset name</Label>
                <Input
                  className="h-10 sm:h-9"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Run time (24h, EAT)</Label>
                  <Input
                    type="time"
                    className="h-10 sm:h-9"
                    value={form.run_time}
                    onChange={(e) => set("run_time", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Run days</Label>
                  <div className="flex gap-1 flex-wrap">
                    {DAYS.map((d) => (
                      <ChipToggle
                        key={d}
                        label={d}
                        active={form.run_days.includes(d)}
                        onClick={() => toggle("run_days", d)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4 pb-8 border-b border-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Search criteria
              </p>
              <RoleSearchField
                value={form.target_roles}
                onChange={(v) => set("target_roles", v)}
                dynamicRoles={dynamicRoles}
              />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Counties</Label>
                <Input
                  value={form.target_counties}
                  onChange={(e) => set("target_counties", e.target.value)}
                  placeholder="Nairobi, Mombasa, Kisumu"
                  className="h-10 sm:h-9"
                />
                <CountyChips selected={countyTags} onToggle={toggleCounty} />
              </div>
              <CompanySectorChips
                value={form.target_companies}
                onChange={(v) => set("target_companies", v)}
                selectedSectors={companySectors}
                onSectorsChange={setCompanySectors}
                dynamicCompanies={dynamicCompanies}
                dynamicSectors={dynamicSectors}
              />
            </section>

            <section className="space-y-4 pb-8 border-b border-border/60">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sources & job types
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sources</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {SOURCES.map((s) => (
                    <ChipToggle
                      key={s}
                      label={s}
                      active={form.sources.includes(s)}
                      onClick={() => toggle("sources", s)}
                    />
                  ))}
                </div>
                {form.sources.includes("LinkedIn") && (
                  <p className="text-xs text-muted-foreground pt-1">
                    LinkedIn needs your <strong>li_at</strong> cookie in{" "}
                    <Link to="/settings" search={{ tab: "linkedin" } as any} className="text-primary underline">
                      Settings
                    </Link>
                    .
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Job types</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {TYPES.map((t) => (
                    <ChipToggle
                      key={t}
                      label={t}
                      active={form.job_types.includes(t)}
                      onClick={() => toggle("job_types", t)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI & limits
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Min match %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-10 sm:h-9"
                    value={form.min_match_score}
                    onChange={(e) => set("min_match_score", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Max applications / run</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-10 sm:h-9"
                    value={form.max_applications}
                    onChange={(e) => set("max_applications", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Min salary (KES)</Label>
                  <Input
                    type="number"
                    className="h-10 sm:h-9"
                    value={form.minimum_salary}
                    onChange={(e) => set("minimum_salary", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cover letter tone</Label>
                  <Select value={form.cover_letter_tone} onValueChange={(v) => set("cover_letter_tone", v)}>
                    <SelectTrigger className="h-10 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Formal", "Friendly", "Confident", "Concise"].map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Application mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["manual", "Manual"],
                        ["automatic", "Automatic"],
                      ] as const
                    ).map(([value, label]) => {
                      const isLocked = value === "automatic" && (!isUpgraded || !isGoogleConnected);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (value === "automatic") {
                              if (!isUpgraded) {
                                toast.error(
                                  "Automatic job application requires an Upgraded plan. Refer 10 friends to unlock this feature!",
                                );
                                return;
                              }
                              if (!isGoogleConnected) {
                                toast.error(
                                  "Google Workspace integration is required to enable Automatic job application. Please connect it first.",
                                );
                                return;
                              }
                            }
                            set("application_mode", value);
                          }}
                          className={cn(
                            "h-10 sm:h-9 rounded-md border text-sm font-semibold transition-colors flex items-center justify-center gap-1.5",
                            form.application_mode === value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border/80 text-muted-foreground hover:text-foreground",
                            isLocked && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {label}
                          {isLocked && (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!isUpgraded ? (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex flex-col gap-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      <span className="font-bold">Upgraded Plan Required</span>
                      <span>Automatic job applications is a premium feature. Refer 10 friends to upgrade your account and unlock it!</span>
                      <Link to="/settings" search={{ tab: "referral" } as any} className="underline font-bold hover:text-primary transition-colors mt-0.5">
                        View Referrals Panel
                      </Link>
                    </div>
                  ) : !isGoogleConnected ? (
                    <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                      <span>Google Workspace integration is required for Automatic mode.</span>
                      <a href="/integrations" className="underline font-bold hover:text-primary transition-colors">
                        Connect Google Account
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-2 sm:flex-row pt-2 border-t border-border/60">
              <Button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="h-10 sm:h-9 w-full sm:w-auto font-semibold"
              >
                {saveMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save configuration
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saveMut.isPending}
                className="h-10 sm:h-9 w-full sm:w-auto border-border/60"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 py-1.5 rounded-md text-xs border font-medium uppercase sm:normal-case transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function CountyChips({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (county: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOn = (c: string) => selected.some((s) => s.toLowerCase() === c.toLowerCase());

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {open ? "Hide counties" : "Browse counties"}
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="flex gap-1.5 flex-wrap max-h-32 overflow-y-auto p-2 border rounded-md bg-muted/20 mt-1"
        >
          {COUNTY_SUGGESTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                isOn(c) ? "bg-primary text-primary-foreground border-primary" : "bg-background"
              }`}
            >
              {isOn(c) ? <X className="w-3 h-3 inline mr-0.5" /> : <Plus className="w-3 h-3 inline mr-0.5" />}
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
