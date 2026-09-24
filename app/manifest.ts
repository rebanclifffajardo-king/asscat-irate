import type { MetadataRoute } from "next";

/** Web app manifest (served at /manifest.webmanifest) — makes ASSCAT iRATE installable. */
export default function manifest(): MetadataRoute.Manifest {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return {
    id: "/",
    name: "ASSCAT iRATE",
    short_name: "iRATE",
    description: "ASSCAT iRATE — Faculty Evaluation System",
    // "/" redirects to the signed-in user's dashboard, or to the login page.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#28a745",
    background_color: "#f4f6f9",
    categories: ["education", "productivity"],
    // Lets Chromium's getInstalledRelatedApps() tell the login page the app is already installed.
    ...(site ? { related_applications: [{ platform: "webapp", url: `${site}/manifest.webmanifest` }] } : {}),
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
