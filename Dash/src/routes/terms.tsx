import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    title: "Terms of Service - Tellus",
    meta: [
      { title: "Terms of Service - Tellus" },
      { name: "description", content: "Terms of Service agreement for using the Tellus Job Application Platform. Detailed legal clauses on account usage, email transmissions, and database limits." },
    ],
  }),
  component: TermsOfService,
});

function TermsOfService() {
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background text-foreground py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col items-start sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-border/60 pb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Terms of Service</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Last updated: {lastUpdated}</p>
          </div>
          <Link
            to="/login"
            className="text-sm font-semibold text-primary hover:underline self-start sm:self-auto"
          >
            Back to login
          </Link>
        </div>

        <div className="space-y-6 text-sm sm:text-base leading-relaxed text-muted-foreground">
          <p className="text-foreground font-semibold">
            PLEASE READ THESE TERMS OF SERVICE CAREFULLY BEFORE CREATING AN ACCOUNT.
          </p>

          <p>
            This Terms of Service is a binding legal contract between you and Tellus. By checking the agreement checkbox during registration, signing in, uploading resumes, or using our email transmission services, you acknowledge that you have read, understood, and agreed to be bound by all of the clauses set forth below.
          </p>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">1. Description of Platform Services</h3>
            <p>
              Tellus operates as a job application tracking and submission utility. The platform extracts plain text from uploaded resumes (CVs) to programmatically align qualifications against publicly indexed job vacancies, compile draft application packages (such as application cover letters and email text bodies), and synchronize with external integrations to send emails.
            </p>
            <p>
              Uploaded resume files are stored in private cloud buckets with row-level security constraints preventing access by other users. You retain full copyright ownership of all materials uploaded.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">2. Google Integration & Mail Sending License</h3>
            <p>
              To automate job applications, you may opt to connect your Google Workspace account via OAuth. By granting authorization scopes for Gmail sending, Google Drive files, and Google Document editing, you declare that:
            </p>
            <ul className="list-decimal pl-5 space-y-2">
              <li>
                You authorize Tellus to generate, structure, and transmit MIME-encoded emails from your personal address directly to recruitment contacts specified in job listings.
              </li>
              <li>
                You agree to use this sending utility solely to apply for active, legitimate vacancies. Utilizing this integration to send promotional, marketing, spam, bulk newsletters, harassing, or illegal content is strictly forbidden.
              </li>
              <li>
                You will not bypass header verification checks. The platform monitors and restricts destination addresses to ensure they match target application emails listed on job postings.
              </li>
              <li>
                You accept absolute responsibility for all outgoing communications, file storage, and data sent from your Gmail account. Tellus acts solely as an orchestrator and does not review, verify, or guarantee the delivery, status, or success of external email transmissions.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">3. Account Eligibility, Security, & Locking</h3>
            <p>
              You must provide accurate credentials (full name, email, password) during signup. You are prohibited from sharing your login session, credentials, or session cookies with third parties.
            </p>
            <p>
              To defend against database breaches and brute-force attacks, Tellus implements automatic access lockouts. If an account records 5 consecutive failed sign-in attempts, access will be blocked for a cooldown period of 10 minutes. Lockout events are audited, and notifications may be sent to the email address on file.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">4. System Limitations, Plan Tiers & Cooldowns</h3>
            <p>
              The platform limits data volume and integration actions to prevent spam and resource exhaustion. You agree to adhere to the following constraints:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Free Tier Limits:</strong> Accounts are limited to uploading a maximum of 2 resumes per calendar month, generating 2 application packs per day, sending 10 application emails per day, and tracking 5 active job scrapers.
              </li>
              <li>
                <strong>Upgraded Tier Limits:</strong> Active accounts that satisfy the referral program may upload up to 4 resumes per month, generate 4 application packs per day, send up to 20 emails per day, and track up to 15 job scrapers.
              </li>
              <li>
                <strong>API Cooldowns:</strong> The platform restricts rapid requests. A 10-minute spacing rule is applied to generation endpoints to ensure fair server allocation.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">5. Referral Program & Anti-Fraud Standards</h3>
            <p>
              The Upgraded Tier Plan can be unlocked by referring 10 users to the platform. A referral is deemed valid only when the referred contact successfully completes email confirmation.
            </p>
            <p>
              We monitor referral links for fraud. The following practices are grounds for immediate account suspension, permanent blacklisting of your email/IP, and removal of database access:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Creating self-referred, temporary, duplicate, or secondary accounts under your own control.</li>
              <li>Utilizing temporary email generation services, disposable inbox providers, or dummy domains.</li>
              <li>Automating sign-ups using browser macros, headless clients, or registration scripts.</li>
              <li>Spamming referral link distributions on public discussion forums or advertising channels.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">6. Data Portability & Deletion Rights</h3>
            <p>
              In compliance with local data protection regulations, users have full self-service portability options:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Data Export:</strong> You can download a complete JSON file containing all personal profile fields, application details, template settings, and email send logs.
              </li>
              <li>
                <strong>Account Deletion:</strong> You can request account deletion. Once you verify this by typing the deletion code in the Danger Zone, the platform deletes your resume files from cloud storage and cascades deletion to remove all auth records and relational rows immediately.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">7. No Warranty & Limitation of Liability</h3>
            <p>
              Tellus makes no warranty that the job recommendations, matches, or templates will be error-free, accurate, or result in job interviews, applications review, or placement of employment.
            </p>
            <p>
              Tellus shall not be liable for any indirect, incidental, special, exemplary, or consequential damages arising from: connection errors, Google API service outages, Gmail rate limit blocks, data loss from storage buckets, or unauthorized third-party access to your integrations cookies.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">8. Governing Law & Jurisdiction</h3>
            <p>
              These Terms of Service, and all disputes arising out of or relating to them, shall be governed by, and construed in accordance with, the laws of the Republic of Kenya.
            </p>
            <p>
              Any legal action or proceeding arising out of or related to these terms shall be subject to the exclusive jurisdiction of the courts of Kenya, in compliance with the Data Protection Act, 2019.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">9. Contact & Notices</h3>
            <p>
              If you have any questions, disputes, or inquiries regarding these Terms of Service, please send formal notice to: <a href="mailto:legal@tellusjobs.site" className="text-primary hover:underline">legal@tellusjobs.site</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
