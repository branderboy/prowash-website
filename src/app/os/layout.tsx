import Link from "next/link";
import { headers } from "next/headers";
import { getOsSession } from "@/lib/os/session";
import { getDb } from "@/lib/db";

const NAV = [
  { href: "/os", label: "Dashboard" },
  { href: "/os/pages", label: "Pages" },
  { href: "/os/posts", label: "Blog Posts" },
  { href: "/os/products", label: "Products" },
  { href: "/os/orders", label: "Orders" },
  { href: "/os/menus", label: "Menus" },
  { href: "/os/seo", label: "SEO" },
  { href: "/os/tracking", label: "Tracking" },
  { href: "/os/media", label: "Media" },
  { href: "/os/health", label: "Health" },
  { href: "/os/settings", label: "Settings" },
];

async function getClientName(clientId: number): Promise<string> {
  try {
    const sql = getDb();
    const rows = (await sql`SELECT name FROM clients WHERE id = ${clientId} LIMIT 1`) as Array<{ name: string }>;
    return rows[0]?.name ?? "";
  } catch {
    return "";
  }
}

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const session = await getOsSession();
  // headers() ensures this layout opts out of static rendering
  await headers();

  // Login + verify are served via this layout but render their own full-screen UI
  if (!session) {
    return <>{children}</>;
  }

  const clientName = await getClientName(session.clientId);

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-60 bg-navy text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-xs uppercase tracking-wide text-white/50">Tagglefish OS</div>
          <div className="text-base font-semibold mt-1">{clientName || `Client #${session.clientId}`}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-xs text-white/60">
          <div className="truncate">{session.email}</div>
          <div className="capitalize">{session.role}</div>
          <form action="/api/os/auth/logout" method="post" className="mt-3">
            <button type="submit" className="text-orange hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
