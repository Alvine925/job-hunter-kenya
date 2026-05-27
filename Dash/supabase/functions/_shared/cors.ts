const ALLOWED_ORIGINS = [
  "https://www.tellusjobs.site",
  "https://tellusjobs.site",
  "https://myjobs.tellusjobs.site",
  "https://dash.tellusjobs.site",
  "https://tellus-jobs-kybc4uvbw-alvine925s-projects.vercel.app",
];

export function getCorsHeaders(origin: string | null) {
  let allowedOrigin = "https://www.tellusjobs.site";
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      allowedOrigin = origin;
    } else if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      allowedOrigin = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scrape-secret",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tellusjobs.site",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-scrape-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
