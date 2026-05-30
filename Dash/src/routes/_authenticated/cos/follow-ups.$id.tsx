import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Mail,
  Copy,
  Check,
  Send,
  Building2,
  Calendar,
  Clock,
  ChevronRight,
  Info,
  RefreshCw,
  MailCheck,
  FileText,
  User,
  ExternalLink,
  ChevronDown,
  ArrowLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchParams {
  tab?: "check-in" | "thank-you" | "counter-proposal";
}

export const Route = createFileRoute("/_authenticated/cos/follow-ups/$id")({
  head: () => ({
    title: "Follow-Up Workspace - Tellus",
    meta: [
      { title: "Follow-Up Workspace - Tellus" },
      { name: "description", content: "Professional email template engine and follow-up action planner for job seekers." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const tab = search.tab as string;
    if (tab === "check-in" || tab === "thank-you" || tab === "counter-proposal") {
      return { tab };
    }
    return { tab: "check-in" };
  },
  component: FollowUpDetailPage,
});

interface FollowUpJob {
  id: string;
  title: string;
  company: string;
  status: string;
  lastContact: string;
  daysIdle: number;
  contactPerson?: string;
  contactEmail?: string;
}

const TEMPLATES = [
  {
    id: "check-in",
    label: "Application Check-In",
    subject: "Application Follow-up: [Job Title] - [Your Name]",
    body: `Dear [Recruiter Name],

I hope this email finds you well.

I am writing to briefly check in on the status of my application for the [Job Title] position at [Company Name], which I submitted on [Date]. 

I remain highly enthusiastic about the opportunity to join [Company Name] and contribute my skills to the team. 

Please let me know if there are any updates or if I can provide any additional materials, such as references or work samples, to support my candidacy.

Best regards,

[Your Name]
[Your Phone Number]
[Your LinkedIn Profile]`
  },
  {
    id: "thank-you",
    label: "Pre-Interview Thank You",
    subject: "Thank you for the opportunity: [Job Title] - [Your Name]",
    body: `Dear [Interviewer Name],

Thank you so much for taking the time to discuss the [Job Title] opportunity at [Company Name] with me. I thoroughly enjoyed our conversation and learning more about the team's goals, particularly [mention a specific project or topic discussed].

Our discussion reinforced my excitement about this role. I am confident that my experience aligns perfectly with the challenges ahead, and I look forward to helping the team achieve its targets.

Please let me know if you need any further information as you move forward with the hiring process.

Best regards,

[Your Name]
[Your Phone Number]
[Your LinkedIn Profile]`
  },
  {
    id: "counter-proposal",
    label: "Offer Counter Proposal",
    subject: "Offer Discussion: [Job Title] - [Your Name]",
    body: `Dear [Recruiter Name],

Thank you very much for offering me the [Job Title] position at [Company Name]. I am incredibly excited about the opportunity to join the team and help drive your roadmap forward.

Before formalizing our agreement, I would like to discuss the compensation package. Given my background and track record of achievements, I was hoping we could explore a base salary of [proposed salary range/Ksh].

I am fully committed to the role and confident that I will deliver high value immediately. I look forward to hearing your thoughts on whether this adjustment is possible.

Best regards,

[Your Name]
[Your Phone Number]
[Your LinkedIn Profile]`
  }
];

function FollowUpDetailPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [copied, setCopied] = useState(false);
  const [userName, setUserName] = useState("Alvine");
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // Fetch real profile to auto-populate name
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).single();
      return prof;
    }
  });

  // Query actual user jobs to select from in the sidebar list
  const { data: jobsList = [] } = useQuery({
    queryKey: ["jobs-followups-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, company, location, tracker_status, contact_person, application_email, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company || "",
        status: j.tracker_status || "applied",
        lastContact: new Date(j.created_at).toISOString().split("T")[0],
        daysIdle: Math.max(0, Math.floor((new Date().getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24))),
        contactPerson: j.contact_person || "Hiring Lead",
        contactEmail: j.application_email || "recruitment@company.com"
      }));
    }
  });

  // Query details of the current active job from the route param
  const { data: activeJob, isLoading: isJobLoading } = useQuery({
    queryKey: ["job-followup", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, company, location, tracker_status, contact_person, application_email, created_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return {
        id: data.id,
        title: data.title,
        company: data.company || "",
        location: data.location || "",
        status: data.tracker_status || "applied",
        lastContact: new Date(data.created_at).toISOString().split("T")[0],
        daysIdle: Math.max(0, Math.floor((new Date().getTime() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24))),
        contactPerson: data.contact_person || "Hiring Lead",
        contactEmail: data.application_email || "recruitment@company.com"
      };
    }
  });

  const selectedTemplate = TEMPLATES.find(t => t.id === tab) || TEMPLATES[0];
  const activeName = profile?.full_name || userName;

  const getPopulatedTemplate = () => {
    if (!selectedTemplate) return { subject: "", body: "" };
    
    let subject = selectedTemplate.subject;
    let body = selectedTemplate.body;

    if (activeJob) {
      subject = subject
        .replace("[Job Title]", activeJob.title)
        .replace("[Your Name]", activeName);
      
      body = body
        .replace("[Recruiter Name]", activeJob.contactPerson?.split(" ")[0] || "Hiring Team")
        .replace("[Interviewer Name]", activeJob.contactPerson?.split(" ")[0] || "Hiring Manager")
        .replace("[Job Title]", activeJob.title)
        .replace("[Company Name]", activeJob.company)
        .replace("[Date]", new Date(activeJob.lastContact).toLocaleDateString(undefined, {month: "short", day: "numeric"}))
        .replace("[Your Name]", activeName)
        .replace("[Your Phone Number]", "+254 700 000 000")
        .replace("[Your LinkedIn Profile]", "linkedin.com/in/alvine-otieno");
    }

    return { subject, body };
  };

  const handleCopy = () => {
    const { subject, body } = getPopulatedTemplate();
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Template copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const { subject, body } = getPopulatedTemplate();

  const handleTabChange = (tabId: "check-in" | "thank-you" | "counter-proposal") => {
    void navigate({
      search: { tab: tabId },
      replace: true
    });
  };

  if (isJobLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full text-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#FD5D28]" />
        <p className="text-muted-foreground text-sm">Loading application workspace...</p>
      </div>
    );
  }

  if (!activeJob) {
    return (
      <div className="p-8 max-w-7xl mx-auto w-full text-center space-y-4">
        <Info className="w-12 h-12 mx-auto text-rose-500" />
        <h2 className="text-xl font-bold">Job Application Not Found</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          The requested job tracking card does not exist or may have been deleted.
        </p>
        <Button asChild className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white">
          <Link to="/cos/follow-ups">Back to Follow-Ups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/cos/follow-ups"
              className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground font-bold transition-all bg-slate-100 dark:bg-slate-900 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-border/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-[#FD5D28] font-bold">Workspace</span>
          </div>
          <h1 className="text-base sm:text-xl lg:text-2xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-1.5 select-none">
            <MailCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#FD5D28]" />
            Follow-Up Workspace
          </h1>
          <p className="text-muted-foreground text-[10px] sm:text-xs flex items-center gap-1.5 flex-wrap">
            <span>Compose templates for {activeJob.title} at {activeJob.company}.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Traversal Queue for Quick Hopping (Hidden on mobile detail views) */}
        <div className="hidden lg:block lg:col-span-1 space-y-4 border-r border-slate-200/20 dark:border-border/5 pr-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/40 dark:border-border/5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Applications</h2>
            <Badge variant="secondary" className="font-extrabold text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {jobsList.length} Active
            </Badge>
          </div>

          <div className="divide-y divide-slate-200/30 dark:divide-border/5">
            {jobsList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6">No jobs in CRM.</p>
            ) : (
              jobsList.map((job) => {
                const isSelected = activeJob.id === job.id;
                const severityColor = job.daysIdle >= 10 ? "text-rose-500" : "text-amber-500";
                return (
                  <Link
                    key={job.id}
                    to="/cos/follow-ups/$id"
                    params={{ id: job.id }}
                    search={{ tab }}
                    className={cn(
                      "block py-3 transition-all cursor-pointer text-left space-y-1 px-2 rounded-xl border border-transparent my-1",
                      isSelected ? "bg-slate-100/60 dark:bg-slate-900/35 border-slate-200/40 dark:border-border/10 font-bold" : "hover:bg-slate-100/30 dark:hover:bg-slate-900/10"
                    )}
                  >
                    <div>
                      <h4 className={cn("text-xs sm:text-sm text-foreground line-clamp-1", isSelected ? "font-bold" : "font-semibold")}>{job.title}</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {job.company}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-bold pt-1 text-slate-400">
                      <span className="uppercase">Stage: {job.status}</span>
                      <span className={cn("flex items-center gap-0.5", severityColor)}>
                        <Clock className="w-3 h-3 shrink-0" />
                        {job.daysIdle}d idle
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Workspace & Composer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Active Application Badge Details */}
          <div className="bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-3 sm:p-4 border border-slate-200/30 dark:border-border/5 space-y-2 sm:space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground leading-snug">{activeJob.title}</h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-xs text-muted-foreground font-semibold">
                  <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>{activeJob.company}</span>
                  {activeJob.location && (
                    <>
                      <span>•</span>
                      <span>{activeJob.location}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[8px] sm:text-[10px] font-extrabold uppercase bg-primary/10 text-primary border-primary/20 px-1.5 py-0">
                  {activeJob.status}
                </Badge>
                <Badge variant="secondary" className={cn("text-[8px] sm:text-[10px] font-bold px-1.5 py-0", activeJob.daysIdle >= 10 ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500")}>
                  {activeJob.daysIdle} Days Idle
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200/40 dark:border-border/10 pb-3">
            <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Template Engine</h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 leading-relaxed">Pre-populates company specifics into your drafts. Switch tabs to preview templates.</p>
          </div>

          <div className="space-y-6">
            <div className="w-full max-w-md">
              <Select
                value={tab}
                onValueChange={(val) => handleTabChange(val as "check-in" | "thank-you" | "counter-proposal")}
              >
                <SelectTrigger className="w-full h-10 bg-background border-border text-xs sm:text-sm font-semibold rounded-xl focus:ring-[#FD5D28]">
                  <SelectValue placeholder="Select Follow-up Template" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.id} className="text-xs sm:text-sm">
                      {tmpl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6 text-left">
              {/* Recruiter Details - Clean flat panel */}
              <div className="bg-slate-100/60 dark:bg-slate-900/35 rounded-2xl p-3 sm:p-4 text-[10px] sm:text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div>
                  <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Recipient Contact</span>
                  <span className="font-bold text-foreground mt-0.5 block text-[11px] sm:text-xs">{activeJob.contactPerson || "Hiring Team"}</span>
                  {activeJob.contactEmail && (
                    <span className="text-muted-foreground block font-semibold mt-0.5">{activeJob.contactEmail}</span>
                  )}
                </div>
                {activeJob.contactEmail && (
                  <a
                    href={`mailto:${activeJob.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FD5D28]/10 text-[#FD5D28] hover:bg-[#FD5D28]/15 rounded-lg text-[10px] sm:text-xs font-bold transition-all shrink-0 self-start sm:self-auto border border-[#FD5D28]/10 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send via Email Client
                  </a>
                )}
              </div>

              {/* Mail Mock Interface */}
              <div className="border border-slate-200/50 dark:border-border/10 rounded-2xl overflow-hidden bg-background shadow-md">
                {/* Header info */}
                <div className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/50 dark:border-border/10 px-4 py-3 text-[10px] sm:text-xs font-semibold space-y-2 select-none">
                  <div className="grid grid-cols-[56px_1fr] gap-2 items-start text-muted-foreground">
                    <span className="font-bold text-slate-400">To:</span>
                    <span className="text-foreground font-semibold break-all text-[11px] sm:text-xs">{activeJob.contactEmail || "recruitment@company.com"}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-muted-foreground border-t border-slate-200/20 dark:border-border/5 pt-2">
                    <span className="font-bold text-slate-400">Subject:</span>
                    <span className="text-foreground font-bold break-words leading-relaxed text-[11px] sm:text-xs">{subject}</span>
                  </div>
                </div>

                {/* Mail Body */}
                <pre className="p-4 text-[11px] sm:text-xs font-normal font-sans leading-relaxed text-foreground whitespace-pre-wrap outline-none bg-transparent min-h-[300px]">
                  {body}
                </pre>
              </div>

              {/* Action row */}
              <div className="flex justify-between items-center gap-3">
                {/* Mobile Traversal indicator */}
                <span className="text-[10px] text-muted-foreground font-semibold lg:hidden">
                  Go to CRM dashboard to select other active jobs.
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={handleCopy}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground font-bold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 border border-border/50 transition-colors shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Template
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <LearnMoreSlider
        pageId="follow-ups"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
