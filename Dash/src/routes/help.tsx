import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  FileText,
  GitBranch,
  GraduationCap,
  LifeBuoy,
  Loader2,
  Mail,
  Menu,
  MessageSquare,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/api";
import { checkServerSession } from "@/lib/auth-check.server";
import { isBrowser, waitForAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  beforeLoad: async ({ location }) => {
    const redirectPath = isBrowser()
      ? window.location.pathname + window.location.search
      : location.pathname;

    if (!isBrowser()) {
      const { hasSession } = await checkServerSession();
      if (!hasSession) {
        throw redirect({
          to: "/login",
          search: { redirect: redirectPath },
        });
      }
      return;
    }

    const session = await waitForAuthSession();
    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: redirectPath },
      });
    }
  },
  head: () => ({
    title: "Help - Tellus",
    meta: [
      { title: "Help - Tellus" },
      {
        name: "description",
        content:
          "Learn how Tellus works, review every product area, ask questions, and send feedback.",
      },
    ],
  }),
  component: HelpPage,
});

const sections = [
  { id: "overview", label: "Overview", shortLabel: "Overview", icon: BookOpen },
  { id: "start", label: "Getting started", shortLabel: "Start", icon: CheckCircle2 },
  { id: "marketplace", label: "Marketplace", shortLabel: "Jobs", icon: Search },
  { id: "applications", label: "Applications", shortLabel: "Apply", icon: FileCheck2 },
  { id: "cos", label: "Career system", shortLabel: "COS", icon: GitBranch },
  { id: "account", label: "Account & limits", shortLabel: "Account", icon: Settings },
  { id: "qa", label: "Q&A", shortLabel: "Q&A", icon: CircleHelp },
  { id: "contact", label: "Contact", shortLabel: "Contact", icon: Mail },
  { id: "feedback", label: "Feedback", shortLabel: "Feedback", icon: MessageSquare },
] as const;

type HelpSection = (typeof sections)[number]["id"];

const workflowSteps = [
  {
    title: "Build your profile",
    body: "Upload or complete your CV details so Tellus understands your skills, experience, location, role interests, education, and work history.",
  },
  {
    title: "Find roles",
    body: "Use Marketplace, monitored sites, and saved jobs to collect opportunities from different job boards and employer pages.",
  },
  {
    title: "Check fit",
    body: "Review match summaries, strengths, gaps, and role context before deciding whether a job deserves your time.",
  },
  {
    title: "Prepare and apply",
    body: "Create cover letters, application notes, email drafts, tailored CV versions, and application packs.",
  },
  {
    title: "Track progress",
    body: "Move jobs through your pipeline, follow up on applications, compare outcomes, and keep your job search organized.",
  },
];

const featureGroups = [
  {
    title: "Job discovery",
    icon: Briefcase,
    items: [
      "Marketplace for browsing job listings in one place",
      "Board, category, company, role, keyword, and timing filters",
      "Detailed job pages with role summaries, company information, and application actions",
      "Monitored sites for watching employer career pages and recurring job sources",
    ],
  },
  {
    title: "Matching and insight",
    icon: Target,
    items: [
      "Role-to-profile matching using CV and profile signals",
      "Strengths, gaps, and role-fit summaries",
      "Dashboard metrics for saved jobs, applications, referrals, and activity",
      "Marketplace insights to scan roles faster and focus on stronger opportunities",
    ],
  },
  {
    title: "Application preparation",
    icon: WandSparkles,
    items: [
      "Cover letter and email draft generation",
      "Application packs for role-specific documents and notes",
      "Reusable templates for application language",
      "Interview practice, suggested answers, and feedback workflows",
    ],
  },
  {
    title: "Career operating system",
    icon: BarChart3,
    items: [
      "Pipeline tracker for saved, applied, interview, offer, and rejected stages",
      "Follow-up reminders and employer relationship tracking",
      "ATS score, skills hub, salary insight, success prediction, and learning roadmap",
      "CV versions and employer intelligence for more targeted applications",
    ],
  },
];

const marketplaceDetails = [
  [
    "Marketplace",
    "Browse public and saved listings, inspect job details, and decide whether to save or apply.",
  ],
  ["My jobs", "View jobs you have saved or opened for your own application workflow."],
  [
    "Monitors",
    "Track specific job sources or employer pages so new opportunities do not get lost.",
  ],
  ["Configuration", "Control job-search preferences and source settings that influence discovery."],
];

const applicationDetails = [
  ["Cover letters", "Generate role-specific cover letters using the job context and your profile."],
  [
    "Application preview",
    "Review generated text, supporting details, and application instructions before using them.",
  ],
  ["Templates", "Keep reusable language for introductions, emails, and application responses."],
  [
    "Interview mode",
    "Practice questions, receive structured feedback, and prepare for the next hiring step.",
  ],
];

const cosDetails = [
  ["Pipeline", "Track each opportunity from saved role to final outcome."],
  ["Follow-ups", "Manage outreach, reminders, and next actions after applying or interviewing."],
  [
    "Analytics",
    "Review conversion patterns across saved jobs, applications, interviews, and offers.",
  ],
  ["ATS optimizer", "Check how well your CV aligns with a target role."],
  ["Skills hub", "See skills to strengthen based on your target roles."],
  ["Career path", "Explore growth direction and next-step roles."],
  ["CV versions", "Manage tailored CV variants for different opportunities."],
  ["Learning roadmap", "Plan learning work around gaps that repeatedly show up in jobs."],
  ["Employer intel", "Compare companies and roles you are actively pursuing."],
];

const faqs = [
  {
    question: "What is Tellus?",
    answer:
      "Tellus is your job intelligence workspace. It helps you find roles, understand fit, prepare stronger applications, and track your full job-search process.",
  },
  {
    question: "Is Tellus only a job board?",
    answer:
      "No. Marketplace is one part of the product. Tellus also handles CV/profile signals, matching, application generation, pipeline tracking, follow-ups, interview preparation, referrals, and feedback.",
  },
  {
    question: "How are match scores created?",
    answer:
      "Tellus compares job requirements with your CV, profile, skills, preferred roles, and available job details. The score is a decision aid, not a promise that an employer will shortlist you.",
  },
  {
    question: "What should I do first after signing up?",
    answer:
      "Complete your profile, add or confirm your CV details, review Marketplace, save a few relevant roles, then use the application tools for the roles that are actually worth applying to.",
  },
  {
    question: "What do referrals change?",
    answer:
      "Referrals help unlock upgraded usage limits. The referral section shows your link, referral activity, and progress toward upgraded access.",
  },
  {
    question: "Where does a support question go?",
    answer:
      "Questions submitted from this Help page are emailed to hello@tellusjobs.site with your account email attached for replies.",
  },
  {
    question: "Where should users send product ideas or bugs?",
    answer:
      "Use the Feedback tab here. It renders the same feedback form used elsewhere in the app, so feedback is saved consistently.",
  },
  {
    question: "How do I get the best results from Tellus?",
    answer:
      "Keep your profile current, add detailed CV information, save jobs that genuinely fit your goals, and review generated application material before sending it.",
  },
  {
    question: "Why does Tellus need my profile?",
    answer:
      "Your profile helps Tellus compare jobs with your skills, experience, preferred roles, location, education, and career goals.",
  },
  {
    question: "Can I use Tellus without completing my CV?",
    answer:
      "You can browse some areas, but matching and application generation work better when your CV and profile details are complete.",
  },
  {
    question: "What is the dashboard for?",
    answer:
      "The dashboard gives you a command center for saved jobs, applications, referral progress, recent activity, and next actions.",
  },
  {
    question: "What is Marketplace?",
    answer:
      "Marketplace is where you browse job listings, review job details, save roles, and begin application workflows.",
  },
  {
    question: "What is My Jobs?",
    answer:
      "My Jobs contains opportunities you have saved or opened for your own application process.",
  },
  {
    question: "What does saving a job do?",
    answer:
      "Saving a job keeps it in your workspace so you can return to it, compare fit, prepare materials, and track progress.",
  },
  {
    question: "What are monitored sites?",
    answer:
      "Monitored sites help watch specific job sources or employer pages so new roles are easier to find later.",
  },
  {
    question: "What is Configuration used for?",
    answer:
      "Configuration controls job-search preferences and source settings that affect discovery and monitoring.",
  },
  {
    question: "Can Tellus apply to jobs for me automatically?",
    answer:
      "Tellus helps prepare applications, but you should review final material and submit applications yourself unless a workflow clearly says otherwise.",
  },
  {
    question: "Does Tellus guarantee I will get shortlisted?",
    answer:
      "No. Tellus improves organization and preparation, but employers make their own hiring decisions.",
  },
  {
    question: "Why should I review generated cover letters?",
    answer:
      "Generated letters can save time, but you should confirm accuracy, tone, dates, employer names, and role-specific details.",
  },
  {
    question: "What is an application pack?",
    answer:
      "An application pack groups role context, drafts, notes, and supporting material so you can apply with less scattered work.",
  },
  {
    question: "What are templates?",
    answer:
      "Templates store reusable application language such as introductions, email wording, and repeated responses.",
  },
  {
    question: "Can I create different CV versions?",
    answer:
      "Yes. CV versions help you tailor your CV for different roles, industries, or seniority levels.",
  },
  {
    question: "What is the ATS optimizer?",
    answer:
      "The ATS optimizer checks how well your CV aligns with a target role and highlights areas you may want to improve.",
  },
  {
    question: "What is the Career Operating System?",
    answer:
      "It is the deeper workspace for managing your job-search campaign, including pipeline, follow-ups, analytics, skills, salary, learning, employers, and CV versions.",
  },
  {
    question: "What is the pipeline tracker?",
    answer:
      "The pipeline tracker helps you move opportunities through stages like saved, applied, interviewing, offer, rejected, or closed.",
  },
  {
    question: "Why should I track follow-ups?",
    answer:
      "Follow-ups help you avoid losing momentum after applications, interviews, recruiter messages, or employer conversations.",
  },
  {
    question: "What does conversion analytics show?",
    answer:
      "Analytics helps you understand patterns across saved jobs, applications, interviews, and outcomes.",
  },
  {
    question: "What is Skills Hub?",
    answer:
      "Skills Hub helps you identify skills that appear repeatedly in your target jobs so you know what to strengthen.",
  },
  {
    question: "What is Employer Intel?",
    answer: "Employer Intel helps you compare companies and roles you are actively considering.",
  },
  {
    question: "What is the learning roadmap?",
    answer:
      "The learning roadmap helps you plan learning work around gaps that repeatedly appear in jobs you care about.",
  },
  {
    question: "What is salary insight for?",
    answer:
      "Salary insight helps you think about compensation expectations and compare opportunities more thoughtfully.",
  },
  {
    question: "What does success prediction mean?",
    answer:
      "Success prediction is a guidance tool that estimates fit and opportunity strength. It should support your judgment, not replace it.",
  },
  {
    question: "Can I edit my profile details?",
    answer:
      "Yes. Use the Profile or Settings areas to update your name, CV information, skills, experience, education, and preferences.",
  },
  {
    question: "Where do I manage my LinkedIn or source settings?",
    answer:
      "Use Settings and Configuration for profile, source, LinkedIn, and job-search preference controls.",
  },
  {
    question: "Why is my referral count important?",
    answer:
      "Referral progress can unlock upgraded limits and helps show how many completed referrals are connected to your account.",
  },
  {
    question: "Why might referral numbers differ across pages?",
    answer:
      "They should not differ when both pages use the same completed-referral source. If they do, it usually means one page is counting a different status or identifier.",
  },
  {
    question: "Can I invite someone with my referral link?",
    answer:
      "Yes. Share your referral link from Settings so completed signups can count toward your referral progress.",
  },
  {
    question: "Where do I ask for help?",
    answer:
      "Use the Contact tab in Help. Your message is sent to hello@tellusjobs.site with your account email for replies.",
  },
  {
    question: "Will I see a success message after contacting support?",
    answer:
      "Yes. When the email sends successfully, Tellus shows a success toast confirming the message was sent.",
  },
  {
    question: "Where does feedback go?",
    answer:
      "Feedback is saved in Tellus and also emailed to hello@tellusjobs.site when the email notification succeeds.",
  },
  {
    question: "What should I put in feedback?",
    answer:
      "Send bugs, confusing workflows, missing features, design suggestions, or anything that would make Tellus more useful for your job search.",
  },
  {
    question: "Can I report a bug from Help?",
    answer:
      "Yes. Use Feedback and choose the Bug category, or use Contact if the issue needs a direct reply.",
  },
  {
    question: "Is the Contact form just a placeholder?",
    answer:
      "No. It calls the help-contact Supabase function and sends an email through Resend when the email provider is configured.",
  },
  {
    question: "Is the Feedback form just a placeholder?",
    answer:
      "No. It saves feedback to the user_feedback table and sends an email notification when the email provider is configured.",
  },
  {
    question: "What happens if email is not configured?",
    answer:
      "Contact messages cannot be emailed without the email provider secret. Feedback can still save, but the email notification may fail.",
  },
  {
    question: "What email address does Tellus use for support?",
    answer:
      "Support messages go to hello@tellusjobs.site unless the deployed function is configured with a different SUPPORT_EMAIL value.",
  },
  {
    question: "Can I reply directly to support emails?",
    answer:
      "Support emails include your account email as reply-to where available, so replies can go back to you.",
  },
  {
    question: "Does Tellus store my feedback?",
    answer:
      "Yes. Feedback submitted through the form is stored so it can be reviewed and used to improve the product.",
  },
  {
    question: "What should I do if generated content is wrong?",
    answer: "Edit the content before using it and send feedback so the issue can be investigated.",
  },
  {
    question: "Should I trust match scores completely?",
    answer:
      "No. Treat match scores as guidance. Your judgment, career goals, and the employer's requirements still matter.",
  },
  {
    question: "How often should I update my profile?",
    answer:
      "Update it whenever your CV, skills, target roles, location preference, or experience changes.",
  },
  {
    question: "What should returning users do first?",
    answer:
      "Start at the dashboard, review saved jobs and next actions, then move into Marketplace or the Career Operating System.",
  },
  {
    question: "What should new users do first?",
    answer:
      "Complete onboarding, add CV/profile details, then save a few relevant jobs before generating application material.",
  },
  {
    question: "Can Tellus help me prepare for interviews?",
    answer:
      "Yes. Interview workflows can help you practice questions and review feedback before speaking with employers.",
  },
  {
    question: "Can Tellus help with career planning?",
    answer:
      "Yes. Career path, skills, learning, salary, and employer tools help you think beyond one application.",
  },
  {
    question: "Why does Help address me by name?",
    answer:
      "If you are logged in and your profile has a name, Help personalizes the page so guidance feels tied to your workspace.",
  },
  {
    question: "Can I go back to the main dashboard from Help?",
    answer: "Yes. Open the Help sidebar and use Back to main dashboard.",
  },
  {
    question: "Why does Help have its own sidebar?",
    answer:
      "Help is structured like its own section so you can move between product explanations, Q&A, contact, and feedback without leaving the page.",
  },
];

function DetailList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map(([title, body]) => (
        <article key={title} className="border-l-2 border-[#FD5D28]/35 py-1 pl-4">
          <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
        </article>
      ))}
    </div>
  );
}

function HelpMenu({
  activeSection,
  onSelect,
  compact = false,
}: {
  activeSection: HelpSection;
  onSelect: (section: HelpSection) => void;
  compact?: boolean;
}) {
  return (
    <nav className="grid gap-1" aria-label="Help center sidebar">
      <Link
        to="/dashboard"
        className={cn(
          "mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-left font-black text-slate-700 transition hover:border-[#FD5D28]/30 hover:text-[#FD5D28] dark:border-border/10 dark:bg-muted/10 dark:text-slate-200",
          compact ? "h-11 px-3 text-sm" : "h-10 px-2.5 text-sm",
        )}
      >
        <ArrowLeft className="size-4 shrink-0" />
        <span className="truncate">Back to main dashboard</span>
      </Link>
      {sections.map((section) => {
        const Icon = section.icon;
        const selected = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-lg text-left font-bold transition",
              compact ? "h-11 px-3 text-sm" : "h-10 px-2.5 text-sm",
              selected
                ? "bg-[#FD5D28] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-[#FD5D28] dark:text-slate-300 dark:hover:bg-muted/10",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HelpPage() {
  const [activeSection, setActiveSection] = useState<HelpSection>("overview");
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [contactStatus, setContactStatus] = useState<{
    type: "success" | "error" | "loading";
    message: string;
  } | null>(null);

  const { data: authUser } = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: profileData } = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: !!authUser,
  });

  const activeMeta = useMemo(
    () => sections.find((section) => section.id === activeSection) ?? sections[0],
    [activeSection],
  );

  const profileName =
    (profileData?.profile?.full_name as string | undefined)?.trim() ||
    authUser?.user_metadata?.full_name?.trim?.() ||
    authUser?.user_metadata?.name?.trim?.() ||
    "";
  const firstName = profileName.split(/\s+/)[0] || "there";

  useEffect(() => {
    const openHelpSidebar = () => setHelpMenuOpen(true);
    window.addEventListener("toggle-help-sidebar", openHelpSidebar);
    return () => window.removeEventListener("toggle-help-sidebar", openHelpSidebar);
  }, []);

  const submitQuestion = async () => {
    if (!subject.trim() || !question.trim()) {
      setContactStatus({ type: "error", message: "Add a subject and question before sending." });
      toast.error("Add a subject and question before sending");
      return;
    }

    const toastId = toast.loading("Sending email...", {
      description: "Sending your question to hello@tellusjobs.site.",
    });
    setContactStatus({
      type: "loading",
      message: "Sending your question to hello@tellusjobs.site...",
    });
    setSendingQuestion(true);
    try {
      const [{ error }] = await Promise.all([
        supabase.functions.invoke("help-contact", {
          body: { subject: subject.trim(), message: question.trim() },
        }),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
      if (error) throw error;
      toast.success("Email sent", {
        id: toastId,
        description: "Your question was sent to hello@tellusjobs.site.",
      });
      setContactStatus({
        type: "success",
        message: "Email sent. Your question was sent to hello@tellusjobs.site.",
      });
      setSubject("");
      setQuestion("");
    } catch (err: unknown) {
      console.error("Help contact email failed:", err);
      const message =
        "We could not send your message right now. Please try again or email hello@tellusjobs.site directly.";
      toast.error("Could not send question", { id: toastId, description: message });
      setContactStatus({
        type: "error",
        message,
      });
    } finally {
      setSendingQuestion(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19]">
      {helpMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close help menu"
            onClick={() => setHelpMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,86vw)] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-border/10 dark:bg-[#0B0F19]">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200/70 px-4 py-4 dark:border-border/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FD5D28]">
                  Tellus Help
                </p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">
                  Help dashboard
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setHelpMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <HelpMenu
                activeSection={activeSection}
                compact
                onSelect={(section) => {
                  setActiveSection(section);
                  setHelpMenuOpen(false);
                }}
              />
            </div>
            <div className="shrink-0 border-t border-slate-200/70 p-4 dark:border-border/10">
              <a
                href="mailto:hello@tellusjobs.site"
                className="flex items-center gap-2 break-all text-xs font-bold text-[#FD5D28]"
              >
                <Mail className="size-4 shrink-0" />
                hello@tellusjobs.site
              </a>
            </div>
          </aside>
        </div>
      )}

      <header className="shrink-0 border-b border-slate-200/70 bg-white/90 backdrop-blur dark:border-border/10 dark:bg-[#0B0F19]/90">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between lg:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 h-10 w-10"
              aria-label="Open help menu"
              onClick={() => setHelpMenuOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Link
              to="/dashboard"
              className="text-xs font-black uppercase tracking-[0.18em] text-[#FD5D28]"
            >
              Main dashboard
            </Link>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 hidden items-center gap-2 text-[#FD5D28] lg:flex">
                <LifeBuoy className="size-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                  Tellus Help Center
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Help dashboard{firstName !== "there" ? ` for ${firstName}` : ""}
              </h1>
              <p className="mt-2 max-w-3xl text-[11px] font-medium leading-5 text-slate-500 dark:text-slate-400 sm:text-sm sm:leading-6">
                {firstName}, this guide explains what Tellus does, how each section works, and how
                you can contact support or send feedback.
              </p>
            </div>
            <a
              href="mailto:hello@tellusjobs.site"
              className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg border border-[#FD5D28]/25 bg-[#FD5D28]/10 px-2.5 text-xs font-bold text-[#FD5D28] transition hover:bg-[#FD5D28]/15 sm:h-10 sm:px-3 sm:text-sm"
            >
              <Mail className="size-4" />
              hello@tellusjobs.site
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-5 border-r border-slate-200/80 pr-3 dark:border-border/10">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Help menu
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Jump to a product area
                </p>
              </div>
              <ShieldCheck className="size-5 shrink-0 text-[#FD5D28]" />
            </div>

            <HelpMenu activeSection={activeSection} onSelect={setActiveSection} />
          </div>
        </aside>

        <section className="min-w-0 px-0 pb-12 sm:px-2">
          <div className="mb-5 border-b border-slate-200 pb-4 dark:border-border/10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FD5D28]">
              {activeMeta.label}
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white sm:text-xl">
              {activeSection === "overview" && "What Tellus is"}
              {activeSection === "start" && "How you should start"}
              {activeSection === "marketplace" && "Finding and managing jobs"}
              {activeSection === "applications" && "Preparing applications"}
              {activeSection === "cos" && "Career operating system"}
              {activeSection === "account" && "Account, referrals, and data"}
              {activeSection === "qa" && "Common questions"}
              {activeSection === "contact" && "Ask us a question"}
              {activeSection === "feedback" && "Send product feedback"}
            </h2>
          </div>

          {activeSection === "overview" && (
            <div className="space-y-5">
              <p className="max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                {firstName}, Tellus is built to make your job search less scattered. Instead of
                using one tool for job boards, another for CV edits, another for cover letters, and
                another for tracking applications, Tellus brings the workflow into one authenticated
                workspace.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Find better roles", "Use Marketplace and monitored sources to discover jobs."],
                  [
                    "Apply with context",
                    "Use your profile and job details to prepare stronger materials.",
                  ],
                  [
                    "Track the process",
                    "Keep saved roles, applications, follow-ups, and outcomes visible.",
                  ],
                ].map(([title, body]) => (
                  <article
                    key={title}
                    className="border-l-2 border-slate-200 py-1 pl-4 dark:border-border/20"
                  >
                    <Sparkles className="mb-3 size-4 text-[#FD5D28]" />
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {body}
                    </p>
                  </article>
                ))}
              </div>
              <div className="border-l-2 border-[#FD5D28] py-1 pl-4 text-[#9A3412] dark:text-orange-200">
                <ClipboardList className="mb-3 size-5 text-[#FD5D28]" />
                <p className="text-sm font-black">What the site does end to end</p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  Tellus helps you create a profile, browse jobs, understand role fit, generate
                  application materials, track applications, manage follow-ups, review analytics,
                  improve CV versions, ask for support, and provide feedback.
                </p>
              </div>
            </div>
          )}

          {activeSection === "start" && (
            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="flex gap-4 border-l-2 border-slate-200 py-1 pl-4 dark:border-border/20"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FD5D28] text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-950 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeSection === "marketplace" && (
            <div className="space-y-5">
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Marketplace is your main discovery area. It lets you scan listings, open job
                details, review match context, save roles, and move strong opportunities into their
                personal workflow.
              </p>
              <DetailList rows={marketplaceDetails} />
              <div className="grid gap-4 md:grid-cols-2">
                {featureGroups.slice(0, 2).map((group) => {
                  const Icon = group.icon;
                  return (
                    <article
                      key={group.title}
                      className="border-l-2 border-slate-200 py-1 pl-4 dark:border-border/20"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-[#FD5D28]/10 text-[#FD5D28]">
                          <Icon className="size-4" />
                        </div>
                        <h3 className="font-black text-slate-950 dark:text-white">{group.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {group.items.map((item) => (
                          <li
                            key={item}
                            className="flex gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300"
                          >
                            <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === "applications" && (
            <div className="space-y-5">
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                Application tools turn a job listing into usable material: cover letters, emails,
                form notes, interview preparation, and supporting application context.
              </p>
              <DetailList rows={applicationDetails} />
              <article className="border-l-2 border-slate-200 py-1 pl-4 dark:border-border/20">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="size-5 text-[#FD5D28]" />
                  <h3 className="font-black text-slate-950 dark:text-white">
                    What you should review
                  </h3>
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Generated material should be checked before sending. Tellus helps you draft and
                  organize, but you should confirm accuracy, tone, employer requirements, dates,
                  contact names, and any attachments before applying.
                </p>
              </article>
            </div>
          )}

          {activeSection === "cos" && (
            <div className="space-y-5">
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                The Career Operating System is your deeper workspace when you want to manage a full
                job-search campaign, not just browse listings.
              </p>
              <DetailList rows={cosDetails} />
              <div className="border-l-2 border-[#FD5D28]/50 py-1 pl-4">
                <GraduationCap className="mb-3 size-5 text-[#FD5D28]" />
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  How it fits together
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Pipeline, follow-ups, analytics, ATS checks, skills, salary, employers, learning,
                  and CV versions all support one goal: helping you make better decisions and keep
                  momentum through the job search.
                </p>
              </div>
            </div>
          )}

          {activeSection === "account" && (
            <div className="space-y-5">
              <DetailList
                rows={[
                  [
                    "Profile and CV",
                    "You can manage your profile, CV information, experience, education, skills, and role preferences.",
                  ],
                  [
                    "Settings",
                    "Settings contains profile controls, LinkedIn/source configuration, referral progress, and account options.",
                  ],
                  [
                    "Referrals",
                    "You receive a referral link and can track completed referrals that count toward upgraded usage limits.",
                  ],
                  [
                    "Privacy and account control",
                    "You can review account data workflows, export data where supported, and delete your account from settings.",
                  ],
                ]}
              />
              <article className="border-l-2 border-slate-200 py-1 pl-4 dark:border-border/20">
                <Users className="mb-3 size-5 text-[#FD5D28]" />
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  For your return visits
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  When you come back, use the dashboard as your command center: review saved jobs,
                  referral counts, recent activity, applications, and next steps before moving into
                  Marketplace or the Career Operating System.
                </p>
              </article>
            </div>
          )}

          {activeSection === "qa" && (
            <div className="divide-y divide-slate-200 dark:divide-border/10">
              {faqs.map((faq) => (
                <article key={faq.question} className="py-4 first:pt-0">
                  <h3 className="text-sm font-black text-slate-950 dark:text-white">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {faq.answer}
                  </p>
                </article>
              ))}
            </div>
          )}

          {activeSection === "contact" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitQuestion();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="help-subject">Subject</Label>
                  <Input
                    id="help-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value.slice(0, 120))}
                    placeholder="What do you need help with?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="help-question">Question</Label>
                  <Textarea
                    id="help-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value.slice(0, 2000))}
                    placeholder="Tell us what happened, what you expected, or what you want to understand."
                    rows={8}
                    className="min-h-[180px]"
                  />
                  <p className="text-[11px] font-medium text-slate-500">
                    {question.length}/2000 characters
                  </p>
                </div>
                <Button type="submit" disabled={sendingQuestion} className="gap-2">
                  {sendingQuestion ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {sendingQuestion ? "Sending email..." : "Send question"}
                </Button>
                {contactStatus && (
                  <p
                    className={cn(
                      "text-sm font-semibold leading-6",
                      contactStatus.type === "success" && "text-emerald-600 dark:text-emerald-400",
                      contactStatus.type === "error" && "text-destructive",
                      contactStatus.type === "loading" && "text-slate-500 dark:text-slate-400",
                    )}
                    role="status"
                    aria-live="polite"
                  >
                    {contactStatus.message}
                  </p>
                )}
              </form>
              <aside className="border-l-2 border-[#FD5D28]/50 py-1 pl-4">
                <Mail className="mb-3 size-5 text-[#FD5D28]" />
                <p className="text-sm font-black text-slate-950 dark:text-white">Contact email</p>
                <a
                  href="mailto:hello@tellusjobs.site"
                  className="mt-1 block break-all text-sm font-bold text-[#FD5D28] hover:underline"
                >
                  hello@tellusjobs.site
                </a>
                <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                  Form messages are emailed to this inbox with your account email attached for
                  replies.
                </p>
              </aside>
            </div>
          )}

          {activeSection === "feedback" && (
            <div className="space-y-5">
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Use this for product feedback, feature ideas, suggestions, or bugs. This is the same
                feedback form used elsewhere in Tellus, rendered here inside the Help Center.
              </p>
              <FeedbackForm userId={authUser?.id} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
