import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { ApplyActionLoader } from "./apply-action-loader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ApplicationPreviewPanelProps = {
  className?: string;
  onClose: () => void;
  to: string;
  subject: string;
  body: string;
  letter: string;
  includeCv: boolean;
  cvUrl: string | null;
  cvFileName: string | null;
  cvLoading?: boolean;
  coverLetterDocUrl?: string | null;
  sent?: boolean;
  canSendAutomatically?: boolean;
  applicationUrl?: string | null;
  driveFolderUrl?: string | null;
  onSend: () => void;
  onSave: () => void;
  onSaveToDrive?: () => void;
  sendPending: boolean;
  savePending: boolean;
  saveToDrivePending?: boolean;
  packSavedToDrive?: boolean;
};

function PreviewMetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-3 py-2.5 text-sm border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground min-w-0 break-words">{children}</span>
    </div>
  );
}

function CopyAction({
  label,
  text,
  disabled,
}: {
  label: string;
  text: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !text}
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
      }}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
    >
      <Copy className="w-3.5 h-3.5" />
      Copy
    </button>
  );
}

/** Full-width read-only preview on the Apply tab (replaces compose editors). */
export function ApplicationPreviewPanel({
  className,
  onClose,
  to,
  subject,
  body,
  letter,
  includeCv,
  cvUrl,
  cvFileName,
  cvLoading,
  coverLetterDocUrl,
  sent,
  canSendAutomatically = true,
  applicationUrl,
  driveFolderUrl,
  onSend,
  onSave,
  onSaveToDrive,
  sendPending,
  savePending,
  saveToDrivePending = false,
  packSavedToDrive = false,
}: ApplicationPreviewPanelProps) {
  const [tab, setTab] = useState("email");
  const isPdf = cvFileName?.toLowerCase().endsWith(".pdf");
  const recipient = canSendAutomatically ? to?.trim() || "—" : null;
  const actionBusy = sendPending || saveToDrivePending;

  return (
    <section
      className={cn(
        "relative flex flex-col flex-1 min-h-0 rounded-lg border border-border/60 bg-card shadow-sm overflow-hidden",
        className,
      )}
      aria-label="Application preview"
    >
      {actionBusy && (
        <ApplyActionLoader
          label={saveToDrivePending ? "Saving to Google Drive…" : "Sending email…"}
          className="rounded-lg"
        />
      )}

      <header className="shrink-0 px-4 sm:px-5 pt-4 pb-3 border-b border-border/60 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {canSendAutomatically ? "Preview before sending" : "Preview application pack"}
            </h3>
            <p className="text-sm text-muted-foreground leading-snug">
              {canSendAutomatically
                ? `Review your email, cover letter${includeCv ? ", and CV" : ""} before sending from Gmail.`
                : "This job uses a website or form — copy or save your pack, then submit on the employer's site."}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sent && (
              <Badge variant="secondary" className="font-normal">
                Sent
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-8" onClick={onClose} disabled={actionBusy}>
              <X className="w-3.5 h-3.5 mr-1.5" />
              Back to edit
            </Button>
          </div>
        </div>

        {!canSendAutomatically && (
          <div
            role="status"
            className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-foreground"
          >
            <span className="font-medium text-amber-900 dark:text-amber-100">Manual apply</span>
            <span className="text-muted-foreground">
              {" "}
              — save to Google Drive, then paste into the employer application.
            </span>
            {applicationUrl?.trim() && (
              <>
                {" "}
                <a
                  href={applicationUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Open job application
                </a>
              </>
            )}
          </div>
        )}

        {driveFolderUrl && (
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {packSavedToDrive ? "Open saved Drive folder" : "Open Drive folder"}
          </a>
        )}
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <div className="shrink-0 px-4 sm:px-5 flex items-center justify-between gap-4 border-b border-border/60">
          <TabsList className="h-auto w-auto justify-start gap-5 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="email"
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent"
            >
              Email
            </TabsTrigger>
            <TabsTrigger
              value="letter"
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent"
            >
              Cover letter
            </TabsTrigger>
            <TabsTrigger
              value="cv"
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent gap-1.5"
            >
              CV
              {includeCv && <Paperclip className="w-3 h-3 opacity-60" aria-hidden />}
            </TabsTrigger>
          </TabsList>

          <div className="hidden sm:flex items-center gap-3 pb-2">
            {tab === "email" && (
              <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
            )}
            {tab === "letter" && (
              <CopyAction label="Cover letter" text={letter} disabled={!letter} />
            )}
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-rows-1 overflow-hidden">
          <TabsContent
            value="email"
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none overflow-hidden"
          >
            <div className="shrink-0 px-4 sm:px-5 border-b border-border/60 bg-muted/30">
              {canSendAutomatically ? (
                <PreviewMetaRow label="To">{recipient}</PreviewMetaRow>
              ) : (
                <PreviewMetaRow label="Apply via">
                  <span className="text-muted-foreground">
                    Employer website
                    {applicationUrl?.trim() ? (
                      <>
                        {" "}
                        (
                        <a
                          href={applicationUrl.trim()}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          open listing
                        </a>
                        )
                      </>
                    ) : (
                      " — no email on this listing"
                    )}
                  </span>
                </PreviewMetaRow>
              )}
              <PreviewMetaRow label="Subject">{subject || "—"}</PreviewMetaRow>
            </div>
            <div className="flex-1 min-h-0 max-h-[50vh] sm:max-h-none overflow-y-auto px-4 sm:px-5 py-5">
              <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground">
                {body || "No message yet."}
              </p>
            </div>
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border/60 sm:hidden flex items-center justify-between gap-3">
              <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
              <button
                type="button"
                onClick={() => setTab("letter")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View Cover Letter
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </TabsContent>

          <TabsContent
            value="letter"
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none overflow-hidden"
          >
            <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Cover letter</span>
              <div className="flex items-center gap-3">
                {coverLetterDocUrl && (
                  <a
                    href={coverLetterDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Google Docs
                  </a>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 max-h-[50vh] sm:max-h-none overflow-y-auto px-4 sm:px-5 py-5">
              <p
                className={cn(
                  "whitespace-pre-wrap text-[15px] leading-[1.7] text-foreground",
                  "font-[family-name:var(--font-serif,Georgia,'Times New Roman',serif)]",
                )}
              >
                {letter || "No cover letter generated."}
              </p>
            </div>
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border/60 sm:hidden flex items-center justify-between gap-3">
              <CopyAction label="Cover letter" text={letter} disabled={!letter} />
              <button
                type="button"
                onClick={() => setTab("email")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View Email
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </TabsContent>

          <TabsContent
            value="cv"
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none overflow-hidden"
          >
            {cvLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading CV…
              </div>
            ) : !cvUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No CV on file. Upload one from <span className="text-foreground">My CV</span> in
                  the sidebar.
                </p>
              </div>
            ) : (
              <>
                <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-border/60 text-sm text-muted-foreground">
                  {cvFileName}
                  <span className="mx-2 text-border">·</span>
                  {includeCv ? "Included when you send" : "Not attached — enable on apply screen"}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
                  {isPdf ? (
                    <>
                      <div className="sm:hidden flex flex-col items-center justify-center py-10 px-4 rounded-xl border border-dashed border-border/60 bg-muted/10 gap-3">
                        <FileText className="w-10 h-10 text-[#FD5D28] opacity-80" />
                        <h4 className="font-bold text-sm text-foreground">CV PDF Document</h4>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                          PDF previews may not render well on some mobile screens. Open the document in a new tab for a clean view.
                        </p>
                        <Button size="sm" variant="outline" asChild className="mt-1">
                          <a href={cvUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                            Open CV Document <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      </div>
                      <iframe
                        title="CV preview"
                        src={cvUrl}
                        className="hidden sm:block w-full h-full min-h-[280px] rounded-md border border-border/60 bg-background"
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <FileText className="w-8 h-8 text-muted-foreground/40" />
                      <Button variant="outline" size="sm" asChild>
                        <a href={cvUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open CV
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <footer className="shrink-0 px-4 sm:px-5 py-4 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onSave} disabled={savePending || actionBusy}>
          Save draft
        </Button>
        {onSaveToDrive && (
          packSavedToDrive && driveFolderUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={driveFolderUrl} target="_blank" rel="noreferrer">
                <FolderOpen className="w-4 h-4 mr-1.5" />
                Open Drive folder
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant={canSendAutomatically ? "outline" : "default"}
              onClick={onSaveToDrive}
              disabled={
                packSavedToDrive ||
                actionBusy ||
                !subject.trim() ||
                !body.trim() ||
                !letter.trim()
              }
            >
              {saveToDrivePending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 mr-1.5" />
              )}
              Save to Google Drive
            </Button>
          )
        )}
        {canSendAutomatically && (
          <Button
            size="sm"
            onClick={onSend}
            disabled={actionBusy || sent || !subject.trim() || !body.trim()}
          >
            <Send className="w-4 h-4 mr-1.5" />
            {sent ? "Sent" : "Send via Gmail"}
          </Button>
        )}
      </footer>
    </section>
  );
}
