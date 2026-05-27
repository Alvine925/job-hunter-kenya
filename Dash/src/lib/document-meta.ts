type JobMetaInput = {
  title?: string | null;
  company?: string | null;
  fallbackTitle: string;
};

function upsertMeta(selector: string, attrs: Record<string, string>, content: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function setJobDocumentMeta({ title, company, fallbackTitle }: JobMetaInput) {
  if (typeof document === "undefined") return;

  const jobTitle = title?.trim();
  const companyName = company?.trim();
  const pageTitle = jobTitle
    ? `${jobTitle}${companyName ? ` at ${companyName}` : ""} - Tellus`
    : fallbackTitle;
  const description = jobTitle
    ? `View ${jobTitle}${companyName ? ` at ${companyName}` : ""}, review match details, and prepare your application with Tellus.`
    : "View job details, match insights, and prepare your application with Tellus.";

  document.title = pageTitle;
  upsertMeta('meta[name="description"]', { name: "description" }, description);
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, pageTitle);
  upsertMeta('meta[property="og:description"]', { property: "og:description" }, description);
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, pageTitle);
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
}
