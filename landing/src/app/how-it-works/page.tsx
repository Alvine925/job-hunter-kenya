import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import InteractiveDemo from "@/components/InteractiveDemo";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "How It Works | Tellus Kenya - Auto-Apply for Kenyan Job Boards",
  description: "Learn how Tellus scans active job sites in Kenya, matches opportunities directly with your background, and automates your application document staging.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowToWorksPage() {
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Automate Job Applications with Tellus",
    "description": "Learn how Tellus scans active job boards in Kenya (Fuzu, BrighterMonday, MyJobsInKenya) and automates CV formatting, matching scores, cover letters, and Gmail draft staging.",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Parse & Map Your CV Profile",
        "text": "Upload your resume in PDF format. Tellus reads your overall context, skills, and experience to build a standardized, machine-readable developer profile that aligns with automated tracking parsers (ATS)."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Daily Scrapes & Aggregation",
        "text": "Our scrapers run daily at 8:00 AM EAT, scanning top Kenyan job boards and corporate career pages, filtering out duplicates and expired ghost listings to aggregate active positions."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Semantic Match Calculations",
        "text": "Tellus evaluates the semantic overlap between your background and the job requirements, outputting a match score from 0-100% with detailed pro/con reasoning."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Stage Application Deliverables",
        "text": "Through secure Gmail OAuth and Google Drive sync, Tellus automatically stages tailored cover letters, intro emails, and resume objectives directly in your drafts folder and cloud directories."
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Auto-Apply & Interview Coaching",
        "text": "For Power Users, enable Auto-Apply to dispatch emails immediately for 90%+ matches. Tellus also generates a customized interview prep guide based on the job requirements."
      }
    ]
  };

  const steps = [
    {
      num: "01",
      title: "Parse & Map Your CV Profile",
      headline: "Multi-dimensional profile modeling",
      description: "Upload your existing resume (PDF format) to Tellus. Bypassing simplistic text extractions, Tellus reads your CV's overall context, experience milestones, technical capabilities, and location parameters. It formats these details into a standardized, machine-readable developer profile that maps perfectly to recruiters' screening databases.",
    },
    {
      num: "02",
      title: "Daily Scrapes & Aggregation",
      headline: "Real-time crawler sweeps",
      description: "Our crawling engines run automated sweeps of leading career sites, portal pages, and corporate listings every single morning at 8:00 AM EAT. We extract active roles, filter out duplicate postings and expired ghost listings, and index fresh openings in a central feed.",
    },
    {
      num: "03",
      title: "Semantic Match Calculations",
      headline: "Beyond exact word spellings",
      description: "Rather than scanning for raw letters (which misses similar phrases and returns false matches), Tellus measures the semantic overlap between your qualifications and the listing guidelines. It computes a precise 0-100% match score with detailed pros/cons listing showing exactly how well you fit.",
    },
    {
      num: "04",
      title: "Staged Deliverables Staging",
      headline: "Gmail OAuth & Google Drive sync",
      description: "For positions requiring email, Tellus links with your Gmail (using secure OAuth) to automatically stage a custom cover letter, CV profile summary, and introductory message inside your drafts folder. For portals, it packs credentials into quick-copy blocks, and synchronizes the PDFs in structured Google Drive folders.",
    },
    {
      num: "05",
      title: "Auto-Apply & Interview Coaching",
      headline: "Fully hands-off automation",
      description: "Power Users can activate Automatic Application Mode. Once enabled, Tellus automatically sends application emails via Gmail as soon as a 90%+ match is crawled. Concurrently, Tellus activates Interview Mode, generating a custom coaching guide with anticipated technical mock questions matched to the JD.",
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* JSON-LD HowTo Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center mb-24">
            <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">System Architecture</span>
            <h1 className="font-display font-semibold text-3xl sm:text-5xl lg:text-6xl text-slate-900 tracking-tight mt-2 mb-4">
              How Tellus Automates Your Search
            </h1>
            <p className="text-slate-600 text-sm sm:text-base font-normal max-w-xl mx-auto leading-relaxed">
              Explore the five core phases of our automated pipeline—converting your CV parameters into verified, dispatched applications.
            </p>
          </div>

          {/* Match Simulator Section Header */}
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">Interactive Playground</span>
            <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight mt-2">
              Try the Match Simulator
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm font-normal mt-2">
              Toggle mock CV parameters and target positions below to experience Tellus semantic matching math.
            </p>
          </div>

          {/* Interactive Match Demo */}
          <div className="mb-24 px-4 sm:px-0">
            <InteractiveDemo isFlat={true} />
          </div>

          {/* Divider/Header for Narrative Steps */}
          <div className="border-t border-slate-100 pt-20 mb-16 text-center max-w-2xl mx-auto">
            <span className="text-xs font-medium text-brand-primary uppercase tracking-wider">System Workflow</span>
            <h2 className="font-display font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight mt-2">
              Five Phases of the Automation
            </h2>
          </div>

          {/* Narrative Step-by-Step Flow - Flat on Background, no cards, no AI icons */}
          <div className="space-y-20">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="grid md:grid-cols-12 gap-8 items-start pb-16 border-b border-slate-100 last:border-0"
              >
                {/* Visual Step Indicator Column */}
                <div className="md:col-span-4 space-y-2">
                  <span className="font-display font-semibold text-4xl sm:text-5xl text-brand-primary block">
                    {step.num}
                  </span>
                  <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-slate-400 block">
                    {step.headline}
                  </span>
                </div>

                {/* Narrative Detail Column */}
                <div className="md:col-span-8 space-y-3">
                  <h3 className="font-display font-semibold text-xl sm:text-2xl text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
