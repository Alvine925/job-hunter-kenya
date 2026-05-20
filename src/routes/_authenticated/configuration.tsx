import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/configuration")({ component: Config });

function Config() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Configuration</h1>
      <p className="text-muted-foreground text-sm mb-6">Scheduled scraping settings</p>
      <Card className="p-6">
        <h2 className="font-semibold mb-2">Automatic daily scraping</h2>
        <p className="text-sm text-muted-foreground mb-3">
          A scheduled job runs every day at 08:00 EAT and scrapes Kenyan job boards (BrighterMonday, MyJobMag, Fuzu, JobwebKenya, CorporateStaffing) based on your profile's desired roles and preferred county.
        </p>
        <p className="text-sm text-muted-foreground">
          Each new job is scored by AI for fit, with a "Why it matches" explanation. Open any job to generate a tailored cover letter and email — the letter is also saved to a "JobHunter KE" folder in your Google Drive.
        </p>
      </Card>
    </div>
  );
}
