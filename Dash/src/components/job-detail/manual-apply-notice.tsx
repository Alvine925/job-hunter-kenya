import { cn } from "@/lib/utils";

type Props = {
  driveFolderUrl?: string | null;
  className?: string;
};

/** Shown when the listing has no apply-to email — manual Drive + employer site flow. */
export function ManualApplyNotice({ className }: Props) {
  return (
    <p
      className={cn(
        "text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 font-normal py-1.5",
        className,
      )}
    >
      This listing has no apply-to email. Save your email, cover letter, and CV to Google Drive,
      then submit on the employer&apos;s website or form.
    </p>
  );
}
