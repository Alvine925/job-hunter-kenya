import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type CosPageId =
  | "pipeline"
  | "skills-hub"
  | "predict"
  | "analytics"
  | "cv-versions"
  | "ats-score"
  | "career-path"
  | "employers"
  | "follow-ups"
  | "learning"
  | "salary";

interface LearnMoreSliderProps {
  pageId: CosPageId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return "there";
  const first = fullName.trim().split(/\s+/)[0];
  return first || "there";
}

function getContent(pageId: CosPageId, firstName: string): { title: string; sections: { heading: string; body: string }[] } {
  const contents: Record<CosPageId, { title: string; sections: { heading: string; body: string }[] }> = {
    pipeline: {
      title: "About Pipeline CRM",
      sections: [
        {
          heading: "What is the Pipeline CRM?",
          body: `Hey ${firstName}, the Pipeline CRM is your personal job application tracker built right into Tellus. Think of it as a Kanban board — like Trello — but designed specifically for your job search. Every position you're pursuing lives here as a card, moving through stages from "Applied" all the way to "Accepted" or "Rejected."`,
        },
        {
          heading: "What does it do?",
          body: `It gives you a bird's-eye view of exactly where every application stands. Instead of losing track of which companies you've applied to, which interviews are coming up, and which offers you're weighing, the Pipeline CRM keeps everything in one place. You can drag and drop cards between stages, add negotiation notes, track salary details, and log next actions so nothing falls through the cracks.`,
        },
        {
          heading: "How to use it",
          body: `Start by clicking "Add Job Card" in the top right to create a new entry. Fill in the job title, company, location, salary range, and any initial notes. The card will land in whichever stage you choose. As your application progresses, simply drag the card to the next stage — from Applied to Interviewing, then to Negotiating or Offer Received. Click any card to open its details, update your notes, or change its stage. You can also delete cards you no longer need.`,
        },
        {
          heading: "Why should you use it?",
          body: `${firstName}, job hunting is stressful enough without trying to remember which company emailed you back and which one ghosted you. The Pipeline CRM removes that mental load. When you have five, ten, or twenty applications running simultaneously, this board becomes your command center. Recruiters respect candidates who are organized, and this tool makes sure you never miss a follow-up window or forget an important detail from a previous conversation.`,
        },
        {
          heading: "Pro tips",
          body: `Use the search bar to quickly find a specific company or role. If you're just getting started and want to see how the board looks with data, hit the "Seed Demo Jobs" button to load sample entries. Write detailed notes after every interview — future you will thank present you. And if a position goes cold, move it to Rejected/Closed so your active board stays clean and actionable.`,
        },
      ],
    },

    "skills-hub": {
      title: "About Skills Hub",
      sections: [
        {
          heading: "What is the Skills Hub?",
          body: `${firstName}, the Skills Hub is your professional skills inventory paired with a live market gap analyzer. It's the place where you can see exactly what you bring to the table and, just as importantly, what the market is asking for that you might be missing.`,
        },
        {
          heading: "What does it do?",
          body: `It does two things simultaneously. First, it stores and displays the skills you've registered in your profile — your core competencies that go on your CV. Second, it scans up to 250 of the most recent job listings in the database, parses through their descriptions and requirements, and calculates which skills are appearing most frequently. It then cross-references those high-demand skills against your profile to show you your real-time skill gaps.`,
        },
        {
          heading: "How to use it",
          body: `Your current skills are listed on the left side of the page. You can add new skills using the input field at the bottom — just type the skill name and click "Add Skill." To remove a skill that's no longer relevant, click the trash icon next to it. On the right, you'll find two sections: your aggregate skill gaps (skills that appear frequently in job posts but aren't in your profile) and the most sought-after skills in the market ranked by how many job listings mention them.`,
        },
        {
          heading: "Why should you use it?",
          body: `The job market moves fast, ${firstName}. A skill that was "nice to have" six months ago might be a hard requirement today. The Skills Hub keeps you aware of where the market is heading so you can invest your learning time wisely. If Docker shows up in 84% of listings and it's missing from your profile, that's a clear signal. It turns vague career anxiety into specific, actionable intelligence.`,
        },
        {
          heading: "Pro tips",
          body: `Check back weekly to see how demand frequencies shift as new jobs get scraped. Pay special attention to skills marked "High" in the gaps section — closing even one of those gaps can meaningfully improve your match scores across dozens of job listings. And don't forget to add soft skills too. Project Management, Agile, and Stakeholder Communication are tracked just the same as technical ones.`,
        },
      ],
    },

    predict: {
      title: "About Success Predictor",
      sections: [
        {
          heading: "What is the Success Predictor?",
          body: `${firstName}, the Success Predictor is a tool that estimates how likely you are to get a positive response when you apply for a specific role at a specific company. It uses your actual profile data — your skills, location preferences, salary expectations, and remote work preferences — and compares them against real job listings in the database.`,
        },
        {
          heading: "What does it do?",
          body: `When you enter a target role title, company, salary expectation, and remote preference, the predictor searches the scraped jobs database for matching listings. It then runs four calculations: how many of your skills appear in those job descriptions (Skills Match), whether the jobs are in your preferred location (Location Fit), whether the salary ranges align with your expectation (Salary Alignment), and whether the remote/hybrid/onsite setup matches your preference. Each factor produces a weighted score, and the final number tells you your predicted success rate.`,
        },
        {
          heading: "How to use it",
          body: `Fill in the four fields — Role Title, Company (optional), Monthly Salary Expectation, and Remote Preference — then click "Run Prediction." The system will scan matching jobs and return a breakdown of each scoring factor. The overall score gives you a quick read, and the individual breakdowns tell you exactly where your application is strong and where it needs work.`,
        },
        {
          heading: "Why should you use it?",
          body: `Because applying blindly is a waste of your time, ${firstName}. If you know ahead of time that your skills only overlap 40% with what employers are asking for, you can either upskill before applying or focus your energy on roles where you match at 80% or above. It's about being strategic instead of just throwing CVs at the wall and hoping something sticks.`,
        },
        {
          heading: "Pro tips",
          body: `Run the predictor for several different role titles to see which job categories give you the highest baseline match. If your salary expectation is pulling your score down, consider whether there's flexibility. And use the skill gap insights here to feed directly into the Skills Hub and Learning Roadmap — close the gaps the predictor identifies and your score goes up next time you check.`,
        },
      ],
    },

    analytics: {
      title: "About Conversion Analytics",
      sections: [
        {
          heading: "What is Conversion Analytics?",
          body: `${firstName}, Conversion Analytics is your performance dashboard for job hunting. It takes all of your application data — every CV you've sent, every interview you've landed, every offer you've received — and turns it into visual metrics so you can see exactly how effective your job search strategy is.`,
        },
        {
          heading: "What does it do?",
          body: `It computes four key metrics: your total applications, response rate, interview conversion rate, and offer rate. Beyond the headline numbers, it generates charts that show your application velocity over time (how many applications and interviews you're getting each week), which CV versions are performing best, which industries are responding most, and which job titles convert at the highest rates. Everything is pulled directly from your applications and jobs database tables.`,
        },
        {
          heading: "How to use it",
          body: `Simply navigate to this page and your data loads automatically. Use the time range dropdown in the top right to focus on the last 30 days, 60 days, or 6 months. Review the funnel at the top to see where candidates typically drop off. Then scroll down to examine the velocity chart, CV performance pie chart, industry response rates, and job title conversion bars. Each section tells a different part of the story.`,
        },
        {
          heading: "Why should you use it?",
          body: `Without data, you're guessing. Maybe you think your CV is great, but if you've sent it 30 times and only gotten 2 responses, the numbers are telling a different story. Conversion Analytics helps you spot problems early. If your response rate drops, maybe your CV needs updating. If one industry consistently responds while another doesn't, focus your efforts where they're working. This is how professional recruiters think, and now you have the same tools.`,
        },
        {
          heading: "Pro tips",
          body: `Check this page at least once a week, ${firstName}. Trends are more useful than snapshots. If you see your interview rate climbing over three weeks, whatever you changed is working — keep doing it. If a specific CV variant has a 45% response rate while another has 15%, retire the underperformer. The data doesn't lie, and small adjustments compound over time.`,
        },
      ],
    },

    "cv-versions": {
      title: "About CV Versions",
      sections: [
        {
          heading: "What is CV Versions?",
          body: `${firstName}, CV Versions is your resume asset library. It tracks every version of your CV — your primary default resume and every tailored variant you've created for specific applications — in one organized registry.`,
        },
        {
          heading: "What does it do?",
          body: `It pulls your default CV from your profile and then scans all of your submitted applications to find every unique tailored CV you've used. For each version, it shows you how many times you've dispatched it, what response rate it's achieved, and when it was first used. This gives you a clear picture of which resume versions are performing and which ones might need reworking.`,
        },
        {
          heading: "How to use it",
          body: `The page loads automatically with your CV data. Your primary CV appears at the top, marked with a "Default" tag. Below it, you'll see all tailored variants extracted from your application submissions. Each entry shows the filename, the number of applications it's been used for, and its response rate percentage. Use these insights to decide which versions to keep using and which to revise.`,
        },
        {
          heading: "Why should you use it?",
          body: `Most job seekers create one CV and use it everywhere. That approach leaves a lot of interviews on the table. By maintaining multiple versions — one optimized for product roles, another for engineering positions, a third for NGO consulting — you dramatically increase your relevance for each application. This page makes it easy to see whether that effort is actually paying off.`,
        },
        {
          heading: "Pro tips",
          body: `If a CV variant has been dispatched more than 5 times with a 0% response rate, it's time to rewrite it, ${firstName}. Compare your best-performing version against your worst and look for differences in keyword usage, formatting, and summary statement. Over time, your library of battle-tested CVs becomes one of your most valuable career assets.`,
        },
      ],
    },

    "ats-score": {
      title: "About ATS Optimizer",
      sections: [
        {
          heading: "What is the ATS Optimizer?",
          body: `${firstName}, the ATS Optimizer checks how well your resume would perform when processed by an Applicant Tracking System. Most large companies in Kenya — Safaricom, Equity Bank, UN agencies — use ATS software to automatically filter resumes before a human ever sees them. If your CV isn't formatted and keyworded correctly, it gets rejected before anyone reads it.`,
        },
        {
          heading: "What does it do?",
          body: `It takes your CV text and a target job description, then runs a keyword matching analysis. It identifies which important keywords from the job description appear in your CV and which ones are missing. It also evaluates your CV length and structure. The result is a compatibility score from 0 to 100, along with a detailed list of matched keywords, missing keywords, and specific recommendations for improvement.`,
        },
        {
          heading: "How to use it",
          body: `Paste your CV text into the left field (or click "Load from Profile" to auto-fill from your saved profile summary and skills). Then paste the job description into the right field. Click "Run ATS Analysis" and wait a few seconds. You'll get a score breakdown showing your overall ATS compatibility, the keywords you matched, the ones you're missing, and clear action items to improve your score.`,
        },
        {
          heading: "Why should you use it?",
          body: `Because you could be the perfect candidate and still get rejected if the ATS can't parse your resume properly. This happens more often than people think, ${firstName}. Running your CV through this optimizer before submitting ensures you're not getting filtered out by a machine. It takes two minutes and can be the difference between landing an interview and hearing nothing back.`,
        },
        {
          heading: "Pro tips",
          body: `Run this check for every job you're seriously considering. Each job description has different keywords, and what scored 90% for one listing might only score 60% for another. Focus on naturally incorporating the missing keywords into your experience descriptions — don't just stuff them in. ATS systems are getting smarter, and so should your approach.`,
        },
      ],
    },

    "career-path": {
      title: "About Career Path Tracker",
      sections: [
        {
          heading: "What is the Career Path Tracker?",
          body: `${firstName}, the Career Path Tracker is an interactive progression planner that maps out where you are in your career and the steps you need to take to reach the next level. It covers both the technical specialist track and the engineering management track, with salary benchmarks calibrated for the Kenyan market.`,
        },
        {
          heading: "What does it do?",
          body: `It lays out a clear timeline of career progression nodes — from your current role through to senior, staff-level, and director-level positions. For each step, it shows the expected salary range, the typical time it takes to reach that level, the key skills and milestones you need, and a description of what the role actually involves day to day. You can toggle between the Technical Specialist track and the Engineering Management track to explore both paths.`,
        },
        {
          heading: "How to use it",
          body: `Use the toggle at the top to switch between the tech and management tracks. Click on any progression node in the timeline on the left to see its full details on the right — including required skills, salary bands, and role responsibilities. Compare the requirements at each level to your current skill set to understand exactly what you need to develop.`,
        },
        {
          heading: "Why should you use it?",
          body: `Career growth doesn't happen by accident. Without a map, you might spend years doing the same kind of work without building the skills that unlock the next level. This tracker shows you the specific capabilities that separate a mid-level engineer from a senior one, or a team lead from an engineering manager. Once you see the gaps, you can close them deliberately through projects, courses, and stretch assignments.`,
        },
        {
          heading: "Pro tips",
          body: `Don't just look at the next step, ${firstName} — look two steps ahead. The skills required at the Staff Engineer or Director level take years to develop, and the earlier you start building them, the smoother your progression will be. Use the required skills lists here to inform what you add to your Skills Hub and which courses you pursue in the Learning Roadmap.`,
        },
      ],
    },

    employers: {
      title: "About Employer Intel",
      sections: [
        {
          heading: "What is Employer Intel?",
          body: `${firstName}, Employer Intel is your behind-the-scenes directory of major Kenyan employers. It gives you the kind of information that usually only comes from knowing someone inside the company — what their interview process looks like, how many rounds to expect, what questions they typically ask, and how hard the process is rated.`,
        },
        {
          heading: "What does it do?",
          body: `For each employer in the directory, it provides a detailed profile including their industry, location, interview round structure, difficulty rating, commonly asked interview questions, and insider tips for how to succeed. This isn't generic advice — it's specific to each company's known hiring practices.`,
        },
        {
          heading: "How to use it",
          body: `Browse the list or use the search bar to find a specific company. Click on any employer to expand their full profile. Before your interview, study the common questions listed and prepare structured answers. Read the tips section to understand what the company values most in candidates. If you're deciding between opportunities, compare the difficulty ratings and interview structures to gauge how much preparation each one requires.`,
        },
        {
          heading: "Why should you use it?",
          body: `Preparation is the single biggest differentiator in interviews. Candidates who know what to expect outperform those who walk in cold. If you know that Safaricom asks about M-Pesa scalability in their technical panel, you can prepare a compelling answer in advance. If you know the UN uses competency-based interviewing, you can structure your stories around their exact framework. This kind of targeted preparation is what separates offers from rejection emails.`,
        },
        {
          heading: "Pro tips",
          body: `Check this section as soon as you get an interview invitation, ${firstName}. Even twenty minutes of targeted preparation using these profiles will put you ahead of most other candidates. Practice your answers out loud — reading them silently is not the same as saying them under pressure.`,
        },
      ],
    },

    "follow-ups": {
      title: "About Follow-Ups",
      sections: [
        {
          heading: "What is Follow-Ups?",
          body: `${firstName}, Follow-Ups is your professional email template engine and action planner. It helps you write polished follow-up emails for every stage of the job application process — from checking in on a submitted application to thanking interviewers to negotiating an offer.`,
        },
        {
          heading: "What does it do?",
          body: `It provides three pre-written, professional email templates: an Application Check-In for when you haven't heard back, a Post-Interview Thank You for right after an interview, and an Offer Counter-Proposal for salary negotiations. Each template is formatted with proper business email etiquette and has placeholder fields for you to customize. It also tracks which of your applications have gone idle and need follow-up attention.`,
        },
        {
          heading: "How to use it",
          body: `Select a template from the tabs at the top. The full email body appears below with placeholders like [Job Title], [Company Name], and [Recruiter Name] that you replace with actual details. Click the copy button to copy the entire email to your clipboard, then paste it into your email client. The idle applications section shows which positions haven't had any activity recently, so you know which ones need a nudge.`,
        },
        {
          heading: "Why should you use it?",
          body: `Following up is one of the most effective yet underused job search tactics. Studies consistently show that candidates who follow up professionally have significantly higher response rates. But writing the right email is tricky — too pushy and you annoy the recruiter, too timid and your message gets ignored. These templates strike the perfect balance, and they're written in a tone that works well in the Kenyan professional context.`,
        },
        {
          heading: "Pro tips",
          body: `Send a thank-you email within 24 hours of every interview, ${firstName}. For application check-ins, wait at least 7-10 business days after applying before sending your first follow-up. Personalize every template — generic copy-paste emails are easy to spot. And always proofread before sending. One typo in a follow-up email can undo the great impression you made in the interview.`,
        },
      ],
    },

    learning: {
      title: "About Learning Roadmap",
      sections: [
        {
          heading: "What is the Learning Roadmap?",
          body: `${firstName}, the Learning Roadmap is your structured plan for closing skill gaps and earning the competencies you need for your next career move. It curates relevant courses and certifications linked to the skills that matter most in the current job market.`,
        },
        {
          heading: "What does it do?",
          body: `It presents a list of recommended courses, each tied to a specific skill gap. For each course, you can see the title, source platform, estimated duration, and which skill it addresses. When you complete a course, marking it as done automatically adds the associated skill to your profile — which immediately improves your match scores across all job listings.`,
        },
        {
          heading: "How to use it",
          body: `Browse the course list and click the external link icon to go to the course page on the source platform. Work through the material at your own pace. When you finish, click the "Mark Complete" button. This does two things: it tracks your progress visually and it adds the skill to your Tellus profile. You can see your completion percentage at the top of the page.`,
        },
        {
          heading: "Why should you use it?",
          body: `The courses listed here aren't random recommendations. They're selected based on what the market is actually demanding. When the Skills Hub shows that Docker appears in 84% of job listings and it's missing from your profile, the Learning Roadmap provides the exact course to close that gap. It's the bridge between knowing what you need to learn and actually learning it.`,
        },
        {
          heading: "Pro tips",
          body: `Don't try to complete everything at once, ${firstName}. Pick one or two high-priority skills — the ones that appear most frequently in jobs you're targeting — and focus on those first. Even completing a single course and adding the skill to your profile can noticeably improve your match rates. Consistency beats intensity: 30 minutes daily is more effective than a weekend marathon.`,
        },
      ],
    },

    salary: {
      title: "About Salary Intel",
      sections: [
        {
          heading: "What is Salary Intel?",
          body: `${firstName}, Salary Intel is your salary research and negotiation toolkit. It combines Kenyan market salary benchmarks, a PAYE tax calculator, and a structured negotiation worksheet to help you understand what you should be earning and how to ask for it.`,
        },
        {
          heading: "What does it do?",
          body: `Three things. First, it shows you salary benchmarks for common roles in the Kenyan market — both for Nairobi-based positions and remote/international roles. Second, it includes a Kenya PAYE tax calculator that instantly shows your take-home pay from any gross salary figure, including NHIF and NSSF deductions. Third, it provides a negotiation worksheet where you can set your target salary, reserve salary, and list the perks that matter to you, creating a clear framework for salary discussions.`,
        },
        {
          heading: "How to use it",
          body: `Start with the benchmarks table to understand where your target role falls in the market. Then use the tax calculator — enter your gross monthly salary and the system instantly computes your PAYE tax, NHIF, NSSF, and net take-home pay. Finally, fill in the negotiation worksheet with your target number, your walk-away number, and the non-salary perks you want to negotiate. Having these numbers clear before you enter a negotiation gives you confidence and prevents you from making decisions under pressure.`,
        },
        {
          heading: "Why should you use it?",
          body: `Salary negotiation is one of the highest-leverage activities in your career. A 10% increase negotiated today compounds over every future raise, bonus, and pension contribution for the rest of your working life. But most people negotiate poorly because they don't know the market rate, don't understand their actual take-home pay, and don't have a clear strategy. This tool solves all three problems.`,
        },
        {
          heading: "Pro tips",
          body: `Never give your number first in a negotiation — let the employer state their range, ${firstName}. Use the benchmarks here to know if their offer is fair. Always negotiate based on gross salary since that's what determines your pension and severance calculations. And remember that perks have real monetary value: health insurance, remote days, and additional leave days are worth real money even if they don't show up on your payslip.`,
        },
      ],
    },
  };

  return contents[pageId];
}

export function LearnMoreSlider({ pageId, open, onOpenChange }: LearnMoreSliderProps) {
  const { data: profile } = useQuery({
    queryKey: ["profile-learn-more"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();
      return prof;
    },
    staleTime: 10 * 60_000,
  });

  const firstName = getFirstName(profile?.full_name);
  const content = getContent(pageId, firstName);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg overflow-y-auto bg-white dark:bg-slate-950 border-l border-border/40 p-0"
      >
        <div className="px-6 pt-8 pb-10 space-y-8">
          <SheetHeader className="text-left space-y-2 pr-6">
            <SheetTitle className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight leading-snug">
              {content.title}
            </SheetTitle>
            <SheetDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              A detailed guide to help you get the most out of this section.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-7">
            {content.sections.map((section, i) => (
              <div key={i} className="space-y-2">
                <h3 className="text-sm font-bold text-foreground leading-snug">
                  {section.heading}
                </h3>
                <p className="text-[13px] sm:text-sm text-muted-foreground leading-relaxed font-normal">
                  {section.body}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border/20">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              Still have questions? You can always come back to this guide anytime by clicking the "Learn more" link at the top of this page. For any inquiries and concerns, feel free to send an email to <a href="mailto:hello@tellusjobs.site" className="text-primary hover:underline font-semibold">hello@tellusjobs.site</a>.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Small inline link you drop into page headers — opens the slider. */
export function LearnMoreLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] sm:text-xs font-semibold text-primary/80 hover:text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors cursor-pointer"
    >
      Learn more
    </button>
  );
}
