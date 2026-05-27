import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "The Problem & Solution | Tellus Kenya - Manual Job Hunting vs Automation",
  description: "Understand the challenges of modern job hunting in Kenya and how Tellus streamlines vacancy aggregation, profile matching, and document staging.",
  alternates: {
    canonical: "/problem-solution",
  },
};

export default function ProblemSolutionPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-20">
            <h1 className="font-display font-semibold text-3xl sm:text-5xl lg:text-6xl text-slate-900 tracking-tight mb-4">
              The Realities of the Kenyan Job Hunt
            </h1>
            <p className="text-slate-600 text-base sm:text-lg font-normal max-w-2xl mx-auto">
              How Tellus eliminates the manual grind of visiting multiple sites, tailoring documents, and tracking applications.
            </p>
          </div>

          {/* Section 1: Detailed Problems */}
          <div className="grid md:grid-cols-12 gap-12 items-start py-12 border-b border-slate-100">
            <div className="md:col-span-7 space-y-6">
              <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">The Manual Job Search Friction</span>
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">
                The Daily Time-Drain of Job Hunting
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
                Applying for jobs has become a full-time, unpaid role. Between jumping across multiple job sites and search platforms, candidates face endless repetitive loops and friction.
              </p>
              
              <div className="space-y-6 font-normal text-xs sm:text-sm text-slate-500">
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">1. Tab Overload & Duplicate Scouring</h4>
                  <p className="leading-relaxed">
                    You spend 2–3 hours every day visiting different job sites. You face duplicate postings, broken links, constant account registration walls, and easily lose track of what you've already viewed.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">2. The "30-Minute Tailoring" Trap</h4>
                  <p className="leading-relaxed">
                    Recruiters reject generic submissions. To stand out, you spend 30 to 45 minutes rewriting your CV profile summary, customizing your cover letter, and drafting a cold email for *each* position. By the third application, you are completely burned out.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">3. The ATS "Black Hole" Filter</h4>
                  <p className="leading-relaxed">
                    Corporate portals use automated tracking parsers (ATS) that scan incoming PDFs. If your CV lacks the exact phrasing of their hidden keywords or uses a visual layout the machine can't parse, you get instantly filtered out without a human ever seeing your profile.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">4. Repetitive Portal Web Forms (Form Fatigue)</h4>
                  <p className="leading-relaxed">
                    Uploading your CV is rarely enough. Almost every employer portal forces you to manually type your job history, education details, certificates, and references into dozens of empty input boxes. It takes 15–20 minutes of tedious typing per portal submission.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">5. Tracking Chaos & Ghosting</h4>
                  <p className="leading-relaxed">
                    Managing your pipeline in Excel sheets is messy. You forget who you applied to, which CV version you attached, and miss follow-up opportunities because you can't trace your application history.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">6. Missing Hidden Career Portals</h4>
                  <p className="leading-relaxed">
                    Many top employers don't post open roles on public job boards. They list them exclusively on their private corporate portals, which are impossible to monitor manually every day.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">7. Dead Links & Ghost Postings</h4>
                  <p className="leading-relaxed">
                    A massive chunk of listings on aggregated job sites are "ghost jobs"—outdated postings, closed roles that portals leave active for traffic, or third-party listings that direct you to spammy marketing lists instead of actual recruiters.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">8. Blind Interview Anxiety</h4>
                  <p className="leading-relaxed">
                    When you finally land an interview, you have to scrape together prep notes under tight timelines, guessing what technical questions recruiters will ask about the specific role description which might have already been taken down online.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Image Right */}
            <div className="md:col-span-5 flex justify-center sticky top-24 pt-12">
              <img
                src="/cv_parser_insight.png"
                alt="CV Parsing Skill Mapping Illustration"
                className="max-w-full h-auto aspect-square object-contain"
              />
            </div>
          </div>

          {/* Section 2: Tellus Solutions */}
          <div className="grid md:grid-cols-12 gap-12 items-start py-16 border-b border-slate-100">
            {/* Image Left */}
            <div className="md:col-span-5 flex justify-center sticky top-24 pt-12">
              <img
                src="/match_funnel_insight.png"
                alt="Job Matching Funnel Illustration"
                className="max-w-full h-auto aspect-square object-contain"
              />
            </div>
            
            <div className="md:col-span-7 space-y-6">
              <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">Automatic Execution</span>
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">
                Automatic Matching & Ready-to-Send Applications
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
                Tellus was built to automate the entire funnel. We don't just consolidate links; we run the matching checks, customize documents, and stage the application deliverables for you automatically.
              </p>
              
              <div className="space-y-6 font-normal text-xs sm:text-sm text-slate-500">
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">1. Automatic Job Scraping & Aggregation</h4>
                  <p className="leading-relaxed">
                    Tellus crawler instances run in the background every morning. As soon as a job drops on general sites or company pages, Tellus pulls it in and indexes it, giving you a clean, real-time feed without tab clutter.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">2. Instant Application Pack Delivery</h4>
                  <p className="leading-relaxed">
                    For every match, Tellus automatically writes a tailored cover letter, constructs an updated resume objective, stages a complete email draft inside your connected Gmail, and backs up the assets to your Google Drive.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">3. ATS-Ready Resume Optimization</h4>
                  <p className="leading-relaxed">
                    Tellus reads target job postings and matches your CV phrasing against recruiters' screening filters. It reformats the document using clean, parseable text styles, ensuring your resume passes automated filters and lands in human hands.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">4. Automated Application Dispatch & Auto-Fill</h4>
                  <p className="leading-relaxed">
                    Say goodbye to manual form fatigue. Tellus organizes your core qualifications, work history, and references into a structured profile, then auto-populates portal registration pages and multi-step web forms with a click.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">5. Complete One-Click Control & Archiving</h4>
                  <p className="leading-relaxed">
                    No copy-pasting required. Review the pre-staged Gmail draft, make any final edits you wish, and apply in one click. Tellus tracks the submission date and backs up files in structured folders in your Drive.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">6. Custom Company Portal Monitors</h4>
                  <p className="leading-relaxed">
                    Add specific corporate portals (like telecommunications, banking, or logistics domains) to your monitoring list. Tellus scrapes these custom portals automatically, bypassing standard board lists.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">7. Active Status Verification & Expiry Filters</h4>
                  <p className="leading-relaxed">
                    Tellus filters out the noise. Our algorithms automatically verify each vacancy, check if the listing is active on the host portal, and instantly filter out outdated, closed, or duplicated ghost listings.
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-900 text-sm">8. Automatic Interview Coaching Guides</h4>
                  <p className="leading-relaxed">
                    Along with your application pack, Tellus generates anticipated technical interview questions and tailored suggestions based on your resume, so you are always prepped.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Manual vs. Tellus Side-by-Side Comparison */}
          <div className="py-16 border-b border-slate-100">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">Side-by-Side Comparison</span>
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight mt-2">
                Manual Search vs. Tellus Automation
              </h2>
              <p className="text-slate-500 text-sm font-normal mt-2">
                A direct look at the efficiency gap across every stage of the Kenyan job hunt.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm font-normal">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-900">
                    <th className="py-4 pr-4 font-semibold">Job Hunt Phase</th>
                    <th className="py-4 px-4 font-semibold text-slate-500">The Manual Grind</th>
                    <th className="py-4 pl-4 font-semibold text-brand-primary">The Tellus Way</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Discovery</td>
                    <td className="py-5 px-4">Searching multiple job sites manually, scrolling past expired links and duplicate postings.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">Automated daily crawler scrapes consolidated into a single unified workspace.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Compatibility Check</td>
                    <td className="py-5 px-4">Reading complex lists of requirements, guessing if you are qualified or match keywords.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">Instant 0-100% semantic matching score with structured pros/cons list.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Resume Customization</td>
                    <td className="py-5 px-4">Spending 30 mins tailoring your summary and bullet points for each different role.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">AI generates customized objective statements matching the JD in 5 seconds.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Cover Letter Writing</td>
                    <td className="py-5 px-4">Drafting a unique covering letter from scratch, hoping to strike the right professional tone.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">Auto-generated role-specific cover letter tailored to your experience.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Form Filling</td>
                    <td className="py-5 px-4">Manually typing your work and education details into company-specific career portals.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">One-click auto-fill options for portals using your verified profile data.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Pipeline Tracking</td>
                    <td className="py-5 px-4">Maintaining spreadsheets, forgetting which CV version was sent, losing track of deadlines.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">Automated dashboard tracking with organized, structured folders in Google Drive.</td>
                  </tr>
                  <tr>
                    <td className="py-5 pr-4 font-semibold text-slate-900">Interview Preparation</td>
                    <td className="py-5 px-4">Searching for old job specs that might be offline, guessing technical interview questions.</td>
                    <td className="py-5 pl-4 font-medium text-brand-primary">Permanent record of original JD and customized coaching guides with mock QA.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Key Job Hunt Metrics */}
          <div className="py-16 space-y-10">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                The Application Speed Gap
              </h2>
              <p className="text-slate-500 text-sm font-normal mt-2">
                Real statistics driving Tellus's automation development.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <p className="text-4xl font-semibold text-brand-primary">48 Hours</p>
                <h4 className="font-semibold text-sm text-slate-900">Recruitment Window</h4>
                <p className="text-xs text-slate-500 font-normal leading-relaxed">
                  85% of high-quality roles on top job sites receive the bulk of their qualified candidates within the first two days of posting.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-4xl font-semibold text-brand-primary">80+</p>
                <h4 className="font-semibold text-sm text-slate-900">Average Applications</h4>
                <p className="text-xs text-slate-500 font-normal leading-relaxed">
                  The number of submissions required for an active candidate to secure a single interview using manual application pipelines.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-4xl font-semibold text-brand-primary">5 Minutes</p>
                <h4 className="font-semibold text-sm text-slate-900">Tellus Pipeline Speed</h4>
                <p className="text-xs text-slate-500 font-normal leading-relaxed">
                  The average duration to scrape, score, tailor application packages, and stage Gmail drafts using the Tellus AI Copilot.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
