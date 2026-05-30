import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GitBranch,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  ChevronRight,
  Info,
  CalendarDays,
  FileText,
  Search,
  X,
  Clock,
  ArrowRight,
  Database
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/cos/pipeline")({
  head: () => ({
    title: "Pipeline CRM - Tellus",
    meta: [
      { title: "Pipeline CRM - Tellus" },
      { name: "description", content: "Horizontal lifecycle tracker CRM for job negotiations, interview scheduling, and applications." },
    ],
  }),
  component: PipelinePage,
});

interface JobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  tracker_status: string;
  match_score?: number;
  salary_text?: string;
  notes?: string;
  next_action_date?: string;
  next_action_title?: string;
}

const STAGES = [
  { id: "applied", label: "Applied", color: "text-blue-500 border-blue-500/10" },
  { id: "interviewing", label: "Interviewing", color: "text-amber-500 border-amber-500/10" },
  { id: "negotiating", label: "Negotiating", color: "text-purple-500 border-purple-500/10" },
  { id: "offer", label: "Offer Received", color: "text-emerald-500 border-emerald-500/10" },
  { id: "accepted", label: "Accepted", color: "text-teal-500 border-teal-500/10" },
  { id: "rejected", label: "Rejected/Closed", color: "text-rose-500 border-rose-500/10" },
];

const DEFAULT_MOCK_JOBS = [
  {
    title: "Senior Product Manager",
    company: "Safaricom PLC",
    location: "Nairobi (Hybrid)",
    tracker_status: "interviewing",
    match_score: 87,
    salary_text: "Ksh 450,000 - 600,000",
    notes: "Completed first round with Lead Recruiter. Secondary technical panel scheduled for next Tuesday.",
  },
  {
    title: "Lead React Engineer",
    company: "Standard Chartered Bank",
    location: "Remote (Kenya)",
    tracker_status: "offer",
    match_score: 92,
    salary_text: "Ksh 500,000 - 650,000",
    notes: "Offer letter received. Base salary KSH 520,000 plus health and pension cover.",
  },
  {
    title: "Full-Stack Software Engineer",
    company: "Sokowatch (Wasoko)",
    location: "Nairobi (On-site)",
    tracker_status: "applied",
    match_score: 81,
    salary_text: "Ksh 300,000 - 380,000",
    notes: "Applied via internal referral. Resume parsed with tailored Node.js keywords.",
  },
  {
    title: "Technical Project Lead",
    company: "United Nations (UNEP)",
    location: "Gigiri, Nairobi",
    tracker_status: "negotiating",
    match_score: 78,
    salary_text: "USD 4,200 - 5,000",
    notes: "Completed final interview. Discussing remote work percentages.",
  }
];

function PipelinePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobCard | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);

  // New Job Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newStatus, setNewStatus] = useState("applied");
  const [newSalary, setNewSalary] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Edit Job State
  const [editNotes, setEditNotes] = useState("");
  const [editNextActionTitle, setEditNextActionTitle] = useState("");
  const [editNextActionDate, setEditNextActionDate] = useState("");

  // Query actual user jobs
  const { data: realJobs = [], isLoading } = useQuery({
    queryKey: ["jobs-crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, title, company, location, tracker_status, match_score, salary_text, notes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((j: any) => ({
        ...j,
        tracker_status: j.tracker_status === "draft" || j.tracker_status === "new" ? "applied" : j.tracker_status
      }));
    }
  });

  // Filters
  const filteredJobs = realJobs.filter(job => {
    const term = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(term) ||
      job.company.toLowerCase().includes(term) ||
      (job.location || "").toLowerCase().includes(term)
    );
  });

  // Seed Demo Jobs into DB
  const seedDemoMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const demoData = DEFAULT_MOCK_JOBS.map(j => ({
        user_id: user.id,
        title: j.title,
        company: j.company,
        location: j.location,
        tracker_status: j.tracker_status,
        match_score: j.match_score,
        salary_text: j.salary_text,
        notes: j.notes
      }));
      const { error } = await supabase.from("jobs").insert(demoData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-crm"] });
      toast.success("Successfully seeded demo jobs in your database!");
    },
    onError: () => {
      toast.error("Failed to seed demo data");
    }
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("jobs")
        .update({ tracker_status: status })
        .eq("id", id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs-crm"] });
      toast.success(`Moved job to ${STAGES.find(s => s.id === data.status)?.label}`);
    },
    onError: () => {
      toast.error("Failed to update status");
    }
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async ({ id, notes, nextActionDate, nextActionTitle }: { id: string; notes: string; nextActionDate: string; nextActionTitle: string }) => {
      const { error } = await supabase
        .from("jobs")
        .update({ notes: notes })
        .eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-crm"] });
      toast.success("Job details updated successfully");
      setIsDetailOpen(false);
    },
    onError: () => {
      toast.error("Failed to save changes");
    }
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const { data, error } = await supabase
        .from("jobs")
        .insert({
          user_id: user.id,
          title: newTitle,
          company: newCompany,
          location: newLocation,
          tracker_status: newStatus,
          salary_text: newSalary,
          notes: newNotes,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-crm"] });
      toast.success("Job added to CRM pipeline!");
      setIsAddOpen(false);
      setNewTitle("");
      setNewCompany("");
      setNewLocation("");
      setNewSalary("");
      setNewNotes("");
    },
    onError: () => {
      toast.error("Failed to add job");
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-crm"] });
      toast.success("Job removed from pipeline");
      setIsDetailOpen(false);
    },
    onError: () => {
      toast.error("Failed to delete job");
    }
  });

  // HTML5 Drag and Drop events
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, stageId: string) => {
    const id = e.dataTransfer.getData("text");
    if (id) {
      updateStatusMutation.mutate({ id, status: stageId });
    }
  };

  const openDetails = (job: JobCard) => {
    setSelectedJob(job);
    setEditNotes(job.notes || "");
    setEditNextActionTitle(job.next_action_title || "");
    setEditNextActionDate(job.next_action_date || "");
    setIsDetailOpen(true);
  };

  const saveDetails = () => {
    if (selectedJob) {
      updateDetailsMutation.mutate({
        id: selectedJob.id,
        notes: editNotes,
        nextActionTitle: editNextActionTitle,
        nextActionDate: editNextActionDate
      });
    }
  };

  return (
    <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/40 dark:border-border/10 pb-6">
        <div>
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent flex items-center gap-1.5 select-none">
            <GitBranch className="w-5.5 h-5.5 sm:w-7 sm:h-7 text-[#FD5D28]" />
            Pipeline CRM
          </h1>
          <p className="text-muted-foreground text-[10px] sm:text-sm mt-0.5 flex items-center gap-1.5 flex-wrap leading-relaxed">
            <span>Horizontal lifecycle tracker. Drag and drop listings to update stages, log negotiations, and map offer steps.</span>
            <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {realJobs.length === 0 && (
            <Button
              onClick={() => seedDemoMutation.mutate()}
              disabled={seedDemoMutation.isPending}
              variant="outline"
              className="border-slate-200 dark:border-border/40 hover:bg-slate-50 dark:hover:bg-muted/10 font-bold text-[10px] sm:text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl flex items-center gap-1 shadow-sm text-slate-500"
            >
              <Database className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
              {seedDemoMutation.isPending ? "Seeding..." : "Seed Demo Jobs"}
            </Button>
          )}
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-[#FD5D28] hover:bg-[#FD5D28]/95 text-white font-bold text-[10px] sm:text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
            Add Job Card
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 pb-5 border-b border-slate-200/30 dark:border-border/5">
        {[
          { label: "Active Applications", val: realJobs.filter(j => j.tracker_status !== "rejected").length, color: "text-[#FD5D28]" },
          { label: "Active Interviews", val: realJobs.filter(j => j.tracker_status === "interviewing").length, color: "text-amber-500" },
          { label: "Offers Received", val: realJobs.filter(j => j.tracker_status === "offer").length, color: "text-emerald-500" },
          {
            label: "Interview Rate",
            val: realJobs.length > 0 ? `${Math.round((realJobs.filter(j => ["interviewing", "negotiating", "offer", "accepted"].includes(j.tracker_status)).length / realJobs.length) * 100)}%` : "0%",
            color: "text-blue-500"
          }
        ].map((stat, i) => (
          <div key={i} className="flex flex-col justify-between py-0.5 text-left">
            <span className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{stat.label}</span>
            <span className={cn("text-xl sm:text-3xl font-black mt-0.5", stat.color)}>{stat.val}</span>
          </div>
        ))}
      </div>

      {/* Filters & Search - Cardless */}
      <div className="flex items-center gap-2.5 w-full max-w-2xl bg-slate-100/60 dark:bg-slate-900/40 rounded-lg sm:rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2">
        <Search className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search jobs by role, company, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-0 outline-none text-[11px] sm:text-sm text-foreground placeholder-muted-foreground/60 focus:ring-0 focus:outline-none"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="p-0.5 hover:bg-slate-200 dark:hover:bg-muted/30 rounded-md">
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Kanban Board Container - Cardless design */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 xl:flex xl:overflow-x-auto xl:pb-4 scrollbar-thin select-none items-start min-h-[500px] min-w-0">
        {STAGES.map((stage) => {
          const stageJobs = filteredJobs.filter(j => j.tracker_status === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, stage.id)}
              className="min-w-0 flex flex-col xl:flex-shrink-0 xl:w-80 xl:max-h-[700px]"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between gap-3 py-2 mb-3 border-b border-slate-200/50 dark:border-border/5">
                <span className={cn("text-[10px] sm:text-xs font-bold uppercase tracking-wider", stage.color)}>
                  {stage.label}
                </span>
                <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                  {stageJobs.length} {stageJobs.length === 1 ? "Job" : "Jobs"}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin max-h-[460px] xl:max-h-[600px]">
                {stageJobs.length === 0 ? (
                  <div className="border border-dashed border-slate-200/60 dark:border-border/20 p-6 rounded-xl text-center text-[10px] text-muted-foreground/60 select-none py-10 bg-transparent">
                    Drag items here
                  </div>
                ) : (
                  stageJobs.map((job) => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, job.id)}
                      onClick={() => openDetails(job)}
                      className="group relative rounded-lg border border-slate-200/60 bg-white px-3 py-3 shadow-sm transition-all hover:border-[#FD5D28]/30 hover:bg-slate-50/70 dark:border-border/10 dark:bg-slate-950/40 dark:hover:bg-slate-900/30 cursor-grab active:cursor-grabbing text-left space-y-2"
                    >
                      {/* Score Badge */}
                      {job.match_score !== undefined && (
                        <span className={cn(
                          "inline-flex items-center text-[8px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900 border border-border/20 tracking-wider",
                          job.match_score >= 80 ? "text-emerald-500" : job.match_score >= 60 ? "text-amber-500" : "text-rose-500"
                        )}>
                          {job.match_score}% MATCH
                        </span>
                      )}

                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 group-hover:text-[#FD5D28] transition-colors leading-tight">
                          {job.title}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{job.company}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground/80">
                        {job.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                        )}
                        {job.salary_text && (
                          <div className="flex items-center gap-1 font-semibold text-foreground/80">
                            <DollarSign className="w-3 h-3 shrink-0 text-[#FD5D28]" />
                            <span className="truncate">{job.salary_text}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        {selectedJob && (
          <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-md p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-950 border border-border/30 max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                <Badge variant="outline" className="text-[9px] uppercase font-black tracking-wider bg-slate-100 dark:bg-slate-900 border-border/50 py-0.5 px-1.5">
                  {selectedJob.tracker_status}
                </Badge>
                {selectedJob.match_score && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 text-[9px] py-0.5 px-1.5">
                    {selectedJob.match_score}% Match
                  </Badge>
                )}
              </div>
              <DialogTitle className="font-extrabold text-base sm:text-lg leading-tight text-foreground">
                {selectedJob.title}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                {selectedJob.company} • {selectedJob.location}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">CRM Lifecycle Stage</label>
                <select
                  value={selectedJob.tracker_status}
                  onChange={(e) => updateStatusMutation.mutate({ id: selectedJob.id, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-border/10 bg-background px-2.5 py-1 text-xs focus:outline-none text-foreground h-8"
                >
                  {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Negotiation Notes & Log</label>
                <Textarea
                  placeholder="Record call updates, follow-ups, base salary discussions, or interview questions asked..."
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-background/50 border-border/50 focus:border-primary/50 text-xs rounded-lg leading-relaxed py-1.5 px-2.5"
                />
              </div>
            </div>

            <div className="flex flex-row items-center justify-between gap-2 border-t border-slate-200/40 dark:border-border/10 pt-2.5 mt-3">
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this job card?")) {
                    deleteJobMutation.mutate(selectedJob.id);
                  }
                }}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/5 px-2 py-1 h-7 text-xs font-semibold rounded-lg flex items-center gap-0.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailOpen(false)}
                  className="px-2.5 py-1 h-7 text-xs font-semibold rounded-lg border-border/60"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveDetails}
                  disabled={updateDetailsMutation.isPending}
                  className="bg-[#FD5D28] hover:bg-[#FD5D28]/90 text-white px-2.5 py-1 h-7 text-xs font-bold rounded-lg shadow-sm"
                >
                  {updateDetailsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Add Card Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-md p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-950 border border-border/30 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-extrabold text-base sm:text-lg leading-tight text-foreground">
              Add Job Card to Pipeline
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs text-slate-400 font-semibold mt-0.5">
              Create a custom record to track in your CRM board.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Job Title *</label>
                <Input
                  required
                  placeholder="e.g. Finance Analyst"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg h-8 text-xs py-1 px-2.5"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Company *</label>
                <Input
                  required
                  placeholder="e.g. Equity Bank"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg h-8 text-xs py-1 px-2.5"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</label>
                <Input
                  placeholder="e.g. Nairobi"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg h-8 text-xs py-1 px-2.5"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Salary Text</label>
                <Input
                  placeholder="e.g. Ksh 200k - 250k"
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  className="bg-background/50 border-border/50 rounded-lg h-8 text-xs py-1 px-2.5"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Initial Lifecycle Stage</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-border/10 bg-background px-2.5 py-1 text-xs focus:outline-none text-foreground h-8"
              >
                {STAGES.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Log Initial Notes</label>
              <Textarea
                placeholder="Details of application, referrals, links to JD..."
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="bg-background/50 border-border/50 rounded-lg text-xs py-1.5 px-2.5 leading-relaxed"
              />
            </div>
          </div>

          <div className="border-t border-slate-200/40 dark:border-border/10 pt-2.5 flex flex-row items-center justify-end gap-1.5 mt-3">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="px-2.5 py-1 h-7 text-xs font-semibold rounded-lg border-border/60"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createJobMutation.mutate()}
              disabled={!newTitle || !newCompany || createJobMutation.isPending}
              className="bg-[#FD5D28] hover:bg-[#FD5D28]/90 text-white px-2.5 py-1 h-7 text-xs font-bold rounded-lg shadow-sm"
            >
              {createJobMutation.isPending ? "Adding..." : "Add to Board"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <LearnMoreSlider
        pageId="pipeline"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
