import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  Briefcase,
  FileText,
  User,
  LogOut,
  ScrollText,
  Settings,
  Globe,
  Store,
  MessageSquare,
  ChevronDown,
  LucideIcon,
  ChevronsLeft,
  ChevronRight,
  ArrowRight,
  CalendarDays,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resetAuthReady } from "@/lib/auth-session";
import { clearPersistedQueryCache } from "@/lib/query-persist";
import { cn } from "@/lib/utils";
import { getMyProfile, getMarketplaceJob, getJob } from "@/lib/api";
import { toast } from "sonner";

// UI Imports
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileCompletenessCard } from "@/components/sidebar/profile-completeness-card";
import { NotificationBell } from "@/components/notification-bell";
import welcomeImage from "@/assets/auth-hero-signin-2.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POST_LOGIN_WELCOME_KEY = "tellus_show_welcome_after_login";

function formatDisplayNamePart(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized) return "there";
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

const navLinkClass = (active: boolean, expanded: boolean) =>
  cn(
    "relative flex items-center rounded-xl text-sm transition-colors duration-150 select-none",
    !expanded ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
    active
      ? "bg-[#FD5D28]/10 text-[#FD5D28] font-bold"
      : "hover:bg-slate-100/60 dark:hover:bg-muted/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
  );

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

type ProfileSummary = {
  certifications?: string | null;
  desired_roles?: string[] | null;
  education?: string | null;
  email?: string | null;
  full_name?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  preferred_county?: string | null;
  professional_summary?: string | null;
  skills?: string[] | null;
  work_history?: string | null;
};

const navGroups: NavGroup[] = [
  {
    label: "MAIN",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { to: "/find-jobs", label: "My Jobs", icon: Briefcase },
      { to: "/applications", label: "Applications", icon: FileText },
    ],
  },
  {
    label: "DISCOVERY",
    items: [
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/monitors", label: "Monitored Sites", icon: Globe },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { to: "/templates", label: "Templates", icon: ScrollText },
      { to: "/profile", label: "My CV", icon: User },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/configuration", label: "Configuration", icon: Settings },
      { to: "/feedback", label: "Feedback", icon: MessageSquare },
    ],
  },
];

function getMobilePageTitle(pathname: string): string {
  if (/^\/jobs\/[^/]+/.test(pathname)) return "Job details";
  if (/^\/marketplace\/[^/]+/.test(pathname)) return "Job listing";
  for (const group of navGroups) {
    for (const item of group.items) {
      if (pathname === item.to || (item.to !== "/" && pathname.startsWith(`${item.to}/`))) {
        return item.label;
      }
    }
  }
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  return "Tellus";
}

export function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Manual collapse state
  const [isManualCollapsed, setIsManualCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobileMenuOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("toggle-mobile-sidebar", handler);
  }, []);

  // Profile details
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
  });

  // Auth user to retrieve avatar url from metadata
  const { data: authUser, isLoading: isAuthUserLoading } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const profileObj = profile?.profile as ProfileSummary | undefined;
  const isPremium = profileObj
    ? (profileObj as any).current_plan === "upgraded" || ((profileObj as any).active_referrals ?? 0) >= 10
    : false;

  // Calculate dynamic profile completeness/strength score (completely accurate & non-generic)
  let profileScore = 0;
  if (profileObj) {
    let score = 0;

    // 1. Full Name (10%)
    if (profileObj.full_name && profileObj.full_name.trim().length > 0) score += 10;

    // 2. Email (10%)
    if (profileObj.email && profileObj.email.trim().length > 0) score += 10;

    // 3. Phone (10%)
    if (profileObj.phone && profileObj.phone.trim().length > 0) score += 10;

    // 4. Preferred County (10%)
    if (profileObj.preferred_county && profileObj.preferred_county.trim().length > 0) score += 10;

    // 5. LinkedIn URL (10%)
    if (profileObj.linkedin_url && profileObj.linkedin_url.trim().length > 0) score += 10;

    // 6. Skills (15% max - 3% per skill up to 5)
    if (Array.isArray(profileObj.skills)) {
      const validSkills = profileObj.skills.filter((s: string) => s && s.trim().length > 0);
      score += Math.min(validSkills.length * 3, 15);
    }

    // 7. Desired Roles (10% max - 5% per role up to 2)
    if (Array.isArray(profileObj.desired_roles)) {
      const validRoles = profileObj.desired_roles.filter((r: string) => r && r.trim().length > 0);
      score += Math.min(validRoles.length * 5, 10);
    }

    // 8. Professional Summary (10% max - 5% if present, 10% if > 50 characters)
    if (profileObj.professional_summary && profileObj.professional_summary.trim().length > 0) {
      if (profileObj.professional_summary.trim().length > 50) {
        score += 10;
      } else {
        score += 5;
      }
    }

    // 9. Work History (5% max - 2.5% per entry/line up to 2)
    if (profileObj.work_history && profileObj.work_history.trim().length > 0) {
      const entries = profileObj.work_history
        .split("\n")
        .filter((line: string) => line.trim().length > 0);
      score += Math.min(entries.length * 2.5, 5);
    }

    // 10. Education (5% max - 2.5% per entry/line up to 2)
    if (profileObj.education && profileObj.education.trim().length > 0) {
      const entries = profileObj.education
        .split("\n")
        .filter((line: string) => line.trim().length > 0);
      score += Math.min(entries.length * 2.5, 5);
    }

    // 11. Certifications (5%)
    if (profileObj.certifications && profileObj.certifications.trim().length > 0) {
      score += 5;
    }

    profileScore = Math.min(score, 100);
  } else {
    // Default fallback while loading
    profileScore = 30;
  }

  // Identify missing profile fields to show what needs improvement
  const missingItems: string[] = [];
  if (profileObj) {
    if (!profileObj.full_name || profileObj.full_name.trim().length === 0)
      missingItems.push("Name");
    if (!profileObj.email || profileObj.email.trim().length === 0) missingItems.push("Email");
    if (!profileObj.phone || profileObj.phone.trim().length === 0) missingItems.push("Phone");
    if (!profileObj.preferred_county || profileObj.preferred_county.trim().length === 0)
      missingItems.push("Location");
    if (!profileObj.linkedin_url || profileObj.linkedin_url.trim().length === 0)
      missingItems.push("LinkedIn");
    if (
      !Array.isArray(profileObj.skills) ||
      profileObj.skills.filter((s: string) => s && s.trim().length > 0).length === 0
    )
      missingItems.push("Skills");
    if (
      !Array.isArray(profileObj.desired_roles) ||
      profileObj.desired_roles.filter((r: string) => r && r.trim().length > 0).length === 0
    )
      missingItems.push("Roles");
    if (!profileObj.professional_summary || profileObj.professional_summary.trim().length === 0)
      missingItems.push("Summary");
    if (!profileObj.work_history || profileObj.work_history.trim().length === 0)
      missingItems.push("Experience");
    if (!profileObj.education || profileObj.education.trim().length === 0)
      missingItems.push("Education");
    if (!profileObj.certifications || profileObj.certifications.trim().length === 0)
      missingItems.push("Certs");
  }

  const authMetadata = authUser?.user_metadata as
    | { full_name?: string; name?: string; avatar_url?: string; picture?: string }
    | undefined;
  const rawProfileName = profileObj?.full_name?.trim();
  const profileName =
    rawProfileName && rawProfileName.toLocaleLowerCase() !== "jane doe" ? rawProfileName : "";
  const authName = authMetadata?.full_name?.trim() || authMetadata?.name?.trim();
  const emailAddress = profileObj?.email || authUser?.email || "";
  const emailName = emailAddress
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .trim();
  const name = profileName || authName || emailName || "";
  const firstName = formatDisplayNamePart(name.split(" ")[0] || "");
  const email = emailAddress || "Signed in";
  const avatarUrl = authMetadata?.avatar_url || authMetadata?.picture || "";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const profileStatus =
    profileObj && missingItems.length > 0
      ? `${missingItems.length} signal${missingItems.length === 1 ? "" : "s"} to strengthen`
      : profileObj
        ? "Application-ready profile"
        : "Profile syncing";
  const topProfileGap = missingItems[0] ? `Next: add ${missingItems[0]}` : "Ready for matching";
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  useEffect(() => {
    if (loc.pathname.startsWith("/onboarding")) return;
    if (isProfileLoading || isAuthUserLoading) return;
    if (sessionStorage.getItem(POST_LOGIN_WELCOME_KEY) !== "true") return;

    sessionStorage.removeItem(POST_LOGIN_WELCOME_KEY);
    setWelcomeOpen(true);
  }, [isAuthUserLoading, isProfileLoading, loc.pathname]);

  const matchMarketplace = loc.pathname.match(/^\/marketplace\/([^/]+)/);
  const marketplaceJobId = matchMarketplace ? matchMarketplace[1] : null;
  const isScrapedMarketplaceJobId = Boolean(
    marketplaceJobId && !marketplaceJobId.startsWith("user_"),
  );
  const matchJobs = loc.pathname.match(/^\/jobs\/([^/]+)/);
  const jobId = matchJobs ? matchJobs[1] : null;

  // React Query observers to track if the detail page is loading
  const { data: marketplaceJobData } = useQuery({
    queryKey: ["marketplace-job", marketplaceJobId],
    queryFn: () => getMarketplaceJob(marketplaceJobId!),
    enabled: isScrapedMarketplaceJobId,
    staleTime: 60_000,
  });

  const { data: jobData } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob({ id: jobId! }),
    enabled: !!jobId,
    staleTime: 60_000,
  });

  const isMarketplaceJobLoading = isScrapedMarketplaceJobId && !marketplaceJobData;
  const isJobLoading = !!jobId && !jobData;

  const routeCollapsed =
    (/^\/jobs\/[^/]+/.test(loc.pathname) && !isJobLoading) ||
    (/^\/marketplace\/[^/]+/.test(loc.pathname) && !isMarketplaceJobLoading);

  const collapsed = isManualCollapsed || routeCollapsed;
  const jobDetailPage =
    /^\/jobs\/[^/]+/.test(loc.pathname) || /^\/marketplace\/[^/]+/.test(loc.pathname);

  const isExpanded = !collapsed || isHovered;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <Dialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <DialogContent className="max-h-[88dvh] w-[calc(100vw-2rem)] gap-0 overflow-hidden overflow-y-auto border-0 bg-white p-0 shadow-2xl shadow-slate-950/35 sm:max-h-[calc(100dvh-2rem)] sm:max-w-[600px] sm:rounded-2xl dark:bg-[#0B0F19] [&>button]:right-3 [&>button]:top-3 [&>button]:z-20 [&>button]:flex [&>button]:h-7 [&>button]:w-7 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:text-slate-950 [&>button]:opacity-100 [&>button]:shadow-lg [&>button]:ring-0 [&>button]:ring-offset-0 [&>button]:backdrop-blur-md sm:[&>button]:h-8 sm:[&>button]:w-8 [&>button_svg]:h-4 [&>button_svg]:w-4">
          <div className="overflow-hidden bg-white dark:bg-[#0B0F19]">
            <div className="relative min-h-[165px] overflow-hidden bg-[#111827] sm:min-h-[225px]">
              <img
                src={welcomeImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-slate-950/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />

              <DialogHeader className="absolute inset-x-0 bottom-0 top-0 flex justify-center space-y-0 px-4 py-4 text-left sm:px-8 sm:py-5">
                <div className="max-w-[320px]">
                  <div className="mb-3 flex items-center gap-1.5 text-white/90 sm:mb-4 sm:gap-2">
                    <span className="flex h-3.5 items-end gap-0.5 text-[#FD5D28] sm:h-4" aria-hidden="true">
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      <span className="h-3 w-1.5 rounded-full bg-current" />
                      <span className="h-4 w-1.5 rounded-full bg-current" />
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] sm:text-[10px] sm:tracking-[0.22em]">
                      Tellus Workspace
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-black leading-[1.08] tracking-tight text-white sm:text-3xl">
                    Welcome back,
                    <span className="block">{firstName} 👋</span>
                  </DialogTitle>
                  <DialogDescription className="mt-2 max-w-[18rem] text-[11px] font-semibold leading-4 text-white sm:mt-3 sm:max-w-[24rem] sm:text-sm sm:leading-5">
                    Your job intelligence workspace is ready. We have lined up what matters most
                    for you today.
                  </DialogDescription>
                </div>
              </DialogHeader>
            </div>

            <div className="space-y-2.5 px-4 py-3.5 sm:space-y-3 sm:px-7 sm:py-5">
              <section className="grid gap-2.5 border-b border-slate-200 pb-3 sm:grid-cols-[135px_1fr_auto] sm:items-center sm:gap-4 dark:border-white/10">
                <div className="sm:border-r sm:border-orange-200 sm:pr-4 dark:sm:border-orange-500/25">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#FD5D28] sm:text-[9px] sm:tracking-[0.2em]">
                    Profile readiness
                  </p>
                  <p className="mt-1.5 text-xl font-black leading-none tracking-tight text-slate-950 sm:mt-2 sm:text-2xl dark:text-white">
                    {profileObj ? `${profileScore}%` : "Sync"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-800 dark:text-white sm:text-sm">
                    {profileStatus}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-3 dark:bg-white/15">
                    <div
                      className="h-full rounded-full bg-[#FD5D28]"
                      style={{ width: `${profileObj ? profileScore : 35}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] font-bold text-slate-500 sm:mt-2 sm:text-xs dark:text-slate-300">
                    Next: <span className="text-slate-800 dark:text-white">{topProfileGap.replace(/^Next: /, "")}</span>
                  </p>
                </div>

                <button
                  onClick={() => navigate({ to: "/profile" })}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF0EA] text-[#FD5D28] transition hover:bg-[#FFE1D3] sm:h-12 sm:w-12"
                  aria-label="Open profile"
                >
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </section>

              <section className="divide-y divide-slate-200 overflow-hidden border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
                <button
                  onClick={() => {
                    setWelcomeOpen(false);
                    navigate({ to: "/marketplace" });
                  }}
                  className="grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-2.5 py-2.5 text-left transition hover:bg-slate-50 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-4 sm:py-3 dark:hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF0EA] text-[#FD5D28] sm:h-12 sm:w-12 sm:rounded-xl">
                    <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-[#FD5D28] sm:text-[9px] sm:tracking-[0.2em]">
                      Job radar
                    </span>
                    <span className="mt-0.5 block text-xs font-black text-slate-950 dark:text-white sm:mt-1 sm:text-base">
                      Marketplace active
                    </span>
                    <span className="block text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-300 sm:mt-0.5 sm:text-sm sm:leading-normal">
                      Fresh roles are ready to scan against your profile.
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500 sm:h-5 sm:w-5" />
                </button>

                <button
                  onClick={() => navigate({ to: "/applications" })}
                  className="grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-2.5 py-2.5 text-left transition hover:bg-slate-50 sm:grid-cols-[3.5rem_1fr_auto] sm:gap-4 sm:py-3 dark:hover:bg-white/5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 sm:h-12 sm:w-12 sm:rounded-xl">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-emerald-600 sm:text-[9px] sm:tracking-[0.2em]">
                      Application desk
                    </span>
                    <span className="mt-0.5 block text-xs font-black text-slate-950 dark:text-white sm:mt-1 sm:text-base">
                      Packs on standby
                    </span>
                    <span className="block text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-300 sm:mt-0.5 sm:text-sm sm:leading-normal">
                      Cover letters and email drafts are one job away.
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-500 sm:h-5 sm:w-5" />
                </button>
              </section>

              <div className="space-y-2.5 sm:space-y-3">
                <Button
                  onClick={() => {
                    setWelcomeOpen(false);
                    navigate({ to: "/marketplace" });
                  }}
                  className="h-9 w-full rounded-lg bg-[#FD5D28] text-xs font-extrabold shadow-lg shadow-orange-500/20 hover:bg-[#E94F1F] sm:h-11 sm:text-sm"
                >
                  Continue to marketplace
                  <ArrowRight className="ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>

                <div className="flex items-center justify-center gap-2.5 text-[11px] font-semibold text-slate-400 sm:gap-3 sm:text-xs">
                  <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Pack ready</span>
                  <span className="h-4 w-px bg-slate-300 sm:h-5 dark:bg-white/15" />
                  <span className="font-bold text-pink-600">{todayLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outer wrapper to reserve sidebar space in document flow */}
      <div
        className={cn(
          "flex-shrink-0 transition-[width] duration-200 relative h-full hidden md:block",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <aside
          onMouseEnter={() => collapsed && setIsHovered(true)}
          onMouseLeave={() => collapsed && setIsHovered(false)}
          className={cn(
            "bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200 flex flex-col h-full min-h-0 border-r border-slate-200/50 dark:border-border/10 transition-[width] duration-200 ease-out",
            collapsed ? "absolute left-0 top-0 z-50" : "relative",
            isExpanded ? "w-64" : "w-[4.5rem]",
            collapsed && isHovered && "shadow-xl",
          )}
        >
          {/* Header section (Brand & Logo) */}
          <div
            className={cn(
              "shrink-0 transition-[padding] duration-200",
              !isExpanded ? "p-4 flex justify-center" : "p-6 pb-2",
            )}
          >
            {!isExpanded ? (
              <div className="flex flex-col items-center gap-3.5">
                <NotificationBell collapsed />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div>
                    <span className="text-base font-extrabold leading-none tracking-tight text-[#1E293B] dark:text-white">
                      Tellus
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                      Premium Job Intelligence
                    </p>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <NotificationBell />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsManualCollapsed(!isManualCollapsed);
                    }}
                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-muted/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title={isManualCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    {isManualCollapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronsLeft className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation — only this region scrolls */}
          <nav
            className="sidebar-scroll flex-1 min-h-0 px-3.5 py-3 space-y-5"
            aria-label="Main navigation"
          >
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1.5">
                {isExpanded && (
                  <h3 className="text-[10px] font-black text-slate-400/90 dark:text-slate-500/90 tracking-wider px-3 select-none uppercase">
                    {group.label}
                  </h3>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = loc.pathname.startsWith(item.to);
                    const Icon = item.icon;
                    const isLocked = (item.to === "/monitors" || item.to === "/configuration") && !isPremium;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        title={!isExpanded ? item.label : undefined}
                        className={navLinkClass(active, isExpanded)}
                      >
                        {active && isExpanded && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FD5D28] rounded-r-md" />
                        )}
                        <Icon
                          className={cn(
                            "w-4.5 h-4.5 shrink-0",
                            active ? "text-[#FD5D28]" : "text-slate-500 dark:text-slate-400",
                          )}
                        />
                        {isExpanded && (
                          <span className="truncate flex-1 flex items-center justify-between">
                            <span>{item.label}</span>
                            {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground/60 ml-2" />}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {isExpanded && (
            <ProfileCompletenessCard profileScore={profileScore} missingItems={missingItems} />
          )}

          {/* Profile Section (Bottom) */}
          <div
            className={cn(
              "border-t border-slate-200/50 dark:border-border/10 shrink-0",
              !isExpanded ? "p-2" : "p-4",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center rounded-xl hover:bg-slate-100/60 dark:hover:bg-muted/10 w-full text-left cursor-pointer focus:outline-none transition-colors duration-150",
                    !isExpanded ? "justify-center p-1.5" : "gap-3 p-2",
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9.5 w-9.5 border border-slate-200/40 dark:border-border/10 shadow-sm">
                      <AvatarImage src={avatarUrl} alt={name} />
                      <AvatarFallback className="bg-[#FFE5D8] text-[#FD5D28] font-extrabold text-sm">
                        {initials || "AO"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-white dark:border-background rounded-full" />
                  </div>
                  {isExpanded && (
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 dark:text-white truncate text-sm leading-tight">
                          {name}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5 leading-none">
                          {email || "alvine@gmail.com"}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1.5" />
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align={isExpanded ? "end" : "center"}
                side="right"
                className="w-56 z-50"
              >
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  My Account
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 w-full cursor-pointer">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center gap-2"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    resetAuthReady();
                    queryClient.clear();
                    clearPersistedQueryCache();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </div>

      {/* Mobile Sidebar/Drawer (rendered outside header so it can open even if header is hidden) */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-50 bg-black/80"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#F8FAFC] dark:bg-[#0B0F19] border-r border-slate-200/50 dark:border-border/10 flex flex-col h-full min-h-0">
            {/* Close button */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-muted/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header section (Brand & Logo) */}
            <div className="shrink-0 p-6 pb-2">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-base font-extrabold leading-none tracking-tight text-[#1E293B] dark:text-white">
                    Tellus
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">
                    Premium Job Intelligence
                  </p>
                </div>
              </div>
            </div>

            <nav
              className="sidebar-scroll flex-1 min-h-0 px-3.5 py-3 space-y-5"
              aria-label="Main navigation"
            >
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1.5">
                  <h3 className="text-[10px] font-black text-slate-400/90 dark:text-slate-500/90 tracking-wider px-3 select-none uppercase">
                    {group.label}
                  </h3>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = loc.pathname.startsWith(item.to);
                      const Icon = item.icon;
                      const isLocked = (item.to === "/monitors" || item.to === "/configuration") && !isPremium;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={navLinkClass(active, true)}
                        >
                          {active && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#FD5D28] rounded-r-md" />
                          )}
                          <Icon
                            className={cn(
                              "w-4.5 h-4.5 shrink-0",
                              active ? "text-[#FD5D28]" : "text-slate-500 dark:text-slate-400",
                            )}
                          />
                          <span className="truncate flex-1 flex items-center justify-between">
                            <span>{item.label}</span>
                            {isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground/60 ml-2" />}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <ProfileCompletenessCard
              profileScore={profileScore}
              missingItems={missingItems}
              onProfileLinkClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Profile Section (Bottom) */}
            <div className="border-t border-slate-200/50 dark:border-border/10 shrink-0 p-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center rounded-xl hover:bg-slate-100/60 dark:hover:bg-muted/10 w-full text-left cursor-pointer focus:outline-none transition-colors duration-150 gap-3 p-2">
                    <div className="relative shrink-0">
                      <Avatar className="h-9.5 w-9.5 border border-slate-200/40 dark:border-border/10 shadow-sm">
                        <AvatarImage src={avatarUrl} alt={name} />
                        <AvatarFallback className="bg-[#FFE5D8] text-[#FD5D28] font-extrabold text-sm">
                          {initials || "AO"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-white dark:border-background rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-800 dark:text-white truncate text-sm leading-tight">
                          {name}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5 leading-none">
                          {email || "alvine@gmail.com"}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 ml-1.5" />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 z-50">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    My Account
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/settings"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 w-full cursor-pointer"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center gap-2"
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await supabase.auth.signOut();
                      resetAuthReady();
                      queryClient.clear();
                      clearPersistedQueryCache();
                      navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header (Sticky at top of viewport, only below md) */}
      {!jobDetailPage && (
        <div className="flex md:hidden items-center justify-between gap-2 border-b border-slate-200/50 dark:border-border/10 px-4 py-3 bg-[#F8FAFC] dark:bg-[#0B0F19] sticky top-0 z-40 w-full shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer focus-visible:ring-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm font-bold truncate text-slate-800 dark:text-white min-w-0">
              {getMobilePageTitle(loc.pathname)}
            </h1>
          </div>

          {/* Mobile Actions (Bell + Dropdown Avatar) */}
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative focus:outline-none cursor-pointer">
                  <Avatar className="h-8 w-8 border border-slate-200/40 dark:border-border/10 shadow-sm">
                    <AvatarImage src={avatarUrl} alt={name} />
                    <AvatarFallback className="bg-[#FFE5D8] text-[#FD5D28] font-extrabold text-xs">
                      {initials || "AO"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] border-2 border-white dark:border-background rounded-full" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 z-50">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  My Account
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 w-full cursor-pointer">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center gap-2"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    resetAuthReady();
                    queryClient.clear();
                    clearPersistedQueryCache();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <main
        className={cn(
          "flex-1 min-w-0 min-h-0",
          jobDetailPage ? "flex flex-col overflow-hidden" : "overflow-y-auto",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
