import { useState, type ReactNode } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

if (typeof window !== "undefined") {
  (window as any).html2canvas = html2canvas;
}

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
  Sparkles,
  RefreshCw,
  Download,
} from "lucide-react";
import { ApplyActionLoader } from "./apply-action-loader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApplyComposeField } from "./apply-compose-field";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

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
  tailoredCv?: string | null;
  onTailoredCvChange?: (v: string) => void;
  isTailoringCv?: boolean;
  onTailorCv?: () => void;
};

function PreviewMetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[4.5rem_1fr] gap-1 sm:gap-3 py-2 sm:py-2.5 text-sm border-b border-border/60 last:border-0 min-w-0">
      <span className="text-muted-foreground text-xs sm:text-sm">{label}</span>
      <span className="text-foreground min-w-0 break-words text-xs sm:text-sm">{children}</span>
    </div>
  );
}

export function CopyAction({
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

// ── DOCUMENT EXPORTERS ─────────────────────────────────────────

export const parseMarkdownInline = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/__(.*?)__/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>");
};

export const exportToWord = (title: string, htmlContent: string, docType: "email" | "letter" | "cv") => {
  const fontStack = docType === "letter" 
    ? "'Georgia', 'Times New Roman', serif" 
    : "Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const marginStyle = docType === "email" ? "0.5in" : "1in";
  
  const header = `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
        `xmlns:w="urn:schemas-microsoft-com:office:word" ` +
        `xmlns="http://www.w3.org/TR/REC-html40">` +
        `<head><title>${title}</title>` +
        `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->` +
        `<style>` +
        `body { font-family: ${fontStack}; font-size: 11pt; line-height: 1.65; margin: ${marginStyle}; color: #0f172a; }` +
        `h1 { font-size: 19pt; font-weight: bold; text-align: center; margin-bottom: 18pt; text-transform: uppercase; color: #0f172a; }` +
        `h2 { font-size: 13pt; font-weight: bold; margin-top: 22pt; margin-bottom: 10pt; border-bottom: 1.5px solid #1e293b; padding-bottom: 4px; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }` +
        `p { margin-bottom: 12pt; text-align: justify; }` +
        `ul { margin-top: 5pt; margin-bottom: 12pt; padding-left: 20px; }` +
        `li { margin-bottom: 6pt; text-align: justify; }` +
        `strong { font-weight: bold; color: #0f172a; }` +
        `</style></head><body>`;
  const footer = `</body></html>`;
  const source = header + htmlContent + footer;
  
  const blob = new Blob([source], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\s\W]+/g, "_")}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const exportToPdf = async (
  title: string,
  rawText: string,
  docType: "email" | "letter" | "cv",
  subject?: string
) => {
  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    const pageHeight = 842;
    const pageWidth = 595;
    const margin = 54; // 0.75 in margins
    const contentWidth = pageWidth - (margin * 2); // 487 pt
    const bottomMargin = pageHeight - margin; // 788 pt

    let y = margin;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > bottomMargin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Helper to draw wrapped paragraph text with inline bolding
    const drawParagraphWithBolding = (
      text: string,
      fontSize: number,
      fontName: string,
      lineSpacing = 1.45,
      isBullet = false
    ) => {
      doc.setFont(fontName, "normal");
      doc.setFontSize(fontSize);
      const lineHeight = fontSize * lineSpacing;

      let xOffset = margin;
      let width = contentWidth;

      if (isBullet) {
        xOffset = margin + 14;
        width = contentWidth - 14;
      }

      // Draw bullet point indicator
      if (isBullet) {
        checkPageBreak(lineHeight);
        doc.setFont(fontName, "bold");
        doc.text("•", margin + 4, y);
        doc.setFont(fontName, "normal");
      }

      // Split text by words and spaces to wrap properly at word boundaries
      const tokens = text.split(/(\s+)/);
      let currentX = xOffset;
      let isBold = false;

      checkPageBreak(lineHeight);

      tokens.forEach((token) => {
        if (!token) return;

        // If it's a space or tab spacing
        if (token.trim() === "") {
          const spaceWidth = doc.getTextWidth(" ");
          if (currentX + spaceWidth > xOffset + width) {
            y += lineHeight;
            checkPageBreak(lineHeight);
            currentX = xOffset;
          } else {
            currentX += spaceWidth;
          }
          return;
        }

        // It's a word. Check for bold markers ** inside
        const parts = token.split(/(\*\*)/g);
        const cleanToken = token.replace(/\*\*/g, "");
        const tokenWidth = doc.getTextWidth(cleanToken);

        if (currentX + tokenWidth > xOffset + width) {
          y += lineHeight;
          checkPageBreak(lineHeight);
          currentX = xOffset;
        }

        parts.forEach((part) => {
          if (part === "**") {
            isBold = !isBold;
          } else if (part) {
            doc.setFont(fontName, isBold ? "bold" : "normal");
            doc.text(part, currentX, y);
            currentX += doc.getTextWidth(part);
          }
        });
      });

      y += lineHeight;
    };

    const drawContent = (text: string, fontSize: number, fontName: string, lineSpacing = 1.45) => {
      const lines = text.split("\n");
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine === "") {
          y += fontSize * 0.8; // empty paragraph line gap
          return;
        }
        
        let lineText = line;
        // Auto-bold RE: or Subject: lines in cover letters
        if (docType === "letter" && (trimmedLine.toUpperCase().startsWith("RE:") || trimmedLine.toUpperCase().startsWith("SUBJECT:"))) {
          if (!trimmedLine.startsWith("**")) {
            lineText = `**${trimmedLine}**`;
          }
        }
        
        drawParagraphWithBolding(lineText, fontSize, fontName, lineSpacing, false);
      });
    };

    if (docType === "letter") {
      const fontName = "Times"; // Classic serif cover letter font
      drawContent(rawText, 11, fontName, 1.45);

    } else if (docType === "email") {
      const fontName = "Helvetica";
      
      // Render clean email headers
      doc.setFont(fontName, "bold");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("TO:", margin, y);
      
      doc.setFont(fontName, "normal");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("Hiring Team", margin + 70, y);
      y += 16;
      
      doc.setFont(fontName, "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("SUBJECT:", margin, y);
      
      doc.setFont(fontName, "normal");
      doc.setTextColor(15, 23, 42);
      
      const subjectLines = doc.splitTextToSize(subject || "—", contentWidth - 70);
      subjectLines.forEach((line: string) => {
        doc.text(line, margin + 70, y);
        y += 16;
      });
      
      y += 4;
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 24;
      
      // Reset color
      doc.setTextColor(15, 23, 42);
      
      // Render body text
      drawContent(rawText, 10.5, fontName, 1.45);

    } else if (docType === "cv") {
      const fontName = "Helvetica";
      const lines = rawText.split("\n");
      
      let isHeaderBlock = true;

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          y += 6;
          return;
        }

        // Section Header detection (e.g. starts with #, or all uppercase and short)
        const isSectionHeader = 
          trimmed.startsWith("#") || 
          (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50 && !trimmed.includes("|") && !trimmed.includes("@"));

        if (isSectionHeader) {
          isHeaderBlock = false;
          let headerText = trimmed.replace(/^#+\s*/, "").toUpperCase();
          
          checkPageBreak(35);
          y += 12; // top spacing
          
          doc.setFont(fontName, "bold");
          doc.setFontSize(11.5);
          doc.setTextColor(15, 23, 42);
          doc.text(headerText, margin, y);
          
          y += 4;
          // Thin divider line
          doc.setDrawColor(30, 41, 59); // #1e293b slate-800
          doc.setLineWidth(0.75);
          doc.line(margin, y, pageWidth - margin, y);
          
          y += 12;
          return;
        }

        if (isHeaderBlock) {
          checkPageBreak(16);
          if (y === margin || doc.getFontSize() === 11.5) {
            // Centered name
            doc.setFont(fontName, "bold");
            doc.setFontSize(18);
            doc.setTextColor(15, 23, 42);
            doc.text(trimmed, pageWidth / 2, y, { align: "center" });
            y += 20;
          } else {
            // Centered contact info
            doc.setFont(fontName, "normal");
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105); // #475569 slate-600
            doc.text(trimmed, pageWidth / 2, y, { align: "center" });
            y += 13;
          }
          return;
        }

        // Content body text style
        doc.setTextColor(51, 65, 85); // #334155 slate-700
        
        if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
          // Bullet point
          const bulletContent = trimmed.substring(1).trim();
          drawParagraphWithBolding(bulletContent, 10, fontName, 1.4, true);
          y += 4;
        } else {
          // Normal CV text block (handles roles with "|" and standard paragraphs with inline bolding)
          drawParagraphWithBolding(trimmed, 10, fontName, 1.4, false);
          y += 6;
        }
      });
    }

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 20,
        { align: "center" }
      );
    }

    doc.save(`${title.replace(/[\s\W]+/g, "_")}.pdf`);
    toast.success("PDF downloaded successfully!");
  } catch (err) {
    console.error("PDF generation failed", err);
    toast.error("Failed to generate PDF document.");
  }
};

export const formatCoverLetterHtml = (text: string) => {
  if (!text) return "";
  const paragraphs = text.split("\n\n").filter(Boolean);
  return paragraphs
    .map((p, idx) => {
      let trimmed = p.trim();
      
      // Auto-bold RE: or Subject: lines
      const isReLine = trimmed.toUpperCase().startsWith("RE:") || trimmed.toUpperCase().startsWith("SUBJECT:");
      if (isReLine && !trimmed.startsWith("**")) {
        trimmed = `**${trimmed}**`;
      }
      
      const parsed = parseMarkdownInline(trimmed).replace(/\n/g, "<br />");
      
      if (idx === 0 && (trimmed.includes("\n") || trimmed.length < 150)) {
        return `<div style="font-size: 11pt; line-height: 1.5; margin-bottom: 24pt; color: #475569; text-align: left;">${parsed}</div>`;
      }
      
      if (idx === paragraphs.length - 1 && (trimmed.toLowerCase().includes("sincerely") || trimmed.toLowerCase().includes("regards") || trimmed.length < 100)) {
        return `<div style="margin-top: 24pt; line-height: 1.6; color: #0f172a;">${parsed}</div>`;
      }
      
      return `<p style="margin-bottom: 14pt; text-align: justify; line-height: 1.65; color: #0f172a; text-justify: inter-word;">${parsed}</p>`;
    })
    .join("");
};

export const formatEmailHtml = (subject: string, body: string) => {
  const formattedBody = parseMarkdownInline(body || "No message body.")
    .replace(/\n/g, "<br />");
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 12px; color: #334155;">
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 8.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Subject</div>
        <div style="font-size: 11.5pt; font-weight: bold; color: #0f172a;">${subject || "—"}</div>
      </div>
      <div style="font-size: 11pt; line-height: 1.65;">${formattedBody}</div>
    </div>
  `;
};

export const formatCvHtml = (text: string) => {
  if (!text) return "";
  const lines = text.split("\n");
  let html = "";
  let inList = false;
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      return;
    }
    
    // Detect bullet points
    if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
      if (!inList) {
        html += "<ul style='margin-bottom: 12px; padding-left: 20px;'>";
        inList = true;
      }
      const content = parseMarkdownInline(trimmed.substring(1).trim());
      html += `<li style="margin-bottom: 6px; line-height: 1.55; text-align: justify; color: #334155;">${content}</li>`;
    } else {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      
      let isHeader = false;
      let headerText = trimmed;
      if (trimmed.startsWith("###")) {
        isHeader = true;
        headerText = trimmed.replace(/^###\s*/, "");
      } else if (trimmed.startsWith("##")) {
        isHeader = true;
        headerText = trimmed.replace(/^##\s*/, "");
      } else if (trimmed.startsWith("#")) {
        isHeader = true;
        headerText = trimmed.replace(/^#\s*/, "");
      } else if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 50 && !trimmed.match(/^\d+$/)) {
        isHeader = true;
      }
      
      if (isHeader) {
        html += `<h2 style="font-size: 13pt; margin-top: 22pt; margin-bottom: 10pt; border-bottom: 1.5px solid #1e293b; padding-bottom: 4px; font-weight: bold; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">${parseMarkdownInline(headerText)}</h2>`;
      } else if (html === "") {
        html += `<h1 style="font-size: 20pt; text-align: center; margin-bottom: 6px; font-weight: bold; color: #0f172a; letter-spacing: -0.5px;">${parseMarkdownInline(trimmed)}</h1>`;
      } else if (trimmed.includes("|") || trimmed.includes("@") || trimmed.includes("+") || trimmed.toLowerCase().includes("email") || trimmed.toLowerCase().includes("phone")) {
        html += `<div style="text-align: center; font-size: 9.5pt; color: #475569; margin-bottom: 18px; line-height: 1.4;">${parseMarkdownInline(trimmed)}</div>`;
      } else {
        html += `<p style="margin-bottom: 10px; line-height: 1.55; text-align: justify; color: #334155; text-justify: inter-word;">${parseMarkdownInline(trimmed)}</p>`;
      }
    }
  });
  
  if (inList) {
    html += "</ul>";
  }
  
  return html;
};

export function ExportButton({
  title,
  htmlContent,
  rawText,
  subject,
  docType,
  disabled,
}: {
  title: string;
  htmlContent: () => string;
  rawText: string;
  subject?: string;
  docType: "email" | "letter" | "cv";
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors cursor-pointer select-none"
        >
          <Download className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Export</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 z-[120]">
        <DropdownMenuItem
          className="cursor-pointer text-xs"
          onClick={() => exportToPdf(title, rawText, docType, subject)}
        >
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-xs"
          onClick={() => exportToWord(title, htmlContent(), docType)}
        >
          Export as Word
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  tailoredCv,
  onTailoredCvChange,
  isTailoringCv = false,
  onTailorCv,
}: ApplicationPreviewPanelProps) {
  const [tab, setTab] = useState("letter");
  const isPdf = cvFileName?.toLowerCase().endsWith(".pdf");
  const recipient = canSendAutomatically ? to?.trim() || "—" : null;
  const actionBusy = sendPending || saveToDrivePending;

  return (
    <section
      className={cn(
        "relative flex flex-col flex-1 min-h-0 bg-background shadow-none sm:bg-card sm:shadow-sm sm:rounded-lg sm:border sm:border-border/60 sm:overflow-hidden",
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {canSendAutomatically ? "Preview before sending" : "Preview application pack"}
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              {sent && (
                <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
                  Sent
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={onClose} disabled={actionBusy}>
                <X className="w-3.5 h-3.5 mr-1" />
                <span>Back to edit</span>
              </Button>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
            {canSendAutomatically
              ? `Review your email, cover letter${includeCv ? ", and CV" : ""} before sending from Gmail.`
              : "This job uses a website or form — copy or save your pack, then submit on the employer's site."}
          </p>
        </div>



      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex flex-col flex-1 min-h-0 sm:overflow-hidden"
      >
        <div className="shrink-0 px-4 sm:px-5 flex items-center justify-between gap-4 border-b border-border/60 overflow-x-auto scrollbar-none">
          <TabsList className="h-auto w-auto justify-start gap-5 rounded-none bg-transparent p-0 flex-nowrap shrink-0">
            <TabsTrigger
              value="letter"
              className={cn(
                "rounded-none px-0 pb-3 pt-3 text-sm font-medium bg-transparent transition-all",
                tab === "letter"
                  ? "border-b-2 border-primary text-foreground !bg-transparent !shadow-none"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Cover letter
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className={cn(
                "rounded-none px-0 pb-3 pt-3 text-sm font-medium bg-transparent transition-all",
                tab === "email"
                  ? "border-b-2 border-primary text-foreground !bg-transparent !shadow-none"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Email
            </TabsTrigger>
            <TabsTrigger
              value="cv"
              className={cn(
                "rounded-none px-0 pb-3 pt-3 text-sm font-medium bg-transparent transition-all",
                tab === "cv"
                  ? "border-b-2 border-primary text-foreground !bg-transparent !shadow-none"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Tailored CV
            </TabsTrigger>
          </TabsList>

          <div className="hidden sm:flex items-center gap-4 pb-2">
            {tab === "letter" && (
              <>
                <CopyAction label="Cover letter" text={letter} disabled={!letter} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Cover Letter - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatCoverLetterHtml(letter)}
                  rawText={letter}
                  docType="letter"
                  disabled={!letter}
                />
              </>
            )}
            {tab === "email" && (
              <>
                <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Email - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatEmailHtml(subject, body)}
                  rawText={body}
                  subject={subject}
                  docType="email"
                  disabled={!body}
                />
              </>
            )}
            {tab === "cv" && (
              <>
                <CopyAction label="Tailored CV" text={tailoredCv || ""} disabled={!tailoredCv} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Tailored CV - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatCvHtml(tailoredCv || "")}
                  rawText={tailoredCv || ""}
                  docType="cv"
                  disabled={!tailoredCv}
                />
              </>
            )}
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-rows-1 sm:overflow-hidden">
          <TabsContent
            value="email"
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none sm:overflow-hidden"
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
            <div className="flex-1 min-h-0 sm:max-h-none overflow-y-auto px-4 sm:px-5 py-5">
              <p className="whitespace-pre-wrap text-sm sm:text-[15px] leading-[1.7] text-foreground">
                {body || "No message yet."}
              </p>
            </div>
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border/60 sm:hidden flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <CopyAction label="Email" text={`Subject: ${subject}\n\n${body}`} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Email - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatEmailHtml(subject, body)}
                  rawText={body}
                  subject={subject}
                  docType="email"
                  disabled={!body}
                />
              </div>
              <button
                type="button"
                onClick={() => setTab("cv")}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                View Tailored CV
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </TabsContent>

          <TabsContent
            value="letter"
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none sm:overflow-hidden"
          >
            {/* Header row without bottom border line */}
            <div className="shrink-0 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
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
            <div className="flex-1 min-h-0 sm:max-h-none overflow-y-auto px-4 sm:px-5 py-5">
              <p
                className={cn(
                  "whitespace-pre-wrap text-sm sm:text-[15px] leading-[1.7] text-foreground",
                  "font-[family-name:var(--font-serif,Georgia,'Times New Roman',serif)]",
                )}
              >
                {letter || "No cover letter generated."}
              </p>
            </div>
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border/60 sm:hidden flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <CopyAction label="Cover letter" text={letter} disabled={!letter} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Cover Letter - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatCoverLetterHtml(letter)}
                  rawText={letter}
                  docType="letter"
                  disabled={!letter}
                />
              </div>
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
            className="row-start-1 col-start-1 flex flex-col min-h-0 mt-0 outline-none focus-visible:ring-0 data-[state=inactive]:hidden data-[state=inactive]:pointer-events-none sm:overflow-hidden"
          >
            {cvLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading CV…
              </div>
            ) : isTailoringCv ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">Tailoring CV to job description...</p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  AI is aligning your skills, achievements, and experiences to match the employer's requirements. This may take up to a minute.
                </p>
              </div>
            ) : tailoredCv ? (
              <div className="flex-1 flex flex-col min-h-0 sm:overflow-hidden">
                {onTailorCv && (
                  <div className="shrink-0 px-3 sm:px-5 py-2 bg-muted/30 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={onTailorCv}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate<span className="hidden sm:inline"> CV</span></span>
                    </button>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-5 bg-background">
                  <ApplyComposeField
                    value={tailoredCv}
                    onChange={onTailoredCvChange || (() => {})}
                    serif
                    minHeightPx={280}
                    className="w-full h-full min-h-[280px]"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                <Sparkles className="w-10 h-10 text-primary/70 animate-pulse" />
                <div>
                  <h4 className="font-bold text-sm text-foreground">No Tailored CV yet</h4>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                    Align your achievements, skills, and work history to match this employer's requirements.
                  </p>
                </div>
                {onTailorCv && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 text-xs font-semibold bg-gradient-to-r from-primary to-orange-500 hover:from-primary/95 hover:to-orange-500/95 shadow-sm text-white border-0 px-4"
                    onClick={onTailorCv}
                    disabled={isTailoringCv}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Tailor CV for this job
                  </Button>
                )}
              </div>
            )}
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-t border-border/60 sm:hidden flex items-center justify-between gap-3 bg-muted/20">
              <div className="flex items-center gap-3.5">
                <CopyAction label="Tailored CV" text={tailoredCv || ""} disabled={!tailoredCv} />
                <span className="w-px h-3.5 bg-border/60" />
                <ExportButton
                  title={`Tailored CV - ${cvFileName ? cvFileName.replace(/\.[^/.]+$/, "") : "Application"}`}
                  htmlContent={() => formatCvHtml(tailoredCv || "")}
                  rawText={tailoredCv || ""}
                  docType="cv"
                  disabled={!tailoredCv}
                />
              </div>
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
        </div>
      </Tabs>

      <footer className="shrink-0 px-4 sm:px-5 py-4 border-t border-border/60 bg-muted/20 flex flex-wrap items-center justify-end gap-2">

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
