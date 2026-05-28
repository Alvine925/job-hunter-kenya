"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface FeaturesProps {
  bgClassName?: string;
}

export default function Features({ bgClassName = "bg-white" }: FeaturesProps) {
  const items = [
    {
      number: "01",
      title: "Automated Daily Crawl & Scrape",
      description: "Our background crawlers scour leading Kenyan job sites (including BrighterMonday, Fuzu, MyJobsInKenya, MyJobMag, and LinkedIn Jobs) and corporate career pages every morning at 8:00 AM EAT. We aggregate, parse, and clean listings, consolidating active vacancies in Kenya into a unified workspace feed so you never have to search multiple sites manually again.",
    },
    {
      number: "02",
      title: "Contextual CV Matching",
      description: "Bypassing simplistic keyword screening that triggers false negatives, Tellus performs contextual comparison. It evaluates the responsibilities of any listing against your experience and skills to output a precise 0-100% compatibility rating.",
    },
    {
      number: "03",
      title: "Application Document Generator",
      description: "Generate a complete application kit tailored specifically to the vacancy. Tellus creates a targeted draft cover letter, maps your CV career objectives to the job, drafts an introductory email, and highlights potential technical interview questions in seconds.",
    },
    {
      number: "04",
      title: "Smart Apply Mode",
      description: "Available for power users. Once connected via Gmail, Tellus can prepare customized application drafts the moment a highly compatible match (90%+) is found, keeping your pipeline active with minimal manual effort.",
    },
    {
      number: "05",
      title: "Interview Preparation Simulator",
      description: "Activate prep mode to launch mock interview sessions. Tellus evaluates the job description requirements and your CV achievements to generate targeted technical and behavioral questions alongside reference answers.",
    },
    {
      number: "06",
      title: "Smart Copy-Packs for Web Portals",
      description: "Bypass multi-step form fatigue. For external job portals, Tellus organizes your qualifications, education, and career achievements into pre-parsed fields. Our copy-pack interface lets you copy and populate form inputs across portals in seconds without typing.",
    },
    {
      number: "07",
      title: "Application Method Detection & Mode Toggle",
      description: "Tellus automatically analyzes whether a position requires direct email submissions or external web portal filings. The workspace dynamically adapts your action views, letting you toggle methods instantly depending on how the employer wants to receive applications.",
    },
    {
      number: "08",
      title: "Google Drive Workspace Storage",
      description: "Keep your applications organized automatically. Tellus synchronizes with your personal Google Drive, establishing structured, nested directories for each active submission. All generated cover letters, optimized CV objectives, and draft copies are stored securely in one archive.",
    },
    {
      number: "09",
      title: "Referral Limits & Code Progression",
      description: "Our platform is entirely free. Tellus integrates referral limit tracking directly into your dashboard. Start with standard Starter limits and instantly unlock higher cover letter, email draft, and custom monitor capacities as colleagues register using your unique link.",
    },
    {
      number: "10",
      title: "Custom Company Portal Watchlists",
      description: "Many high-quality openings are listed exclusively on corporate career sites and never reach aggregate platforms. Tellus allows you to add specific employer domains to your watchlist. Our crawlers monitor these pages directly, flagging new roles the moment they go live.",
    },
  ];

  return (
    <section id="features" className={`py-12 sm:py-24 relative ${bgClassName}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Section Header */}
        <div className="text-center max-w-5xl mx-auto mb-20">
          <p className="text-brand-primary text-sm font-medium mb-3">
            Core Platform Capabilities
          </p>

          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight leading-tight text-slate-900 mb-4 text-balance">
            Streamline Your Application Workflow
          </h2>

          <p className="text-slate-500 text-base max-w-2xl mx-auto">
            Explore the key features designed to organize your job search, remove administrative friction, and help you submit high-quality applications.
          </p>
        </div>

        {/* Features Narrative List */}
        <div className="space-y-0">
          {items.map((item) => (
            <div
              key={item.title}
              className="grid md:grid-cols-12 gap-4 md:gap-8 items-baseline py-8 border-b border-slate-100 last:border-b-0"
            >
              {/* Number and Title Column */}
              <div className="md:col-span-4 flex items-baseline gap-3">
                <span className="font-display text-lg text-slate-300 font-semibold tabular-nums">
                  {item.number}
                </span>
                <h3 className="font-display font-semibold text-lg text-slate-900">
                  {item.title}
                </h3>
              </div>

              {/* Description Column */}
              <div className="md:col-span-8">
                <p className="text-sm text-slate-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Floating Application Pack Items (Visible on large screens) */}
      
      {/* 1. CV Floater - Top Left */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        animate={{ y: [0, -12, 0] }}
        transition={{
          y: { duration: 6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0 },
          opacity: { duration: 0.8 }
        }}
        className="hidden xl:block absolute top-[12%] left-[2%] w-[170px] lg:w-[210px] bg-white rounded-xl border border-slate-200/60 shadow-[0_12px_36px_rgba(0,0,0,0.05)] p-1.5 z-0 hover:scale-105 transition-transform duration-300 pointer-events-none"
      >
        <div className="text-[10px] font-semibold text-slate-400 mb-1 px-1 flex items-center justify-between">
          <span>CV Objective</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
        <Image
          src="/images/floater-cv.png"
          alt="CV Objective Preview"
          width={250}
          height={320}
          className="rounded-lg mix-blend-multiply"
        />
      </motion.div>

      {/* 2. Cover Letter Floater - Top Right */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        animate={{ y: [0, 12, 0] }}
        transition={{
          y: { duration: 6.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.5 },
          opacity: { duration: 0.8 }
        }}
        className="hidden xl:block absolute top-[28%] right-[2%] w-[170px] lg:w-[210px] bg-white rounded-xl border border-slate-200/60 shadow-[0_12px_36px_rgba(0,0,0,0.05)] p-1.5 z-0 hover:scale-105 transition-transform duration-300 pointer-events-none"
      >
        <div className="text-[10px] font-semibold text-slate-400 mb-1 px-1 flex items-center justify-between">
          <span>Cover Letter</span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
        </div>
        <Image
          src="/images/floater-letter.png"
          alt="Cover Letter Preview"
          width={250}
          height={320}
          className="rounded-lg mix-blend-multiply"
        />
      </motion.div>

      {/* 3. Email Draft Floater - Bottom Left */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        animate={{ y: [0, -15, 0] }}
        transition={{
          y: { duration: 7, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1 },
          opacity: { duration: 0.8 }
        }}
        className="hidden xl:block absolute top-[52%] left-[1.5%] w-[190px] lg:w-[230px] bg-white rounded-xl border border-slate-200/60 shadow-[0_12px_36px_rgba(0,0,0,0.05)] p-1.5 z-0 hover:scale-105 transition-transform duration-300 pointer-events-none"
      >
        <div className="text-[10px] font-semibold text-slate-400 mb-1 px-1 flex items-center justify-between">
          <span>Gmail Draft</span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>
        <Image
          src="/images/floater-email.png"
          alt="Gmail Draft Preview"
          width={280}
          height={200}
          className="rounded-lg mix-blend-multiply"
        />
      </motion.div>

      {/* 4. Interview Prep Floater - Bottom Right */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        animate={{ y: [0, 15, 0] }}
        transition={{
          y: { duration: 7.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 1.5 },
          opacity: { duration: 0.8 }
        }}
        className="hidden xl:block absolute top-[70%] right-[1.5%] w-[170px] lg:w-[210px] bg-white rounded-xl border border-slate-200/60 shadow-[0_12px_36px_rgba(0,0,0,0.05)] p-1.5 z-0 hover:scale-105 transition-transform duration-300 pointer-events-none"
      >
        <div className="text-[10px] font-semibold text-slate-400 mb-1 px-1 flex items-center justify-between">
          <span>Interview Prep</span>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        </div>
        <Image
          src="/images/floater-interview.png"
          alt="Interview Prep Checklist Preview"
          width={250}
          height={320}
          className="rounded-lg mix-blend-multiply"
        />
      </motion.div>
    </section>
  );
}
