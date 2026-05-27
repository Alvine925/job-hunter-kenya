import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Limits & Referrals | Tellus Kenya - Free Job Search Platform",
  description: "Tellus is completely free to use. Unlock higher application, CV upload, and document generation limits by referring friends.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32">
        {/* Flat Pricing Tables */}
        <Pricing />
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
