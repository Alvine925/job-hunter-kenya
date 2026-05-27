"use client";

import Link from "next/link";
import { Heart } from "lucide-react";


export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-14">

          {/* Logo & Slogan Column */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="font-display font-bold text-lg tracking-tight text-slate-800">
                Tellus
              </span>
            </Link>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Kenya's premier job-search platform. Streamlining vacancy discovery, profile matching, and document preparation for active candidates.
            </p>
          </div>

          {/* Navigation Column */}
          <div>
            <h4 className="text-slate-800 font-semibold text-xs uppercase tracking-wider mb-4">Platform</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/features" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-slate-400 hover:text-slate-600 transition-colors">
                  How it Works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Limits
                </Link>
              </li>
              <li>
                <Link href="/problem-solution" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Problem & Solution
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h4 className="text-slate-800 font-semibold text-xs uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/privacy" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-slate-400 hover:text-slate-600 transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 mb-8" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © {currentYear} Tellus Kenya. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-brand-primary fill-current" /> for Kenyan Job Hunters.
          </p>
        </div>

      </div>
    </footer>
  );
}
