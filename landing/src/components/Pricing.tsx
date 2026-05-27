"use client";

import { ArrowRight } from "lucide-react";

export default function Pricing() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return (
    <section id="pricing" className="py-20 bg-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-brand-primary mb-3">Pricing & Limits</p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight text-slate-900 mb-4">
            100% Free. Supported by Community.
          </h2>
          <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
            We believe job hunting shouldn't cost you money. Tellus charges zero subscription fees—instead, invite others to unlock higher application limits.
          </p>
        </div>

        {/* Narrative Section 1: The Core Philosophy */}
        <div className="space-y-4 mb-16">
          <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900">
            Why Tellus Has No Subscription Packages
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Most job-search tools force candidates to pay monthly fees just to apply for vacancies or get keyword advice. We find this counterproductive: you shouldn't be charged when you are actively looking for income.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Tellus runs on a referral-based limits system. By inviting fellow job hunters to the platform, you help us grow organically without spending a single shilling. As our community expands, your daily crawling, CV parsing, and document staging limits scale automatically.
          </p>
        </div>

        {/* Narrative Section 2: Detailed Limit Levels */}
        <div className="space-y-10 mb-20">
          <h3 className="font-display font-bold text-xl sm:text-2xl text-slate-900 pb-3 border-b border-slate-200">
            Detailed Limit Tiers
          </h3>

          {/* Level 1: Starter */}
          <div className="grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest block mb-1">Level 01</span>
              <h4 className="font-display font-semibold text-lg text-slate-900">Starter Limits</h4>
              <p className="text-xs text-slate-400 mt-1">0 referrals required</p>
            </div>
            <div className="md:col-span-8 space-y-3">
              <p className="text-sm text-slate-500 leading-relaxed">
                Assigned automatically to everyone upon registration. The Starter tier provides everything you need to test our semantic job matcher and start automating your search in a controlled daily volume.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Upload and parse 1 active CV / Resume version</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Calculate semantic matching score (0-100%) for any vacancy</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Up to 5 crawler job matches delivered to your feed per day</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Generate up to 5 customized cover letter drafts per month</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Level 2: Explorer */}
          <div className="grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4">
              <span className="text-xs font-medium text-brand-primary uppercase tracking-widest block mb-1">Level 02</span>
              <h4 className="font-display font-semibold text-lg text-brand-primary">Explorer Limits</h4>
              <p className="text-xs text-brand-primary/70 mt-1">3 referrals required</p>
            </div>
            <div className="md:col-span-8 space-y-3">
              <p className="text-sm text-slate-500 leading-relaxed">
                Designed for active candidates applying to multiple positions per week. Inviting just 3 colleagues to join Tellus unlocks deeper compatibility insights, launches initial interview prep guidelines, and allows staging of personalized cover letters and email templates directly in your Gmail.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Upload and map up to 3 distinct CV versions (e.g., General, Technical, PM)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Full Semantic Match Reason breakdowns detailing requirement fits</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Generate up to 30 custom cover letters and email drafts per month</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Interview prep outline generator matching your milestones</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Automatic background staging directly inside your connected Gmail drafts folder</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Google Drive sync folder for automatic storage of tailored PDFs</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Level 3: Power User */}
          <div className="grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest block mb-1">Level 03</span>
              <h4 className="font-display font-semibold text-lg text-slate-900">Power User Limits</h4>
              <p className="text-xs text-slate-400 mt-1">10 referrals required</p>
            </div>
            <div className="md:col-span-8 space-y-3">
              <p className="text-sm text-slate-500 leading-relaxed">
                Unlocks the complete capabilities of our workflow pipeline with zero volume restrictions. Unlocks the crowning <strong>Smart Apply Mode</strong> and fully interactive <strong>Interview Simulator (Interview Mode)</strong> to mock-interview with real voice/text queries.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span><strong>Smart Apply Mode</strong> – send applications automatically via Gmail as soon as matches are found</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span><strong>Interview Simulator (Interview Mode)</strong> – full interactive mock interviews with tailored Q&As</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Upload unlimited CV versions and execute unlimited crawls</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Monitor custom corporate sites and specific enterprise directories</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Unlimited cover letters, introduction emails, and staged drafts</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-slate-300 mt-0.5 shrink-0">—</span>
                  <span>Priority crawler queueing for instant notifications when new jobs drop</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Narrative Section 3: Step-by-Step Flow */}
        <div className="py-12 border-y border-slate-100 mb-16">
          <div className="text-center mb-10">
            <h3 className="font-display font-bold text-xl text-slate-900">
              How to Invite & Upgrade
            </h3>
            <p className="text-slate-500 text-sm mt-2">
              Follow these simple steps in your dashboard to invite colleagues.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8">
            <div className="space-y-2 text-center sm:text-left">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-xs mx-auto sm:mx-0">
                01
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Copy Referral Link</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in and grab your unique personal sharing URL from the Tellus settings workspace.
              </p>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-xs mx-auto sm:mx-0">
                02
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Share with Colleagues</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send the link to friends, class cohorts, or professional groups looking for work.
              </p>
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-medium text-xs mx-auto sm:mx-0">
                03
              </div>
              <h4 className="font-semibold text-slate-800 text-sm">Instant Upgrade</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                As soon as they register, your account limit upgrades instantly in our system.
              </p>
            </div>
          </div>
        </div>

        {/* Narrative Section 4: Final CTA */}
        <div className="text-center space-y-5">
          <h3 className="font-display font-bold text-xl text-slate-900">
            Ready to Automate Your Job Hunt?
          </h3>
          <p className="text-slate-500 text-sm max-w-lg mx-auto leading-relaxed">
            Create your free account today, parse your first CV, and start matching opportunities across the web instantly.
          </p>
          <div className="flex justify-center">
            <a
              href={`${appUrl}/login`}
              className="inline-flex items-center gap-1.5 px-7 py-3.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white font-medium text-sm transition-all"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}
