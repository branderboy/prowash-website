import Script from "next/script";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PageBehaviors } from "@/components/site/page-behaviors";
import { resolveTenantClientId } from "@/lib/site/resolve-client";
import { loadSiteChrome } from "@/lib/site/load";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const clientId = await resolveTenantClientId();
  const chrome = clientId
    ? await loadSiteChrome(clientId)
    : { settings: {
        favicon_url: null, default_og_image_url: null, primary_phone: null,
        ga4_id: null, gtm_id: null, google_verification: null, bing_verification: null,
      }, headerMenu: null, footerMenu: null };

  const { settings, headerMenu, footerMenu } = chrome;

  return (
    <>
      {/* Per-tenant CSS lives at /css/styles.css from the legacy theme */}
      <link rel="stylesheet" href="/css/styles.css" />
      {/* Reveal animations rely on JS to add .active. If JS is disabled, show
          the content immediately. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;transform:none!important;}`}</style>
      </noscript>
      {settings.favicon_url ? <link rel="icon" href={settings.favicon_url} /> : null}
      {settings.google_verification ? (
        <meta name="google-site-verification" content={settings.google_verification} />
      ) : null}
      {settings.bing_verification ? (
        <meta name="msvalidate.01" content={settings.bing_verification} />
      ) : null}

      {settings.gtm_id ? (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${settings.gtm_id}');`}
        </Script>
      ) : null}

      {settings.ga4_id ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4_id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.ga4_id}');`}
          </Script>
        </>
      ) : null}

      {settings.gtm_id ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${settings.gtm_id}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      ) : null}

      <SiteHeader menu={headerMenu} primaryPhone={settings.primary_phone} />
      <main>{children}</main>
      <SiteFooter menu={footerMenu} primaryPhone={settings.primary_phone} />
      <PageBehaviors />
      {/* Acuity scheduling embed used on /book. Loading globally is cheap and
          guarantees the script tag executes (it can't from dangerouslySetInnerHTML). */}
      <Script src="https://embed.acuityscheduling.com/js/embed.js" strategy="lazyOnload" />
    </>
  );
}
