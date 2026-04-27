"use client";

export default function OsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold text-navy">Something went wrong</h2>
      <pre className="mt-3 text-xs bg-white p-3 rounded border border-navy/10 overflow-auto">{error.message}</pre>
      <button onClick={reset} className="mt-4 text-orange hover:underline text-sm">Try again</button>
    </div>
  );
}
