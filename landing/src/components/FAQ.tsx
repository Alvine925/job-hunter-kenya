"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FAQItem {
  question: string;
  answer: string;
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "How does Tellus compatibility matching work?",
      answer:
        "Unlike simple keyword scanning that searches for exact spelling (which often misses similar skills and experience), Tellus analyzes the context of the job description and requirements. It evaluates the core responsibilities against your parsed CV, target roles, and location preferences to calculate a precise fit rating.",
    },
    {
      question: "Which job sites does the platform monitor?",
      answer:
        "We currently scan and parse active vacancies in Kenya from top job boards (including BrighterMonday, Fuzu, MyJobsInKenya, MyJobMag, and LinkedIn Jobs), NGO listings, and corporate portals daily. Opportunities are consolidated and matched to your profile automatically every morning at 8:00 AM EAT.",
    },
    {
      question: "Can I review and edit the cover letter and email before sending?",
      answer:
        "Yes, absolutely. Tellus generates draft application materials directly in your Gmail account (using secure OAuth connection). This ensures you have full control to read, customize, and approve the email and cover letter before sending.",
    },
    {
      question: "How is my CV data secured?",
      answer:
        "Your resume information is stored securely in our private database and is only accessed when running the compatibility match analyzer. We never sell your personal data or share CV details with third parties.",
    },
    {
      question: "What is required to sync Google Drive and Gmail?",
      answer:
        "During setup, you will be prompted to grant secure Google OAuth permissions for Gmail drafts and Google Drive creation scopes. This allows Tellus to write the application zipped archives directly to your personal Drive and stage drafts in your Gmail client.",
    },
    {
      question: "Is Tellus really free? How do limits and referrals work?",
      answer:
        "Yes, Tellus is completely free. We do not charge subscription fees or request credit cards. Every user starts with the Starter plan. To unlock higher limits, more CV uploads, and advanced features, simply invite other job seekers using your unique referral link. Once they sign up, your account is instantly upgraded.",
    },
    {
      question: "Does Tellus support remote or international job listings?",
      answer:
        "Yes, we index remote-friendly roles and international opportunities listed on Kenyan career portals. You can select your county or remote preferences in your dashboard settings to filter these out.",
    },
    {
      question: "Can I connect multiple email accounts or Google Drive storage directories?",
      answer:
        "Currently, each Tellus account maps to a single Google identity (one connected Gmail drafts folder and one Google Drive workspace directory). If you wish to use a different address, you can reconnect or update your OAuth credentials from your profile tab.",
    },
    {
      question: "How often are new job matches sent to my feed?",
      answer:
        "Our scrapers run daily at 8:00 AM EAT. Matching evaluations are completed in the background, and your dashboard feed updates immediately. You can choose to receive a consolidated email digest every morning listing your highest compatibility matches.",
    },
    {
      question: "What format does my CV need to be in?",
      answer:
        "Tellus currently supports PDF format resumes. We recommend uploading a clean, text-based PDF (without complex tables or graphics) to ensure the parsing engine extracts your work milestones, skills, and credentials with maximum accuracy.",
    },
    {
      question: "Can I disable the Smart Apply automation?",
      answer:
        "Yes, you have full control. Smart Apply is entirely optional and disabled by default. You can choose to manually review, edit, and send every staged Gmail draft yourself. Automated dispatch is only active if you explicitly toggle 'Auto-Send' on in your dashboard settings.",
    },
    {
      question: "What happens if a job listing has expired or is a duplicate?",
      answer:
        "Our pipeline runs daily validation checks. If a host portal takes down a listing or flags it as closed, our feed flags it as 'Expired'. Our deduplication algorithm checks description signatures to ensure you don't receive duplicate matches for the same vacancy listed across multiple boards.",
    },
  ];

  const toggleIndex = (index: number) => {
    if (openIndex === index) {
      setOpenIndex(null);
    } else {
      setOpenIndex(index);
    }
  };

  return (
    <section id="faq" className="py-20 bg-[#FAFAFA] relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-4xl mx-auto mb-14">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 text-base max-w-xl mx-auto">
            Everything you need to know about getting started with Tellus.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-0">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="border-b border-slate-200/80 last:border-b-0"
              >
                <button
                  onClick={() => toggleIndex(index)}
                  className="w-full flex items-center justify-between text-left py-5 transition-colors cursor-pointer group"
                >
                  <span className="font-display font-semibold text-[15px] sm:text-base text-slate-800 group-hover:text-slate-900 pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-slate-600" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pb-5 text-sm text-slate-500 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
