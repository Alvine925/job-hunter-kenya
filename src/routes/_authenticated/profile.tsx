import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/jobs.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({ component: Profile });

function Profile() {
  const get = useServerFn(getMyProfile);
  const upd = useServerFn(updateMyProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: () => get() });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (data?.profile) {
      setForm({
        full_name: data.profile.full_name ?? "",
        phone: data.profile.phone ?? "",
        skills: (data.profile.skills ?? []).join(", "),
        professional_summary: data.profile.professional_summary ?? "",
        work_history: data.profile.work_history ?? "",
        education: data.profile.education ?? "",
        desired_roles: (data.profile.desired_roles ?? []).join(", "),
        preferred_county: data.profile.preferred_county ?? "",
        linkedin_url: data.profile.linkedin_url ?? "",
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () => upd({ data: {
      ...form,
      skills: form.skills.split(",").map((s: string) => s.trim()).filter(Boolean),
      desired_roles: form.desired_roles.split(",").map((s: string) => s.trim()).filter(Boolean),
    }}),
    onSuccess: () => toast.success("Profile saved"),
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">My Profile</h1>
      <p className="text-muted-foreground text-sm mb-6">Used to match jobs and tailor your cover letters</p>
      <Card className="p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input value={form.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
        </div>
        <div><Label>Desired roles (comma-separated)</Label><Input value={form.desired_roles ?? ""} onChange={(e) => set("desired_roles", e.target.value)} placeholder="Software Engineer, Data Analyst" /></div>
        <div><Label>Skills (comma-separated)</Label><Input value={form.skills ?? ""} onChange={(e) => set("skills", e.target.value)} placeholder="React, Python, SQL" /></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Preferred county</Label><Input value={form.preferred_county ?? ""} onChange={(e) => set("preferred_county", e.target.value)} placeholder="Nairobi" /></div>
          <div><Label>LinkedIn URL</Label><Input value={form.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} /></div>
        </div>
        <div><Label>Professional summary</Label><Textarea rows={3} value={form.professional_summary ?? ""} onChange={(e) => set("professional_summary", e.target.value)} /></div>
        <div><Label>Work history</Label><Textarea rows={5} value={form.work_history ?? ""} onChange={(e) => set("work_history", e.target.value)} /></div>
        <div><Label>Education</Label><Textarea rows={3} value={form.education ?? ""} onChange={(e) => set("education", e.target.value)} /></div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save profile
        </Button>
      </Card>
    </div>
  );
}
