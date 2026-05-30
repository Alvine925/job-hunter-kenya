import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LearnMoreLink, LearnMoreSlider } from "@/components/cos/learn-more-slider";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileText,
  ChevronDown,
  Download,
  Star,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { exportToPdf } from "@/components/job-detail/application-preview-panel";

export const Route = createFileRoute("/_authenticated/cos/cv-versions")({
  head: () => ({
    title: "CV Versions - Tellus",
    meta: [
      { title: "CV Versions - Tellus" },
      { name: "description", content: "Manage multiple CV variants and track which resume versions yield the highest interview conversion rates." },
    ],
  }),
  component: CvVersionsPage,
});

interface CvVersion {
  id: string;
  name: string;
  tag: string;
  created_at: string;
  applicationsCount: number;
  responseRate: number;
  isDefault: boolean;
  path?: string;
}

const DEFAULT_CVS: CvVersion[] = [
  { id: "cv-1", name: "Alvine Otieno - Full Stack Engineer.pdf", tag: "Full-Stack Dev", created_at: "2026-05-10", applicationsCount: 46, responseRate: 38, isDefault: true },
  { id: "cv-2", name: "Alvine Otieno - Technical PM.pdf", tag: "Product Lead", created_at: "2026-05-18", applicationsCount: 32, responseRate: 45, isDefault: false },
  { id: "cv-3", name: "Alvine Otieno - Consultant.pdf", tag: "NGO Consultant", created_at: "2026-05-22", applicationsCount: 18, responseRate: 24, isDefault: false },
];

/* ─── CV Text Parser ─── */
interface CvSection {
  heading: string;
  type: "prose" | "list";
  items: { title: string; detail?: string }[];
}

function parseCvText(raw: string): CvSection[] {
  let lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // If the entire text is flattened into 1-2 lines but contains " - " delimiters, split by that instead
  if (lines.length <= 2 && raw.includes(" - ") && raw.length > 150) {
    lines = raw.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
  }

  const sections: CvSection[] = [];
  let currentSection: CvSection = { heading: "Contact Info", type: "prose", items: [] };

  const knownHeaders = [
    "PROFESSIONAL SUMMARY",
    "SUMMARY",
    "WORK EXPERIENCE",
    "WORK HISTORY",
    "EXPERIENCE",
    "PROFESSIONAL EXPERIENCE",
    "EDUCATION",
    "ACADEMIC BACKGROUND",
    "CERTIFICATIONS",
    "CERTIFICATES",
    "SKILLS",
    "CORE COMPETENCIES",
    "TECHNICAL SKILLS",
    "LANGUAGES",
    "REFERENCES",
    "PROJECTS",
    "PUBLICATIONS",
    "VOLUNTEER EXPERIENCE",
    "VOLUNTEERING",
    "INTERESTS",
    "HOBBIES"
  ];

  for (const line of lines) {
    // Standardize text for heading check
    const cleanHeaderCheck = line.toUpperCase().replace(/[:\s]+$/, "").trim();
    const isKnownHeader = knownHeaders.includes(cleanHeaderCheck);

    // Check if it's all caps, of reasonable header length (3 to 45 chars) and matches normal letters/symbols
    const isAllCapsHeader =
      line.length >= 3 &&
      line.length <= 45 &&
      line === line.toUpperCase() &&
      /^[A-Z\s&/,:-]+$/.test(line);

    if (isKnownHeader || isAllCapsHeader) {
      // Save previous section if it has items
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }

      const heading = isKnownHeader
        ? cleanHeaderCheck.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")
        : line.split(" ").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");

      // Infer if this section is list-based
      const headingLower = heading.toLowerCase();
      const isListType =
        headingLower.includes("skill") ||
        headingLower.includes("experience") ||
        headingLower.includes("history") ||
        headingLower.includes("education") ||
        headingLower.includes("certification") ||
        headingLower.includes("languages") ||
        headingLower.includes("references") ||
        headingLower.includes("projects") ||
        headingLower.includes("hobbies");

      currentSection = {
        heading,
        type: isListType ? "list" : "prose",
        items: [],
      };
    } else {
      // Strip starting bullets, hyphens or list symbols
      const cleanLine = line.replace(/^[\s-•*▪◦➔➢]+/, "").trim();
      if (!cleanLine) continue;

      // Force list type if it clearly started with a list item character
      const isBulletPattern = /^[\s-•*▪◦➔➢]/.test(line);
      if (isBulletPattern) {
        currentSection.type = "list";
      }

      // Check if it contains a label: value pattern (e.g. "Database: PostgreSQL")
      const colonIdx = cleanLine.indexOf(":");
      if (colonIdx > 0 && colonIdx < 50 && !cleanLine.startsWith("http")) {
        currentSection.items.push({
          title: cleanLine.slice(0, colonIdx).trim(),
          detail: cleanLine.slice(colonIdx + 1).trim(),
        });
      } else {
        currentSection.items.push({ title: cleanLine });
      }
    }
  }

  // Push the final section
  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/** Detect if a CV "name" is actually raw text content vs a real filename */
function isCvRawText(name: string): boolean {
  const fileExtPattern = /\.(pdf|docx?|txt|rtf|odt)$/i;
  if (fileExtPattern.test(name.trim())) return false;
  if (name.length > 80) return true;
  if (name.includes(" - ") && name.length > 50) return true;
  return false;
}

/* ─── Inline CV Preview ─── */
function CvPreviewPanel({ cv, profileData }: { cv: CvVersion; profileData: any }) {
  const isRawText = isCvRawText(cv.name);
  const fullName = profileData?.full_name || "Alvine Otieno";

  if (isRawText) {
    const sections = parseCvText(cv.name);

    // Extract metadata/contact line to render elegantly below title instead of standard section
    const hasContactHeader = sections[0]?.heading === "Contact Info";
    const contactInfoSection = hasContactHeader ? sections[0] : null;
    const displaySections = hasContactHeader ? sections.slice(1) : sections;

    return (
      <div className="py-2 px-1 sm:px-2 space-y-6">
        {/* Name and Header info */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h2 className="text-lg font-black tracking-tight text-foreground leading-none uppercase">{fullName}</h2>
            <p className="text-[10px] font-black uppercase tracking-wider text-[#FD5D28]">Tailored Resume</p>
          </div>

          {contactInfoSection && contactInfoSection.items.length > 0 && (
            <div className="text-[10px] text-muted-foreground/80 font-medium flex flex-wrap gap-x-2 gap-y-1 pt-0.5 border-t border-slate-100 dark:border-border/5">
              {contactInfoSection.items.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-slate-300 dark:text-border/20">•</span>}
                  <span>{item.detail ? `${item.title}: ${item.detail}` : item.title}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="h-px bg-gradient-to-r from-[#FD5D28]/30 via-slate-200/50 to-transparent dark:via-border/10" />

        {/* Parsed sections */}
        <div className="space-y-5">
          {displaySections.map((section, si) => (
            <div key={si} className="space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 pb-0.5 border-b border-slate-100/50 dark:border-border/5">
                {section.heading}
              </h4>

              {section.type === "list" ? (
                <ul className="space-y-1.5">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FD5D28]/30 mt-[7px] shrink-0" />
                      <div>
                        {item.detail ? (
                          <>
                            <span className="font-semibold text-foreground/90">{item.title}:</span>{" "}
                            <span>{item.detail}</span>
                          </>
                        ) : (
                          <span>{item.title}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2.5">
                  {section.items.map((item, ii) => (
                    <p key={ii} className="text-xs text-muted-foreground leading-relaxed">
                      {item.detail ? (
                        <>
                          <span className="font-bold text-foreground/95">{item.title}:</span>{" "}
                          <span>{item.detail}</span>
                        </>
                      ) : (
                        <span>{item.title}</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-border/5">
          <button
            onClick={async () => {
              try {
                const fullText = cv.path || cv.name;
                const docTitle = cv.name.replace(/[\s\W]+/g, "_");
                await exportToPdf(docTitle, fullText, "cv");
              } catch (err) {
                console.error("PDF download failed:", err);
                toast.error("Failed to download PDF.");
              }
            }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FD5D28] hover:text-[#FD5D28]/80 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
          {!cv.isDefault && (
            <button
              onClick={() => toast.info("This will set your default resume for all new applications.")}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-foreground transition-colors"
            >
              <Star className="w-3.5 h-3.5" />
              Set as Default
            </button>
          )}
        </div>
      </div>
    );
  }

  // File-based CV — show profile data preview
  const summary = profileData?.professional_summary;
  const skills: string[] = profileData?.skills || [];
  const workHistory = profileData?.work_history;

  return (
    <div className="py-5 px-1 sm:px-3 space-y-5">
      {/* Name block */}
      <div className="space-y-0.5">
        <h2 className="text-base font-black tracking-tight text-foreground leading-none">{fullName}</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#FD5D28]">
          {cv.tag !== "Primary Default" ? cv.tag : "Professional Resume"}
        </p>
      </div>
      <div className="h-px bg-gradient-to-r from-[#FD5D28]/30 via-slate-200/60 to-transparent dark:via-border/10" />

      {/* Summary */}
      {summary && (
        <div className="space-y-1.5">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Summary</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Skills</h4>
          <div className="flex flex-wrap gap-1">
            {skills.slice(0, 12).map((skill: string, i: number) => (
              <span
                key={i}
                className="px-2 py-[3px] text-[10px] font-semibold rounded-md bg-slate-100/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200/40 dark:border-border/10"
              >
                {skill}
              </span>
            ))}
            {skills.length > 12 && (
              <span className="px-2 py-[3px] text-[10px] font-semibold text-muted-foreground">
                +{skills.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Work History */}
      {workHistory && (
        <div className="space-y-1.5">
          <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Experience</h4>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-6">{workHistory}</p>
        </div>
      )}

      {!summary && skills.length === 0 && !workHistory && (
        <p className="text-xs text-muted-foreground/60 italic">
          Complete your profile to see a richer preview here.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-border/5">
        <button
          onClick={async () => {
            try {
              const storagePath = cv.path;
              if (!storagePath) {
                toast.error("CV storage path not found.");
                return;
              }
              const { data, error } = await supabase.storage
                .from("cvs")
                .createSignedUrl(storagePath, 3600);

              if (error || !data?.signedUrl) {
                console.error("Failed to get storage URL:", error);
                throw new Error("Could not retrieve file download link.");
              }

              window.open(data.signedUrl, "_blank");
              toast.success("Downloading CV file...");
            } catch (err) {
              console.error("File download failed:", err);
              toast.error("Failed to download resume file.");
            }
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#FD5D28] hover:text-[#FD5D28]/80 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
        {!cv.isDefault && (
          <button
            onClick={() => toast.info("This will set your default resume for all new applications.")}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-foreground transition-colors"
          >
            <Star className="w-3.5 h-3.5" />
            Set as Default
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Single CV Row (Accordion Item) ─── */
function CvRow({
  cv,
  isOpen,
  onToggle,
  profileData,
}: {
  cv: CvVersion;
  isOpen: boolean;
  onToggle: () => void;
  profileData: any;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen, profileData]);

  // Clean display name
  const isRawText = isCvRawText(cv.name);
  let displayName = cv.name;
  if (isRawText) {
    // Extract the first meaningful item from the raw CV text
    const firstChunk = cv.name.split(/\s+-\s+/)[0]?.trim();
    // If it has a colon, take just the title part
    const colonIdx = firstChunk?.indexOf(":") ?? -1;
    const label = colonIdx > 0 ? firstChunk.slice(0, colonIdx).trim() : firstChunk;
    displayName = label && label.length > 3 ? `Tailored CV — ${label}` : "Tailored Resume";
  }

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out rounded-xl border",
        isOpen
          ? "bg-slate-50/40 dark:bg-slate-900/20 border-slate-200/40 dark:border-border/10 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]"
          : "border-transparent hover:bg-slate-50/35 dark:hover:bg-slate-900/10"
      )}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-3 sm:px-5 py-3.5 sm:py-4 group cursor-pointer select-none"
      >
        {/* Top row: chevron + name + default badge */}
        <div className="flex items-start gap-2.5">
          <ChevronDown
            className={cn(
              "w-4 h-4 mt-0.5 text-slate-400 shrink-0 transition-transform duration-300",
              isOpen && "rotate-180 text-[#FD5D28]"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[13px] font-bold transition-colors leading-snug line-clamp-1",
                isOpen ? "text-foreground" : "text-foreground/80 group-hover:text-foreground"
              )}>
                {displayName}
              </span>
              {cv.isDefault && (
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                  Default
                </span>
              )}
              {cv.tag && cv.tag !== "Primary Default" && cv.tag !== "Tailored Resume" && (
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded shrink-0">
                  {cv.tag}
                </span>
              )}
            </div>
            {/* Meta row below the name */}
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/60 font-medium flex-wrap">
              <span>{new Date(cv.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
              <span className="text-slate-300 dark:text-border/20">·</span>
              <span>{cv.applicationsCount} sent</span>
              <span className="text-slate-300 dark:text-border/20">·</span>
              <span>{cv.responseRate}% response rate</span>
            </div>
          </div>
        </div>
      </button>

      {/* Expandable preview area */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{ maxHeight: isOpen ? contentHeight + 20 : 0, opacity: isOpen ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-3 sm:px-5 pb-6">
          <div className="max-w-2xl mx-auto w-full px-1 sm:px-4">
            <CvPreviewPanel cv={cv} profileData={profileData} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
function CvVersionsPage() {
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Profile data for previews
  const { data: profileData } = useQuery({
    queryKey: ["profile-details-preview"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return null;
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, professional_summary, skills, work_history")
        .eq("id", data.user.id)
        .single();
      return prof;
    },
  });

  // CV data from DB
  const { data: cvDataList, isLoading: isCvsLoading } = useQuery({
    queryKey: ["db-cv-versions"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { primary: null, variants: [], isReal: false };

      const { data: profile } = await supabase
        .from("profiles")
        .select("cv_url, cv_storage_path, full_name, created_at")
        .eq("id", userData.user.id)
        .single();

      const { data: apps } = await supabase
        .from("applications")
        .select("tailored_cv, status, created_at")
        .order("created_at", { ascending: false });

      const cvMap: Record<string, { name: string; path: string; count: number; responses: number; created_at: string }> = {};

      apps?.forEach((app: any) => {
        if (app.tailored_cv) {
          const path = app.tailored_cv;
          const parts = path.split("/");
          const filename = parts.pop() || "Tailored CV";

          if (!cvMap[path]) {
            cvMap[path] = {
              name: filename,
              path,
              count: 0,
              responses: 0,
              created_at: app.created_at,
            };
          }
          cvMap[path].count++;
          if (app.status === "sent") {
            cvMap[path].responses++;
          }
        }
      });

      const variants = Object.values(cvMap).map((c, idx) => ({
        id: `cv-variant-${idx}`,
        name: c.name,
        tag: "Tailored Resume",
        created_at: c.created_at.split("T")[0],
        applicationsCount: c.count,
        responseRate: c.count > 0 ? Math.round((c.responses / c.count) * 100) : 0,
        isDefault: false,
        path: c.path,
      }));

      let primaryCv = null;
      if (profile?.cv_storage_path) {
        const parts = profile.cv_storage_path.split("/");
        const filename = parts.pop() || "Primary Default CV";
        let defaultAppsCount = 0;
        let defaultResponsesCount = 0;
        apps?.forEach((app: any) => {
          if (!app.tailored_cv) {
            defaultAppsCount++;
            if (app.status === "sent") {
              defaultResponsesCount++;
            }
          }
        });

        primaryCv = {
          id: "cv-primary",
          name: filename,
          tag: "Primary Default",
          created_at: profile.created_at ? profile.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
          applicationsCount: defaultAppsCount,
          responseRate: defaultAppsCount > 0 ? Math.round((defaultResponsesCount / defaultAppsCount) * 100) : 0,
          isDefault: true,
          path: profile.cv_storage_path,
        };
      }

      return {
        primary: primaryCv,
        variants,
        isReal: Boolean(primaryCv || variants.length > 0),
      };
    },
  });

  const isReal = cvDataList?.isReal ?? false;
  const primaryCv = cvDataList?.primary;
  const variantsList = cvDataList?.variants || [];
  const cvsList: CvVersion[] = isReal ? (primaryCv ? [primaryCv, ...variantsList] : variantsList) : DEFAULT_CVS;

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-4xl space-y-5">
      {/* Header */}
      <div className="space-y-1 pb-4">
        <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
          CV Versions
        </h1>
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 flex-wrap">
          <span>Manage your resume variants and see which versions get the most responses.</span>
          <LearnMoreLink onClick={() => setIsLearnMoreOpen(true)} />
        </p>
      </div>

      {/* Stats ribbon */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="text-foreground font-bold">{cvsList.length}</span> versions
        </span>
        <span className="text-slate-300 dark:text-border/20">·</span>
        <span className="flex items-center gap-1">
          <span className="text-foreground font-bold">{cvsList.reduce((s, c) => s + c.applicationsCount, 0)}</span> total sent
        </span>
        <span className="text-slate-300 dark:text-border/20">·</span>
        {isReal ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Data
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Sample Data
          </span>
        )}
      </div>

      {/* CV Accordion List */}
      <div className="space-y-2.5">
        {isCvsLoading ? (
          <div className="px-6 py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-border/10 bg-slate-50/10 dark:bg-slate-900/5">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span className="w-4 h-4 border-2 border-slate-300 border-t-[#FD5D28] rounded-full animate-spin" />
              Syncing CV registry…
            </div>
          </div>
        ) : cvsList.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-2 rounded-xl border border-dashed border-slate-200 dark:border-border/10 bg-slate-50/10 dark:bg-slate-900/5">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-muted-foreground font-medium">
              No CV versions found. Upload a CV in settings or apply to jobs to generate tailored versions.
            </p>
          </div>
        ) : (
          cvsList.map((cv) => (
            <CvRow
              key={cv.id}
              cv={cv}
              isOpen={expandedId === cv.id}
              onToggle={() => handleToggle(cv.id)}
              profileData={profileData}
            />
          ))
        )}
      </div>

      <LearnMoreSlider
        pageId="cv-versions"
        open={isLearnMoreOpen}
        onOpenChange={setIsLearnMoreOpen}
      />
    </div>
  );
}
