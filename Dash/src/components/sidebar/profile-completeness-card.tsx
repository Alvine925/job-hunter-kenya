import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

type Props = {
  profileScore: number;
  missingItems: string[];
  onProfileLinkClick?: () => void;
};

export const ProfileCompletenessCard = memo(function ProfileCompletenessCard({
  profileScore,
  missingItems,
  onProfileLinkClick,
}: Props) {
  return (
    <div className="mx-2 mb-2 shrink-0 rounded-xl border border-slate-200/60 dark:border-border/10 bg-slate-50 dark:bg-[#131926] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          Profile completeness
        </span>
        <span className="text-xs font-black text-[#FD5D28] tabular-nums">{profileScore}%</span>
      </div>

      <div className="w-full bg-slate-200/60 dark:bg-muted/30 h-1.5 rounded-full overflow-hidden">
        <div className="bg-[#FD5D28] h-full rounded-full" style={{ width: `${profileScore}%` }} />
      </div>

      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium leading-snug">
          {profileScore < 100 ? "Complete your profile details" : "Your profile is complete!"}
        </span>
        <Link
          to="/profile"
          onClick={onProfileLinkClick}
          className="shrink-0 bg-slate-100 hover:bg-slate-200 dark:bg-muted/20 dark:hover:bg-muted/30 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold py-1 px-2.5 rounded-lg transition-colors flex items-center gap-0.5 border border-slate-200/50 dark:border-border/10"
        >
          <span>{profileScore < 100 ? "Edit" : "View"}</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </Link>
      </div>

      {profileScore < 100 && missingItems.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-200/40 dark:border-border/5 text-[9.5px]">
          <div className="text-slate-400 dark:text-slate-500 font-bold mb-1 uppercase tracking-wider text-[8.5px]">
            Needs improvement
          </div>
          <div className="flex flex-wrap gap-1">
            {missingItems.slice(0, 3).map((item) => (
              <span
                key={item}
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400/90 px-1.5 py-0.5 rounded text-[8.5px] font-bold border border-amber-500/10"
              >
                + {item}
              </span>
            ))}
            {missingItems.length > 3 && (
              <span className="text-slate-400 dark:text-slate-500 text-[8.5px] font-semibold self-center">
                +{missingItems.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
