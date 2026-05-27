import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Features from "@/components/Features";
import PackPreview from "@/components/PackPreview";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Features | Tellus Kenya - Automated Job Search for Fuzu & BrighterMonday",
  description: "Explore Tellus's daily automated site scraping, semantic CV evaluations, and custom Gmail/Google Drive application staging.",
  alternates: {
    canonical: "/features",
  },
};

export default function FeaturesPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32">
        {/* Generated Pack Material Previews */}
        <PackPreview />

        {/* Features Content flat on background */}
        <Features bgClassName="bg-[#FAFAFA] border-t border-slate-100" />
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
