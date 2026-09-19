import type { NextConfig } from "next";

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
  },
};

export default nextConfig;
