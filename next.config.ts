import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    serverActions: {
      // Student photos come straight from phone cameras. The action itself
      // rejects anything over 5 MB; the extra room is multipart overhead.
      bodySizeLimit: "6mb",
    },
    // When the connection drops, page loads and saves wait and retry once it's
    // back instead of failing. The offline banner tells staff why it's waiting.
    useOffline: true,
  },
};

// Keeps esbuild, which builds the service worker, out of the server bundle.
export default withSerwist(nextConfig);
