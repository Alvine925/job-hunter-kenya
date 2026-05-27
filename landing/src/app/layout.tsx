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
    default: "Tellus — Smart Job Application Workspace for Kenya",
    template: "%s | Tellus Kenya"
  },
  description: "Automate your job search on Fuzu, BrighterMonday, MyJobsInKenya, and corporate career pages. Get instant profile compatibility scores, tailored cover letters, and staged Gmail drafts automatically.",
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
    "Gmail job application draft generator"
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
