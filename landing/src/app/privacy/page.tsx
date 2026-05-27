import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Tellus Kenya",
  description: "Privacy Policy for the Tellus Job Application Platform. Learn how we handle and protect your CV and personal data.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="relative min-h-screen flex flex-col justify-between">
      {/* Sticky Navigation Bar */}
      <Navbar />

      <main className="flex-1 pt-32 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

          {/* Header */}
          <div className="border-b border-slate-100 pb-6">
            <h1 className="font-display font-semibold text-3xl text-slate-900 tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-400 mt-1">Last updated: {lastUpdated}</p>
          </div>

          {/* Policy content */}
          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
            <p className="text-slate-900 font-medium">
              PLEASE READ THIS PRIVACY POLICY CAREFULLY. IT SPECIFIES WHAT PERSONAL DATA WE COLLECT, HOW IT IS PROCESSED, AND YOUR STATUTORY RIGHTS UNDER APPLICABLE LAWS.
            </p>

            <p>
              Tellus operates as a job application tracking and submission platform. We are committed to protecting the privacy and personal data of our users in compliance with the Data Protection Act, 2019 (Laws of Kenya) and the General Data Protection Regulation (GDPR). This Privacy Policy explains our practices regarding the collection, use, storage, and protection of information derived from your account registration, resume uploads, and integration settings.
            </p>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">1. Data Controller and Contact Information</h3>
              <p>
                The data controller for Tellus is Tellus Job Platform. For any data protection inquiries, request to exercise your rights, or questions regarding this policy, you can contact our designated Data Protection Officer at:
              </p>
              <p className="font-medium text-slate-900">
                Email: <a href="mailto:privacy@tellusjobs.site" className="text-brand-primary hover:text-brand-primary-hover transition-colors">privacy@tellusjobs.site</a>
              </p>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">2. Categories of Data We Collect</h3>
              <p>
                We only collect and process personal data that is strictly necessary to run the platform and fulfill our service commitments. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Account Credentials:</strong> Full name, email address, password hashes, and referral connection metrics used to secure your account and manage plan upgrade tiers.
                </li>
                <li>
                  <strong className="text-slate-800">Resume and Qualification Materials (CV):</strong> Text extracted from uploaded resumes, including employment history, educational qualifications, list of skills, professional certifications, and contact phone numbers.
                </li>
                <li>
                  <strong className="text-slate-800">Integrations and Access Tokens:</strong> Encrypted Google OAuth refresh and access tokens, Google email addresses, and temporary session keys (such as browser session cookies) that you explicitly supply to link your external job board profiles.
                </li>
                <li>
                  <strong className="text-slate-800">Activity Logs and System Audits:</strong> Timestamps of email applications sent, job monitor match history, scraper tracking metrics, API execution counts, login security logs, and error telemetry.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">3. Processing Purposes and Legal Bases</h3>
              <p>
                Under the Data Protection Act, 2019 and GDPR, we process your personal data under the following legal grounds:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Performance of a Contract:</strong> We process your credentials, CV text, and job match queries to perform text matching, compile application emails, structure draft templates, and automatically send job application emails as requested.
                </li>
                <li>
                  <strong className="text-slate-800">Consent:</strong> We store your resume files in cloud storage buckets and maintain linked Google API connections based on your explicit consent. You can withdraw your consent at any time by deleting files or removing integration links.
                </li>
                <li>
                  <strong className="text-slate-800">Legitimate Interests:</strong> We log login failures and account lockout events to defend the platform against security threats, manage API request rate limits, and audit the system for referral scheme fraud.
                </li>
                <li>
                  <strong className="text-slate-800">Legal Compliance:</strong> Keeping records of transactions, audits, and email activity to satisfy local regulatory reporting and anti-spam laws.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">4. Google API Integration & Scope Usage</h3>
              <p>
                When you enable Gmail and Google Drive integration, the platform requests specific authorization scopes. We handle this data with strict isolation:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Data Minimization:</strong> We request only the permissions necessary to compile and send emails (Gmail send scope) and save application folders (Drive and Docs access).
                </li>
                <li>
                  <strong className="text-slate-800">No Retention of Email Contents:</strong> We do not store or download copy logs of your incoming personal emails or private Drive folders. The integration is used solely as a one-way pipeline to output application materials created within Tellus.
                </li>
                <li>
                  <strong className="text-slate-800">Token Protection:</strong> Your access tokens and refresh tokens are encrypted at rest in our database using standard cryptographic keys and are never exposed in browser scripts or URL parameters.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">5. Sub-Processors and Data Transfers</h3>
              <p>
                We do not sell, rent, or trade your personal data with third-party advertising companies or recruitment agencies. To operate the service, we share specific data with the following infrastructure sub-processors:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Supabase:</strong> For cloud hosting, database management, user authentication services, and row-level secured storage of resume files.
                </li>
                <li>
                  <strong className="text-slate-800">Cloudflare:</strong> For edge network routing, request filter checking, web application firewalls (WAF), and Turnstile security challenge validation.
                </li>
                <li>
                  <strong className="text-slate-800">Google APIs:</strong> Acting as the external mail transmission channel to broadcast application cover letters under your control.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">6. Data Security and Safeguards</h3>
              <p>
                Tellus uses layers of physical, administrative, and technical controls to secure your data:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Encryption:</strong> All data is encrypted in transit using Transport Layer Security (TLS 1.3) and encrypted at rest within our database.
                </li>
                <li>
                  <strong className="text-slate-800">Row-Level Security (RLS):</strong> Our database forces strict Postgres RLS policies, ensuring that a user can only read, write, update, or delete records matching their authenticated Supabase User ID.
                </li>
                <li>
                  <strong className="text-slate-800">Injection Protection:</strong> All system outputs and form values are parsed and sanitized to strip control characters, preventing email header injections, SQL injections, and cross-site scripting (XSS).
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">7. Data Retention and Deletion Timelines</h3>
              <p>
                We retain your data only for as long as your account remains active.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">User-Initiated Deletion:</strong> If you trigger account deletion in the settings dashboard, our systems immediately cascade the request to wipe all database rows (resumes, matches, settings, integrations, audit records) and delete stored CV documents.
                </li>
                <li>
                  <strong className="text-slate-800">System Purges:</strong> Cached files, transient job scraper outputs, and telemetry data are cleaned from our servers periodically. Lockout logs are preserved for security audit purposes for a maximum of 90 days.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">8. Your Statutory Rights</h3>
              <p>
                Under both GDPR and the Kenya Data Protection Act, 2019, you have specific rights that you can exercise directly without fee:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-800">Right to Access and Portability:</strong> You can download a complete structured JSON file containing all database records associated with your account from the Settings page.
                </li>
                <li>
                  <strong className="text-slate-800">Right to Erasure (Wiping):</strong> You can completely erase all profile data, files, and third-party integrations using the text-verified account deletion panel.
                </li>
                <li>
                  <strong className="text-slate-800">Right to Rectification:</strong> You can modify your name, contact fields, and job preferences at any time in the profile interface.
                </li>
                <li>
                  <strong className="text-slate-800">Right to Object or Restrict Processing:</strong> You can revoke third-party API integration keys or delete your uploaded CV, which immediately stops matching processes.
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-4">
              <h3 className="text-base font-semibold text-slate-900">9. Changes to This Privacy Policy</h3>
              <p>
                We may revise this Privacy Policy to reflect changes in our security configurations, infrastructure sub-processors, or statutory updates under Kenyan law or GDPR. Any update will be marked with a revised date at the top of this page, and users will be notified on the dashboard of any material shifts in data handling practices.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Page Footer */}
      <Footer />
    </div>
  );
}
