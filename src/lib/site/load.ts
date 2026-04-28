import { getDb } from "@/lib/db";

export type HeaderMenuItem = {
  label: string;
  href: string;
  style?: "cta";
  children?: Array<{ label: string; href: string }>;
};

export type FooterMenuColumn = {
  heading: string;
  items: Array<{ label: string; href: string }>;
};

export type SiteChrome = {
  settings: {
    favicon_url: string | null;
    default_og_image_url: string | null;
    primary_phone: string | null;
    ga4_id: string | null;
    gtm_id: string | null;
    google_verification: string | null;
    bing_verification: string | null;
  };
  headerMenu: HeaderMenuItem[] | null;
  footerMenu: FooterMenuColumn[] | null;
};

export async function loadSiteChrome(clientId: number): Promise<SiteChrome> {
  const sql = getDb();
  const [settings, menus] = await Promise.all([
    sql`
      SELECT favicon_url, default_og_image_url, primary_phone, ga4_id, gtm_id,
             google_verification, bing_verification
      FROM site_settings WHERE client_id = ${clientId} LIMIT 1
    ` as unknown as Promise<Array<SiteChrome["settings"]>>,
    sql`
      SELECT location, items FROM menus WHERE client_id = ${clientId}
    ` as unknown as Promise<Array<{ location: string; items: unknown }>>,
  ]);

  const empty: SiteChrome["settings"] = {
    favicon_url: null,
    default_og_image_url: null,
    primary_phone: null,
    ga4_id: null,
    gtm_id: null,
    google_verification: null,
    bing_verification: null,
  };

  let headerMenu: HeaderMenuItem[] | null = null;
  let footerMenu: FooterMenuColumn[] | null = null;
  for (const m of menus) {
    if (m.location === "header" && Array.isArray(m.items)) {
      headerMenu = m.items as HeaderMenuItem[];
    } else if (m.location === "footer" && Array.isArray(m.items)) {
      footerMenu = m.items as FooterMenuColumn[];
    }
  }

  return { settings: settings[0] ?? empty, headerMenu, footerMenu };
}
