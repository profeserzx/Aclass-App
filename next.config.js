/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit loads its standard font files (.afm) from disk at runtime via
  // relative paths. If Next bundles it into the route's webpack chunk, those
  // paths break and report-card generation fails with a 500. Marking it
  // external keeps it as a normal node_modules require, so the paths resolve
  // correctly. See app/api/report-card/route.ts.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;
