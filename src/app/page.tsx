import Link from "next/link";

export default function RootPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white shadow-soft rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-navy">Tagglefish OS</h1>
        <p className="mt-2 text-sm text-navy/70">Multi-tenant CMS for Tagglefish clients.</p>
        <div className="mt-6">
          <Link
            href="/os/login"
            className="inline-block bg-orange text-white font-semibold px-5 py-3 rounded-lg hover:bg-orange-600"
          >
            Sign in to /os
          </Link>
        </div>
      </div>
    </main>
  );
}
