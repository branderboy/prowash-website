import type { Metadata } from "next";
import "./globals.css";

// Public pages set their own metadata via generateMetadata in src/app/site.
// OS dashboard sets noindex in src/app/os/layout.tsx. Keep the root default
// brand-neutral so non-tenant traffic doesn't see the platform name.
export const metadata: Metadata = {
  title: "Page not available",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
