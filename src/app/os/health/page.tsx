import Link from "next/link";
import { requireOsSession } from "@/lib/os/session";
import { withClient } from "@/lib/os/tenancy";
import { runHealthChecks, type Severity } from "@/lib/os/health";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const tone: Record<Severity, string> = {
  error: "bg-red-50 text-red-800 border border-red-200",
  warning: "bg-amber-50 text-amber-800 border border-amber-200",
  info: "bg-blue-50 text-blue-800 border border-blue-200",
};

const dot: Record<Severity, string> = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

export default async function HealthPage() {
  await requireOsSession();
  const report = await withClient(({ clientId }) => runHealthChecks(clientId));
  const { checks, summary } = report;

  const ordered = [...checks].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Health</h1>
          <p className="text-sm text-navy/60 mt-1">Automated audit of your CMS, content, and integrations.</p>
        </div>
        <div className="text-xs text-navy/50">Run at {new Date(report.ranAt).toLocaleString()}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Errors" count={summary.error} tone="error" />
        <SummaryCard label="Warnings" count={summary.warning} tone="warning" />
        <SummaryCard label="Info" count={summary.info} tone="info" />
        <SummaryCard label="Tables OK" count={summary.ok} tone="info" />
      </div>

      <Card>
        <CardHeader><CardTitle>Findings</CardTitle></CardHeader>
        <CardBody className="p-0">
          {ordered.length === 0 ? (
            <div className="p-8 text-center text-sm text-green-700">No issues found.</div>
          ) : (
            <ul className="divide-y divide-navy/5">
              {ordered.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-start gap-3">
                  <span className={`mt-2 h-2 w-2 rounded-full ${dot[c.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${tone[c.severity]}`}>
                        {c.severity}
                      </span>
                      <span className="font-medium text-navy">{c.title}</span>
                    </div>
                    {c.detail ? <p className="text-sm text-navy/70 mt-1">{c.detail}</p> : null}
                    {c.link ? (
                      <Link href={c.link.href} className="text-sm text-orange hover:underline mt-1 inline-block">
                        {c.link.label} →
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-navy/50">
        This report runs every time you load the page. There's no caching here on purpose.
      </p>
    </div>
  );
}

function SummaryCard({ label, count, tone }: { label: string; count: number; tone: Severity }) {
  const colors: Record<Severity, string> = {
    error: "text-red-700",
    warning: "text-amber-700",
    info: "text-navy/70",
  };
  return (
    <Card>
      <CardBody>
        <div className="text-xs uppercase text-navy/50">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${colors[tone]}`}>{count}</div>
      </CardBody>
    </Card>
  );
}
