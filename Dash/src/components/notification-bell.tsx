import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  Send,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

export function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // 1. Fetch User Session to get User ID
  const { data: authUser } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const userId = authUser?.id;

  // 2. Fetch Notifications
  const { data: notifications = [], isLoading } = useQuery<NotificationRow[]>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as NotificationRow[]) ?? [];
    },
    enabled: !!userId,
    refetchInterval: 15000, // Poll every 15s to fetch auto-apply status updates
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 3. Mark All as Read Mutation
  const markAllReadMut = useMutation({
    mutationFn: async (userIdParam: string) => {
      console.log("[notifications] Marking all as read for user:", userIdParam);
      const { error, data } = await (supabase as any)
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userIdParam)
        .eq("read", false);
      
      if (error) {
        console.error("[notifications] Update error:", error);
        throw error;
      }
      console.log("[notifications] Updated rows:", data);
    },
    onSuccess: () => {
      console.log("[notifications] Mark all read success, invalidating query");
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      toast.success("All notifications marked as read");
    },
    onError: (e: Error) => {
      console.error("[notifications] Mark all read failed:", e.message);
      toast.error(e.message);
    },
  });

  // 4. Mark Single as Read Mutation
  const markReadMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  // 5. Delete Notification Mutation
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleNotificationClick = (notification: NotificationRow) => {
    if (!notification.read) {
      markReadMut.mutate(notification.id);
    }

    // Navigation triggers
    if (notification.type.startsWith("application")) {
      navigate({ to: "/applications" });
    } else if (notification.type.startsWith("referral")) {
      navigate({ to: "/settings", search: { tab: "referral" } as any });
    }
    setOpen(false);
  };

  // Icon Resolver
  const getIcon = (type: string) => {
    switch (type) {
      case "application_sent":
        return {
          icon: Send,
          bgClass: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
        };
      case "application_failed":
        return {
          icon: AlertTriangle,
          bgClass: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
        };
      case "referral_signup":
        return {
          icon: UserPlus,
          bgClass: "bg-violet-500/10 text-violet-500 border border-violet-500/20",
        };
      default:
        return {
          icon: Bell,
          bgClass: "bg-slate-500/10 text-slate-500 border border-slate-500/20",
        };
    }
  };

  const bellTrigger = (
    <button
      className={cn(
        "relative rounded-xl hover:bg-slate-200/50 dark:hover:bg-muted/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer focus:outline-none flex items-center justify-center",
        collapsed ? "w-10 h-10" : "p-2",
      )}
      title="Notifications"
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-extrabold text-white ring-2 ring-background animate-pulse">
          {unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{bellTrigger}</PopoverTrigger>
      <PopoverContent
        align={collapsed ? "center" : "end"}
        side={collapsed ? "right" : "bottom"}
        sideOffset={collapsed ? 16 : 8}
        className="w-[22rem] sm:w-[26rem] p-0 z-50 overflow-hidden border border-slate-200/50 dark:border-border/10 shadow-2xl rounded-2xl bg-popover/95 backdrop-blur-md animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] dark:bg-[#0B0F19] border-b border-slate-200/50 dark:border-border/10">
          <div>
            <h4 className="font-bold text-sm text-foreground">Notifications</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg"
              onClick={(e) => {
                e.preventDefault();
                console.log("[notifications] Mark all button clicked, userId:", userId);
                if (userId) {
                  markAllReadMut.mutate(userId);
                } else {
                  console.warn("[notifications] No userId available");
                }
              }}
              disabled={markAllReadMut.isPending || !userId}
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List Content */}
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-muted/20 flex items-center justify-center mb-3 text-muted-foreground">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h5 className="font-bold text-sm text-foreground">All caught up!</h5>
              <p className="text-xs text-muted-foreground mt-1 max-w-[18rem]">
                You have no notifications. Active scraper alerts and auto-apply status will show up here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-border/10">
              {notifications.map((item) => {
                const { icon: Icon, bgClass } = getIcon(item.type);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex gap-3 p-3.5 group transition-colors duration-150 relative",
                      !item.read
                        ? "bg-slate-50/50 dark:bg-[#0B0F19]/20"
                        : "hover:bg-slate-50/30 dark:hover:bg-[#0B0F19]/10",
                    )}
                  >
                    {/* Unread indicator */}
                    {!item.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#FD5D28] rounded-full" />
                    )}

                    {/* Icon */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                        bgClass,
                      )}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    {/* Text Details */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleNotificationClick(item)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-primary transition-colors leading-tight">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug break-words pr-2">
                        {item.message}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 cursor-pointer"
                        title="Delete notification"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMut.mutate(item.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
