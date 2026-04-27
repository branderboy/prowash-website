import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tagglefish OS",
  description: "The dashboard each Tagglefish client logs into to manage their site.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
