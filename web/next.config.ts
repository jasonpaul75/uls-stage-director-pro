import type { NextConfig } from "next";

/** Largest show-media file the app accepts (video lane). Match `SHOW_MEDIA_MAX_BYTES[VIDEO]` + small multipart headroom. */
const SHOW_MEDIA_MAX_BODY_BYTES = 1024 * 1024 * 1024 + 8 * 1024 * 1024;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      /** Default 1 MiB caps multi-part form uploads (library, intake show media, confidential files). */
      bodySizeLimit: SHOW_MEDIA_MAX_BODY_BYTES,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
