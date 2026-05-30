import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  boardLabel,
  listScrapedJobs,
  MARKETPLACE_BOARDS,
  type MarketplaceBoardId,
  type ScrapedJob,
} from "@/lib/scraped-jobs";
import { listJobs } from "@/lib/api";
import type { JobApplicationStatus } from "@/lib/job-list-utils";
import { MarketplaceJobList } from "@/components/marketplace/marketplace-job-list";
import { MarketplaceBoardSelect } from "@/components/marketplace/marketplace-board-select";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { MarketplaceInsightsPanel } from "@/components/marketplace/marketplace-insights-panel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, SearchCheck, X, Sparkles, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TellusLoader } from "@/components/ui/tellus-loader";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { COMPANY_SECTORS } from "@/lib/configuration-suggestions";
import {
  buildProfessionBucketIndex,
  buildProfessionOptionsFromBuckets,
  jobMatchesProfessionFilter,
  computeJobMatch,
} from "@/lib/marketplace-profession-match";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Normalize a user job record into the ScrapedJob shape used by MarketplaceJobLine */
function normalizeUserJob(j: Record<string, unknown>): ScrapedJob {
  return {
    id: `user_${String(j.id ?? "")}`,
    source: (j.source as string) ?? null,
    site: null,
    source_url: (j.source_url as string) ?? "",
    title: (j.title as string) ?? "Untitled",
    company: (j.company as string) ?? null,
    company_summary: null,
    role_description: (j.role_description as string) ?? null,
    location: (j.location as string) ?? null,
    county: (j.county as string) ?? null,
    description: (j.description as string) ?? null,
    description_summary: (j.match_reason as string) ?? null,
    requirements: null,
    responsibilities: null,
    job_type: (j.job_type as string) ?? null,
    work_type: null,
    salary_text: null,
    application_url: (j.application_url as string) ?? null,
    application_email: (j.application_email as string) ?? null,
    application_method: (j.application_method as string) ?? null,
    deadline: (j.deadline as string) ?? null,
    deadline_text: j.deadline_text
      ? (j.deadline_text as string)
      : j.deadline
        ? new Date(j.deadline as string).toLocaleDateString()
        : null,
    sector: (j.sector as string) ?? null,
    experience_level: null,
    education_level: null,
    scraped_at: (j.scraped_at as string) ?? (j.created_at as string) ?? null,
    application_status: (j.application_status as JobApplicationStatus) ?? null,
  };
}

type SheetDraftFilters = {
  board: MarketplaceBoardId;
  professionFilter: string;
  companyFilter: string;
  categoryFilter: string;
  dateFilter: string;
  sortBy: string;
};

const DEFAULT_SHEET_DRAFT: SheetDraftFilters = {
  board: "all",
  professionFilter: "all",
  companyFilter: "all",
  categoryFilter: "all",
  dateFilter: "all",
  sortBy: "match_score",
};

function applyMarketplaceFilters(
  jobs: ScrapedJob[],
  args: {
    board: MarketplaceBoardId;
    search: string;
    companyFilter: string;
    categoryFilter: string;
    professionFilter: string;
    dateFilter: string;
    sortBy: string;
    professionBuckets: Map<string, string>;
  },
): ScrapedJob[] {
  let pool = jobs;

  if (args.board !== "all") {
    pool = pool.filter((j) => boardLabel(j) === args.board);
  }

  const term = args.search.toLowerCase();
  if (term) {
    pool = pool.filter(
      (j) =>
        j.title?.toLowerCase().includes(term) ||
        j.company?.toLowerCase().includes(term) ||
        boardLabel(j).toLowerCase().includes(term) ||
        j.description?.toLowerCase().includes(term),
    );
  }

  if (args.companyFilter !== "all") {
    pool = pool.filter(
      (j) => j.company?.trim().toLowerCase() === args.companyFilter.toLowerCase(),
    );
  }

  if (args.categoryFilter !== "all") {
    pool = pool.filter(
      (j) => j.sector?.trim().toLowerCase() === args.categoryFilter.toLowerCase(),
    );
  }

  if (args.professionFilter !== "all") {
    pool = pool.filter((j) =>
      jobMatchesProfessionFilter(j, args.professionFilter, args.professionBuckets.get(j.id)),
    );
  }

  if (args.dateFilter !== "all") {
    const now = new Date();
    pool = pool.filter((j) => {
      if (!j.scraped_at) return false;
      const date = new Date(j.scraped_at);
      if (isNaN(date.getTime())) return false;
      const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      if (args.dateFilter === "24h") return diffHours <= 24;
      if (args.dateFilter === "week") return diffHours <= 24 * 7;
      if (args.dateFilter === "month") return diffHours <= 24 * 30;
      return true;
    });
  }

  pool = [...pool];
  if (args.sortBy === "match_score") {
    pool.sort((a, b) => {
      const sa = a.match_score ?? 0;
      const sb = b.match_score ?? 0;
      if (sb !== sa) return sb - sa;
      const da = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
      const db = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
      return db - da;
    });
  } else if (args.sortBy === "newest") {
    pool.sort((a, b) => {
      const da = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
      const db = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
      return db - da;
    });
  } else if (args.sortBy === "oldest") {
    pool.sort((a, b) => {
      const da = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
      const db = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
      return da - db;
    });
  } else if (args.sortBy === "company") {
    pool.sort((a, b) => (a.company || "").localeCompare(b.company || ""));
  } else if (args.sortBy === "title") {
    pool.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }

  return pool;
}

export function MarketplacePageContent() {
  const [board, setBoard] = useState<MarketplaceBoardId>("all");
  const [filter, setFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [professionFilter, setProfessionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("match_score");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sheetDraft, setSheetDraft] = useState<SheetDraftFilters>(DEFAULT_SHEET_DRAFT);
  const [filterOptionsReady, setFilterOptionsReady] = useState(false);
  const [isFilterPending, startFilterTransition] = useTransition();
  const listingsSnapshotRef = useRef<ScrapedJob[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Collapsible header on scroll ──
  const [headerHidden, setHeaderHidden] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // Find the closest scrollable ancestor (the AppLayout <main> with overflow-y-auto)
    let scrollEl: HTMLElement | Window = window;
    let el = containerRef.current?.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        scrollEl = el;
        break;
      }
      el = el.parentElement;
    }

    const THRESHOLD = 10;

    const handleScroll = () => {
      const currentY =
        scrollEl instanceof Window ? scrollEl.scrollY : (scrollEl as HTMLElement).scrollTop;
      const delta = currentY - lastScrollY.current;

      if (Math.abs(delta) < THRESHOLD) return;

      if (delta > 0 && currentY > 60) {
        setHeaderHidden(true);
      } else if (delta < 0) {
        setHeaderHidden(false);
      }

      lastScrollY.current = currentY;
    };

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filter.trim()), 280);
    return () => window.clearTimeout(timer);
  }, [filter]);

  // Snapshot applied filters when the sheet opens (draft edits don't apply until confirmed)
  useEffect(() => {
    if (!filtersOpen) return;
    setSheetDraft({
      board,
      professionFilter,
      companyFilter,
      categoryFilter,
      dateFilter,
      sortBy,
    });
    // Only re-sync when the sheet opens, not on each draft change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersOpen]);

  // Scraped marketplace jobs
  const {
    data: scrapedJobs = [],
    isLoading: scrapedLoading,
    isError: scrapedError,
    error: scrapedErr,
  } = useQuery({
    queryKey: ["scraped_jobs", "all", "full"],
    queryFn: () => listScrapedJobs(),
    staleTime: 60_000,
  });

  // User's own scraped/matched jobs
  const {
    data: userJobsData,
  } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => listJobs(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const userJobs = userJobsData?.jobs ?? [];

  // Fetch user profile skills and desired roles
  const { data: profile } = useQuery({
    queryKey: ["profile-skills"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: p } = await (supabase as any)
        .from("profiles")
        .select("id, skills, desired_roles, full_name, preferred_county, experience_level")
        .eq("id", user.id)
        .single();
      return p;
    },
    enabled: isAuthenticated && (scrapedJobs.length > 0 || Boolean(userJobsData)),
    staleTime: 5 * 60_000,
  });

  // Merge both sources into one list, deduped by title+company
  const allJobs = useMemo(() => {
    // Maps to efficiently match scraped jobs with user jobs
    const userJobByUrl = new Map<string, typeof userJobs[0]>();
    const userJobByKey = new Map<string, typeof userJobs[0]>();

    for (const j of userJobs) {
      if (j.source_url) {
        userJobByUrl.set(String(j.source_url).trim().toLowerCase(), j);
      }
      const key = `${String(j.title ?? "").toLowerCase().trim()}|${String(j.company ?? "").toLowerCase().trim()}`;
      userJobByKey.set(key, j);
    }

    const seen = new Set<string>();
    const merged: ScrapedJob[] = [];

    // Add scraped jobs first
    for (const j of scrapedJobs) {
      const key = `${(j.title ?? "").toLowerCase().trim()}|${(j.company ?? "").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);

        // Find matching user job by URL first, then by title+company key
        const urlKey = j.source_url ? j.source_url.trim().toLowerCase() : "";
        const matchedUserJob = (urlKey ? userJobByUrl.get(urlKey) : null) || userJobByKey.get(key);

        if (matchedUserJob) {
          merged.push({
            ...j,
            application_status: matchedUserJob.application_status as JobApplicationStatus,
          });
        } else {
          merged.push(j);
        }
      }
    }

    // Add user jobs that aren't already in scraped
    for (const j of userJobs) {
      const key = `${String(j.title ?? "").toLowerCase().trim()}|${String(j.company ?? "").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(normalizeUserJob(j));
      }
    }

    // Attach match score and reason if profile is available
    if (!profile) return merged;

    return merged.map((job) => {
      // 1. Check if we have a server-side cached match score for this user
      const cached = profile.id ? job.match_score_cache?.[profile.id] : null;
      if (cached && typeof cached.score === "number") {
        return {
          ...job,
          match_score: cached.score,
          match_reason: cached.reason,
        };
      }

      // 2. Fall back to client-side computeJobMatch
      const match = computeJobMatch(job, {
        skills: profile.skills ?? [],
        desiredRoles: profile.desired_roles ?? [],
        preferredCounty: (profile as any).preferred_county,
        experienceLevel: (profile as any).experience_level,
      });
      return {
        ...job,
        match_score: match.percent,
        match_reason: match.reason,
      };
    });
  }, [scrapedJobs, userJobs, profile]);

  useEffect(() => {
    setFilterOptionsReady(false);
    const hasIdleCallback = "requestIdleCallback" in window && "cancelIdleCallback" in window;
    if (!hasIdleCallback) {
      const timer = window.setTimeout(() => setFilterOptionsReady(true), 150);
      return () => window.clearTimeout(timer);
    }
    const scheduleIdle = window.requestIdleCallback;
    const cancelIdle = window.cancelIdleCallback;
    const id = scheduleIdle(() => setFilterOptionsReady(true));
    return () => cancelIdle(id);
  }, [allJobs.length]);

  const COMMON_SKILLS = useMemo(() => [
    "SQL",
    "Python",
    "Project Management",
    "Excel",
    "Marketing",
    "Sales",
    "Accounting",
    "HR",
    "Logistics",
    "Software Development",
    "Customer Service",
    "Java",
    "React",
    "Finance",
    "Monitoring & Evaluation",
    "Procurement",
    "Public Health",
    "Clinical Medicine",
    "Supply Chain",
  ], []);

  // Top skills in demand
  const skillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const skill of COMMON_SKILLS) {
      counts[skill] = 0;
    }
    for (const job of allJobs) {
      const text = `${job.title ?? ""} ${job.description ?? ""} ${job.role_description ?? ""} ${job.requirements ?? ""}`.toLowerCase();
      for (const skill of COMMON_SKILLS) {
        if (text.includes(skill.toLowerCase())) {
          counts[skill]++;
        }
      }
    }
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [allJobs, COMMON_SKILLS]);

  // Match stats based on database profile skills and desired roles
  const matchStats = useMemo(() => {
    const hasSkills = profile?.skills && profile.skills.length > 0;
    const hasRoles = profile?.desired_roles && profile.desired_roles.length > 0;

    if ((!hasSkills && !hasRoles) || allJobs.length === 0) {
      return { percent: 0, matchedCount: 0 };
    }

    let matchedCount = 0;
    for (const job of allJobs) {
      if (job.match_score && job.match_score > 0) {
        matchedCount++;
      }
    }

    const percent = Math.round((matchedCount / allJobs.length) * 100);
    return { percent, matchedCount };
  }, [allJobs, profile]);

  // Hot sectors
  const hotSectors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of allJobs) {
      if (job.sector?.trim()) {
        const sector = job.sector.trim();
        counts[sector] = (counts[sector] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [allJobs]);

  // Board counts
  const boardCounts = useMemo(() => {
    const c: Record<string, number> = { all: allJobs.length };
    for (const b of MARKETPLACE_BOARDS) {
      if (b.id === "all") continue;
      c[b.id] = allJobs.filter((j) => boardLabel(j) === b.id).length;
    }
    return c;
  }, [allJobs]);

  // Company list (predefined Kenyan companies + active ones from database)
  const companyOptions = useMemo(() => {
    const activeSet = new Set<string>();
    for (const j of allJobs) {
      if (j.company?.trim()) {
        activeSet.add(j.company.trim());
      }
    }

    const activeList = Array.from(activeSet).sort((a, b) => a.localeCompare(b));
    if (!filterOptionsReady && !filtersOpen && companyFilter === "all") {
      return { activeList, inactiveList: [] };
    }

    const presetCompanies = Array.from(new Set(Object.values(COMPANY_SECTORS).flatMap((s) => s.companies)));
    const inactiveList = presetCompanies
      .filter((c) => !activeSet.has(c))
      .sort((a, b) => a.localeCompare(b));

    return { activeList, inactiveList };
  }, [allJobs, companyFilter, filterOptionsReady, filtersOpen]);

  // Category/sector list (predefined sectors + active ones from database)
  const categoryOptions = useMemo(() => {
    const activeSet = new Set<string>();
    for (const j of allJobs) {
      if (j.sector?.trim()) {
        activeSet.add(j.sector.trim());
      }
    }

    const activeList = Array.from(activeSet).sort((a, b) => a.localeCompare(b));
    if (!filterOptionsReady && !filtersOpen && categoryFilter === "all") {
      return { activeList, inactiveList: [] };
    }

    const presetSectors = Array.from(new Set(
      Object.values(COMPANY_SECTORS)
        .map((s) => s.label)
        .filter((label) => label !== "From Scrapes")
    ));
    const inactiveList = presetSectors
      .filter((s) => !activeSet.has(s))
      .sort((a, b) => a.localeCompare(b));

    return { activeList, inactiveList };
  }, [allJobs, categoryFilter, filterOptionsReady, filtersOpen]);

  const shouldBuildProfessionOptions =
    filterOptionsReady || filtersOpen || professionFilter !== "all";
  const professionBuckets = useMemo(
    () => (shouldBuildProfessionOptions ? buildProfessionBucketIndex(allJobs) : new Map<string, string>()),
    [allJobs, shouldBuildProfessionOptions],
  );
  const professionOptions = useMemo(
    () =>
      shouldBuildProfessionOptions
        ? buildProfessionOptionsFromBuckets(professionBuckets)
        : { activeList: [], inactiveList: [] },
    [professionBuckets, shouldBuildProfessionOptions],
  );

  const filterArgs = useMemo(
    () => ({
      board,
      search: debouncedSearch,
      companyFilter,
      categoryFilter,
      professionFilter,
      dateFilter,
      sortBy,
      professionBuckets,
    }),
    [board, debouncedSearch, companyFilter, categoryFilter, professionFilter, dateFilter, sortBy, professionBuckets],
  );

  const filteredJobs = useMemo(
    () => applyMarketplaceFilters(allJobs, filterArgs),
    [allJobs, filterArgs],
  );

  // Pagination is handled inside the MarketplaceJobList component now.
  // We keep showing the previous list while a filter transition runs (prevents blink)
  const listingsForDisplay = isFilterPending ? listingsSnapshotRef.current : filteredJobs;
  if (!isFilterPending) {
    listingsSnapshotRef.current = filteredJobs;
  }

  const isFiltered =
    board !== "all" ||
    filter !== "" ||
    companyFilter !== "all" ||
    categoryFilter !== "all" ||
    professionFilter !== "all" ||
    dateFilter !== "all" ||
    sortBy !== "match_score";

  const activeFilterCount = [
    board !== "all",
    filter !== "",
    companyFilter !== "all",
    categoryFilter !== "all",
    professionFilter !== "all",
    dateFilter !== "all",
    sortBy !== "match_score",
  ].filter(Boolean).length;

  const applyFilter = useCallback((fn: () => void) => {
    startFilterTransition(fn);
  }, []);

  const filterState = {
    filter,
    setFilter,
    professionFilter,
    setProfessionFilter: (value: string) => applyFilter(() => setProfessionFilter(value)),
    companyFilter,
    setCompanyFilter: (value: string) => applyFilter(() => setCompanyFilter(value)),
    categoryFilter,
    setCategoryFilter: (value: string) => applyFilter(() => setCategoryFilter(value)),
    dateFilter,
    setDateFilter: (value: string) => applyFilter(() => setDateFilter(value)),
    sortBy,
    setSortBy: (value: string) => applyFilter(() => setSortBy(value)),
  };

  const sheetFilterState = {
    filter: "",
    setFilter: () => { },
    professionFilter: sheetDraft.professionFilter,
    setProfessionFilter: (value: string) =>
      setSheetDraft((prev) => ({ ...prev, professionFilter: value })),
    companyFilter: sheetDraft.companyFilter,
    setCompanyFilter: (value: string) =>
      setSheetDraft((prev) => ({ ...prev, companyFilter: value })),
    categoryFilter: sheetDraft.categoryFilter,
    setCategoryFilter: (value: string) =>
      setSheetDraft((prev) => ({ ...prev, categoryFilter: value })),
    dateFilter: sheetDraft.dateFilter,
    setDateFilter: (value: string) => setSheetDraft((prev) => ({ ...prev, dateFilter: value })),
    sortBy: sheetDraft.sortBy,
    setSortBy: (value: string) => setSheetDraft((prev) => ({ ...prev, sortBy: value })),
  };

  const applySheetFilters = () => {
    startFilterTransition(() => {
      setBoard(sheetDraft.board);
      setProfessionFilter(sheetDraft.professionFilter);
      setCompanyFilter(sheetDraft.companyFilter);
      setCategoryFilter(sheetDraft.categoryFilter);
      setDateFilter(sheetDraft.dateFilter);
      setSortBy(sheetDraft.sortBy);
      setFiltersOpen(false);
    });
  };

  const filterOptions = {
    professionOptions,
    companyOptions,
    categoryOptions,
  };

  const clearFilters = () => {
    startFilterTransition(() => {
      setBoard("all");
      setFilter("");
      setCompanyFilter("all");
      setCategoryFilter("all");
      setProfessionFilter("all");
      setDateFilter("all");
      setSortBy("match_score");
    });
  };

  const isInitialLoading = scrapedLoading && scrapedJobs.length === 0;
  const hasSkills = Boolean(profile?.skills && profile.skills.length > 0);
  const hasNoListings = !isInitialLoading && !scrapedError && allJobs.length === 0;

  return (
    <div ref={containerRef} className="min-h-full flex flex-col bg-muted/30 lg:max-h-full lg:overflow-hidden">
      {/* ── Page header ── */}
      <header
        ref={headerRef}
        className={cn(
          "border-b border-border/60 bg-background sticky top-0 z-20 shrink-0",
          "transition-transform duration-300 ease-in-out",
          headerHidden && "-translate-y-full",
        )}
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4">
          {/* Title + CTA */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 hidden md:block">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Marketplace
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Listings from Kenyan job boards
              </p>
            </div>
            <Link to="/find-jobs" className="shrink-0 w-full sm:w-auto">
              <Button className="w-full sm:w-auto gap-1.5 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/95 hover:to-orange-500/95 text-primary-foreground font-semibold text-xs h-9 px-4 rounded-full shadow-sm border border-orange-400/20">
                <SearchCheck className="w-3.5 h-3.5" />
                Scrape your own
              </Button>
            </Link>
          </div>

          {/* Board filter */}
          <section aria-label="Job boards" className="max-w-md">
            <label
              htmlFor="marketplace-board-select"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block"
            >
              Boards
            </label>
            <MarketplaceBoardSelect
              id="marketplace-board-select"
              value={board}
              counts={boardCounts}
              onValueChange={(id) => startFilterTransition(() => setBoard(id))}
            />
          </section>

          {/* Mobile: search + filters button */}
          <section aria-label="Search and filters" className="lg:hidden space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search jobs…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-8 h-9 bg-background border-border/80 w-full text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFiltersOpen(true)}
                className={cn(
                  "h-9 shrink-0 gap-1.5 px-3 text-xs",
                  activeFilterCount > 0 && "border-primary/40 bg-primary/5 text-primary",
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </section>

          {/* Desktop filters */}
          <section aria-label="Filters" className="hidden lg:block">
            <MarketplaceFilters
              {...filterState}
              {...filterOptions}
              layout="grid"
            />
          </section>
        </div>
      </header>

      {/* Mobile filter sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-2xl px-4 pb-8 overflow-y-auto">
          <SheetHeader className="text-left pb-2">
            <SheetTitle>Filter listings</SheetTitle>
            <SheetDescription>
              Narrow by board, role, company, sector, date, and sort order.
            </SheetDescription>
          </SheetHeader>
          <div className="py-2 space-y-4">
            <div>
              <label
                htmlFor="marketplace-board-select-sheet"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block"
              >
                Job board
              </label>
              <MarketplaceBoardSelect
                id="marketplace-board-select-sheet"
                value={sheetDraft.board}
                counts={boardCounts}
                onValueChange={(id) => setSheetDraft((prev) => ({ ...prev, board: id }))}
              />
            </div>
            <MarketplaceFilters
              {...sheetFilterState}
              {...filterOptions}
              layout="stack"
              showSearch={false}
            />
          </div>
          <div className="flex gap-2 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setSheetDraft(DEFAULT_SHEET_DRAFT)}
            >
              Reset
            </Button>
            <Button type="button" className="flex-1" onClick={applySheetFilters}>
              Apply filters
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Main content ── */}
      <main className="flex-1 min-h-0 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:overflow-hidden lg:flex lg:flex-col">
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-muted-foreground">
            <TellusLoader />
            <span>Loading marketplace…</span>
          </div>
        ) : scrapedError ? (
          <div className="py-16 text-center text-sm text-destructive px-4">
            {(scrapedErr as Error)?.message ?? "Could not load jobs"}
          </div>
        ) : hasNoListings ? (
          <div className="py-16 sm:py-20 text-center max-w-md mx-auto px-4">
            <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">
              No listings yet. Scrapers run daily at 8 AM EAT, or tap &quot;Scrape your own&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            {/* Listings column */}
            <div className="lg:col-span-2 flex flex-col min-h-0 lg:overflow-hidden space-y-3">
              {/* Active filter chips (mobile + desktop) */}
              {isFiltered && (
                <div className="flex flex-wrap items-center gap-2">
                  {board !== "all" && (
                    <FilterChip label={MARKETPLACE_BOARDS.find((b) => b.id === board)?.label ?? board} onRemove={() => setBoard("all")} />
                  )}
                  {filter && <FilterChip label={`"${filter}"`} onRemove={() => setFilter("")} />}
                  {professionFilter !== "all" && (
                    <FilterChip label={professionFilter} onRemove={() => setProfessionFilter("all")} />
                  )}
                  {companyFilter !== "all" && (
                    <FilterChip label={companyFilter} onRemove={() => setCompanyFilter("all")} />
                  )}
                  {categoryFilter !== "all" && (
                    <FilterChip label={categoryFilter} onRemove={() => setCategoryFilter("all")} />
                  )}
                  {dateFilter !== "all" && (
                    <FilterChip
                      label={
                        dateFilter === "24h"
                          ? "Past 24h"
                          : dateFilter === "week"
                            ? "Past week"
                            : "Past month"
                      }
                      onRemove={() => setDateFilter("all")}
                    />
                  )}
                  {sortBy !== "newest" && (
                    <FilterChip label={`Sort: ${sortBy}`} onRemove={() => setSortBy("newest")} />
                  )}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap shrink-0 min-h-[1.75rem]">
                <p className="text-sm text-muted-foreground transition-all duration-300 ease-out">
                  {board !== "all" ? `On ${board}` : "Listings"}
                </p>
                {isFiltered && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="hidden sm:inline-flex h-8 px-2 text-xs text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Clear filters
                  </Button>
                )}
              </div>

              <div
                className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto max-sm:pb-4"
                aria-busy={isFilterPending}
              >
                <MarketplaceJobList jobs={listingsForDisplay} onClearFilters={clearFilters} isAuthenticated={isAuthenticated} />
              </div>
            </div>

            {/* Insights — sidebar on desktop, section below on mobile */}
            <aside className="lg:col-span-1 lg:min-h-0 lg:overflow-y-auto space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:hidden">
                Market insights
              </p>
              <MarketplaceInsightsPanel
                allJobsCount={allJobs.length}
                matchStats={matchStats}
                skillCounts={skillCounts}
                hotSectors={hotSectors}
                hasSkills={hasSkills}
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 max-w-[200px] rounded-full border border-border/80 bg-background pl-2.5 pr-1 py-1 text-[11px] font-medium text-foreground">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
