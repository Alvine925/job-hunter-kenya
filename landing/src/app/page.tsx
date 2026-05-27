import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Boards from "@/components/Boards";
import Features from "@/components/Features";
import InteractiveDemo from "@/components/InteractiveDemo";
import PackPreview from "@/components/PackPreview";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Tellus Kenya",
    "url": "https://tellusjobs.site",
    "logo": "https://tellusjobs.site/images/logo.png",
    "sameAs": [
      "https://github.com/Alvine925/job-hunter-kenya"
    ],
    "description": "Automate your job search on Fuzu, BrighterMonday, MyJobsInKenya, and corporate career pages with the Tellus Smart Job Application Workspace."
  };

  const softwareApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Tellus",
    "operatingSystem": "All",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "KES"
    },
    "description": "Smart Job Application Workspace for Kenya. Calculates profile compatibility, tailors cover letters, and stages Gmail drafts automatically for Fuzu, BrighterMonday, and corporate portals."
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />

      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1">
        {/* Hero Section (Mockup Restored) */}
        <Hero />

        {/* Supported Kenyan Boards Ticker */}
        <Boards />

        {/* Features Content flat on background */}
        <Features />

        {/* Live Interactive Matching Simulator */}
        <InteractiveDemo />

        {/* Generated Pack Material Previews */}
        <PackPreview />

        {/* FAQ Accordion list */}
        <FAQ />
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
