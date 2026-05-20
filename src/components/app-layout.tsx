import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Search, Briefcase, FileText, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/find-jobs", label: "Find Jobs", icon: Search },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/profile", label: "My Profile", icon: User },
  { to: "/configuration", label: "Configuration", icon: FileText },
];

export function AppLayout() {
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-white">JobHunter KE</h1>
          <p className="text-xs text-sidebar-muted mt-1">Auto-apply for Kenyan jobs</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                  active ? "bg-sidebar-active text-sidebar-active-foreground font-medium" : "hover:bg-white/5 text-sidebar-foreground")}>
                <Icon className="w-4 h-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
          className="m-3 flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-white/5">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
