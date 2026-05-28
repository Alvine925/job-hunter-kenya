import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tellusjobs.site"),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "Tellus — Active Vacancies in Kenya & Smart Job Workspace",
    template: "%s | Tellus Kenya"
  },
  description: "Find and automate active vacancies in Kenya on Fuzu, BrighterMonday, MyJobsInKenya, and corporate career portals. Get compatibility scores, custom cover letters, and Gmail drafts automatically.",
  keywords: [
    "Tellus",
    "Tellus Jobs",
    "Job hunt Kenya",
    "Job matching Kenya",
    "Fuzu vacancy scraper",
    "BrighterMonday vacancies",
    "MyJobsInKenya openings",
    "Cover letter generator Kenya",
    "Resume matching algorithm",
    "Kenyan tech jobs",
    "Automate job applications",
    "Nairobi developer jobs",
    "BrighterMonday jobs alternative",
    "Fuzu career portal scraper",
    "MyJobsInKenya CV builder",
    "Kenyan job alert automation",
    "Automatic job application sender Kenya",
    "Fuzu auto-apply tool",
    "BrighterMonday auto-applier",
    "Gmail job application draft generator",
    "NGO jobs in Kenya today",
    "UN jobs Kenya vacancies",
    "Jobs in Nairobi 2026",
    "Latest jobs in Nairobi",
    "Entry level jobs in Kenya",
    "Internships in Kenya today",
    "Safaricom jobs today",
    "Equity Bank vacancies",
    "KCB Bank job openings",
    "Kenya Power vacancies",
    "JobwebKenya vacancies today",
    "MyJobMag Kenya vacancies",
    "Fuzu jobs Nairobi search",
    "Corporate Staffing Services Kenya vacancies",
    "AI cover letter generator Kenya",
    "Tailor CV to job description online",
    "Free resume matching software",
    "Auto-apply jobs Kenya tool",
    "Gmail job application draft builder"
  ],
  authors: [{ name: "Tellus Team" }],
  robots: "index, follow",
  openGraph: {
    title: "Tellus — Smart Job Application Workspace for Kenya",
    description: "Align your CV with vacancies on leading Kenyan job boards. Generate tailored cover letters, intro emails, and staged Gmail drafts instantly.",
    url: "https://tellusjobs.site",
    siteName: "Tellus Kenya",
    locale: "en_KE",
    type: "website",
    images: [
      {
        url: "/images/hero-person-clean.png",
        width: 1200,
        height: 630,
        alt: "Tellus Jobs platform preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Tellus — Smart Job Application Workspace for Kenya",
    description: "Align your CV with vacancies on leading Kenyan job boards. Generate tailored cover letters, intro emails, and staged Gmail drafts instantly.",
    images: ["/images/hero-person-clean.png"]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <body className="bg-white text-slate-900 antialiased font-sans min-h-screen flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
