import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Per-tenant CSS lives at /css/styles.css from the legacy theme */}
      <link rel="stylesheet" href="/css/styles.css" />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
