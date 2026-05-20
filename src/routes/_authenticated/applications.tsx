import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const listApps = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("applications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
  return { apps: data ?? [] };
});

export const Route = createFileRoute("/_authenticated/applications")({ component: Apps });

function Apps() {
  const fn = useServerFn(listApps);
  const { data } = useQuery({ queryKey: ["apps"], queryFn: () => fn() });
  const apps = data?.apps ?? [];

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">Applications</h1>
      <p className="text-muted-foreground text-sm mb-6">Cover letters generated for each job — also saved to your Google Drive</p>
      {apps.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No applications yet. Open a job and generate a cover letter.</Card>
      ) : (
        <div className="space-y-2">
          {apps.map((a: any) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Link to="/jobs/$id" params={{ id: a.job_id }} className="flex-1">
                  <div className="font-medium">{a.job_title}</div>
                  <div className="text-xs text-muted-foreground">{a.company} · {new Date(a.created_at).toLocaleDateString()}</div>
                </Link>
                <Badge variant="outline">{a.status}</Badge>
                {a.drive_url && (
                  <a href={a.drive_url} target="_blank" rel="noreferrer" className="text-primary text-sm inline-flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Drive
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
