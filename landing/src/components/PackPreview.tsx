"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Mail, User, ShieldQuestion, Send } from "lucide-react";

type TabId = "letter" | "cv" | "email" | "prep";

export default function PackPreview() {
  const [activeTab, setActiveTab] = useState<TabId>("letter");

  const tabs = [
    { id: "letter", label: "Cover Letter", icon: <FileText className="w-4 h-4" /> },
    { id: "cv", label: "CV Profile Summary", icon: <User className="w-4 h-4" /> },
    { id: "email", label: "Gmail Draft", icon: <Mail className="w-4 h-4" /> },
    { id: "prep", label: "Interview Prep", icon: <ShieldQuestion className="w-4 h-4" /> },
  ];

  const content = {
    letter: (
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed py-6">
        <p className="text-slate-400 text-xs">May 26, 2026</p>
        <p className="text-slate-800">
          Hiring Committee<br />
          Enterprise Partner<br />
          Nairobi, Kenya
        </p>
        <p className="text-brand-primary font-medium text-xs uppercase tracking-wide">RE: APPLICATION FOR SENIOR FULL STACK ENGINEER</p>
        <p>Dear Hiring Committee,</p>
        <p>
          I am writing to express my strong interest in the Senior Full Stack Engineer role at your enterprise, as scraped from your career portal. With over 4 years of software development experience specializing in Next.js, React, and TypeScript, I have built highly scalable SaaS applications that align perfectly with your technical expectations.
        </p>
        <p>
          In my previous roles, I optimized server-side rendering pipelines which reduced page load times by 40% and led integration workflows for complex backend APIs. My hands-on skills in Docker and PostgreSQL match your commitment to building highly resilient digital ecosystems.
        </p>
        <p>
          Thank you for your consideration. I look forward to discussing how my background fits your objectives.
        </p>
        <p className="pt-1">
          Sincerely,<br />
          <span className="font-medium text-slate-800">Alex Mwangi</span>
        </p>
      </div>
    ),
    cv: (
      <div className="space-y-6 py-6">
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Career Objective</h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            &ldquo;Result-driven Software Engineer with extensive experience designing SaaS platforms using React, Next.js, and TypeScript. Demonstrated competence in setting up database architectures with PostgreSQL and orchestrating cloud deployments with Docker. Highly skilled in collaborating with cross-functional product teams to deliver high-performance solutions matching your engineering guidelines.&rdquo;
          </p>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Achievements</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="text-slate-300 mt-1.5 shrink-0">—</span>
              <span>Refactored API consumption architectures using Next.js route handlers, improving load-time performance.</span>
            </div>
            <div className="flex items-start gap-2.5 text-sm text-slate-600">
              <span className="text-slate-300 mt-1.5 shrink-0">—</span>
              <span>Built robust SQL triggers and indexing schemas in PostgreSQL databases, optimizing system reads.</span>
            </div>
          </div>
        </div>
      </div>
    ),
    email: (
      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden py-5 px-5 mt-4">
        {/* Email Header */}
        <div className="border-b border-slate-100 pb-3 mb-4 space-y-1.5">
          <div className="flex items-center text-xs text-slate-400">
            <span className="w-14 shrink-0 font-medium">To:</span>
            <span className="text-slate-700">recruitment@enterprise.co.ke</span>
          </div>
          <div className="flex items-center text-xs text-slate-400">
            <span className="w-14 shrink-0 font-medium">Subject:</span>
            <span className="text-slate-700">Application: Senior Full Stack Engineer - Alex Mwangi</span>
          </div>
        </div>
        {/* Email Body */}
        <div className="text-sm text-slate-600 space-y-3 leading-relaxed">
          <p>Dear Recruitment Team,</p>
          <p>
            Please find attached my resume and cover letter for the Senior Full Stack Engineer position listed recently.
          </p>
          <p>
            With strong capabilities in Next.js, React, and TypeScript, combined with backend postgres development, I am eager to contribute to your engineering team. My documents are saved in the attached Google Drive folder for easy access.
          </p>
          <p>Thank you and look forward to hearing from you.</p>
          <p>
            Best regards,<br />
            Alex Mwangi
          </p>
        </div>
        {/* Email Footer / Send Button Mock */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
          <button className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-medium transition-colors cursor-pointer">
            <Send className="w-3.5 h-3.5" />
            Send Application
          </button>
          <span className="text-[10px] text-slate-400">Auto-generated via Tellus SMTP Gateway</span>
        </div>
      </div>
    ),
    prep: (
      <div className="space-y-6 py-6">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Anticipated Interview Questions</h4>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-brand-primary uppercase tracking-wide">Question 1</p>
            <p className="text-sm font-semibold text-slate-800">How do you structure Server Actions in Next.js 15+ to ensure security and efficiency?</p>
            <p className="text-sm text-slate-500 leading-relaxed pt-1">
              <strong className="text-slate-600">Suggested Response:</strong> Talk about utilizing Zod for validating arguments, using auth checks inside the action scope, and implementing optimistic updates on the client side. Mention wrapping async triggers inside transitions.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-brand-primary uppercase tracking-wide">Question 2</p>
            <p className="text-sm font-semibold text-slate-800">Tellus identified SQL optimization as key. How do you scale PostgreSQL read speeds?</p>
            <p className="text-sm text-slate-500 leading-relaxed pt-1">
              <strong className="text-slate-600">Suggested Response:</strong> Focus on indexing (B-Tree/GIN), executing EXPLAIN ANALYZE queries to locate bottlenecks, setting up read replicas, and caching repetitive query lists using Redis.
            </p>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <section className="py-12 sm:py-20 bg-white relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-12">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            Custom-Built Application Packs
          </h2>
          <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">
            Every match generates a complete pack tailored to that specific listing, stored on your Google Drive and staged in your Gmail.
          </p>
        </div>

        {/* Tab Wrapper */}
        <div className="w-full">

          {/* Top window bar */}
          <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="text-xs text-slate-400 truncate">tellus_pack_safaricom_developer.zip</span>
            </div>

            {/* Tabs List */}
            <div className="flex overflow-x-auto w-full sm:w-auto scrollbar-hide gap-1 pb-1 sm:pb-0">
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap cursor-pointer ${isSelected
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="min-h-[300px] relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                {content[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
}
