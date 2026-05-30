import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";
import {
  User,
  Bell,
  Trash2,
  Linkedin,
  Loader2,
  PenSquare,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Users,
  Gift,
  Copy,
  CheckCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, type ReactNode } from "react";
import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  exportMyAccountData,
} from "@/lib/api";
import { resetAuthReady } from "@/lib/auth-session";
import { clearPersistedQueryCache } from "@/lib/query-persist";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    title: "Settings - Tellus",
    meta: [
      { title: "Settings - Tellus" },
      { name: "description", content: "Manage your account settings, credentials, referral codes, billing, and subscription plans." },
    ],
  }),
  component: Settings,
});

const LINKEDIN_TIME_OPTIONS = [
  { value: "r86400", label: "Last 24 hours" },
  { value: "r604800", label: "Last 7 days" },
  { value: "r2592000", label: "Last 30 days" },
];

type SettingsTab = "profile" | "linkedin" | "referral";

const TABS: { id: SettingsTab; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", shortLabel: "Profile", icon: User },
  { id: "linkedin", label: "LinkedIn", shortLabel: "LinkedIn", icon: Linkedin },
  { id: "referral", label: "Referrals & Limits", shortLabel: "Referrals", icon: Users },
];

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}
function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as SettingsTab;
    if (tab && ["profile", "linkedin", "referral"].includes(tab)) {
      return tab;
    }
    return "profile";
  });
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [liAt, setLiAt] = useState("");
  const [timeFilter, setTimeFilter] = useState("r86400");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoApply, setAutoApply] = useState(true);
  const [showCookie, setShowCookie] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const { data: user } = useQuery({
    queryKey: ["settings_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getMyProfile(),
  });
  const profile = profileData?.profile as any;

  const { data: referralsData } = useQuery({
    queryKey: ["referrals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from("referrals")
        .select("id, status, created_at, verified_at, referred_user_id, referrer_user_id")
        .eq("referrer_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[referrals] Query error:", error);
        throw error;
      }
      
      console.log("[referrals] Fetched referrals for user", user.id, ":", data);
      
      if (data && data.length > 0) {
        const referredIds = data.map((r: any) => r.referred_user_id).filter(Boolean);
        console.log("[referrals] Referred user IDs:", referredIds);
        
        if (referredIds.length === 0) {
          console.warn("[referrals] No referred user IDs found");
          return data.map((r: any) => ({ ...r, referred_name: "New Member", referred_email: "" }));
        }
        
        const { data: profiles, error: pErr } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", referredIds);
        
        console.log("[referrals] Profiles fetched:", profiles, "error:", pErr);
        
        if (!pErr && profiles) {
          const mapped = data.map((r: any) => {
            const prof = profiles.find((p: any) => p.id === r.referred_user_id);
            console.log(`[referrals] Mapping referral ${r.id}: profile =`, prof);
            return {
              ...r,
              referred_name: prof?.full_name || prof?.email || "New Member",
              referred_email: prof?.email || ""
            };
          });
          console.log("[referrals] Final mapped data:", mapped);
          return mapped;
        }
      }
      
      const result = (data || []).map((r: any) => ({ ...r, referred_name: "New Member", referred_email: "" }));
      console.log("[referrals] Empty referrals, returning:", result);
      return result;
    },
  });

  // Calculate active referrals from actual data (count completed/verified only)
  const activeReferralCount = referralsData?.filter((r: any) => r.status === "completed").length ?? 0;

  const { data: integration, isLoading: integrationLoading } = useQuery({
    queryKey: ["user_integrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("linkedin_li_at, linkedin_time_filter")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.full_name ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (integration) {
      setLiAt(integration.linkedin_li_at ?? "");
      setTimeFilter(integration.linkedin_time_filter ?? "r86400");
    }
  }, [integration]);

  useEffect(() => {
    const storedEmailNotif = localStorage.getItem("settings_email_notifications");
    if (storedEmailNotif !== null) {
      setEmailNotifications(JSON.parse(storedEmailNotif));
    }
    const storedAutoApply = localStorage.getItem("settings_auto_apply");
    if (storedAutoApply !== null) {
      setAutoApply(JSON.parse(storedAutoApply));
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== activeTab) {
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeTab]);

  const saveAllMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");

      await updateMyProfile({ full_name: displayName });

      const { error } = await supabase.from("user_integrations").upsert({
        user_id: user.id,
        linkedin_li_at: liAt.trim() || null,
        linkedin_time_filter: timeFilter,
      });
      if (error) throw error;

      localStorage.setItem("settings_email_notifications", JSON.stringify(emailNotifications));
      localStorage.setItem("settings_auto_apply", JSON.stringify(autoApply));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user_integrations"] });
      toast.success("Settings saved");
      setIsEditing(false);
    },
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      return await exportMyAccountData();
    },
    onSuccess: (data) => {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `tellus_data_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Data export downloaded successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to export data");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      return await deleteMyAccount();
    },
    onSuccess: async () => {
      toast.success("Your account has been deleted successfully.");
      await supabase.auth.signOut();
      resetAuthReady();
      queryClient.clear();
      clearPersistedQueryCache();
      navigate({ to: "/login" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete account");
    },
  });

  const handleCancel = () => {
    if (profile) {
      setDisplayName(profile.full_name ?? "");
    }
    if (integration) {
      setLiAt(integration.linkedin_li_at ?? "");
      setTimeFilter(integration.linkedin_time_filter ?? "r86400");
    }
    const storedEmailNotif = localStorage.getItem("settings_email_notifications");
    setEmailNotifications(storedEmailNotif ? JSON.parse(storedEmailNotif) : true);
    const storedAutoApply = localStorage.getItem("settings_auto_apply");
    setAutoApply(storedAutoApply ? JSON.parse(storedAutoApply) : true);
    setIsEditing(false);
  };

  const handlePasswordReset = async () => {
    if (user?.email) {
      await supabase.auth.resetPasswordForEmail(user.email);
      toast.success("Password reset email sent");
    }
  };

  if (profileLoading || integrationLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedTimeLabel =
    LINKEDIN_TIME_OPTIONS.find((o) => o.value === timeFilter)?.label ?? timeFilter;

  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/60 sticky top-0 z-10 bg-background">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Settings</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                Account details, LinkedIn scraping, preferences, and security.
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm border-border/60"
                >
                  <PenSquare className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Edit settings
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm border-border/60"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveAllMut.mutate()}
                    disabled={saveAllMut.isPending}
                    className="h-10 sm:h-9 w-full sm:w-auto font-semibold text-xs sm:text-sm shadow-sm"
                  >
                    {saveAllMut.isPending ? (
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

          {/* Tabs — horizontal scroll on mobile */}
          <nav
            className="w-full overflow-x-auto scrollbar-none"
            aria-label="Settings sections"
          >
            <div className="flex gap-1.5 min-w-max pb-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap border transition-colors shrink-0",
                      active
                        ? tab.id === "linkedin"
                          ? "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/30"
                          : "bg-primary/10 text-primary border-primary/30"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 animate-in fade-in duration-300">
        {activeTab === "profile" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Profile details */}
            <section className="space-y-4" aria-labelledby="profile-heading">
              <h2 id="profile-heading" className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Profile details
              </h2>

              {!isEditing ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PreviewRow label="Display name">{displayName || "Not set"}</PreviewRow>
                  <PreviewRow label="Email">
                    <span className="flex flex-wrap items-center gap-2">
                      {user?.email || "Not set"}
                      <Badge variant="outline" className="text-[10px] font-normal">
                        Primary
                      </Badge>
                    </span>
                  </PreviewRow>
                </dl>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                      Display name
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="How should we call you?"
                      className="h-10 sm:h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      disabled
                      value={user?.email ?? ""}
                      className="h-10 sm:h-9 bg-muted/40 text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-[11px] text-muted-foreground">Managed by your login provider.</p>
                  </div>
                </div>
              )}
            </section>

            <div className="border-t border-border/60" />

            {/* Account Preferences */}
            <section className="space-y-4" aria-labelledby="preferences-heading">
              <h2 id="preferences-heading" className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Account preferences
              </h2>

              {!isEditing ? (
                <div className="divide-y divide-border/60">
                  <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Email notifications</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Daily summaries of matching jobs.</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {emailNotifications ? "On" : "Off"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Automatic application mode</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Auto-draft cover letters and matches.</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {autoApply ? "On" : "Off"}
                    </Badge>
                  </div>
                  <div className="py-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasswordReset}
                      className="h-10 sm:h-9 w-full sm:w-auto border-border/60"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Send password reset email
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 divide-y divide-border/60">
                  <div className="flex items-center justify-between gap-4 pb-5">
                    <div className="min-w-0 pr-2">
                      <Label htmlFor="email-notif" className="text-sm font-medium cursor-pointer">
                        Email notifications
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Daily summaries of matching jobs.</p>
                    </div>
                    <Switch
                      id="email-notif"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-5">
                    <div className="min-w-0 pr-2">
                      <Label htmlFor="auto-app" className="text-sm font-medium cursor-pointer">
                        Automatic application mode
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Auto-draft cover letters and matches.</p>
                    </div>
                    <Switch id="auto-app" checked={autoApply} onCheckedChange={setAutoApply} />
                  </div>
                  <div className="pt-5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasswordReset}
                      className="h-10 sm:h-9 w-full sm:w-auto border-border/60"
                    >
                      <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                      Send password reset email
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <div className="border-t border-border/60" />

            {/* Privacy & Data Portability */}
            <section className="space-y-4 pt-2" aria-labelledby="privacy-heading">
              <h2 id="privacy-heading" className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Privacy & Data Portability
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Under GDPR guidelines, you have the right to access and export your data. Generate and download a full export of your profile, job applications, template preferences, and sent emails.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-10 sm:h-9 w-full sm:w-auto font-semibold border-border/60"
                onClick={() => exportMut.mutate()}
                disabled={exportMut.isPending}
              >
                {exportMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Export my data (JSON)
              </Button>
            </section>

            <div className="border-t border-border/60" />

            {/* Danger Zone */}
            <section className="space-y-4 pt-2" aria-labelledby="danger-heading">
              <h2 id="danger-heading" className="text-sm sm:text-base font-semibold text-destructive flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Danger zone
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Permanently delete your account and all data — applications, saved jobs, and templates. This cannot
                be undone.
              </p>
              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-10 sm:h-9 w-full sm:w-auto font-semibold"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete account
                </Button>
              ) : (
                <div className="space-y-3.5 p-4 border border-destructive/20 rounded-xl bg-destructive/5 max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs font-semibold text-destructive">
                    Warning: This action is irreversible. All your resume files, job matches, and settings will be permanently wiped.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="delete-confirm-input" className="text-xs text-muted-foreground">
                      To confirm, type <span className="font-bold text-destructive select-none">DELETE</span> below:
                    </Label>
                    <Input
                      id="delete-confirm-input"
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="h-10 sm:h-9 border-destructive/30 focus-visible:ring-destructive"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText("");
                      }}
                      className="h-9 font-semibold text-xs border-border/60"
                      disabled={deleteMut.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteConfirmationText !== "DELETE" || deleteMut.isPending}
                      onClick={() => deleteMut.mutate()}
                      className="h-9 font-semibold text-xs"
                    >
                      {deleteMut.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Permanently Delete Account
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "linkedin" && (
          <section className="space-y-4" aria-labelledby="linkedin-heading">
            <div>
              <h2 id="linkedin-heading" className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                LinkedIn job scraping
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Required when LinkedIn is enabled in Configuration. Uses your roles and counties to search{" "}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono">linkedin.com/jobs/search</code>.
              </p>
            </div>

            {!isEditing ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PreviewRow label="Session cookie (li_at)">
                  {liAt ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">••••••••••••</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700">
                        Configured
                      </Badge>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground font-normal italic">Not configured</span>
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-700">
                        Missing
                      </Badge>
                    </span>
                  )}
                </PreviewRow>
                <PreviewRow label="Posted within">{selectedTimeLabel}</PreviewRow>
              </dl>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="li_at" className="text-xs text-muted-foreground">
                    Session cookie (li_at)
                  </Label>
                  <div className="relative">
                    <Input
                      id="li_at"
                      type={showCookie ? "text" : "password"}
                      placeholder="Paste your li_at cookie value"
                      value={liAt}
                      onChange={(e) => setLiAt(e.target.value)}
                      autoComplete="off"
                      className="h-10 sm:h-9 pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCookie(!showCookie)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showCookie ? "Hide cookie" : "Show cookie"}
                    >
                      {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Chrome: DevTools → Application → Cookies → linkedin.com → copy{" "}
                    <strong>li_at</strong>. Stored privately on your account.
                  </p>
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <Label className="text-xs text-muted-foreground">Posted within</Label>
                  <Select value={timeFilter} onValueChange={setTimeFilter}>
                    <SelectTrigger className="h-10 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LINKEDIN_TIME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "referral" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Plan Info and Upgrade Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
                    <p className="text-xs text-muted-foreground">Your usage tier</p>
                  </div>
                  <Badge className={cn(
                    "text-xs px-2.5 py-1 uppercase font-bold",
                    profile?.current_plan === "upgraded"
                      ? "bg-sky-600 text-white"
                      : "bg-muted-foreground/30 text-muted-foreground"
                  )}>
                    {profile?.current_plan === "upgraded" ? "Upgraded Plan" : "Free Plan"}
                  </Badge>
                </div>
                
                {profile?.current_plan === "upgraded" && profile?.upgrade_expires_at && (
                  <div className="text-xs bg-sky-500/10 text-sky-700 dark:text-sky-400 p-2.5 rounded-lg border border-sky-500/15">
                    Your upgraded limits are active and will expire on{" "}
                    <strong>{new Date(profile.upgrade_expires_at).toLocaleDateString()}</strong>.
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features & Limits</div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground">CV Uploads</span>
                      <p className="font-bold text-foreground">
                        {profile?.current_plan === "upgraded" ? "4 per month" : "2 per month"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted-foreground">Application Packs</span>
                      <p className="font-bold text-foreground">
                        {profile?.current_plan === "upgraded" ? "4 per day" : "2 per day"}
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    * Packs are limited to 10 generations per week with a 10-minute cooldown constraint.
                  </div>
                </div>
              </div>

              {/* Progress Panel */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Upgrade Progress</h3>
                  <p className="text-xs text-muted-foreground">Successfully refer 10 friends to unlock Upgraded limits</p>
                </div>

                <div className="space-y-2 py-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Active Referrals</span>
                    <span className="font-bold text-foreground">{activeReferralCount} / 10</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min((activeReferralCount / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed">
                  {activeReferralCount >= 10 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Limits successfully upgraded!
                    </span>
                  ) : (
                    <span>
                      Need <strong>{10 - activeReferralCount}</strong> more successful referral(s) to unlock next 30-day upgrade cycle.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border/60" />

            {/* Link Sharing Widget */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-primary" />
                  Your Referral Link
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Share this link with your network. Referrals count instantly when they sign up and verify their account.</p>
              </div>

              {profile?.referral_code ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 bg-slate-50 dark:bg-muted/10 border border-[#E2E8F0] dark:border-border/10 px-3 py-2 rounded-lg font-mono text-xs select-all overflow-x-auto whitespace-nowrap scrollbar-none text-muted-foreground flex items-center">
                    {window.location.origin}/login?ref={profile.referral_code}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/login?ref=${profile.referral_code}`
                      );
                      toast.success("Referral link copied!");
                    }}
                    className="h-9 w-full sm:w-auto font-semibold shadow-sm gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Link
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-1 animate-pulse">
                  Setting up referral code...
                </div>
              )}
            </div>

            <div className="border-t border-border/60" />

            {/* Referrals Stats Table */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Your Referrals</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Track friends you've invited to the platform</p>
              </div>

              {!referralsData || referralsData.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border/40 rounded-xl space-y-1">
                  <p className="text-sm font-medium text-foreground">No referrals yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">Share your link above with friends and colleagues to get started!</p>
                </div>
              ) : (
                <div className="border border-border/60 rounded-xl overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60 text-muted-foreground font-semibold">
                        <th className="p-3">User</th>
                        <th className="p-3">Date Invited</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {referralsData.map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/20 text-foreground/90">
                          <td className="p-3 font-medium">
                            <div>{r.referred_name}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                          <td className="p-3">
                            <Badge className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-none border",
                              r.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                : r.status === "pending"
                                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}


      </main>
    </div>
  );
}
