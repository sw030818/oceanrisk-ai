import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  agentRules: false,
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/analyze": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
