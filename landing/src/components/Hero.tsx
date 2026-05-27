"use client";

import { ArrowRight, Play } from "lucide-react";
import Image from "next/image";

export default function Hero() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left animate-fade-in">
            <h1 className="font-display font-extrabold text-[1.65rem] xs:text-3xl sm:text-5xl lg:text-[3.5rem] tracking-tight leading-[1.12] mb-6 text-slate-900">
              Stop Searching.<br />
              <span className="text-brand-primary whitespace-nowrap">Get Instantly Matched</span> to Your Next Career.
            </h1>

            <p className="text-sm sm:text-lg text-slate-500 max-w-xl mb-8 leading-relaxed">
              Tellus scans top job boards and corporate career portals daily, aligns requirements directly with your CV, and helps you prepare complete, tailored application packages instantly.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <a
                href={`${appUrl}/login`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white transition-all w-full sm:w-auto font-medium text-sm"
              >
                Upload CV & Get Started
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/how-it-works"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all w-full sm:w-auto font-medium text-sm cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-brand-primary" />
                See How It Works
              </a>
            </div>

            {/* Quick Metrics / Social Proof */}
            <div className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 border-t border-slate-100 pt-8 w-full">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                <span className="text-sm text-slate-500">Daily Updates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                <span className="text-sm text-slate-500">Relevancy Score</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                <span className="text-sm text-slate-500">Workspace Sync</span>
              </div>
            </div>
          </div>

          {/* Hero Right Visual Column — Dashboard Screenshot */}
          <div className="lg:col-span-5 relative w-full flex items-center justify-center">
            <div className="relative w-full">
              <Image
                src="/images/hero-person-clean.png"
                alt="Confident professional ready to land their next career with Tellus"
                width={1024}
                height={1024}
                priority
                className="relative w-full h-auto mix-blend-multiply transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
