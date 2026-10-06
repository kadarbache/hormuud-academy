import type { MetadataRoute } from "next";

// A private system for staff: keep search engines out. WhatsApp still draws
// the link preview from opengraph-image, because the phone sharing the link
// fetches it, not a crawler.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
