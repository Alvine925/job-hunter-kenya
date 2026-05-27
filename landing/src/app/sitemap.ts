import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://tellusjobs.site";

  // List of static paths in the application
  const routes = [
    "",
    "/features",
    "/how-it-works",
    "/pricing",
    "/faq",
    "/problem-solution",
    "/privacy",
    "/terms",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));
}
