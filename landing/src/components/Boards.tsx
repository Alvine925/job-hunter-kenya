"use client";

import { Search } from "lucide-react";

export default function Boards() {
  const boards = [
    { name: "BrighterMonday Vacancies" },
    { name: "Fuzu Kenya Jobs" },
    { name: "MyJobsInKenya Openings" },
    { name: "MyJobMag Kenya" },
    { name: "LinkedIn Kenya Jobs" },
    { name: "NGO Vacancies in Kenya" },
    { name: "Safaricom Career Portal" },
    { name: "Equity Bank Careers" },
    { name: "Remote Jobs Kenya" },
    { name: "Government Jobs Kenya" },
  ];

  // Duplicate the list multiple times to allow infinite scrolling
  const marqueeItems = [...boards, ...boards, ...boards, ...boards];

  return (
    <section className="py-10 bg-[#FAFAFA] border-y border-slate-100 overflow-hidden relative">
      {/* Edge fading gradients */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#FAFAFA] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#FAFAFA] to-transparent z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-2 tracking-wide">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          Scraping and analyzing active jobs across top portals
        </p>
      </div>

      {/* Marquee Track */}
      <div className="flex w-max relative">
        <div className="flex gap-5 animate-marquee py-1">
          {marqueeItems.map((board, index) => (
            <div
              key={`${board.name}-${index}`}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <span className="font-display font-medium text-sm text-slate-700">{board.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
