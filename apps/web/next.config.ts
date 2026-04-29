import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

if (
  process.env.VERCEL === "1" &&
  process.env.NODE_ENV === "production" &&
  !process.env.SENTRY_AUTH_TOKEN
) {
  console.warn(
    "[sentry] SENTRY_AUTH_TOKEN missing — source maps will not upload. " +
      "Stack traces in Sentry will show minified output. " +
      "See docs/project-info/runbooks/OBSERVABILITY.md §1 for the fix.",
  );
}

export default withSentryConfig(nextConfig, {
  org: "brady-grapentines-organization",
  project: "carelog-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  widenClientFileUpload: true,

  tunnelRoute: "/monitoring",
});
