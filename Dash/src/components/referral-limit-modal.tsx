import { useMemo, useState } from "react";
import {
  ArrowRight,
  Gift,
  Link as LinkIcon,
  Linkedin,
  Mail,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import welcomeImage from "@/assets/auth-hero-signin-2.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type ReferralLimitModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: Record<string, unknown> | null;
  used?: number;
  limit?: number;
  actionLabel?: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstNameFromProfile(profile?: Record<string, unknown> | null) {
  const name = asString(profile?.full_name) || asString(profile?.email).split("@")[0];
  return name.split(/\s+/)[0] || "there";
}

export function ReferralLimitModal({
  open,
  onOpenChange,
  profile,
  used = 1,
  limit = 2,
  actionLabel = "workspace action",
}: ReferralLimitModalProps) {
  const [copied, setCopied] = useState(false);
  const firstName = firstNameFromProfile(profile);
  const referralCode = asString(profile?.referral_code);
  const origin =
    typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
  const referralLink = referralCode ? `${origin}/login?ref=${referralCode}` : origin;
  const remaining = Math.max(limit - used, 0);
  const shareText = `Join me on Tellus Workspace and unlock smarter job applications: ${referralLink}`;

  const shareLinks = useMemo(
    () => ({
      email: `mailto:?subject=${encodeURIComponent("Join me on Tellus Workspace")}&body=${encodeURIComponent(shareText)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    }),
    [referralLink, shareText],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] gap-0 overflow-hidden overflow-y-auto border-0 bg-white p-0 shadow-2xl shadow-slate-950/35 sm:max-w-[640px] sm:rounded-2xl [&>button]:hidden">
        <div className="relative min-h-[190px] overflow-hidden bg-slate-950 sm:min-h-[250px]">
          <img
            src={welcomeImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/5" />
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-lg backdrop-blur transition hover:bg-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="absolute inset-0 flex items-center px-5 py-5 sm:px-8">
            <div className="max-w-[310px] text-white">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-4 items-end gap-0.5 text-[#FD5D28]" aria-hidden="true">
                  <span className="h-1.5 w-1 rounded-full bg-current" />
                  <span className="h-3 w-1 rounded-full bg-current" />
                  <span className="h-4 w-1 rounded-full bg-current" />
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.24em]">
                  Tellus Workspace
                </span>
              </div>
              <DialogTitle className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">
                You&apos;re nearing your limit ⚡
              </DialogTitle>
              <p className="mt-3 max-w-[270px] text-xs font-medium leading-5 text-white/90 sm:text-sm">
                Nice work, {firstName}. You used your first {actionLabel}. Invite a colleague to
                unlock more workspace access.
              </p>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 hidden rounded-lg border border-white/10 bg-slate-950/60 p-4 text-white shadow-xl backdrop-blur-md sm:block">
            <p className="text-[10px] font-semibold text-white/65">Workspace limit</p>
            <p className="mt-1 text-3xl font-black text-[#FD5D28]">
              {used}/{limit}
            </p>
            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[#FD5D28]"
                style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] font-semibold text-white/70">
              {remaining} invite{remaining === 1 ? "" : "s"} left
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-8">
          <section className="rounded-lg border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">
              Invite a colleague. Unlock more.
            </h3>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200">
              {[
                { icon: UserPlus, title: "+1 access", body: "Unlock more room." },
                { icon: Sparkles, title: "Stronger", body: "Build together." },
                { icon: Gift, title: "Win-win", body: "They get access." },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="px-2 text-center first:pl-0 last:pr-0">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0EA] text-[#FD5D28]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-[11px] font-black text-slate-950 sm:text-xs">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium leading-4 text-slate-500">
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-700">Your referral link</p>
                <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <LinkIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-xs font-semibold text-slate-600">
                    {referralLink}
                  </span>
                  <button
                    onClick={copyLink}
                    className="shrink-0 rounded-md bg-[#FD5D28] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#E94F1F]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-4 text-[11px] font-bold text-slate-700">Share via</p>
                <div className="mt-2 flex gap-2">
                  <a
                    href={shareLinks.email}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-[#FD5D28]"
                    aria-label="Share by email"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                  <a
                    href={shareLinks.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-blue-600 transition hover:bg-blue-50"
                    aria-label="Share on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                  <a
                    href={shareLinks.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-emerald-600 transition hover:bg-emerald-50"
                    aria-label="Share on WhatsApp"
                  >
                    <span className="text-xs font-black">WA</span>
                  </a>
                  <button
                    onClick={copyLink}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-[#FD5D28]"
                    aria-label="Copy referral link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="hidden h-24 w-24 items-center justify-center rounded-xl bg-[#FFF0EA] text-[#FD5D28] sm:flex">
                <UserPlus className="h-10 w-10" />
              </div>
            </div>
          </section>

          <Button
            onClick={copyLink}
            className="h-11 w-full rounded-lg bg-[#FD5D28] text-sm font-black shadow-lg shadow-orange-500/20 hover:bg-[#E94F1F]"
          >
            Invite & unlock more access
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-[10px] font-medium text-slate-500">
            Pro tip: invite professionals you know and help them discover better opportunities.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
