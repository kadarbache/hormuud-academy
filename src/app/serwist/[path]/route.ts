import { createSerwistRoute } from "@serwist/turbopack";

// Builds and serves the service worker at /serwist/sw.js.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  // A new revision every build: the offline page's styles change name with
  // each build, so the cached copy must be replaced too.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
