import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Target, TrendingUp } from "lucide-react";

type Props = {
  allJobsCount: number;
  matchStats: { percent: number; matchedCount: number };
  skillCounts: [string, number][];
  hotSectors: [string, number][];
  hasSkills: boolean;
};

export function MarketplaceInsightsPanel({
  allJobsCount,
  matchStats,
  skillCounts,
  hotSectors,
  hasSkills,
}: Props) {
  return (
    <section className="rounded-xl border border-border/80 bg-background p-4 sm:p-5 space-y-5 shadow-sm">
      <div>
        <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          Market Insights
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Based on {allJobsCount} active listings
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-primary/70 shrink-0" />
            Profile Match Rate
          </span>
          <span className="font-bold text-foreground">{matchStats.percent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${matchStats.percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <p className="text-[11px] text-muted-foreground leading-snug">
            {hasSkills
              ? `${matchStats.matchedCount} of ${allJobsCount} roles match your skillset.`
              : "Configure your skills & desired roles to view matching jobs."}
          </p>
          <Link to="/profile">
            <Button
              variant="link"
              className="h-auto p-0 text-[11px] text-primary font-semibold flex items-center gap-0.5 shrink-0"
            >
              {hasSkills ? "Update Profile" : "Set up Profile"}
              <ArrowRight className="w-2.5 h-2.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
          Top Skills in Demand
        </h4>
        {skillCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Scanning descriptions…</p>
        ) : (
          <div className="space-y-2.5">
            {skillCounts.map(([skill, count]) => {
              const pct = Math.round((count / allJobsCount) * 100);
              return (
                <div key={skill} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-foreground">{skill}</span>
                    <span className="text-muted-foreground tabular-nums">{pct}% of roles</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-primary/80 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hotSectors.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-border/50">
          <h4 className="text-[10px] font-semibold text-foreground/80 uppercase tracking-wider">
            Trending Sectors
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {hotSectors.map(([sector, count]) => (
              <span
                key={sector}
                className="inline-flex items-center text-[10px] font-medium bg-secondary/60 text-secondary-foreground px-2 py-0.5 rounded-md border border-border/40"
              >
                {sector}
                <span className="ml-1 text-muted-foreground text-[9px] tabular-nums">
                  ({count})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
