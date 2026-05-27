import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Tellus Kenya - Scrapers & CV Safety",
  description: "Get detailed answers about how Tellus integrates with Gmail, maps compatibility scores, crawls Fuzu and BrighterMonday, and keeps your CV data secure.",
  alternates: {
    canonical: "/faq",
  },
};

export default function FAQPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How does Tellus compatibility matching work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Unlike simple keyword scanning that searches for exact spelling (which often misses similar skills and experience), Tellus analyzes the context of the job description and requirements. It evaluates the core responsibilities against your parsed CV, target roles, and location preferences to calculate a precise fit rating."
        }
      },
      {
        "@type": "Question",
        "name": "Which job sites does the platform monitor?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "We currently scan and parse top job search sites and corporate portals daily. Listings are consolidated and matched to your profile automatically every morning at 8:00 AM EAT."
        }
      },
      {
        "@type": "Question",
        "name": "Can I review and edit the cover letter and email before sending?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, absolutely. Tellus generates draft application materials directly in your Gmail account (using secure OAuth connection). This ensures you have full control to read, customize, and approve the email and cover letter before sending."
        }
      },
      {
        "@type": "Question",
        "name": "How is my CV data secured?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your resume information is stored securely in our private database and is only accessed when running the compatibility match analyzer. We never sell your personal data or share CV details with third parties."
        }
      },
      {
        "@type": "Question",
        "name": "What is required to sync Google Drive and Gmail?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "During setup, you will be prompted to grant secure Google OAuth permissions for Gmail drafts and Google Drive creation scopes. This allows Tellus to write the application zipped archives directly to your personal Drive and stage drafts in your Gmail client."
        }
      },
      {
        "@type": "Question",
        "name": "Is Tellus really free? How do limits and referrals work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, Tellus is completely free. We do not charge subscription fees or request credit cards. Every user starts with the Starter plan. To unlock higher limits, more CV uploads, and advanced features, simply invite other job seekers using your unique referral link. Once they sign up, your account is instantly upgraded."
        }
      },
      {
        "@type": "Question",
        "name": "Does Tellus support remote or international job listings?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, we index remote-friendly roles and international opportunities listed on Kenyan career portals. You can select your county or remote preferences in your dashboard settings to filter these out."
        }
      },
      {
        "@type": "Question",
        "name": "Can I connect multiple email accounts or Google Drive storage directories?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Currently, each Tellus account maps to a single Google identity (one connected Gmail drafts folder and one Google Drive workspace directory). If you wish to use a different address, you can reconnect or update your OAuth credentials from your profile tab."
        }
      },
      {
        "@type": "Question",
        "name": "How often are new job matches sent to my feed?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our scrapers run daily at 8:00 AM EAT. Matching evaluations are completed in the background, and your dashboard feed updates immediately. You can choose to receive a consolidated email digest every morning listing your highest compatibility matches."
        }
      },
      {
        "@type": "Question",
        "name": "What format does my CV need to be in?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Tellus currently supports PDF format resumes. We recommend uploading a clean, text-based PDF (without complex tables or graphics) to ensure the parsing engine extracts your work milestones, skills, and credentials with maximum accuracy."
        }
      },
      {
        "@type": "Question",
        "name": "Can I disable the Smart Apply automation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, you have full control. Smart Apply is entirely optional and disabled by default. You can choose to manually review, edit, and send every staged Gmail draft yourself. Automated dispatch is only active if you explicitly toggle 'Auto-Send' on in your dashboard settings."
        }
      },
      {
        "@type": "Question",
        "name": "What happens if a job listing has expired or is a duplicate?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our pipeline runs daily validation checks. If a host portal takes down a listing or flags it as closed, our feed flags it as 'Expired'. Our deduplication algorithm checks description signatures to ensure you don't receive duplicate matches for the same vacancy listed across multiple boards."
        }
      }
    ]
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* JSON-LD FAQPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32">
        {/* Flat FAQ accordion items */}
        <FAQ />
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
